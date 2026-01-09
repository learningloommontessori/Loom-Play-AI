// js/generation-page.js
import getSupabase from './supabaseClient.js';

let supabase;
let currentUserSession;
let currentLessonData = {}; // Initialize empty object to merge chunks
let currentTopicName = "";

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    
    // 1. Auth Check
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { window.location.href = '/sign-in.html'; return; }
    currentUserSession = session;

    // 2. Header Setup
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut(); window.location.href = '/index.html';
    });
    
    // 3. Get Inputs & Start
    currentTopicName = localStorage.getItem('currentTopic');
    const language = localStorage.getItem('generationLanguage') || 'English';
    const age = localStorage.getItem('selectedAge') || 'Class 1-5';

    if (!currentTopicName) { alert('Missing data. Redirecting.'); window.location.href = '/new-chat.html'; return; }

    // Start Progressive Generation
    startProgressiveGeneration(currentTopicName, language, age, session.access_token);
});

// --- PROGRESSIVE GENERATION (Solves Vercel Timeout) ---
async function startProgressiveGeneration(topic, language, age, token) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    
    if(loader) loader.style.display = 'flex';
    if(mainContent) mainContent.classList.remove('hidden'); // Show container immediately

    // We will fire 3 requests in sequence
    const sections = ['part1', 'part2', 'part3'];
    
    for (const section of sections) {
        try {
            // Update Loader Text
            const loadingText = section === 'part1' ? "Weaving Lesson Structure..." : 
                              section === 'part2' ? "Adding Magic Box & NEP Features..." : 
                              "Finalizing Resources...";
            if(loader) loader.querySelector('p').textContent = loadingText;

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ topic, language, age, section }),
            });

            if (!response.ok) throw new Error('Network error');
            const result = await response.json();
            
            // Merge new data into global object
            currentLessonData = { ...currentLessonData, ...result.lessonPlan };
            
            // Update UI with what we have so far
            populatePageUI(currentLessonData);

        } catch (err) {
            console.error(`Error loading ${section}:`, err);
        }
    }

    // Done
    if(loader) loader.style.display = 'none';
    setupGlobalButtons();
}

function populatePageUI(lessonPlan) {
    // 1. Generic Loop for all Text Tabs
    for (const tabKey in lessonPlan) {
        if (['id', 'user_id', 'created_at', 'topic', 'age', 'language', 'imagePrompt', 'success'].includes(tabKey)) continue;

        const container = document.getElementById(`${tabKey}-content`);
        if (container) {
            const tabData = lessonPlan[tabKey];
            
            // Clear "Loading..." text if data exists
            if (Object.keys(tabData).length > 0) container.innerHTML = '';

            let tagsHtml = '<div class="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">';
            let contentHtml = '<div class="mt-4">';
            let isFirst = true;

            if (typeof tabData === 'object' && tabData !== null) {
                // Generate Tags & Content
                const keys = Object.keys(tabData);
                keys.forEach((contentKey, index) => {
                    const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    const safeId = contentKey.replace(/[^a-zA-Z0-9]/g, '');
                    
                    // Logic: First item is active by default
                    // But if we are re-rendering, we want to keep current selection? 
                    // For simplicity, reset to first item or check if one is already active
                    const activeClass = (index === 0) ? 'active-tag' : '';
                    const displayClass = (index === 0) ? 'block' : 'hidden';

                    tagsHtml += `<button class="glass-tag ${activeClass}" onclick="switchTag('${tabKey}', '${safeId}', this)">${title}</button>`;
                    
                    let bodyContent = formatBodyContent(tabData[contentKey]);

                    contentHtml += `
                        <div id="${tabKey}-${safeId}" class="tag-content-item ${displayClass}">
                            <div class="flex justify-between items-start mb-3">
                                <h3 class="text-xl font-bold text-white border-b border-purple-500/30 pb-2 inline-block">${title}</h3>
                            </div>
                            <div contenteditable="true" class="prose prose-invert max-w-none text-gray-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500 rounded p-2 bg-white/5">
                                ${bodyContent}
                            </div>
                        </div>
                    `;
                });
                
                // Only update HTML if we actually built something new, to prevent flickering
                // Or just overwrite (simpler for now)
                container.innerHTML = tagsHtml + contentHtml;
            } 
        }
    }

    // 2. IMAGE GENERATION (Only if prompt exists and not already generated)
    const imageContainer = document.getElementById('generatedImage-content');
    if (imageContainer && lessonPlan.imagePrompt && !imageContainer.querySelector('img')) {
        // Use the smart prompt + "infographic" keyword
        const smartPrompt = lessonPlan.imagePrompt + " educational infographic style, clean layout, white background, high resolution";
        generateFreeImage(smartPrompt, 'generatedImage-content');
    }

    setupTabNavigation();
}

