// This single script handles authentication for both Sign In and Sign Up pages.
document.addEventListener('DOMContentLoaded', () => {

    // --- SUPABASE INITIALIZATION ---
    // Make sure to replace these with your actual Supabase URL and Key
    import supabase from './supabaseClient.js';

    console.log('Supabase client initialized.');


    /**
     * Hides all feedback messages on the page.
     */
    function hideAllMessages() {
        document.getElementById('error-message')?.classList.add('hidden');
        document.getElementById('success-message')?.classList.add('hidden');
    }

    /**
     * Shows an error message on the form.
     * @param {string} message - The error message to display.
     */
    function showErrorMessage(message) {
        hideAllMessages();
        const errorContainer = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        if (errorContainer && errorText) {
            errorText.textContent = message;
            errorContainer.classList.remove('hidden');
        }
    }

    /**
     * Shows a success message on the form (for signup).
     */
    function showSuccessMessage() {
        hideAllMessages();
        const successContainer = document.getElementById('success-message');
        if (successContainer) {
            successContainer.classList.remove('hidden');
        }
    }

    /**
     * Handles Google Sign In for both pages.
     */
    async function handleGoogleSignIn() {
        const { error } = await _supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) {
            showErrorMessage('Could not sign in with Google. Please try again.');
        }
    }
    
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if(googleSignInBtn) {
        googleSignInBtn.addEventListener('click', handleGoogleSignIn);
    }


    // --- SIGN IN PAGE LOGIC ---
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            document.getElementById('email').value = rememberedEmail;
            document.getElementById('remember-me').checked = true;
        }

        signInForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            
            const submitButton = signInForm.querySelector('button[type="submit"]');
            const buttonText = submitButton.querySelector('.button-text');
            const buttonSpinner = submitButton.querySelector('.button-spinner');

            // Show loading state
            submitButton.disabled = true;
            buttonText.classList.add('hidden');
            buttonSpinner.classList.remove('hidden');
            hideAllMessages();

            const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

            // Hide loading state
            submitButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonSpinner.classList.add('hidden');

            if (error) {
                showErrorMessage(error.message);
            } else {
                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }
                window.location.href = '/Dashboard.html';
            }
        });
    }


    // --- SIGN UP PAGE LOGIC ---
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
                case 1:
                    strengthLabel = 'Weak';
                    strengthBar.style.width = '33%';
                    strengthBar.className = 'h-2 rounded-full bg-red-500 transition-all duration-300';
                    break;
                case 2:
                    strengthLabel = 'Medium';
                    strengthBar.style.width = '66%';
                    strengthBar.className = 'h-2 rounded-full bg-yellow-500 transition-all duration-300';
                    break;
                case 3:
                    strengthLabel = 'Strong';
                    strengthBar.style.width = '100%';
                    strengthBar.className = 'h-2 rounded-full bg-green-500 transition-all duration-300';
                    break;
                default:
                    strengthLabel = '';
                    strengthBar.style.width = '0%';
                    strengthBar.className = 'h-2 rounded-full transition-all duration-300';
                    break;
            }
            strengthText.textContent = strengthLabel;
            strengthText.className = `text-xs font-medium ${score === 1 ? 'text-red-400' : score === 2 ? 'text-yellow-400' : score === 3 ? 'text-green-400' : 'text-gray-400'}`;
        });
        
        // Password confirmation validation logic
        const validatePasswords = () => {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const originalBorderClasses = 'border-gray-600 focus:ring-purple-500';
            const successBorderClasses = 'border-green-500 focus:ring-green-500';
            const errorBorderClasses = 'border-red-500 focus:ring-red-500';

            if (confirmPassword.length === 0) {
                passwordMatchIcon.classList.add('hidden');
                passwordMatchText.classList.add('hidden');
                confirmPasswordInput.className = confirmPasswordInput.className.replace(new RegExp(`${successBorderClasses}|${errorBorderClasses}`, 'g'), originalBorderClasses);
                return;
            }

            if (password === confirmPassword) {
                passwordMatchIcon.textContent = 'check_circle';
                passwordMatchIcon.className = 'material-symbols-outlined absolute inset-y-0 right-0 pr-3 flex items-center text-green-500';
                passwordMatchText.textContent = 'Passwords match!';
                passwordMatchText.className = 'mt-2 text-xs text-green-400';
                confirmPasswordInput.className = confirmPasswordInput.className.replace(new RegExp(`${originalBorderClasses}|${errorBorderClasses}`, 'g'), successBorderClasses);
            } else {
                passwordMatchIcon.textContent = 'cancel';
                passwordMatchIcon.className = 'material-symbols-outlined absolute inset-y-0 right-0 pr-3 flex items-center text-red-500';
                passwordMatchText.textContent = 'Passwords do not match.';
                passwordMatchText.className = 'mt-2 text-xs text-red-400';
                confirmPasswordInput.className = confirmPasswordInput.className.replace(new RegExp(`${originalBorderClasses}|${successBorderClasses}`, 'g'), errorBorderClasses);
            }
        };

        passwordInput.addEventListener('input', validatePasswords);
        confirmPasswordInput.addEventListener('input', validatePasswords);

        // Terms and Conditions Checkbox Logic
        termsCheckbox.addEventListener('input', () => {
            submitButton.disabled = !termsCheckbox.checked;
        });

        // Tooltip logic for disabled button
        submitWrapper.addEventListener('mouseover', () => {
            if (submitButton.disabled) {
                tooltip.classList.remove('hidden');
            }
        });
        submitWrapper.addEventListener('mouseout', () => {
            tooltip.classList.add('hidden');
        });

        // Submit logic
        signUpForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const fullName = document.getElementById('full-name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const buttonText = submitButton.querySelector('.button-text');
            const buttonSpinner = submitButton.querySelector('.button-spinner');
            
            hideAllMessages();

            if (password !== confirmPassword) {
                showErrorMessage("Passwords do not match. Please try again.");
                return;
            }

            // Show loading state
            submitButton.disabled = true;
            buttonText.classList.add('hidden');
            buttonSpinner.classList.remove('hidden');

            const { data, error } = await _supabase.auth.signUp({
                email: email,
                password: password,
                options: { data: { full_name: fullName } }
            });

            // Hide loading state and re-enable button if there was no error
            // If there was an error, the terms box may need to be re-checked to re-enable
            submitButton.disabled = !termsCheckbox.checked;
            buttonText.classList.remove('hidden');
            buttonSpinner.classList.add('hidden');

            if (error) {
                showErrorMessage(error.message);
            } else {
                showSuccessMessage();
                signUpForm.reset();
                // After successful sign up, the button should be disabled again
                submitButton.disabled = true; 
            }
        });
    }
});

