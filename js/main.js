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
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/dashboard.html` }
            });
            if (error) showMessage('error', 'Google Sign-In failed: ' + error.message);
        });
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
            setLoadingState(signUpForm, true);
            const fullName = signUpForm['full-name'].value;
            const email = signUpForm.email.value;
            const password = signUpForm.password.value;

            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName },
                    emailRedirectTo: `${window.location.origin}/dashboard.html`
                }
            });

            if (error) {
                showMessage('error', error.message);
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

