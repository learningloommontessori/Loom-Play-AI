document.addEventListener('DOMContentLoaded', () => {

    // --- SUPABASE INITIALIZATION ---
    // Make sure to replace these with your actual Supabase project URL and Key
    import supabase from './supabaseClient.js';

    console.log('Supabase client initialized for new chat page.');

    const userNameHeader = document.getElementById('user-name-header');
    const logoutBtn = document.getElementById('logout-btn');
    const generatorForm = document.getElementById('generator-form');
    const errorMessageContainer = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    // --- UTILITY FUNCTIONS ---
    
    const showMessage = (message, isError = true) => {
        errorText.textContent = message;
        if (isError) {
            errorMessageContainer.classList.remove('hidden');
        } else {
             // You can create a success message style if needed
             errorMessageContainer.classList.remove('hidden');
        }
    };

    const hideMessage = () => {
        errorMessageContainer.classList.add('hidden');
    };


    /**
     * Checks user authentication state and updates UI.
     * Redirects to sign-in page if user is not logged in.
     */
    const checkUser = async () => {
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            window.location.href = '/sign-in.html';
        } else {
            const user = session.user;
            const fullName = user.user_metadata?.full_name || user.email;
            if (userNameHeader) {
                userNameHeader.textContent = `Welcome, ${fullName}!`;
            }
        }
    };

    /**
     * Handles user logout.
     */
    const handleLogout = async () => {
        await _supabase.auth.signOut();
        window.location.href = '/index.html';
    };

    /**
     * Handles the submission of the topic generation form.
     */
    const handleGeneratorSubmit = async (event) => {
        event.preventDefault();
        hideMessage(); // Hide previous errors
        
        const submitButton = generatorForm.querySelector('button[type="submit"]');
        const buttonTexts = submitButton.querySelectorAll('.button-text');
        const buttonSpinner = submitButton.querySelector('.button-spinner');

        const formData = new FormData(generatorForm);
        const topic = formData.get('topic').trim();
        
        if (!topic) {
            showMessage("Please enter a topic to continue.");
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        buttonTexts.forEach(t => t.classList.add('hidden'));
        buttonSpinner.classList.remove('hidden');

        try {
            // --- This is where you would call your AI backend ---
            // For now, we will simulate this by saving the topic and redirecting.
            console.log(`Simulating generation for topic:`, topic);
            
            // Save the user's topic to local storage
            localStorage.setItem('generationTopic', topic);

            // Simulate a short delay to show the spinner
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Redirect to the page that will display the results
            window.location.href = '/generation-page.html';

        } catch (error) {
            showMessage('An error occurred. Please try again.');
            console.error('Generation error:', error);
            
            // Hide loading state on error
            submitButton.disabled = false;
            buttonTexts.forEach(t => t.classList.remove('hidden'));
            buttonSpinner.classList.add('hidden');
        }
    };

    // --- EVENT LISTENERS ---
    checkUser();
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    if (generatorForm) {
        generatorForm.addEventListener('submit', handleGeneratorSubmit);
    }
});

