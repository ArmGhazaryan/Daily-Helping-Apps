// 🟢 Admin card sync. The header auth UI (#auth-header-container: Log In / Sign Up,
// user badge, Logout) is owned by js/global-auth.js; this file must not overwrite it.
async function updateHeaderAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session || !session.user) {
        toggleAdminCard(false);
        return;
    }
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle();
    toggleAdminCard(profile?.is_admin === true);
}

// 🟢 Admin Panel քարտի ավելացում/հեռացում գլխավոր էջի grid-ում
function toggleAdminCard(isAdmin) {
    const grid = document.querySelector('.grid-container');
    if (!grid) return;

    const existing = document.getElementById('admin-panel-card');
    if (!isAdmin) {
        if (existing) existing.remove();
        return;
    }
    if (existing) return;

    const link = document.createElement('a');
    link.id = 'admin-panel-card';
    link.href = 'HTML-Files/admin-dashboard.html';
    link.classList.add('admin-panel-link');
    link.innerHTML = `
        <div class="glass-card admin-card">
            <div class="card-icon">🛡️</div>
            <h2>Admin Panel</h2>
            <p>Manage users & view analytics</p>
            <div class="card-action">Open Dashboard →</div>
        </div>
    `;
    grid.appendChild(link);
}

// 🟢 Լսում ենք Auth վիճակի փոփոխությունները (Login/Logout)
supabaseClient.auth.onAuthStateChange(() => {
    updateHeaderAuth();
});

// Էջը բեռնվելիս գործարկում ենք
document.addEventListener('DOMContentLoaded', updateHeaderAuth);