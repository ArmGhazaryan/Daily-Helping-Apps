// DOM Elements
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authMessage = document.getElementById('auth-message');

// Tab Swapping Logic
tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    authMessage.textContent = '';
});

tabSignup?.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    authMessage.textContent = '';
});

// 🟢 Sign Up Logic
signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    authMessage.style.color = '#3b82f6';
    authMessage.textContent = 'Creating account...';

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { username: username }
        }
    });

    if (error) {
        authMessage.style.color = '#ef4444';
        authMessage.textContent = error.message;
    } else {
        authMessage.style.color = '#10b981';
        authMessage.textContent = 'Success! Check your email or login.';
        signupForm.reset();
    }
});

// 🟢 Login Logic
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    authMessage.style.color = '#3b82f6';
    authMessage.textContent = 'Logging in...';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        authMessage.style.color = '#ef4444';
        authMessage.textContent = error.message;
    } else {
        authMessage.style.color = '#10b981';
        authMessage.textContent = 'Welcome back! Redirecting...';
        
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.style.display = 'none';
        
        setTimeout(() => {
            const inHtmlFiles = window.location.pathname.includes('/HTML-Files/');
            window.location.href = inHtmlFiles ? '../index.html' : 'index.html';
        }, 1000);
    }
});

// (Google button binding is handled centrally by supabase.js)

