import getSupabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // DOM Elements
    const welcomeMessage = document.getElementById('welcome-message');
    const userNameMain = document.getElementById('user-name-main');
    const logoutButton = document.getElementById('logoutButton');

    // 1. Protect the page by checking for a logged-in user
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        // --- APPROVAL SYSTEM ---
        
        // 1. Fetch the user's profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // 2. Security Check
        // If the profile exists, but they are NOT approved AND NOT an admin...
        if (profile && !profile.is_approved && !profile.is_admin) {
            alert("Your account is pending admin approval.");
            await supabase.auth.signOut(); // Log them out immediately
            window.location.href = '/sign-in.html';
            return;
        }

        // (Optional Safety) If for some reason the profile is missing entirely
        if (!profile) {
            console.warn("Profile missing. Database trigger might have delayed.");
            // We usually let them pass or ask them to re-login
        }

        // --- END OF CHECK ---

        // 3. Display User Info
        // We try to get the name from the Auth metadata first, then the Profile
        const userName = user.user_metadata?.full_name || profile?.full_name || "Weaver";
        
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
            welcomeMessage.classList.remove('hidden');
        }
        if (userNameMain) {
            userNameMain.textContent = `Welcome, ${userName}`;
        }

    } else {
        // 3. If no user is logged in, redirect to the sign-in page
        window.location.href = '/sign-in.html';
        return;
    }

    // 4. Set up the logout functionality
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error logging out:', error);
            } else {
                window.location.href = '/index.html';
            }
        });
    }
});