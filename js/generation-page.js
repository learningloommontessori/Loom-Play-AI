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
        // Setup logout button
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
        // If no topic is found, send the user back to create one
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

    // Show the loader while we "generate"
    loader.style.display = 'flex';
    mainContent.style.display = 'none';
    
    // Simulate AI generation with a delay
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    // In a real application, you would make an API call to your AI backend here.
    // For now, we'll use a function that creates detailed mock data.
    currentLessonData = createMockLessonData(topic);

    // Save the generated lesson to the database
    saveLessonToHistory(topic, currentLessonData, user.id);

    // Populate the page with the generated data
    populatePage(currentLessonData);

    // Hide loader and show the main content
    loader.style.display = 'none';
    mainContent.style.display = 'block';
    
    // Set up all interactive elements (tabs, buttons, etc.)
    setupPageInteractions(user);
}

// --- Supabase Interaction ---
async function saveLessonToHistory(topic, lessonData, userId) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('lessons') // Make sure you have a 'lessons' table in Supabase
      .insert({ 
          user_id: userId, 
          topic: topic, 
          content: lessonData // The content is stored as a JSONB object
      });

    if (error) {
        console.error('Error saving lesson to history:', error);
        // You might want to show a non-blocking notification to the user
    } else {
        console.log('Lesson saved to history successfully.');
    }
}


// --- DOM Manipulation and Event Handlers ---

function populatePage(data) {
    const container = document.getElementById('content-container');
    if(container) {
        container.innerHTML = createTabsHtml(data);
    }
}

function setupPageInteractions(user) {
    // Logic for switching between the main content tabs (Story, Hands-On, etc.)
    const tabs = document.querySelectorAll('nav[aria-label="Tabs"] a');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = tab.dataset.tab;
            
            // Update active tab styles
            tabs.forEach(item => item.classList.remove('active-tab'));
            tab.classList.add('active-tab');

            // Show the correct content block
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-tab-content'));
            document.getElementById(`${tabId}-content`).classList.add('active-tab-content');
        });
    });

    // Logic for switching between sub-topic tags (Learning Story, Rhyme, etc.)
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

    // Attach event listeners to the download and share buttons
    const wordBtn = document.getElementById('word-btn');
    if (wordBtn) wordBtn.addEventListener('click', handleWordDownload);

    const pdfBtn = document.getElementById('pdf-btn');
    if (pdfBtn) pdfBtn.addEventListener('click', handlePdfDownload);
    
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', (event) => handleShareToHub(event, user));
    });
}


// --- Export and Share Functionality ---

