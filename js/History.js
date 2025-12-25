import getSupabase from './supabaseClient.js';
let supabase;

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    
    // 1. Auth Check
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;

    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('welcome-message').classList.remove('hidden');
    
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
    
    // 2. Load Data
    fetchAndDisplayLessons(user.id);

    // 3. Setup Filter Listeners
    const searchInput = document.getElementById('search-input');
    const ageFilter = document.getElementById('age-filter');

    const runFilters = () => {
        const searchText = searchInput ? searchInput.value : '';
        const ageValue = ageFilter ? ageFilter.value : 'all';
        filterLessons(searchText, ageValue);
    };

    if(searchInput) searchInput.addEventListener('input', runFilters);
    if(ageFilter) ageFilter.addEventListener('change', runFilters);

    setupModalListeners();
});

async function fetchAndDisplayLessons(userId) {
    const grid = document.getElementById('history-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');

    loader.style.display = 'flex';
    grid.innerHTML = '';
    emptyState.style.display = 'none';

    let { data: lessons, error } = await supabase
        .from('AIGeneratedContent')
        .select('id, created_at, topic, language, age')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    loader.style.display = 'none';

    if (error) {
        console.error('Error fetching lessons:', error);
        grid.innerHTML = `<p class="text-red-400 col-span-full">Error loading history.</p>`;
        return;
    }

    if (!lessons || lessons.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        emptyState.querySelector('h3').textContent = "No Lessons Yet";
    } else {
        grid.style.display = 'grid';
        grid.innerHTML = lessons.map(lesson => createLessonCard(lesson)).join('');
        attachCardListeners();
    }
}

