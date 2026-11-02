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
            getUniqueWordCount: getUniqueWordCount
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
    }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
