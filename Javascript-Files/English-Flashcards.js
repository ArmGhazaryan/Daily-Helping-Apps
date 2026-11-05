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
    let currentUserId = null;
    let isAdmin = false;

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
        flashcardsData = filtered;
        if (currentIndex >= flashcardsData.length) currentIndex = 0;
        loadCard(currentIndex);
        updateFavoritesCounter();
        updateSidebarCounts();
        updateSidebarActive();
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
        if (modal) modal.style.display = 'flex';
    }

    async function toggleFavorite() {
        if (!flashcardsData.length) return;
        const card = flashcardsData[currentIndex];
        if (!card || !card.id) {
            // guest cards have no id; require login anyway handled below
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || !session.user) {
            alert('Please sign in to save favorites or add custom words.');
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
            if (data.id !== undefined && data.id !== null) miniCard.dataset.id = String(data.id);

            miniCard.addEventListener('click', () => {
                currentIndex = index;
                loadCard(currentIndex);
            });

            cardsGallery.appendChild(miniCard);
        });
    }

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
            if(addToMyWordsBtn) addToMyWordsBtn.style.display = 'none';
            if(adminDeleteBtn) adminDeleteBtn.style.display = 'none';
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
        }

        if (addToMyWordsBtn) {
            const isGlobal = data && data.is_global === true;
            if (isGlobal) {
                addToMyWordsBtn.style.display = '';
                const already = allFlashcardsData.some(c => c.is_global === false && String(c.user_id) === String(currentUserId) && c.word === data.word);
                if (already) {
                    addToMyWordsBtn.disabled = true;
                    addToMyWordsBtn.textContent = '📌 In My Words';
                } else {
                    addToMyWordsBtn.disabled = false;
                    addToMyWordsBtn.textContent = '➕ Add to My Words';
                }
            } else {
                addToMyWordsBtn.style.display = 'none';
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
        if(backDefinition) backDefinition.textContent = data.definition;
        if(backExample) backExample.textContent = data.example ? `"${data.example}"` : '';

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
        card.addEventListener('click', () => {
            if (flashcardsData.length > 0) card.classList.toggle('is-flipped');
        });
    }

    if(nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentIndex < flashcardsData.length - 1) {
                currentIndex++;
                loadCard(currentIndex);
            }
        });
    }

    if(prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                loadCard(currentIndex);
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

    // Hide speaker buttons if speechSynthesis is not supported
    if (!isSpeechSupported()) {
        document.querySelectorAll('.speak-btn').forEach(btn => btn.style.display = 'none');
    }

    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite();
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
                alert('Please sign in to add words to your library');
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
            alert('Please sign in to save favorites or add custom words.');
            showAuthModal();
            return;
        }
        if (modal) modal.style.display = 'flex';
        const admin = await isAdminUser(user);
        if (adminGlobalToggle) {
            adminGlobalToggle.classList.toggle('hidden', !admin);
        }
        if (!admin && newIsGlobal) newIsGlobal.checked = false;
    });

    function closeModal() {
        if(modal) modal.style.display = 'none';
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
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
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
        var matchingGameBtn = document.getElementById('matchingGameBtn');

        var mainViews = document.querySelectorAll('.top-actions, #cardsGallery, #emptyState, .flashcard-container, .controls');

        var timerStart = 0;
        var elapsed = 0;
        var timerRunning = false;
        var timerInterval = null;
        var score = 0;
        var attempts = 0;
        var matchedPairs = 0;
        var selected = [];
        var matchedIds = new Set();
        var gameCards = [];

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

        function shuffle(array) {
            for (var i = array.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = array[i]; array[i] = array[j]; array[j] = tmp;
            }
            return array;
        }

        function escapeHtml(str) {
            var d = document.createElement('div');
            d.textContent = str;
            return d.innerHTML;
        }
        function buildGameCards() {
            // Respects the user's current filter, including level filters A1-C2.
            var pool = flashcardsData.filter(function (c) {
                return c.word && (c.translation || c.definition);
            });
            if (pool.length < 6) return null;
            var picked = shuffle(pool.slice()).slice(0, 6);
            var cards = [];
            picked.forEach(function (c, i) {
                var pairId = 'p' + i;
                var text = (c.translation && c.translation.trim()) ? c.translation : c.definition;
                cards.push({ id: 'w' + i, pairId: pairId, type: 'word', text: c.word });
                cards.push({ id: 'd' + i, pairId: pairId, type: 'def', text: text });
            });
            return shuffle(cards);
        }

        function renderGrid() {
            grid.innerHTML = '';
            gameCards.forEach(function (card) {
                var el = document.createElement('button');
                el.type = 'button';
                el.className = 'matching-card';
                el.setAttribute('role', 'button');
                el.setAttribute('aria-label', card.text);
                el.dataset.pairId = card.pairId;
                el.dataset.cardId = card.id;
                el.dataset.type = card.type;
                var inner = document.createElement('div');
                inner.className = 'matching-card-inner';
                var back = document.createElement('div');
                back.className = 'matching-card-face matching-card-back';
                back.textContent = '\u2753';
                var front = document.createElement('div');
                front.className = 'matching-card-face matching-card-front';
                var typeSpan = document.createElement('span');
                typeSpan.className = 'card-type';
                typeSpan.textContent = card.type === 'word' ? 'Word' : 'Translation';
                var textDiv = document.createElement('div');
                textDiv.className = 'card-text';
                textDiv.textContent = card.text;
                front.appendChild(typeSpan);
                front.appendChild(textDiv);
                inner.appendChild(back);
                inner.appendChild(front);
                el.appendChild(inner);
                (function (elRef, pid) {
                    elRef.addEventListener('click', function () { handleCardClick(elRef, pid); });
                })(el, card.pairId);
                grid.appendChild(el);
            });
        }

        function handleCardClick(el, pairId) {
            if (matchedIds.has(pairId)) return;
            if (selected.length >= 2) return;
            if (selected.some(function (s) { return s.el === el; })) return;
            if (!timerRunning) startTimer();

            flipCard(el, true);
            selected.push({ el: el, pairId: pairId });

            if (selected.length === 2) {
                attempts++;
                var a = selected[0], b = selected[1];
                if (a.pairId === b.pairId) {
                    matchedIds.add(a.pairId);
                    matchedPairs++;
                    score += 100;
                    scoreEl.textContent = 'Score: ' + score;
                    pairsEl.textContent = 'Pairs: ' + matchedPairs + '/6';
                    a.el.classList.add('card-correct', 'matched');
                    b.el.classList.add('card-correct', 'matched');
                    playSound('correct');
                    selected = [];
                    if (matchedPairs === 6) {
                        stopTimer();
                        showCompletion();
                    }
                } else {
                    a.el.classList.add('card-wrong');
                    b.el.classList.add('card-wrong');
                    playSound('wrong');
                    setTimeout(function () {
                        a.el.classList.remove('card-wrong');
                        b.el.classList.remove('card-wrong');
                        flipCard(a.el, false);
                        flipCard(b.el, false);
                        selected = [];
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
            selected = [];
            matchedIds = new Set();
            scoreEl.textContent = 'Score: 0';
            pairsEl.textContent = 'Pairs: 0/6';
        }

        function showGame(show) {
            if (!section) return;
            if (show) {
                var cards = buildGameCards();
                if (!cards) {
                    grid.innerHTML = '';
                    grid.classList.add('mg-hidden');
                    if (emptyMsg) emptyMsg.classList.remove('mg-hidden');
                    section.classList.remove('mg-hidden');
                    mainViews.forEach(function (v) { if (v) v.classList.add('mg-hidden'); });
                    return;
                }
                if (emptyMsg) emptyMsg.classList.add('mg-hidden');
                grid.classList.remove('mg-hidden');
                section.classList.remove('mg-hidden');
                mainViews.forEach(function (v) { if (v) v.classList.add('mg-hidden'); });
                resetGameState();
                gameCards = cards;
                renderGrid();
            } else {
                section.classList.add('mg-hidden');
                mainViews.forEach(function (v) { if (v) v.classList.remove('mg-hidden'); });
                stopTimer();
            }
        }

        function showCompletion() {
            if (!modal) return;
            var totalSec = (Date.now() - timerStart + elapsed) / 1000;
            resultTime.textContent = 'Time: ' + totalSec.toFixed(1) + 's';
            var acc = attempts > 0 ? Math.round((matchedPairs / attempts) * 100) : 100;
            resultAccuracy.textContent = 'Accuracy: ' + acc + '%';
            resultTitle.textContent = '🎉 Congratulations!';
            modal.style.display = 'flex';
        }

        function hideCompletion() {
            if (modal) modal.style.display = 'none';
        }

        if (matchingGameBtn) matchingGameBtn.addEventListener('click', function () { showGame(true); });
        if (exitBtn) exitBtn.addEventListener('click', function () { hideCompletion(); showGame(false); });
        if (playAgainBtn) playAgainBtn.addEventListener('click', function () { hideCompletion(); showGame(true); });
        if (closeBtn) closeBtn.addEventListener('click', function () { hideCompletion(); showGame(false); });
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) { hideCompletion(); showGame(false); } });

        window.matchingGame = { show: function () { showGame(true); }, hide: function () { showGame(false); } };
    })();
    await syncGuestFlashcardsToSupabase();
    await fetchAndRenderCards();

    // Refresh favorites when auth state changes
    supabaseClient.auth.onAuthStateChange(async () => {
        const user = await getCurrentUser();
        isAdmin = await isAdminUser(user);
        currentUserId = user?.id || null;
        await loadFavorites();
        applyFilter(false);
    });
});
