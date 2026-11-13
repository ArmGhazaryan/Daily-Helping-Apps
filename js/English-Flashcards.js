// Ã°Å¸Â§Â¹ Purge legacy flashcard caching / mock data on load
(function purgeLegacyFlashcardCache() {
    try {
        ['dha_flashcards', 'flashcards', 'guest_flashcards'].forEach((key) => {
            try { localStorage.removeItem(key); } catch (e) {}
            try { sessionStorage.removeItem(key); } catch (e) {}
        });
    } catch (e) {}
})();

// ==========================================
// Ã°Å¸Å¸Â¢ 1. AUTH & HYBRID DATA HELPERS (Guest + Cloud)
// ==========================================

// Ã”Â¼Ã•Â¼Ã•Â¥Ã•Â¬Ã•ÂµÃ•Â¡Ã•ÂµÃ•Â¶ Ã•Â½Ã•Â¿Ã•Â¸Ã–â€šÃ•Â£Ã•Â¸Ã–â€šÃ•Â´ Ã•Â¥Ã•Â¶Ã–â€ž Ã–â€¦Ã•Â£Ã•Â¿Ã•Â¡Ã•Â¿Ã•Â«Ã–â‚¬Ã•Â¸Ã•Â»Ã•Â¨ (Ã•Â¡Ã•Â¼Ã•Â¡Ã•Â¶Ã–Â forced alert/redirect-Ã•Â«)
async function getCurrentUser() {
    if (typeof supabaseClient === 'undefined') return null;
    try {
        // Ã”Â±Ã•Â¼Ã•Â¡Ã•Â»Ã•Â«Ã•Â¶ Ã•Â°Ã•Â¥Ã–â‚¬Ã•Â©Ã•Â«Ã•Â¶ Ã•Â½Ã•Â¿Ã•Â¸Ã–â€šÃ•Â£Ã•Â¸Ã–â€šÃ•Â´ Ã•Â¥Ã•Â¶Ã–â€ž persisted session-Ã•Â¨ (mobile persistence)
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.warn('Session resolution pending:', sessionError.message);
        }
        const session = sessionData?.session;
        if (session && session.user) {
            // Ã•ÂÃ•Â¿Ã•Â¸Ã–â€šÃ•Â£Ã•Â¸Ã–â€šÃ•Â´ Ã•Â¥Ã•Â¶Ã–â€ž token-Ã•Â« Ã•ÂªÃ•Â¡Ã•Â´Ã•Â¯Ã•Â¥Ã•Â¿Ã•Â¨; Ã•Â¥Ã•Â©Ã•Â¥ Ã•Â¬Ã–â‚¬Ã•Â¡Ã–ÂÃ•Â¥Ã•Â¬ Ã•Â§, autoRefreshToken-Ã•Â¨ Ã•Â©Ã•Â¡Ã–â‚¬Ã•Â´Ã•Â¡Ã–ÂÃ•Â¶Ã•Â¸Ã–â€šÃ•Â´ Ã•Â§ Ã–â€ Ã•Â¸Ã•Â¶Ã•Â¸Ã–â€šÃ•Â´
            const expiresAt = session.expires_at;
            const now = Math.floor(Date.now() / 1000);
            if (expiresAt && now >= expiresAt) {
                try {
                    const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
                    if (refreshError) {
                        console.warn('Token refresh pending:', refreshError.message);
                    }
                    if (refreshData?.session?.user) {
                        return refreshData.session.user;
                    }
                } catch (refreshErr) {
                    // Ã•â€“Ã•Â¸Ã•Â¶Ã•Â¡Ã•ÂµÃ•Â«Ã•Â¶ Ã•Â©Ã•Â¡Ã–â‚¬Ã•Â´Ã•Â¡Ã–ÂÃ•Â¸Ã–â€šÃ•Â´Ã•Â¨ Ã•Â¹Ã•Â°Ã•Â¡Ã•Â»Ã•Â¸Ã•Â²Ã•Â¾Ã•Â¥Ã–Â; guest Ã•Â¼Ã•Â¥Ã•ÂªÃ•Â«Ã•Â´
                }
                return null;
            }
            return session.user;
        }
        return null;
    } catch (e) {
        return null;
    }
}


