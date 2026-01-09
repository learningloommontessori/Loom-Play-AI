// js/generation-page.js
import getSupabase from './supabaseClient.js';

let supabase;
let currentUserSession;
let currentLessonData = null; 
let currentTopicName = "";

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { window.location.href = '/sign-in.html'; return; }
    currentUserSession = session;

    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut(); window.location.href = '/index.html';
    });
    
    currentTopicName = localStorage.getItem('currentTopic');
    const language = localStorage.getItem('generationLanguage') || 'English';
    const age = localStorage.getItem('selectedAge') || 'Class 1-5';

    if (!currentTopicName) { alert('Missing data. Redirecting.'); window.location.href = '/new-chat.html'; return; }

    generateContent(currentTopicName, language, age, session.access_token);
});

async function generateContent(topic, language, age, token) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    if(loader) loader.style.display = 'flex';
    if(mainContent) mainContent.classList.add('hidden');

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ topic, language, age }),
        });

        if (!response.ok) throw new Error((await response.json()).error || 'Generation failed.');

        const result = await response.json();
        let lessonPlan = result.lessonPlan || result; 
        if (!lessonPlan || Object.keys(lessonPlan).length === 0) throw new Error("Received empty data.");

        currentLessonData = lessonPlan;
        populatePageUI(lessonPlan);
        setupGlobalButtons(); 

    } catch (err) {
        console.error('Error:', err);
        if(loader) loader.innerHTML = `<div class="text-center text-red-400"><p>Error: ${err.message}</p><a href="/new-chat.html" class="underline mt-4 block">Try Again</a></div>`;
    }
}

function populatePageUI(lessonPlan) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');

    // 1. Generic Loop for all Text Tabs
    for (const tabKey in lessonPlan) {
        if (['id', 'user_id', 'created_at', 'topic', 'age', 'language', 'imagePrompt', 'success'].includes(tabKey)) continue;

        const container = document.getElementById(`${tabKey}-content`);
        if (container) {
            // Remove "Loading..." text immediately
            container.innerHTML = ''; 
            
            const tabData = lessonPlan[tabKey];
            let tagsHtml = '<div class="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">';
            let contentHtml = '<div class="mt-4">';
            let isFirst = true;

            if (typeof tabData === 'object' && tabData !== null) {
                for (const contentKey in tabData) {
                    const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    const safeId = contentKey.replace(/[^a-zA-Z0-9]/g, '');
                    const activeClass = isFirst ? 'active-tag' : '';
                    const displayClass = isFirst ? 'block' : 'hidden';

                    tagsHtml += `<button class="glass-tag ${activeClass}" onclick="switchTag('${tabKey}', '${safeId}', this)">${title}</button>`;
                    
                    let bodyContent = formatBodyContent(tabData[contentKey]);

                    contentHtml += `
                        <div id="${tabKey}-${safeId}" class="tag-content-item ${displayClass}">
                            <div class="flex justify-between items-start mb-3">
                                <h3 class="text-xl font-bold text-white">${title}</h3>
                            </div>
                            <div contenteditable="true" class="prose prose-invert max-w-none text-gray-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500 rounded p-1">
                                ${bodyContent}
                            </div>
                        </div>
                    `;
                    isFirst = false;
                }
                container.innerHTML = tagsHtml + contentHtml;
            } 
        }
    }

    // 2. IMAGE GENERATION (Pollinations AI)
    const imageContainer = document.getElementById('generatedImage-content');
    if (imageContainer) {
        // Use smart prompt if available, else topic name
        let prompt = lessonPlan.imagePrompt || currentTopicName + " educational illustration 3d pixar style";
        generateFreeImage(prompt, 'generatedImage-content');
    }

    if(loader) loader.style.display = 'none';
    if(mainContent) mainContent.classList.remove('hidden');
    setupTabNavigation();
}

