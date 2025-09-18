// js/reset-password.js

import supabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check which page we are on and attach the correct event listeners.
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');

    if (forgotPasswordForm) {
        handleForgotPasswordPage(forgotPasswordForm);
    }

    if (resetPasswordForm) {
        handleResetPasswordPage(resetPasswordForm);
    }
});

// --- Logic for Forgot Password Page ---
function handleForgotPasswordPage(form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = form.email.value;
        const button = form.querySelector('button[type="submit"]');

        setLoading(button, true);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/Reset Password.html',
        });

        setLoading(button, false);

        if (error) {
            showError(error.message);
        } else {
            showSuccess('Password reset link has been sent to your email. Please check your inbox.');
        }
    });
}

// --- Logic for Reset Password Page ---
function handleResetPasswordPage(form) {
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    newPasswordInput.addEventListener('input', checkPasswordStrength);
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    newPasswordInput.addEventListener('input', checkPasswordMatch);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = form['new-password'].value;

        if (password !== form['confirm-password'].value) {
            showError('Passwords do not match.');
            return;
        }

        const button = form.querySelector('button[type="submit"]');
        setLoading(button, true);

        // Supabase handles the session from the URL token automatically
        const { error } = await supabase.auth.updateUser({ password });

        setLoading(button, false);

        if (error) {
            showError(error.message);
        } else {
            showSuccess('Your password has been reset successfully! You will be redirected to sign in shortly.');
            setTimeout(() => {
                window.location.href = '/Sign In.html';
            }, 4000);
        }
    });
}

// --- Shared UI Functions (Strength, Match, Messages, Loading) ---
function checkPasswordStrength() {
    const password = document.getElementById('new-password').value;
    const strengthText = document.getElementById('strength-text');
    const bars = [
        document.getElementById('strength-bar-1'),
        document.getElementById('strength-bar-2'),
        document.getElementById('strength-bar-3'),
        document.getElementById('strength-bar-4'),
    ];

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;

    const strengthMap = {
        0: { text: "Empty", color: "bg-gray-700", textColor: "text-gray-500" },
        1: { text: "Weak", color: "bg-red-500", textColor: "text-red-400" },
        2: { text: "Fair", color: "bg-yellow-500", textColor: "text-yellow-400" },
        3: { text: "Good", color: "bg-blue-500", textColor: "text-blue-400" },
        4: { text: "Strong", color: "bg-green-500", textColor: "text-green-400" },
    };

    strengthText.textContent = strengthMap[score].text;
    strengthText.className = `font-medium ${strengthMap[score].textColor}`;

    bars.forEach((bar, index) => {
        if (index < score) {
            bar.className = `h-1.5 flex-1 rounded-full ${strengthMap[score].color}`;
        } else {
            bar.className = `h-1.5 flex-1 rounded-full bg-gray-700`;
        }
    });
}

function checkPasswordMatch() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const indicator = document.getElementById('match-indicator');
    const confirmInput = document.getElementById('confirm-password');

    if (confirmPassword === '' && newPassword === '') {
        indicator.textContent = '';
        confirmInput.classList.remove('border-red-500', 'border-green-500', 'border-gray-600');
        return;
    }
    if (confirmPassword === '' && newPassword !== '') {
         indicator.textContent = '';
         confirmInput.classList.remove('border-red-500', 'border-green-500');
         return;
    }

    if (newPassword === confirmPassword) {
        indicator.textContent = 'check_circle';
        indicator.classList.remove('text-red-500');
        indicator.classList.add('text-green-500');
        confirmInput.classList.remove('border-red-500');
        confirmInput.classList.add('border-green-500');
    } else {
        indicator.textContent = 'cancel';
        indicator.classList.remove('text-green-500');
        indicator.classList.add('text-red-500');
        confirmInput.classList.remove('border-green-500');
        confirmInput.classList.add('border-red-500');
    }
}

function showError(message) {
    const errorContainer = document.getElementById('error-message');
    errorContainer.innerHTML = `<p class="text-sm font-medium text-red-300">${message}</p>`;
    errorContainer.classList.remove('hidden');
    document.getElementById('success-message').classList.add('hidden');
}

function showSuccess(message) {
    const successContainer = document.getElementById('success-message');
    successContainer.innerHTML = `<p class="text-sm font-medium text-green-300">${message}</p>`;
    successContainer.classList.remove('hidden');
    document.getElementById('error-message').classList.add('hidden');
}

function setLoading(button, isLoading) {
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.button-spinner');
    buttonText.classList.toggle('hidden', isLoading);
    spinner.classList.toggle('hidden', !isLoading);
    button.disabled = isLoading;
}
