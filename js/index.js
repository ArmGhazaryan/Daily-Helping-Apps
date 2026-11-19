// js/index.js — Daily Helping Apps: main initializer for index.html
//
// NOTE: The header "Log In / Sign Up" button (#nav-auth-btn) is rendered and bound
// only by js/global-auth.js (navigates to HTML-Files/auth.html?redirect=...).
// index.js must NOT bind #nav-auth-btn or overwrite #auth-header-container.
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