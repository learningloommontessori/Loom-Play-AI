// js/collective-loom.js
import getSupabase from './supabaseClient.js';
let supabase;
let currentUserId; // Variable to hold the current user's ID

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    // 1. Authentication & User Info
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    const user = session.user;
    currentUserId = user.id; // Store the current user's ID
    const userName = user.user_metadata?.full_name || user.email;

    // Setup header
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
        welcomeMessage.classList.remove('hidden');
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/';
        });
    }

    // 2. Fetch and display community posts
    fetchAndDisplayPosts();

    // 3. Setup real-time search functionality
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => filterPosts(e.target.value));
    }
    
    // Setup listeners for the new modal
    setupModalListeners();
});

async function fetchAndDisplayPosts() {
    const grid = document.getElementById('community-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');

    loader.style.display = 'flex';
    grid.innerHTML = '';
    grid.style.display = 'none';
    emptyState.style.display = 'none';

    let { data: posts, error } = await supabase
        .from('CommunityHub')
        .select('*')
        .order('created_at', { ascending: false });

    loader.style.display = 'none';

    if (error) {
        console.error('Error fetching posts:', error);
        grid.innerHTML = `<p class="text-red-400 col-span-full text-center">Could not fetch community posts. Please try again later.</p>`;
        grid.style.display = 'block';
        return;
    }

    if (!posts || posts.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        window.communityPosts = new Map(posts.map(p => [p.post_id, p]));
        const postCards = posts.map(post => createPostCard(post)).join('');
        grid.innerHTML = postCards;
        attachCardListeners();
    }
}

function createPostCard(post) {
    const formattedDate = new Date(post.created_at).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    // ** THE FIX **: Conditionally add a delete button if the post belongs to the current user.
    let actionButtons = `
        <button class="view-btn text-purple-400 hover:text-purple-300 text-sm font-semibold flex items-center" data-post-id="${post.post_id}">
            View More <span class="material-symbols-outlined text-base ml-1">arrow_forward</span>
        </button>
    `;

    if (post.user_id === currentUserId) {
        actionButtons = `
            <button class="delete-btn text-gray-400 hover:text-red-500 transition-colors" title="Delete Post" data-post-id="${post.post_id}">
                <span class="material-symbols-outlined">delete</span>
            </button>
        ` + actionButtons;
    }
    
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
            <div class="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                <p class="text-xs text-gray-400">Shared by: <span class="font-medium text-purple-300">${post.user_name}</span></p>
                <div class="flex items-center space-x-3">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}

function attachCardListeners() {
    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const postId = e.currentTarget.dataset.postId;
            showPostModal(postId);
        });
    });

    // ** THE FIX **: Add event listeners for the new delete buttons.
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeletePost);
    });
}

// ** THE FIX **: New function to handle the delete logic.
async function handleDeletePost(event) {
    const button = event.currentTarget;
    const card = button.closest('.community-card');
    const postId = button.dataset.postId;

    if (window.confirm('Are you sure you want to permanently delete this shared post?')) {
        const { error } = await supabase
            .from('CommunityHub')
            .delete()
            .eq('post_id', postId);

        if (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post: ' + error.message);
        } else {
            card.remove(); // Remove the card from the UI
            // If the grid is now empty, show the empty state message
            if (document.querySelectorAll('.community-card').length === 0) {
                 document.getElementById('community-grid').style.display = 'none';
                 document.getElementById('empty-state').style.display = 'flex';
            }
        }
    }
}

function showPostModal(postId) {
    const post = window.communityPosts.get(postId);
    if (!post) return;

    document.getElementById('modal-title').textContent = `From Lesson: ${post.topic}`;
    document.getElementById('modal-content').innerHTML = post.content;
    document.getElementById('post-modal').classList.remove('hidden');
}

function setupModalListeners() {
    const modal = document.getElementById('post-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('modal-close-btn');
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'post-modal') {
            modal.classList.add('hidden');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
}


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

