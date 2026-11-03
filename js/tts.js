(function (global) {
    "use strict";

    function isSpeechSupported() {
        try {
            return typeof window !== "undefined" &&
                !!window.speechSynthesis &&
                typeof SpeechSynthesisUtterance !== "undefined";
        } catch (e) {
            return false;
        }
    }

    function normalizeOptions(options) {
        if (typeof options === "function") {
            return { onEnd: options };
        }
        if (!options || typeof options !== "object") {
            return {};
        }
        return options;
    }

    function selectVoice(lang) {
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
        if (typeof lang === "undefined" || lang === null || lang === "") {
            lang = "en-US";
        }
        options = normalizeOptions(options);

        if (!isSpeechSupported()) {
            if (typeof options.onError === "function") {
                try { options.onError(new Error("speechSynthesis is not supported")); } catch (e) {}
            }
            if (typeof options.onEnd === "function") {
                try { options.onEnd(); } catch (e) {}
            }
            if (typeof options.onend === "function") {
                try { options.onend(); } catch (e) {}
            }
            return false;
        }

        var synth = window.speechSynthesis;
        try { synth.cancel(); } catch (e) {}

        var utterance = new SpeechSynthesisUtterance(String(text == null ? "" : text));
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        var voice = selectVoice(lang);
        if (voice) {
            try { utterance.voice = voice; } catch (e) {}
        }

        var startHandler = options.onStart || options.onstart;
        var endHandler = options.onEnd || options.onend || options.onDone;
        var errorHandler = options.onError || options.onerror;

        if (typeof startHandler === "function") {
            utterance.onstart = function (e) { try { startHandler(e); } catch (err) {} };
        }

        function finish() {
            if (typeof endHandler === "function") {
                try { endHandler(); } catch (err) {}
            }
        }

        utterance.onend = finish;
        utterance.onerror = function (e) {
            finish();
            if (typeof errorHandler === "function") {
                try { errorHandler(e); } catch (err) {}
            }
        };

        function doSpeak() {
            try { synth.speak(utterance); } catch (e) { finish(); }
        }

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
            setTimeout(function () {
                if (!spoken) {
                    spoken = true;
                    doSpeak();
                }
            }, 500);
        }

        return utterance;
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            speakText: speakText,
            selectVoice: selectVoice,
            isSpeechSupported: isSpeechSupported
        };
    } else {
        global.speakText = speakText;
        global.selectVoice = selectVoice;
        global.isSpeechSupported = isSpeechSupported;
        if (typeof window !== "undefined") {
            window.speakText = speakText;
            window.selectVoice = selectVoice;
            window.isSpeechSupported = isSpeechSupported;
        }
    }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));