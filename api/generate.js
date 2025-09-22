// Path: /api/generate.js

// This is a Vercel Node.js Function. We've removed the 'edge' runtime for better compatibility.
// It integrates with ClipDrop and Google's AI.

// --- Helper function to generate an image with ClipDrop ---
async function generateImageWithClipDrop(prompt, apiKey) {
    // ClipDrop requires a FormData object for the request
    const formData = new FormData();
    // We enhance the prompt to guide the AI toward a coloring page style
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
        
        // Convert the image response to a base64 data URL
        const imageBuffer = await response.arrayBuffer();
        // Use Buffer, which is available in the Node.js runtime
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        return `data:image/png;base64,${base64Image}`;

    } catch (error) {
        console.error('Error calling ClipDrop API:', error);
        return null;
    }
}

// --- Main function that handles requests to this endpoint ---
export default async function handler(request, response) {
    // In the Node.js runtime, we get the body from request.body
    const { topic } = request.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const clipdropApiKey = process.env.CLIPDROP_API_KEY;

    // Security and validation checks
    if (!topic) {
        return response.status(400).json({ error: 'Topic is required.' });
    }
    if (!geminiApiKey || !clipdropApiKey) {
        return response.status(500).json({ error: 'API keys are not configured on the server.' });
    }
    
    // This prompt instructs the AI on its persona and the exact JSON structure required.
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
    },
    "imagePrompt": "A simple 2-4 word phrase for a coloring page (e.g., 'happy smiling sun')."
  }`;

    try {
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
        
        // --- 1. Generate the lesson plan text ---
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
        return response.status(200).json({ lessonPlan, imageUrl });

    } catch (error) {
        console.error('Error in generate handler:', error);
        return response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}

