// ==========================================
// js/global-auth.js - Self-contained Auth UI
// Dynamically manages Log In / Sign Up button across ALL 7 pages
// Ensures post-login redirect preserves return URL
// ==========================================

(function () {
    "use strict";

    const AUTH_PAGE = "HTML-Files/auth.html";
    const ROOT_AUTH_PAGE = "auth.html";
    const RETURN_URL_KEY = "dha_return_url";

    function isInHtmlFiles() {
        return window.location.pathname.includes("/HTML-Files/");
    }

    function getAuthPagePath() {
        return isInHtmlFiles() ? AUTH_PAGE : ROOT_AUTH_PAGE;
    }

    function saveReturnUrl() {
        const url = window.location.href;
        sessionStorage.setItem(RETURN_URL_KEY, url);
        localStorage.setItem(RETURN_URL_KEY, url);
    }

    function createAuthHTML(isLoggedIn, user) {
        if (isLoggedIn && user) {
            const username = user.username || user.email.split("@")[0];
            const initial = username.charAt(0).toUpperCase();
            return `<div class="user-profile-badge" style="display:inline-flex;align-items:center;gap:0.5rem;">
                        <div class="user-avatar" style="width:24px;height:24px;background:#3b82f6;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.875rem;">${initial}</div>
                        <span class="username-text" style="color:#e2e8f0;">${username}</span>
                        <button id="logout-btn" class="logout-btn" style="background:none;border:none;color:#f87171;cursor:pointer;font:inherit;padding:0;">Logout</button>
                      </div>`;
        }
        return `<button type="button" class="auth-btn" style="background:none;border:none;color:#e2e8f0;cursor:pointer;font:inherit;">Log In / Sign Up</button>`;
    }

    function init() {
        const authContainer = document.getElementById("auth-header-container");
        if (authContainer) {
            const supabaseClient = window.supabaseClient;
            if (supabaseClient) {
                supabaseClient.auth.getSession().then(({ data: { session } }) => {
                    const isLoggedIn = session && session.user;
                    const user = isLoggedIn ? session.user : null;
                    authContainer.innerHTML = createAuthHTML(isLoggedIn, user);
                    if (isLoggedIn) {
                        const logoutBtn = document.getElementById("logout-btn");
                        if (logoutBtn) {
                            logoutBtn.addEventListener("click", async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                saveReturnUrl();
                                await supabaseClient.auth.signOut();
                                sessionStorage.removeItem(RETURN_URL_KEY);
                                localStorage.removeItem(RETURN_URL_KEY);
                                window.location.href = getAuthPagePath();
                            });
                        }
                    }
                });
            } else {
                authContainer.innerHTML = createAuthHTML(false);
            }
            bindAuthButtonClick();
        } else {
            // No auth-container in HTML - try to inject into header
            const header = document.querySelector("header") || document.querySelector(".navbar") || document.querySelector(".top-bar");
            if (header) {
                const isHtmlFiles = isInHtmlFiles();
                const authHref = isHtmlFiles ? "HTML-Files/auth.html" : "auth.html";
                const authBtn = document.createElement("button");
                authBtn.type = "button";
                authBtn.className = "auth-btn";
                authBtn.style.cssText = "position:relative;z-index:9999;pointer-events:auto;display:inline-flex;background:none;border:none;color:#e2e8f0;cursor:pointer;font:inherit;";
                authBtn.textContent = "Log In / Sign Up";
                authBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveReturnUrl();
                    window.location.href = authHref;
                });
                const existing = header.querySelector(".header-right") || header.querySelector(".auth-header-container");
                if (existing) {
                    existing.appendChild(authBtn);
                } else {
                    const rightDiv = document.createElement("div");
                    rightDiv.className = "header-right";
                    rightDiv.style.cssText = "display:flex;align-items:center;gap:1rem;";
                    rightDiv.appendChild(authBtn);
                    header.appendChild(rightDiv);
                }
            }
        }
    }

    function bindAuthButtonClick() {
        const authBtn = document.querySelector(".auth-btn");
        if (!authBtn) return;
        authBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveReturnUrl();
            window.location.href = getAuthPagePath();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();