// Path: /api/generate.js

// This is a Vercel Edge Function that calls Google's AI for both text and images.
export const config = {
  runtime: 'edge',
};

// --- Helper function to generate an image with Imagen ---
async function generateImage(prompt, apiKey) {
  const imageUrlEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  const payload = {
    instances: [{
      // We enhance the prompt to get a simple, coloring-page style image.
      prompt: `A simple, bold outlines, cartoon-style coloring page for a 4-year-old child about: ${prompt}`
    }],
    parameters: { "sampleCount": 1 }
  };

  try {
    const response = await fetch(imageUrlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Imagen API Error:', errorBody);
        return null; // Return null on failure
    }

    const result = await response.json();
    if (result.predictions && result.predictions[0]?.bytesBase64Encoded) {
      // Return the image as a data URL
      return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
    }
    return null;

  } catch (error) {
    console.error('Error calling Imagen API:', error);
    return null;
  }
}


// --- Main function that handles requests to this endpoint ---
export default async function handler(request) {
  const { topic } = await request.json();
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!topic) {
    return new Response(JSON.stringify({ error: 'Topic is required.' }), { status: 400 });
  }
  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'API key is not configured.' }), { status: 500 });
  }

  // This prompt now asks for a JSON object directly, which is more reliable.
  const systemPrompt = `You are KinderSpark AI, a friendly and expert assistant for kindergarten teachers. Your purpose is to create complete, engaging, Montessori-inspired lesson plans for children aged 3-6.
  
  Your response MUST be ONLY a valid JSON object. Do NOT use markdown or any other formatting.
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
    "imagePrompt": "A very simple 2-4 word phrase describing the core subject for a coloring page (e.g., 'friendly smiling sun', 'stack of books')."
  }`;

  const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
  const textPayload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: `Topic: ${topic}` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.8,
      maxOutputTokens: 2048,
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
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return new Response(JSON.stringify({ error: 'AI returned an empty text response.' }), { status: 500 });
    }

    const lessonPlan = JSON.parse(generatedText);

    // --- 2. Generate the image ---
    let imageUrl = null;
    if (lessonPlan.imagePrompt) {
      imageUrl = await generateImage(lessonPlan.imagePrompt, geminiApiKey);
    }
    
    // --- 3. Send both back to the client ---
    return new Response(JSON.stringify({ lessonPlan, imageUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate handler:', error);
    return new Response(JSON.stringify({ error: 'An internal server error occurred.' }), { status: 500 });
  }
}

