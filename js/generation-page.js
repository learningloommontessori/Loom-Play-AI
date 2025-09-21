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

    // Use the new, more detailed mock data function
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
    
    let fullHtmlContent = `<h1>Lesson Plan: ${currentLessonData.topic}</h1>`;
    fullHtmlContent += `<p>This plan includes new and classic resources, along with creative Montessori-inspired activities to explore ${currentLessonData.topic}.</p><hr>`;
    
    // This function now iterates through the structured data to build the document
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
        a.download = `Lesson Plan - ${currentLessonData.topic}.docx`;
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
        // Basic HTML stripping for PDF generation
        const plainText = new DOMParser().parseFromString(text.replace(/<br>/g, '\n').replace(/<li>/g, '\n* '), 'text/html').body.textContent || "";
        const splitText = doc.splitTextToSize(plainText, 180);
        doc.text(splitText, 10, y);
        y += (splitText.length * (size / 2.5)) + (isTitle ? 6 : 4);
    };
    
    addText(`Lesson Plan: ${currentLessonData.topic}`, 20, true);
    
    Object.values(currentLessonData.tabs).forEach(tab => {
        addText(tab.title, 16, true);
        Object.values(tab.content).forEach(item => {
            addText(item.title, 14);
            addText(item.body, 12);
        });
    });
    
    doc.save(`Lesson Plan - ${currentLessonData.topic}.pdf`);
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
function createMockLessonData(topic) {
    // This function generates content based on the "KinderSpark AI" persona.
    return {
        topic: topic,
        tabs: {
            story: {
                title: "Newly Created Content",
                content: {
                    rhyme: { 
                        title: "Original Rhyme", 
                        body: `<h4>A Rhyme for ${topic}</h4><p>The world is wide, with much to see,<br>Today we learn of ${topic}, you and me.<br>With careful hands and open eyes,<br>We find in learning a happy surprise.</p>` 
                    },
                    story: { 
                        title: "Original Mini-Story", 
                        body: `<h4>The Little Explorer and the ${topic}</h4><p>Once, a child just like you found a special work on a shelf. It was all about ${topic}. At first, they watched, then they tried. Slowly and carefully, they practiced. It wasn't always easy, but with each try, their hands grew steadier and their mind grew calmer. Soon, they had mastered the work of ${topic}, and a quiet smile of accomplishment filled their heart. They learned that patience and practice could help them learn anything at all.</p>` 
                    },
                }
            },
            'hands-on': {
                title: "New Activities",
                content: {
                    art: { 
                        title: "Art/Craft Activity", 
                        body: `<h4>Creative ${topic}</h4><p>Provide materials for an open-ended art project related to ${topic}. For example, if the topic is 'leaves', provide leaves of different shapes, paper, and crayons for leaf rubbing. The focus should be on the process and exploration, not the final product.</p>` 
                    },
                    motor: { 
                        title: "Motor Skills Activity", 
                        body: `<h4>Fine Motor Work with ${topic}</h4><p>Set up a tray with small objects related to the topic and tweezers or tongs. The child can practice their pincer grasp by transferring the objects from one bowl to another. This builds concentration and prepares the hand for writing.</p>`
                    },
                    sensory: { 
                        title: "Sensory/Exploration Activity", 
                        body: `<h4>Exploring ${topic} with the Senses</h4><p>Create a sensory bin filled with items related to ${topic}. If the topic is 'shells', the bin could have sand, different types of shells, and a magnifying glass. This allows for free exploration and discovery, engaging the child's sense of touch and sight.</p>`
                    },
                }
            },
             teacher: { // Merged Classic Resources into Teacher's Corner
                title: "Classic Resources",
                content: {
                    classic_resources: { 
                        title: "Familiar Rhymes & Songs", 
                        body: `<h4>Classic Songs for ${topic}</h4><p>Here are some well-known songs that can be adapted for your topic:</p><ul><li>"The Wheels on the Bus"</li><li>"Old MacDonald Had a Farm"</li><li>"Twinkle, Twinkle, Little Star"</li></ul>`
                    },
                     classic_books: {
                        title: "Classic Story Books",
                        body: `<h4>Great Books about ${topic}</h4><p>Look for these wonderful books at your local library:</p><ul><li><em>The Very Hungry Caterpillar</em> by Eric Carle</li><li><em>Brown Bear, Brown Bear, What Do You See?</em> by Bill Martin Jr.</li><li><em>Goodnight Moon</em> by Margaret Wise Brown</li></ul>`
                    }
                }
            },
            exploration: {
                title: "Montessori Connections",
                content: {
                    traditional: { 
                        title: "Traditional Use of Materials", 
                        body: `<h4>Classic Montessori Work for ${topic}</h4><p>Connect your topic to traditional materials to isolate the key concepts:</p><ul><li><strong>Practical Life:</strong> Use pouring, spooning, or sorting activities with items related to ${topic}.</li><li><strong>Sensorial:</strong> Use the Geometric Cabinet for shapes, or the Color Tablets for colors.</li><li><strong>Language:</strong> Use Sandpaper Letters to introduce the beginning sound of key vocabulary for ${topic}.</li></ul>` 
                    },
                    new_ways: { 
                        title: "New Ways to Use Materials", 
                        body: `<h4>Creative Extensions for ${topic}</h4><p>Use classic materials in a new way to deepen understanding:</p><ul><li><strong>Pink Tower & a Ball:</strong> Roll a small ball down a ramp and see how many pink tower cubes it can knock over. This introduces physics in a simple, playful way.</li><li><strong>Number Rods & Nature:</strong> Take the number rods outside and match them to objects you find, like one long stick for the 10-rod or three small pebbles for the 3-rod.</li></ul>`
                    },
                }
            },
        }
    };
}


