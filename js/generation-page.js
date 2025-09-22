// js/generation-page.js
import getSupabase from './supabaseClient.js';

// --- Main Page Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();
    
    // 1. Check user session and protect the page
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }

    // 2. Personalize header and set up logout
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('welcome-message').classList.remove('hidden');
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
    
    // 3. Retrieve topic from the previous page
    const topic = localStorage.getItem('currentTopic');
    if (!topic) {
        alert('No topic found. Redirecting to start a new lesson.');
        window.location.href = '/new-chat.html';
        return;
    }
    
    // 4. Setup tab interactions immediately
    setupTabInteractions();
    
    // 5. Start the AI content generation process
    generateAndDisplayContent(topic, session.access_token);
});

// --- Content Generation and Display ---
async function generateAndDisplayContent(topic, token) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    
    loader.style.display = 'flex';
    mainContent.style.display = 'none';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ topic }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate content.');
        }

        const { lessonPlan, imageUrl } = await response.json();
        
        populatePage(lessonPlan, imageUrl, topic);

    } catch (err) {
        console.error('Error fetching generated content:', err);
        loader.innerHTML = `<div class="text-center"><p class="text-red-400 text-lg">Sorry, something went wrong generating the lesson.</p><p class="text-gray-400 text-sm mt-2">${err.message}</p><a href="/new-chat.html" class="mt-4 inline-block bg-purple-600 text-white px-4 py-2 rounded-lg">Start Over</a></div>`;
    }
}

function populatePage(lessonPlan, imageUrl, topic) {
    const mainContent = document.getElementById('main-content');
    const contentHeader = document.getElementById('content-header');
    
    // 1. Populate the header with the title and image
    contentHeader.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start justify-between mb-6 pb-4 border-b border-gray-700">
            <div>
                <h2 class="text-3xl font-bold" id="lesson-title">Topic: ${topic}</h2>
                <p class="mt-2 text-gray-400">This plan includes new and classic resources, along with creative Montessori-inspired activities to explore ${topic}.</p>
            </div>
            ${imageUrl ? `<img src="${imageUrl}" alt="Generated coloring page for ${topic}" class="w-full mt-4 sm:mt-0 sm:w-48 h-auto rounded-lg border-2 border-purple-500 shadow-lg">` : ''}
        </div>
    `;

    // 2. Map AI data to the pre-defined tab content containers
    for (const tabKey in lessonPlan) {
        const contentContainer = document.getElementById(`${tabKey}-content`);
        if (contentContainer) {
            const tabData = lessonPlan[tabKey];
            let contentHtml = '';
            for (const contentKey in tabData) {
                // Create a readable title from the camelCase key
                const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                let body = tabData[contentKey];

                // Format lists nicely for classic resources
                if (Array.isArray(body)) {
                    body = `<ul class="list-disc list-inside space-y-2">${body.map(item => `<li>${item}</li>`).join('')}</ul>`;
                }
                
                // **THE FIX**: This creates the structured sub-heading for each item.
                contentHtml += `
                    <div class="mb-8">
                        <h3 class="text-xl font-bold text-purple-300 mb-3">${title}</h3>
                        <div class="prose prose-invert max-w-none text-gray-300">${body.replace(/\n/g, '<br>')}</div>
                    </div>`;
            }
            contentContainer.innerHTML = contentHtml;
        }
    }
    
    // 3. Show the main content area and hide the loader
    mainContent.style.display = 'block';
    document.getElementById('loader').style.display = 'none';
}


function setupTabInteractions() {
    const tabs = document.querySelectorAll('#tabs-navigation a');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Deactivate all tabs and content
            tabs.forEach(item => item.classList.remove('active-tab'));
            tabContents.forEach(content => content.classList.remove('active-tab-content'));
            
            // Activate the clicked tab and its corresponding content
            tab.classList.add('active-tab');
            const tabId = tab.dataset.tab;
            const contentToShow = document.getElementById(`${tabId}-content`);
            if (contentToShow) {
                contentToShow.classList.add('active-tab-content');
            }
        });
    });
}