function createLessonCard(lesson) {
    const formattedDate = new Date(lesson.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
    
    const language = lesson.language || 'English';
    const ageGroup = lesson.age || 'General';

    return `
        <div class="lesson-card bg-black/30 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden flex flex-col justify-between border border-transparent hover:border-purple-500 transition-all duration-300" data-lesson-id="${lesson.id}" data-topic="${lesson.topic}" data-age="${ageGroup}">
            <div class="p-6">
                <h3 class="text-xl font-bold text-white mb-3 line-clamp-2">${lesson.topic}</h3>
                
                <div class="flex flex-wrap gap-2 mb-4">
                    <span class="text-xs font-medium bg-purple-900/60 text-purple-200 px-2 py-1 rounded-full border border-purple-700/50">
                        ${language}
                    </span>
                    <span class="text-xs font-medium bg-blue-900/60 text-blue-200 px-2 py-1 rounded-full border border-blue-700/50 flex items-center">
                        <span class="material-symbols-outlined text-[10px] mr-1">school</span>${ageGroup}
                    </span>
                </div>

                <p class="text-gray-400 text-sm line-clamp-2">Review your generated lesson plan.</p>
            </div>
            
            <div class="px-6 pb-4 pt-2 border-t border-gray-800/50 flex justify-between items-center">
                <span class="text-xs text-gray-500">${formattedDate}</span>
                <div class="flex items-center space-x-1">
                    <button class="view-btn p-2 text-gray-400 hover:text-white transition-colors" title="View Lesson">
                        <span class="material-symbols-outlined">visibility</span>
                    </button>
                    <button class="share-btn p-2 text-gray-400 hover:text-purple-400 transition-colors" title="Share to Collective Loom">
                        <span class="material-symbols-outlined">groups</span>
                    </button>
                    <button class="delete-btn p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete Lesson">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
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
        button.addEventListener('click', openShareSelectionModal);
    });
}

// --- NEW CHECKBOX SHARE LOGIC ---

async function openShareSelectionModal(event) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    
    const modal = document.getElementById('lesson-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    modal.classList.remove('hidden');
    modalTitle.textContent = "Weave into the Collective Loom";
    modalContent.innerHTML = '<div class="flex justify-center p-8"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div></div>';

    // 1. Fetch Fresh Data
    const { data: lessonData, error } = await supabase
        .from('AIGeneratedContent')
        .select('*')
        .eq('id', lessonId)
        .single();

    if (error || !lessonData) {
        modalContent.innerHTML = `<p class="text-red-400 text-center">Error loading lesson data: ${error?.message || 'Not found'}</p>`;
        return;
    }

    // 2. Generate Options
    const options = generateShareableItems(lessonData);

    // 3. Build UI
    if (options.length === 0) {
        modalContent.innerHTML = `<p class="text-gray-400 text-center">No shareable content found in this lesson.</p>`;
        return;
    }

    let html = `
        <div class="space-y-4">
            <p class="text-sm text-gray-400 mb-4">Select the threads you wish to share with other teachers:</p>
            <div class="max-h-[50vh] overflow-y-auto space-y-2 pr-2" id="share-options-container">
    `;

    options.forEach((opt, index) => {
        html += `
            <label class="flex items-center justify-between p-3 rounded-lg bg-gray-700/40 hover:bg-gray-700/80 border border-gray-600/50 cursor-pointer transition-colors group">
                <div class="flex items-center gap-3 overflow-hidden">
                    <input type="checkbox" class="share-checkbox form-checkbox h-5 w-5 text-purple-600 rounded border-gray-500 bg-gray-800 focus:ring-purple-500 focus:ring-offset-gray-900" 
                        value="${index}">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-600">
                        <span class="material-symbols-outlined text-sm ${opt.iconColor}">${opt.icon}</span>
                    </div>
                    <div class="min-w-0">
                        <h4 class="text-sm font-semibold text-gray-200 group-hover:text-white truncate">${opt.label}</h4>
                        <p class="text-xs text-gray-500 truncate">${opt.preview}</p>
                    </div>
                </div>
            </label>
        `;
    });

    html += `
            </div>
            <div class="pt-4 border-t border-gray-700 flex justify-between items-center mt-4">
                <button id="select-all-btn" class="text-xs text-purple-400 hover:text-purple-300 font-medium">Select All</button>
                <button id="confirm-share-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-all flex items-center shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span class="material-symbols-outlined mr-2 text-lg">groups</span> Share Selected
                </button>
            </div>
        </div>
    `;

    modalContent.innerHTML = html;

    // 4. Attach Listeners
    const checkboxes = modalContent.querySelectorAll('.share-checkbox');
    const confirmBtn = document.getElementById('confirm-share-btn');
    const selectAllBtn = document.getElementById('select-all-btn');

    // Select All Logic
    selectAllBtn.onclick = () => {
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        selectAllBtn.textContent = allChecked ? "Select All" : "Deselect All";
    };

    // Submit Logic
    confirmBtn.onclick = async () => {
        const selectedIndices = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value));

        if (selectedIndices.length === 0) {
            alert("Please select at least one item to share.");
            return;
        }

        const selectedItems = selectedIndices.map(i => options[i]);
        await executeBatchShare(selectedItems, lessonData, confirmBtn);
    };
}

// Generate the list of potential items to share
function generateShareableItems(lesson) {
    const items = [];
    const json = lesson.content_json;
    if (!json) return items;

    // 1. Full Lesson
    items.push({
        label: "Full Lesson Plan",
        category: "Full Plan",
        content: buildLessonHtml(json),
        icon: "description",
        iconColor: "text-white",
        preview: "Share the entire document"
    });

    // 2. Rhymes & Stories
    if (json.newlyCreatedContent) {
        if (json.newlyCreatedContent.originalRhyme) {
            items.push({
                label: "Original Rhyme",
                category: "Rhyme",
                content: json.newlyCreatedContent.originalRhyme,
                icon: "music_note",
                iconColor: "text-pink-400",
                preview: "Song/Rhyme Lyrics"
            });
        }
        if (json.newlyCreatedContent.originalMiniStory) {
            items.push({
                label: "Mini Story",
                category: "Story",
                content: json.newlyCreatedContent.originalMiniStory,
                icon: "auto_stories",
                iconColor: "text-yellow-400",
                preview: "Short Story Text"
            });
        }
    }

    // 3. Activities
    if (json.newActivities) {
        Object.entries(json.newActivities).forEach(([key, val]) => {
            const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const text = Array.isArray(val) ? val.join(" ") : val;
            items.push({
                label: title,
                category: "Activity",
                content: text,
                icon: "extension",
                iconColor: "text-blue-400",
                preview: typeof text === 'string' ? text.substring(0, 40) + "..." : "Activity Details"
            });
        });
    }

    return items;
}

// Upload multiple items to Supabase
async function executeBatchShare(items, lessonData, buttonElement) {
    const originalContent = buttonElement.innerHTML;
    buttonElement.innerHTML = `<span class="animate-spin material-symbols-outlined mr-2">progress_activity</span> Sharing...`;
    buttonElement.disabled = true;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session.user;

    // Create an array of insert promises
    const promises = items.map(item => {
        return supabase.from('CommunityHub').insert([{
            user_id: user.id,
            user_name: user.user_metadata?.full_name || user.email,
            topic: lessonData.topic,
            category: item.category,
            content: item.content,
            age: lessonData.age || 'General'
        }]);
    });

    // Run all inserts in parallel
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
        alert(`Shared ${items.length - errors.length} items. Failed to share ${errors.length} items.`);
        buttonElement.innerHTML = originalContent;
        buttonElement.disabled = false;
    } else {
        buttonElement.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span> Shared Successfully!`;
        buttonElement.classList.replace('bg-purple-600', 'bg-green-600');
        buttonElement.classList.replace('hover:bg-purple-700', 'hover:bg-green-700');
        
        setTimeout(() => {
            document.getElementById('lesson-modal').classList.add('hidden');
        }, 1500);
    }
}