async function isAdminUser(user) {
    if (!user) return false;
    if (user.user_metadata?.role === 'admin') return true;
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .maybeSingle();
        if (!error && data?.is_admin === true) return true;
    } catch (e) {
        // ignore
    }
    return false;
}
// LocalStorage Helper-Ã•Â¶Ã•Â¥Ã–â‚¬ Guest Ã•Â¼Ã•Â¥Ã•ÂªÃ•Â«Ã•Â´Ã•Â« Ã•Â°Ã•Â¡Ã•Â´Ã•Â¡Ã–â‚¬
function getLocalFlashcards() {
    const raw = localStorage.getItem('guest_flashcards');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveLocalFlashcards(cards) {
    localStorage.setItem('guest_flashcards', JSON.stringify(cards));
}

// Ã”ÂµÃ•Â©Ã•Â¥ Guest-Ã•Â¨ Ã•Â°Ã•Â¥Ã•Â¿Ã•Â¸ Log in Ã•Â¬Ã•Â«Ã•Â¶Ã•Â«, Ã•Â¶Ã–â‚¬Ã•Â¡ Local Ã•Â¢Ã•Â¡Ã•Â¼Ã•Â¥Ã–â‚¬Ã•Â¨ Ã•Â¯Ã•Â¿Ã•Â¥Ã•Â²Ã•Â¡Ã–Æ’Ã•Â¸Ã•Â­Ã•Â¾Ã•Â¥Ã•Â¶ Supabase
async function syncGuestFlashcardsToSupabase() {
    const user = await getCurrentUser();
    if (!user) return;

    const guestCards = getLocalFlashcards();
    if (guestCards.length === 0) return;

    const cardsToInsert = guestCards.map(card => ({
        user_id: user.id,
        word: card.word,
        level: card.level || 'B2',
        definition: card.definition,
        translation: card.translation || '',
        example: card.example || card.example_sentence || '',
        is_global: false
    }));

    const { error } = await supabaseClient.from('flashcards').insert(cardsToInsert);
    if (!error) {
        localStorage.removeItem('guest_flashcards');
    }
}

// Ã”Â²Ã•Â¥Ã•Â¼Ã•Â¶Ã•Â¸Ã–â€šÃ•Â´ (Cloud Ã•Â¯Ã•Â¡Ã•Â´ Local)
async function loadFlashcards() {
    const user = await getCurrentUser();

    if (user) {
        // Logged-in mode: load global system cards + user's custom cards
        let globalResult = await supabaseClient
            .from('flashcards')
            .select('*')
            .eq('is_global', true)
            .order('created_at', { ascending: false });

        if (globalResult.error) {
            console.warn('Global fetch with created_at failed, retrying without order:', globalResult.error.message);
            globalResult = await supabaseClient
                .from('flashcards')
                .select('*')
                .eq('is_global', true);
        }

        let customResult = await supabaseClient
            .from('flashcards')
            .select('*')
            .eq('is_global', false)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (customResult.error) {
            console.warn('Custom fetch with created_at failed, retrying without order:', customResult.error.message);
            customResult = await supabaseClient
                .from('flashcards')
                .select('*')
                .eq('is_global', false)
                .eq('user_id', user.id);
        }

        const globalCards = globalResult.data || [];
        const customCards = customResult.data || [];
        const globalError = globalResult.error;
        const customError = customResult.error;

        if (globalError) console.error("Error loading global flashcards:", globalError.message);
        if (customError) console.error("Error loading custom flashcards:", customError.message);

        // When querying Supabase for user custom words (is_global === false), if the
        // returned array is empty (data.length === 0), do NOT inject any default cards.
        // (No fallback injection; leave as-is from Supabase.)

        const combined = [...globalCards, ...customCards];
        // de-duplicate by id just in case
        const seen = new Set();
        const unique = combined.filter(card => {
            if (!card.id || seen.has(card.id)) return !card.id ? true : false;
            seen.add(card.id);
            return true;
        });
        return unique;
    } else {
        // Guest mode: fetch official global cards (no auth required)
        let guestResult = await supabaseClient
            .from('flashcards')
            .select('*')
            .eq('is_global', true)
            .order('created_at', { ascending: false });

        if (guestResult.error) {
            console.warn('Guest global fetch with created_at failed, retrying without order:', guestResult.error.message);
            guestResult = await supabaseClient
                .from('flashcards')
                .select('*')
                .eq('is_global', true);
        }

        if (!guestResult.error && Array.isArray(guestResult.data)) {
            return guestResult.data;
        }

        // Global library is loaded ONLY from Supabase; never merge/fall back to
        // local hardcoded mock cards.
        return [];
    }
}

// Ã•â€žÃ•Â¡Ã–â€žÃ•Â¸Ã–â€šÃ–â‚¬ Supabase fetch (Ã•Â¡Ã•Â¼Ã•Â¡Ã•Â¶Ã–Â local fallback)
async function fetchFlashcards() {
    try {
        const { data, error } = await supabaseClient
            .from('flashcards')
            .select('*');
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('Error fetching flashcards:', err?.message || err);
        return [];
    }
}

// Ã•Å Ã•Â¡Ã•Â°Ã•ÂºÃ•Â¡Ã•Â¶Ã•Â¸Ã–â€šÃ•Â´ (Cloud Ã•Â¯Ã•Â¡Ã•Â´ Local)
async function saveFlashcard(word, definition, example, level, isGlobal) {
    const user = await getCurrentUser();

    if (user) {
        const { error } = await supabaseClient
            .from('flashcards')
            .insert([{
                user_id: user.id,
                word: word,
                level: level,
                definition: definition,
                translation: '',
                example: example,
                is_global: isGlobal === true
            }]);
        if (error) {
            console.error('Supabase insert error:', error.message);
            return false;
        }
        return true;
    } else {
        const localCards = getLocalFlashcards();
        localCards.unshift({
            word: word,
            level: level,
            definition: definition,
            translation: '',
            example: example,
            is_global: false
        });
        saveLocalFlashcards(localCards);
        return true;
    }
}

// Ã•â€¹Ã•Â¶Ã•Â»Ã•Â¸Ã–â€šÃ•Â´ (Cloud Ã•Â¯Ã•Â¡Ã•Â´ Local)
async function deleteFlashcard(card) {
    const user = await getCurrentUser();

    if (user) {
        if (!card || card.is_global === true || String(card.user_id) !== String(user.id)) {
            return false;
        }
        const { error } = await supabaseClient
            .from('flashcards')
            .delete()
            .eq('id', card.id)
            .eq('user_id', user.id);
        if (error) {
            console.error('Error deleting flashcard:', error.message);
            return false;
        }
        return true;
    } else {
        let localCards = getLocalFlashcards();
        const wordToDelete = typeof card === 'string' ? card : card?.word;
        localCards = localCards.filter(c => c.word !== wordToDelete);
        saveLocalFlashcards(localCards);
        return true;
    }
}


// ==========================================
// Ã°Å¸Å¸Â¢ 2. MAIN APPLICATION LOGIC (DOM & UI)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    let flashcardsData = [];
    let currentIndex = 0;
    let allFlashcardsData = [];
    let favoriteIds = new Set();
    let currentFilter = 'official';
    let currentPracticeFilter = 'all';
    let currentUserId = null;
    let isAdmin = false;
    // Personal memory notes — single source of truth synced to Supabase (user_notes table)
    window.dha_memory_notes = window.dha_memory_notes || {};

    // DOM Ã”Â·Ã•Â¬Ã•Â¥Ã•Â´Ã•Â¥Ã•Â¶Ã•Â¿Ã•Â¶Ã•Â¥Ã–â‚¬
    const card = document.getElementById('myCard');
    const frontWord = document.getElementById('frontWord');
    const backWord = document.getElementById('backWord');
    const frontLevel = document.getElementById('frontLevel');
    const backLevel = document.getElementById('backLevel');
    const backDefinition = document.getElementById('backDefinition');
    const backExample = document.getElementById('backExample');

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const addToMyWordsBtn = document.getElementById('addToMyWordsBtn');
    const adminDeleteBtn = document.getElementById('adminDeleteBtn');
    const speakBtn = document.getElementById('speakBtn');
    const backSpeakBtn = document.getElementById('backSpeakBtn');
    const exampleSpeakBtn = document.getElementById('exampleSpeakBtn');
    const counter = document.getElementById('counter');
    const cardsGallery = document.getElementById('cardsGallery');
    const emptyState = document.getElementById('emptyState');
    const favoriteBtn = document.getElementById('favoriteBtn');
    const ownershipBadge = document.getElementById('frontOwnership');
    const favoritesCount = document.getElementById('favoritesCount');

    const filterOfficial = document.getElementById('filterOfficial');
    const filterMyWords = document.getElementById('filterMyWords');
    const filterFavorites = document.getElementById('filterFavorites');
    const filterAllLevels = document.getElementById('filterAllLevels');
    const filterA1 = document.getElementById('filterA1');
    const filterA2 = document.getElementById('filterA2');
    const filterB1 = document.getElementById('filterB1');
    const filterB2 = document.getElementById('filterB2');
    const filterC1 = document.getElementById('filterC1');
    const filterC2 = document.getElementById('filterC2');

    const filterAllWordsBtn = document.getElementById('filterAllWordsBtn');
    const filterFavoritesBtn = document.getElementById('filterFavoritesBtn');

    const levelAccordion = document.getElementById('levelAccordion');
    const levelAccordionHeader = document.getElementById('levelAccordionHeader');

    const modal = document.getElementById('addWordModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveWordBtn = document.getElementById('saveWordBtn');
    const adminGlobalToggle = document.getElementById('adminGlobalToggle');
    const newIsGlobal = document.getElementById('newIsGlobal');

    // 1. Ã”Â²Ã”Â±Ã•Å’Ã”ÂµÃ•ÂÃ”Â» Ã•ÂÃ•ÂÃ”Â±Ã•â€˜Ã•Ë†Ã•â€™Ã•â€ž Ã”ÂµÃ•Å½ Ã•â€ Ã”Â¿Ã”Â±Ã•ÂÃ•Ë†Ã•â€™Ã•â€ž
    async function fetchAndRenderCards() {
        const user = await getCurrentUser();
        currentUserId = user?.id || null;
        isAdmin = await isAdminUser(user);
        const data = await loadFlashcards();

        allFlashcardsData = data.map(item => ({
            id: item.id,
            user_id: item.user_id,
            is_global: item.is_global === true,
            word: item.word,
            level: item.level,
            definition: item.definition,
            example: item.example || item.example_sentence || '',
            translation: item.translation || ''
        }));

        await loadFavorites();
        await loadNotes();
        applyFilter(false);
    }

    async function loadFavorites() {
        favoriteIds = new Set();
        const user = await getCurrentUser();
        if (!user) {
            updateFavoritesCounter();
            updateHeartUI();
            return;
        }
        try {
            const { data, error } = await supabaseClient
                .from('user_favorites')
                .select('word_id')
                .eq('user_id', user.id);
            if (error) {
                console.error('Error loading favorites:', error.message);
                return;
            }
            (data || []).forEach(row => {
                if (row.word_id !== null && row.word_id !== undefined) {
                    favoriteIds.add(String(row.word_id));
                }
            });
        } catch (e) {
            console.error('loadFavorites error:', e);
        }
        updateFavoritesCounter();
        updateHeartUI();
    }

    // ==========================================
    // PERSONAL MEMORY NOTES
    // ==========================================

    async function loadNotes() {
        if (!currentUserId) return;
        try {
            const { data, error } = await supabaseClient
                .from('user_notes')
                .select('word_id, note_text')
                .eq('user_id', currentUserId);
            
            if (error) throw error;
            
            window.dha_memory_notes = {};
            if (data) {
                data.forEach(item => {
                    window.dha_memory_notes[item.word_id.toString().toLowerCase()] = item.note_text;
                });
            }
            if (typeof renderCard === 'function' && typeof currentIndex !== 'undefined') {
                renderCard(currentIndex);
            }
        } catch (err) {
            console.error("Error fetching notes from Supabase:", err);
        }
    }

    async function saveNote(wordId, text) {
        if (!wordId || !currentUserId) return;
        const key = wordId.toString().toLowerCase();
        
        window.dha_memory_notes[key] = text;
        if (typeof renderCard === 'function' && typeof currentIndex !== 'undefined') {
            renderCard(currentIndex);
        }

        try {
            const { error } = await supabaseClient
                .from('user_notes')
                .upsert({
                    user_id: currentUserId,
                    word_id: key,
                    note_text: text,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, word_id' });
                
            if (error) throw error;
        } catch (err) {
            console.error("Error saving note to Supabase:", err);
        }
    }

    async function deleteNote(wordId) {
        if (!currentUserId) return;
        const key = wordId.toString().toLowerCase();
        
        delete window.dha_memory_notes[key];
        if (typeof renderCard === 'function' && typeof currentIndex !== 'undefined') {
            renderCard(currentIndex);
        }

        try {
            const { error } = await supabaseClient
                .from('user_notes')
                .delete()
                .eq('user_id', currentUserId)
                .eq('word_id', key);
                
            if (error) throw error;
        } catch (err) {
            console.error("Error deleting note from Supabase:", err);
        }
    }

    function applyFilter(resetIndex) {
        if (resetIndex) currentIndex = 0;
        let filtered = allFlashcardsData.slice();
        if (currentFilter === 'favorites') {
            filtered = filtered.filter(card => favoriteIds.has(String(card.id)));
        } else if (currentFilter === 'official') {
            filtered = filtered.filter(card => card.is_global === true);
        } else if (currentFilter === 'myWords') {
            filtered = filtered.filter(card => card.is_global === false && String(card.user_id) === String(currentUserId));
        } else if (['A1','A2','B1','B2','C1','C2'].includes(currentFilter)) {
            filtered = filtered.filter(card => card.level === currentFilter);
        }

        // Dynamically deduplicate words for any combined view (e.g., allLevels or level-specific filters)
        if (currentFilter !== 'official' && currentFilter !== 'myWords') {
            // Prioritize custom words (is_global: false) over official ones
            filtered.sort((a, b) => (a.is_global === b.is_global) ? 0 : a.is_global ? 1 : -1);

            const seenWords = new Set();
            filtered = filtered.filter(card => {
                const wordLower = card.word.toLowerCase().trim();
                if (seenWords.has(wordLower)) return false;
                seenWords.add(wordLower);
                return true;
            });
        }
        flashcardsData = filtered;
        if (currentIndex >= flashcardsData.length) currentIndex = 0;
        loadCard(currentIndex);
        updateFavoritesCounter();
        updateSidebarCounts();
        updateSidebarActive();
    }

    function getFilteredCards() {
        if (currentPracticeFilter === 'all') {
            return flashcardsData;
        }
        // Favorites mode: only favorited cards
        return flashcardsData.filter((card) =>
            favoriteIds.has(String(card.id))
        );
    }

    function showFavoritesWarning(message) {
        const msgEl = document.getElementById('favoritesWarningMsg');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.classList.remove('is-hidden');
        }
    }

    function hideFavoritesWarning() {
        const msgEl = document.getElementById('favoritesWarningMsg');
        if (msgEl) msgEl.classList.add('is-hidden');
    }

    function switchPracticeFilter(mode) {
        currentPracticeFilter = mode;
        hideFavoritesWarning();
        if (filterAllWordsBtn) {
            filterAllWordsBtn.classList.toggle('active', mode === 'all');
        }
        if (filterFavoritesBtn) {
            filterFavoritesBtn.classList.toggle('active', mode === 'favorites');
        }
        // Reset active game screens back to their start screens
        if (typeof window.matchingGame !== 'undefined' && window.matchingGame.hide) {
            window.matchingGame.hide();
        }
        const fillBlankContent = document.getElementById('fillBlankGameContent');
        const fillBlankStart = document.getElementById('fillBlankStartScreen');
        if (fillBlankContent && fillBlankStart && fillBlankContent.classList.contains('is-hidden')) {
            fillBlankContent.classList.remove('is-hidden');
            fillBlankStart.classList.add('game-start-screen');
        }
        const spellingContent = document.getElementById('spellingGameContent');
        const spellingStart = document.getElementById('spellingStartScreen');
        if (spellingContent && spellingStart && spellingContent.classList.contains('is-hidden')) {
            spellingContent.classList.remove('is-hidden');
            spellingStart.classList.add('game-start-screen');
        }
        const voiceContent = document.getElementById('voiceGameContent');
        const voiceStart = document.getElementById('voiceStartScreen');
        if (voiceContent && voiceStart && voiceContent.classList.contains('is-hidden')) {
            voiceContent.classList.remove('is-hidden');
            voiceStart.classList.add('game-start-screen');
        }
    }

    function updateFavoritesCounter() {
        const matchedCount = allFlashcardsData.filter(card => favoriteIds.has(String(card.id))).length;
        if (favoritesCount) {
            favoritesCount.textContent = `(${matchedCount})`;
        }
        // update button text to "Favorites (n)"? already
    }
    function updateSidebarCounts() {
        const myCount = allFlashcardsData.filter(card => card.is_global === false && String(card.user_id) === String(currentUserId)).length;
        const myEl = document.getElementById('myWordsCount');
        if (myEl) myEl.textContent = `(${myCount})`;
    }

    function updateSidebarActive() {
        const links = [filterOfficial, filterMyWords, filterFavorites, filterAllLevels, filterA1, filterA2, filterB1, filterB2, filterC1, filterC2];
        const filterMap = {
            official: filterOfficial,
            myWords: filterMyWords,
            favorites: filterFavorites,
            allLevels: filterAllLevels,
            A1: filterA1,
            A2: filterA2,
            B1: filterB1,
            B2: filterB2,
            C1: filterC1,
            C2: filterC2
        };
        links.forEach(link => {
            if (!link) return;
            link.classList.remove('active');
        });
        const activeLink = filterMap[currentFilter];
        if (activeLink) activeLink.classList.add('active');
    }

    function updateHeartUI() {
        if (!favoriteBtn) return;
        const card = flashcardsData[currentIndex];
        const isFav = !!(card && favoriteIds.has(String(card.id)));
        favoriteBtn.textContent = isFav ? '❤️' : '🤍';
        favoriteBtn.classList.toggle('favorited', isFav);
    }

    function showAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('is-hidden');
            modal.classList.add('is-visible');
        }
    }

    async function toggleFavorite() {
        if (!flashcardsData.length) return;
        const card = flashcardsData[currentIndex];
        if (!card || !card.id) {
            // guest cards have no id; require login anyway handled below
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || !session.user) {
            showAuthModal();
            return;
        }

        const user = session.user;
        const wasFav = favoriteIds.has(String(card.id));

        if (wasFav) {
            favoriteIds.delete(String(card.id));
            try {
                await supabaseClient
                    .from('user_favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('word_id', card.id);
            } catch (e) {
                console.error('Unfavorite error:', e);
            }
        } else {
            favoriteIds.add(String(card.id));
            try {
                await supabaseClient
                    .from('user_favorites')
                    .insert({ user_id: user.id, word_id: card.id });
            } catch (e) {
                console.error('Favorite error:', e);
                favoriteIds.delete(card.id);
            }
        }

        updateHeartUI();
        updateFavoritesCounter();

        // If currently viewing favorites, refresh list
        if (currentFilter === 'favorites') {
            applyFilter(false);
        }
    }

    // 2. UI rendering
    function renderGallery() {
        if(!cardsGallery) return;
        cardsGallery.innerHTML = '';
        flashcardsData.forEach((data, index) => {
            const miniCard = document.createElement('div');
            miniCard.className = `mini-card ${index === currentIndex ? 'active' : ''}`;
            miniCard.textContent = data.word;
            miniCard.dataset.index = index;
            if (data.id !== undefined && data.id !== null) miniCard.dataset.id = String(data.id);

            cardsGallery.appendChild(miniCard);
        });
    }

    function renderCard(cardIndex) {
        const currentCard = flashcardsData[cardIndex];
        if (!currentCard) return;

        const noteKey = currentCard.id || currentCard.word.toLowerCase();
        const cardNote = (window.dha_memory_notes && window.dha_memory_notes[noteKey]) ? window.dha_memory_notes[noteKey].trim() : '';

        const notePreviewEl = document.getElementById('cardNotePreview');
        const addNoteBtnEl = document.getElementById('addNoteBtn');

        if (cardNote !== '') {
            // Display note preview on card back
            if (notePreviewEl) {
                notePreviewEl.textContent = `💡 Note: ${cardNote}`;
                notePreviewEl.classList.remove('is-hidden');
            }
            // Update button text on card front
            if (addNoteBtnEl) {
                addNoteBtnEl.innerHTML = '✏️ Edit Note';
                addNoteBtnEl.classList.add('has-note');
            }
        } else {
            // Hide note preview if no note exists
            if (notePreviewEl) {
                notePreviewEl.classList.add('is-hidden');
                notePreviewEl.textContent = '';
            }
            // Reset button text on card front
            if (addNoteBtnEl) {
                addNoteBtnEl.innerHTML = '✏️ Note';
                addNoteBtnEl.classList.remove('has-note');
            }
        }

        // --- Adaptive note slot on card back (top-left, opposite the level badge) ---
        const noteSlotEl = document.getElementById('cardBackNoteSlot');
        if (noteSlotEl) {
            if (cardNote !== '') {
                if (cardNote.length <= 25) {
                    // 1. Short note: compact badge directly in top-left
                    noteSlotEl.innerHTML = `<span class="short-note-badge" title="Click to edit" data-note-key="${noteKey}">💡 ${cardNote}</span>`;
                } else {
                    // 2. Long note: View Note button
                    noteSlotEl.innerHTML = `<button class="btn-view-note" data-note-key="${noteKey}">💡 View Note</button>`;
                }
            } else {
                // 3. No note: Add Note button
                noteSlotEl.innerHTML = `<button class="btn-view-note" style="opacity: 0.7;" data-note-key="${noteKey}">✏️ +Note</button>`;
            }
        }
    }

    // Global helper: open the Personal Memory Note modal for a given word/note key
    window.openNoteModal = function (wordKey) {
        let targetCard = null;
        if (Array.isArray(flashcardsData)) {
            targetCard = flashcardsData.find((c) => {
                if (c.id && String(c.id) === String(wordKey)) return true;
                return String(c.word).toLowerCase() === String(wordKey).toLowerCase();
            });
        }
        if (noteModalWord) noteModalWord.textContent = targetCard ? targetCard.word : String(wordKey);
        if (noteTextInput) noteTextInput.value = (window.dha_memory_notes[wordKey] || '').trim();
        if (noteModal) {
            noteModal.classList.remove('is-hidden');
            noteModal.classList.add('is-visible');
        }
    };

    function loadCard(index) {
        if (emptyState) {
            const showEmpty = (flashcardsData.length === 0);
            emptyState.style.display = showEmpty ? 'block' : 'none';
        }

        if (flashcardsData.length === 0) {
            if(frontWord) frontWord.textContent = (currentFilter === 'myWords') ? "No custom words added yet. Click '+ Add New Word' to create one!" : "No words found.";
            if(backWord) backWord.textContent = "";
            if(backDefinition) backDefinition.textContent = "Definition goes here...";
            if(backExample) backExample.textContent = "";
            if(frontLevel) { frontLevel.textContent = "-"; frontLevel.style.backgroundColor = '#475569'; }
            if(backLevel) { backLevel.textContent = "-"; backLevel.style.backgroundColor = '#475569'; }
            if(counter) counter.textContent = "0 / 0";

            if(prevBtn) prevBtn.disabled = true;
            if(nextBtn) nextBtn.disabled = true;
            if(deleteBtn) deleteBtn.disabled = true;
            if(addToMyWordsBtn) addToMyWordsBtn.classList.add('is-hidden');
            if(adminDeleteBtn) adminDeleteBtn.classList.add('is-hidden');
            if(cardsGallery) cardsGallery.innerHTML = '';
            if(card) card.classList.remove('is-flipped');
            return;
        }

        const data = flashcardsData[index];

        if (deleteBtn) {
            const isGlobal = data && data.is_global === true;
            const isOwnedCustom = !isGlobal && String(data.user_id) === String(currentUserId);
            deleteBtn.style.display = isOwnedCustom ? '' : 'none';
            deleteBtn.disabled = !isOwnedCustom;
            if (!isOwnedCustom) deleteBtn.classList.add('is-hidden');
        }

        if (addToMyWordsBtn) {
            const isGlobal = data && data.is_global === true;
            if (isGlobal) {
                addToMyWordsBtn.classList.remove('is-hidden');
                const already = allFlashcardsData.some(c => c.is_global === false && String(c.user_id) === String(currentUserId) && c.word === data.word);
                if (already) {
                    addToMyWordsBtn.disabled = true;
                    addToMyWordsBtn.textContent = '📌 In My Words';
                } else {
                    addToMyWordsBtn.disabled = false;
                    addToMyWordsBtn.textContent = '➕ Add to My Words';
                }
            } else {
                addToMyWordsBtn.classList.add('is-hidden');
            }
        }

        if (adminDeleteBtn) {
            const isGlobal = data && data.is_global === true;
            const showAdminDelete = (isAdmin === true) && (currentFilter === 'official') && isGlobal;
            adminDeleteBtn.style.display = showAdminDelete ? '' : 'none';
            adminDeleteBtn.disabled = !showAdminDelete;
        }

        if(frontWord) frontWord.textContent = data.word;
        if(backWord) backWord.textContent = data.word;
        if(backDefinition) {
            backDefinition.textContent = data.definition;

            // Dynamic font sizing: shrink longer definitions so they fit the card
            if (data.definition && data.definition.length > 140) {
                backDefinition.style.fontSize = '0.9rem';
                backDefinition.style.lineHeight = '1.3';
            } else if (data.definition && data.definition.length > 90) {
                backDefinition.style.fontSize = '1rem';
                backDefinition.style.lineHeight = '1.4';
            } else {
                backDefinition.style.fontSize = '1.15rem';
                backDefinition.style.lineHeight = '1.5';
            }
        }
        if(backExample) {
            backExample.textContent = data.example ? `"${data.example}"` : '';

            // Dynamic font sizing: shrink longer example sentences
            if (data.example && data.example.length > 100) {
                backExample.style.fontSize = '0.85rem';
                backExample.style.padding = '8px 10px';
            } else {
                backExample.style.fontSize = '0.95rem';
                backExample.style.padding = '10px 12px';
            }
        }

        if(frontLevel) frontLevel.textContent = data.level;
        if(backLevel) backLevel.textContent = data.level;

        let levelColor = '#10b981';
        if (data.level === 'B2') levelColor = '#3b82f6';
        if (data.level === 'C1') levelColor = '#8b5cf6';
        if (data.level === 'C2') levelColor = '#ef4444';

        if(frontLevel) frontLevel.style.backgroundColor = levelColor;
        if (ownershipBadge) {
            if (data.is_global === true) {
                ownershipBadge.textContent = '🔒 Official Library';
                ownershipBadge.className = 'ownership-badge global';
            } else {
                ownershipBadge.textContent = '✏️ My Word';
                ownershipBadge.className = 'ownership-badge custom';
            }
        }

        if(backLevel) backLevel.style.backgroundColor = levelColor;

        if(counter) counter.textContent = `${index + 1} / ${flashcardsData.length}`;
        if(prevBtn) prevBtn.disabled = index === 0;
        if(nextBtn) nextBtn.disabled = index === flashcardsData.length - 1;

        // --- Personal Memory Note Preview ---
        renderCard(index);

        if(card) card.classList.remove('is-flipped');
        renderGallery();
        updateHeartUI();

        setTimeout(() => {
            const activeMiniCard = document.querySelector('.mini-card.active');
            if (activeMiniCard) {
                activeMiniCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 50);
    }

    function speakWord(text) {
        if (!isSpeechSupported()) return;
        speakText(text, 'en-US', {
            onStart: () => {
                document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.add('speaking'));
            },
            onEnd: () => {
                document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
            },
            onError: () => {
                document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
            }
        });
    }

    // 3. EVENTS
    if(card) {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            // Opening a memory note must not flip the card.
            if (e.target.closest('.btn-view-note, .short-note-badge')) return;
            if (flashcardsData.length > 0) card.classList.toggle('is-flipped');
        });
    }

    if(nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentIndex < flashcardsData.length - 1) {
                currentIndex++;
                loadCard(currentIndex);
                renderCard(currentIndex);
            }
        });
    }

    if(prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                loadCard(currentIndex);
                renderCard(currentIndex);
            }
        });
    }

    if (speakBtn) {
        speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (flashcardsData.length > 0 && flashcardsData[currentIndex]) {
                speakWord(flashcardsData[currentIndex].word);
            }
        });
    }

    if (backSpeakBtn) {
        backSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (flashcardsData.length > 0 && flashcardsData[currentIndex]) {
                speakWord(flashcardsData[currentIndex].word);
            }
        });
    }

    if (exampleSpeakBtn) {
        exampleSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (flashcardsData.length > 0 && flashcardsData[currentIndex]) {
                const example = flashcardsData[currentIndex].example || flashcardsData[currentIndex].example_sentence || '';
                if (example) {
                    speakText(example, 'en-US', {
                        onStart: () => {
                            document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.add('speaking'));
                        },
                        onEnd: () => {
                            document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
                        },
                        onError: () => {
                            document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.remove('speaking'));
                        }
                    });
                }
            }
        });
    }

    // ==========================================
    // PERSONAL MEMORY NOTE EVENT BINDINGS
    // ==========================================
    const noteModal = document.getElementById('noteModal');
    const noteTextInput = document.getElementById('noteTextInput');
    const noteModalWord = document.getElementById('noteModalWord');
    const closeNoteModalBtn = document.getElementById('closeNoteModalBtn');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const addNoteBtn = document.getElementById('addNoteBtn');

    // Open note modal
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentCard = flashcardsData[currentIndex];
            if (!currentCard) return;
            if (noteModalWord) noteModalWord.textContent = currentCard.word;
            const cardId = String(currentCard.id);
            if (noteTextInput) noteTextInput.value = window.dha_memory_notes[cardId] || '';
            if (noteModal) {
                noteModal.classList.remove('is-hidden');
                noteModal.classList.add('is-visible');
            }
        });
    }

    // Save note
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
            const currentCard = flashcardsData[currentIndex];
            if (!currentCard) return;
            const cardId = String(currentCard.id);
            const text = noteTextInput ? noteTextInput.value.trim() : '';
            if (text) {
                saveNote(cardId, text);
            } else {
                deleteNote(cardId);
            }
            loadCard(currentIndex);
            renderCard(currentIndex);
            if (noteModal) {
                noteModal.classList.add('is-hidden');
                noteModal.classList.remove('is-visible', 'active');
            }
        });
    }

    // Delete note
    if (deleteNoteBtn) {
        deleteNoteBtn.addEventListener('click', () => {
            const currentCard = flashcardsData[currentIndex];
            if (!currentCard) return;
            const cardId = String(currentCard.id);
            deleteNote(cardId);
            loadCard(currentIndex);
            renderCard(currentIndex);
            if (noteModal) {
                noteModal.classList.add('is-hidden');
                noteModal.classList.remove('is-visible', 'active');
            }
        });
    }

    // Close note modal
    if (closeNoteModalBtn) {
        closeNoteModalBtn.addEventListener('click', () => {
            if (noteModal) {
                noteModal.classList.add('is-hidden');
                noteModal.classList.remove('is-visible', 'active');
            }
        });
    }

    // Close note modal on backdrop click
    if (noteModal) {
        noteModal.addEventListener('click', (e) => {
            if (e.target === noteModal) {
                noteModal.classList.add('is-hidden');
                noteModal.classList.remove('is-visible', 'active');
            }
        });
    }

    // Delegate clicks on dynamic note badges/buttons (rendered inside renderCard)
    // to open the Personal Memory Note modal without flipping the card.
    document.addEventListener('click', (e) => {
        const noteBtn = e.target.closest('.btn-view-note, .short-note-badge');
        if (!noteBtn) return;
        e.stopPropagation();
        openNoteModal(noteBtn.dataset.noteKey || '');
    });

    // Hide speaker buttons if speechSynthesis is not supported
    if (!isSpeechSupported()) {
        document.querySelectorAll('.speak-btn').forEach(btn => btn.classList.add('is-hidden'));
    }

    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite();
        });
    }

    // Delegated word-tab (mini-card) clicks: switch the active flashcard immediately.
    if (cardsGallery) {
        cardsGallery.addEventListener('click', (e) => {
            const tab = e.target.closest('.mini-card');
            if (!tab) return;
            const idx = Number(tab.dataset.index);
            if (!Number.isInteger(idx)) return;
            currentIndex = idx;
            loadCard(currentIndex);
            renderCard(currentIndex);
        });
    }

    // Sidebar filters
    function setFilter(filter) {
        currentFilter = filter;
        applyFilter(true);
    }

    filterOfficial?.addEventListener('click', () => setFilter('official'));
    filterMyWords?.addEventListener('click', () => setFilter('myWords'));
    filterFavorites?.addEventListener('click', () => setFilter('favorites'));
    filterAllLevels?.addEventListener('click', () => setFilter('allLevels'));
    filterA1?.addEventListener('click', () => setFilter('A1'));
    filterA2?.addEventListener('click', () => setFilter('A2'));
    filterB1?.addEventListener('click', () => setFilter('B1'));
    filterB2?.addEventListener('click', () => setFilter('B2'));
    filterC1?.addEventListener('click', () => setFilter('C1'));
    filterC2?.addEventListener('click', () => setFilter('C2'));

    // Accordion toggle
    const levelAccordionArrow = levelAccordionHeader?.querySelector('.accordion-arrow');
    levelAccordionHeader?.addEventListener('click', () => {
        const isOpen = levelAccordion?.classList.toggle('open');
        if (levelAccordionArrow) {
            levelAccordionArrow.textContent = isOpen ? '▴' : '▾';
        }
    });

