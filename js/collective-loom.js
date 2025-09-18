// js/community.js

import supabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authentication & User Info
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;

    // Setup header
    document.getElementById('welcome-message').textContent = `Welcome, ${userName}!`;
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });

    // 2. Fetch and display community posts
    fetchAndDisplayPosts();

    // 3. Setup real-time search functionality
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => filterPosts(e.target.value));
});

async function fetchAndDisplayPosts() {
    const grid = document.getElementById('community-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');

    loader.style.display = 'flex';
    grid.style.display = 'grid'; // Keep grid layout during load
    emptyState.style.display = 'none';

    let { data: posts, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });

    loader.style.display = 'none';

    if (error) {
        console.error('Error fetching posts:', error);
        grid.innerHTML = `<p class="text-red-400 col-span-full text-center">Could not fetch community posts. Please try again later.</p>`;
        return;
    }

    if (!posts || posts.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        const postCards = posts.map(post => createPostCard(post)).join('');
        grid.innerHTML = postCards;
    }
}

function createPostCard(post) {
    const formattedDate = new Date(post.created_at).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    return `
        <div class="community-card bg-black/30 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden flex flex-col justify-between p-6 hover:border-purple-500 border border-transparent transition-all duration-300">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="inline-block bg-purple-600/50 text-purple-200 text-xs font-medium px-2.5 py-1 rounded-full">${post.category}</span>
                    <p class="text-gray-400 text-xs">${formattedDate}</p>
                </div>
                <h3 class="text-lg font-semibold text-white mb-2">From Lesson: ${post.topic}</h3>
                <div class="text-gray-300 text-sm space-y-2 prose prose-invert prose-sm max-w-none line-clamp-4">
                    ${post.content}
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-700">
                <p class="text-xs text-gray-400">Shared by: <span class="font-medium text-purple-300">${post.user_name}</span></p>
            </div>
        </div>
    `;
}

/**
 * Filters community posts on the client-side based on the search term.
 * @param {string} searchTerm - The text from the search input.
 */
function filterPosts(searchTerm) {
    const term = searchTerm.toLowerCase();
    const cards = document.querySelectorAll('.community-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const content = card.querySelector('.prose').textContent.toLowerCase();
        const author = card.querySelector('.font-medium').textContent.toLowerCase();
        
        if (title.includes(term) || content.includes(term) || author.includes(term)) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Optional: Show a message if no posts match the search
    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('community-grid');
    if (visibleCount === 0 && cards.length > 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        emptyState.querySelector('h3').textContent = 'No Threads Found';
        emptyState.querySelector('p').textContent = 'Try a different search term to find what you\'re looking for.';
    } else if (cards.length > 0) {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}

