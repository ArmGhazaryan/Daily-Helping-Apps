// ==========================================
// 🟢 1. AUTH & HYBRID DATA HELPERS (Guest + Cloud)
// ==========================================

// Լռելյայն ստուգում ենք օգտատիրոջը (առանց forced alert/redirect-ի)
async function getCurrentUser() {
    if (typeof supabaseClient === 'undefined') return null;
    try {
        // Առաջին հերթին ստուգում ենք persisted session-ը (mobile persistence)
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.warn('Session resolution pending:', sessionError.message);
        }
        const session = sessionData?.session;
        if (session && session.user) {
            // Ստուգում ենք token-ի ժամկետը; եթե լրացել է, autoRefreshToken-ը թարմացնում է ֆոնում
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
                    // Ֆոնային թարմացումը չհաջողվեց; guest ռեժիմ
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
// LocalStorage Helper-ներ Guest ռեժիմի համար
function getLocalFlashcards() {
    return JSON.parse(localStorage.getItem('guest_flashcards')) || [];
}

function saveLocalFlashcards(cards) {
    localStorage.setItem('guest_flashcards', JSON.stringify(cards));
}

// Եթե Guest-ը հետո Log in լինի, նրա Local բառերը կտեղափոխվեն Supabase
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
        example: card.example_sentence || card.example || '',
        is_global: false
    }));

    const { error } = await supabaseClient.from('flashcards').insert(cardsToInsert);
    if (!error) {
        console.log("Guest cards migrated successfully!");
        localStorage.removeItem('guest_flashcards');
    }
}

// Բեռնում (Cloud կամ Local)
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

        const globalCards = globalResult.data;
        const customCards = customResult.data;
        const globalError = globalResult.error;
        const customError = customResult.error;

        if (globalError) console.error("Error loading global flashcards:", globalError.message);
        if (customError) console.error("Error loading custom flashcards:", customError.message);

        const combined = [...(globalCards || []), ...(customCards || [])];
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

        if (!guestResult.error && Array.isArray(guestResult.data) && guestResult.data.length > 0) {
            return guestResult.data;
        }

        // Fallback to local demo cards if global fetch fails/empty
        let localCards = getLocalFlashcards();
        if (localCards.length === 0) {
            localCards = [
                { word: "Serendipity", level: "C1", definition: "The occurrence and development of events by chance in a happy or beneficial way.", example_sentence: "We found the perfect restaurant by pure serendipity.", is_global: false },
                { word: "Resilient", level: "B2", definition: "Able to withstand or recover quickly from difficult conditions.", example_sentence: "She's a resilient girl - she won't let this failure get her down.", is_global: false },
                { word: "Adequate", level: "B1", definition: "Satisfactory or acceptable in quality or quantity.", example_sentence: "This office is perfectly adequate for my needs.", is_global: false }
            ];
            saveLocalFlashcards(localCards);
        }
        return localCards;
    }
}

// Պահպանում (Cloud կամ Local)
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

// Ջնջում (Cloud կամ Local)
async function deleteFlashcard(wordToDelete) {
    const user = await getCurrentUser();

    if (user) {
        const { error } = await supabaseClient
            .from('flashcards')
            .delete()
            .eq('word', wordToDelete)
            .eq('user_id', user.id)
            .eq('is_global', false);
        return !error;
    } else {
        let localCards = getLocalFlashcards();
        localCards = localCards.filter(card => card.word !== wordToDelete);
        saveLocalFlashcards(localCards);
        return true;
    }
}