async function handleWordDownload() {
    if (!currentLessonData) return;
    
    let fullHtmlContent = `<h1>Lesson: ${currentLessonData.topic}</h1>`;
    Object.values(currentLessonData.tabs).forEach(tab => {
        fullHtmlContent += `<h2>${tab.title}</h2>`;
        Object.values(tab.content).forEach(item => {
            fullHtmlContent += `<h3>${item.title}</h3><div>${item.body}</div><br>`;
        });
    });

    try {
        const blob = await htmlToDocx(fullHtmlContent, null, { footer: true, pageNumber: true });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentLessonData.topic}.docx`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Error generating DOCX:", e);
        alert("Could not generate Word document.");
    }
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

async function handleShareToHub(event, user) {
    const supabase = await getSupabase();
    const button = event.currentTarget;
    const originalContent = button.innerHTML;
    
    const activeTagContent = document.querySelector('.tag-content.active-tag-content');
    const activeTag = document.querySelector('.tag.active-tag');

    if (!activeTagContent || !activeTag) {
        alert('No active content selected to share.');
        return;
    }

    const postData = {
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email,
        topic: currentLessonData.topic,
        category: activeTag.textContent.trim(),
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
// In a real app, this data would come from your AI model
function createMockLessonData(topic) {
    return {
        topic: topic,
        tabs: {
            story: {
                title: "Story & Rhyme",
                content: {
                    learning_story: { title: "Learning Story", body: `<h3>The Great ${topic} Adventure</h3><p>Once upon a time, in a bright and sunny Montessori classroom, a small child discovered the wonder of ${topic}. With focused eyes and careful hands, they explored its texture, shape, and purpose. The child learned about concentration, order, and the deep satisfaction of independent work.</p>` },
                    rhyme: { title: "Rhyme", body: `<h4>A Little Song for ${topic}</h4><p><em>(To the tune of "Twinkle, Twinkle, Little Star")</em><br>Steady hands and quiet feet,<br>Learning ${topic}, oh what a treat.<br>I can do it, yes it's true,<br>Watch me now, and you can too.<br>Steady hands and quiet feet,<br>My new lesson is complete.</p>` },
                    vocab: { title: "Key Vocabulary", body: `<ul><li class="mb-2"><strong>Focus:</strong> To pay close attention to something.</li><li class="mb-2"><strong>Explore:</strong> To learn about something by trying it.</li><li class="mb-2"><strong>Independent:</strong> Doing things by yourself.</li><li><strong>Control:</strong> The power to manage your own actions and movements.</li></ul>` },
                }
            },
            'hands-on': {
                title: "Hands-On Activities",
                content: {
                    practical: { title: "Practical Life", body: `<p>Set up a small tray with all the materials needed for a ${topic} activity. Demonstrate the steps slowly and without words. Invite the child to have a turn, emphasizing careful movements and returning materials to their proper place.</p>`},
                    sensorial: { title: "Sensorial", body: `<p>Provide different variations of the ${topic} materials. If it's pouring, use different sized pitchers. If it's sorting, use objects of different colors and textures. This allows the child to refine their senses while practicing the skill.</p>`},
                }
            },
            movement: { title: "Movement", content: { activity: { title: "Gross Motor Activity", body: "<p>Create a game related to the topic. For example, if the topic is 'washing hands', have the children pretend to be little water droplets wiggling down a stream before they 'splash' into a basin. This connects the physical activity to the lesson's purpose.</p>" }}},
            exploration: { title: "Exploration", content: { nature: { title: "Nature's Connection", body: "<p>Take the lesson outside. If the topic is 'leaves', go on a nature walk to find different kinds of leaves. This helps the child connect the classroom lesson to the world around them.</p>"}}},
            printables: { title: "Printables", content: { worksheet: { title: "Matching Cards", body: "<p>Create a set of printable cards with pictures related to the lesson. One set has the picture and the word, the other just the picture. The child can match the picture to the picture, and later, the word to the picture, building pre-reading skills.</p>"}}},
            parent: { title: "Parent Links", content: { home_activity: { title: "At-Home Connection", body: "<p>Create a short, simple note for parents explaining the new skill the child is learning, like 'Today we practiced pouring!'. Suggest a simple way they can incorporate this at home, such as letting the child pour their own milk from a small pitcher. This reinforces the lesson and involves the family.</p>"}}},
            teacher: { title: "Teacher's Corner", content: { observation: { title: "Observation Points", body: "<p>When observing the child with this lesson, look for: level of concentration, ability to complete the work cycle (take out, use, put away), control of error, and expressions of satisfaction. These observations will guide your next steps for this child.</p>"}}},
        }
    };
}

function createTabsHtml(data) {
    let html = '';
    let isFirstTab = true;

    for (const tabKey in data.tabs) {
        const tabData = data.tabs[tabKey];
        html += `<div class="tab-content ${isFirstTab ? 'active-tab-content' : ''}" id="${tabKey}-content">`;
        html += `<div class="flex items-center justify-between mb-6">`;
        html += `<div class="flex flex-wrap gap-2 tag-group">`;
        
        let isFirstTag = true;
        for (const contentKey in tabData.content) {
            html += `<span class="tag bg-purple-800/50 text-purple-200 text-sm font-medium px-3 py-1 rounded-full cursor-pointer transition-colors duration-200 hover:bg-purple-700 hover:text-white ${isFirstTag ? 'active-tag' : ''}" data-tag-content="${tabKey}-${contentKey}">${tabData.content[contentKey].title}</span>`;
            isFirstTag = false;
        }
        html += `</div></div>`;

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

    return `
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-700">
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
