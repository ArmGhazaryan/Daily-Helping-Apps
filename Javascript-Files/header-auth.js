// 🟢 Header-ի Auth UI-ի թարմացման ֆունկցիա
async function updateHeaderAuth() {
    const authContainer = document.getElementById('auth-header-container');
    if (!authContainer) return;

    // Ստուգում ենք ընթացիկ Session-ը
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session && session.user) {
        const userId = session.user.id;

        // Վերցնում ենք profiles աղյուսակից username-ն ու is_admin-ը
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('username, is_admin')
            .eq('id', userId)
            .single();

        const username = profile?.username || session.user.email.split('@')[0];
        const isAdmin = profile?.is_admin === true;
        const initial = username.charAt(0).toUpperCase();

        // Տեղադրում ենք Profile Badge-ը Header-ում
        authContainer.innerHTML = `
            <div class="user-profile-badge">
                <div class="user-avatar">${initial}</div>
                <span class="username-text">${username}</span>
                ${isAdmin ? '<span class="admin-tag">Admin</span>' : ''}
                <button id="logout-btn" class="logout-btn" title="Log Out">Logout</button>
            </div>
        `;

        // 🟢 Admin Panel քարտի դինամիկ ներդրում (միայն admin-ների համար)
        toggleAdminCard(isAdmin);

        // 🟢 Logout Կոճակի տրամաբանությունը
        document.getElementById('logout-btn')?.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.reload(); // Թարմացնում ենք էջը դուրս գալուց հետո
        });

    } else {
        // Եթե մուտք չի գործել (Guest), ցույց ենք տալիս Log In / Sign Up կոճակը
        const inHtmlFiles = window.location.pathname.includes('/HTML-Files/');
        const authHref = inHtmlFiles ? 'auth.html' : 'HTML-Files/auth.html';
        authContainer.innerHTML = `
            <a href="${authHref}" class="auth-btn" id="nav-auth-btn">Log In / Sign Up</a>
        `;
        toggleAdminCard(false);
    }
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
    link.style.textDecoration = 'none';
    link.style.color = 'inherit';
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