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
    // 3. Setup Filter & Search
    const searchInput = document.getElementById('search-input');
    const ageFilter = document.getElementById('age-filter');

    // Helper function to get values from BOTH inputs
    const runFilters = () => {
        const searchText = searchInput ? searchInput.value : '';
        const ageValue = ageFilter ? ageFilter.value : 'all';
        filterPosts(searchText, ageValue);
    };

    if(searchInput) searchInput.addEventListener('input', runFilters);
    if(ageFilter) ageFilter.addEventListener('change', runFilters);
    
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
        month: 'short', day: 'numeric', year: 'numeric'
    });
    
    // Default to 'General' if the post is old and has no age data
    const ageGroup = post.age || 'General';

    let actionButtons = `
        <button class="view-btn text-purple-400 hover:text-purple-300 text-sm font-semibold flex items-center" data-post-id="${post.post_id}">
            View More <span class="material-symbols-outlined text-base ml-1">arrow_forward</span>
        </button>
    `;

    if (post.user_id === currentUserId) {
        actionButtons = `
            <button class="delete-btn text-gray-400 hover:text-red-500 transition-colors mr-3" title="Delete Post" data-post-id="${post.post_id}">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        ` + actionButtons;
    }
    
    return `
        <div class="community-card bg-black/30 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden flex flex-col justify-between p-6 hover:border-purple-500 border border-transparent transition-all duration-300" data-age="${ageGroup}">
            <div>
                <div class="flex items-center gap-2 mb-3">
                    <span class="inline-block bg-purple-600/50 text-purple-200 text-xs font-medium px-2.5 py-1 rounded-full border border-purple-500/30">
                        ${post.category}
                    </span>
                    <span class="inline-block bg-blue-900/50 text-blue-200 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-500/30 flex items-center">
                        <span class="material-symbols-outlined text-[10px] mr-1">school</span>${ageGroup}
                    </span>
                </div>
                <h3 class="text-lg font-bold text-white mb-2 line-clamp-1">From: ${post.topic}</h3>
                <div class="text-gray-300 text-sm space-y-2 prose prose-invert prose-sm max-w-none line-clamp-4 relative">
                    ${post.content}
                    <div class="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-900/10 to-transparent"></div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                <div>
                    <p class="text-xs text-gray-400">By <span class="font-medium text-purple-300">${post.user_name}</span></p>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">${formattedDate}</p>
                </div>
                <div class="flex items-center">
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

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeletePost);
    });
}

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
            card.remove(); 
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


function filterPosts(searchTerm, ageFilter) {
    const term = searchTerm.toLowerCase();
    const selectedAge = ageFilter.toLowerCase(); // 'all', 'nursery', etc.

    const cards = document.querySelectorAll('.community-card');
    let visibleCount = 0;

    cards.forEach(card => {
        // Text Match
        const title = card.querySelector('h3').textContent.toLowerCase();
        const content = card.querySelector('.prose').textContent.toLowerCase();
        const authorElement = card.querySelector('.font-medium.text-purple-300');
        const authorName = authorElement ? authorElement.textContent.toLowerCase() : '';
        const isTextMatch = title.includes(term) || content.includes(term) || authorName.includes(term);

        // Age Match
        const cardAge = card.dataset.age.toLowerCase(); // We added data-age to the card HTML above
        const isAgeMatch = (selectedAge === 'all') || cardAge.includes(selectedAge);

        // Final Decision
        if (isTextMatch && isAgeMatch) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Empty State Logic
    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('community-grid');
    
    if (visibleCount === 0 && cards.length > 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        emptyState.querySelector('h3').textContent = 'No Matches Found';
        emptyState.querySelector('p').textContent = 'Try adjusting your filters.';
    } else if (cards.length > 0) {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}
