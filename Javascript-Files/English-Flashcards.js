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

    console.log("Migrating guest flashcards to cloud account...");
    const cardsToInsert = guestCards.map(card => ({
        user_id: user.id,
        word: card.word,
        definition: card.definition,
        example_sentence: card.example_sentence || card.example || '',
        level: card.level || 'B2'
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
        // Logged-in mode: Supabase
        const { data, error } = await supabaseClient
            .from('flashcards')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error loading flashcards from Supabase:", error.message);
            return getLocalFlashcards();
        }
        return data || [];
    } else {
        // Guest mode: LocalStorage
        let localCards = getLocalFlashcards();
        if (localCards.length === 0) {
            // Սկզբնական ցուցադրական բառեր Guest-ի համար
            localCards = [
                { word: "Serendipity", level: "C1", definition: "The occurrence and development of events by chance in a happy or beneficial way.", example_sentence: "We found the perfect restaurant by pure serendipity." },
                { word: "Resilient", level: "B2", definition: "Able to withstand or recover quickly from difficult conditions.", example_sentence: "She's a resilient girl - she won't let this failure get her down." },
                { word: "Adequate", level: "B1", definition: "Satisfactory or acceptable in quality or quantity.", example_sentence: "This office is perfectly adequate for my needs." }
            ];
            saveLocalFlashcards(localCards);
        }
        return localCards;
    }
}

// Պահպանում (Cloud կամ Local)
async function saveFlashcard(word, definition, example, level) {
    const user = await getCurrentUser();

    if (user) {
        const { error } = await supabaseClient
            .from('flashcards')
            .insert([{
                user_id: user.id,
                word: word,
                definition: definition,
                example_sentence: example,
                level: level
            }]);
        return !error;
    } else {
        const localCards = getLocalFlashcards();
        localCards.unshift({
            word: word,
            definition: definition,
            example_sentence: example,
            level: level
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
            .eq('user_id', user.id);
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

    const modal = document.getElementById('addWordModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveWordBtn = document.getElementById('saveWordBtn');

    // 1. ԲԱՌԵՐԻ ՍՏԱՑՈՒՄ ԵՎ ՆԿԱՐՈՒՄ
    async function fetchAndRenderCards() {
        const data = await loadFlashcards();
        
        flashcardsData = data.map(item => ({
            word: item.word,
            level: item.level,
            definition: item.definition,
            example: item.example_sentence || item.example || ''
        }));

        if (currentIndex >= flashcardsData.length) currentIndex = 0;
        loadCard(currentIndex);
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

        if(deleteBtn) deleteBtn.disabled = false;
        const data = flashcardsData[index];

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
        if(backLevel) backLevel.style.backgroundColor = levelColor;

        if(counter) counter.textContent = `${index + 1} / ${flashcardsData.length}`;
        if(prevBtn) prevBtn.disabled = index === 0;
        if(nextBtn) nextBtn.disabled = index === flashcardsData.length - 1;

        if(card) card.classList.remove('is-flipped');
        renderGallery();

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
    if(openModalBtn) openModalBtn.addEventListener('click', () => modal.style.display = 'flex');

    function closeModal() {
        if(modal) modal.style.display = 'none';
        document.getElementById('newWord').value = '';
        document.getElementById('newDefinition').value = '';
        document.getElementById('newExample').value = '';
        document.getElementById('newLevel').value = 'B2';
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

            const isSaved = await saveFlashcard(wordVal, defVal, exVal, levelVal);
            if (isSaved) {
                closeModal();
                fetchAndRenderCards();
            } else {
                alert("Սխալ պահպանման ընթացքում:");
            }
        });
    }

    // Եթե user-ը log in է եղած, սինխրոնացնում ենք Guest բառերը դեպի Cloud
    await syncGuestFlashcardsToSupabase();
    await fetchAndRenderCards();
});