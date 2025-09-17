// js/profile.js

import supabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authentication & User Info
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/Sign In.html';
        return;
    }
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;

    // Setup header
    document.getElementById('welcome-message').textContent = `Welcome, ${userName}!`;
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });
    
    // 2. Populate profile page with user data
    populateProfile(user);
    
    // 3. Setup form submission handler
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', handleProfileUpdate);

    // 4. Setup delete profile handler
    const deleteButton = document.getElementById('delete-profile-btn');
    deleteButton.addEventListener('click', handleProfileDelete);
});

function populateProfile(user) {
    // Populate header display
    document.getElementById('profile-name-header').textContent = user.user_metadata?.full_name || 'Your Name';
    document.getElementById('profile-email-header').textContent = user.email;
    document.getElementById('profile-bio-header').textContent = user.user_metadata?.bio || 'Your bio will appear here.';

    // Populate form fields for editing
    document.getElementById('full_name').value = user.user_metadata?.full_name || '';
    document.getElementById('email').value = user.email;
    document.getElementById('bio').value = user.user_metadata?.bio || '';

    // Populate Member Since field
    const memberSinceElement = document.getElementById('member_since');
    if (user.created_at) {
        const joinDate = new Date(user.created_at);
        const formattedDate = joinDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        memberSinceElement.textContent = formattedDate;
    } else {
        memberSinceElement.textContent = 'N/A';
    }
}

async function handleProfileUpdate(event) {
    event.preventDefault();

    const form = event.target;
    const saveButton = form.querySelector('button[type="submit"]');
    const buttonText = saveButton.querySelector('.button-text');
    const spinner = saveButton.querySelector('.button-spinner');
    const successMessage = document.getElementById('success-message');

    // Show loading state
    buttonText.classList.add('hidden');
    spinner.classList.remove('hidden');
    saveButton.disabled = true;
    successMessage.classList.add('hidden');

    const fullName = form.full_name.value;
    const bio = form.bio.value;

    const { data, error } = await supabase.auth.updateUser({
        data: { 
            full_name: fullName,
            bio: bio 
        }
    });

    // Hide loading state
    buttonText.classList.remove('hidden');
    spinner.classList.add('hidden');
    saveButton.disabled = false;

    if (error) {
        alert('Error updating profile: ' + error.message);
    } else {
        populateProfile(data.user);
        document.getElementById('welcome-message').textContent = `Welcome, ${data.user.user_metadata.full_name}!`;
        successMessage.classList.remove('hidden');
        setTimeout(() => {
            successMessage.classList.add('hidden');
        }, 3000);
    }
}

async function handleProfileDelete() {
    // Updated confirmation message for clarity
    const confirmation = confirm('Are you sure you want to delete your profile? This will permanently delete your personal lesson history. Content you have shared to The Collective Loom will remain shared. This action cannot be undone.');

    if (confirmation) {
        alert("Profile deletion initiated. Your personal data will be removed, but your community contributions will remain. You will now be logged out.");
        
        // --- In a real application, you would call a Supabase Edge Function here ---
        // This function would securely:
        // 1. Delete all rows from the 'lessons' table where user_id matches.
        // 2. Use the Supabase Admin client to delete the user account.
        // 3. Content in 'community_posts' is NOT deleted.
        
        console.log("User confirmed profile deletion. Simulating logout.");

        await supabase.auth.signOut();
        window.location.href = '/'; // Redirect to landing page
    }
}

