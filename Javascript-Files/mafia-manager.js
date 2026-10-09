document.addEventListener('DOMContentLoaded', () => {
    // === Ժամաչափի (Timer) Տրամաբանություն ===
    const timerDisplay = document.getElementById('timerDisplay');
    const startTimerBtn = document.getElementById('startTimerBtn');
    const resetTimerBtn = document.getElementById('resetTimerBtn');
    const mainTimerWidget = document.getElementById('mainTimerWidget');
    
    let timeLeft = 60;
    let timerInterval = null;
    let isRunning = false;

    function updateTimerDisplay() {
        let minutes = Math.floor(timeLeft / 60);
        let seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Գույնի փոփոխություն վերջին 10 վայրկյանում
        if (timeLeft <= 10 && timeLeft > 0) {
            timerDisplay.style.color = '#ef4444';
        } else {
            // Եթե ժամաչափը խաղացողի քարտի մեջ է, թող մնա կանաչ, այլապես սպիտակ
            if(mainTimerWidget.parentElement.classList.contains('player-card')) {
                timerDisplay.style.color = '#10b981';
            } else {
                timerDisplay.style.color = '#f8fafc';
            }
        }
    }

    function resetTimerLogic() {
        clearInterval(timerInterval);
        isRunning = false;
        timeLeft = 60;
        updateTimerDisplay();
        startTimerBtn.textContent = '▶ Սկսել';
        startTimerBtn.classList.remove('paused');
    }

    startTimerBtn.addEventListener('click', () => {
        if (isRunning) {
            clearInterval(timerInterval);
            startTimerBtn.textContent = '▶ Սկսել';
            startTimerBtn.classList.remove('paused');
            isRunning = false;
        } else {
            if (timeLeft === 0) timeLeft = 60; 
            timerInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay();
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    isRunning = false;
                    startTimerBtn.textContent = '▶ Սկսել';
                    startTimerBtn.classList.remove('paused');
                    
                    // Ավտոմատ պաս, եթե խոսակցության փուլն է ավարտվել
                    if (isGameStarted && mainTimerWidget.parentElement.classList.contains('player-card')) {
                        document.getElementById('nextTurnBtn').click();
                    }
                }
            }, 1000);
            startTimerBtn.textContent = '⏸ Դադար';
            startTimerBtn.classList.add('paused');
            isRunning = true;
        }
    });

    resetTimerBtn.addEventListener('click', resetTimerLogic);

    // === Խաղի Կարգավորումներ (Settings) ===
    let config = { totalPlayers: 10, totalBlack: 3, totalRed: 7 };

    const totalPlayersInput = document.getElementById('totalPlayersInput');
    const blackCountInput = document.getElementById('blackCountInput');
    const redCountInput = document.getElementById('redCountInput');
    
    function updateRedCount() {
        let t = parseInt(totalPlayersInput.value) || 0;
        let b = parseInt(blackCountInput.value) || 0;
        if (b > t) { b = t; blackCountInput.value = b; }
        redCountInput.value = t - b;
    }
    totalPlayersInput.addEventListener('input', updateRedCount);
    blackCountInput.addEventListener('input', updateRedCount);

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        config.totalPlayers = parseInt(totalPlayersInput.value);
        config.totalBlack = parseInt(blackCountInput.value);
        config.totalRed = parseInt(redCountInput.value);
        document.getElementById('settingsModal').style.display = 'none';
        generateGame();
    });

    // === Խաղացողների Դաշտ & Խաղի Կարգավիճակ ===
    const playersGrid = document.getElementById('playersGrid');
    const nominateSelect = document.getElementById('nominateSelect');
    const planN1 = document.getElementById('planN1');
    const planN2 = document.getElementById('planN2');
    const planN3 = document.getElementById('planN3');
    const nightVictimSelect = document.getElementById('nightVictimSelect');

    const roles = [
        { value: 'citizen', label: '👨‍🌾 Քաղաքացի', color: '#10b981', category: 'red' },
        { value: 'sheriff', label: '👮‍♂️ Շերիֆ', color: '#3b82f6', category: 'red' },
        { value: 'mafia', label: '🔫 Մաֆիա', color: '#ef4444', category: 'black' },
        { value: 'don', label: '🕴️ Դոն', color: '#dc2626', category: 'black' }
    ];

    let isGameStarted = false;
    let currentDay = 1;
    let turnIndex = 0;
    let alivePlayersOrder = [];

    function checkWinCondition() {
        if(!isGameStarted) return;
        let aliveBlacks = 0, aliveReds = 0;
        document.querySelectorAll('.player-card').forEach(card => {
            if (!card.classList.contains('dead')) {
                const roleInfo = roles.find(r => r.value === card.querySelector('.player-role').value);
                if (roleInfo) {
                    if (roleInfo.category === 'black') aliveBlacks++;
                    if (roleInfo.category === 'red') aliveReds++;
                }
            }
        });
        if (aliveBlacks >= aliveReds && aliveBlacks > 0) {
            setTimeout(() => alert(`🎉 ԽԱՂՆ ԱՎԱՐՏՎԵՑ: ՀԱՂԹԵՑԻՆ ՍԵՎԵՐԸ (ՄԱՖԻԱՆ) 🎉\nԿենդանի Սևեր: ${aliveBlacks}\nԿենդանի Կարմիրներ: ${aliveReds}`), 200);
        } else if (aliveBlacks === 0 && aliveReds > 0) {
            setTimeout(() => alert(`🎉 ԽԱՂՆ ԱՎԱՐՏՎԵՑ: ՀԱՂԹԵՑԻՆ ԿԱՐՄԻՐՆԵՐԸ (ՔԱՂԱՔԱՑԻՆԵՐԸ) 🎉\nԲոլոր սևերը սպանված են:`), 200);
        }
    }

   function populateSelects() {
        if(isGameStarted) return;
        
        // Մաֆիայի պլանավորման համար միայն թվեր ենք գեներացնում (1, 2, 3...)
        let planOptionsHtml = '<option value="">--</option>';
        for (let i = 1; i <= config.totalPlayers; i++) {
            planOptionsHtml += `<option value="${i}">${i}</option>`;
        }
        
        const v1 = planN1.value, v2 = planN2.value, v3 = planN3.value;
        planN1.innerHTML = planOptionsHtml; 
        planN2.innerHTML = planOptionsHtml; 
        planN3.innerHTML = planOptionsHtml;
        planN1.value = v1; planN2.value = v2; planN3.value = v3;
        
        // Գիշերային զոհի ընտրության համար թողնում ենք անուններով
        let victimHtml = '<option value="">-- Վրիպում (Ոչ ոք չի մահանում) --</option>';
        for (let i = 1; i <= config.totalPlayers; i++) {
            const nameInput = document.getElementById(`playerName_${i}`);
            const name = (nameInput && nameInput.value) ? nameInput.value : `Խաղացող ${i}`;
            victimHtml += `<option value="${i}">${i}. ${name}</option>`;
        }
        nightVictimSelect.innerHTML = victimHtml;
    }

    function generateGame() {
        isGameStarted = false;
        document.getElementById('startGameSection').style.display = 'block';
        document.getElementById('gamePhaseContainer').style.display = 'none';
        document.getElementById('mafiaPlanSection').style.display = 'block';
        
        // Return timer to header if game is reset
        document.querySelector('.app-header').appendChild(mainTimerWidget);
        resetTimerLogic();
        
        playersGrid.innerHTML = '';
        nominateSelect.innerHTML = '<option value="" disabled selected>Ընտրել խաղացողին...</option>';

        for (let i = 1; i <= config.totalPlayers; i++) {
            const card = document.createElement('div');
            card.className = 'player-card glass-panel';
            card.id = `card_${i}`;
    card.innerHTML = `
                <div class="player-header" style="justify-content: flex-start; gap: 12px; margin-bottom: 5px;">
                    <div class="player-number">${i}</div>
                    <span style="font-size: 1.1rem; font-weight: bold; color: #f8fafc;">Խաղացող ${i}</span>
                </div>
                <select class="player-role" data-prev-val="">
                    <option value="" disabled selected>-- Ընտրել դերը --</option>
                    ${roles.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
                </select>
                <div class="fouls-section">
                    <span style="font-size: 0.9rem; color: #94a3b8;">Նկատողություն:</span>
                    <div class="fouls-controls">
                        <button class="foul-minus" disabled>-</button>
                        <span class="foul-count">0</span>
                        <button class="foul-plus" disabled>+</button>
                    </div>
                </div>
                <button class="status-btn alive" disabled>ԿԵՆԴԱՆԻ Է</button>
            `;
            playersGrid.appendChild(card);
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Խաղացող ${i}`;
            nominateSelect.appendChild(opt);

            card.querySelector('.player-role').addEventListener('change', (e) => {
                let currentBlack = 0, currentRed = 0;
                document.querySelectorAll('.player-role').forEach(sel => {
                    const r = roles.find(rx => rx.value === sel.value);
                    if (r) { if (r.category === 'black') currentBlack++; else currentRed++; }
                });

                if (currentBlack > config.totalBlack) {
                    alert(`ԽՍՏԱԳՈՒՅՆ ԱՐԳԵԼՎՈՒՄ Է!\nՄաքսիմում ${config.totalBlack} Սև դեր:`);
                    e.target.value = e.target.dataset.prevVal; return;
                }
                if (currentRed > config.totalRed) {
                    alert(`ԽՍՏԱԳՈՒՅՆ ԱՐԳԵԼՎՈՒՄ Է!\nՄաքսիմում ${config.totalRed} Կարմիր դեր:`);
                    e.target.value = e.target.dataset.prevVal; return;
                }
                e.target.dataset.prevVal = e.target.value;
                card.style.borderTopColor = roles.find(r => r.value === e.target.value)?.color || '#64748b';
            });
        }
        
        document.querySelectorAll('.player-name').forEach(inp => inp.addEventListener('change', populateSelects));
        populateSelects();
    }
    
    generateGame();

    // === ԽԱՂԻ ՍԿԻԶԲ ===
    document.getElementById('initGameBtn').addEventListener('click', () => {
        let unassigned = 0;
        document.querySelectorAll('.player-role').forEach(s => { if(!s.value) unassigned++; });
        if(unassigned > 0) {
            alert("Խնդրում ենք բոլոր խաղացողներին դերեր տալ նախքան խաղը սկսելը:");
            return;
        }

        isGameStarted = true;
        document.getElementById('startGameSection').style.display = 'none';
        
        // Ցույց ենք տալիս Փուլերի Ուղեցույցի բլոկը
        document.getElementById('gamePhaseContainer').style.display = 'flex';
        
        planN1.disabled = true; planN2.disabled = true; planN3.disabled = true;
        
        document.querySelectorAll('.player-role').forEach(s => s.disabled = true);
        document.querySelectorAll('.player-name').forEach(s => s.disabled = true);
        
        document.querySelectorAll('.player-card').forEach((card, i) => {
            const num = i + 1;
            const foulPlus = card.querySelector('.foul-plus');
            const foulMinus = card.querySelector('.foul-minus');
            const statusBtn = card.querySelector('.status-btn');
            const foulCountDisplay = card.querySelector('.foul-count');
            let fouls = 0;
            let isAlive = true;
            
            foulPlus.disabled = false; foulMinus.disabled = false; statusBtn.disabled = false;

            foulPlus.addEventListener('click', () => {
                if (!isAlive) return;
                if (fouls < 4) fouls++;
                foulCountDisplay.textContent = fouls;
                if (fouls === 3) foulCountDisplay.classList.add('danger');
                else if (fouls === 4) {
                    killPlayer();
                    alert(`Խաղացող ${num}-ը ստացավ 4-րդ նկատողությունը և լքում է խաղը:`);
                }
            });
            foulMinus.addEventListener('click', () => {
                if (fouls > 0) fouls--;
                foulCountDisplay.textContent = fouls;
                if (fouls < 3) foulCountDisplay.classList.remove('danger');
            });
            
            function killPlayer() {
                isAlive = false;
                statusBtn.textContent = 'ՍՊԱՆՎԱԾ Է';
                statusBtn.className = 'status-btn dead';
                card.classList.add('dead');
                checkWinCondition();
            }
            function revivePlayer() {
                isAlive = true;
                statusBtn.textContent = 'ԿԵՆԴԱՆԻ Է';
                statusBtn.className = 'status-btn alive';
                card.classList.remove('dead');
                if(fouls === 4) { fouls = 3; foulCountDisplay.textContent = fouls; }
                checkWinCondition();
            }
            statusBtn.addEventListener('click', () => { isAlive ? killPlayer() : revivePlayer(); });
        });

        startDayPhase();
    });

    // === ԽԱՂԻ ՓՈՒԼԵՐ (Phases) ===
    const phaseTitle = document.getElementById('phaseTitle');
    const turnTitle = document.getElementById('turnTitle');
    const startNightBtn = document.getElementById('startNightBtn');
    const nextTurnBtn = document.getElementById('nextTurnBtn');
    const prevTurnBtn = document.getElementById('prevTurnBtn');
    const gamePhaseContainer = document.getElementById('gamePhaseContainer');

    function startDayPhase() {
        alivePlayersOrder = [];
        document.querySelectorAll('.player-card').forEach((card, idx) => {
            if(!card.classList.contains('dead')) alivePlayersOrder.push(idx + 1);
        });
        
        turnIndex = 0;
        phaseTitle.textContent = `☀️ Օր ${currentDay}`;
        updateTurnDisplay();
    }

    function updateTurnDisplay() {
        resetTimerLogic();
        
        // Remove active highlights and timer from all cards
        document.querySelectorAll('.player-card').forEach(c => {
            c.classList.remove('active-turn');
        });
        
        if (turnIndex < alivePlayersOrder.length && turnIndex >= 0) {
            const activePlayer = alivePlayersOrder[turnIndex];
            const name = document.getElementById(`playerName_${activePlayer}`).value || `Խաղացող ${activePlayer}`;
            turnTitle.textContent = `🗣️ Խոսում է ${activePlayer}. ${name}`;
            startNightBtn.style.display = 'none';
            nextTurnBtn.style.display = 'inline-block';
            
            const activeCard = document.getElementById(`card_${activePlayer}`);
            activeCard.classList.add('active-turn');
            
            // Move Timer INSIDE the active card (above the fouls section)
            const foulsSection = activeCard.querySelector('.fouls-section');
            activeCard.insertBefore(mainTimerWidget, foulsSection);
            
            // Re-run color logic for timer text
            timerDisplay.style.color = '#10b981';
            
        } else {
            // End of Day talks -> Voting time
            turnTitle.textContent = `⚖️ Քվեարկության ժամանակն է`;
            startNightBtn.style.display = 'inline-block';
            nextTurnBtn.style.display = 'none';
            
            // Move Timer back to Game Phase Container for general voting time tracking
            gamePhaseContainer.appendChild(mainTimerWidget);
            timerDisplay.style.color = '#f8fafc';
        }
    }

    nextTurnBtn.addEventListener('click', () => {
        turnIndex++;
        updateTurnDisplay();
    });
    
    prevTurnBtn.addEventListener('click', () => {
        if(turnIndex > 0) {
            turnIndex--;
            updateTurnDisplay();
        }
    });

    // === ԳԻՇԵՐԱՅԻՆ ՓՈՒԼ (Night Phase) ===
    const nightModal = document.getElementById('nightModal');
    
    window.goToNightStep = function(stepNum) {
        document.querySelectorAll('.night-step').forEach(el => el.style.display = 'none');
        document.getElementById(`nightStep${stepNum}`).style.display = 'block';
    }

    startNightBtn.addEventListener('click', () => {
        document.getElementById('nightNumberDisplay').textContent = currentDay;
        
        const planSelect = document.getElementById(`planN${currentDay}`);
        if(planSelect && planSelect.value) {
            nightVictimSelect.value = planSelect.value;
        } else {
            nightVictimSelect.value = "";
        }

        nightModal.style.display = 'block';
        goToNightStep(1);
    });

    window.endNight = function() {
        const victimVal = nightVictimSelect.value;
        if(victimVal) {
            const card = document.getElementById(`card_${victimVal}`);
            if(card && !card.classList.contains('dead')) {
                card.querySelector('.status-btn').click();
            }
        }
        
        nightModal.style.display = 'none';
        currentDay++;
        startDayPhase();
    }

    // === Թեկնածություններ ===
    const addNominationBtn = document.getElementById('addNominationBtn');
    const clearNominationsBtn = document.getElementById('clearNominationsBtn');
    const nominationsList = document.getElementById('nominationsList');
    let nominations = [];

    function renderNominations() {
        nominationsList.innerHTML = '';
        nominations.forEach((nom, index) => {
            const nameInput = document.getElementById(`playerName_${nom.playerId}`);
            const displayName = nameInput.value.trim() !== '' ? nameInput.value : `Խաղացող ${nom.playerId}`;

            const li = document.createElement('li');
            li.className = 'nomination-item';
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="player-number" style="width: 28px; height: 28px; font-size: 0.9rem;">${nom.playerId}</span>
                    <span style="font-size: 1.1rem; font-weight: bold;">${displayName}</span>
                </div>
                <div class="nomination-votes">
                    <span style="color: #94a3b8; font-size: 0.9rem; margin-right: 5px;">Ձայներ:</span>
                    <button class="vote-btn" onclick="updateVote(${index}, -1)">-</button>
                    <span class="vote-count">${nom.votes}</span>
                    <button class="vote-btn" onclick="updateVote(${index}, 1)">+</button>
                </div>
            `;
            nominationsList.appendChild(li);
        });
    }

    window.updateVote = function(index, change) {
        let newVotes = nominations[index].votes + change;
        if (newVotes >= 0 && newVotes <= config.totalPlayers) {
            nominations[index].votes = newVotes;
            renderNominations();
        }
    };

    addNominationBtn.addEventListener('click', () => {
        const val = nominateSelect.value;
        if (!val) return;
        if (nominations.find(n => n.playerId == val)) {
            alert("Այս խաղացողն արդեն առաջադրված է:");
            return;
        }
        nominations.push({ playerId: val, votes: 0 });
        renderNominations();
        nominateSelect.value = '';
    });

    clearNominationsBtn.addEventListener('click', () => {
        if(nominations.length > 0 && confirm("Մաքրե՞լ ցուցակը:")) {
            nominations = [];
            renderNominations();
        }
    });

    // Modal close listeners
    document.getElementById('rulesBtn').addEventListener('click', () => document.getElementById('rulesModal').style.display = 'block');
    document.getElementById('closeRulesBtn').addEventListener('click', () => document.getElementById('rulesModal').style.display = 'none');
    document.getElementById('settingsBtn').addEventListener('click', () => document.getElementById('settingsModal').style.display = 'block');
    document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').style.display = 'none');
});