// 4. DELETE
    if(deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (flashcardsData.length === 0) return;

            const card = flashcardsData[currentIndex];
            if (!card) return;

            try {
                const client = (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient) || null;
                if (!client || typeof client.from !== 'function') { alert('Supabase client not initialized properly'); return; }

                // ID Type Safety: card.id must match Supabase primary key column type (UUID vs integer).
                // Supabase handles UUID/integer natively; ensure card.id comes from the DB record.
                const cardId = card.id;

                const { data: sessionData } = await client.auth.getSession();
                const session = sessionData?.session;
                if (card.is_global !== false || !session?.user?.id || String(session.user.id) !== String(card.user_id)) {
                    return;
                }

                if (!confirm("Are you sure you want to delete this word?")) return;

                // RLS Check: Ensure a DELETE policy exists on flashcards table for authenticated users/admins.
                const { data, error } = await client.from('flashcards').delete().eq('id', cardId).select();

                if (error || !data || data.length === 0) {
                    console.error('Database delete failed or 0 rows deleted:', error || 'No matching row deleted');
                    alert('Database delete failed: Item was not deleted from Supabase. Check RLS policies.');
                    return;
                }

                // ONLY remove from localStorage/DOM after Supabase confirms success (error is null).
                const cardElement = cardsGallery?.querySelector(`[data-id="${cardId}"]`) || document.getElementById('myCard');
                if (cardElement) cardElement.remove();

                // Clean up localStorage (guest fallback cache) after successful DB deletion.
                try {
                    const guestCards = getLocalFlashcards();
                    const filtered = guestCards.filter(c => String(c.id) !== String(cardId) && c.word !== card.word);
                    if (filtered.length !== guestCards.length) {
                        saveLocalFlashcards(filtered);
                    }
                } catch (e) { /* ignore localStorage cleanup errors */ }

                const allCards = allFlashcardsData;
                const activeCards = flashcardsData;

                const allIndex = allCards.findIndex(c => c.id === card.id);
                if (allIndex !== -1) allCards.splice(allIndex, 1);

                const activeIndex = activeCards.findIndex(c => c.id === card.id);
                if (activeIndex !== -1) activeCards.splice(activeIndex, 1);

                if (activeCards.length === 0) {
                    currentIndex = 0;
                } else if (currentIndex >= activeCards.length) {
                    currentIndex = activeCards.length - 1;
                } else if (activeIndex !== -1 && activeIndex < currentIndex) {
                    currentIndex -= 1;
                }

                applyFilter(false);
                updateSidebarCounts();
            } catch (err) {
                console.error('Delete error:', err);
            }
        });
    }

    // 4b. ADD TO MY WORDS (official cards)
    if (addToMyWordsBtn) {
        addToMyWordsBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (flashcardsData.length === 0) return;
            const cardData = flashcardsData[currentIndex];
            if (!cardData || cardData.is_global !== true) return;

            const user = await getCurrentUser();
            if (!user) {
                showAuthModal();
                return;
            }

            const already = allFlashcardsData.some(c => c.is_global === false && String(c.user_id) === String(user.id) && c.word === cardData.word);
            if (already) {
                addToMyWordsBtn.disabled = true;
                addToMyWordsBtn.textContent = '📌 In My Words';
                return;
            }

            try {
                const { data: inserted, error } = await supabaseClient
                    .from('flashcards')
                    .insert([{
                        word: cardData.word,
                        level: cardData.level,
                        definition: cardData.definition,
                        translation: cardData.translation || '',
                        example: cardData.example || '',
                        is_global: false,
                        user_id: user.id
                    }])
                    .select();

                if (error) throw error;

                const row = Array.isArray(inserted) ? inserted[0] : inserted;
                const newCard = {
                    id: row?.id,
                    user_id: row?.user_id || user.id,
                    is_global: false,
                    word: row?.word || cardData.word,
                    level: row?.level || cardData.level,
                    definition: row?.definition || cardData.definition,
                    example: row?.example || cardData.example || '',
                    translation: row?.translation || cardData.translation || ''
                };
                allFlashcardsData.push(newCard);

                addToMyWordsBtn.disabled = true;
                addToMyWordsBtn.textContent = '📌 In My Words';
                updateSidebarCounts();
                applyFilter(false);
            } catch (err) {
                console.error('Add to My Words failed:', err?.message || err);
                alert('Failed to add word.');
            }
        });
    }

