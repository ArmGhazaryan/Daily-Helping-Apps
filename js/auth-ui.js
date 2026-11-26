// DOM Elements
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authMessage = document.getElementById('auth-message');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetPasswordForm = document.getElementById('reset-password-form');
const backToLoginLink = document.getElementById('back-to-login-link');

function getSupabase() {
    return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
}

function setAuthMessage(type, text) {
    if (!authMessage) return;
    authMessage.classList.remove('auth-msg-info', 'auth-msg-error', 'auth-msg-success');
    if (type) authMessage.classList.add(`auth-msg-${type}`);
    authMessage.textContent = text || '';
}

// Named function for Forgot Password click handler
function handleForgotPasswordClick(e) {
    e.preventDefault();
    loginForm?.classList.add('hidden');
    signupForm?.classList.add('hidden');
    resetPasswordForm?.classList.remove('hidden');
    tabLogin?.classList.remove('active');
    tabSignup?.classList.remove('active');
    setAuthMessage('', '');
}

// 🟢 Post-login return URL handling (dedicated auth page only)
const RETURN_URL_KEY = 'dha_return_url';
const OAUTH_PENDING_KEY = 'dha_oauth_pending';
const RECOVERY_MODE_KEY = 'dha_recovery_mode';
const isAuthPage = /\/auth\.html$/i.test(window.location.pathname);

function isRecoveryActive() {
    return (
        window.location.search.includes('mode=recovery') ||
        window.location.hash.includes('type=recovery') ||
        sessionStorage.getItem(RECOVERY_MODE_KEY) === 'true'
    );
}

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
    const inRecovery =
        window.location.search.includes('mode=recovery') ||
        window.location.hash.includes('type=recovery') ||
        sessionStorage.getItem('dha_recovery_mode') === 'true';
    if (inRecovery) return;
    let target = null;
    try {
        target = sanitizeReturnUrl(sessionStorage.getItem(RETURN_URL_KEY) || localStorage.getItem(RETURN_URL_KEY));
        sessionStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(OAUTH_PENDING_KEY);
    } catch (e) { /* storage unavailable */ }
    window.location.replace(target || '../index.html');
}

