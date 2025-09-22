// Path: /api/generate.js
// This is a Vercel Edge Function that calls Google's AI for text generation.
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { topic } = await request.json();
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!topic) {
    return new Response(JSON.stringify({ error: 'Topic is required.' }), { status: 400 });
  }
  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'API key is not configured.' }), { status: 500 });
  }

  // This prompt asks for a reliable JSON response without image-related fields.
  const systemPrompt = `You are KinderSpark AI, a friendly and expert assistant for kindergarten teachers. Your purpose is to create complete, engaging, Montessori-inspired lesson plans for children aged 3-6.
  
  Your response MUST be ONLY a valid JSON object. Do NOT use any markdown, comments, or any text outside of the JSON structure.
  All strings within the JSON must be properly escaped.
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
    "movementAndMusic": {
        "grossMotorActivity": "An activity focused on large muscle movements like running, jumping, or balancing.",
        "fineMotorActivity": "An activity for hand-eye coordination and small muscle skills.",
        "actionSong": "A specific song that involves physical actions and following directions."
    },
    "socialAndEmotionalLearning": {
        "graceAndCourtesy": "A specific lesson on manners, interacting with others, or classroom etiquette related to the topic.",
        "problemSolvingScenario": "A short, age-appropriate scenario for children to discuss and solve, related to the topic."
    },
    "classicResources": {
      "familiarRhymesAndSongs": ["List 2-3 classic children's songs or rhymes. Provide titles that are easily searchable."],
      "classicStoryBooks": ["List 2-3 popular children's books with authors. Provide titles that are easily searchable."]
    },
    "montessoriConnections": {
      "traditionalUseOfMaterials": "Suggest 2-3 ways to use traditional Montessori materials.",
      "newWaysToUseMaterials": "Suggest 2-3 creative, non-traditional ways to use Montessori materials."
    },
    "teacherResources": {
        "observationCues": "Specific things a teacher should look for to assess a child's understanding and engagement with the material.",
        "environmentSetup": "How to prepare the classroom environment or a specific shelf to introduce the topic."
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

  try {
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
        // Only perform the most minimal cleaning necessary.
        const cleanedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
        lessonPlan = JSON.parse(cleanedText);
    } catch (parseError) {
        console.error("Failed to parse AI JSON response. Raw text:", generatedText);
        throw new Error("AI returned invalid JSON format. Please try again.");
    }
    
    return new Response(JSON.stringify({ lessonPlan }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate handler:', error);
    return new Response(JSON.stringify({ error: error.message || 'An internal server error occurred.' }), { status: 500 });
  }
}