// 4c. ADMIN DELETE (official cards)
    if (adminDeleteBtn) {
        adminDeleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            const card = flashcardsData[currentIndex];
            if (!card) return;
            const confirmed = confirm("Delete this official word from the database?");
            if (!confirmed) return;
            try {
                const client = (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient) || null;
                if (!client || typeof client.from !== 'function') { alert('Supabase client not initialized properly'); return; }

                // ID Type Safety: card.id must match Supabase primary key column type (UUID vs integer).
                const cardId = card.id;

                // RLS Check: Ensure a DELETE policy exists on flashcards table for authenticated admins.
                const { data, error } = await client.from('flashcards').delete().eq('id', cardId).select();
                if (error || !data || data.length === 0) {
                    console.error('Database delete failed or 0 rows deleted:', error || 'No matching row deleted');
                    alert('Database delete failed: Item was not deleted from Supabase. Check RLS policies.');
                    return;
                }

                // ONLY remove from localStorage/DOM after Supabase confirms success (error is null).
                const cardElement = cardsGallery?.querySelector(`[data-id="${cardId}"]`) || document.getElementById('myCard');
                if (cardElement) cardElement.remove();

                // Clean up localStorage (guest fallback cache) after successful DB deletion.
                try {
                    const guestCards = getLocalFlashcards();
                    const filtered = guestCards.filter(c => String(c.id) !== String(cardId) && c.word !== card.word);
                    if (filtered.length !== guestCards.length) {
                        saveLocalFlashcards(filtered);
                    }
                } catch (e) { /* ignore localStorage cleanup errors */ }

                const allCards = allFlashcardsData;
                const activeCards = flashcardsData;

                const allIndex = allCards.findIndex(c => c.id === card.id);
                if (allIndex !== -1) allCards.splice(allIndex, 1);

                const activeIndex = activeCards.findIndex(c => c.id === card.id);
                if (activeIndex !== -1) activeCards.splice(activeIndex, 1);

                if (activeCards.length === 0) {
                    currentIndex = 0;
                } else if (currentIndex >= activeCards.length) {
                    currentIndex = activeCards.length - 1;
                } else if (activeIndex !== -1 && activeIndex < currentIndex) {
                    currentIndex -= 1;
                }

                applyFilter(false);
                updateSidebarCounts();
            } catch (err) {
                console.error('Delete error:', err);
            }
        });
    }

    // 5. ADD WORD
    if(openModalBtn) openModalBtn.addEventListener('click', async () => {
        const user = await getCurrentUser();
        if (!user) {
            showAuthModal();
            return;
        }
        if (modal) {
            modal.classList.remove('is-hidden');
            modal.classList.add('is-visible');
        }
        const admin = await isAdminUser(user);
        if (adminGlobalToggle) {
            adminGlobalToggle.classList.toggle('hidden', !admin);
        }
        if (!admin && newIsGlobal) newIsGlobal.checked = false;
    });

    function closeModal() {
        if(modal) {
            modal.classList.add('is-hidden');
            modal.classList.remove('is-visible', 'is-visible-flex', 'active');
        }
        document.getElementById('newWord').value = '';
        document.getElementById('newDefinition').value = '';
        document.getElementById('newExample').value = '';
        document.getElementById('newLevel').value = 'B2';
        if (newIsGlobal) newIsGlobal.checked = false;
    }

    if(cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Backdrop click & Escape to close add-word modal
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('is-hidden')) {
            closeModal();
        }
    });

    if(saveWordBtn) {
        saveWordBtn.addEventListener('click', async () => {
            const wordVal = document.getElementById('newWord').value.trim();
            const defVal = document.getElementById('newDefinition').value.trim();
            const exVal = document.getElementById('newExample').value.trim();
            const levelVal = document.getElementById('newLevel').value;

            if (!wordVal || !defVal) {
                alert("Word and Definition are required.");
                return;
            }

            const user = await getCurrentUser();
            const admin = await isAdminUser(user);
            const isGlobal = false; // default all user-submitted flashcards to non-global
            const isSaved = await saveFlashcard(wordVal, defVal, exVal, levelVal, isGlobal);
            if (isSaved) {
                closeModal();
                fetchAndRenderCards();
            } else {
                console.error('Failed to save flashcard.');
            }
        });
    }

    // Ã”ÂµÃ•Â©Ã•Â¥ user-Ã•Â¨ log in Ã•Â§ Ã•Â¥Ã•Â²Ã•Â¡Ã•Â®, Ã•Â½Ã•Â«Ã•Â¶Ã•Â­Ã–â‚¬Ã•Â¸Ã•Â¶Ã•Â¡Ã–ÂÃ•Â¶Ã•Â¸Ã–â€šÃ•Â´ Ã•Â¥Ã•Â¶Ã–â€ž Guest Ã•Â¢Ã•Â¡Ã•Â¼Ã•Â¥Ã–â‚¬Ã•Â¨ Ã•Â¤Ã•Â¥Ã•ÂºÃ•Â« Cloud
