// Path: /api/generate.js

// This is a Vercel Edge Function that calls two AIs: Google for text and ClipDrop for images.
export const config = {
  runtime: 'edge',
};

// --- Helper function to generate an image with ClipDrop ---
async function generateImageWithClipDrop(prompt, apiKey) {
  // FormData is available globally in the Vercel Edge Runtime
  const formData = new FormData();
  // We enhance the prompt to get a simple, coloring-page style image
  formData.append('prompt', `A simple, bold outlines, cartoon-style coloring page for a 4-year-old child about: ${prompt}`);

  try {
    const response = await fetch('https://api.clipdrop.co/text-to-image/v1', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('ClipDrop API Error:', errorBody);
      return null; // Return null on failure
    }

    // The response is the image itself, so we read it as a blob
    const imageBlob = await response.blob();
    
    // We need to convert the blob to a base64 data URL to send it in JSON
    const reader = new FileReader();
    const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
    });
    
    return await base64Promise;

  } catch (error) {
    console.error('Error calling ClipDrop API:', error);
    return null;
  }
}


// --- Main function that handles requests to this endpoint ---
export default async function handler(request) {
  const { topic } = await request.json();
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const clipdropApiKey = process.env.CLIPDROP_API_KEY;


  if (!topic) {
    return new Response(JSON.stringify({ error: 'Topic is required.' }), { status: 400 });
  }
  if (!geminiApiKey || !clipdropApiKey) {
    return new Response(JSON.stringify({ error: 'An API key is not configured on the server.' }), { status: 500 });
  }

  // This prompt instructs the AI to return a reliable JSON object, including a prompt for the image.
  const systemPrompt = `You are KinderSpark AI, a friendly and expert assistant for kindergarten teachers. Your purpose is to create complete, engaging, Montessori-inspired lesson plans for children aged 3-6.
  
  Your response MUST be ONLY a valid JSON object. Do NOT use any markdown.
  The JSON object must follow this exact structure:
  {
    "newlyCreatedContent": {
      "originalRhyme": "A simple, 4-8 line rhyming poem about the topic.",
      "originalMiniStory": "A short, simple story (3-5 paragraphs) with a positive message."
    },
    "newActivities": {
      "artCraftActivity": "A creative, hands-on art project.",
      "motorSkillsActivity": "An activity for fine or gross motor skills.",
      "sensoryExplorationActivity": "A sensory bin, nature walk, or simple science experiment."
    },
    "classicResources": {
      "familiarRhymesAndSongs": ["List of 2-3 classic children's songs or rhymes."],
      "classicStoryBooks": ["List of 2-3 popular children's books with authors."]
    },
    "montessoriConnections": {
      "traditionalUseOfMaterials": "Suggest 2-3 ways to use traditional Montessori materials.",
      "newWaysToUseMaterials": "Suggest 2-3 creative, non-traditional ways to use Montessori materials."
    },
    "movementAndMusic": {
      "grossMotorActivity": "An activity for large muscle movements.",
      "fineMotorActivity": "An activity for hand-eye coordination.",
      "actionSong": "A song with related physical actions."
    },
    "socialAndEmotionalLearning": {
      "graceAndCourtesy": "A lesson on manners or interacting with others.",
      "problemSolvingScenario": "A short, age-appropriate scenario to discuss."
    },
    "teacherResources": {
      "observationCues": "Specific things a teacher should look for to assess understanding.",
      "environmentSetup": "How to prepare the classroom for this topic."
    },
    "imagePrompt": "A very simple 2-4 word phrase describing the core subject for a coloring page (e.g., 'friendly smiling sun', 'stack of books')."
  }`;

  const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
  const textPayload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: `Topic: ${topic}` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.8,
      maxOutputTokens: 8192,
    },
  };

  try {
    // --- 1. Generate the lesson plan text ---
    const textResponse = await fetch(textApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textPayload),
    });

    if (!textResponse.ok) {
      const errorBody = await textResponse.text();
      console.error('Gemini Text API Error:', errorBody);
      return new Response(JSON.stringify({ error: 'Failed to generate lesson plan.' }), { status: 500 });
    }
    
    const textData = await textResponse.json();
    let generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return new Response(JSON.stringify({ error: 'AI returned an empty text response.' }), { status: 500 });
    }
    
    let lessonPlan;
    try {
        const cleanedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
        lessonPlan = JSON.parse(cleanedText);
    } catch (parseError) {
        console.error("Failed to parse AI JSON response. Raw text:", generatedText);
        throw new Error("AI returned invalid JSON format. Please try again.");
    }

    // --- 2. Generate the image using ClipDrop ---
    let imageUrl = null;
    if (lessonPlan.imagePrompt) {
      imageUrl = await generateImageWithClipDrop(lessonPlan.imagePrompt, clipdropApiKey);
    }
    
    // --- 3. Send both back to the client ---
    return new Response(JSON.stringify({ lessonPlan, imageUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate handler:', error);
    return new Response(JSON.stringify({ error: error.message || 'An internal server error occurred.' }), { status: 500 });
  }
}

