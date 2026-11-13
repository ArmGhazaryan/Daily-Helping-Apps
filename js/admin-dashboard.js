// 🟢 Admin Dashboard logic
(function () {
    'use strict';

    let currentUserId = null;
    let currentUserEmail = null;
    let allUsers = [];

    function denyAccess() {
        try { alert('Access Denied'); } catch (e) { /* noop */ }
        window.location.replace('../index.html');
    }

    function showLoading() {
        const loadingEl = document.getElementById('admin-loading');
        const mainEl = document.querySelector('main.admin-container');
        if (loadingEl) loadingEl.classList.remove('is-hidden');
        if (mainEl) mainEl.classList.add('is-hidden');
    }

    function hideLoading() {
        const loadingEl = document.getElementById('admin-loading');
        const mainEl = document.querySelector('main.admin-container');
        if (loadingEl) loadingEl.classList.add('is-hidden');
        if (mainEl) mainEl.classList.remove('is-hidden');
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function getClient() {
        return typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient;
    }

    async function checkAdminAccess() {
        showLoading();
        const client = getClient();

        try {
            // 1. Wait for Supabase session to resolve (retry to allow localStorage restoration)
            let sessionData;
            for (let attempt = 1; attempt <= 5; attempt++) {
                const result = await client.auth.getSession();
                sessionData = result.data;
                if (sessionData?.session) break;
                if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 150));
            }
            const session = sessionData?.session;

            if (!session || !session.user) {
                alert("Access Denied: Please sign in as an admin.");
                window.location.href = "../index.html";
                return;
            }

            const user = session.user;
            let isAdmin = false;

            // Check 1: Metadata Role
            if (user.user_metadata?.role === 'admin') {
                isAdmin = true;
            } else {
                // Check 2: Database Profile is_admin column
                try {
                    const { data, error } = await client
                        .from('profiles')
                        .select('is_admin')
                        .eq('id', user.id)
                        .maybeSingle();
                    if (!error && data?.is_admin === true) {
                        isAdmin = true;
                    }
                } catch (e) {
                    console.error('Admin profile check failed:', e);
                }
            }

            if (!isAdmin) {
                alert("Access Denied: Admin privileges required.");
                window.location.href = "../index.html";
                return;
            }

            // Set current user info
            currentUserId = user?.id || null;
            currentUserEmail = user?.email || null;

            // If verified admin, initialize Dashboard data rendering
            hideLoading();
            if (typeof loadDashboard === 'function') {
                await loadDashboard();
            }
        } catch (e) {
            console.error('Admin guard error:', e);
            hideLoading();
            denyAccess();
        }
    }

    function renderMetrics(users) {
        const total = users.length;
        const admins = users.filter(u => u.is_admin === true).length;
        const regular = total - admins;

        const totalEl = document.getElementById('metricTotal');
        const adminsEl = document.getElementById('metricAdmins');
        const regularEl = document.getElementById('metricRegular');
        if (totalEl) totalEl.textContent = total;
        if (adminsEl) adminsEl.textContent = admins;
        if (regularEl) regularEl.textContent = regular;
    }

    function roleBadge(isAdmin) {
        return isAdmin
            ? '<span class="role-badge role-admin">Admin</span>'
            : '<span class="role-badge role-user">User</span>';
    }

    function renderTable(tbodyId, users) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No users found.</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(function (u) {
            const idOrEmail = u.email ? u.email : (u.id || '—');
            const username = u.username || '—';
            const isAdmin = u.is_admin === true;
            const isSelf = !!(currentUserId && u.id === currentUserId) ||
                          !!(currentUserEmail && u.email && u.email === currentUserEmail);
            const toggleLabel = isAdmin ? 'Demote to User' : 'Promote to Admin';

            let actionsHtml = '';
            if (isSelf) {
                actionsHtml = `
                    <button class="action-btn toggle-btn" type="button" disabled title="You cannot modify your own account" aria-label="Toggle Admin Role">${escapeHtml(toggleLabel)}</button>
                    <button class="action-btn delete-btn" type="button" disabled title="You cannot delete your own account" aria-label="Delete User">Delete User</button>
                `;
            } else {
                actionsHtml = `
                    <button class="action-btn toggle-btn" type="button" data-user-id="${escapeHtml(u.id)}" data-action="toggle" aria-label="Toggle Admin Role">${escapeHtml(toggleLabel)}</button>
                    <button class="action-btn delete-btn" type="button" data-user-id="${escapeHtml(u.id)}" data-action="delete" aria-label="Delete User">Delete User</button>
                `;
            }

            return `
                <tr data-user-id="${escapeHtml(u.id || '')}">
                    <td>${escapeHtml(idOrEmail)}</td>
                    <td>${escapeHtml(username)}</td>
                    <td>${escapeHtml(formatDate(u.created_at))}</td>
                    <td>${roleBadge(isAdmin)}</td>
                    <td class="actions-cell">${actionsHtml}</td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('button[data-action="toggle"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleAdminRole(btn.getAttribute('data-user-id'));
            });
        });
        tbody.querySelectorAll('button[data-action="delete"]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteUser(btn.getAttribute('data-user-id'));
            });
        });
    }

    async function toggleAdminRole(userId) {
        if (!userId) return;
        if (userId === currentUserId) {
            alert('You cannot modify your own account.');
            return;
        }

        const target = (allUsers || []).find(function (u) { return u.id === userId; });
        const newStatus = !(target && target.is_admin === true);

        const client = getClient();
        const statusEl = document.getElementById('adminStatus');
        try {
            const { error } = await client
                .from('profiles')
                .update({ is_admin: newStatus })
                .eq('id', userId);

            if (error) throw error;

            if (statusEl) {
                statusEl.textContent = 'User role updated successfully.';
                statusEl.classList.remove('error');
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification('User role updated successfully.');
            }
            alert('User role updated successfully.');
            await loadDashboard();
        } catch (e) {
            console.error('Failed to update user role:', e);
            if (statusEl) {
                statusEl.textContent = 'Failed to update user role: ' + (e?.message || e);
                statusEl.classList.add('error');
            }
            alert('Failed to update user role: ' + (e?.message || e));
        }
    }

    async function deleteUser(userId) {
        if (!userId) return;
        if (userId === currentUserId) {
            alert('You cannot delete your own account.');
            return;
        }

        const confirmed = confirm('Are you sure you want to delete this user?');
        if (!confirmed) return;

        const client = getClient();
        const statusEl = document.getElementById('adminStatus');
        try {
            const { error } = await client
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            if (statusEl) {
                statusEl.textContent = 'User deleted successfully.';
                statusEl.classList.remove('error');
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification('User deleted successfully.');
            }
            alert('User deleted successfully.');
            await loadDashboard();
        } catch (e) {
            console.error('Failed to delete user:', e);
            if (statusEl) {
                statusEl.textContent = 'Failed to delete user: ' + (e?.message || e);
                statusEl.classList.add('error');
            }
            alert('Failed to delete user: ' + (e?.message || e));
        }
    }

    async function loadDashboard() {
        const client = getClient();
        const statusEl = document.getElementById('adminStatus');
        try {
            const { data, error } = await client
                .from('profiles')
                .select('*');

            if (error) throw error;

            const users = Array.isArray(data) ? data : [];
            allUsers = users;
            const admins = users.filter(u => u.is_admin === true);
            const regular = users.filter(u => u.is_admin !== true);

            renderMetrics(users);
            renderTable('adminsTableBody', admins);
            renderTable('usersTableBody', regular);

            if (statusEl) statusEl.textContent = '';
        } catch (e) {
            console.error('Failed to load dashboard:', e);
            if (statusEl) {
                statusEl.textContent = 'Failed to load user data: ' + (e?.message || e);
                statusEl.classList.add('error');
            }
        }
    }

    window.toggleAdminRole = toggleAdminRole;
    window.deleteUser = deleteUser;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAdminAccess);
    } else {
        checkAdminAccess();
    }
})();