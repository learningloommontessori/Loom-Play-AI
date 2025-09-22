// js/generation-page.js
import getSupabase from './supabaseClient.js';

let supabase;
let currentUserSession;
let currentLessonData = null; // Global holder for the raw lesson data
let currentTopic = '';

// --- Main Page Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    currentUserSession = session;

    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('welcome-message').classList.remove('hidden');
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
    
    currentTopic = localStorage.getItem('currentTopic');
    if (!currentTopic) {
        alert('No topic found. Redirecting to start a new lesson.');
        window.location.href = '/new-chat.html';
        return;
    }
    
    setupTabInteractions();
    generateAndDisplayContent(currentTopic, session.access_token);
});

// --- API Call and Content Display ---
async function generateAndDisplayContent(topic, token) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    
    loader.style.display = 'flex';
    mainContent.style.display = 'none';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ topic }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate content.');
        }

        const { lessonPlan, imageUrl } = await response.json();
        currentLessonData = lessonPlan; // Store for export functions
        
        populatePage(lessonPlan, imageUrl, topic);

    } catch (err) {
        console.error('Error fetching generated content:', err);
        loader.innerHTML = `<div class="text-center"><p class="text-red-400 text-lg">Sorry, something went wrong.</p><p class="text-gray-400 text-sm mt-2">${err.message}</p><a href="/new-chat.html" class="mt-4 inline-block bg-purple-600 text-white px-4 py-2 rounded-lg">Try Again</a></div>`;
    }
}

// --- DOM Population ---
function populatePage(lessonPlan, imageUrl, topic) {
    const mainContent = document.getElementById('main-content');

    // 1. Populate the Generated Image Tab
    const imageContainer = document.getElementById('generatedImage-content');
    if (imageUrl) {
        imageContainer.innerHTML = `
            <div class="flex flex-col items-center">
                 <h2 class="text-2xl font-bold mb-4">Generated Coloring Page</h2>
                 <img src="${imageUrl}" alt="Generated coloring page for ${topic}" class="w-full max-w-md h-auto rounded-lg border-2 border-purple-500 shadow-lg">
                 <a href="${imageUrl}" download="${topic}-coloring-page.png" class="mt-4 inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300">
                    <span class="material-symbols-outlined mr-2">download</span>
                    Download Image
                 </a>
            </div>
        `;
    } else {
        imageContainer.innerHTML = `<p class="text-gray-400 text-center">No image could be generated for this topic.</p>`;
    }

    // 2. Build the main header with action buttons
    const headerHtml = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-gray-700">
            <div>
                <h2 class="text-3xl font-bold" id="lesson-title">Topic: ${topic}</h2>
                <p class="mt-1 text-gray-400">This plan includes new and classic resources to explore ${topic}.</p>
            </div>
            <div class="flex items-center space-x-2 mt-4 sm:mt-0">
                <button id="pdf-btn" class="flex items-center text-sm bg-gray-800/60 hover:bg-purple-800/60 border border-gray-600 hover:border-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200">
                    <span class="material-symbols-outlined mr-2">picture_as_pdf</span> PDF
                </button>
            </div>
        </div>
    `;
    
    // 3. Build content for each text-based tab
    for (const tabKey in lessonPlan) {
        if (tabKey === 'imagePrompt') continue; // Skip the image prompt data

        const tabContentContainer = document.getElementById(`${tabKey}-content`);
        if (tabContentContainer) {
            const tabData = lessonPlan[tabKey];
            let tagsHtml = '<div class="flex items-center flex-wrap gap-2 mb-6 tag-group">';
            let contentHtml = '';
            let isFirstTag = true;

            for (const contentKey in tabData) {
                const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                tagsHtml += `<button class="tag text-sm font-medium px-3 py-1 rounded-full cursor-pointer transition-colors duration-200 bg-purple-800/50 text-purple-200 hover:bg-purple-700 ${isFirstTag ? 'active-tag' : ''}" data-content-id="${tabKey}-${contentKey}">${title}</button>`;
                
                let body = tabData[contentKey];
                // Create clickable links for classic resources
                if (tabKey === 'classicResources' && Array.isArray(body)) {
                    body = `<ul class="list-disc list-inside space-y-2">${body.map(item => {
                        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item)}`;
                        return `<li><a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="text-purple-400 hover:underline">${item}</a></li>`;
                    }).join('')}</ul>`;
                } else if (Array.isArray(body)) {
                    body = `<ul class="list-disc list-inside space-y-2">${body.map(item => `<li>${item}</li>`).join('')}</ul>`;
                }


                contentHtml += `
                    <div id="${tabKey}-${contentKey}" class="tag-content ${isFirstTag ? 'active-tag-content' : ''}">
                        <div class="prose prose-invert max-w-none text-gray-300">${body.replace(/\n/g, '<br>')}</div>
                        <div class="mt-6 pt-4 border-t border-gray-700 text-right">
                            <button class="share-btn flex items-center text-sm bg-transparent hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500 font-medium py-2 px-3 rounded-md transition-colors duration-200" data-category="${title}">
                                <span class="material-symbols-outlined mr-2">groups</span> Share to Hub
                            </button>
                        </div>
                    </div>
                `;
                isFirstTag = false;
            }
            tagsHtml += '</div>';
            tabContentContainer.innerHTML = headerHtml + tagsHtml + contentHtml;
        }
    }
    
    // 4. Add event listeners to the newly created buttons
    setupActionButtons();

    // 5. Show content and hide loader
    mainContent.style.display = 'block';
    loader.style.display = 'none';
}

