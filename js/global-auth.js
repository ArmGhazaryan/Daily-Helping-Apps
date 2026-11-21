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

    // Curated gradient themes for the avatar (DHA dark glassmorphic aesthetic).
    const AVATAR_THEMES = {
        "midnight-blue": "linear-gradient(135deg, #1e1b4b, #312e81)",
        "emerald": "linear-gradient(135deg, #064e3b, #047857)",
        "royal-purple": "linear-gradient(135deg, #4527a0, #7b2cb8)",
        "sunset-gold": "linear-gradient(135deg, #78350f, #b45309)",
        "crimson": "linear-gradient(135deg, #7f1d1d, #b91c1c)",
        "ocean-teal": "linear-gradient(135deg, #0f5257, #14b8a6)"
    };

    function avatarGradient(themeKey) {
        return AVATAR_THEMES[themeKey] || AVATAR_THEMES["midnight-blue"];
    }

    function getSettingsPath() {
        return isInHtmlFiles() ? "settings.html" : "HTML-Files/settings.html";
    }

    function renderLoggedIn(container, user, isAdmin) {
        const metadata = user.user_metadata || {};
        const email = user.email || "";
        const emailPrefix = email.split("@")[0] || "User";
        const displayName = metadata.display_name || metadata.full_name || emailPrefix;
        const safeName = escapeHtml(displayName);
        const initial = escapeHtml(displayName.charAt(0).toUpperCase()) || "U";
        const themeKey = metadata.avatar_theme || "midnight-blue";
        const gradient = avatarGradient(themeKey);
        const adminBadge = isAdmin ? '<span class="pill-admin">Admin</span>' : "";

        container.innerHTML = `<div class="user-pill" id="user-pill" role="button" tabindex="0" aria-label="User menu, ${safeName}">
                <div class="pill-avatar" style="background: ${gradient}">${initial}</div>
                <span class="pill-name">${safeName}</span>
                ${adminBadge}
                <span class="pill-chevron">▼</span>
            </div>`;

        if (container._dhaEscapeHandler) {
            document.removeEventListener("keydown", container._dhaEscapeHandler);
            container._dhaEscapeHandler = null;
        }
        bindDrawerPill(container, user);
    }

    function buildDrawerHtml(user) {
        const metadata = user.user_metadata || {};
        const email = user.email || "";
        const emailPrefix = email.split("@")[0] || "User";
        const displayName = metadata.display_name || metadata.full_name || emailPrefix;
        const safeName = escapeHtml(displayName);
        const safeEmail = escapeHtml(email);
        const initial = escapeHtml(displayName.charAt(0).toUpperCase()) || "U";
        const themeKey = metadata.avatar_theme || "midnight-blue";
        const gradient = avatarGradient(themeKey);

        return `
            <div class="drawer-backdrop" id="drawer-backdrop"></div>
            <div class="user-drawer" id="user-drawer">
                <div class="drawer-header">
                    <div class="drawer-avatar" id="drawer-avatar" style="background: ${gradient}">${initial}</div>
                    <div class="drawer-info">
                        <div class="drawer-name" id="drawer-name">${safeName}</div>
                        <div class="drawer-email" id="drawer-email">${safeEmail}</div>
                    </div>
                    <button type="button" class="drawer-close" id="drawer-close" title="Close">×</button>
                </div>
                <hr class="drawer-divider">
                <nav class="drawer-menu">
                    <a href="#" class="drawer-item" id="drawer-settings-link">⚙️ Settings</a>
                    <button type="button" class="drawer-item drawer-item-danger" id="drawer-signout-btn" title="Sign out">🚪 Sign out</button>
                </nav>
            </div>
        `;
    }

    function openDrawer() {
        const drawer = document.getElementById("user-drawer");
        const backdrop = document.getElementById("drawer-backdrop");
        if (drawer) drawer.classList.add("open");
        if (backdrop) backdrop.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
        const drawer = document.getElementById("user-drawer");
        const backdrop = document.getElementById("drawer-backdrop");
        if (drawer) drawer.classList.remove("open");
        if (backdrop) backdrop.classList.remove("open");
        document.body.style.overflow = "";
    }

    function updateDrawerInfo(user) {
        const metadata = user.user_metadata || {};
        const email = user.email || "";
        const emailPrefix = email.split("@")[0] || "User";
        const displayName = metadata.display_name || metadata.full_name || emailPrefix;
        const initial = escapeHtml(displayName.charAt(0).toUpperCase()) || "U";
        const themeKey = metadata.avatar_theme || "midnight-blue";
        const gradient = avatarGradient(themeKey);

        const avatarEl = document.getElementById("drawer-avatar");
        const nameEl = document.getElementById("drawer-name");
        const emailEl = document.getElementById("drawer-email");
        if (avatarEl) {
            avatarEl.style.background = gradient;
            avatarEl.textContent = initial;
        }
        if (nameEl) nameEl.textContent = escapeHtml(displayName);
        if (emailEl) emailEl.textContent = escapeHtml(email);
    }

    function bindDrawerPill(container, user) {
        container.insertAdjacentHTML("beforeend", buildDrawerHtml(user));

        const pill = container.querySelector("#user-pill");
        const closeBtn = document.getElementById("drawer-close");
        const settingsLink = document.getElementById("drawer-settings-link");
        const signoutBtn = document.getElementById("drawer-signout-btn");
        const backdrop = document.getElementById("drawer-backdrop");

        if (pill) {
            pill.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const drawer = document.getElementById("user-drawer");
                const isOpen = drawer && drawer.classList.contains("open");
                if (isOpen) closeDrawer(); else openDrawer();
            });
            pill.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pill.click();
                }
            });
        }
        if (closeBtn) closeBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeDrawer(); });
        if (backdrop) backdrop.addEventListener("click", closeDrawer);
        if (settingsLink) {
            settingsLink.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeDrawer();
                saveReturnUrl();
                window.location.href = getSettingsPath();
            });
        }
        if (signoutBtn) {
            signoutBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeDrawer();
                const client = getClient();
                if (client) await client.auth.signOut();
                window.location.reload();
            });
        }

        const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
        document.addEventListener("keydown", onKey);
        container._dhaEscapeHandler = onKey;
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
        renderLoggedIn(container, user, isAdmin);
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

    // Exposed for settings.js to refresh the drawer after a profile update.
    window.dhaUpdateDrawerInfo = function (user) {
        updateDrawerInfo(user);
    };
    window.dhaCloseDrawer = closeDrawer;

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
