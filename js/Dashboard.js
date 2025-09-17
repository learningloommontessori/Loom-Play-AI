    // --- SUPABASE INITIALIZATION ---
import supabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Supabase client initialized for dashboard page.');

    // --- DOM ELEMENTS ---
    const userNameHeader = document.getElementById('user-name-header');
    const userNameMain = document.getElementById('user-name-main');
    const logoutBtn = document.getElementById('logout-btn');


    /**
     * Checks user authentication state and updates UI.
     * Redirects to sign-in page if user is not logged in.
     */
    const checkUser = async () => {
        const { data: { session } } = await _supabase.auth.getSession();

        if (!session) {
            // If no user is logged in, redirect to the sign-in page
            window.location.href = '/Sign In.html';
        } else {
            // If a user is logged in, display their name
            const user = session.user;
            // Use the full name from sign-up, otherwise default to the email
            const displayName = user.user_metadata?.full_name || user.email;
            
            if (userNameHeader) {
                userNameHeader.textContent = `Welcome, ${displayName}!`;
            }
            if (userNameMain) {
                userNameMain.textContent = `Welcome, ${displayName}`;
            }
        }
    };

    /**
     * Handles user logout.
     */
    const handleLogout = async () => {
        const { error } = await _supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error);
        } else {
            // Redirect to the landing page after successful logout
            window.location.href = '/index.html';
        }
    };

    // --- EVENT LISTENERS ---
    
    // Check user status as soon as the page loads
    checkUser();

    // Attach the logout function to the logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

