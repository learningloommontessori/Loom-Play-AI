// api/generate.js
import { createClient } from '@supabase/supabase-js';

// Retry helper to handle Rate Limits (429) - Critical for Free Tier
async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        console.warn(`Attempt ${i + 1} failed (429). Retrying...`);
        await new Promise(r => setTimeout(r, backoff));
        backoff *= 2;
        continue;
      }
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    } catch (err) {
      if (i === retries - 1) throw err;
    }
  }
}

export default async function handler(req, res) {
  // CORS Headers
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

    // *** FIX: USE GEMINI 1.5 FLASH (Most Reliable Free Tier) ***
    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    // NEP 2020 & PRIMARY SCHOOL PROMPT
    const systemPrompt = `You are "Loom Thread," an expert primary school curriculum designer (Grades 1-5) aligned with India's NEP 2020 policies.
    Topic: "${topic}", Target Audience: "${age}", Language: "${language}".

    KEY GUIDELINES:
    1. **Magic Box:** Use ONLY standard classroom items (Chalk, Duster, Bottle, Bag).
    2. **Bhasha Sangam:** Provide local translations for key terms.
    3. **Worksheet:** Provide content suitable for a printable page.

    You MUST return ONLY valid JSON. Structure:
    {
      "imagePrompt": "A highly detailed, cute, 3D Pixar-style scene description of the story hook. No text in image.",
      
      "lessonStarters": {
        "storyHook": "Short creative story (100 words).",
        "wonderQuestion": "Provocative question.",
        "realWorldConnection": "Connection to daily life."
      },
      "magicBoxActivity": {
        "activityName": "Name of Activity",
        "materialsUsed": "List of standard items.",
        "instructions": "Step-by-step guide."
      },
      "bhashaSangam": {
         "bridgeVocabulary": ["List key English terms translated to ${language} (or Hindi) with analogies."]
      },
      "activeLearning": {
        "groupGame": "Classroom game details.",
        "artIntegration": "Craft activity."
      },
      "teachingGuide": {
        "blackboardSummary": ["Point 1", "Point 2", "Point 3"],
        "misconceptionCheck": "Common mistakes and corrections."
      },
      "practiceAndAssess": {
        "worksheetFillBlanks": ["3 sentences with blanks."],
        "worksheetTrueFalse": ["3 statements."],
        "exitTickets": ["3 quick questions."]
      },
      "inclusiveCorner": {
        "remedialSupport": "Tips for struggling students.",
        "challengeTasks": "Tips for advanced students."
      },
      "valuesAndSkills": { 
        "valueOfTheDay": "Moral lesson.", 
        "criticalThinkingQs": ["Open-ended question."]
      },
      "resourceHub": {
          "bookList": ["Book 1", "Book 2"],
          "educationalVideos": ["Video Search Term 1", "Video Search Term 2"],
          "materialChecklist": ["Item 1", "Item 2"]
      }
    }`;

    const textPayload = {
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    };
    
    const textApiResponse = await fetchWithRetry(textApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload),
    });

    const textData = await textApiResponse.json();
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;
    const lessonPlan = JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim());

    // SAVE TO DB
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabaseAdmin.from('AIGeneratedContent').insert([{
          user_id: user.id, topic: topic, content_json: lessonPlan, language: language, age: age
    }]);

    return res.status(200).json({ success: true, lessonPlan: lessonPlan });

  } catch (error) {
    console.error("Generate API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}