// js/index.js — Daily Helping Apps: main initializer for index.html
//
// NOTE: The header "Log In / Sign Up" button (#nav-auth-btn) and its auth-modal
// open/close toggle are owned by js/header-auth.js (single click handler).
// index.js intentionally does NOT bind #nav-auth-btn here: a second delegated
// toggle conflicted with header-auth.js (on close, header-auth closed the modal
// then index.js immediately re-opened it, so the modal would not stay closed).
(function () {
    'use strict';

    function openAuthModal() {
        var modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('is-hidden');
            modal.classList.add('is-visible');
        }
    }

    window.dhaOpenAuthModal = openAuthModal;
})();