import getSupabase from './supabaseClient.js';

// ** ADMIN CONFIGURATION **
const ADMIN_EMAILS = [
    "monika.pathak@choithramschool.com",
    "vip.pathak.ai.com", 
    "learningloom.montessori@gmail.com"
];

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // 1. Check Session (Security Guard)
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }

    const user = session.user;
    const userEmail = user.email.toLowerCase();

    // 2. Update Welcome Message
    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const welcomeMsg = document.getElementById('welcome-message');
    const mainTitle = document.getElementById('user-name-main');
    
    if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${userName.split(' ')[0]}!`;
    if (mainTitle) mainTitle.textContent = `Welcome, ${userName}`;

    // 3. Logout Logic
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/index.html';
        });
    }

    // 4. ** INJECT ADMIN LINK (The Missing Piece) **
    // Check if the current user is an Admin
    if (ADMIN_EMAILS.includes(userEmail)) {
        // Find the profile dropdown container (parent of the logout button)
        if (logoutBtn && logoutBtn.parentElement) {
            // Prevent duplicates
            if (!document.getElementById('admin-link-item')) {
                const adminLink = document.createElement('a');
                adminLink.id = 'admin-link-item';
                adminLink.href = '/admin-panel.html';
                // Using exact Tailwind classes from your dropdown for consistency
                adminLink.className = "flex items-center px-4 py-3 text-sm text-yellow-400 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer";
                adminLink.innerHTML = `<span class="material-symbols-outlined mr-3">admin_panel_settings</span> Admin Panel`;
                
                // Insert it immediately before the Logout button
                logoutBtn.parentElement.insertBefore(adminLink, logoutBtn);
            }
        }
    }
});