(function initMatchingGameFeature() {
        var section = document.getElementById('matching-game-section');
        var grid = document.getElementById('matching-grid');
        var emptyMsg = document.getElementById('matching-empty');
        var timerEl = document.getElementById('matching-timer');
        var scoreEl = document.getElementById('matching-score');
        var pairsEl = document.getElementById('matching-pairs');
        var exitBtn = document.getElementById('matching-exit-btn');
        var modal = document.getElementById('matching-completion-modal');
        var resultTitle = document.getElementById('matching-result-title');
        var resultTime = document.getElementById('matching-result-time');
        var resultAccuracy = document.getElementById('matching-result-accuracy');
        var playAgainBtn = document.getElementById('matching-play-again');
        var closeBtn = document.getElementById('matching-result-close');
        var startScreen = document.getElementById('matchingStartScreen');
        var gameContent = document.getElementById('matchingGameContent');
        var startBtn = document.getElementById('startMatchingBtn');

        var timerStart = 0;
        var elapsed = 0;
        var timerRunning = false;
        var timerInterval = null;
        var score = 0;
        var attempts = 0;
        var matchedPairs = 0;
        var selectedWord = null;
        var selectedDef = null;
        var processing = false;
        var matchedIds = new Set();
        var gameCards = {};

        function fmtTime(ms) { return (ms / 1000).toFixed(1) + 's'; }

        function updateTimer() {
            if (!timerRunning) return;
            timerEl.textContent = 'Time: ' + fmtTime(Date.now() - timerStart + elapsed);
        }

        function startTimer() {
            if (timerRunning) return;
            timerRunning = true;
            timerStart = Date.now();
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateTimer, 50);
            updateTimer();
        }

        function stopTimer() {
            timerRunning = false;
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        }

        function playSound(type) {
            try {
                var Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                var ctx = new Ctx();
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                var now = ctx.currentTime;
                if (type === 'correct') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(660, now);
                    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
                    gain.gain.setValueAtTime(0.14, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    osc.start(now); osc.stop(now + 0.18);
                } else if (type === 'wrong') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(130, now);
                    osc.frequency.exponentialRampToValueAtTime(55, now + 0.2);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                    osc.start(now); osc.stop(now + 0.25);
                } else {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(540, now);
                    gain.gain.setValueAtTime(0.09, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now); osc.stop(now + 0.12);
                }
                setTimeout(function () { try { ctx.close(); } catch (e) {} }, 500);
            } catch (e) { /* audio may be blocked until a user gesture */ }
        }

        function escapeHtml(str) {
            var d = document.createElement('div');
            d.textContent = str;
            return d.innerHTML;
        }
        function buildGameCards() {
            // Respects the user's current filter, including level filters A1-C2.
            var pool = (typeof getFilteredCards === 'function' ? getFilteredCards() : flashcardsData).filter(function (c) {
                return c.word && (c.translation || c.definition);
            });
            if (pool.length < 6) return null;
            var picked = shuffleArray(pool).slice(0, 6);
            var words = [];
            var definitions = [];
            picked.forEach(function (c, i) {
                var pairId = 'p' + i;
                var text = (c.translation && c.translation.trim()) ? c.translation : c.definition;
                words.push({ id: 'w' + i, pairId: pairId, type: 'word', text: c.word });
                definitions.push({ id: 'd' + i, pairId: pairId, type: 'def', text: text });
            });
            return { words: words, definitions: shuffleArray(definitions) };
        }

        function renderGrid() {
            grid.innerHTML = '';
            var wordsCol = document.createElement('div');
            wordsCol.className = 'matching-words';
            var defsCol = document.createElement('div');
            defsCol.className = 'matching-defs';
            grid.appendChild(wordsCol);
            grid.appendChild(defsCol);
            // Left column: words
            (gameCards.words || []).forEach(function (card) {
                wordsCol.appendChild(createCardEl(card));
            });
            // Right column: definitions (shuffled)
            (gameCards.definitions || []).forEach(function (card) {
                defsCol.appendChild(createCardEl(card));
            });
        }

        function createCardEl(card) {
            var el = document.createElement('button');
            el.type = 'button';
            el.className = 'matching-card';
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', card.text);
            el.dataset.pairId = card.pairId;
            el.dataset.cardId = card.id;
            el.dataset.type = card.type;
            var typeSpan = document.createElement('span');
            typeSpan.className = 'card-type';
            typeSpan.textContent = card.type === 'word' ? 'Word' : 'Definition';
            var textDiv = document.createElement('div');
            textDiv.className = 'card-text';
            textDiv.textContent = card.text;
            el.appendChild(typeSpan);
            el.appendChild(textDiv);
            (function (elRef, pid, typ) {
                elRef.addEventListener('click', function () { handleCardClick(elRef, pid, typ); });
            })(el, card.pairId, card.type);
            return el;
        }

        function handleCardClick(el, pairId, type) {
            if (processing) return;
            if (matchedIds.has(pairId)) return;
            if (!timerRunning) startTimer();

            if (type === 'word') {
                if (selectedWord && selectedWord.el === el) {
                    el.classList.remove('selected');
                    selectedWord = null;
                    return;
                }
                if (selectedWord) selectedWord.el.classList.remove('selected');
                selectedWord = { el: el, pairId: pairId };
                el.classList.add('selected');
            } else {
                if (selectedDef && selectedDef.el === el) {
                    el.classList.remove('selected');
                    selectedDef = null;
                    return;
                }
                if (selectedDef) selectedDef.el.classList.remove('selected');
                selectedDef = { el: el, pairId: pairId };
                el.classList.add('selected');
            }

            if (selectedWord && selectedDef) {
                processing = true;
                attempts++;
                if (selectedWord.pairId === selectedDef.pairId) {
                    matchedIds.add(selectedWord.pairId);
                    matchedPairs++;
                    score += 100;
                    scoreEl.textContent = 'Score: ' + score;
                    pairsEl.textContent = 'Pairs: ' + matchedPairs + '/6';
                    selectedWord.el.classList.add('card-correct', 'matched');
                    selectedDef.el.classList.add('card-correct', 'matched');
                    selectedWord.el.disabled = true;
                    selectedDef.el.disabled = true;
                    selectedWord.el.classList.remove('selected');
                    selectedDef.el.classList.remove('selected');
                    playSound('correct');
                    selectedWord = null;
                    selectedDef = null;
                    processing = false;
                    if (matchedPairs === 6) {
                        stopTimer();
                        showCompletion();
                    }
                } else {
                    selectedWord.el.classList.add('card-wrong');
                    selectedDef.el.classList.add('card-wrong');
                    playSound('wrong');
                    setTimeout(function () {
                        selectedWord.el.classList.remove('card-wrong', 'selected', 'matched');
                        selectedDef.el.classList.remove('card-wrong', 'selected', 'matched');
                        selectedWord = null;
                        selectedDef = null;
                        processing = false;
                    }, 600);
                }
            }
        }

        function flipCard(el, faceUp) {
            var inner = el.querySelector('.matching-card-inner');
            if (!inner) return;
            if (faceUp) inner.classList.add('is-flipped');
            else inner.classList.remove('is-flipped');
        }

        function resetGameState() {
            stopTimer();
            timerRunning = false;
            elapsed = 0;
            timerEl.textContent = 'Time: 0.0s';
            score = 0;
            attempts = 0;
            matchedPairs = 0;
            selectedWord = null;
            selectedDef = null;
            processing = false;
            matchedIds = new Set();
            scoreEl.textContent = 'Score: 0';
            pairsEl.textContent = 'Pairs: 0/6';
        }

        function showStartScreen() {
            if (startScreen) startScreen.classList.add('game-start-screen');
            if (gameContent) gameContent.classList.add('is-hidden');
            stopTimer();
            // Clear any active selections
            if (selectedWord) {
                selectedWord.el.classList.remove('selected');
                selectedWord = null;
            }
            if (selectedDef) {
                selectedDef.el.classList.remove('selected');
                selectedDef = null;
            }
        }

        function startGame() {
            if (typeof currentPracticeFilter !== 'undefined' && currentPracticeFilter === 'favorites') {
                var favPool = (typeof getFilteredCards === 'function' ? getFilteredCards() : []).filter(function (c) {
                    return c.word && (c.translation || c.definition);
                });
                if (favPool.length < 6) {
                    showFavoritesWarning('You need at least 6 favorite words to play in Favorites mode! Add more cards to favorites first.');
                    return;
                }
            }
            hideFavoritesWarning();
            if (startScreen) startScreen.classList.add('is-hidden');
            if (gameContent) gameContent.classList.remove('is-hidden');
            showGame(true);
            startTimer();
        }

        function showGame(show) {
            if (!section) return;
            if (show) {
                var cards = buildGameCards();
                if (!cards) {
                    grid.innerHTML = '';
                    grid.classList.add('mg-hidden');
                    if (emptyMsg) emptyMsg.classList.remove('mg-hidden');
                    return;
                }
                if (emptyMsg) emptyMsg.classList.add('mg-hidden');
                grid.classList.remove('mg-hidden');
                resetGameState();
                gameCards = cards;
                renderGrid();
            } else {
                showStartScreen();
            }
        }

        function showCompletion() {
            if (!modal) return;
            var totalSec = (Date.now() - timerStart + elapsed) / 1000;
            resultTime.textContent = 'Time: ' + totalSec.toFixed(1) + 's';
            var acc = attempts > 0 ? Math.round((matchedPairs / attempts) * 100) : 100;
            resultAccuracy.textContent = 'Accuracy: ' + acc + '%';
            resultTitle.textContent = '🎉 Congratulations!';
            modal.classList.remove('is-hidden');
            modal.classList.add('is-visible');
        }

        function hideCompletion() {
            if (modal) {
                modal.classList.add('is-hidden');
                modal.classList.remove('is-visible', 'is-visible-flex', 'active');
            }
        }

        if (exitBtn) exitBtn.addEventListener('click', function () { hideCompletion(); showStartScreen(); });
        if (playAgainBtn) playAgainBtn.addEventListener('click', function () { hideCompletion(); startGame(); });
        if (closeBtn) closeBtn.addEventListener('click', function () { hideCompletion(); showStartScreen(); });
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) { hideCompletion(); showStartScreen(); } });
        if (startBtn) startBtn.addEventListener('click', function () { startGame(); });

        window.matchingGame = { show: function () { startGame(); }, hide: function () { showStartScreen(); } };
    })();

    // ==========================================
    // Fill-in-the-Blank (Context Quiz) Mini-Game
    // ==========================================
    let quizQuestions = [];
    let quizIndex = 0;
    let quizScore = 0;

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function startFillBlankQuiz() {
        if (currentPracticeFilter === 'favorites') {
            var favPool = getFilteredCards ? getFilteredCards().filter(c => c && typeof c.example === 'string' && c.example.trim().length > 0) : [];
            if (favPool.length < 5) {
                showFavoritesWarning('You need at least 5 favorite words to play in Favorites mode! Add more cards to favorites first.');
                return;
            }
        }
        hideFavoritesWarning();
        var poolSource = getFilteredCards ? getFilteredCards() : flashcardsData;
        const pool = poolSource.filter(c => c && typeof c.example === 'string' && c.example.trim().length > 0);
        if (pool.length === 0) {
            alert('No cards with example sentences available for the quiz.');
            return;
        }
        const picked = shuffleArray(getFilteredCards().filter(c => c && c.example)).slice(0, 5);
        quizQuestions = picked.map(card => {
            const sentence = card.example.replace(new RegExp(escapeRegExp(card.word), 'gi'), '<span class="blank-target">______</span>');
            var distractorSource = getFilteredCards ? getFilteredCards() : flashcardsData;
            const distractors = distractorSource
                .filter(c => c && c.word && c.word.toLowerCase() !== card.word.toLowerCase())
                .map(c => c.word);
            const uniqueDistractors = [...new Set(distractors)];
            const pickedDistractors = shuffleArray(uniqueDistractors.slice()).slice(0, 3);
            const options = shuffleArray([card.word, ...pickedDistractors]);
            return { sentence, targetWord: card.word, options };
        });
        quizIndex = 0;
        quizScore = 0;
        const startScreen = document.getElementById('fillBlankStartScreen');
        const gameContent = document.getElementById('fillBlankGameContent');
        if (startScreen) startScreen.style.display = 'none';
        if (gameContent) gameContent.style.display = 'block';
        renderQuizQuestion();
    }

    function renderQuizQuestion() {
        const q = quizQuestions[quizIndex];
        if (!q) return;
        const progressEl = document.getElementById('quizProgress');
        const scoreEl = document.getElementById('quizScore');
        const sentenceEl = document.getElementById('quizSentence');
        const optionsGrid = document.getElementById('quizOptionsGrid');
        const feedbackEl = document.getElementById('quizFeedback');
        if (progressEl) progressEl.textContent = `Question ${quizIndex + 1} / 5`;
        if (scoreEl) scoreEl.textContent = `Score: ${quizScore}`;
        if (sentenceEl) sentenceEl.innerHTML = q.sentence;
        if (feedbackEl) feedbackEl.textContent = '';
        if (optionsGrid) {
            optionsGrid.innerHTML = '';
            q.options.forEach(word => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'quiz-option-btn';
                btn.textContent = word;
                btn.addEventListener('click', () => handleQuizOptionClick(btn, word));
                optionsGrid.appendChild(btn);
            });
        }
    }

    function handleQuizOptionClick(btn, selectedWord) {
        const q = quizQuestions[quizIndex];
        if (!q) return;
        const buttons = document.querySelectorAll('#quizOptionsGrid .quiz-option-btn');
        buttons.forEach(b => b.disabled = true);
        const correctWord = q.targetWord;
        const feedbackEl = document.getElementById('quizFeedback');
        if (selectedWord === correctWord) {
            btn.classList.add('correct');
            quizScore += 10;
            const scoreEl = document.getElementById('quizScore');
            if (scoreEl) scoreEl.textContent = `Score: ${quizScore}`;
            if (feedbackEl) { feedbackEl.textContent = 'Correct! 🎉'; feedbackEl.style.color = '#10b981'; }
        } else {
            btn.classList.add('wrong');
            buttons.forEach(b => { if (b.textContent === correctWord) b.classList.add('correct'); });
            if (feedbackEl) { feedbackEl.textContent = 'Incorrect!'; feedbackEl.style.color = '#ef4444'; }
        }
        setTimeout(() => {
            quizIndex++;
            if (quizIndex < quizQuestions.length) {
                renderQuizQuestion();
            } else {
                showQuizFinished();
            }
        }, 1300);
    }

    function showQuizFinished() {
        const gameContent = document.getElementById('fillBlankGameContent');
        const resultsModal = document.getElementById('fillBlankResultsModal');
        const finalScoreEl = document.getElementById('finalQuizScore');
        const finalAccuracyEl = document.getElementById('finalQuizAccuracy');
        const correctCount = Math.round(quizScore / 10);
        const totalQuestions = quizQuestions.length;
        const maxScore = totalQuestions * 10;
        if (gameContent) gameContent.classList.add('is-hidden');
        if (finalScoreEl) finalScoreEl.textContent = `${quizScore} / ${maxScore}`;
        if (finalAccuracyEl) finalAccuracyEl.textContent = `${correctCount} / ${totalQuestions}`;
        if (resultsModal) {
            resultsModal.classList.remove('is-hidden');
            resultsModal.classList.add('is-visible');
        }
    }

    const startFillBlankBtn = document.getElementById('startFillBlankBtn');
    const exitFillBlankBtn = document.getElementById('exitFillBlankBtn');
    if (startFillBlankBtn) startFillBlankBtn.addEventListener('click', startFillBlankQuiz);
    if (exitFillBlankBtn) exitFillBlankBtn.addEventListener('click', () => {
        const gameContent = document.getElementById('fillBlankGameContent');
        const startScreen = document.getElementById('fillBlankStartScreen');
        if (gameContent) gameContent.classList.add('is-hidden');
        if (startScreen) startScreen.classList.remove('is-hidden');
        quizIndex = 0;
        quizScore = 0;
    });

    const retryFillBlankBtn = document.getElementById('retryFillBlankBtn');
    const closeFillBlankResultsBtn = document.getElementById('closeFillBlankResultsBtn');
    if (retryFillBlankBtn) {
        retryFillBlankBtn.addEventListener('click', () => {
            const resultsModal = document.getElementById('fillBlankResultsModal');
            if (resultsModal) resultsModal.classList.add('is-hidden');
            startFillBlankQuiz();
        });
    }
    if (closeFillBlankResultsBtn) {
        closeFillBlankResultsBtn.addEventListener('click', () => {
            const resultsModal = document.getElementById('fillBlankResultsModal');
            const startScreen = document.getElementById('fillBlankStartScreen');
            if (resultsModal) resultsModal.style.display = 'none';
            if (startScreen) startScreen.style.display = 'block';
            quizIndex = 0;
            quizScore = 0;
        });
    }

    // ==========================================
    // 🎧 Audio Spelling Bee (Listen & Type) Mini-Game
    // ==========================================
    (function initSpellingGame() {
        const startScreen = document.getElementById('spellingStartScreen');
        const gameContent = document.getElementById('spellingGameContent');
        const resultsModal = document.getElementById('spellingResultsModal');
        const startBtn = document.getElementById('startSpellingBtn');
        const exitBtn = document.getElementById('exitSpellingBtn');
        const playAudioBtn = document.getElementById('playAudioBtn');
        const spellingForm = document.getElementById('spellingForm');
        const spellingInput = document.getElementById('spellingInput');
        const spellingFeedback = document.getElementById('spellingFeedback');
        const spellingDefinition = document.getElementById('spellingDefinition');
        const spellingProgress = document.getElementById('spellingProgress');
        const spellingScore = document.getElementById('spellingScore');
        const retryBtn = document.getElementById('retrySpellingBtn');
        const closeBtn = document.getElementById('closeSpellingResultsBtn');
        const finalScoreEl = document.getElementById('finalSpellingScore');
        const finalAccuracyEl = document.getElementById('finalSpellingAccuracy');

        let spellingQuestions = [];
        let spellingIndex = 0;
        let spellingScoreVal = 0;
        let spellingCorrectCount = 0;

        function speakWord(word) {
            if (typeof speechSynthesis !== 'undefined') {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(word);
                utterance.lang = 'en-US';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 1;
                window.speechSynthesis.speak(utterance);
            }
        }

        function stopSpeech() {
            if (typeof speechSynthesis !== 'undefined') {
                window.speechSynthesis.cancel();
            }
        }

        function startSpellingGame() {
            if (currentPracticeFilter === 'favorites') {
                const favPool = (typeof getFilteredCards === 'function' ? getFilteredCards() : []).filter(c => c && c.word);
                if (favPool.length < 5) {
                    showFavoritesWarning('You need at least 5 favorite words to play in Favorites mode! Add more cards to favorites first.');
                    return;
                }
            }
            hideFavoritesWarning();
            const poolSource = (typeof getFilteredCards === 'function' ? getFilteredCards() : flashcardsData);
            const pool = poolSource.filter(c => c && c.word);
            if (pool.length === 0) {
                alert('No words available for the spelling game.');
                return;
            }
            const picked = shuffleArray(getFilteredCards().filter(c => c && c.word)).slice(0, 5);
            spellingQuestions = picked.map(card => ({
                word: card.word,
                definition: card.definition || card.translation || ''
            }));
            spellingIndex = 0;
            spellingScoreVal = 0;
            spellingCorrectCount = 0;
            if (startScreen) startScreen.classList.add('is-hidden');
            if (gameContent) gameContent.classList.remove('is-hidden');
            renderSpellingWord();
        }

        function renderSpellingWord() {
            const q = spellingQuestions[spellingIndex];
            if (!q) return;
            if (spellingProgress) spellingProgress.textContent = `Word ${spellingIndex + 1} / 5`;
            if (spellingScore) spellingScore.textContent = `Score: ${spellingScoreVal}`;
            if (spellingDefinition) spellingDefinition.textContent = q.definition ? q.definition : '';
            if (spellingInput) spellingInput.value = '';
            if (spellingFeedback) spellingFeedback.textContent = '';
            if (spellingInput) spellingInput.disabled = false;
            if (spellingInput) spellingInput.focus();
            stopSpeech();
            speakWord(q.word);
        }

        function handleSpellingSubmit(e) {
            e.preventDefault();
            const q = spellingQuestions[spellingIndex];
            if (!q) return;
            const userAnswer = spellingInput.value.trim();
            const correct = userAnswer.toLowerCase() === q.word.toLowerCase();
            if (correct) {
                spellingScoreVal += 10;
                spellingCorrectCount++;
                if (spellingFeedback) { spellingFeedback.textContent = 'Correct! 🎉'; spellingFeedback.style.color = '#10b981'; }
                if (spellingScore) spellingScore.textContent = `Score: ${spellingScoreVal}`;
            } else {
                if (spellingFeedback) { spellingFeedback.textContent = `Incorrect! The word was "${q.word}".`; spellingFeedback.style.color = '#ef4444'; }
            }
            spellingInput.disabled = true;
            stopSpeech();
            setTimeout(() => {
                spellingIndex++;
                if (spellingIndex < spellingQuestions.length) {
                    renderSpellingWord();
                } else {
                    showSpellingResults();
                }
            }, 1500);
        }

        function showSpellingResults() {
            if (gameContent) gameContent.classList.add('is-hidden');
            if (finalScoreEl) finalScoreEl.textContent = spellingScoreVal;
            if (finalAccuracyEl) finalAccuracyEl.textContent = `${spellingCorrectCount} / 5`;
            if (resultsModal) resultsModal.classList.remove('is-hidden');
            resultsModal.classList.add('is-visible');
            stopSpeech();
        }

        function resetSpellingGame() {
            spellingIndex = 0;
            spellingScoreVal = 0;
            spellingCorrectCount = 0;
            spellingQuestions = [];
            stopSpeech();
            if (gameContent) gameContent.classList.add('is-hidden');
            if (startScreen) startScreen.classList.remove('is-hidden');
            if (resultsModal) {
                resultsModal.classList.add('is-hidden');
                resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
            }
            if (spellingFeedback) spellingFeedback.textContent = '';
        }

        if (startBtn) startBtn.addEventListener('click', startSpellingGame);
        if (exitBtn) exitBtn.addEventListener('click', resetSpellingGame);
        if (playAudioBtn) playAudioBtn.addEventListener('click', () => {
            const q = spellingQuestions[spellingIndex];
            if (q) speakWord(q.word);
        });
        if (spellingForm) spellingForm.addEventListener('submit', handleSpellingSubmit);
        if (retryBtn) retryBtn.addEventListener('click', () => {
            if (resultsModal) {
                resultsModal.classList.add('is-hidden');
                resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
            }
            startSpellingGame();
        });
        if (closeBtn) closeBtn.addEventListener('click', () => {
            if (resultsModal) {
                resultsModal.classList.add('is-hidden');
                resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
            }
            if (startScreen) startScreen.classList.remove('is-hidden');
            resetSpellingGame();
        });
        if (resultsModal) resultsModal.addEventListener('click', (e) => {
            if (e.target === resultsModal) {
                if (resultsModal) {
                    resultsModal.classList.add('is-hidden');
                    resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
                }
                if (startScreen) startScreen.classList.remove('is-hidden');
                resetSpellingGame();
            }
        });

        window.spellingGame = {
            show: function () { startSpellingGame(); },
            hide: function () { resetSpellingGame(); }
        };
    })();

    if (filterAllWordsBtn) {
        filterAllWordsBtn.addEventListener('click', () => {
            if (currentPracticeFilter !== 'all') switchPracticeFilter('all');
        });
    }
    if (filterFavoritesBtn) {
        filterFavoritesBtn.addEventListener('click', () => {
            if (currentPracticeFilter !== 'favorites') switchPracticeFilter('favorites');
        });
    }

    await syncGuestFlashcardsToSupabase();
    await fetchAndRenderCards();

    // Show the pre-game start screen on load — the game only starts when the user clicks "Start Game".
    if (typeof window.matchingGame !== 'undefined') {
        window.matchingGame.hide();
    }
    if (typeof window.voiceGame !== 'undefined') {
        window.voiceGame.hide();
    }

    // Refresh favorites when auth state changes
    supabaseClient.auth.onAuthStateChange(async () => {
        const user = await getCurrentUser();
        isAdmin = await isAdminUser(user);
        currentUserId = user?.id || null;
        await loadNotes();
        await loadFavorites();
        applyFilter(false);
    });

    // ==========================================
    // 🎙️ Voice Pronunciation Checker Mini-Game
    // ==========================================
    (function initVoiceGame() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        const startScreen = document.getElementById('voiceStartScreen');
        const gameContent = document.getElementById('voiceGameContent');
        const resultsModal = document.getElementById('voiceResultsModal');
        const startBtn = document.getElementById('startVoiceBtn');
        const exitBtn = document.getElementById('exitVoiceBtn');
        const listenBtn = document.getElementById('voiceListenBtn');
        const micRecordBtn = document.getElementById('micRecordBtn');
        const micStatusText = document.getElementById('micStatusText');
        const targetWordEl = document.getElementById('voiceTargetWord');
        const targetDefEl = document.getElementById('voiceTargetDef');
        const speechOutput = document.getElementById('speechRecognizedOutput');
        const feedbackEl = document.getElementById('voiceFeedback');
        const progressEl = document.getElementById('voiceProgress');
        const scoreEl = document.getElementById('voiceScore');
        const retryBtn = document.getElementById('retryVoiceBtn');
        const closeBtn = document.getElementById('closeVoiceResultsBtn');
        const finalScoreEl = document.getElementById('finalVoiceScore');
        const finalAccuracyEl = document.getElementById('finalVoiceAccuracy');

        let voiceQuestions = [];
        let voiceIndex = 0;
        let voiceScoreVal = 0;
        let voiceCorrectCount = 0;
        let recognition = null;

        function checkSpeechSupport() {
            return !!SpeechRecognition;
        }

        function speakWord(word) {
            if (typeof speechSynthesis !== 'undefined') {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(word);
                utterance.lang = 'en-US';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 1;
                window.speechSynthesis.speak(utterance);
            }
        }

        function initRecognition() {
            if (!SpeechRecognition) return null;
            const rec = new SpeechRecognition();
            rec.lang = 'en-US';
            rec.interimResults = false;
            rec.maxAlternatives = 1;
            return rec;
        }

        function startVoiceGame() {
            if (!checkSpeechSupport()) {
                if (feedbackEl) {
                    feedbackEl.textContent = 'Speech Recognition is not supported in this browser. Please use Google Chrome or MS Edge.';
                    feedbackEl.style.color = '#ef4444';
                }
                return;
            }

            hideFavoritesWarning();
            const poolSource = (typeof getFilteredCards === 'function' ? getFilteredCards() : flashcardsData);
            const pool = poolSource.filter(c => c && c.word);
            if (pool.length === 0) {
                alert('No words available for the voice game.');
                return;
            }
            const picked = shuffleArray(getFilteredCards().filter(c => c && c.word)).slice(0, 5);
            voiceQuestions = picked.map(card => ({
                word: card.word,
                definition: card.definition || card.translation || ''
            }));
            voiceIndex = 0;
            voiceScoreVal = 0;
            voiceCorrectCount = 0;
            if (startScreen) startScreen.style.display = 'none';
            if (gameContent) gameContent.style.display = 'block';
            if (resultsModal) resultsModal.style.display = 'none';
            renderVoiceWord();
        }

        function renderVoiceWord() {
            const q = voiceQuestions[voiceIndex];
            if (!q) return;
            if (progressEl) progressEl.textContent = `Word ${voiceIndex + 1} / 5`;
            if (scoreEl) scoreEl.textContent = `Score: ${voiceScoreVal}`;
            if (targetWordEl) targetWordEl.textContent = q.word;
            if (targetDefEl) targetDefEl.textContent = q.definition ? q.definition : '';
            if (speechOutput) speechOutput.textContent = '';
            if (feedbackEl) feedbackEl.textContent = '';
            if (micRecordBtn) {
                micRecordBtn.classList.remove('recording');
                micStatusText.textContent = 'Tap to Speak';
            }
            stopRecognition();
        }

        function startRecognition() {
            if (!SpeechRecognition) return;
            stopRecognition();
            recognition = initRecognition();
            recognition.onresult = (e) => {
                const transcript = e.results[0][0].transcript.trim().toLowerCase();
                if (speechOutput) speechOutput.textContent = `You said: "${transcript}"`;
                const q = voiceQuestions[voiceIndex];
                if (!q) return;
                const targetClean = q.word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
                const transcriptClean = transcript.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
                if (transcriptClean === targetClean) {
                    if (feedbackEl) {
                        feedbackEl.textContent = 'Great Pronunciation! 🎉 (+10 pts)';
                        feedbackEl.style.color = '#10b981';
                    }
                    voiceScoreVal += 10;
                    voiceCorrectCount++;
                    if (scoreEl) scoreEl.textContent = `Score: ${voiceScoreVal}`;
                    stopRecognition();
                    setTimeout(() => {
                        voiceIndex++;
                        if (voiceIndex < voiceQuestions.length) {
                            renderVoiceWord();
                        } else {
                            showVoiceResults();
                        }
                    }, 1400);
                } else {
                    if (feedbackEl) {
                        feedbackEl.textContent = `Try again! Expected: ${q.word}`;
                        feedbackEl.style.color = '#ef4444';
                    }
                    stopRecognition();
                }
            };
            recognition.onerror = () => {
                stopRecognition();
                if (micRecordBtn) {
                    micRecordBtn.classList.remove('recording');
                    micStatusText.textContent = 'Tap to Speak';
                }
            };
            recognition.onend = () => {
                stopRecognition();
                if (micRecordBtn) {
                    micRecordBtn.classList.remove('recording');
                    micStatusText.textContent = 'Tap to Speak';
                }
            };
            try {
                recognition.start();
                if (micRecordBtn) {
                    micRecordBtn.classList.add('recording');
                    micStatusText.textContent = 'Listening...';
                }
            } catch (err) {
                console.error('Recognition start error:', err);
            }
        }

        function stopRecognition() {
            if (recognition) {
                try { recognition.stop(); } catch (e) {}
                recognition = null;
            }
            if (micRecordBtn) {
                micRecordBtn.classList.remove('recording');
                micStatusText.textContent = 'Tap to Speak';
            }
        }

        function showVoiceResults() {
            if (gameContent) gameContent.classList.add('is-hidden');
            if (finalScoreEl) finalScoreEl.textContent = voiceScoreVal;
            if (finalAccuracyEl) finalAccuracyEl.textContent = `${voiceCorrectCount} / 5`;
            if (resultsModal) resultsModal.classList.remove('is-hidden');
            resultsModal.classList.add('is-visible');
            stopRecognition();
        }

        function resetVoiceGame() {
            voiceIndex = 0;
            voiceScoreVal = 0;
            voiceCorrectCount = 0;
            voiceQuestions = [];
            stopRecognition();
            if (gameContent) gameContent.classList.add('is-hidden');
            if (startScreen) startScreen.classList.remove('is-hidden');
            if (resultsModal) {
                resultsModal.classList.add('is-hidden');
                resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
            }
            if (feedbackEl) feedbackEl.textContent = '';
            if (speechOutput) speechOutput.textContent = '';
        }

        if (startBtn) startBtn.addEventListener('click', startVoiceGame);
        if (exitBtn) exitBtn.addEventListener('click', resetVoiceGame);
        if (listenBtn) listenBtn.addEventListener('click', () => {
            const q = voiceQuestions[voiceIndex];
            if (q) speakWord(q.word);
        });
        if (micRecordBtn) micRecordBtn.addEventListener('click', startRecognition);
        if (retryBtn) retryBtn.addEventListener('click', () => {
            if (resultsModal) {
                resultsModal.classList.add('is-hidden');
                resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
            }
            startVoiceGame();
        });
        if (closeBtn) closeBtn.addEventListener('click', () => {
            if (resultsModal) {
                resultsModal.classList.add('is-hidden');
                resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
            }
            if (startScreen) startScreen.classList.remove('is-hidden');
            resetVoiceGame();
        });
        if (resultsModal) resultsModal.addEventListener('click', (e) => {
            if (e.target === resultsModal) {
                if (resultsModal) {
                    resultsModal.classList.add('is-hidden');
                    resultsModal.classList.remove('is-visible', 'is-visible-flex', 'active');
                }
                if (startScreen) startScreen.classList.remove('is-hidden');
                resetVoiceGame();
            }
        });

        window.voiceGame = {
            show: function () { startVoiceGame(); },
            hide: function () { resetVoiceGame(); }
        };
    })();
});