// --- Event Listener Setup ---
function setupTabInteractions() {
    const tabs = document.querySelectorAll('#tabs-navigation a');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(item => item.classList.remove('active-tab'));
            tabContents.forEach(content => content.classList.remove('active-tab-content'));
            
            tab.classList.add('active-tab');
            const tabId = tab.dataset.tab;
            document.getElementById(`${tabId}-content`).classList.add('active-tab-content');
        });
    });
}

function setupActionButtons() {
    // PDF download button
    document.getElementById('pdf-btn')?.addEventListener('click', handlePdfDownload);

    // Tag switching within a tab
    document.querySelectorAll('.tag-group .tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const parentGroup = tag.closest('.tag-group');
            parentGroup.querySelectorAll('.tag').forEach(t => t.classList.remove('active-tag'));
            tag.classList.add('active-tag');
            
            const contentId = tag.dataset.contentId;
            const parentTabContent = tag.closest('.tab-content');
            parentTabContent.querySelectorAll('.tag-content').forEach(c => c.classList.remove('active-tag-content'));
            document.getElementById(contentId).classList.add('active-tag-content');
        });
    });

    // Share to Hub buttons
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', handleShareToHub);
    });
}

// --- Action Button Handlers ---
function handlePdfDownload() {
    if (!currentLessonData) return alert('Lesson data not available.');
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    let y = 15;
    const margin = 10;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;

    const addText = (text, size, weight) => {
        if (y > 280) { // New page if content overflows
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(size).setFont(undefined, weight);
        const splitText = doc.splitTextToSize(text, maxWidth);
        doc.text(splitText, margin, y);
        y += (doc.getTextDimensions(splitText).h) + 4;
    };

    addText(`Topic: ${currentTopic}`, 18, 'bold');
    y += 5;

    for (const tabKey in currentLessonData) {
        if (tabKey === 'imagePrompt') continue;
        const tabTitle = tabKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        addText(tabTitle, 16, 'bold');
        for (const contentKey in currentLessonData[tabKey]) {
            const contentTitle = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            addText(contentTitle, 14, 'bold');
            
            let body = currentLessonData[tabKey][contentKey];
            if (Array.isArray(body)) {
                body.forEach(item => addText(`• ${item}`, 12, 'normal'));
            } else {
                addText(body, 12, 'normal');
            }
            y += 2;
        }
        y += 5;
    }
    doc.save(`${currentTopic}.pdf`);
}

async function handleShareToHub(event) {
    const button = event.currentTarget;
    const originalContent = button.innerHTML;
    const contentToShare = button.closest('.tag-content').querySelector('.prose').innerHTML;
    const category = button.dataset.category;

    if (!currentUserSession) return alert('You must be logged in to share.');

    button.disabled = true;
    button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>`;

    const { error } = await supabase.from('CommunityHub').insert([{
        user_id: currentUserSession.user.id,
        user_name: currentUserSession.user.user_metadata?.full_name || currentUserSession.user.email,
        topic: currentTopic,
        category: category,
        content: contentToShare,
    }]);

    if (error) {
        alert('Error sharing to hub: ' + error.message);
        button.innerHTML = originalContent;
        button.disabled = false;
    } else {
        button.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span> Shared!`;
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.disabled = false;
        }, 2500);
    }
}