// ==========================================
// 🟢 2. MAIN APPLICATION LOGIC (DOM & UI)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    let flashcardsData = [];
    let currentIndex = 0;
    let allFlashcardsData = [];
    let favoriteIds = new Set();
    let currentFilter = 'all';
    let currentUserId = null;

    // DOM Էլեմենտներ
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
    const speakBtn = document.getElementById('speakBtn');
    const backSpeakBtn = document.getElementById('backSpeakBtn');
    const counter = document.getElementById('counter');
    const cardsGallery = document.getElementById('cardsGallery');
    const favoriteBtn = document.getElementById('favoriteBtn');
    const ownershipBadge = document.getElementById('frontOwnership');
    const favoritesCount = document.getElementById('favoritesCount');

    const filterAllWords = document.getElementById('filterAllWords');
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

    // 1. ԲԱՌԵՐԻ ՍՏԱՑՈՒՄ ԵՎ ՆԿԱՐՈՒՄ
    async function fetchAndRenderCards() {
        const user = await getCurrentUser();
        currentUserId = user?.id || null;
        const data = await loadFlashcards();

        allFlashcardsData = data.map(item => ({
            id: item.id,
            user_id: item.user_id,
            is_global: item.is_global === true,
            word: item.word,
            level: item.level,
            definition: item.definition,
            example: item.example || item.example_sentence || ''
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
        updateSidebarActive();
    }

    function updateFavoritesCounter() {
        const matchedCount = allFlashcardsData.filter(card => favoriteIds.has(String(card.id))).length;
        if (favoritesCount) {
            favoritesCount.textContent = `(${matchedCount})`;
        }
        // update button text to "Favorites (n)"? already
    }

    function updateSidebarActive() {
        const links = [filterAllWords, filterOfficial, filterMyWords, filterFavorites, filterAllLevels, filterA1, filterA2, filterB1, filterB2, filterC1, filterC2];
        const filterMap = {
            all: filterAllWords,
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

            miniCard.addEventListener('click', () => {
                currentIndex = index;
                loadCard(currentIndex);
            });

            cardsGallery.appendChild(miniCard);
        });
    }

    function loadCard(index) {
        if (flashcardsData.length === 0) {
            if(frontWord) frontWord.textContent = "Դատարկ է";
            if(backWord) backWord.textContent = "";
            if(backDefinition) backDefinition.textContent = "Խնդրում ենք ավելացնել նոր բառեր:";
            if(backExample) backExample.textContent = "";
            if(frontLevel) { frontLevel.textContent = "-"; frontLevel.style.backgroundColor = '#475569'; }
            if(backLevel) { backLevel.textContent = "-"; backLevel.style.backgroundColor = '#475569'; }
            if(counter) counter.textContent = "0 / 0";

            if(prevBtn) prevBtn.disabled = true;
            if(nextBtn) nextBtn.disabled = true;
            if(deleteBtn) deleteBtn.disabled = true;
            if(cardsGallery) cardsGallery.innerHTML = '';
            if(card) card.classList.remove('is-flipped');
            return;
        }

        const data = flashcardsData[index];

        if (deleteBtn) {
            const isGlobal = data && data.is_global === true;
            deleteBtn.style.display = isGlobal ? 'none' : '';
            deleteBtn.disabled = isGlobal;
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
                ownershipBadge.textContent = '🌐 DHA Official';
                ownershipBadge.className = 'ownership-badge global';
            } else {
                ownershipBadge.textContent = '👤 My Word';
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
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.85;
            window.speechSynthesis.speak(utterance);
        }
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

    filterAllWords?.addEventListener('click', () => setFilter('all'));
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
    levelAccordionHeader?.addEventListener('click', () => {
        levelAccordion?.classList.toggle('open');
    });

    // 4. DELETE
    if(deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (flashcardsData.length === 0) return;

            const currentCard = flashcardsData[currentIndex];
            const isConfirmed = confirm(`Վստա՞հ եք, որ ցանկանում եք ջնջել "${currentCard.word}" բառը:`);

            if (isConfirmed) {
                const isDeleted = await deleteFlashcard(currentCard.word);
                if (!isDeleted) {
                    alert("Չհաջողվեց ջնջել բառը:");
                    return;
                }
                currentIndex = 0;
                fetchAndRenderCards();
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

    if(saveWordBtn) {
        saveWordBtn.addEventListener('click', async () => {
            const wordVal = document.getElementById('newWord').value.trim();
            const defVal = document.getElementById('newDefinition').value.trim();
            const exVal = document.getElementById('newExample').value.trim();
            const levelVal = document.getElementById('newLevel').value;

            if (!wordVal || !defVal) {
                alert("Խնդրում ենք լրացնել 'Word' և 'Definition' դաշտերը:");
                return;
            }

            const user = await getCurrentUser();
            const admin = await isAdminUser(user);
            const isGlobal = admin && !!newIsGlobal?.checked;
            const isSaved = await saveFlashcard(wordVal, defVal, exVal, levelVal, isGlobal);
            if (isSaved) {
                closeModal();
                fetchAndRenderCards();
            } else {
                console.error('Failed to save flashcard.');
            }
        });
    }

    // Եթե user-ը log in է եղած, սինխրոնացնում ենք Guest բառերը դեպի Cloud
    await syncGuestFlashcardsToSupabase();
    await fetchAndRenderCards();

    // Refresh favorites when auth state changes
    supabaseClient.auth.onAuthStateChange(async () => {
        await loadFavorites();
        applyFilter(false);
    });
});