// js/generation.js

import supabase from './supabaseClient.js';


// --- Global variable to hold lesson data for exports ---
let currentLessonData = null;

// --- Main Page Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check user session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/Sign In.html';
        return;
    }

    // 2. Personalize header and set up logout
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName}!`;
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });
    
    // 3. Retrieve topic from previous page
    const topic = localStorage.getItem('currentTopic');
    if (!topic) {
        alert('No topic found. Redirecting to start a new chat.');
        window.location.href = '/New Chat.html';
        return;
    }
    
    // 4. Start the content generation process
    generateAndDisplayContent(topic);
});

// --- Content Generation and Display ---
async function generateAndDisplayContent(topic) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');

    loader.style.display = 'flex';
    mainContent.style.display = 'none';
    
    // Simulate AI generation delay (2.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500)); 

    // In a real app, this would be an API call to your backend AI service.
    // For now, we use a function to create detailed mock data.
    currentLessonData = createMockLessonData(topic);

    // Populate the page with the generated data
    populatePage(currentLessonData);

    // Hide loader and show content
    loader.style.display = 'none';
    mainContent.style.display = 'block';
    
    // Setup all interactive elements now that they exist on the page
    setupPageInteractions();
}

function populatePage(data) {
    const container = document.getElementById('content-container');
    container.innerHTML = createTabsHtml(data);
}

function setupPageInteractions() {
    // Tab Switching Logic
    const tabs = document.querySelectorAll('nav[aria-label="Tabs"] a');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(item => {
                item.classList.remove('active-tab');
                item.classList.add('text-gray-400');
            });
            tab.classList.add('active-tab');
            tab.classList.remove('text-gray-400');
            const tabId = tab.dataset.tab;
            tabContents.forEach(content => content.classList.remove('active-tab-content'));
            document.getElementById(`${tabId}-content`).classList.add('active-tab-content');
        });
    });

    // Sub-topic Tag Switching Logic
    const tags = document.querySelectorAll('.tag');
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            const parentGroup = tag.closest('.tag-group');
            parentGroup.querySelectorAll('.tag').forEach(t => t.classList.remove('active-tag'));
            tag.classList.add('active-tag');

            const contentId = tag.dataset.tagContent;
            const parentTabContent = tag.closest('.tab-content');
            parentTabContent.querySelectorAll('.tag-content').forEach(c => c.classList.remove('active-tag-content'));
            document.getElementById(contentId).classList.add('active-tag-content');
        });
    });

    // Attach listeners to all action buttons
    document.getElementById('word-btn').addEventListener('click', handleWordDownload);
    document.getElementById('pdf-btn').addEventListener('click', handlePdfDownload);
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', handleShareToHub);
    });
}

// --- Button Functionality ---

async function handleWordDownload() {
    if (!currentLessonData) return;
    
    let fullHtmlContent = `<h1>Lesson: ${currentLessonData.topic}</h1>`;
    // Create a structured HTML string from the data for export
    Object.values(currentLessonData.tabs).forEach(tab => {
        fullHtmlContent += `<h2>${tab.title}</h2>`;
        Object.values(tab.content).forEach(item => {
            fullHtmlContent += `<h3>${item.title}</h3><div>${item.body}</div><br>`;
        });
    });

    const blob = await htmlToDocx(fullHtmlContent, null, { footer: true, pageNumber: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentLessonData.topic}.docx`;
    a.click();
    URL.revokeObjectURL(url);
}

async function handlePdfDownload() {
    if (!currentLessonData) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15;

    const addText = (text, size, isTitle = false) => {
        if (y > 280) { doc.addPage(); y = 15; }
        doc.setFontSize(size);
        const plainText = new DOMParser().parseFromString(text, 'text/html').body.textContent || "";
        const splitText = doc.splitTextToSize(plainText, 180);
        doc.text(splitText, 10, y);
        y += (splitText.length * (size / 2.5)) + (isTitle ? 6 : 4);
    };
    
    addText(`Lesson: ${currentLessonData.topic}`, 20, true);
    Object.values(currentLessonData.tabs).forEach(tab => {
        addText(tab.title, 16, true);
        Object.values(tab.content).forEach(item => {
            addText(item.title, 14);
            addText(item.body, 12);
        });
    });
    
    doc.save(`${currentLessonData.topic}.pdf`);
}

async function handleShareToHub(event) {
    const button = event.currentTarget;
    const originalContent = button.innerHTML;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const activeTagContent = document.querySelector('.tag-content.active-tag-content');
    const activeTag = document.querySelector('.tag.active-tag');

    if (!activeTagContent || !activeTag) return alert('No active content selected to share.');

    const postData = {
        user_id: session.user.id,
        user_name: session.user.user_metadata?.full_name || session.user.email,
        topic: currentLessonData.topic,
        category: activeTag.textContent,
        content: activeTagContent.innerHTML,
    };

    button.disabled = true;
    button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>`;

    const { error } = await supabase.from('community_posts').insert([postData]);

    if (error) {
        alert('Error sharing to hub: ' + error.message);
        button.innerHTML = originalContent;
        button.disabled = false;
    } else {
        button.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Shared!`;
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.disabled = false;
        }, 2000);
    }
}

