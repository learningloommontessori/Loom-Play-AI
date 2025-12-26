import getSupabase from './supabaseClient.js';

// ** ADMIN CONFIGURATION **
const ADMIN_EMAILS = [
    "monika.pathak@choithramschool.com",
    "second.admin@school.com", // Add your 2nd admin email here
    "third.admin@school.com"   // Add your 3rd admin email here
];

// --- Helper Functions ---
function showMessage(type, text) {
    const errorContainer = document.getElementById('error-message');
    const successContainer = document.getElementById('success-message');
    const errorText = document.getElementById('error-text');
    const successText = document.getElementById('success-text');

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

    // --- 1. GLOBAL GATEKEEPER CHECK (Runs on page load) ---
    const { data: { session } } = await supabase.auth.getSession();
    const isAuthPage = window.location.pathname.includes('/sign-in.html') || window.location.pathname.includes('/sign-up.html');

    if (session) {
        // User is logged in, check if they are approved
        const userEmail = session.user.email;
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_approved')
            .eq('id', session.user.id)
            .single();

        const isAdmin = ADMIN_EMAILS.includes(userEmail);
        const isApproved = profile && profile.is_approved;

        if (!isAdmin && !isApproved) {
            // LOGGED IN BUT NOT APPROVED -> KICK OUT
            await supabase.auth.signOut();
            if (!isAuthPage) {
                alert("Access Denied: Your account is pending approval.");
                window.location.href = '/sign-in.html';
            }
        } else if (isAuthPage) {
            // LOGGED IN AND APPROVED -> GO TO DASHBOARD
            window.location.replace('/dashboard.html');
            return;
        }
    }

    // --- 2. GOOGLE SIGN IN ---
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

    // --- 3. MANUAL SIGN IN (With Gatekeeper) ---
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoadingState(signInForm, true);
            
            const email = signInForm.email.value;
            const password = signInForm.password.value;
            
            // A. Attempt Login
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
                showMessage('error', error.message);
                setLoadingState(signInForm, false);
                return;
            }

            // B. Gatekeeper Check
            const isAdmin = ADMIN_EMAILS.includes(email);
            
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_approved')
                .eq('id', data.user.id)
                .single();

            if (!isAdmin) {
                // If profile missing OR not approved
                if (profileError || !profile || !profile.is_approved) {
                    await supabase.auth.signOut(); // Kick out immediately
                    showMessage('error', 'Access Denied. Your account is pending Admin approval.');
                    setLoadingState(signInForm, false);
                    return;
                }
            }

            // C. Success
            window.location.replace('/dashboard.html');
        });
    }

    // --- 4. SIGN UP (Removed Watchdog, Added Profile Creation) ---
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = signUpForm.email.value;
            const password = signUpForm.password.value;
            const fullName = signUpForm['full-name'].value;

            setLoadingState(signUpForm, true);

            // A. Create Auth User
            const { data, error } = await supabase.auth.signUp({
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
                // B. Create Pending Profile in 'profiles' table
                if (data.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([{ 
                            id: data.user.id, 
                            email: email, 
                            full_name: fullName,
                            is_approved: false, // Pending by default
                            is_admin: false
                        }]);
                    
                    if(profileError) console.error("Profile creation error:", profileError);
                }

                showMessage('success', 'Account created! Please wait for Admin approval before logging in.');
                signUpForm.reset();
                const submitButton = signUpForm.querySelector('button[type="submit"]');
                if(submitButton) submitButton.disabled = true;
            }
            setLoadingState(signUpForm, false);
        });
    }
}

handlePageAuth();