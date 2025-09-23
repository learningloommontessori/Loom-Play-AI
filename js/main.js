import getSupabase from './supabaseClient.js';

// --- Helper Functions ---
function showMessage(type, text) {
    const errorContainer = document.getElementById('error-message');
    const successContainer = document.getElementById('success-message');
    const errorText = document.getElementById('error-text');
    const successText = document.getElementById('success-text');

    // Hide both initially
    if(errorContainer) errorContainer.classList.add('hidden');
    if(successContainer) successContainer.classList.add('hidden');

    if (type === 'error' && errorContainer && errorText) {
        errorText.textContent = text;
        errorContainer.classList.remove('hidden');
    } else if (type === 'success' && successContainer && successText) {
        successText.textContent = text;
        successContainer.classList.remove('hidden');
    }
}

function setLoadingState(form, isLoading) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const buttonText = submitButton.querySelector('.button-text');
    const spinner = submitButton.querySelector('.button-spinner');

    submitButton.disabled = isLoading;
    if (buttonText) buttonText.classList.toggle('hidden', isLoading);
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
}


// --- Main Authentication Logic ---
async function handlePageAuth() {
    const supabase = await getSupabase();
    if (!supabase) {
        showMessage('error', 'Failed to connect to authentication service.');
        return;
    }

    // --- Page Protection & Redirection ---
    // If a user is already logged in and lands on an auth page, send them to the dashboard.
    const { data: { session } } = await supabase.auth.getSession();
    const isAuthPage = window.location.pathname.includes('/sign-in.html') || window.location.pathname.includes('/sign-up.html');

    if (session && isAuthPage) {
        window.location.replace('/dashboard.html');
        return;
    }

    // --- Event Listeners ---
    // Located inside the handlePageAuth function in main.js

const googleSignInBtn = document.getElementById('google-signin-btn');
if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/dashboard.html` }
        });

        // This code will run if an immediate error occurs.
        // For OAuth, the more common error is handled on the redirect page,
        // but this is good practice.
        if (error) {
            const customErrorMessage = "This app is only available for Choithram School for now. Please register with your school ID.";
            // Check for the specific error related to a blocked user
            if (error.message.includes('Access denied') || error.message.includes('User not allowed')) {
                 showMessage('error', customErrorMessage);
            } else {
                 showMessage('error', 'Google Sign-In failed: ' + error.message);
            }
        }
    });

    // --- NEW: Handle errors after the user is redirected back from Google ---
    // This code checks the URL for an error when the page loads
    const urlParams = new URLSearchParams(window.location.hash.substring(1)); // Use hash for OAuth redirect
    const errorDescription = urlParams.get('error_description');

    if (errorDescription) {
        const customErrorMessage = "This app is only available for Choithram School for now. Please register with your school ID.";
        // Supabase often puts the "Database error saving new user" message here for allowlist failures
        if (errorDescription.includes('Database error saving new user')) {
            showMessage('error', customErrorMessage);
        } else {
            showMessage('error', errorDescription);
        }
    }
}

    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoadingState(signInForm, true);
            const email = signInForm.email.value;
            const password = signInForm.password.value;
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                showMessage('error', error.message);
                setLoadingState(signInForm, false);
            } else {
                window.location.replace('/dashboard.html');
            }
        });
    }

    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = signUpForm.email.value;
            const password = signUpForm.password.value;
            const fullName = signUpForm['full-name'].value;

            // --- 1. CLIENT-SIDE VALIDATION (NEW) ---
            const isEmailAllowed = (email) => {
                const allowedDomain = '@choithramschool.com';
                const specialAccount = 'learningloom.montessori@gmail.com';
                return email.endsWith(allowedDomain) || email === specialAccount;
            };

            if (!isEmailAllowed(email)) {
                // Show custom error message immediately without contacting Supabase
                const customErrorMessage = "This app is only available for Choithram School for now. Please register with your school ID.";
                showMessage('error', customErrorMessage);
                return; // Stop the form submission
            }
            // --- END OF CLIENT-SIDE VALIDATION ---

            setLoadingState(signUpForm, true);

            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName },
                    emailRedirectTo: `${window.location.origin}/dashboard.html`
                }
            });

            if (error) {
                // --- 2. INTERPRET SERVER-SIDE ERROR (UPDATED) ---
                const genericDbError = 'Database error saving new user';
                const customErrorMessage = "This app is only available for Choithram School for now. Please register with your school ID.";

                if (error.message.includes(genericDbError)) {
                    // If Supabase returns the generic error, show our custom message
                    showMessage('error', customErrorMessage);
                } else {
                    // For any other errors (e.g., "Password should be at least 6 characters"), show the original Supabase message
                    showMessage('error', error.message);
                }
                // --- END OF ERROR INTERPRETATION ---
            } else {
                showMessage('success', 'Please check your email for a verification link.');
                signUpForm.reset();
                 // Disable button after successful submission until terms are re-checked
                const submitButton = signUpForm.querySelector('button[type="submit"]');
                if(submitButton) submitButton.disabled = true;
            }
            setLoadingState(signUpForm, false);
        });
    }
}

// --- Run the authentication logic ---
// We don't need to wrap this in DOMContentLoaded because the main.js script
// is loaded with `type="module"` at the end of the body, so the DOM is already available.
handlePageAuth();

