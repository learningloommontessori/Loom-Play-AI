// js/generation-page.js
import getSupabase from './supabaseClient.js';

let currentLessonData = null; // Holds the full lesson plan for export functions

// --- Main Page Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = '/sign-in.html';
        return;
    }

    // Personalize header and set up logout
    const userName = session.user.user_metadata?.full_name || session.user.email;
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
        welcomeMessage.classList.remove('hidden');
    }
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) {
        logoutButton.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '/index.html'));
    }

    // Retrieve topic from the previous page
    const topic = localStorage.getItem('currentTopic');
    if (!topic) {
        alert('No topic found. Redirecting to start a new lesson.');
        window.location.href = '/new-chat.html';
        return;
    }

    // Start the generation process
    generateAndDisplayContent(topic, session.user.id, userName);
});

// --- Content Generation and Display ---
async function generateAndDisplayContent(topic, userId, userName) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    
    loader.classList.remove('hidden');
    mainContent.classList.add('hidden');

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate content from API.');
        }

        const { lessonPlan } = await response.json();
        currentLessonData = lessonPlan; // Store for export
        currentLessonData.topic = topic; // Ensure topic is part of the data for exports
        
        populatePage(lessonPlan);
        setupPageInteractions(userId, userName);

    } catch (error) {
        console.error('Generation Error:', error);
        alert(`An error occurred during content generation: ${error.message}`);
        // Redirect back to the new chat page on failure
        window.location.href = '/new-chat.html';
    } finally {
        loader.classList.add('hidden');
        mainContent.classList.remove('hidden');
    }
}

// Fills the HTML containers with the AI-generated content
function populatePage(data) {
    document.getElementById('lesson-title').textContent = `Topic: ${currentLessonData.topic}`;

    const tabMapping = {
        newlyCreatedContent: "newlyCreatedContent-content",
        newActivities: "newActivities-content",
        movementAndMusic: "movementAndMusic-content",
        socialAndEmotionalLearning: "socialAndEmotionalLearning-content",
        classicResources: "classicResources-content",
        montessoriConnections: "montessoriConnections-content",
        teacherResources: "teacherResources-content",
    };
    
    Object.entries(tabMapping).forEach(([tabKey, contentId]) => {
        const tabData = data[tabKey];
        const contentContainer = document.getElementById(contentId);
        
        if (tabData && contentContainer) {
            let contentHtml = '';
            // Loop through each sub-section (tag) in the tab's data
            Object.entries(tabData).forEach(([tagKey, tagValue]) => {
                // Create a readable title from the camelCase key (e.g., "originalRhyme" -> "Original Rhyme")
                const title = tagKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                contentHtml += `<div class="mb-6">`;
                contentHtml += `<h4 class="text-xl font-bold text-purple-300 mb-2">${title}</h4>`;
                
                // Handle content that is an array (like books or songs)
                if (Array.isArray(tagValue)) {
                    contentHtml += `<ul class="list-disc list-inside space-y-2">`;
                    tagValue.forEach(item => {
                        // Make each item a clickable Google search link
                        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item)}`;
                        contentHtml += `<li><a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="text-white hover:text-purple-300 underline">${item}</a></li>`;
                    });
                    contentHtml += `</ul>`;
                } else { // Handle content that is a single string
                    contentHtml += `<div class="text-gray-300 leading-relaxed">${tagValue.replace(/\n/g, '<br>')}</div>`;
                }
                contentHtml += `</div>`;
            });
            contentContainer.innerHTML = contentHtml;
        }
    });
}

// Sets up all the interactive elements on the page (tabs, buttons)
function setupPageInteractions(userId, userName) {
    // Tab Switching Logic
    const tabs = document.querySelectorAll('nav[aria-label="Tabs"] a');
    const tabContents = document.querySelectorAll('.tab-content-container');
    tabs.forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            tabs.forEach(item => item.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            const targetId = tab.getAttribute('href').substring(1);
            tabContents.forEach(content => {
                if (content.id === targetId) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });
    });

    // Setup action buttons
    document.getElementById('pdf-btn').addEventListener('click', handlePdfDownload);
    document.getElementById('share-btn').addEventListener('click', () => handleShareToHub(userId, userName));
}


// --- Button Functionality ---

function handlePdfDownload() {
    if (!currentLessonData) return alert('No lesson data to export.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15; // Vertical position in PDF

    const addText = (text, size, isTitle = false) => {
        if (y > 280) { // Add new page if content overflows
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(size);
        const plainText = text.replace(/<br>/g, '\n');
        const splitText = doc.splitTextToSize(plainText, 180); // Wrap text
        doc.text(splitText, 10, y);
        y += (splitText.length * (size / 2.5)) + (isTitle ? 6 : 4); // Increment position
    };

    addText(`Topic: ${currentLessonData.topic}`, 20, true);
    
    // Loop through the lesson data and add it to the PDF
    Object.values(currentLessonData).forEach(tabContent => {
        if (typeof tabContent === 'object') {
            Object.entries(tabContent).forEach(([key, value]) => {
                const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                addText(title, 16, true);
                if (Array.isArray(value)) {
                    value.forEach(item => addText(`- ${item}`, 12));
                } else {
                    addText(value, 12);
                }
                 y += 5; // Add extra space between sections
            });
        }
    });

    doc.save(`${currentLessonData.topic}.pdf`);
}

async function handleShareToHub(userId, userName) {
    if (!currentLessonData) return alert('No content to share.');

    const supabase = await getSupabase();
    const button = document.getElementById('share-btn');
    const originalContent = button.innerHTML;
    
    // Prepare data for the database
    const postData = {
        user_id: userId,
        user_name: userName,
        topic: currentLessonData.topic,
        category: 'Full Lesson Plan',
        content: JSON.stringify(currentLessonData, null, 2), // Save the whole lesson as a formatted string
    };

    button.disabled = true;
    button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>`;

    const { error } = await supabase.from('CommunityHub').insert([postData]);

    if (error) {
        alert('Error sharing to hub: ' + error.message);
        button.innerHTML = originalContent;
        button.disabled = false;
    } else {
        button.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Shared!`;
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.disabled = false;
        }, 2500);
    }
}

