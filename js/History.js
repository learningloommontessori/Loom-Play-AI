// js/history.js

import supabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authentication & User Info Setup
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/Sign In.html'; // Redirect to sign-in if not logged in
        return;
    }
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;

    // Personalize welcome message and setup logout button
    document.getElementById('welcome-message').textContent = `Welcome, ${userName}!`;
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });
    
    // 2. Fetch and display lessons for the current user
    fetchAndDisplayLessons(user.id);

    // 3. Setup search functionality
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        filterLessons(e.target.value);
    });
});

/**
 * Fetches lesson history from Supabase for a specific user and displays it.
 * @param {string} userId - The UUID of the logged-in user.
 */
async function fetchAndDisplayLessons(userId) {
    const grid = document.getElementById('history-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');

    loader.style.display = 'flex';
    grid.style.display = 'grid'; // Ensure grid is visible for loader
    emptyState.style.display = 'none';

    let { data: lessons, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    loader.style.display = 'none';

    if (error) {
        console.error('Error fetching lessons:', error);
        grid.innerHTML = `<p class="text-red-400 col-span-full text-center">Could not fetch your history. Please try again later.</p>`;
        return;
    }

    if (!lessons || lessons.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        const lessonCards = lessons.map(lesson => createLessonCard(lesson)).join('');
        grid.innerHTML = lessonCards;
        attachCardListeners();
    }
}

/**
 * Creates the HTML string for a single lesson card.
 * @param {object} lesson - The lesson data from Supabase.
 * @returns {string} The HTML markup for the card.
 */
function createLessonCard(lesson) {
    const formattedDate = new Date(lesson.created_at).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
        <div class="lesson-card bg-black/30 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden group flex flex-col justify-between hover:border-purple-500 border border-transparent transition-all duration-300" data-lesson-id="${lesson.id}" data-topic="${lesson.topic}">
            <div class="p-6 flex-grow">
                <h3 class="text-xl font-semibold text-white mb-2">${lesson.topic}</h3>
                <p class="text-gray-400 text-sm mb-4 line-clamp-2">A foundational Montessori activity focusing on fine motor skills, concentration, and coordination.</p>
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

/**
 * Attaches click event listeners to all the buttons on the dynamically created cards.
 */
function attachCardListeners() {
    const cards = document.querySelectorAll('.lesson-card');
    cards.forEach(card => {
        const lessonId = card.dataset.lessonId;
        
        card.querySelector('.view-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const { data, error } = await supabase.from('lessons').select('lesson_data, topic').eq('id', lessonId).single();
            if (error) return alert('Error fetching lesson data.');
            localStorage.setItem('currentLesson', JSON.stringify(data.lesson_data));
            localStorage.setItem('currentTopic', data.topic);
            window.location.href = '/Generation Page.html';
        });

        card.querySelector('.share-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            alert('Sharing to The Collective Loom... (This is a placeholder)');
            // In a real implementation, you would get the lesson data and insert it
            // into your 'community_posts' table in Supabase.
        });

        card.querySelector('.delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const topic = card.dataset.topic;
            if (confirm(`Are you sure you want to delete the lesson "${topic}"? This cannot be undone.`)) {
                const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
                if (error) {
                    alert('Error deleting lesson: ' + error.message);
                } else {
                    card.remove(); // Remove card from the view
                    // If no cards are left, show the empty state
                    if (document.querySelectorAll('.lesson-card').length === 0) {
                        document.getElementById('history-grid').style.display = 'none';
                        document.getElementById('empty-state').style.display = 'flex';
                    }
                }
            }
        });
    });
}

/**
 * Filters the visible lesson cards based on a search term.
 * @param {string} searchTerm - The text to filter by.
 */
function filterLessons(searchTerm) {
    const term = searchTerm.toLowerCase();
    const cards = document.querySelectorAll('.lesson-card');
    cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        if (title.includes(term)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