// --- Mock Data and HTML Generation ---
function createMockLessonData(topic) {
    return {
        topic: topic,
        tabs: {
            story: {
                title: "Story & Rhyme Time",
                content: {
                    learning_story: { title: "Learning Story", body: `<h3>The Great Water Adventure</h3><p>Once upon a time, in a bright and sunny Montessori classroom, a small pitcher and an empty cup decided to play a game. 'I'll pour, you catch!' said the pitcher. Slowly and carefully, the pitcher tipped, and a gentle stream of water flowed perfectly into the cup. The child watching learned about control, focus, and the joy of a job well done.</p>` },
                    rhyme: { title: "Rhyme", body: `<h4>Pouring Song</h4><p><em>(To the tune of "Twinkle, Twinkle, Little Star")</em><br>Steady hands, I'm careful now,<br>Pouring water, watch me how.<br>From the pitcher, clear and bright,<br>To the cup with all my might.<br>Steady hands, I'm careful now,<br>Look, I did it! Wow, wow, wow!</p>` },
                    vocab: { title: "Key Vocabulary", body: `<ul><li class="mb-2"><strong>Pour:</strong> To make a liquid flow from a container.</li><li class="mb-2"><strong>Pitcher:</strong> A container for holding and pouring liquids.</li><li class="mb-2"><strong>Steady:</strong> Firmly fixed, not shaking.</li><li><strong>Control:</strong> The power to manage your own actions.</li></ul>` },
                }
            },
            handsOn: {
                title: "Hands-On Activities",
                content: {
                    practical: { title: "Practical Life", body: `<p>Set up a small table with a tray, a small pitcher with a manageable amount of water, and several small cups of different sizes. Encourage the child to pour the water from the pitcher into each cup without spilling.</p>`},
                    sensorial: { title: "Sensorial", body: `<p>Provide two pitchers, one with cool water and one with warm water. Let the child explore pouring both and feeling the temperature difference in the cups.</p>`},
                }
            },
            // Add mock data for all other tabs here to make them appear
        }
    };
}

function createTabsHtml(data) {
    let html = '';
    let isFirstTab = true;

    for (const tabKey in data.tabs) {
        const tabData = data.tabs[tabKey];
        html += `
            <div class="tab-content ${isFirstTab ? 'active-tab-content' : ''}" id="${tabKey}-content">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex space-x-3 tag-group">
        `;
        let isFirstTag = true;
        for (const contentKey in tabData.content) {
            html += `<span class="tag bg-purple-800/50 text-purple-200 text-sm font-medium px-3 py-1 rounded-full cursor-pointer transition-colors duration-200 hover:bg-purple-700 hover:text-white ${isFirstTag ? 'active-tag' : ''}" data-tag-content="${tabKey}-${contentKey}">${tabData.content[contentKey].title}</span>`;
            isFirstTag = false;
        }
        html += `
                    </div>
                </div>
        `;
        isFirstTag = true;
        for (const contentKey in tabData.content) {
            html += `
                <div class="space-y-6 text-lg leading-relaxed tag-content ${isFirstTag ? 'active-tag-content' : ''}" id="${tabKey}-${contentKey}">
                    ${tabData.content[contentKey].body}
                    <div class="mt-6 pt-4 border-t border-gray-700 text-right">
                        <button class="share-btn flex items-center text-sm bg-transparent hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500 font-medium py-2 px-3 rounded-md transition-colors duration-200">
                            <span class="material-symbols-outlined mr-2">groups</span> Share to Hub
                        </button>
                    </div>
                </div>
            `;
            isFirstTag = false;
        }
        html += `</div>`;
        isFirstTab = false;
    }
    // Prepend the main content header that's consistent for all tabs
    return `
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
            <h3 class="text-3xl font-bold" id="lesson-title">Lesson: ${data.topic}</h3>
            <div class="flex items-center space-x-3">
                <button id="word-btn" class="flex items-center text-sm bg-gray-800/60 hover:bg-purple-800/60 border border-gray-600 hover:border-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200">
                    <span class="material-symbols-outlined mr-2">description</span> Word
                </button>
                <button id="pdf-btn" class="flex items-center text-sm bg-gray-800/60 hover:bg-purple-800/60 border border-gray-600 hover:border-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200">
                    <span class="material-symbols-outlined mr-2">picture_as_pdf</span> PDF
                </button>
            </div>
        </div>
    ` + html;
}

