// This single script handles authentication for both Sign In and Sign Up pages.
import getSupabase from './supabaseClient.js';

/**
 * Sets up all UI-related event listeners that do NOT require an active Supabase client.
 * This ensures the page is interactive immediately on load.
 */
function setupUIListeners() {
    // --- SIGN IN PAGE UI LOGIC ---
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        // Pre-fill email if it was remembered
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            document.getElementById('email').value = rememberedEmail;
            document.getElementById('remember-me').checked = true;
        }
    }

    // --- SIGN UP PAGE UI LOGIC ---
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const passwordMatchIcon = document.getElementById('password-match-icon');
        const passwordMatchText = document.getElementById('password-match-text');
        const strengthBar = document.getElementById('password-strength-bar');
        const strengthText = document.getElementById('password-strength-text');
        const lengthCheck = document.getElementById('length-check');
        const caseCheck = document.getElementById('case-check');
        const numberCheck = document.getElementById('number-check');
        const termsCheckbox = document.getElementById('terms');
        const submitButton = document.getElementById('submit-btn');
        const submitWrapper = document.getElementById('submit-wrapper');
        const tooltip = document.getElementById('tooltip');

        // Password strength checker logic
        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            let score = 0;
            let strengthLabel = '';

            const hasLength = password.length >= 8;
            const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
            const hasNumberOrSymbol = /[\d\W]/.test(password);

            lengthCheck.innerHTML = hasLength ? '✓ At least 8 characters' : 'At least 8 characters';
            lengthCheck.className = hasLength ? 'text-green-400' : 'text-gray-400';
            
            caseCheck.innerHTML = hasMixedCase ? '✓ Mix of uppercase & lowercase' : 'Mix of uppercase & lowercase';
            caseCheck.className = hasMixedCase ? 'text-green-400' : 'text-gray-400';

            numberCheck.innerHTML = hasNumberOrSymbol ? '✓ At least one number or symbol' : 'At least one number or symbol';
            numberCheck.className = hasNumberOrSymbol ? 'text-green-400' : 'text-gray-400';

            if (hasLength) score++;
            if (hasMixedCase) score++;
            if (hasNumberOrSymbol) score++;

            switch (score) {
                case 1: strengthLabel = 'Weak'; strengthBar.style.width = '33%'; strengthBar.className = 'h-2 rounded-full bg-red-500 transition-all duration-300'; break;
                case 2: strengthLabel = 'Medium'; strengthBar.style.width = '66%'; strengthBar.className = 'h-2 rounded-full bg-yellow-500 transition-all duration-300'; break;
                case 3: strengthLabel = 'Strong'; strengthBar.style.width = '100%'; strengthBar.className = 'h-2 rounded-full bg-green-500 transition-all duration-300'; break;
                default: strengthLabel = ''; strengthBar.style.width = '0%'; strengthBar.className = 'h-2 rounded-full transition-all duration-300'; break;
            }
            strengthText.textContent = strengthLabel;
            strengthText.className = `text-xs font-medium ${score === 1 ? 'text-red-400' : score === 2 ? 'text-yellow-400' : score === 3 ? 'text-green-400' : 'text-gray-400'}`;
        });
        
        // Password confirmation validation logic
        const validatePasswords = () => {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const successBorderClasses = 'border-green-500 focus:ring-green-500';
            const errorBorderClasses = 'border-red-500 focus:ring-red-500';

            if (confirmPassword.length === 0) {
                passwordMatchIcon.classList.add('hidden');
                passwordMatchText.classList.add('hidden');
                confirmPasswordInput.classList.remove(...successBorderClasses.split(' '), ...errorBorderClasses.split(' '));
                return;
            }
            
            if (password === confirmPassword) {
                passwordMatchIcon.textContent = 'check_circle';
                passwordMatchIcon.classList.remove('text-red-500', 'hidden');
                passwordMatchIcon.classList.add('text-green-500');
                passwordMatchText.textContent = 'Passwords match!';
                passwordMatchText.classList.remove('text-red-400', 'hidden');
                passwordMatchText.classList.add('text-green-400');
                confirmPasswordInput.classList.remove(...errorBorderClasses.split(' '));
                confirmPasswordInput.classList.add(...successBorderClasses.split(' '));
            } else {
                passwordMatchIcon.textContent = 'cancel';
                passwordMatchIcon.classList.remove('text-green-500', 'hidden');
                passwordMatchIcon.classList.add('text-red-500');
                passwordMatchText.textContent = 'Passwords do not match.';
                passwordMatchText.classList.remove('text-green-400', 'hidden');
                passwordMatchText.classList.add('text-red-400');
                confirmPasswordInput.classList.remove(...successBorderClasses.split(' '));
                confirmPasswordInput.classList.add(...errorBorderClasses.split(' '));
            }
        };

        passwordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);

        // Terms and Conditions Checkbox Logic
        termsCheckbox.addEventListener('input', () => {
            submitButton.disabled = !termsCheckbox.checked;
        });

        // Tooltip logic for disabled button
        submitWrapper.addEventListener('mouseover', () => { if (submitButton.disabled) tooltip.classList.remove('hidden'); });
        submitWrapper.addEventListener('mouseout', () => { tooltip.classList.add('hidden'); });
    }
}

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
        // Disable all form inputs and buttons to prevent user interaction if Supabase fails
        document.querySelectorAll('form').forEach(form => {
            [...form.elements].forEach(el => el.disabled = true);
        });
        document.getElementById('google-signin-btn')?.setAttribute('disabled', true);
        return;
    }
    console.log('Supabase client initialized.');

    // Redirect authenticated users to the dashboard.
    const { data: { session } } = await supabase.auth.getSession();
    if (session && !window.location.pathname.includes('/Dashboard.html')) {
        window.location.href = '/Dashboard.html';
        return;
    }

    // --- GOOGLE OAUTH ---
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
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
            const rememberMe = document.getElementById('remember-me').checked;
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
                if (rememberMe) localStorage.setItem('rememberedEmail', email);
                else localStorage.removeItem('rememberedEmail');
                window.location.href = '/Dashboard.html';
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
                options: { data: { full_name: fullName } }
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
    setupUIListeners();
    initializeAuth();
});