// --- VIEW & DELETE LOGIC (Unchanged) ---

async function handleViewLesson(event) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    const topic = card.dataset.topic;

    const modal = document.getElementById('lesson-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    modal.classList.remove('hidden');
    modalTitle.textContent = topic;
    modalContent.innerHTML = '<div class="flex justify-center p-8"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div></div>';
    
    const { data, error } = await supabase.from('AIGeneratedContent').select('content_json').eq('id', lessonId).single();

    if (error || !data) {
        modalContent.innerHTML = `<p class="text-red-400 text-center">Could not load lesson details.</p>`;
        return;
    }

    modalContent.innerHTML = buildLessonHtml(data.content_json);
}

function buildLessonHtml(lessonData) {
    let html = '<div class="space-y-6">';
    for (const category in lessonData) {
        if (category === 'imagePrompt') continue;
        const categoryTitle = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        html += `<div class="p-4 bg-gray-800/50 rounded-lg"><h4 class="text-lg font-bold text-purple-300 mb-3 border-b border-gray-700 pb-2">${categoryTitle}</h4><div class="space-y-4">`;
        
        const subcategories = lessonData[category];
        for (const sub in subcategories) {
            const subTitle = sub.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            html += `<div><h5 class="font-semibold text-white mb-1">${subTitle}</h5>`;

            let content = subcategories[sub];
            if (Array.isArray(content)) {
                html += `<ul class="list-disc list-inside text-gray-300 space-y-1">${content.map(item => `<li>${item}</li>`).join('')}</ul></div>`;
            } else {
                html += `<p class="text-gray-300 leading-relaxed">${content}</p></div>`;
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
    
    if (window.confirm(`Delete this lesson?`)) {
        const { error } = await supabase.from('AIGeneratedContent').delete().eq('id', lessonId);
        if (!error) {
            card.remove(); 
            const grid = document.getElementById('history-grid');
            if (grid.children.length === 0) {
                grid.style.display = 'none';
                document.getElementById('empty-state').style.display = 'flex';
            }
        }
    }
}

function filterLessons(searchTerm, ageFilter) {
    const term = searchTerm.toLowerCase();
    const selectedAge = ageFilter.toLowerCase();
    const cards = document.querySelectorAll('.lesson-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const topic = card.dataset.topic.toLowerCase();
        const cardAge = card.dataset.age.toLowerCase();
        
        const isTextMatch = topic.includes(term);
        const isAgeMatch = (selectedAge === 'all') || cardAge.includes(selectedAge);

        if (isTextMatch && isAgeMatch) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('history-grid');

    if (visibleCount === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}

function setupModalListeners() {
    const modal = document.getElementById('lesson-modal');
    if (!modal) return;
    const closeBtn = document.getElementById('modal-close-btn');

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'lesson-modal' || e.target.id === 'modal-container') {
            modal.classList.add('hidden');
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
}