// 🟢 Render "Set New Password" form safely without destroying existing DOM nodes/listeners
function showRecoveryPasswordForm() {
    if (!isAuthPage) return;
    const authCard = document.querySelector('.auth-card');
    if (!authCard) return;

    // Avoid creating duplicate recovery forms
    if (document.getElementById('new-password-form')) return;

    // Hide existing children temporarily (keep their event listeners intact)
    Array.from(authCard.children).forEach((child) => {
        if (child.id !== 'auth-message') {
            child.dataset.hiddenByRecovery = 'true';
            child.classList.add('hidden');
        }
    });
    setAuthMessage('', '');

    const newPasswordForm = document.createElement('form');
    newPasswordForm.id = 'new-password-form';
    newPasswordForm.className = 'auth-form';

    const h2 = document.createElement('h2');
    h2.textContent = 'Set New Password';
    newPasswordForm.appendChild(h2);

    const pwDiv1 = document.createElement('div');
    pwDiv1.className = 'input-group';
    const pwLabel1 = document.createElement('label');
    pwLabel1.htmlFor = 'new-password';
    pwLabel1.textContent = 'New Password';
    const pwInput1 = document.createElement('input');
    pwInput1.type = 'password';
    pwInput1.id = 'new-password';
    pwInput1.placeholder = 'Min. 8 characters';
    pwInput1.required = true;
    pwInput1.minLength = 8;
    pwDiv1.appendChild(pwLabel1);
    pwDiv1.appendChild(pwInput1);
    newPasswordForm.appendChild(pwDiv1);

    const pwDiv2 = document.createElement('div');
    pwDiv2.className = 'input-group';
    const pwLabel2 = document.createElement('label');
    pwLabel2.htmlFor = 'confirm-password';
    pwLabel2.textContent = 'Confirm New Password';
    const pwInput2 = document.createElement('input');
    pwInput2.type = 'password';
    pwInput2.id = 'confirm-password';
    pwInput2.placeholder = 'Min. 8 characters';
    pwInput2.required = true;
    pwInput2.minLength = 8;
    pwDiv2.appendChild(pwLabel2);
    pwDiv2.appendChild(pwInput2);
    newPasswordForm.appendChild(pwDiv2);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'submit-btn';
    submitBtn.textContent = 'Save New Password';
    newPasswordForm.appendChild(submitBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancelRecoveryBtn';
    cancelBtn.className = 'cancel-btn';
    cancelBtn.style.marginTop = '10px';
    cancelBtn.style.width = '100%';
    cancelBtn.textContent = 'Cancel & Back to Login';
    newPasswordForm.appendChild(cancelBtn);

    // Insert before #auth-message if present, otherwise append
    if (authMessage && authMessage.parentElement === authCard) {
        authCard.insertBefore(newPasswordForm, authMessage);
    } else {
        authCard.appendChild(newPasswordForm);
    }

    // Handle new password submission
    newPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = pwInput1.value;
        const confirmPassword = pwInput2.value;

        if (newPassword.length < 8) {
            setAuthMessage('error', 'New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setAuthMessage('error', 'New password and confirm password do not match.');
            return;
        }

        const client = getSupabase();
        if (!client) {
            setAuthMessage('error', 'Authentication service unavailable.');
            return;
        }

        submitBtn.disabled = true;
        setAuthMessage('info', 'Updating password...');
        try {
            const { error } = await client.auth.updateUser({ password: newPassword });
            if (error) throw error;

            try { sessionStorage.removeItem(RECOVERY_MODE_KEY); } catch (err) { /* ignore */ }
            setAuthMessage('success', 'Password updated successfully! Redirecting...');

            // Guard: don't redirect to index.html while in recovery mode
            setTimeout(() => {
                window.location.replace('../index.html');
            }, 1500);
        } catch (err) {
            submitBtn.disabled = false;
            setAuthMessage('error', err.message || 'Failed to update password.');
        }
    });

    // Handle Cancel & Back to Login
    cancelBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try { sessionStorage.removeItem(RECOVERY_MODE_KEY); } catch (err) { /* ignore */ }

        const client = getSupabase();
        if (client) {
            await client.auth.signOut();
        }

        window.history.replaceState({}, '', 'auth.html');
        newPasswordForm.remove();

        // Restore original auth card children with all event listeners intact
        Array.from(authCard.children).forEach((child) => {
            if (child.dataset.hiddenByRecovery === 'true') {
                delete child.dataset.hiddenByRecovery;
                child.classList.remove('hidden');
            }
        });

        tabLogin?.classList.add('active');
        tabSignup?.classList.remove('active');
        loginForm?.classList.remove('hidden');
        signupForm?.classList.add('hidden');
        resetPasswordForm?.classList.add('hidden');
        setAuthMessage('', '');
    });
}

if (isAuthPage) {
    storeReturnUrlFromQuery();

    // Mark a pending Google OAuth round-trip (capture phase runs before supabase.js handler)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#google-login-btn') || e.target.closest('.google-auth-btn')) {
            storeReturnUrlFromQuery();
            try { localStorage.setItem(OAUTH_PENDING_KEY, '1'); } catch (err) { /* ignore */ }
        }
    }, true);

    // Leave the auth page without logging in
    document.getElementById('auth-back-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (isRecoveryActive()) {
            try { sessionStorage.removeItem(RECOVERY_MODE_KEY); } catch (err) { /* ignore */ }
            // Guard: don't redirect to index.html while in recovery mode (check hash/search too)
            
            window.location.href = '../index.html';
        } else {
            redirectToReturnUrl();
        }
    });

    // DHA logo click: clear recovery mode if active, then allow normal navigation to ../index.html
    const dhaBrand = document.querySelector('.dha-brand');
    if (dhaBrand) {
        dhaBrand.addEventListener('click', () => {
            if (isRecoveryActive()) {
                try { sessionStorage.removeItem(RECOVERY_MODE_KEY); } catch (err) { /* ignore */ }
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !e.target.closest('input, textarea') && !isRecoveryActive()) {
            redirectToReturnUrl();
        }
    });

    if (isRecoveryActive()) {
        showRecoveryPasswordForm();
    }

    // Listen for auth state changes (Google OAuth return or Password Recovery token)
    let redirecting = false;
    const client = getSupabase();
    client?.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            try { sessionStorage.setItem(RECOVERY_MODE_KEY, 'true'); } catch (err) { /* ignore */ }
            showRecoveryPasswordForm();
            return;
        }
        // Never auto-redirect away while user is setting a new password in recovery mode
        if (isRecoveryActive()) return;

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
    tabSignup?.classList.remove('active');
    loginForm?.classList.remove('hidden');
    signupForm?.classList.add('hidden');
    resetPasswordForm?.classList.add('hidden');
    setAuthMessage('', '');
});

