import getSupabase from './supabaseClient.js';

// --- Global variable to hold the lesson data for export functions ---
let currentLessonData = null;

// --- Main Page Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // 1. Authenticate and protect the page
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const userName = user.user_metadata?.full_name || user.email;
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
            welcomeMessage.classList.remove('hidden');
        }
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.href = '/index.html';
            });
        }
    } else {
        window.location.href = '/sign-in.html';
        return;
    }
    
    // 2. Retrieve the topic from the previous page
    const topic = sessionStorage.getItem('currentTopic');
    if (!topic) {
        alert('No topic found. Please start by creating a new lesson.');
        window.location.href = '/new-chat.html';
        return;
    }
    
    // 3. Start the content generation process
    generateAndDisplayContent(topic, user);
});

// --- Content Generation and Display Logic ---
async function generateAndDisplayContent(topic, user) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');

    loader.style.display = 'flex';
    mainContent.style.display = 'none';
    
    try {
        // ---- THIS IS THE LIVE AI CALL to your Vercel function ----
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate content.');
        }

        const { lessonPlan, imageUrl } = await response.json();
        
        currentLessonData = lessonPlan;
        
        // Save the generated lesson to the database
        saveLessonToHistory(topic, currentLessonData, user.id);

        // Populate the page with the generated data and the new image
        populatePage(currentLessonData, topic, imageUrl);

        // Hide loader and show the main content
        loader.style.display = 'none';
        mainContent.style.display = 'block';
        
        // Set up all interactive elements (tabs, buttons, etc.)
        setupPageInteractions(user, topic);

    } catch (error) {
        console.error('Generation Error:', error);
        alert(`An error occurred while generating the lesson: ${error.message}`);
        loader.style.display = 'none';
        window.location.href = '/new-chat.html';
    }
}

// --- Supabase Interaction ---
async function saveLessonToHistory(topic, lessonData, userId) {
    const supabase = await getSupabase();
    // Ensure you have a table named 'lessons' with columns: 'user_id', 'topic', 'content'
    const { error } = await supabase
      .from('lessons')
      .insert({ 
          user_id: userId, 
          topic: topic, 
          content: lessonData // 'content' should be of type JSONB in your Supabase table
      });

    if (error) {
        console.error('Error saving lesson to history:', error);
    } else {
        console.log('Lesson saved to history successfully.');
    }
}


// --- DOM Manipulation and Event Handlers ---

function populatePage(data, topic, imageUrl) {
    const contentContainer = document.getElementById('content-container');
    const navContainer = document.querySelector('nav[aria-label="Tabs"]');

    if (contentContainer && navContainer) {
        const { navHtml, contentHtml } = createTabsHtml(data, topic, imageUrl);
        navContainer.innerHTML = navHtml;
        contentContainer.innerHTML = contentHtml;
    }
}

function setupPageInteractions(user, topic) {
    const tabs = document.querySelectorAll('nav[aria-label="Tabs"] a');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = tab.dataset.tab;
            tabs.forEach(item => item.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-tab-content'));
            document.getElementById(`${tabId}-content`).classList.add('active-tab-content');
        });
    });

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

    const wordBtn = document.getElementById('word-btn');
    if (wordBtn) wordBtn.addEventListener('click', () => handleWordDownload(topic));

    const pdfBtn = document.getElementById('pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', () => handlePdfDownload(topic));
    
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', (event) => handleShareToHub(event, user, topic));
    });
}


// --- Export and Share Functionality ---

