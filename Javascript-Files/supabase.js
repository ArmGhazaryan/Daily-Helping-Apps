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