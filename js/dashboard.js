import getSupabase from './supabaseClient.js';

// ** ADMIN CONFIGURATION **
const ADMIN_EMAILS = [
    "monika.pathak@choithramschool.com",
    "vip.pathak.ai@gmail.com", 
    "learningloom.montessori@gmail.com"
];

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // 1. Check Session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }

    const user = session.user;
    const userEmail = user.email.toLowerCase();

    // 2. ** FETCH PROFILE (The Vital Check) **
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*') // Get everything including mobile
        .eq('id', user.id)
        .single();

    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    // ---------------------------------------------------------------
    // SCENARIO A: NEW GOOGLE USER (No Profile yet)
    // ---------------------------------------------------------------
    if (!profile && !isAdmin) {
        // Show the "Complete Your Profile" Modal
        showMobileModal(supabase, user);
        return; // Stop here, don't show dashboard content yet
    }

    // ---------------------------------------------------------------
    // SCENARIO B: PENDING USER (Has Profile, Not Approved)
    // ---------------------------------------------------------------
    if (profile && !profile.is_approved && !isAdmin) {
        // Show "Pending Approval" Overlay
        document.body.innerHTML = `
            <div class="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
                <div class="bg-gray-800 p-8 rounded-lg shadow-2xl border border-yellow-600/50 max-w-md">
                    <span class="material-symbols-outlined text-6xl text-yellow-500 mb-4">hourglass_top</span>
                    <h2 class="text-2xl font-bold text-white mb-2">Approval Pending</h2>
                    <p class="text-gray-300 mb-6">
                        Thanks for joining, <span class="text-white font-semibold">${user.user_metadata.full_name}</span>!
                        <br><br>
                        Your account is currently awaiting Admin approval. 
                        Please check back later or contact the administrator.
                    </p>
                    <button id="logoutBtn" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full transition-colors">
                        Sign Out
                    </button>
                </div>
            </div>
        `;
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/index.html';
        });
        return; // Stop execution
    }

    // ---------------------------------------------------------------
    // SCENARIO C: APPROVED USER (Load Dashboard)
    // ---------------------------------------------------------------
    
    // Update Welcome Message
    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const welcomeMsg = document.getElementById('welcome-message');
    const mainTitle = document.getElementById('user-name-main');
    
    if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${userName.split(' ')[0]}!`;
    if (mainTitle) mainTitle.textContent = `Welcome, ${userName}`;

    // Logout Logic
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/index.html';
        });
    }

    // Inject Admin Link
    if (isAdmin && logoutBtn && logoutBtn.parentElement && !document.getElementById('admin-link-item')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-link-item';
        adminLink.href = '/admin-panel.html';
        adminLink.className = "flex items-center px-4 py-3 text-sm text-yellow-400 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer";
        adminLink.innerHTML = `<span class="material-symbols-outlined mr-3">admin_panel_settings</span> Admin Panel`;
        logoutBtn.parentElement.insertBefore(adminLink, logoutBtn);
    }
});

// --- HELPER: MOBILE NUMBER MODAL ---
function showMobileModal(supabase, user) {
    // Create Modal HTML
    const modalHtml = `
    <div id="mobile-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div class="bg-gray-800 rounded-lg shadow-2xl border border-purple-500/30 p-8 w-full max-w-md m-4">
            <h2 class="text-2xl font-bold text-white mb-2">One Last Step!</h2>
            <p class="text-gray-400 mb-6 text-sm">To complete your registration, please provide your mobile number.</p>
            
            <form id="mobile-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Mobile Number</label>
                    <input type="tel" id="mobile-input" required pattern="[0-9]{10}" class="w-full bg-gray-700 border border-gray-600 rounded text-white px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g., 9876543210">
                </div>
                <div id="modal-error" class="text-red-400 text-sm hidden"></div>
                <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors flex justify-center items-center">
                    <span>Complete Setup</span>
                </button>
            </form>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const form = document.getElementById('mobile-form');
    const input = document.getElementById('mobile-input');
    const errorMsg = document.getElementById('modal-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mobile = input.value.trim();
        const submitBtn = form.querySelector('button');
        
        // Disable button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin material-symbols-outlined text-sm">progress_activity</span>';

        // 1. Check for Duplicate Mobile (Partial Unique Index)
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('mobile', mobile)
            .eq('is_admin', false)
            .single();

        if (existing) {
            errorMsg.textContent = "This mobile number is already in use.";
            errorMsg.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = "Complete Setup";
            return;
        }

        // 2. Create Profile
        const { error } = await supabase.from('profiles').insert([{
            id: user.id,
            email: user.email,
            full_name: user.user_metadata.full_name || user.email.split('@')[0],
            mobile: mobile,
            is_approved: false, // Pending
            is_admin: false
        }]);

        if (error) {
            errorMsg.textContent = "Error saving profile: " + error.message;
            errorMsg.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = "Complete Setup";
        } else {
            // Success! Reload page to hit "Scenario B" (Pending Screen)
            window.location.reload();
        }
    });
}