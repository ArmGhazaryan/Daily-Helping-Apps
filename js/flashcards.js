(function (global) {
    'use strict';

    // Clear legacy flashcard cache keys on load
    try {
        ['dha_flashcards', 'flashcards', 'guest_flashcards'].forEach(function (key) {
            try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (e) {}
            try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); } catch (e) {}
        });
    } catch (e) {}

    async function fetchFlashcards() {
        var client = (typeof supabaseClient !== 'undefined') ? supabaseClient : (global && global.supabaseClient);
        if (!client) return [];
        try {
            const { data, error } = await client.from('flashcards').select('*');
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch (err) {
            return [];
        }
    }

    async function saveFlashcard(word, definition, example, level) {
        var client = (typeof supabaseClient !== 'undefined') ? supabaseClient : (global && global.supabaseClient);
        if (!client) return false;
        try {
            const { error } = await client.from('flashcards').insert([{
                word: word,
                level: level || 'B2',
                definition: definition,
                translation: '',
                example: example || '',
                is_global: false
            }]);
            if (error) throw error;
            return true;
        } catch (err) {
            return false;
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { fetchFlashcards: fetchFlashcards, saveFlashcard: saveFlashcard };
    } else {
        global.fetchFlashcards = fetchFlashcards;
        global.saveFlashcard = saveFlashcard;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
