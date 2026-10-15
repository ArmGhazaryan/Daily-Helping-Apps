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
        const isAdmin = profile?.is_admin || false;
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

        // 🟢 Logout Կոճակի տրամաբանությունը
        document.getElementById('logout-btn')?.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.reload(); // Թարմացնում ենք էջը դուրս գալուց հետո
        });

    } else {
        // Եթե մուտք չի գործել (Guest), ցույց ենք տալիս Log In / Sign Up կոճակը
        authContainer.innerHTML = `
            <a href="HTML-Files/auth.html" class="auth-btn" id="nav-auth-btn">Log In / Sign Up</a>
        `;
    }
}

// 🟢 Լսում ենք Auth վիճակի փոփոխությունները (Login/Logout)
supabaseClient.auth.onAuthStateChange(() => {
    updateHeaderAuth();
});

// Էջը բեռնվելիս գործարկում ենք
document.addEventListener('DOMContentLoaded', updateHeaderAuth);