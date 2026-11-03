// js/admin.js - Admin Analytics & User Insights (admin-only)
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

  async function isAdminUser(user) {
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
      if (!error && data && data.is_admin === true) return true;
    } catch (e) {
      // ignore
    }
    return false;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  async function fetchCount(table) {
    const client = getClient();
    if (!client) return 0;
    try {
      const { count, error } = await client
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return typeof count === "number" ? count : 0;
    } catch (e) {
      console.warn("Count failed for", table, e?.message || e);
      return 0;
    }
  }

  async function fetchRecentUsers() {
    const client = getClient();
    if (!client) return [];
    try {
      const { data, error } = await client
        .from("profiles")
        .select("id, username, created_at, is_admin")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Recent users fetch failed", e?.message || e);
      return [];
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderActivity(rows) {
    const list = document.getElementById("adminActivityLog");
    if (!list) return;
    if (!rows || rows.length === 0) {
      list.innerHTML = "<li class='admin-activity-item'><span class='name'>No recent activity</span></li>";
      return;
    }
    list.innerHTML = rows.map(function (u) {
      const name = escapeHtml(u.username || "User #" + String(u.id || "").slice(0, 6) || "Unknown");
      const meta = escapeHtml((u.is_admin === true ? "Admin" : "User") + " · " + formatDate(u.created_at));
      return "<li class='admin-activity-item'><span class='name'>" + name + "</span><span class='meta'>" + meta + "</span></li>";
    }).join("");
  }

  async function loadStats() {
    // Admin-only: queries run only when isAdmin === true
    const isAdmin = window.__DHA_IS_ADMIN__ === true;
    if (!isAdmin) return;

    const statusEl = document.getElementById("adminStatus");
    if (statusEl) statusEl.textContent = "Loading stats...";

    try {
      const [totalUsers, totalFlashcards, totalSolves, totalTasks] = await Promise.all([
        fetchCount("profiles"),
        fetchCount("flashcards"),
        fetchCount("solves"),
        fetchCount("daily_tasks")
      ]);
      setText("adminTotalUsers", totalUsers);
      setText("adminTotalFlashcards", totalFlashcards);
      setText("adminTotalSolves", totalSolves);
      setText("adminTotalTasks", totalTasks);

      const recent = await fetchRecentUsers();
      renderActivity(recent);

      if (statusEl) statusEl.textContent = "";
    } catch (e) {
      console.error("Admin stats load failed", e);
      if (statusEl) {
        statusEl.textContent = "Failed to load stats: " + (e?.message || e);
        statusEl.classList.add("error");
      }
    }
  }

  async function init() {
    const section = document.getElementById("adminInsights");
    if (!section) return;

    // Hidden by default; only admins will reveal it.
    section.style.display = "none";

    const user = await getCurrentUser();
    const admin = await isAdminUser(user);
    window.__DHA_IS_ADMIN__ = admin === true;

    if (!admin) {
      // Non-admin: remove section entirely, no fetches.
      section.remove();
      return;
    }

    section.style.display = "";

    const toggleBtn = document.getElementById("adminToggleBtn");
    const body = document.getElementById("adminConsoleBody");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        section.classList.toggle("collapsed");
        const collapsed = section.classList.contains("collapsed");
        toggleBtn.textContent = collapsed ? "Expand" : "Collapse";
        toggleBtn.setAttribute("aria-expanded", String(!collapsed));
      });
    }

    const refreshBtn = document.getElementById("adminRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        loadStats();
      });
    }

    await loadStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
