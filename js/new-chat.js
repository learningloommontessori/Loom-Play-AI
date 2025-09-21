import getSupabase from './supabaseClient.js';

// --- Helper function to set the loading state on the submit button ---
function setLoadingState(form, isLoading) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const buttonTexts = submitButton.querySelectorAll('.button-text');
    const spinner = submitButton.querySelector('.button-spinner');

    submitButton.disabled = isLoading;
    buttonTexts.forEach(text => text.classList.toggle('hidden', isLoading));
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
}


// --- Main Page Logic ---
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // --- Page Elements ---
    const welcomeMessage = document.getElementById('welcome-message');
    const logoutButton = document.getElementById('logoutButton');
    const generatorForm = document.getElementById('generator-form');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // 1. Authenticate and Protect Page
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        // Personalize the header
        const userName = user.user_metadata?.full_name || user.email;
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
            welcomeMessage.classList.remove('hidden');
        }
    } else {
        // Redirect to sign-in if no user is found
        window.location.href = '/sign-in.html';
        return;
    }
    
    // 2. Set up Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/index.html';
        });
    }

    // 3. Handle Topic Form Submission
    if (generatorForm) {
        generatorForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            // Hide any previous errors
            if(errorMessage) errorMessage.classList.add('hidden');

            const topicInput = generatorForm.topic;
            const topic = topicInput.value.trim();

            if (!topic) {
                if(errorMessage && errorText) {
                    errorText.textContent = "Please enter a topic to continue.";
                    errorMessage.classList.remove('hidden');
                }
                return;
            }

            // Show loading spinner
            setLoadingState(generatorForm, true);

            // Store the topic in sessionStorage. This is better than localStorage
            // as it automatically clears when the browser tab is closed.
            sessionStorage.setItem('currentTopic', topic);

            // Redirect to the generation page after a short delay to show the spinner
            setTimeout(() => {
                window.location.href = '/generation-page.html';
            }, 500);
        });
    }
});
