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
        // --- NEW: SELF-REPAIR & APPROVAL SYSTEM ---
        
        // A. Try to find the user's profile
        let { data: profile } = await supabase
            .from('profiles')
            .select('is_approved, is_admin')
            .eq('id', user.id)
            .single();

        // B. If profile is MISSING (because we killed the trigger), create it now!
        if (!profile) {
            console.log("Profile missing. Creating manual profile...");
            const { error: insertError } = await supabase
                .from('profiles')
                .insert([{
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || 'New Weaver',
                    is_approved: false, // Default to Pending
                    is_admin: false
                }]);
            
            if (insertError) {
                console.error("Manual profile creation failed:", insertError);
                alert("Error setting up profile. Please contact support.");
                await supabase.auth.signOut();
                window.location.href = '/sign-in.html';
                return;
            }

            // After inserting, we treat them as "Pending" immediately
            alert("Account created successfully! Your thread is now waiting for Admin Approval.");
            await supabase.auth.signOut();
            window.location.href = '/sign-in.html';
            return;
        }

        // C. If profile exists but is NOT Approved (and NOT Admin)
        if (!profile.is_approved && !profile.is_admin) {
            alert("Your account is pending admin approval.");
            await supabase.auth.signOut();
            window.location.href = '/sign-in.html';
            return;
        }

        // --- END OF APPROVAL CHECK ---

        // 2. If approved, display their information
        const userName = user.user_metadata?.full_name;
        
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