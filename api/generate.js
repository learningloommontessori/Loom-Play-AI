// Path: /api/generate.js
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405, headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    // --- 1. GET DATA (Including Age) ---
    // ** THE FIX **: Extract 'age' from the request body
    const { topic, language, age } = await request.json(); 
    
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return new Response(JSON.stringify({ error: 'Authentication token is required.' }), { status: 401 });
    }
    
    // Auth Check
    const supabaseUserClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);

    if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid or expired user session.' }), { status: 401 });
    }

    // --- 2. GENERATE LESSON PLAN ---
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!topic || !geminiApiKey) {
        return new Response(JSON.stringify({ error: 'Topic and API Key are required.' }), { status: 400 });
    }
    
    // ** THE FIX **: Dynamic Prompt based on Age Group
    const systemPrompt = `You are KinderSpark AI, an expert assistant for kindergarten teachers.
    
    Topic: "${topic}"
    Target Audience: ${age || "Children aged 3-6"} 
    Language: Write strictly in ${language}.

    CRITICAL INSTRUCTION: Adapt the complexity, vocabulary, and activities specifically for the "${age}" level.
    - If "Nursery": Focus on sensory exploration, gross motor skills, very simple language, and repetition.
    - If "Juniors": Balance sensory play with early cognitive concepts (patterns, sorting).
    - If "Seniors": Include more complex questions, early math/reading readiness, and multi-step activities.

    Your response MUST be ONLY a valid, complete JSON object. Do NOT use markdown.
    The JSON object must follow this exact structure:
    {"newlyCreatedContent":{"originalRhyme": "...", "originalMiniStory": "..."},"newActivities":{"artCraftActivity": "...", "motorSkillsActivity": "...", "sensoryExplorationActivity": "..."},"movementAndMusic":{"grossMotorActivity": "...", "fineMotorActivity": "...", "actionSong": "..."},"socialAndEmotionalLearning":{"graceAndCourtesy": "...", "problemSolvingScenario": "..."},"classicResources":{"familiarRhymesAndSongs": ["..."], "classicStoryBooks": ["..."]},"montessoriConnections":{"traditionalUseOfMaterials": "...", "newWaysToUseMaterials": "..."},"teacherResources":{"observationCues": "...", "environmentSetup": "..."}}`;
    
    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    const textPayload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: `Generate a Montessori lesson plan for: ${topic}` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 8192 },
    };
    
    const textApiResponse = await fetch(textApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload),
    });

    if (!textApiResponse.ok) {
        throw new Error('Failed to generate lesson plan from AI.');
    }
    
    const textData = await textApiResponse.json();
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
        throw new Error('AI returned an empty text response.');
    }
    
    const lessonPlan = JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim());

    // --- 3. SAVE TO DATABASE ---
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: dbError } = await supabaseAdmin
      .from('AIGeneratedContent')
      .insert([{
          user_id: user.id,
          topic: topic,
          content_json: lessonPlan,
          language: language
          // Note: We are not saving 'age' column to DB yet to avoid breaking schema, 
          // but the content itself is now adapted!
      }]);

    if (dbError) {
        console.error('Supabase DB Insert Error:', dbError);
        throw new Error(`Supabase error: ${dbError.message}`);
    }
    
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