tabSignup?.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin?.classList.remove('active');
    signupForm?.classList.remove('hidden');
    loginForm?.classList.add('hidden');
    resetPasswordForm?.classList.add('hidden');
    setAuthMessage('', '');
});

// 🟢 Sign Up Logic
signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    setAuthMessage('info', 'Creating account...');

    const { data, error } = await getSupabase().auth.signUp({
        email: email,
        password: password,
        options: {
            data: { username: username }
        }
    });

    if (error) {
        setAuthMessage('error', error.message);
    } else {
        setAuthMessage('success', 'Account created! Redirecting...');
        signupForm.reset();
        if (data?.session) {
            if (isAuthPage) redirectToReturnUrl();
            else window.location.reload();
        } else {
            setAuthMessage('success', 'Success! Check your email or login.');
        }
    }
});

// 🟢 Login Logic
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    setAuthMessage('info', 'Logging in...');

    const { error } = await getSupabase().auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        setAuthMessage('error', error.message);
    } else {
        setAuthMessage('success', 'Welcome back! Redirecting...');

        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.add('is-hidden');
            authModal.classList.remove('is-visible', 'active');
        }

        if (isAuthPage) redirectToReturnUrl();
        else window.location.reload();
    }
});

// 🟢 Forgot Password → Reset flow
forgotPasswordLink?.addEventListener('click', handleForgotPasswordClick);

backToLoginLink?.addEventListener('click', (e) => {
    e.preventDefault();
    resetPasswordForm?.classList.add('hidden');
    loginForm?.classList.remove('hidden');
    tabLogin?.classList.add('active');
    setAuthMessage('', '');
});

function startResetCooldown(seconds = 60) {
    const submitBtn = document.querySelector('#reset-password-form button[type="submit"]');
    const savedUntil = localStorage.getItem('dha_reset_cooldown_until');
    const now = Date.now();

    let remaining;
    if (savedUntil && now < parseInt(savedUntil)) {
        // Resume active cooldown
        remaining = Math.ceil((parseInt(savedUntil) - now) / 1000);
    } else {
        // Start new cooldown
        remaining = seconds;
        localStorage.setItem('dha_reset_cooldown_until', now + seconds * 1000);
    }

    // Disable button and set styles
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';

    // Update button text
    submitBtn.textContent = `Resend in ${remaining}s`;

    // Set up countdown interval
    const intervalId = setInterval(() => {
        remaining--;
        submitBtn.textContent = `Resend in ${remaining}s`;

        if (remaining <= 0) {
            clearInterval(intervalId);
            localStorage.removeItem('dha_reset_cooldown_until');
            submitBtn.disabled = false;
            submitBtn.style.opacity = '';
            submitBtn.style.cursor = '';
            submitBtn.textContent = 'Send Reset Link';
        }
    }, 1000);
}
resetPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if cooldown is still active; if so, return early
    const savedUntil = localStorage.getItem('dha_reset_cooldown_until');
    if (savedUntil && Date.now() < parseInt(savedUntil)) {
        return;
    }

    const email = document.getElementById('reset-email').value.trim();
    const submitBtn = document.querySelector('#reset-password-form button[type="submit"]');

    setAuthMessage('info', 'Sending reset link...');

    // Immediately disable submitBtn to block double-clicks
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';

    const redirectUrl = new URL('auth.html', window.location.href);
    redirectUrl.search = '';
    redirectUrl.hash = '';

    const { error } = await getSupabase().auth.resetPasswordForEmail(
        email,
        window.location.protocol === 'http:' || window.location.protocol === 'https:'
            ? { redirectTo: redirectUrl.href }
            : undefined
    );

    if (error) {
        // Check if error is rate-limit or security-related
        if (error.message && (error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('security purposes'))) {
            setAuthMessage('error', 'Too many reset attempts. Please wait 60 seconds before trying again.');
            startResetCooldown(60);
        } else {
            setAuthMessage('error', error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
            submitBtn.style.opacity = '';
            submitBtn.style.cursor = '';
        }
    } else {
        setAuthMessage('success', 'Password reset link sent! Check your email.');
        document.getElementById('reset-email').value = '';
        startResetCooldown(60);
    }
});
// Resume any active cooldown on page load
const savedCooldown = localStorage.getItem('dha_reset_cooldown_until');
if (savedCooldown && Date.now() < parseInt(savedCooldown)) {
    startResetCooldown();
}

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

authModal?.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && !authModal.classList.contains('is-hidden')) {
        closeAuthModal();
    }
});