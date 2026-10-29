// 🟢 JS-Files/supabase.js
const SUPABASE_URL = 'https://ypdjnzqkvqgjcrgtefsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7_tQfI0y-jCQODj2RGMxyw_MSXMfHlb'; // Քո Publishable Key-ը


// Ավելացնում ենք Auth persistence options
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,        // Պահպանում է session-ը localStorage-ում
        autoRefreshToken: true,      // Ավտոմատ թարմացնում է 1 ժամը լրանալիս
        detectSessionInUrl: true,    // Ստուգում է URL-ը redirect-ների ժամանակ
        storageKey: 'sb_auth_token'  // Հստակ բանալի storage-ի համար
    }
});
// 🟢 Google OAuth trigger
async function signInWithGoogle() {
  console.log("signInWithGoogle triggered");
  const currentOrigin = window.location.origin + window.location.pathname;
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: currentOrigin
    }
  });
  if (error) console.error('Google Sign-In Error:', error.message);
}

// 🟢 Profile auto-creation / synchronization
async function ensureProfile(user) {
  if (!user) return;
  try {
    const { data: existing, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Profile check error:', fetchError.message);
      return;
    }
    if (existing) return;

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
    const { error: insertError } = await supabaseClient.from('profiles').insert({
      id: user.id,
      username: fullName,
      email: user.email,
      is_admin: false
    });
    if (insertError) console.error('Profile insert error:', insertError.message);
  } catch (e) {
    console.error('ensureProfile error:', e);
  }
}

// 🟢 Handle session resolution (e.g. after OAuth redirect back to the app)
async function handleAuthRedirect() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    await ensureProfile(session.user);
  }
}

// 🟢 Event delegation for Google Sign-In buttons (robust DOM binding)
document.addEventListener('click', function (e) {
  if (e.target.closest('#google-login-btn') || e.target.closest('.google-auth-btn')) {
    console.log('Google Auth button clicked dynamically!');
    signInWithGoogle();
  }
});

// Auto-run session resolution on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleAuthRedirect);
} else {
  handleAuthRedirect();
}

// React to auth state changes (covers OAuth redirect resolution)
supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) await ensureProfile(session.user);
});

// 🟢 Favorites helpers for user_favorites table
async function fetchUserFavoriteIds(userId) {
    if (!userId) return [];
    try {
        const { data, error } = await supabaseClient
            .from('user_favorites')
            .select('word_id')
            .eq('user_id', userId);
        if (error) {
            console.error('fetchUserFavoriteIds error:', error.message);
            return [];
        }
        return (data || []).map(row => row.word_id);
    } catch (e) {
        console.error('fetchUserFavoriteIds error:', e);
        return [];
    }
}

async function insertUserFavorite(userId, wordId) {
    return supabaseClient.from('user_favorites').insert({ user_id: userId, word_id: wordId });
}

async function deleteUserFavorite(userId, wordId) {
    return supabaseClient.from('user_favorites').delete().eq('user_id', userId).eq('word_id', wordId);
}
