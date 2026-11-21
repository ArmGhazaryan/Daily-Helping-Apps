(function () {
    "use strict";

    const AVATAR_THEMES = [
        { key: "midnight-blue", label: "Midnight Blue", gradient: "linear-gradient(135deg, #1e1b4b, #312e81)" },
        { key: "emerald", label: "Emerald", gradient: "linear-gradient(135deg, #064e3b, #047857)" },
        { key: "royal-purple", label: "Royal Purple", gradient: "linear-gradient(135deg, #4527a0, #7b2cb8)" },
        { key: "sunset-gold", label: "Sunset Gold", gradient: "linear-gradient(135deg, #78350f, #b45309)" },
        { key: "crimson", label: "Crimson", gradient: "linear-gradient(135deg, #7f1d1d, #b91c1c)" },
        { key: "ocean-teal", label: "Ocean Teal", gradient: "linear-gradient(135deg, #0f5257, #14b8a6)" }
    ];

    const displayNameInput = document.getElementById("settings-display-name");
    const emailInput = document.getElementById("settings-email");
    const bioInput = document.getElementById("settings-bio");
    const updateBtn = document.getElementById("settings-update-btn");
    const toastEl = document.getElementById("settings-toast");
    const avatarPreview = document.getElementById("settings-avatar-preview");
    const avatarEditBtn = document.getElementById("settings-avatar-edit");
    const themePopover = document.getElementById("settings-theme-popover");
    const themeClose = document.getElementById("settings-theme-close");
    const themeGrid = document.getElementById("settings-theme-grid");
    const passwordForm = document.getElementById("settings-password-form");
    const signinMethodEl = document.getElementById("security-signin-method");
    const roleEl = document.getElementById("security-role");

    let currentUser = null;
    let selectedThemeKey = "midnight-blue";

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.add("show");
        setTimeout(() => toastEl.classList.remove("show"), 3000);
    }

    document.querySelectorAll(".settings-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
            document.querySelectorAll(".settings-panel").forEach((p) => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
        });
    });

    function renderThemeGrid() {
        themeGrid.innerHTML = "";
        AVATAR_THEMES.forEach((t) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "theme-option" + (t.key === selectedThemeKey ? " active" : "");
            btn.style.background = t.gradient;
            btn.title = t.label;
            btn.addEventListener("click", () => {
                selectedThemeKey = t.key;
                renderThemeGrid();
                avatarPreview.style.background = t.gradient;
            });
            themeGrid.appendChild(btn);
        });
    }

    async function loadProfile(user) {
        currentUser = user;
        const metadata = user.user_metadata || {};
        const email = user.email || "";
        const emailPrefix = email.split("@")[0];

        const displayName = metadata.display_name || metadata.full_name || emailPrefix;
        displayNameInput.value = displayName;
        emailInput.value = email;
        bioInput.value = metadata.bio || "";

        selectedThemeKey = metadata.avatar_theme || "midnight-blue";
        const theme = AVATAR_THEMES.find((t) => t.key === selectedThemeKey) || AVATAR_THEMES[0];
        avatarPreview.style.background = theme.gradient;
        avatarPreview.textContent = escapeHtml(displayName.charAt(0).toUpperCase()) || "U";

        const isGoogle = user.app_metadata?.provider === "google" || user.user_metadata?.provider === "google";
        signinMethodEl.textContent = isGoogle ? "Google OAuth" : "Email & Password";
        roleEl.textContent = user.user_metadata?.is_admin === true ? "Admin" : "User";

        // Helpful note for Google OAuth users: setting a password links an Email/Password login method
        const securityNoteEl = document.querySelector(".security-note");
        if (isGoogle && securityNoteEl) {
            securityNoteEl.textContent =
                "Setting a password here links an Email/Password login method to your Google account — you can sign in with either Google or email + password.";
        }

        renderThemeGrid();
    }

    async function init() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error || !session || !session.user) {
                window.location.href = "auth.html?redirect=settings.html";
                return;
            }
            await loadProfile(session.user);
        } catch (e) {
            console.error("Settings init error:", e);
            window.location.href = "auth.html?redirect=settings.html";
        }
    }

    avatarEditBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        themePopover.classList.toggle("open");
    });

    themeClose.addEventListener("click", (e) => {
        e.stopPropagation();
        themePopover.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
        if (
            themePopover.classList.contains("open") &&
            !themePopover.contains(e.target) &&
            e.target !== avatarEditBtn
        ) {
            themePopover.classList.remove("open");
        }
    });

    updateBtn.addEventListener("click", async () => {
        const displayName = displayNameInput.value.trim();
        const bio = bioInput.value.trim();

        try {
            updateBtn.disabled = true;
            updateBtn.textContent = "Updating...";

            const { data, error } = await supabaseClient.auth.updateUser({
                data: {
                    display_name: displayName,
                    bio: bio,
                    avatar_theme: selectedThemeKey
                }
            });

            if (error) throw error;

            showToast("Profile updated successfully.");

            if (window.dhaUpdateDrawerInfo && data && data.user) {
                window.dhaUpdateDrawerInfo(data.user);
            }

            if (currentUser) {
                currentUser.user_metadata = currentUser.user_metadata || {};
                currentUser.user_metadata.display_name = displayName;
                currentUser.user_metadata.bio = bio;
                currentUser.user_metadata.avatar_theme = selectedThemeKey;
            }
        } catch (err) {
            console.error("Update profile error:", err);
            showToast(err.message || "Failed to update profile.");
        } finally {
            updateBtn.disabled = false;
            updateBtn.textContent = "Update Profile";
        }
    });

    passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById("settings-new-password").value;
        const confirmPassword = document.getElementById("settings-confirm-password").value;

        if (newPassword !== confirmPassword) {
            showToast("Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            showToast("Password must be at least 6 characters.");
            return;
        }

        try {
            const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (error) throw error;
            showToast("Password updated successfully.");
            passwordForm.reset();
        } catch (err) {
            const msg = err.message || "Failed to update password.";
            // Supabase may surface an email-verification/confirmation notice when a password is set
            // for a Google (OAuth) account — show it as info rather than a hard failure.
            if (/verification|confirmation|confirm your email|check your email/i.test(msg)) {
                showToast(msg);
            } else {
                console.error("Change password error:", err);
                showToast(msg);
            }
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();