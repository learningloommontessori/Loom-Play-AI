// api/generate.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { topic, language, age } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey || !topic) return res.status(400).json({ error: 'Missing configuration' });

    // AUTH CHECK
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    
    const supabaseUserClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid user' });

    // 1. SWITCH TO GEMINI 2.0 FLASH (Better at complex JSON & Storytelling)
    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    
    // 2. NEP 2020 ALIGNED PROMPT
    const systemPrompt = `You are "Loom Thread," an expert primary school curriculum designer (Grades 1-5) aligned with India's NEP 2020 policies.
    Topic: "${topic}", Target Audience: "${age}" (approx 6-11 years old), Language: "${language}".

    KEY PEDAGOGY GUIDELINES:
    1. **Magic Box (Toy-Based Pedagogy):** For activities, assume the teacher ONLY has standard classroom items (Chalk, Duster, Tiffin Boxes, Water Bottles, School Bags, Pencils). Do NOT ask for bought materials.
    2. **Bhasha Sangam:** Always provide local language context for difficult English terms.
    3. **FLN Focus:** Include quick drills for Foundational Literacy and Numeracy.

    You MUST return ONLY valid JSON.
    THE JSON STRUCTURE MUST BE EXACTLY THIS:
    {
      "imagePrompt": "A highly detailed, cute, 3D Pixar-style text description of a scene that best represents this lesson's 'Story Hook'. Describe the characters, colors, and lighting. Do NOT include text in the image.",

      "lessonStarters": {
        "storyHook": "A short, creative original story (approx 100 words) to introduce the topic.",
        "wonderQuestion": "A provocative 'Did you know?' or 'What if?' question to spark curiosity immediately.",
        "realWorldConnection": "Explain how this topic connects to the child's daily life in an Indian context."
      },
      "magicBoxActivity": {
        "activityName": "Name of the Toy-Based Activity",
        "materialsUsed": "List ONLY standard classroom items used (e.g., Water Bottle, Chalk).",
        "instructions": "Step-by-step guide to teaching the concept using these objects."
      },
      "bhashaSangam": {
         "bridgeVocabulary": [
            "List 3-5 key English terms from the lesson and their translation in ${language} (or Hindi) with a simple cultural analogy."
         ]
      },
      "flnBoosters": {
         "literacyDrill": "A 5-minute rapid-fire game to boost reading/vocabulary related to the topic (NIPUN Bharat).",
         "numeracyDrill": "A 5-minute mental math activity connecting the topic to numbers."
      },
      "activeLearning": {
        "groupGame": "A dynamic classroom game (charades, relay, etc.) that reinforces the concept.",
        "artIntegration": "A drawing, craft, or model-making task related to the topic using waste material."
      },
      "teachingGuide": {
        "blackboardSummary": ["List of 3-5 key points exactly as they should be written on the board."],
        "misconceptionCheck": "Common mistakes students make with this topic and how to correct them."
      },
      "holisticProgressCard": {
         "observationRubric": [
            "Create a qualitative rubric checklist. Example: 'Student participation: Rarely / Sometimes / Always'."
         ]
      },
      "practiceAndAssess": {
        "worksheetIdeas": ["List 3 distinct ideas for worksheet questions (Fill in blanks, Match the following)."],
        "exitTickets": ["List 3 quick questions to ask at the door."]
      },
      "inclusiveCorner": {
        "remedialSupport": "Specific tips for helping students who are struggling.",
        "challengeTasks": "Advanced tasks for high-achieving students."
      },
      "resourceHub": {
          "bookList": ["List 2-3 age-appropriate book titles."],
          "educationalVideos": ["List 2-3 specific search terms for educational YouTube videos."]
      }
    }`;

    const textPayload = {
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    };
    
    const textApiResponse = await fetch(textApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload),
    });

    if (!textApiResponse.ok) {
        const errText = await textApiResponse.text();
        throw new Error(`Gemini API Error: ${errText}`);
    }
    
    const textData = await textApiResponse.json();
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;
    const lessonPlan = JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim());

    // SAVE TO DB
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabaseAdmin.from('AIGeneratedContent').insert([{
          user_id: user.id, topic: topic, content_json: lessonPlan, language: language, age: age
    }]);

    // RETURN WRAPPED RESPONSE
    return res.status(200).json({ success: true, lessonPlan: lessonPlan });

  } catch (error) {
    console.error("Generate API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}