async function handleWordDownload(topic) {
    if (!currentLessonData) return alert('No lesson data available to download.');
    
    let html = `<h1>Lesson Plan: ${topic}</h1><p>This plan includes new and classic resources, along with creative Montessori-inspired activities.</p><hr>`;
    
    // A helper function to format each section for the Word document
    const addSection = (title, content) => {
        if (Array.isArray(content)) {
            return `<h3>${title}</h3><ul>${content.map(item => `<li>${item}</li>`).join('')}</ul>`;
        }
        return `<h3>${title}</h3><p>${content}</p>`;
    };

    html += `<h2>Newly Created Content</h2>`;
    html += addSection('Original Rhyme', currentLessonData.newlyCreatedContent.originalRhyme);
    html += addSection('Original Mini-Story', currentLessonData.newlyCreatedContent.originalMiniStory);
    
    html += `<h2>New Activities</h2>`;
    html += addSection('Art/Craft Activity', currentLessonData.newActivities.artCraftActivity);
    html += addSection('Motor Skills Activity', currentLessonData.newActivities.motorSkillsActivity);
    html += addSection('Sensory/Exploration Activity', currentLessonData.newActivities.sensoryExplorationActivity);

    html += `<h2>Classic Resources</h2>`;
    html += addSection('Familiar Rhymes & Songs', currentLessonData.classicResources.familiarRhymesAndSongs);
    html += addSection('Classic Story Books', currentLessonData.classicResources.classicStoryBooks);

    html += `<h2>Montessori Connections</h2>`;
    html += addSection('Traditional Use of Materials', currentLessonData.montessoriConnections.traditionalUseOfMaterials);
    html += addSection('New Ways to Use Materials', currentLessonData.montessoriConnections.newWaysToUseMaterials);

    try {
        const blob = await htmlToDocx(html, null, { footer: true, pageNumber: true });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Lesson Plan - ${topic}.docx`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) { console.error("Error generating DOCX:", e); }
}

async function handlePdfDownload(topic) {
    if (!currentLessonData) return alert('No lesson data available to download.');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15;

    // Helper to add text and manage page breaks
    const addText = (text, size, isTitle = false, isList = false) => {
        if (y > 280) { doc.addPage(); y = 15; }
        doc.setFontSize(size);
        const plainText = new DOMParser().parseFromString(text, 'text/html').body.textContent || "";
        const splitText = doc.splitTextToSize(plainText, 180);
        if (isList) {
            splitText.forEach((line, index) => {
                doc.text(index === 0 ? `• ${line}` : `  ${line}`, 14, y);
                y += (size / 2.5);
            });
        } else {
            doc.text(splitText, 10, y);
            y += (splitText.length * (size / 2.5));
        }
         y += (isTitle ? 6 : 4);
    };

    addText(`Lesson Plan: ${topic}`, 20, true);
    
    // Add all sections to the PDF
    addText("Newly Created Content", 16, true);
    addText("Original Rhyme", 14);
    addText(currentLessonData.newlyCreatedContent.originalRhyme, 12);
    addText("Original Mini-Story", 14);
    addText(currentLessonData.newlyCreatedContent.originalMiniStory, 12);
    
    // ... continue this pattern for all other sections ...

    doc.save(`Lesson Plan - ${topic}.pdf`);
}

async function handleShareToHub(event, user, topic) {
    const supabase = await getSupabase();
    const button = event.currentTarget;
    const originalContent = button.innerHTML;
    const tagContentElement = button.closest('.tag-content');

    if (!tagContentElement) return;

    const postData = {
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email,
        topic: topic,
        category: tagContentElement.querySelector('h4').textContent,
        content: tagContentElement.innerHTML,
    };

    button.disabled = true;
    button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>`;
    const { error } = await supabase.from('community_posts').insert([postData]);
    if (error) {
        alert('Error sharing to hub: ' + error.message);
        button.innerHTML = originalContent;
        button.disabled = false;
    } else {
        button.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Shared!`;
    }
}


function createTabsHtml(data, topic, imageUrl) {
    const tabDataMap = {
        story: { title: "Newly Created Content", icon: 'auto_stories', data: data.newlyCreatedContent },
        'hands-on': { title: "New Activities", icon: 'pan_tool', data: data.newActivities },
        teacher: { title: "Classic Resources", icon: 'school', data: data.classicResources },
        exploration: { title: "Montessori Connections", icon: 'eco', data: data.montessoriConnections }
    };

    let navHtml = '';
    let contentHtml = '';
    let isFirstTab = true;

    contentHtml += `
    <div class="flex flex-col md:flex-row items-start justify-between gap-6 mb-6 pb-4 border-b border-gray-700">
        <div>
            <h3 class="text-3xl font-bold" id="lesson-title">Topic: ${topic}</h3>
            <p class="mt-2 text-gray-300">This plan includes new and classic resources, along with creative Montessori-inspired activities to explore ${topic}.</p>
        </div>
        <div class="flex items-center space-x-3">
             <button id="word-btn" class="flex items-center text-sm bg-gray-800/60 hover:bg-purple-800/60 border border-gray-600 hover:border-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200">
                <span class="material-symbols-outlined mr-2">description</span> Word
            </button>
            <button id="pdf-btn" class="flex items-center text-sm bg-gray-800/60 hover:bg-purple-800/60 border border-gray-600 hover:border-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200">
                <span class="material-symbols-outlined mr-2">picture_as_pdf</span> PDF
            </button>
        </div>
    </div>`;

    if (imageUrl) {
        contentHtml += `<img id="generated-image" src="${imageUrl}" alt="Generated coloring page for ${topic}" class="w-full md:w-1/3 float-right ml-6 mb-4 rounded-lg shadow-lg border-2 border-purple-500/50">`;
    }

    for (const [key, tabInfo] of Object.entries(tabDataMap)) {
        navHtml += `<a class="whitespace-nowrap py-3 px-4 font-medium text-base text-gray-300 hover:bg-purple-800/40 hover:text-white flex items-center rounded-lg transition-colors duration-200 ${isFirstTab ? 'active-tab' : ''}" data-tab="${key}" href="#">
            <span class="material-symbols-outlined mr-3">${tabInfo.icon}</span>${tabInfo.title}
        </a>`;

        contentHtml += `<div class="tab-content ${isFirstTab ? 'active-tab-content' : ''}" id="${key}-content">`;
        let isFirstTag = true;

        contentHtml += `<div class="flex flex-wrap gap-2 mb-6 tag-group">`;
        Object.keys(tabInfo.data).forEach(subKey => {
            const subTitle = subKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            contentHtml += `<span class="tag bg-purple-800/50 text-purple-200 text-sm font-medium px-3 py-1 rounded-full cursor-pointer transition-colors duration-200 hover:bg-purple-700 hover:text-white ${isFirstTag ? 'active-tag' : ''}" data-tag-content="${key}-${subKey}">${subTitle}</span>`;
            isFirstTag = false;
        });
        contentHtml += `</div>`;

        isFirstTag = true;
        Object.entries(tabInfo.data).forEach(([subKey, subContent]) => {
            const subTitle = subKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            let bodyContent = Array.isArray(subContent) ? `<ul>${subContent.map(item => `<li>${item}</li>`).join('')}</ul>` : `<p>${subContent.replace(/\n/g, '<br>')}</p>`;

            contentHtml += `
                <div class="space-y-4 text-lg leading-relaxed tag-content ${isFirstTag ? 'active-tag-content' : ''}" id="${key}-${subKey}">
                    <h4 class="text-xl font-bold text-purple-300">${subTitle}</h4>
                    ${bodyContent}
                    <div class="mt-6 pt-4 border-t border-gray-700 text-right">
                        <button class="share-btn flex items-center text-sm bg-transparent hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500 font-medium py-2 px-3 rounded-md transition-colors duration-200">
                            <span class="material-symbols-outlined mr-2">groups</span> Share to Hub
                        </button>
                    </div>
                </div>`;
            isFirstTag = false;
        });
        contentHtml += `</div>`;
        isFirstTab = false;
    }

    return { navHtml, contentHtml };
}