function formatBodyContent(content) {
    if (Array.isArray(content)) {
        return `<ul class="list-disc list-inside space-y-2 marker:text-purple-400">${content.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }
    if (typeof content === 'string') {
        return content.replace(/\n/g, '<br>');
    }
    return content;
}

// --- NEW: Free Image Generator ---
function generateFreeImage(prompt, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = ''; // Clear loading text
    const safePrompt = encodeURIComponent(prompt.substring(0, 300)); 
    const randomSeed = Math.floor(Math.random() * 1000);
    const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${randomSeed}&nologo=true`;

    container.innerHTML = `
        <div class="flex flex-col items-center gap-4 animate-fade-in">
             <img src="${imageUrl}" alt="AI Generated" class="w-full max-w-md rounded-xl shadow-2xl border border-white/10" 
                  onerror="this.src='https://placehold.co/600x400?text=Image+Generation+Failed'">
             <a href="${imageUrl}" download="lesson_image.jpg" target="_blank" class="pro-glass-btn px-6 py-2 text-sm">Download Image</a>
        </div>
    `;
}

// --- NEW: Worksheet Printer ---
window.openPrintableWorksheet = () => {
    if (!currentLessonData || !currentLessonData.practiceAndAssess) {
        alert("No worksheet data found. Try generating a new lesson."); return;
    }
    const ws = currentLessonData.practiceAndAssess;
    
    const html = `
    <html><head><title>Worksheet - ${currentTopicName}</title>
    <style>
        body{font-family:'Comic Sans MS',sans-serif;padding:40px;max-width:800px;margin:0 auto;} 
        h1{border-bottom:2px solid #000;text-transform:uppercase;} 
        .q{margin-bottom:20px;font-size:14px;}
        .line{border-bottom:1px dotted #000;display:inline-block;width:100px;}
    </style>
    </head><body>
        <h1>${currentTopicName} Worksheet</h1>
        <p>Name: __________________________ Date: __________</p>
        <br>
        ${ws.worksheetFillBlanks ? `<h3>I. Fill in the Blanks</h3>${ws.worksheetFillBlanks.map((q,i)=>`<div class="q">${i+1}. ${q}</div>`).join('')}` : ''}
        ${ws.worksheetTrueFalse ? `<h3>II. True or False</h3>${ws.worksheetTrueFalse.map((q,i)=>`<div class="q">${i+1}. ${q} [ T / F ]</div>`).join('')}` : ''}
        ${ws.exitTickets ? `<h3>III. Quick Check</h3>${ws.exitTickets.map((q,i)=>`<div class="q">${i+1}. ${q}<br><br></div>`).join('')}` : ''}
        <br><br><center><small>Generated by Loom Thread AI</small></center>
    </body></html>`;
    
    const win = window.open('','_blank');
    win.document.write(html);
    win.document.close();
    // Allow images to load before print (optional)
    setTimeout(() => { win.print(); }, 500);
};

window.switchTag = (tabKey, contentKey, clickedBtn) => {
    const container = document.getElementById(`${tabKey}-content`);
    container.querySelectorAll('.glass-tag').forEach(btn => btn.classList.remove('active-tag'));
    clickedBtn.classList.add('active-tag');
    container.querySelectorAll('.tag-content-item').forEach(div => div.classList.add('hidden'));
    document.getElementById(`${tabKey}-${contentKey}`).classList.remove('hidden');
};

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.glass-tab[data-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active-tab-content'));
            const target = document.getElementById(`${tab.dataset.tab}-content`);
            if (target) target.classList.add('active-tab-content');
        });
    });
}

function setupGlobalButtons() {
    // Inject the Worksheet button if it doesn't exist
    const btnContainer = document.querySelector('.flex.space-x-4');
    if (btnContainer && !document.getElementById('print-ws-btn')) {
        const printBtn = document.createElement('button');
        printBtn.id = 'print-ws-btn';
        printBtn.className = 'pro-glass-btn flex items-center px-5 py-2.5 text-sm font-bold text-white hover:text-green-300 transition-colors border-green-500/30 bg-green-600/10';
        printBtn.innerHTML = '<span class="material-symbols-outlined mr-2">print</span> Worksheet';
        printBtn.onclick = window.openPrintableWorksheet;
        btnContainer.prepend(printBtn);
    }
}