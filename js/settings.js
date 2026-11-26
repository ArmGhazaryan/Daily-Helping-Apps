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

    function showSettingsStatus(containerEl, type, message, invalidInputs = []) {
        // Clear any previous input-error highlights
        document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));

        // Highlight any passed invalid input elements
        invalidInputs.forEach(el => {
            if (el) el.classList.add("input-error");
        });

        // Update and show the status banner
        containerEl.className = `settings-status is-${type}`;
        containerEl.textContent = message;
        containerEl.style.display = "block";
    }

    document.querySelectorAll(".settings-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");

            document.querySelectorAll(".settings-panel").forEach((p) => {
                p.classList.add("is-hidden");
                p.classList.remove("active");
            });

            if (tab.dataset.tab === "profile") {
                document.getElementById("panel-profile").classList.remove("is-hidden");
                document.getElementById("panel-profile").classList.add("active");
            } else if (tab.dataset.tab === "security") {
                document.getElementById("panel-security").classList.remove("is-hidden");
                document.getElementById("panel-security").classList.add("active");
            }
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
            btn.addEventListener("click", async () => {
                selectedThemeKey = t.key;
                renderThemeGrid();
                avatarPreview.style.background = t.gradient;

                // Persist avatar_theme to Supabase Auth immediately
                const { error } = await supabaseClient.auth.updateUser({
                    data: {
                        ...(currentUser?.user_metadata || {}),
                        avatar_theme: selectedThemeKey
                    }
                });

                if (error) {
                    console.error("Error saving avatar theme:", error);
                }

                // Update drawer and top-right header pill avatar immediately
                if (currentUser && window.dhaUpdateDrawerInfo) {
                    window.dhaUpdateDrawerInfo(currentUser);
                }

                // Update the top-right header pill avatar gradient
                const headerPill = document.querySelector('#user-pill .pill-avatar');
                if (headerPill) {
                    headerPill.style.background = t.gradient;
                }

                // Show toast confirmation
                showToast("Avatar theme saved");
            });
            themeGrid.appendChild(btn);
        });
    }

    async function loadProfile(user) {
        currentUser = user;
        const metadata = user.user_metadata || {};

        const client = window.supabaseClient;
        if (client) {
            try {
                const { data: profile } = await client
                    .from("profiles")
                    .select("is_admin")
                    .eq("id", user.id)
                    .maybeSingle();
                if (profile?.is_admin === true) {
                    roleEl.textContent = "Admin";
                } else {
                    roleEl.textContent = "User";
                }
            } catch (e) {
                console.error('Settings role load error:', e);
                roleEl.textContent = "User";
            }
        } else {
            roleEl.textContent = "User";
        }
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

        // Helpful note for Google OAuth users: setting a password links an Email/Password login method
        const securityNoteEl = document.querySelector(".security-note");
        if (isGoogle && securityNoteEl) {
            securityNoteEl.textContent =
                "Setting a password here links an Email/Password login method to your Google account — you can sign in with either Google or email + password.";
        }

        // Hide Current Password group for pure Google OAuth accounts without email/password identity
        const currentPasswordGroup = document.getElementById("currentPasswordGroup");
        if (isGoogle && currentPasswordGroup) {
            currentPasswordGroup.classList.add("is-hidden");
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
            // Fallback protection: if recovery mode is active, auto-switch to 
            // Account & Security tab and hide Current Password input
            if (sessionStorage.getItem('dha_recovery_mode') === 'true') {
                // Auto-switch to security tab
                document.querySelectorAll('.settings-tab').forEach((tab) => {
                    tab.classList.remove('active');
                });
                const securityTab = document.querySelector('.settings-tab[data-tab="security"]');
                if (securityTab) {
                    securityTab.classList.add('active');
                }
                document.querySelectorAll('.settings-panel').forEach((p) => {
                    p.classList.add('is-hidden');
                    p.classList.remove('active');
                });
                const securityPanel = document.getElementById('panel-security');
                if (securityPanel) {
                    securityPanel.classList.remove('is-hidden');
                    securityPanel.classList.add('active');
                }
                // Hide the Current Password input
                const currentPasswordGroup = document.getElementById('currentPasswordGroup');
                if (currentPasswordGroup) {
                    currentPasswordGroup.classList.add('is-hidden');
                }
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
        const profileStatusEl = document.getElementById("profileStatusMsg");

        try {
            updateBtn.disabled = true;
            updateBtn.textContent = "Updating...";

            // Validate display name is not empty
            if (!displayName.trim()) {
                showSettingsStatus(profileStatusEl, 'error', "Display name cannot be empty.", [displayNameInput]);
                return;
            }

            const { data, error } = await supabaseClient.auth.updateUser({
                data: {
                    display_name: displayName,
                    bio: bio,
                    avatar_theme: selectedThemeKey
                }
            });

            if (error) throw error;

            showSettingsStatus(profileStatusEl, 'success', "Profile updated successfully.", []);
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
            const msg = err.message || "Failed to update profile.";
            showSettingsStatus(profileStatusEl, 'error', msg, [displayNameInput]);
            showToast(msg);
        } finally {
            updateBtn.disabled = false;
            updateBtn.textContent = "Update Profile";
        }
    });

    passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const currentPasswordInput = document.getElementById("currentPasswordInput");
        const newPasswordInput = document.getElementById("settings-new-password");
        const confirmPasswordInput = document.getElementById("settings-confirm-password");

        let currentPassword = currentPasswordInput?.value || "";
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Determine if Current Password group is visible (not hidden for Google OAuth users)
        const currentPasswordGroup = document.getElementById("currentPasswordGroup");
        const isCurrentPasswordVisible = currentPasswordGroup && !currentPasswordGroup.classList.contains("is-hidden");

        const securityStatusEl = document.getElementById("securityStatusMsg");

        try {
            // Disable submit button and show "Updating..." text
            passwordForm.querySelector("button[type='submit']").disabled = true;
            passwordForm.querySelector("button[type='submit']").textContent = "Updating...";

            // --- Validation checks in strict order ---

            // 1. Current Password visible & empty
            if (isCurrentPasswordVisible && !currentPassword.trim()) {
                showSettingsStatus(securityStatusEl, 'error', "Please enter your current password.", [currentPasswordInput]);
                return;
            }

            // 2. New Password empty or < 8 characters
            if (!newPassword.trim() || newPassword.length < 8) {
                showSettingsStatus(securityStatusEl, 'error', "New password must be at least 8 characters long.", [newPasswordInput]);
                return;
            }

            // 3. New Password !== Confirm Password
            if (newPassword !== confirmPassword) {
                showSettingsStatus(securityStatusEl, 'error', "New password and confirm password do not match.", [confirmPasswordInput]);
                return;
            }

            // 4. Current Password entered & New Password === Current Password
            if (currentPassword && newPassword === currentPassword) {
                showSettingsStatus(securityStatusEl, 'error', "New password must be different from your current password.", [newPasswordInput]);
                return;
            }

            // 5. Verify current password via Supabase
            try {
                const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
                    email: currentUser.email,
                    password: currentPassword
                });
                if (verifyError) {
                    showSettingsStatus(securityStatusEl, 'error', "Current password is incorrect. Please try again.", [currentPasswordInput]);
                    return;
                }
            } catch (err) {
                showSettingsStatus(securityStatusEl, 'error', "Current password is incorrect. Please try again.", [currentPasswordInput]);
                return;
            }

            // 6. Update password via Supabase
            try {
                const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });
                if (updateError) throw updateError;

                // Success: clear all 3 password inputs and show success banner
                passwordForm.reset();
                showSettingsStatus(securityStatusEl, 'success', "Password updated successfully.", []);
                showToast("Password updated successfully.");
            } catch (err) {
                const msg = err.message || "Failed to update password. Please try again.";
                showSettingsStatus(securityStatusEl, 'error', msg, []);
                showToast(msg);
            }
        } finally {
            // Re-enable submit button
            passwordForm.querySelector("button[type='submit']").disabled = false;
            passwordForm.querySelector("button[type='submit']").textContent = "Update Password";
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();