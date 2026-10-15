// 🟢 JS-Files/supabase.js
const SUPABASE_URL = 'https://ypdjnzqkvqgjcrgtefsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7_tQfI0y-jCQODj2RGMxyw_MSXMfHlb'; // Քո Publishable Key-ը


window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);