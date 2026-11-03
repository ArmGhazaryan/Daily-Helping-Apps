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

    async function fetchFlashcards() {
        var client = getClient();
        if (!client) return [];
        try {
            const { data, error } = await client.from("flashcards").select("*");
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch (err) {
            return [];
        }
    }

    async function saveFlashcard(word, definition, example, level, isGlobal) {
        var client = getClient();
        if (!client) return false;
        try {
            const { error } = await client.from("flashcards").insert([{
                word: word,
                level: level || "B2",
                definition: definition,
                translation: "",
                example: example || "",
                is_global: isGlobal === true
            }]);
            if (error) throw error;
            return true;
        } catch (err) {
            return false;
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
            return false;
        }
    }

    async function removeFromMyWords(card, session) {
        var client = getClient();
        if (!client) return false;

        let target = card;
        if (typeof card === "string") target = { id: card };

        if (!session) session = await getSession(client);
        const user = session?.user;
        if (!user) return false;
        if (!target || target.is_global === true) return false;
        if (target.user_id && String(target.user_id) !== String(user.id)) return false;

        if (!confirm("Are you sure you want to delete this word?")) return false;

        try {
            const { error } = await client
                .from("flashcards")
                .delete()
                .eq("id", target.id);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error("Remove from My Words failed:", err?.message || err);
            return false;
        }
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
            isSpeechSupported: isSpeechSupported
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
    }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));