function formatBodyContent(content) {
    // FIX 1: Handle Arrays properly (Bullet points)
    if (Array.isArray(content)) {
        return `<ul class="list-disc list-inside space-y-2 marker:text-purple-400">${content.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }
    // FIX 2: Handle Strings with newlines
    if (typeof content === 'string') {
        return content.replace(/\n/g, '<br>');
    }
    return content;
}

// --- Image Generator (Pollinations AI) ---
function generateFreeImage(prompt, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const safePrompt = encodeURIComponent(prompt.substring(0, 400)); 
    const randomSeed = Math.floor(Math.random() * 1000);
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${randomSeed}&nologo=true`;

    container.innerHTML = `
        <div class="flex flex-col items-center gap-4">
             <img src="${imageUrl}" alt="AI Generated Infographic" class="w-full max-w-md rounded-xl shadow-2xl border border-white/10">
             <a href="${imageUrl}" download="lesson_infographic.jpg" target="_blank" class="pro-glass-btn px-6 py-2 text-sm">Download Infographic</a>
        </div>
    `;
}

// --- FIXED EXPORT FUNCTIONS ---
async function generateFullPDF() {
    if (!window.jspdf || !currentLessonData) return alert("Data not ready.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(22); doc.setTextColor(102, 51, 153);
    doc.text(currentTopicName, 10, yPos); yPos += 15;
    doc.setFontSize(12); doc.setTextColor(0);

    // Iterate through our global data object
    for (const [key, sectionData] of Object.entries(currentLessonData)) {
        if (['imagePrompt'].includes(key)) continue;

        const title = key.replace(/([A-Z])/g, ' $1').toUpperCase();
        if(yPos > 270) { doc.addPage(); yPos = 20; }
        
        doc.setFontSize(14); doc.setTextColor(102, 51, 153);
        doc.text(title, 10, yPos); yPos += 7;
        doc.line(10, yPos-2, 200, yPos-2); 
        
        doc.setFontSize(11); doc.setTextColor(0);

        if (typeof sectionData === 'object') {
             for (const [subKey, content] of Object.entries(sectionData)) {
                 const subTitle = subKey.replace(/([A-Z])/g, ' $1');
                 doc.setFont(undefined, 'bold');
                 doc.text(subTitle, 10, yPos); yPos += 5;
                 doc.setFont(undefined, 'normal');
                 
                 const textStr = Array.isArray(content) ? content.join('\n• ') : content;
                 const splitText = doc.splitTextToSize("• " + textStr, 180);
                 doc.text(splitText, 15, yPos);
                 yPos += (splitText.length * 5) + 5;
                 
                 if(yPos > 270) { doc.addPage(); yPos = 20; }
            }
        }
        yPos += 5;
    }
    doc.save(`${currentTopicName}_Plan.pdf`);
}

window.switchTag = (tabKey, contentKey, clickedBtn) => {
    const container = document.getElementById(`${tabKey}-content`);
    // Remove active class from all buttons
    container.querySelectorAll('.glass-tag').forEach(btn => btn.classList.remove('active-tag'));
    // Add active class to clicked
    clickedBtn.classList.add('active-tag');
    
    // Hide all contents
    container.querySelectorAll('.tag-content-item').forEach(div => div.classList.add('hidden'));
    // Show specific content
    const target = document.getElementById(`${tabKey}-${contentKey}`);
    if(target) target.classList.remove('hidden');
};

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.glass-tab[data-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active-tab-content'));
            document.getElementById(`${tab.dataset.tab}-content`).classList.add('active-tab-content');
        });
    });
}

function setupGlobalButtons() {
    const fullDownloadBtn = document.getElementById('download-plan-btn'); // Ensure your HTML has this ID or similar
    // We bind the generic download button in the header to our new function
    const headerDownloadBtn = document.querySelector('.pro-glass-btn.bg-purple-600\\/20'); 
    if(headerDownloadBtn) {
        // Clone to remove old event listeners
        const newBtn = headerDownloadBtn.cloneNode(true);
        headerDownloadBtn.parentNode.replaceChild(newBtn, headerDownloadBtn);
        newBtn.onclick = generateFullPDF;
    }
}