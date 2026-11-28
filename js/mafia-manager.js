function initMafiaManager() {
  'use strict';

  /* ================= references ================= */
  const stepSetup = document.getElementById('step-setup');
  const stepRole  = document.getElementById('step-role');
  const stepMod   = document.getElementById('step-mod');

  const btnRedMinus   = document.getElementById('btnRedMinus');
  const btnRedPlus    = document.getElementById('btnRedPlus');
  const valRed        = document.getElementById('valRed');
  const btnMafiaMinus = document.getElementById('btnMafiaMinus');
  const btnMafiaPlus  = document.getElementById('btnMafiaPlus');
  const valMafia      = document.getElementById('valMafia');
  const subMafia      = document.getElementById('subMafia');
  const btnStartSetup = document.getElementById('btnStartSetup');

  const btnExitRole     = document.getElementById('btnExitRole');
  const rolePlayerTitle = document.getElementById('rolePlayerTitle');
  const roleCard        = document.getElementById('roleCard');
  const roleActionBtn   = document.getElementById('roleActionBtn');
  const roleStartGame   = document.getElementById('roleStartGame');
  const roleReveal      = document.getElementById('roleReveal');
  const roleName        = document.getElementById('roleName');
  const roleSub         = document.getElementById('roleSub');

  const btnExitMod    = document.getElementById('btnExitMod');
  const btnNewGameMod = document.getElementById('btnNewGameMod');
  const cntKarmir     = document.getElementById('cntKarmir');
  const cntMafia      = document.getElementById('cntMafia');
  const playerList    = document.getElementById('playerList');

  const timerBar      = document.getElementById('timer-bar');
  const btnStartTimer = document.getElementById('btnStartTimer');
  const timerDisplay  = document.getElementById('timerDisplay');
  const btnResetTimer = document.getElementById('btnResetTimer');

  const winModal      = document.getElementById('win-modal');
  const winTitle      = document.getElementById('winTitle');
  const btnWinNewGame = document.getElementById('btnWinNewGame');

  const btnOpenRules        = document.getElementById('btnOpenRules');
  const rulesModal          = document.getElementById('rules-modal');
  const rulesModalBody      = document.getElementById('rulesModalBody');
  const btnCloseRulesTop    = document.getElementById('btnCloseRulesTop');
  const btnCloseRulesBottom = document.getElementById('btnCloseRulesBottom');
  const rulesTabBtns        = document.querySelectorAll('.rules-tab-btn');
  const rulesTabPanels      = document.querySelectorAll('.rules-tab-panel');

  /* ================= state ================= */
  let redCount = 7;
  let mafiaCount = 3;
  let players = [];
  let revealIndex = 0;
  let revealShown = false;

  let timeLeft = 60;
  let timerInterval = null;
  let timerRunning = false;

  const ROLE_INFO = {
    karmir:  { label: 'Կարմիր', icon: '🔴', color: '#ef4444', cat: 'red' },
    sheriff: { label: 'Շերիֆ',  icon: '⭐', color: '#ffffff', cat: 'red' },
    mafia:   { label: 'Մաֆիա',  icon: '⚫', color: '#cbd5e1', cat: 'mafia' },
    don:     { label: 'Դոն',    icon: '🎩', color: '#ffffff', cat: 'mafia' }
  };

  /* ================= steps / fullscreen ================= */
  function goToStep(step) {
    [stepSetup, stepRole, stepMod].forEach((s, i) => {
      if (s) s.classList.toggle('active', i + 1 === step);
    });
    if (step === 3) {
      timerBar?.classList.remove('hidden');
      renderModerator();
    } else {
      timerBar?.classList.add('hidden');
    }
    winModal?.classList.add('hidden');
    rulesModal?.classList.add('hidden');
  }

  function enterFullscreen() {
    document.body.classList.add('mafia-fullscreen-active');
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function exitFullscreen() {
    document.body.classList.remove('mafia-fullscreen-active');
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    stopTimer();
    timeLeft = 60;
    updateTimer();
    goToStep(1);
  }

  /* ================= step 1 : setup ================= */
  function updateCountersUI() {
    if (valRed) valRed.textContent = redCount;
    if (valMafia) valMafia.textContent = mafiaCount;
    if (subMafia) subMafia.textContent = mafiaCount >= 2 ? ' ներառյալ 1 Դոն' : '';
    if (btnRedMinus) btnRedMinus.disabled = redCount <= 2;
    if (btnRedPlus) btnRedPlus.disabled = redCount >= 15;
    if (btnMafiaMinus) btnMafiaMinus.disabled = mafiaCount <= 1;
    if (btnMafiaPlus) btnMafiaPlus.disabled = mafiaCount >= 8;
  }

  function buildRolePool() {
    const pool = [];
    for (let i = 0; i < redCount - 1; i++) pool.push('karmir');
    pool.push('sheriff');

    if (mafiaCount >= 2) {
      for (let i = 0; i < mafiaCount - 1; i++) pool.push('mafia');
      pool.push('don');
    } else {
      pool.push('mafia');
    }

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  function startGameFromSetup() {
    if (redCount < 2 || mafiaCount < 1) return;
    const rolePool = buildRolePool();
    players = rolePool.map((role, i) => ({
      id: i + 1,
      role,
      nominated: null,
      fouls: 0,
      eliminated: false
    }));
    revealIndex = 0;
    revealShown = false;
    goToStep(2);
    enterFullscreen();
    renderStep2();
  }

  /* ================= step 2 : role reveal ================= */
  function renderStep2() {
    const fd = roleCard?.querySelector('.face-down');
    const fu = roleCard?.querySelector('.face-up');

    if (revealIndex >= players.length) {
      if (rolePlayerTitle) rolePlayerTitle.textContent = 'Փոխանցեք վարողին';
      fd?.classList.add('hidden');
      fu?.classList.add('hidden');
      if (roleCard) roleCard.style.display = 'none';
      roleActionBtn?.classList.add('hidden');
      roleStartGame?.classList.remove('hidden');
      return;
    }

    roleActionBtn?.classList.remove('hidden');
    roleStartGame?.classList.add('hidden');
    if (roleCard) roleCard.style.display = 'flex';

    const p = players[revealIndex];
    if (rolePlayerTitle) rolePlayerTitle.textContent = `Խաղացող ${p.id}`;

    if (!revealShown) {
      roleCard?.classList.add('face-down');
      fd?.classList.remove('hidden');
      fu?.classList.add('hidden');
      if (roleActionBtn) roleActionBtn.textContent = 'Տեսնել';
    } else {
      roleCard?.classList.remove('face-down');
      fd?.classList.add('hidden');
      fu?.classList.remove('hidden');
      const info = ROLE_INFO[p.role];
      if (roleReveal) roleReveal.textContent = info.icon;
      if (roleName) {
        roleName.textContent = info.label;
        roleName.style.color = info.color;
      }
      if (roleSub) {
        roleSub.textContent = info.cat === 'mafia' ? 'Սև թիմ' : 'Կարմիր թիմ';
      }
      if (roleActionBtn) roleActionBtn.textContent = 'Ծածկել';
    }
  }

  /* ================= step 3 : moderator ================= */
  function counts() {
    const alive = players.filter(p => !p.eliminated);
    const red = alive.filter(p => p.role === 'karmir' || p.role === 'sheriff').length;
    const maf = alive.filter(p => p.role === 'mafia' || p.role === 'don').length;
    return { red, maf };
  }

  function renominations() {
    const nomed = players
      .filter(p => p.nominated !== null)
      .sort((a, b) => a.nominated - b.nominated);
    nomed.forEach((p, i) => {
      p.nominated = i + 1;
    });
  }

  function toggleNomination(id) {
    const p = players.find(x => x.id === id);
    if (!p || p.eliminated) return;
    if (p.nominated !== null) {
      p.nominated = null;
      renominations();
    } else {
      const max = Math.max(0, ...players.map(x => x.nominated || 0));
      p.nominated = max + 1;
    }
    renderModerator();
  }

  function foulDelta(id, delta) {
    const p = players.find(x => x.id === id);
    if (!p) return;
    if (p.eliminated && !(delta === -1 && p.fouls === 4)) return;

    let n = p.fouls + delta;
    if (n < 0) n = 0;
    if (n > 4) n = 4;
    p.fouls = n;

    if (n === 4) {
      eliminatePlayer(id);
      return;
    } else if (n === 3 && p.eliminated) {
      p.eliminated = false;
    }
    renderModerator();
  }

  function eliminatePlayer(id) {
    const p = players.find(x => x.id === id);
    if (!p || p.eliminated) return;
    p.eliminated = true;
    p.nominated = null;
    renominations();
    renderModerator();
    checkWin();
  }

  function restorePlayer(id) {
    const p = players.find(x => x.id === id);
    if (!p || !p.eliminated) return;
    p.eliminated = false;
    p.nominated = null;
    p.fouls = 0;
    renderModerator();
  }

  function checkWin() {
    const { red, maf } = counts();
    if (maf !== 0 && maf < red) return;

    stopTimer();
    winModal?.classList.remove('hidden');
    if (maf === 0) {
      if (winTitle) {
        winTitle.textContent = 'Հաղթեցին Կարմիրները';
        winTitle.className = 'win-title karmir-win';
      }
    } else {
      if (winTitle) {
        winTitle.textContent = 'Հաղթեց Մաֆիան';
        winTitle.className = 'win-title mafia-win';
      }
    }
  }

  function renderModerator() {
    const { red, maf } = counts();
    if (cntKarmir) cntKarmir.textContent = red;
    if (cntMafia) cntMafia.textContent = maf;
    if (!playerList) return;

    playerList.innerHTML = '';
    players.forEach(p => {
      const info = ROLE_INFO[p.role];
      const row = document.createElement('div');
      row.className = 'player-row' + (p.eliminated ? ' eliminated' : '');
      row.dataset.id = p.id;

      const nomText = p.nominated !== null ? String(p.nominated) : '';
      const nomClass = p.nominated !== null ? ' nominated' : '';
      const nomDisabled = p.eliminated ? ' disabled' : '';
      const foulMinusDisabled = (p.eliminated && p.fouls !== 4) ? ' disabled' : '';
      const fcClass = p.fouls >= 4 ? 'elim' : (p.fouls === 3 ? 'warn' : '');

      row.innerHTML = `
        <div class="player-row-content">
          <div class="player-number">${p.id}</div>
          <span class="player-role-tag ${p.role}">${info.label}</span>
          <button type="button" class="player-nomination${nomClass}" data-id="${p.id}"${nomDisabled}>${nomText}</button>
          <div class="player-fouls">
            <button type="button" class="btn-foul foul-minus" data-id="${p.id}"${foulMinusDisabled}>−</button>
            <span class="foul-count ${fcClass}">${p.fouls}</span>
            <button type="button" class="btn-foul foul-plus" data-id="${p.id}"${nomDisabled}>+</button>
          </div>
          <button type="button" class="btn-restore" data-id="${p.id}">Վերականգնել</button>
        </div>
        <button type="button" class="btn-eliminate" data-id="${p.id}">Հեռացնել</button>
      `;
      playerList.appendChild(row);
    });
  }

  /* ================= timer ================= */
  function updateTimer() {
    if (!timerDisplay) return;
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 10 && timeLeft > 0) timerDisplay.classList.add('pulse');
    else timerDisplay.classList.remove('pulse');
  }

  function startTimer() {
    if (timerRunning || timeLeft <= 0) return;
    timerRunning = true;
    if (btnStartTimer) {
      btnStartTimer.textContent = 'Դադար';
      btnStartTimer.classList.add('paused');
    }
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimer();
      if (timeLeft <= 0) stopTimer();
    }, 1000);
    updateTimer();
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    if (btnStartTimer) {
      btnStartTimer.textContent = 'Սկսել ժամանակը';
      btnStartTimer.classList.remove('paused');
    }
    updateTimer();
  }

  function resetTimer() {
    stopTimer();
    timeLeft = 60;
    updateTimer();
  }

  /* ================= rules tabs ================= */
  function switchRulesTab(tabName) {
    rulesTabBtns.forEach(btn => {
      const isActive = btn.dataset.rulesTab === tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    rulesTabPanels.forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== `rules-tab-${tabName}`);
    });
    if (rulesModalBody) rulesModalBody.scrollTop = 0;
  }

  /* ================= two-step swipe (slide open -> tap Delete) ================= */
  let drag = { active: false, row: null, content: null, startX: 0, baseOffset: 0, currentOffset: 0 };

  function closeAllSwipes(exceptRow = null) {
    document.querySelectorAll('.player-row.swiped-open, .player-row.swiping').forEach(r => {
      if (r !== exceptRow) {
        r.classList.remove('swiped-open', 'swiping');
        const c = r.querySelector('.player-row-content');
        if (c) c.style.transform = '';
      }
    });
  }

  function dragStart(e, row) {
    if (e.target.closest('button') || row.classList.contains('eliminated')) return;
    const content = row.querySelector('.player-row-content');
    if (!content) return;

    closeAllSwipes(row);
    drag.active = true;
    drag.row = row;
    drag.content = content;
    drag.startX = e.touches ? e.touches[0].clientX : e.clientX;
    drag.baseOffset = row.classList.contains('swiped-open') ? -92 : 0;
    drag.currentOffset = drag.baseOffset;
    content.style.transition = 'none';
  }

  function dragMove(e) {
    if (!drag.active || !drag.content || !drag.row) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - drag.startX;
    const nextOffset = Math.max(-92, Math.min(0, drag.baseOffset + dx));
    drag.currentOffset = nextOffset;
    if (nextOffset < -6) {
      drag.row.classList.add('swiping');
    }
    drag.content.style.transform = `translateX(${nextOffset}px)`;
  }

  function dragEnd() {
    if (!drag.active || !drag.row || !drag.content) {
      drag = { active: false, row: null, content: null, startX: 0, baseOffset: 0, currentOffset: 0 };
      return;
    }
    const { row, content, currentOffset } = drag;
    content.style.transition = '';
    row.classList.remove('swiping');

    if (currentOffset <= -45) {
      row.classList.add('swiped-open');
      content.style.transform = 'translateX(-92px)';
    } else {
      row.classList.remove('swiped-open');
      content.style.transform = '';
    }
    drag = { active: false, row: null, content: null, startX: 0, baseOffset: 0, currentOffset: 0 };
  }

  /* ================= wiring ================= */
  btnRedMinus?.addEventListener('click', () => {
    if (redCount > 2) { redCount--; updateCountersUI(); }
  });
  btnRedPlus?.addEventListener('click', () => {
    if (redCount < 15) { redCount++; updateCountersUI(); }
  });
  btnMafiaMinus?.addEventListener('click', () => {
    if (mafiaCount > 1) { mafiaCount--; updateCountersUI(); }
  });
  btnMafiaPlus?.addEventListener('click', () => {
    if (mafiaCount < 8) { mafiaCount++; updateCountersUI(); }
  });
  btnStartSetup?.addEventListener('click', startGameFromSetup);

  btnExitRole?.addEventListener('click', exitFullscreen);
  btnExitMod?.addEventListener('click', exitFullscreen);
  btnNewGameMod?.addEventListener('click', exitFullscreen);

  roleActionBtn?.addEventListener('click', () => {
    if (!revealShown) {
      revealShown = true;
    } else {
      revealShown = false;
      revealIndex++;
    }
    renderStep2();
  });

  roleStartGame?.addEventListener('click', () => {
    goToStep(3);
  });

  btnStartTimer?.addEventListener('click', () => {
    if (timerRunning) stopTimer();
    else startTimer();
  });
  btnResetTimer?.addEventListener('click', resetTimer);

  btnWinNewGame?.addEventListener('click', exitFullscreen);

  rulesTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchRulesTab(btn.dataset.rulesTab);
    });
  });

  btnOpenRules?.addEventListener('click', () => {
    switchRulesTab('basic');
    rulesModal?.classList.remove('hidden');
  });
  btnCloseRulesTop?.addEventListener('click', () => {
    rulesModal?.classList.add('hidden');
  });
  btnCloseRulesBottom?.addEventListener('click', () => {
    rulesModal?.classList.add('hidden');
  });
  rulesModal?.addEventListener('click', (e) => {
    if (e.target === rulesModal) rulesModal.classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rulesModal && !rulesModal.classList.contains('hidden')) {
      rulesModal.classList.add('hidden');
    }
  });

  playerList?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) {
      if (!e.target.closest('.player-row.swiped-open')) closeAllSwipes();
      return;
    }
    const id = Number(btn.dataset.id);
    if (btn.classList.contains('player-nomination')) { closeAllSwipes(); toggleNomination(id); return; }
    if (btn.classList.contains('foul-minus')) { closeAllSwipes(); foulDelta(id, -1); return; }
    if (btn.classList.contains('foul-plus')) { closeAllSwipes(); foulDelta(id, 1); return; }
    if (btn.classList.contains('btn-eliminate')) { eliminatePlayer(id); return; }
    if (btn.classList.contains('btn-restore')) { restorePlayer(id); return; }
  });

  playerList?.addEventListener('mousedown', (e) => {
    const row = e.target.closest('.player-row');
    if (row) dragStart(e, row);
  });
  playerList?.addEventListener('touchstart', (e) => {
    const row = e.target.closest('.player-row');
    if (row) dragStart(e, row);
  }, { passive: true });

  document.addEventListener('mousemove', dragMove);
  document.addEventListener('touchmove', dragMove, { passive: true });
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('touchend', dragEnd);

  /* ================= boot ================= */
  updateCountersUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMafiaManager);
} else {
  initMafiaManager();
}