function createTabsHtml(data) {
    let html = '';
    let isFirstTab = true;

    // Use a pre-defined order for tabs to ensure consistency
    const tabOrder = ['story', 'hands-on', 'teacher', 'exploration'];

    // Map keys to the display names you want on the tabs
    const tabDisplayNames = {
        'story': 'Newly Created Content',
        'hands-on': 'New Activities',
        'teacher': 'Classic Resources',
        'exploration': 'Montessori Connections'
    };

    for (const tabKey of tabOrder) {
        if (!data.tabs[tabKey]) continue; // Skip if data for a tab doesn't exist
        
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

    // Generate the navigation HTML based on the same order and display names
    let navHtml = '';
    isFirstTab = true;
    for(const tabKey of tabOrder) {
        if (!data.tabs[tabKey]) continue;
        navHtml += `<a class="whitespace-nowrap py-3 px-4 font-medium text-base text-gray-300 hover:bg-purple-800/40 hover:text-white flex items-center rounded-lg transition-colors duration-200 ${isFirstTab ? 'active-tab' : ''}" data-tab="${tabKey}" href="#">
            <span class="material-symbols-outlined mr-3">${getIconForTab(tabKey)}</span>${tabDisplayNames[tabKey]}
        </a>`;
        isFirstTab = false;
    }
    // We need to inject this navHtml back into the main page, this function can't do it directly.
    // The main generation-page.html needs to have its nav updated, or we do it with JS here.
    // Let's do it with JS.
    const navContainer = document.querySelector('nav[aria-label="Tabs"]');
    if(navContainer) navContainer.innerHTML = navHtml;


    return `
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-700">
            <h3 class="text-3xl font-bold" id="lesson-title">Topic: ${data.topic}</h3>
            <div class="flex items-center space-x-3">
                <button id="word-btn" class="flex items-center text-sm bg-gray-800/60 hover:bg-purple-800/60 border border-gray-600 hover:border-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200">
                    <span class="material-symbols-outlined mr-2">description</span> Word
                </button>
                <button id="pdf-btn" class="flex items-center text-sm bg-gray-800/60 hover:bg-purple-800/60 border border-gray-600 hover:border-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-200">
                    <span class="material-symbols-outlined mr-2">picture_as_pdf</span> PDF
                </button>
            </div>
        </div>
        <p class="mb-6 text-gray-300">This plan includes new and classic resources, along with creative Montessori-inspired activities to explore ${data.topic}.</p>
    ` + html;
}

function getIconForTab(tabKey) {
    const icons = {
        story: 'auto_stories',
        'hands-on': 'pan_tool',
        teacher: 'school',
        exploration: 'eco',
        // Add other icons if needed
    };
    return icons[tabKey] || 'help';
}

