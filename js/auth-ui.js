// DOM Elements
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authMessage = document.getElementById('auth-message');

// 🟢 Post-login return URL handling (dedicated auth page only)
const RETURN_URL_KEY = 'dha_return_url';
const OAUTH_PENDING_KEY = 'dha_oauth_pending';
const isAuthPage = /\/auth\.html$/i.test(window.location.pathname);

function sanitizeReturnUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url, window.location.href);
        if (parsed.origin !== window.location.origin) return null;
        if (/\/auth\.html$/i.test(parsed.pathname)) return null;
        return parsed.href;
    } catch (e) {
        return null;
    }
}

function storeReturnUrlFromQuery() {
    const redirect = sanitizeReturnUrl(new URLSearchParams(window.location.search).get('redirect'));
    if (!redirect) return;
    try {
        sessionStorage.setItem(RETURN_URL_KEY, redirect);
        localStorage.setItem(RETURN_URL_KEY, redirect);
    } catch (e) { /* storage unavailable */ }
}

function redirectToReturnUrl() {
    let target = null;
    try {
        target = sanitizeReturnUrl(sessionStorage.getItem(RETURN_URL_KEY) || localStorage.getItem(RETURN_URL_KEY));
        sessionStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(OAUTH_PENDING_KEY);
    } catch (e) { /* storage unavailable */ }
    window.location.replace(target || '../index.html');
}

if (isAuthPage) {
    storeReturnUrlFromQuery();

    // Mark a pending Google OAuth round-trip (capture phase runs before supabase.js handler)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#google-login-btn') || e.target.closest('.google-auth-btn')) {
            try { localStorage.setItem(OAUTH_PENDING_KEY, '1'); } catch (err) { /* ignore */ }
        }
    }, true);

    // Google OAuth returns to this page (supabase.js redirectTo = current page URL)
    let redirecting = false;
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (redirecting || !session?.user) return;
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            redirecting = true;
            redirectToReturnUrl();
        }
    });
}

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

    authMessage.classList.add('auth-msg-info');
    authMessage.classList.remove('auth-msg-error', 'auth-msg-success');
    authMessage.textContent = 'Creating account...';

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { username: username }
        }
    });

    if (error) {
        authMessage.classList.add('auth-msg-error');
        authMessage.classList.remove('auth-msg-info', 'auth-msg-success');
        authMessage.textContent = error.message;
    } else {
        authMessage.classList.add('auth-msg-success');
        authMessage.classList.remove('auth-msg-info', 'auth-msg-error');
        signupForm.reset();
        if (data?.session) {
            authMessage.textContent = 'Account created! Redirecting...';
            if (isAuthPage) redirectToReturnUrl();
            else window.location.reload();
        } else {
            authMessage.textContent = 'Success! Check your email or login.';
        }
    }
});

// 🟢 Login Logic
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    authMessage.classList.add('auth-msg-info');
    authMessage.classList.remove('auth-msg-error', 'auth-msg-success');
    authMessage.textContent = 'Logging in...';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        authMessage.classList.add('auth-msg-error');
        authMessage.classList.remove('auth-msg-info', 'auth-msg-success');
        authMessage.textContent = error.message;
    } else {
        authMessage.classList.add('auth-msg-success');
        authMessage.classList.remove('auth-msg-info', 'auth-msg-error');
        authMessage.textContent = 'Welcome back! Redirecting...';
        
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.add('is-hidden');
            authModal.classList.remove('is-visible', 'active');
        }
        
        if (isAuthPage) redirectToReturnUrl();
        else window.location.reload();
    }
});

// 🟢 Auth Modal Dismissal
const authModal = document.getElementById('auth-modal');
const authModalCloseBtn = document.getElementById('auth-modal-close');

function closeAuthModal() {
    if (authModal) {
        authModal.classList.add('is-hidden');
        authModal.classList.remove('is-visible', 'active');
    }
}

authModalCloseBtn?.addEventListener('click', closeAuthModal);

// Clicking the backdrop (outside the modal card) closes the modal
authModal?.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
});

// Pressing Escape closes the modal if open
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && !authModal.classList.contains('is-hidden')) {
        closeAuthModal();
    }
});

// (Google button binding is handled centrally by supabase.js)


