import getSupabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // Elements
    const welcomeMessage = document.getElementById('welcome-message');
    const userNameMain = document.getElementById('user-name-main');
    const logoutButton = document.getElementById('logoutButton');

    // 1. Protect the page and get user data
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        // 2. Display the user's name
        const userName = user.user_metadata?.full_name || user.email;
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`; // Show first name
            welcomeMessage.classList.remove('hidden');
        }
        if (userNameMain) {
            userNameMain.textContent = `Welcome, ${userName}`; // Show full name
        }
    } else {
        // If no user is logged in, redirect to the Sign In page
        window.location.href = '/sign-in.html';
        return; // Stop executing the rest of the script
    }

    // 3. Handle Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error logging out:', error);
            } else {
                // Redirect to the homepage after successful logout
                window.location.href = '/index.html';
            }
        });
    }
});

