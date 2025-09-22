// Path: /api/generate.js

// This is a Vercel Edge Function. It is fast and does not require installing dependencies,
// aligning with your final package.json.
export const config = {
  runtime: 'edge',
};

// --- Main function that handles requests to this endpoint ---
export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405, 
        headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const { topic } = await request.json();
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Topic is required.' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'API key is not configured on the server.' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are KinderSpark AI, an expert assistant for kindergarten teachers specializing in the Montessori method for children aged 3-6.
  
    Your response MUST be ONLY a valid, complete JSON object. Do NOT use markdown or any text outside the JSON structure.
    All strings within the JSON must be properly escaped.
    For 'classicStoryBooks', provide the title and author. For 'familiarRhymesAndSongs', provide just the title.
    The JSON object must follow this exact structure:
    {
      "newlyCreatedContent": {
        "originalRhyme": "A simple, 4-8 line rhyming poem.",
        "originalMiniStory": "A short, simple story (3-5 paragraphs)."
      },
      "newActivities": {
        "artCraftActivity": "A creative, hands-on art project.",
        "motorSkillsActivity": "An activity for fine or gross motor skills.",
        "sensoryExplorationActivity": "A sensory bin, nature walk, or simple science experiment."
      },
      "movementAndMusic": {
          "grossMotorActivity": "An activity for large muscle movements.",
          "fineMotorActivity": "An activity for hand-eye coordination.",
          "actionSong": "A song that involves physical actions."
      },
      "socialAndEmotionalLearning": {
          "graceAndCourtesy": "A lesson on manners or social skills.",
          "problemSolvingScenario": "A short, age-appropriate scenario to discuss."
      },
      "classicResources": {
        "familiarRhymesAndSongs": ["Title of a classic song.", "Title of another classic song."],
        "classicStoryBooks": ["'Book Title' by Author Name", "'Another Book Title' by Author Name"]
      },
      "montessoriConnections": {
        "traditionalUseOfMaterials": "Suggest 2-3 ways to use traditional Montessori materials.",
        "newWaysToUseMaterials": "Suggest 2-3 creative ways to use Montessori materials."
      },
      "teacherResources": {
          "observationCues": "Things a teacher should look for to assess understanding.",
          "environmentSetup": "How to prepare the classroom for this topic."
      }
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
    
    const textApiResponse = await fetch(textApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload),
    });

    if (!textApiResponse.ok) {
        const errorBody = await textApiResponse.text();
        console.error('Gemini Text API Error:', errorBody);
        throw new Error('Failed to generate lesson plan from AI.');
    }
    
    const textData = await textApiResponse.json();
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
        throw new Error('AI returned an empty text response.');
    }
    
    let lessonPlan;
    try {
        // A minimal cleaning step is still good practice.
        const cleanedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
        lessonPlan = JSON.parse(cleanedText);
    } catch (parseError) {
        console.error("Failed to parse AI JSON response. Raw text:", generatedText);
        throw new Error("AI returned an invalid JSON format.");
    }

    // Return only the lesson plan, no image.
    return new Response(JSON.stringify({ lessonPlan }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate handler:', error);
    return new Response(JSON.stringify({ error: error.message || 'An internal server error occurred.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}

