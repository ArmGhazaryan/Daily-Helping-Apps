(function (global) {
    "use strict";

    try {
        ["dha_flashcards", "flashcards", "guest_flashcards"].forEach(function (key) {
            try { if (typeof localStorage !== "undefined") localStorage.removeItem(key); } catch (e) {}
            try { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key); } catch (e) {}
        });
    } catch (e) {}

    function getClient() {
        if (typeof supabaseClient !== "undefined") return supabaseClient;
        if (global && global.supabaseClient) return global.supabaseClient;
        return null;
    }

    function showFlashcardNotification(message, isError) {
        try {
            if (typeof window.showNotification === "function") {
                window.showNotification(message, !!isError);
                return;
            }
        } catch (e) {}
        try {
            var toast = document.createElement("div");
            toast.textContent = message;
            toast.className = "dha-flashcard-toast" + (isError ? " dha-flashcard-toast-error" : "");
            Object.assign(toast.style, {
                position: "fixed",
                top: isError ? "80px" : "20px",
                left: "50%",
                transform: "translateX(-50%)",
                padding: "10px 16px",
                borderRadius: "8px",
                color: "#fff",
                background: isError ? "#ef4444" : "#10b981",
                fontSize: "14px",
                zIndex: 10000,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                pointerEvents: "none",
                opacity: "1",
                transition: "opacity 0.3s ease"
            });
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.style.opacity = "0";
                setTimeout(function () { try { toast.remove(); } catch (e) {} }, 300);
            }, 2500);
        } catch (e) {
            try { alert(message); } catch (e2) {}
        }
    }

    async function fetchFlashcards() {
        var client = getClient();
        if (!client) return [];
        try {
            // Fetch both global official words AND the current user's custom words.
            // This prevents other users' custom words from leaking into this user's library.
            var session = await getSession(client);
            var user = session && session.user ? session.user : null;
            var query = client.from("flashcards").select("*");
            if (user) {
                // OR filter: global words (is_global=true) OR user's own words (user_id match)
                query = query.or("is_global.eq.true,user_id.eq." + user.id);
            } else {
                // Anonymous users only see global official words
                query = query.eq("is_global", true);
            }
            const { data, error } = await query;
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error("fetchFlashcards error:", err?.message || err);
            return [];
        }
    }

    async function isAdminUser(user) {
        if (!user) return false;
        if (user.user_metadata && user.user_metadata.role === "admin") return true;
        var client = getClient();
        if (!client) return false;
        try {
            // Check global admin helper if available
            if (typeof window.dhaIsAdmin === "function") {
                return await window.dhaIsAdmin(user);
            }
            const { data, error } = await client
                .from("profiles")
                .select("is_admin")
                .eq("id", user.id)
                .maybeSingle();
            return !error && data && data.is_admin === true;
        } catch (e) {
            return false;
        }
    }

    async function saveFlashcard(word, definition, example, level, isGlobal) {
        var client = getClient();
        if (!client) return false;

        // Require an active user session before writing (RLS requires user_id).
        var session = await getSession(client);
        var user = session && session.user ? session.user : null;

        // Offline / guest fallback: persist locally and sync later without duplicate keys.
        // Guests are never admins, so is_global is always false for pending items.
        if (!user) {
            try {
                var pending = JSON.parse(localStorage.getItem("dha_flashcards_pending") || "[]");
                if (!Array.isArray(pending)) pending = [];
                pending.push({
                    id: "pending_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
                    word: word,
                    level: level || "B2",
                    definition: definition || "",
                    example: example || "",
                    translation: "",
                    is_global: false,
                    created_at: new Date().toISOString()
                });
                localStorage.setItem("dha_flashcards_pending", JSON.stringify(pending));
            } catch (e) { /* ignore storage errors */ }
            showFlashcardNotification("Saved locally. Sign in to sync to your account.", false);
            return true;
        }

        // Determine if the current user is an admin
        var admin = await isAdminUser(user);

        try {
            var payload = {
                word: word,
                level: level || "B2",
                definition: definition,
                example: example || "",
                translation: ""
            };
            if (admin) {
                // Admin words become global/official for all users
                payload.is_global = true;
            } else {
                // Regular users: personal word, not global
                payload.is_global = false;
                payload.user_id = user.id;
            }
            const { error } = await client.from("flashcards").insert([payload]);
            if (error) throw error;
            await syncPendingFlashcards(user);
            showFlashcardNotification("Word saved.", false);
            return true;
        } catch (err) {
            var msg = err && err.message ? err.message : String(err);
            console.error("saveFlashcard error:", msg);
            showFlashcardNotification("Failed to save word: " + msg, true);
            return false;
        }
    }

    async function syncPendingFlashcards(user) {
        if (!user) return;
        var client = getClient();
        if (!client) return;
        try {
            var pending = JSON.parse(localStorage.getItem("dha_flashcards_pending") || "[]");
            if (!Array.isArray(pending) || pending.length === 0) return;
            var syncedIndexes = [];
            for (var i = 0; i < pending.length; i++) {
                var c = pending[i];
                const { data: existing, error: fetchError } = await client
                    .from("flashcards")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("word", c.word)
                    .eq("level", c.level || "B2")
                    .maybeSingle();
                if (fetchError) throw fetchError;
                if (existing) { syncedIndexes.push(i); continue; }
                const { error } = await client.from("flashcards").insert([{
                    user_id: user.id,
                    word: c.word,
                    level: c.level || "B2",
                    definition: c.definition || "",
                    example: c.example || "",
                    translation: c.translation || "",
                    is_global: c.is_global === true
                }]);
                if (error) throw error;
                syncedIndexes.push(i);
            }
            var remaining = pending.filter(function (_, idx) { return syncedIndexes.indexOf(idx) === -1; });
            if (remaining.length === 0) localStorage.removeItem("dha_flashcards_pending");
            else localStorage.setItem("dha_flashcards_pending", JSON.stringify(remaining));
        } catch (e) {
            console.error("syncPendingFlashcards error:", e?.message || e);
        }
    }

    function normalizeCard(cardOrWord, definition, example, level) {
        if (cardOrWord && typeof cardOrWord === "object" && !Array.isArray(cardOrWord)) {
            return {
                word: cardOrWord.word,
                level: cardOrWord.level || level || "B2",
                definition: cardOrWord.definition !== undefined ? cardOrWord.definition : definition,
                translation: cardOrWord.translation || "",
                example: cardOrWord.example !== undefined ? cardOrWord.example : (example || ""),
                is_global: cardOrWord.is_global === true,
                user_id: cardOrWord.user_id,
                id: cardOrWord.id
            };
        }
        return {
            word: cardOrWord,
            level: level || "B2",
            definition: definition,
            translation: "",
            example: example || "",
            is_global: false,
            user_id: undefined,
            id: undefined
        };
    }

    async function getSession(client) {
        if (!client || !client.auth || typeof client.auth.getSession !== "function") return null;
        try {
            const { data } = await client.auth.getSession();
            return data?.session || null;
        } catch (e) {
            return null;
        }
    }

    async function addToMyWords(cardOrWord, definition, example, level, session) {
        var client = getClient();
        if (!client) return false;

        const card = normalizeCard(cardOrWord, definition, example, level);

        if (!session) session = await getSession(client);
        const user = session?.user;
        if (!user) {
            try { alert("Please sign in to add words to your library"); } catch (e) {}
            try {
                const m = document.getElementById("auth-modal");
                if (m) m.style.display = "flex";
            } catch (e) {}
            return false;
        }

        try {
            const { data: inserted, error } = await client.from("flashcards").insert([{
                word: card.word,
                level: card.level || "B2",
                definition: card.definition,
                translation: card.translation || "",
                example: card.example || "",
                is_global: false,
                user_id: user.id
            }]).select();
            if (error) throw error;
            return true;
        } catch (err) {
            console.error("Add to My Words failed:", err?.message || err);
            showFlashcardNotification("Failed to add word: " + (err?.message || err), true);
            return false;
        }
    }

    async function removeFromMyWords(card, session) {
        const client = (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient) || null;
        if (!client || typeof client.from !== 'function') { alert('Supabase client not initialized properly'); return false; }

        let target = card;
        if (typeof card === "string") target = { id: card };

        if (!session) session = await getSession(client);
        const user = session?.user;
        if (!user) return false;
        if (!target || target.is_global === true) return false;
        if (target.user_id && String(target.user_id) !== String(user.id)) return false;

        if (!confirm("Are you sure you want to delete this word?")) return false;

        // ID Type Safety: target.id must match Supabase primary key column type (UUID vs integer).
        const cardId = target.id;

        console.log('Sending Supabase DELETE for card ID:', cardId);

        // RLS Check: Ensure a DELETE policy exists on flashcards table for authenticated users.
        const { data, error } = await client
            .from("flashcards")
            .delete()
            .eq("id", cardId)
            .select();
        if (error || !data || data.length === 0) {
            console.error('Database delete failed or 0 rows deleted:', error || 'No matching row deleted');
            alert('Database delete failed: Item was not deleted from Supabase. Check RLS policies.');
            return false;
        }

        // Update LocalStorage cache after successful DB deletion.
        try {
            var pending = JSON.parse(localStorage.getItem("dha_flashcards_pending") || "[]");
            if (Array.isArray(pending)) {
                var filtered = pending.filter(function (c) { return String(c.id) !== String(cardId); });
                if (filtered.length !== pending.length) {
                    localStorage.setItem("dha_flashcards_pending", JSON.stringify(filtered));
                }
            }
        } catch (e) { /* ignore storage errors */ }

        // Remove card element from DOM after successful DB deletion.
        try {
            var cardElement = document.querySelector('[data-id="' + cardId + '"]') || document.getElementById('myCard');
            if (cardElement) cardElement.remove();
        } catch (e) { /* ignore DOM errors */ }

        console.log('Successfully deleted from Supabase DB');

        return true;
    }

    function isInMyWords(card, userId, allCards) {
        if (!card || !userId || !Array.isArray(allCards)) return false;
        return allCards.some(c => c.is_global === false && String(c.user_id) === String(userId) && c.word === card.word);
    }

    function deduplicateByWord(cards) {
        const seen = new Set();
        return (Array.isArray(cards) ? cards : []).filter(card => {
            const key = String(card?.word || '').trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function deduplicateCards(cards) {
        return deduplicateByWord(cards);
    }

    function getUniqueWordCount(cards) {
        const unique = new Set((Array.isArray(cards) ? cards : []).map(card => String(card?.word || '').trim().toLowerCase()));
        return unique.size;
    }

    function filterAllWords(cards) {
        return deduplicateByWord(cards);
    }

    const deduplicate = deduplicateByWord;
    const uniqueCards = deduplicateByWord;
    const getAllWordsUnique = deduplicateByWord;

    const addWordToMyWords = addToMyWords;
    const add_to_my_words = addToMyWords;
    const removeWordFromMyWords = removeFromMyWords;
    const remove_from_my_words = removeFromMyWords;
    const checkIfAdded = isInMyWords;

    // ---------- Text-to-Speech helper ----------
    function isSpeechSupported() {
        try {
            return typeof window !== "undefined" &&
                !!window.speechSynthesis &&
                typeof SpeechSynthesisUtterance !== "undefined";
        } catch (e) {
            return false;
        }
    }

    function selectTTSVoice(lang) {
        if (!isSpeechSupported()) return null;
        var synth = window.speechSynthesis;
        var voices = [];
        try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
        if (!voices.length) return null;
        var prefix = String(lang || "en").split("-")[0].toLowerCase();
        var candidates = voices.filter(function (v) {
            return v && v.lang && String(v.lang).toLowerCase().indexOf(prefix) === 0;
        });
        if (!candidates.length) {
            candidates = voices.filter(function (v) {
                return v && v.lang && String(v.lang).toLowerCase().indexOf("en") === 0;
            });
        }
        if (!candidates.length) candidates = voices.slice();
        function score(v) {
            var s = 0;
            var name = String((v && v.name) || "").toLowerCase();
            if (/natural/i.test(name)) s += 5;
            if (/neural/i.test(name)) s += 3;
            if (/google/i.test(name)) s += 3;
            if (/microsoft/i.test(name)) s += 2;
            if (v && v.default) s += 1;
            if (v && v.lang && String(v.lang).toLowerCase() === String(lang || "").toLowerCase()) s += 2;
            return s;
        }
        return candidates.slice().sort(function (a, b) { return score(b) - score(a); })[0] || null;
    }

    function speakText(text, lang, options) {
        if (typeof lang === "undefined" || lang === null || lang === "") lang = "en-US";
        if (typeof options === "function") options = { onEnd: options };
        if (!options || typeof options !== "object") options = {};

        if (!isSpeechSupported()) {
            if (typeof options.onError === "function") try { options.onError(new Error("unsupported")); } catch (e) {}
            if (typeof options.onEnd === "function") try { options.onEnd(); } catch (e) {}
            if (typeof options.onend === "function") try { options.onend(); } catch (e) {}
            return false;
        }

        var synth = window.speechSynthesis;
        try { synth.cancel(); } catch (e) {}

        var utterance = new SpeechSynthesisUtterance(String(text == null ? "" : text));
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        var voice = selectTTSVoice(lang);
        if (voice) try { utterance.voice = voice; } catch (e) {}

        var startHandler = options.onStart || options.onstart;
        var endHandler = options.onEnd || options.onend || options.onDone;
        var errorHandler = options.onError || options.onerror;

        if (typeof startHandler === "function") {
            utterance.onstart = function (e) { try { startHandler(e); } catch (err) {} };
        }
        function finish() {
            if (typeof endHandler === "function") try { endHandler(); } catch (err) {}
        }
        utterance.onend = finish;
        utterance.onerror = function (e) {
            finish();
            if (typeof errorHandler === "function") try { errorHandler(e); } catch (err) {}
        };

        function doSpeak() { try { synth.speak(utterance); } catch (e) { finish(); } }

        var voices = [];
        try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
        if (voices.length) {
            doSpeak();
        } else {
            var spoken = false;
            var handler = function () {
                if (spoken) return;
                spoken = true;
                try { synth.onvoiceschanged = null; } catch (e) {}
                doSpeak();
            };
            try { synth.onvoiceschanged = handler; } catch (e) {}
            setTimeout(function () { if (!spoken) { spoken = true; doSpeak(); } }, 500);
        }
        return utterance;
    }

    if (typeof global !== "undefined") {
        global.speakText = global.speakText || speakText;
    }
    if (typeof window !== "undefined") {
        window.speakText = window.speakText || speakText;
    }

    async function deleteOfficialFlashcard(card, isAdmin) {
    if (!card) return false;
    if (isAdmin === true) {
        try {
            var confirmed = confirm("Delete this official word from the database?");
            if (!confirmed) return false;
            const client = (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient) || null;
            if (!client || typeof client.from !== 'function') { alert('Supabase client not initialized properly'); return false; }

            // ID Type Safety: card.id must match Supabase primary key column type (UUID vs integer).
            var cardId = card.id;

            console.log('Sending Supabase DELETE for card ID:', cardId);

            // RLS Check: Ensure a DELETE policy exists on flashcards table for authenticated admins.
            var { data, error } = await client.from('flashcards').delete().eq('id', cardId).select();
            if (error || !data || data.length === 0) {
                console.error('Database delete failed or 0 rows deleted:', error || 'No matching row deleted');
                alert('Database delete failed: Item was not deleted from Supabase. Check RLS policies.');
                return false;
            }

            // Update LocalStorage cache after successful DB deletion.
            try {
                var pending = JSON.parse(localStorage.getItem("dha_flashcards_pending") || "[]");
                if (Array.isArray(pending)) {
                    var filtered = pending.filter(function (c) { return String(c.id) !== String(cardId); });
                    if (filtered.length !== pending.length) {
                        localStorage.setItem("dha_flashcards_pending", JSON.stringify(filtered));
                    }
                }
            } catch (e) { /* ignore storage errors */ }

            // Remove card element from DOM after successful DB deletion.
            try {
                var cardElement = document.querySelector('[data-id="' + cardId + '"]') || document.getElementById('myCard');
                if (cardElement) cardElement.remove();
            } catch (e) { /* ignore DOM errors */ }

            console.log('Successfully deleted from Supabase DB');

            return true;
        } catch (err) {
            console.error('Database delete failed:', err);
            showFlashcardNotification("Failed to delete word from database.", true);
            return false;
        }
    }
    return false;
}

if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            fetchFlashcards: fetchFlashcards,
            saveFlashcard: saveFlashcard,
            addToMyWords: addToMyWords,
            addWordToMyWords: addWordToMyWords,
            add_to_my_words: add_to_my_words,
            removeFromMyWords: removeFromMyWords,
            removeWordFromMyWords: removeWordFromMyWords,
            remove_from_my_words: remove_from_my_words,
            isInMyWords: isInMyWords,
            checkIfAdded: checkIfAdded,
            deduplicateByWord: deduplicateByWord,
            deduplicateCards: deduplicateCards,
            deduplicate: deduplicate,
            uniqueCards: uniqueCards,
            filterAllWords: filterAllWords,
            getAllWordsUnique: getAllWordsUnique,
            getUniqueWordCount: getUniqueWordCount,
            speakText: speakText,
            selectTTSVoice: selectTTSVoice,
            isSpeechSupported: isSpeechSupported,
            deleteOfficialFlashcard: deleteOfficialFlashcard
        };
    } else {
        global.fetchFlashcards = fetchFlashcards;
        global.saveFlashcard = saveFlashcard;
        global.addToMyWords = addToMyWords;
        global.addWordToMyWords = addWordToMyWords;
        global.add_to_my_words = add_to_my_words;
        global.removeFromMyWords = removeFromMyWords;
        global.removeWordFromMyWords = removeWordFromMyWords;
        global.remove_from_my_words = remove_from_my_words;
        global.isInMyWords = isInMyWords;
        global.checkIfAdded = checkIfAdded;
        global.deduplicateByWord = deduplicateByWord;
        global.deduplicateCards = deduplicateCards;
        global.deduplicate = deduplicate;
        global.uniqueCards = uniqueCards;
        global.filterAllWords = filterAllWords;
        global.getAllWordsUnique = getAllWordsUnique;
        global.getUniqueWordCount = getUniqueWordCount;
        global.speakText = speakText;
        global.selectTTSVoice = selectTTSVoice;
        global.isSpeechSupported = isSpeechSupported;
    global.deleteOfficialFlashcard = deleteOfficialFlashcard;
    }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));

