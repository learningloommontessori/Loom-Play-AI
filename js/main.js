// This script now ONLY handles authentication logic after the page is interactive.
import getSupabase from './supabaseClient.js';

/**
 * Initializes the Supabase client and sets up all authentication-related logic.
 */
async function initializeAuth() {
    // --- COMMON AUTH FUNCTIONS ---
    function hideAllMessages() {
        document.getElementById('error-message')?.classList.add('hidden');
        document.getElementById('success-message')?.classList.add('hidden');
    }
    function showErrorMessage(message) {
        hideAllMessages();
        const errorContainer = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        if (errorContainer && errorText) {
            errorText.textContent = message;
            errorContainer.classList.remove('hidden');
        } else {
            console.error("Error display elements not found.");
        }
    }
    function showSuccessMessage(message) {
        hideAllMessages();
        const successContainer = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        if (successContainer && successText) {
            successText.textContent = message;
            successContainer.classList.remove('hidden');
        }
    }

    // --- INITIALIZATION ---
    const supabase = await getSupabase();
    if (!supabase) {
        showErrorMessage('Could not connect to authentication service. Please check your connection or contact support.');
        document.querySelectorAll('form').forEach(form => {
            [...form.elements].forEach(el => el.disabled = true);
        });
        document.getElementById('google-signin-btn')?.setAttribute('disabled', 'true');
        return;
    }
    console.log('Supabase client initialized.');

    // --- GOOGLE OAUTH ---
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({ 
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard.html`
                }
            });
            if (error) {
                showErrorMessage('Could not sign in with Google. Please try again.');
            }
        });
    }

    // --- SIGN IN FORM SUBMISSION ---
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitButton = signInForm.querySelector('button[type="submit"]');
            const buttonText = submitButton.querySelector('.button-text');
            const buttonSpinner = submitButton.querySelector('.button-spinner');

            submitButton.disabled = true;
            buttonText.classList.add('hidden');
            buttonSpinner.classList.remove('hidden');
            hideAllMessages();

            const { error } = await supabase.auth.signInWithPassword({ email, password });

            submitButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonSpinner.classList.add('hidden');

            if (error) {
                showErrorMessage(error.message);
            } else {
                window.location.href = '/dashboard.html';
            }
        });
    }

    // --- SIGN UP FORM SUBMISSION ---
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const fullName = document.getElementById('full-name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const termsCheckbox = document.getElementById('terms');
            const submitButton = document.getElementById('submit-btn');
            const buttonText = submitButton.querySelector('.button-text');
            const buttonSpinner = submitButton.querySelector('.button-spinner');
            
            hideAllMessages();

            if (password !== confirmPassword) {
                showErrorMessage("Passwords do not match. Please try again.");
                return;
            }

            submitButton.disabled = true;
            buttonText.classList.add('hidden');
            buttonSpinner.classList.remove('hidden');

            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: { 
                    data: { full_name: fullName },
                    emailRedirectTo: `${window.location.origin}/dashboard.html`
                }
            });

            buttonText.classList.remove('hidden');
            buttonSpinner.classList.add('hidden');
            submitButton.disabled = !termsCheckbox.checked;

            if (error) {
                showErrorMessage(error.message);
            } else {
                showSuccessMessage('Success! Please check your email for a confirmation link.');
                signUpForm.reset();
                submitButton.disabled = true; 
            }
        });
    }
}

// --- SCRIPT EXECUTION ---
document.addEventListener('DOMContentLoaded', () => {
    // This check ensures that we don't try to redirect from the dashboard to itself.
    if (!window.location.pathname.includes('/dashboard.html')) {
        // We need to check for an existing session on non-dashboard pages to auto-login users.
        getSupabase().then(supabase => {
            if (supabase) {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                        window.location.href = '/dashboard.html';
                    } else {
                        initializeAuth();
                    }
                });
            }
        });
    } else {
        // On the dashboard, just initialize auth features (like logout) without redirecting.
        initializeAuth();
    }
});

