// js/history.js
import getSupabase from './supabaseClient.js';
let supabase;

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    // 1. Authentication & User Info Setup
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;

    // Personalize welcome message and setup logout button
    const welcomeMessage = document.getElementById('welcome-message');
    if(welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
        welcomeMessage.classList.remove('hidden');
    }
    
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/';
        });
    }
    
    console.log("Fetching lessons for user:", user.id);
    fetchAndDisplayLessons(user.id);

    const searchInput = document.getElementById('search-input');
    if(searchInput){
        searchInput.addEventListener('input', (e) => {
            filterLessons(e.target.value);
        });
    }

    setupModalListeners();
});

async function fetchAndDisplayLessons(userId) {
    const grid = document.getElementById('history-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');

    loader.style.display = 'flex';
    grid.innerHTML = ''; // Clear previous content
    emptyState.style.display = 'none';

    console.log("Querying 'AIGeneratedContent' table from Supabase...");
    let { data: lessons, error } = await supabase
        .from('AIGeneratedContent')
        .select('id, created_at, topic, language, content_json')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    loader.style.display = 'none';

    // ** THE FIX **: Added detailed logging to debug the fetch operation.
    if (error) {
        console.error('Error fetching lessons from Supabase:', error);
        grid.innerHTML = `<p class="text-red-400 col-span-full text-center">Error: Could not fetch your history. ${error.message}</p>`;
        return;
    }

    console.log("Supabase response received. Number of lessons:", lessons ? lessons.length : 0);
    console.log("Lessons data:", lessons);


    if (!lessons || lessons.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        grid.innerHTML = lessons.map(lesson => createLessonCard(lesson)).join('');
        attachCardListeners();
    }
}

function createLessonCard(lesson) {
    const formattedDate = new Date(lesson.created_at).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    const language = lesson.language || 'English'; 

    return `
        <div class="lesson-card bg-black/30 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden group flex flex-col justify-between hover:border-purple-500 border border-transparent transition-all duration-300" data-lesson-id="${lesson.id}" data-topic="${lesson.topic}">
            <div class="p-6 flex-grow">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-semibold text-white">${lesson.topic}</h3>
                    <span class="text-xs font-medium bg-purple-800/60 text-purple-200 px-2 py-1 rounded-full">${language}</span>
                </div>
                <p class="text-gray-400 text-sm mb-4 line-clamp-2">Review the generated content for this Montessori lesson.</p>
            </div>
            <div class="px-6 pb-4 pt-2">
                <p class="text-gray-400 text-sm">${formattedDate}</p>
            </div>
            <div class="p-4 bg-black/20 flex justify-end items-center space-x-3">
                <button class="view-btn text-gray-300 hover:text-white transition-colors" title="View Lesson">
                    <span class="material-symbols-outlined">visibility</span>
                </button>
                <button class="share-btn text-gray-300 hover:text-white transition-colors" title="Share to Hub">
                    <span class="material-symbols-outlined">groups</span>
                </button>
                <button class="delete-btn text-gray-300 hover:text-red-500 transition-colors" title="Delete Lesson">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </div>
    `;
}

function attachCardListeners() {
    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', handleViewLesson);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteLesson);
    });
    
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', () => alert('Sharing to Hub is not yet implemented.'));
    });
}


async function handleViewLesson(event) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    const topic = card.dataset.topic;

    const modal = document.getElementById('lesson-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalLoader = document.getElementById('modal-loader');

    modal.classList.remove('hidden');
    modalTitle.textContent = topic;
    modalLoader.style.display = 'flex';
    modalContent.innerHTML = ''; 
    modalContent.appendChild(modalLoader);
    
    const { data, error } = await supabase.from('AIGeneratedContent').select('content_json').eq('id', lessonId).single();

    modalLoader.style.display = 'none';

    if (error || !data) {
        modalContent.innerHTML = `<p class="text-red-400 text-center">Could not load lesson details.</p>`;
        return;
    }

    modalContent.innerHTML = buildLessonHtml(data.content_json);
}

function buildLessonHtml(lessonData) {
    let html = '<div class="space-y-6">';
    for (const category in lessonData) {
        const categoryTitle = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        html += `<div class="p-4 bg-gray-800/50 rounded-lg"><h4 class="text-lg font-bold text-purple-300 mb-3">${categoryTitle}</h4><div class="space-y-4">`;
        
        const subcategories = lessonData[category];
        for (const sub in subcategories) {
            const subTitle = sub.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            html += `<div><h5 class="font-semibold text-white">${subTitle}</h5>`;

            let content = subcategories[sub];
            if (Array.isArray(content)) {
                html += `<ul class="list-disc list-inside text-gray-300 mt-1">${content.map(item => `<li>${item}</li>`).join('')}</ul></div>`;
            } else {
                html += `<p class="text-gray-300 mt-1">${content}</p></div>`;
            }
        }
        html += '</div></div>';
    }
    html += '</div>';
    return html;
}

async function handleDeleteLesson(event) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    const topic = card.dataset.topic;

    if (window.confirm(`Are you sure you want to delete the lesson "${topic}"? This cannot be undone.`)) {
        const { error } = await supabase.from('AIGeneratedContent').delete().eq('id', lessonId);
        if (error) {
            console.error("Error deleting lesson:", error);
            alert('Error deleting lesson: ' + error.message);
        } else {
            card.remove(); 
            if (document.querySelectorAll('.lesson-card').length === 0) {
                document.getElementById('history-grid').style.display = 'none';
                document.getElementById('empty-state').style.display = 'flex';
            }
        }
    }
}

function setupModalListeners() {
    const modal = document.getElementById('lesson-modal');
    if (!modal) return;
    const closeBtn = document.getElementById('modal-close-btn');

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'lesson-modal') {
            modal.classList.add('hidden');
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
}

function filterLessons(searchTerm) {
    const term = searchTerm.toLowerCase();
    const cards = document.querySelectorAll('.lesson-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        if (title.includes(term)) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('history-grid');
    if(visibleCount === 0 && cards.length > 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        emptyState.querySelector('h3').textContent = 'No Lessons Found';
        emptyState.querySelector('p').textContent = 'Try adjusting your search term.';
        const emptyStateLink = emptyState.querySelector('a');
        if (emptyStateLink) emptyStateLink.style.display = 'none';
    } else if (visibleCount > 0) {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}

