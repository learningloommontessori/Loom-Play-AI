// Path: /api/generate.js

// This is a Vercel Node.js Function. It uses axios for robust ClipDrop API calls.
import axios from 'axios';
import FormData from 'form-data';

// --- Helper function to generate an image with ClipDrop ---
async function generateImageWithClipDrop(prompt, apiKey) {
    const formData = new FormData();
    formData.append('prompt', `A simple, bold outlines, cartoon-style coloring page for a 4-year-old child about: ${prompt}`);

    try {
        const response = await axios.post('https://api.clipdrop.co/text-to-image/v1', formData, {
            headers: {
                ...formData.getHeaders(),
                'x-api-key': apiKey,
            },
            responseType: 'arraybuffer',
        });
        
        const base64Image = Buffer.from(response.data).toString('base64');
        return `data:image/png;base64,${base64Image}`;

    } catch (error) {
        console.error('ClipDrop API Error:', error.response ? error.response.data.toString() : error.message);
        return null;
    }
}

// --- Main function that handles requests to this endpoint ---
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { topic } = request.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const clipdropApiKey = process.env.CLIPDROP_API_KEY;

    if (!topic) {
        return response.status(400).json({ error: 'Topic is required.' });
    }
    if (!geminiApiKey || !clipdropApiKey) {
        return response.status(500).json({ error: 'API keys are not configured on the server.' });
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

        let imageUrl = null;
        if (lessonPlan.imagePrompt) {
            imageUrl = await generateImageWithClipDrop(lessonPlan.imagePrompt, clipdropApiKey);
        }
        
        return response.status(200).json({ lessonPlan, imageUrl });

    } catch (error) {
        console.error('Error in generate handler:', error);
        return response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}

