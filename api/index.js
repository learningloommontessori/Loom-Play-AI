<<<<<<< HEAD
// This is your backend serverless function
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const FormData = require('form-data'); // Needed for ClipDrop

// Initialize the Express app
const app = express();
app.use(express.json());

// Get your secret keys from Vercel's environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

// Initialize your clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Function to generate an image with ClipDrop
async function generateImageWithClipDrop(prompt) {
    try {
        const form = new FormData();
        form.append('prompt', `(Bold outlines, simple shapes, cartoon style, coloring page), ${prompt}`); // Enhanced prompt for coloring pages

        const response = await axios.post('https://api.clipdrop.co/text-to-image/v1', form, {
            headers: {
                ...form.getHeaders(),
                'x-api-key': CLIPDROP_API_KEY
            },
            responseType: 'arraybuffer'
        });

        const base64Image = Buffer.from(response.data).toString('base64');
        return `data:image/png;base64,${base64Image}`;

    } catch (error) {
        console.error('Error generating image with ClipDrop:', error.response ? error.response.data.toString() : error.message);
        return null;
    }
}

// This is your main API endpoint
app.post('/', async (req, res) => {
    try {
        // --- 1. SECURITY CHECK ---
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) { return res.status(401).json({ error: 'Unauthorized: No token provided.' }); }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) { return res.status(401).json({ error: 'Unauthorized: Invalid token.' }); }
        
        // --- 2. GET THE TOPIC FROM THE FRONTEND ---
        const { topic } = req.body;
        if (!topic) { return res.status(400).json({ error: 'Topic is required.' }); }

        // --- 3. THE AI PROMPT ---
        const prompt = `
            You are "Learning Loom AI", an expert in the Maria Montessori educational philosophy. 
            For the topic "${topic}", generate a complete set of activities for a Montessori classroom.
            Your response MUST be ONLY a valid JSON object. Do NOT use markdown or any other formatting.
            The JSON object must have the following exact structure, with content tailored for the topic:
            {
              "topic": "${topic}",
              "tabs": {
                "storyAndRhyme": {
                  "learningStory": "A short, simple narrative.",
                  "originalRhyme": "A catchy, memorable rhyme.",
                  "keyVocabulary": ["word1", "word2", "word3"]
                },
                "handsOnActivities": {
                  "practicalLife": "A real-world skill activity.",
                  "sensorial": "An activity focused on engaging the senses.",
                  "artAndCraft": "A process-focused creative task."
                },
                "movementAndMusic": {
                  "grossMotor": "A game for large muscle movement.",
                  "fineMotor": "An activity for hand-eye coordination.",
                  "actionSong": "A song with related physical movements."
                },
                "explorationAndDiscovery": {
                  "natureConnection": "An idea for an outdoor activity.",
                  "simpleExperiment": "A safe, basic discovery task.",
                  "graceAndCourtesy": "A related social skill or mannerism."
                },
                "printablesAndResources": {
                  "worksheetIdea": "A description of a simple printable worksheet.",
                  "threePartCards": "Ideas for classic Montessori vocabulary cards.",
                  "videoLinks": ["http://youtube.com/link1", "http://youtube.com/link2"]
                },
                "parentPartnership": {
                  "homeConnection": "A simple, direct activity parents can do at home.",
                  "conversationStarters": "Questions parents can ask their child.",
                  "weekendProjectIdea": "A slightly more involved, fun family project."
                },
                "teachersCorner": {
                  "observationCues": "Specific things to look for to assess understanding.",
                  "environmentSetup": "How to prepare the classroom for this topic.",
                  "montessoriConcept": "Which core Montessori principle this lesson connects to."
                }
              },
              "imageSearchQuery": "A simple 2-3 word phrase for finding a relevant stock photo or creating a coloring page."
            }
        `;

        // --- 4. CALL THE AI FOR TEXT ---
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent(prompt);
        let textResponse = result.response.text().replace(/```json\n|```/g, '').trim();
        const lessonPlanJson = JSON.parse(textResponse);

        // --- 5. CALL THE AI FOR IMAGE ---
        const imageUrl = await generateImageWithClipDrop(lessonPlanJson.imageSearchQuery);

        // --- 6. SAVE TO DATABASE ---
        const { error: dbError } = await supabase
            .from('GeneratedContent')
            .insert([{ 
                topic: topic, 
                language: 'English',
                content_json: lessonPlanJson,
                user_id: user.id 
            }]);

        if (dbError) {
            console.error('Database Error:', dbError);
            throw new Error('Failed to save content to the database.');
        }

        // --- 7. SEND THE COMBINED RESULT BACK TO THE FRONTEND ---
        res.status(200).json({
            lessonPlan: lessonPlanJson,
            imageUrl: imageUrl
        });

    } catch (error) {
        console.error('Error in /api/server:', error);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

// This makes the code work on Vercel
=======
// This is your backend serverless function
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const FormData = require('form-data'); // Needed for ClipDrop

// Initialize the Express app
const app = express();
app.use(express.json());

// Get your secret keys from Vercel's environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

// Initialize your clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Function to generate an image with ClipDrop
async function generateImageWithClipDrop(prompt) {
    try {
        const form = new FormData();
        form.append('prompt', `(Bold outlines, simple shapes, cartoon style, coloring page), ${prompt}`); // Enhanced prompt for coloring pages

        const response = await axios.post('https://api.clipdrop.co/text-to-image/v1', form, {
            headers: {
                ...form.getHeaders(),
                'x-api-key': CLIPDROP_API_KEY
            },
            responseType: 'arraybuffer'
        });

        const base64Image = Buffer.from(response.data).toString('base64');
        return `data:image/png;base64,${base64Image}`;

    } catch (error) {
        console.error('Error generating image with ClipDrop:', error.response ? error.response.data.toString() : error.message);
        return null;
    }
}

// This is your main API endpoint
app.post('/', async (req, res) => {
    try {
        // --- 1. SECURITY CHECK ---
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) { return res.status(401).json({ error: 'Unauthorized: No token provided.' }); }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) { return res.status(401).json({ error: 'Unauthorized: Invalid token.' }); }
        
        // --- 2. GET THE TOPIC FROM THE FRONTEND ---
        const { topic } = req.body;
        if (!topic) { return res.status(400).json({ error: 'Topic is required.' }); }

        // --- 3. THE AI PROMPT ---
        const prompt = `
            You are "Learning Loom AI", an expert in the Maria Montessori educational philosophy. 
            For the topic "${topic}", generate a complete set of activities for a Montessori classroom.
            Your response MUST be ONLY a valid JSON object. Do NOT use markdown or any other formatting.
            The JSON object must have the following exact structure, with content tailored for the topic:
            {
              "topic": "${topic}",
              "tabs": {
                "storyAndRhyme": {
                  "learningStory": "A short, simple narrative.",
                  "originalRhyme": "A catchy, memorable rhyme.",
                  "keyVocabulary": ["word1", "word2", "word3"]
                },
                "handsOnActivities": {
                  "practicalLife": "A real-world skill activity.",
                  "sensorial": "An activity focused on engaging the senses.",
                  "artAndCraft": "A process-focused creative task."
                },
                "movementAndMusic": {
                  "grossMotor": "A game for large muscle movement.",
                  "fineMotor": "An activity for hand-eye coordination.",
                  "actionSong": "A song with related physical movements."
                },
                "explorationAndDiscovery": {
                  "natureConnection": "An idea for an outdoor activity.",
                  "simpleExperiment": "A safe, basic discovery task.",
                  "graceAndCourtesy": "A related social skill or mannerism."
                },
                "printablesAndResources": {
                  "worksheetIdea": "A description of a simple printable worksheet.",
                  "threePartCards": "Ideas for classic Montessori vocabulary cards.",
                  "videoLinks": ["http://youtube.com/link1", "http://youtube.com/link2"]
                },
                "parentPartnership": {
                  "homeConnection": "A simple, direct activity parents can do at home.",
                  "conversationStarters": "Questions parents can ask their child.",
                  "weekendProjectIdea": "A slightly more involved, fun family project."
                },
                "teachersCorner": {
                  "observationCues": "Specific things to look for to assess understanding.",
                  "environmentSetup": "How to prepare the classroom for this topic.",
                  "montessoriConcept": "Which core Montessori principle this lesson connects to."
                }
              },
              "imageSearchQuery": "A simple 2-3 word phrase for finding a relevant stock photo or creating a coloring page."
            }
        `;

        // --- 4. CALL THE AI FOR TEXT ---
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent(prompt);
        let textResponse = result.response.text().replace(/```json\n|```/g, '').trim();
        const lessonPlanJson = JSON.parse(textResponse);

        // --- 5. CALL THE AI FOR IMAGE ---
        const imageUrl = await generateImageWithClipDrop(lessonPlanJson.imageSearchQuery);

        // --- 6. SAVE TO DATABASE ---
        const { error: dbError } = await supabase
            .from('GeneratedContent')
            .insert([{ 
                topic: topic, 
                language: 'English',
                content_json: lessonPlanJson,
                user_id: user.id 
            }]);

        if (dbError) {
            console.error('Database Error:', dbError);
            throw new Error('Failed to save content to the database.');
        }

        // --- 7. SEND THE COMBINED RESULT BACK TO THE FRONTEND ---
        res.status(200).json({
            lessonPlan: lessonPlanJson,
            imageUrl: imageUrl
        });

    } catch (error) {
        console.error('Error in /api/server:', error);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

// This makes the code work on Vercel
>>>>>>> b6d6e5e868a9976745a2e992b94117e837f71788
module.exports = app;