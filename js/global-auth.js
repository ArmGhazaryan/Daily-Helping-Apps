// ==========================================
// js/global-auth.js - Self-contained Auth UI
// Owns the header "Log In / Sign Up" / user badge on ALL pages
// and preserves the return URL for the post-login redirect.
// ==========================================

(function () {
    "use strict";

    const RETURN_URL_KEY = "dha_return_url";
    const OAUTH_PENDING_KEY = "dha_oauth_pending";

    function isInHtmlFiles() {
        return window.location.pathname.includes("/HTML-Files/");
    }

    function getAuthPagePath() {
        const base = isInHtmlFiles() ? "auth.html" : "HTML-Files/auth.html";
        return base + "?redirect=" + encodeURIComponent(window.location.href);
    }

    function saveReturnUrl() {
        const url = window.location.href;
        try {
            sessionStorage.setItem(RETURN_URL_KEY, url);
            localStorage.setItem(RETURN_URL_KEY, url);
        } catch (e) { /* storage unavailable */ }
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function getClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof supabaseClient !== "undefined") return supabaseClient;
        return null;
    }

    // Finds (or injects) the right-aligned auth container in the page's top header.
    function ensureAuthContainer() {
        let container = document.getElementById("auth-header-container");
        if (!container) {
            const header = document.querySelector("header, .navbar, .top-bar");
            if (!header) return null;
            let right = header.querySelector(".header-right");
            if (!right) {
                right = document.createElement("div");
                right.className = "header-right";
                header.appendChild(right);
            }
            container = document.createElement("div");
            container.id = "auth-header-container";
            right.appendChild(container);
        }
        container.classList.add("auth-header-container");
        if (container.parentElement) container.parentElement.classList.add("dha-auth-host");
        return container;
    }

    function renderLoggedOut(container) {
        container.innerHTML = `<button type="button" class="auth-btn" id="nav-auth-btn">Log In / Sign Up</button>`;
        container.querySelector(".auth-btn").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveReturnUrl();
            window.location.href = getAuthPagePath();
        });
    }

    function renderLoggedIn(container, username, isAdmin) {
        const safeName = escapeHtml(username);
        container.innerHTML = `<div class="user-profile-badge">
                <div class="user-avatar">${escapeHtml(username.charAt(0).toUpperCase())}</div>
                <span class="username-text">${safeName}</span>
                ${isAdmin ? '<span class="admin-tag">Admin</span>' : ""}
                <button type="button" id="logout-btn" class="logout-btn" title="Log Out">Logout</button>
            </div>`;
        container.querySelector(".logout-btn").addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const client = getClient();
            if (client) await client.auth.signOut();
            window.location.reload();
        });
    }

    let renderSeq = 0;
    async function render(container, session) {
        const seq = ++renderSeq;
        if (!session || !session.user) {
            renderLoggedOut(container);
            return;
        }
        const user = session.user;
        let username = user.user_metadata?.username || user.user_metadata?.full_name ||
            (user.email ? user.email.split("@")[0] : "User");
        let isAdmin = false;
        const client = getClient();
        if (client) {
            try {
                const { data: profile } = await client
                    .from("profiles")
                    .select("username, is_admin")
                    .eq("id", user.id)
                    .maybeSingle();
                if (profile?.username) username = profile.username;
                isAdmin = profile?.is_admin === true;
            } catch (e) { /* keep fallback username */ }
        }
        if (seq !== renderSeq) return;
        renderLoggedIn(container, username, isAdmin);
    }

    // Fallback: if Google OAuth returned to a page other than the auth page
    // (e.g. Supabase Site URL), still send the user back to where they started.
    function consumePendingOAuthRedirect(session) {
        if (!session || !session.user) return false;
        let pending = null, target = null;
        try {
            pending = localStorage.getItem(OAUTH_PENDING_KEY);
            if (!pending) return false;
            localStorage.removeItem(OAUTH_PENDING_KEY);
            target = sessionStorage.getItem(RETURN_URL_KEY) || localStorage.getItem(RETURN_URL_KEY);
            sessionStorage.removeItem(RETURN_URL_KEY);
            localStorage.removeItem(RETURN_URL_KEY);
        } catch (e) { return false; }
        if (!target) return false;
        try {
            const url = new URL(target, window.location.href);
            if (url.origin !== window.location.origin || url.href === window.location.href) return false;
            window.location.replace(url.href);
            return true;
        } catch (e) { return false; }
    }

    // Lets page scripts send guests to the auth page (with return URL) instead of a modal
    window.dhaGoToAuth = function () {
        saveReturnUrl();
        window.location.href = getAuthPagePath();
    };

    function init() {
        const container = ensureAuthContainer();
        if (!container) return;

        // Show the button immediately so it is never missing, even without Supabase.
        renderLoggedOut(container);

        const client = getClient();
        if (!client) return;

        client.auth.getSession().then(({ data: { session } }) => {
            if (consumePendingOAuthRedirect(session)) return;
            render(container, session);
        }).catch(() => { /* keep logged-out UI */ });

        client.auth.onAuthStateChange((_event, session) => {
            render(container, session);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
