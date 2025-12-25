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
        .select('id, created_at, topic, language, age, content_json')
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
        attachCardListeners(lessons); 
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
                    <button class="share-btn p-2 text-gray-400 hover:text-purple-400 transition-colors" title="Share to Community">
                        <span class="material-symbols-outlined">ios_share</span>
                    </button>
                    <button class="delete-btn p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete Lesson">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function attachCardListeners(lessons) {
    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', handleViewLesson);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteLesson);
    });
    
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', (e) => openShareSelectionModal(e, lessons));
    });
}

// --- NEW: SMART SHARE SELECTION ---

function openShareSelectionModal(event, lessons) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    const lessonData = lessons.find(l => l.id === lessonId);

    if (!lessonData) return alert("Error finding lesson data.");

    // 1. Open Modal
    const modal = document.getElementById('lesson-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    modal.classList.remove('hidden');
    modalTitle.textContent = "Select Content to Share";
    modalContent.innerHTML = ''; // Clear previous content

    // 2. Generate Share Options
    const options = generateShareableItems(lessonData);

    // 3. Build UI for Options
    const container = document.createElement('div');
    container.className = "space-y-3";

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left p-4 rounded-lg bg-gray-700/50 hover:bg-purple-900/30 border border-gray-600 hover:border-purple-500 transition-all flex items-center justify-between group";
        
        btn.innerHTML = `
            <div class="flex items-center">
                <span class="material-symbols-outlined ${opt.iconColor} mr-3">${opt.icon}</span>
                <div>
                    <h4 class="font-bold text-gray-200 group-hover:text-white">${opt.label}</h4>
                    <p class="text-xs text-gray-400">${opt.preview}</p>
                </div>
            </div>
            <span class="material-symbols-outlined text-gray-500 group-hover:text-purple-400">send</span>
        `;

        // Click Handler
        btn.onclick = () => executeShare(opt, lessonData, btn);
        container.appendChild(btn);
    });

    modalContent.appendChild(container);
}

function generateShareableItems(lesson) {
    const items = [];
    const json = lesson.content_json;

    // 1. Full Lesson Option
    items.push({
        label: "Full Lesson Plan",
        category: "Full Plan",
        content: buildLessonHtml(json),
        icon: "description",
        iconColor: "text-white",
        preview: "Share the entire generated document."
    });

    // 2. Extract Rhymes & Stories
    if (json.newlyCreatedContent) {
        if (json.newlyCreatedContent.originalRhyme) {
            items.push({
                label: "Original Rhyme",
                category: "Rhyme",
                content: json.newlyCreatedContent.originalRhyme,
                icon: "music_note",
                iconColor: "text-pink-400",
                preview: "Just the rhyme/song lyrics."
            });
        }
        if (json.newlyCreatedContent.originalMiniStory) {
            items.push({
                label: "Mini Story",
                category: "Story",
                content: json.newlyCreatedContent.originalMiniStory,
                icon: "auto_stories",
                iconColor: "text-yellow-400",
                preview: "Just the short story text."
            });
        }
    }

    // 3. Extract Activities
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
                preview: text.substring(0, 50) + "..."
            });
        });
    }

    return items;
}

async function executeShare(item, lessonData, buttonElement) {
    const originalContent = buttonElement.innerHTML;
    buttonElement.innerHTML = `<div class="flex items-center justify-center w-full"><div class="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div></div>`;
    buttonElement.disabled = true;

    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.from('CommunityHub').insert([{
        user_id: session.user.id,
        user_name: session.user.user_metadata?.full_name || session.user.email,
        topic: lessonData.topic,
        category: item.category, // e.g., "Rhyme", "Full Plan"
        content: item.content,
        age: lessonData.age || 'General'
    }]);

    if (error) {
        alert('Share failed: ' + error.message);
        buttonElement.innerHTML = originalContent;
        buttonElement.disabled = false;
    } else {
        buttonElement.innerHTML = `<div class="flex items-center text-green-400"><span class="material-symbols-outlined mr-2">check_circle</span> Shared to Hub!</div>`;
        buttonElement.classList.remove('bg-gray-700/50');
        buttonElement.classList.add('bg-green-900/30', 'border-green-500');
        
        // Close modal after 1.5 seconds
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