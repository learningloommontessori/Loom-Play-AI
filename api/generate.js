// api/generate.js
import { createClient } from '@supabase/supabase-js';

// Retry helper to handle Rate Limits (429)
async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // Handle Rate Limits (429) or Server Overload (503)
      if (response.status === 429 || response.status === 503) {
        console.warn(`Attempt ${i + 1} failed (${response.status}). Retrying...`);
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { topic, language, age, section } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey || !topic) return res.status(400).json({ error: 'Missing configuration' });

    // AUTH CHECK
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    
    const supabaseUserClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid user' });

    // --- HYBRID MODEL SELECTION ---
    // Part 1 (Story/Concept) -> Use the "Smart Brain" (2.5 Flash)
    // Part 2 & 3 (Lists/Drills) -> Use the "Fast Runner" (2.5 Flash-Lite) to save quota
    
    let modelName = 'gemini-2.5-flash-lite'; // Default to Lite for safety
    
    if (section === 'part1') {
        modelName = 'gemini-2.5-flash'; // Use the smarter model only for the story
    }

    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    
    // --- DYNAMIC PROMPTS ---
    let partialPrompt = "";
    let jsonStructure = "";

    if (section === 'part1') {
        // CORE LESSON (Expensive Model)
        partialPrompt = "Focus on the introduction, image prompt, and main activities.";
        jsonStructure = `
        {
          "imagePrompt": "A detailed text description for an educational infographic explaining '${topic}' for ${age} kids. Describe the layout, icons, and colors. No text in image.",
          "lessonStarters": {
            "storyHook": "Short creative story (100 words).",
            "wonderQuestion": "Provocative question.",
            "realWorldConnection": "Connection to daily life."
          },
          "activeLearning": {
            "groupGame": "Classroom game details.",
            "artIntegration": "Craft activity."
          },
           "teachingGuide": {
            "blackboardSummary": ["Point 1", "Point 2", "Point 3"],
            "misconceptionCheck": "Common mistakes and corrections."
          }
        }`;
    } else if (section === 'part2') {
        // NEP 2020 FEATURES (Cheap Model)
        partialPrompt = "Focus strictly on India's NEP 2020 features: Magic Box (Toy Pedagogy), Bhasha Sangam (Translation), and FLN.";
        jsonStructure = `
        {
          "magicBoxActivity": {
            "activityName": "Name of Activity",
            "materialsUsed": ["List ONLY standard items like Chalk, Duster, Bottle, Bag"],
            "instructions": "Step-by-step guide."
          },
          "bhashaSangam": {
             "bridgeVocabulary": ["List 3-5 key English terms translated to ${language} (or Hindi) with analogies."]
          },
          "flnBoosters": {
             "literacyDrill": "A 5-minute rapid-fire reading game.",
             "numeracyDrill": "A 5-minute mental math activity."
          }
        }`;
    } else if (section === 'part3') {
        // ASSESSMENT (Cheap Model)
        partialPrompt = "Focus on assessment, inclusive strategies, and resources.";
        jsonStructure = `
        {
          "holisticProgressCard": {
             "observationRubric": ["Qualitative checklist item 1", "Qualitative checklist item 2"]
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
          "resourceHub": {
              "bookList": ["Book 1", "Book 2"],
              "educationalVideos": ["Video Search Term 1", "Video Search Term 2"],
              "materialChecklist": ["Item 1", "Item 2"]
          }
        }`;
    } else {
        return res.status(400).json({ error: "Invalid section requested" });
    }

    const systemPrompt = `You are "Loom Thread," an expert primary school curriculum designer (Grades 1-5) aligned with India's NEP 2020.
    Topic: "${topic}", Target Audience: "${age}", Language: "${language}".
    
    TASK: Generate ONLY the JSON for the requested section.
    ${partialPrompt}

    You MUST return ONLY valid JSON. Structure:
    ${jsonStructure}`;

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
    
    if (!generatedText) throw new Error("No text generated from Gemini");
    
    const lessonPlan = JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim());

    return res.status(200).json({ success: true, lessonPlan: lessonPlan });

  } catch (error) {
    console.error("Generate API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}