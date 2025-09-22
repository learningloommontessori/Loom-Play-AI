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
        // 2. If a user is found, display their information
        const userName = user.user_metadata?.full_name;
        
        if (welcomeMessage) {
            // Display first name in the header
            welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
            welcomeMessage.classList.remove('hidden');
        }
        if (userNameMain) {
            // Display full name in the main body
            userNameMain.textContent = `Welcome, ${userName}`;
        }
    } else {
        // 3. If no user is logged in, redirect to the sign-in page
        window.location.href = '/sign-in.html';
        return; // Stop the rest of the script from running
    }

    // 4. Set up the logout functionality
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error logging out:', error);
            } else {
                // Redirect to the home page after successful logout
                window.location.href = '/index.html';
            }
        });
    }
});

