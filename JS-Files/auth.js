// js/auth.js - Role-based access control helpers
(function () {
  "use strict";

  function getClient() {
    if (typeof supabaseClient !== "undefined") return supabaseClient;
    if (window && window.supabaseClient) return window.supabaseClient;
    return null;
  }

  async function getCurrentUser() {
    const client = getClient();
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      return data?.session?.user || null;
    } catch (e) {
      return null;
    }
  }

  async function isAdmin(user) {
    if (!user) return false;
    if (user.user_metadata?.role === "admin") return true;
    const client = getClient();
    if (!client) return false;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      return !error && data && data.is_admin === true;
    } catch (e) {
      return false;
    }
  }

  // Expose helpers globally
  window.dhaGetCurrentUser = getCurrentUser;
  window.dhaIsAdmin = isAdmin;

  // Session initialization hook: set admin flag without fetching other users data
  async function initAuth() {
    const user = await getCurrentUser();
    const admin = await isAdmin(user);
    window.__DHA_IS_ADMIN__ = admin === true;
    if (!admin) {
      // Ensure no admin fetches happen for non-admins
      window.__DHA_ADMIN_BLOCKED__ = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
