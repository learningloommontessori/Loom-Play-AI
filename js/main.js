<<<<<<< HEAD
// js/main.js

const SUPABASE_URL = 'https://ioafdumlvvrhofmtngpa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYWZkdW1sdnZyaG9mbXRuZ3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5OTgzMzUsImV4cCI6MjA3MzU3NDMzNX0.7j94j6nJeGwUBKl2S0LUzQ15nW6cCA_NNnF7ZRTRGc0';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- User Authentication Logic ---

// Example: Handling a Sign Up Form
const signUpForm = document.querySelector('#signUpForm'); // Make sure your sign-up form has this ID
if (signUpForm) {
    signUpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const password = event.target.password.value;

        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            alert('Error signing up: ' + error.message);
        } else {
            alert('Sign up successful! Please check your email to verify your account.');
            // Redirect to a "check your email" page or the login page
            window.location.href = '/Sign In.html';
        }
    });
}

// Example: Handling a Sign In Form
const signInForm = document.querySelector('#signInForm'); // Make sure your sign-in form has this ID
if (signInForm) {
    signInForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const password = event.target.password.value;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            alert('Error signing in: ' + error.message);
        } else {
            // Redirect to the main dashboard after successful login
            window.location.href = '/Dashboard.html';
        }
    });
}

// Example: Handling a Logout Button
const logoutButton = document.querySelector('#logoutButton'); // Give your logout button this ID
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        // Redirect to the landing page after logout
        window.location.href = '/';
    });
}

// --- AI Generator Logic ---

// Example: Handling the "Generate" form on your Dashboard/New Chat page
const generatorForm = document.querySelector('#generatorForm'); // Give your generator form this ID
if (generatorForm) {
    generatorForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Get the user's session and security token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('You must be logged in to generate content.');
            return;
        }

        const topic = event.target.topic.value; // Make sure your topic input has name="topic"
        const generateButton = event.target.querySelector('button');

        // Show a loading state
        generateButton.disabled = true;
        generateButton.textContent = 'Weaving...';

        try {
            // Call your Vercel backend function
            const response = await fetch('/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ topic: topic })
            });

            if (!response.ok) {
                throw new Error('Failed to generate content.');
            }

            const result = await response.json();

            // Save the result to the browser's local storage to pass it to the next page
            localStorage.setItem('generatedResult', JSON.stringify(result));

            // Redirect to the results page
            window.location.href = '/Generation Page.html';

        } catch (error) {
            alert('An error occurred: ' + error.message);
            generateButton.disabled = false;
            generateButton.textContent = 'Generate';
        }
    });
}

// --- Displaying Results on the Generation Page ---

// This code should run on your Generation Page.html
// We check the URL to see if we are on the right page.
if (window.location.pathname.includes('Generation Page.html')) {
    const result = JSON.parse(localStorage.getItem('generatedResult'));

    if (result) {
        // Now, you would write code to populate your 7 tabs with the data
        // from result.lessonPlan and set the image source from result.imageUrl
        console.log('Displaying result:', result);

        // Example for one field:
        const topicTitle = document.querySelector('#topicTitle'); // Add id="topicTitle" to your H3 element
        if (topicTitle) {
            topicTitle.textContent = result.lessonPlan.topic;
        }

        const storyContent = document.querySelector('#storyContent'); // Add id="storyContent" to the div for the story
        if (storyContent) {
            storyContent.innerHTML = `<p>${result.lessonPlan.tabs.storyAndRhyme.learningStory}</p>`;
        }
        
        const mainImage = document.querySelector('#mainImage'); // Add id="mainImage" to your img tag
        if (mainImage) {
            mainImage.src = result.imageUrl;
        }

        // ... and so on for all the other tabs and content.
    }
=======
// js/main.js

const SUPABASE_URL = 'https://ioafdumlvvrhofmtngpa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYWZkdW1sdnZyaG9mbXRuZ3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5OTgzMzUsImV4cCI6MjA3MzU3NDMzNX0.7j94j6nJeGwUBKl2S0LUzQ15nW6cCA_NNnF7ZRTRGc0';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- User Authentication Logic ---

// Example: Handling a Sign Up Form
const signUpForm = document.querySelector('#signUpForm'); // Make sure your sign-up form has this ID
if (signUpForm) {
    signUpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const password = event.target.password.value;

        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            alert('Error signing up: ' + error.message);
        } else {
            alert('Sign up successful! Please check your email to verify your account.');
            // Redirect to a "check your email" page or the login page
            window.location.href = '/Sign In.html';
        }
    });
}

// Example: Handling a Sign In Form
const signInForm = document.querySelector('#signInForm'); // Make sure your sign-in form has this ID
if (signInForm) {
    signInForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = event.target.email.value;
        const password = event.target.password.value;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            alert('Error signing in: ' + error.message);
        } else {
            // Redirect to the main dashboard after successful login
            window.location.href = '/Dashboard.html';
        }
    });
}

// Example: Handling a Logout Button
const logoutButton = document.querySelector('#logoutButton'); // Give your logout button this ID
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        // Redirect to the landing page after logout
        window.location.href = '/';
    });
}

// --- AI Generator Logic ---

// Example: Handling the "Generate" form on your Dashboard/New Chat page
const generatorForm = document.querySelector('#generatorForm'); // Give your generator form this ID
if (generatorForm) {
    generatorForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Get the user's session and security token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('You must be logged in to generate content.');
            return;
        }

        const topic = event.target.topic.value; // Make sure your topic input has name="topic"
        const generateButton = event.target.querySelector('button');

        // Show a loading state
        generateButton.disabled = true;
        generateButton.textContent = 'Weaving...';

        try {
            // Call your Vercel backend function
            const response = await fetch('/api/server', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ topic: topic })
            });

            if (!response.ok) {
                throw new Error('Failed to generate content.');
            }

            const result = await response.json();

            // Save the result to the browser's local storage to pass it to the next page
            localStorage.setItem('generatedResult', JSON.stringify(result));

            // Redirect to the results page
            window.location.href = '/Generation Page.html';

        } catch (error) {
            alert('An error occurred: ' + error.message);
            generateButton.disabled = false;
            generateButton.textContent = 'Generate';
        }
    });
}

// --- Displaying Results on the Generation Page ---

// This code should run on your Generation Page.html
// We check the URL to see if we are on the right page.
if (window.location.pathname.includes('Generation Page.html')) {
    const result = JSON.parse(localStorage.getItem('generatedResult'));

    if (result) {
        // Now, you would write code to populate your 7 tabs with the data
        // from result.lessonPlan and set the image source from result.imageUrl
        console.log('Displaying result:', result);

        // Example for one field:
        const topicTitle = document.querySelector('#topicTitle'); // Add id="topicTitle" to your H3 element
        if (topicTitle) {
            topicTitle.textContent = result.lessonPlan.topic;
        }

        const storyContent = document.querySelector('#storyContent'); // Add id="storyContent" to the div for the story
        if (storyContent) {
            storyContent.innerHTML = `<p>${result.lessonPlan.tabs.storyAndRhyme.learningStory}</p>`;
        }
        
        const mainImage = document.querySelector('#mainImage'); // Add id="mainImage" to your img tag
        if (mainImage) {
            mainImage.src = result.imageUrl;
        }

        // ... and so on for all the other tabs and content.
    }
>>>>>>> b6d6e5e868a9976745a2e992b94117e837f71788
}