document.addEventListener('DOMContentLoaded', () => {
    // === ԳԼՈԲԱԼ ՓՈՓՈԽԱԿԱՆՆԵՐ ===
    let isGameStarted = false;
    let currentDay = 1;
    let turnIndex = 0;
    let alivePlayersOrder = [];
    
    let isTieBreaker = false;
    let tiedPlayersOrder = [];
    let tieTurnIndex = 0;

    // === Միասնական Կառավարման Վահանակի Ստեղծում ===
    const isDesktop = window.innerWidth > 768; 
    
    const floatingPanel = document.createElement('div');
    floatingPanel.id = 'floatingControlsPanel';
    document.body.appendChild(floatingPanel);

    function dockToSidebar(el) {
        if (!el) return;
        floatingPanel.appendChild(el);
    }

    const mafiaPlanSec = document.getElementById('mafiaPlanSection');
    const nominateBtn = document.getElementById('addNominationBtn');
    
    if (isDesktop) {
        if (mafiaPlanSec) {
            dockToSidebar(mafiaPlanSec);
        }
        if (nominateBtn) {
            const nomContainer = nominateBtn.closest('.glass-panel') || nominateBtn.parentElement;
            if (nomContainer) {
                dockToSidebar(nomContainer);
            }
        }
    } 

    const mainTimerWidget = document.getElementById('mainTimerWidget');
    if (mainTimerWidget) {
        dockToSidebar(mainTimerWidget);
    }

    // === Ժամաչափի Տրամաբանություն ===
    const timerDisplay = document.getElementById('timerDisplay');
    const startTimerBtn = document.getElementById('startTimerBtn');
    const resetTimerBtn = document.getElementById('resetTimerBtn');
    
    let timeLeft = 60;
    let timerInterval = null;
    let isRunning = false;

    function updateTimerDisplay() {
        let minutes = Math.floor(timeLeft / 60);
        let seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 10 && timeLeft > 0) {
            timerDisplay.style.color = '#ef4444';
        } else {
            if(timerDisplay) timerDisplay.style.color = isTieBreaker ? '#ef4444' : '#10b981';
        }
        
        if (mainTimerWidget) {
            mainTimerWidget.style.borderColor = isTieBreaker ? '#ef4444' : '#10b981';
        }
    }

    function resetTimerLogic() {
        clearInterval(timerInterval);
        isRunning = false;
        timeLeft = isTieBreaker ? 30 : 60;
        updateTimerDisplay();
        if(startTimerBtn) {
            startTimerBtn.textContent = '▶ Սկսել';
            startTimerBtn.classList.remove('paused');
        }
    }

    if(startTimerBtn) {
        startTimerBtn.addEventListener('click', () => {
            if (isRunning) {
                clearInterval(timerInterval);
                startTimerBtn.textContent = '▶ Սկսել';
                startTimerBtn.classList.remove('paused');
                isRunning = false;
            } else {
                if (timeLeft === 0) timeLeft = isTieBreaker ? 30 : 60; 
                timerInterval = setInterval(() => {
                    timeLeft--;
                    updateTimerDisplay();
                    if (timeLeft <= 0) {
                        clearInterval(timerInterval);
                        isRunning = false;
                        startTimerBtn.textContent = '▶ Սկսել';
                        startTimerBtn.classList.remove('paused');
                        
                        if (isGameStarted) {
                            const nextBtn = document.getElementById('nextTurnBtn');
                            if(nextBtn && nextBtn.style.display !== 'none') {
                                nextBtn.click();
                            }
                        }
                    }
                }, 1000);
                startTimerBtn.textContent = '⏸ Դադար';
                startTimerBtn.classList.add('paused');
                isRunning = true;
            }
        });
    }

    if(resetTimerBtn) {
        resetTimerBtn.addEventListener('click', resetTimerLogic);
    }

    // === Խաղի Կարգավորումներ ===
    let config = { totalPlayers: 10, totalBlack: 3, totalRed: 7 };

    const totalPlayersInput = document.getElementById('totalPlayersInput');
    const blackCountInput = document.getElementById('blackCountInput');
    const redCountInput = document.getElementById('redCountInput');
    
    function updateRedCount() {
        let t = parseInt(totalPlayersInput.value) || 0;
        let b = parseInt(blackCountInput.value) || 0;
        if (b > t) { b = t; blackCountInput.value = b; }
        if(redCountInput) redCountInput.value = t - b;
    }
    if(totalPlayersInput) totalPlayersInput.addEventListener('input', updateRedCount);
    if(blackCountInput) blackCountInput.addEventListener('input', updateRedCount);

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if(saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            config.totalPlayers = parseInt(totalPlayersInput.value);
            config.totalBlack = parseInt(blackCountInput.value);
            config.totalRed = parseInt(redCountInput.value);
            const settingsModal = document.getElementById('settingsModal');
            if(settingsModal) settingsModal.style.display = 'none';
            generateGame();
        });
    }

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
        
        let planOptionsHtml = '<option value="">--</option>';
        for (let i = 1; i <= config.totalPlayers; i++) {
            planOptionsHtml += `<option value="${i}">${i}</option>`;
        }
        
        if(planN1) { const v1 = planN1.value; planN1.innerHTML = planOptionsHtml; planN1.value = v1; }
        if(planN2) { const v2 = planN2.value; planN2.innerHTML = planOptionsHtml; planN2.value = v2; }
        if(planN3) { const v3 = planN3.value; planN3.innerHTML = planOptionsHtml; planN3.value = v3; }
        
        let victimHtml = '<option value="">-- Վրիպում (Ոչ ոք չի մահանում) --</option>';
        for (let i = 1; i <= config.totalPlayers; i++) {
            victimHtml += `<option value="${i}">${i}. Խաղացող ${i}</option>`;
        }
        if(nightVictimSelect) nightVictimSelect.innerHTML = victimHtml;
    }

    function generateGame() {
        isGameStarted = false;
        
        const startGameSec = document.getElementById('startGameSection');
        const gamePhaseCont = document.getElementById('gamePhaseContainer');
        
        if(startGameSec) startGameSec.style.display = 'block';
        if(gamePhaseCont) gamePhaseCont.style.display = 'none';
        
        resetTimerLogic();
        
        if(playersGrid) playersGrid.innerHTML = '';
        if(nominateSelect) nominateSelect.innerHTML = '<option value="" disabled selected>Ընտրել խաղացողին...</option>';

        for (let i = 1; i <= config.totalPlayers; i++) {
            const card = document.createElement('div');
            card.className = 'player-card glass-panel';
            card.id = `card_${i}`;
            card.innerHTML = `
                <div class="player-header">
                    <div class="player-number">${i}</div>
                    <span>Խաղացող ${i}</span>
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
            if(playersGrid) playersGrid.appendChild(card);
            
            if(nominateSelect) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = `Խաղացող ${i}`;
                nominateSelect.appendChild(opt);
            }

            const roleSelect = card.querySelector('.player-role');
            if(roleSelect) {
                roleSelect.addEventListener('change', (e) => {
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
        }
        
        populateSelects();
    }
    
    generateGame();

    const initGameBtn = document.getElementById('initGameBtn');
    if(initGameBtn) {
        initGameBtn.addEventListener('click', () => {
            let unassigned = 0;
            document.querySelectorAll('.player-role').forEach(s => { if(!s.value) unassigned++; });
            if(unassigned > 0) {
                alert("Խնդրում ենք բոլոր խաղացողներին դերեր տալ նախքան խաղը սկսելը:");
                return;
            }

            isGameStarted = true;
            document.getElementById('startGameSection').style.display = 'none';
            document.getElementById('gamePhaseContainer').style.display = 'flex';
            
            if(planN1) planN1.disabled = true; 
            if(planN2) planN2.disabled = true; 
            if(planN3) planN3.disabled = true;
            
            document.querySelectorAll('.player-role').forEach(s => s.disabled = true);
            
            document.querySelectorAll('.player-card').forEach((card, i) => {
                const num = i + 1;
                const foulPlus = card.querySelector('.foul-plus');
                const foulMinus = card.querySelector('.foul-minus');
                const statusBtn = card.querySelector('.status-btn');
                const foulCountDisplay = card.querySelector('.foul-count');
                let fouls = 0;
                let isAlive = true;
                
                if(foulPlus) foulPlus.disabled = false; 
                if(foulMinus) foulMinus.disabled = false; 
                if(statusBtn) statusBtn.disabled = false;

                if(foulPlus) {
                    foulPlus.addEventListener('click', () => {
                        if (!isAlive) return;
                        if (fouls < 4) fouls++;
                        foulCountDisplay.textContent = fouls;
                        if (fouls === 3) foulCountDisplay.classList.add('danger');
                        else if (fouls === 4) {
                            killPlayer();
                            alert(`Խաղացող ${num}-ը ստացավ 4-րդ նկատողությունը և լքում է խաղը:`);
                            if (card.classList.contains('active-turn')) {
                                const nextBtn = document.getElementById('nextTurnBtn');
                                if(nextBtn) nextBtn.click();
                            }
                        }
                    });
                }
                
                if(foulMinus) {
                    foulMinus.addEventListener('click', () => {
                        if (fouls > 0) fouls--;
                        foulCountDisplay.textContent = fouls;
                        if (fouls < 3) foulCountDisplay.classList.remove('danger');
                    });
                }
                
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
                if(statusBtn) {
                    statusBtn.addEventListener('click', () => { isAlive ? killPlayer() : revivePlayer(); });
                }
            });

            startDayPhase();
        });
    }

    const phaseTitle = document.getElementById('phaseTitle');
    const turnTitle = document.getElementById('turnTitle');
    const startNightBtn = document.getElementById('startNightBtn');
    const nextTurnBtn = document.getElementById('nextTurnBtn');
    const prevTurnBtn = document.getElementById('prevTurnBtn');

    function startDayPhase() {
        let tempAlive = [];
        document.querySelectorAll('.player-card').forEach((card, idx) => {
            if(!card.classList.contains('dead')) tempAlive.push(idx + 1);
        });
        
        if (tempAlive.length > 0) {
            let targetStartPlayer = ((currentDay - 1) % config.totalPlayers) + 1;
            let startIndex = 0;
            for(let i = 0; i < tempAlive.length; i++) {
                if(tempAlive[i] >= targetStartPlayer) {
                    startIndex = i;
                    break;
                }
            }
            alivePlayersOrder = tempAlive.slice(startIndex).concat(tempAlive.slice(0, startIndex));
        }
        
        turnIndex = 0;
        if(phaseTitle) phaseTitle.textContent = `☀️ Օր ${currentDay}`;
        updateTurnDisplay();
    }

    function updateTurnDisplay() {
        resetTimerLogic();
        
        document.querySelectorAll('.player-card').forEach(c => {
            c.classList.remove('active-turn');
            c.style.boxShadow = '';
            c.style.transform = '';
            c.style.borderColor = '';
        });
        document.querySelectorAll('.player-number').forEach(num => {
            num.style.backgroundColor = '#334155'; 
            num.style.transform = 'scale(1)';
        });
        
        let currentOrder = isTieBreaker ? tiedPlayersOrder : alivePlayersOrder;
        let currentIndex = isTieBreaker ? tieTurnIndex : turnIndex;
        
        if (currentIndex < currentOrder.length && currentIndex >= 0) {
            const activePlayer = currentOrder[currentIndex];
            const name = `Խաղացող ${activePlayer}`;
            
            if(turnTitle) {
                turnTitle.textContent = isTieBreaker ? `🚗 Ավտովթար. Խոսում է ${activePlayer}. ${name}` : `🗣️ Խոսում է ${activePlayer}. ${name}`;
            }
            
            if(startNightBtn) startNightBtn.style.display = 'none';
            if(nextTurnBtn) nextTurnBtn.style.display = 'inline-block';
            
            const activeCard = document.getElementById(`card_${activePlayer}`);
            if(activeCard) {
                activeCard.classList.add('active-turn');
                activeCard.style.boxShadow = isTieBreaker ? '0 0 25px rgba(239, 68, 68, 0.7)' : '0 0 25px rgba(16, 185, 129, 0.7)';
                activeCard.style.transform = 'scale(1.03)';
                activeCard.style.borderColor = isTieBreaker ? '#ef4444' : '#10b981';
                
                const playerNumBadge = activeCard.querySelector('.player-number');
                if(playerNumBadge) {
                    playerNumBadge.style.backgroundColor = isTieBreaker ? '#ef4444' : '#10b981';
                    playerNumBadge.style.transform = 'scale(1.2)';
                }
            }
        } else {
            if (isTieBreaker) {
                setTimeout(() => { handleTieBreakerResolution(); }, 100);
            } else {
                if(turnTitle) turnTitle.textContent = `⚖️ Քվեարկության ժամանակն է`;
                if(startNightBtn) startNightBtn.style.display = 'inline-block';
                if(nextTurnBtn) nextTurnBtn.style.display = 'none';
            }
        }
    }

    if(nextTurnBtn) {
        nextTurnBtn.addEventListener('click', () => {
            if (isTieBreaker) tieTurnIndex++;
            else turnIndex++;
            updateTurnDisplay();
        });
    }
    
    if(prevTurnBtn) {
        prevTurnBtn.addEventListener('click', () => {
            if (isTieBreaker) {
                if(tieTurnIndex > 0) tieTurnIndex--;
            } else {
                if(turnIndex > 0) turnIndex--;
            }
            updateTurnDisplay();
        });
    }

    // === ԳԻՇԵՐԱՅԻՆ ՓՈՒԼ ԵՎ ԱՎՏՈՎԹԱՐ ===
    const nightModal = document.getElementById('nightModal');
    
    window.goToNightStep = function(stepNum) {
        document.querySelectorAll('.night-step').forEach(el => el.style.display = 'none');
        const stepEl = document.getElementById(`nightStep${stepNum}`);
        if(stepEl) stepEl.style.display = 'block';
    }
    
    function triggerNightPhase() {
        const nightNumDisp = document.getElementById('nightNumberDisplay');
        if (nightNumDisp) nightNumDisp.textContent = currentDay;
        
        const planSelect = document.getElementById(`planN${currentDay}`);
        if(planSelect && planSelect.value && nightVictimSelect) {
            nightVictimSelect.value = planSelect.value;
        } else if (nightVictimSelect) {
            nightVictimSelect.value = "";
        }

        if(nightModal) nightModal.style.display = 'block';
        if(typeof goToNightStep === 'function') goToNightStep(1);
    }
    
    function handleTieBreakerResolution() {
        const stillTied = confirm("⚖️ ԿՐԿՆԱԿԻ ՔՎԵԱՐԿՈՒԹՅՈՒՆ:\nԱրդյո՞ք խաղացողները կրկին հավասար ձայներ ստացան վերաքվեարկությունից հետո:\n\n[OK] = Այո, կրկին հավասար են\n[Cancel] = Ոչ, մեկը հաղթեց (ընտրել ձեռքով)");
        
        if (stillTied) {
            const eliminateAll = confirm("⚖️ ՀԱՄԱՏԵՂ ՀԵՌԱՑՈՒՄ:\nՍեղանի մեծամասնությունը (50% կամ ավել) կողմ քվեարկե՞ց, որպեսզի ԲՈԼՈՐԸ միասին հեռանան խաղից:\n\n[OK] = Այո, հեռացնել բոլորին և գնալ գիշեր\n[Cancel] = Ոչ, ոչ ոք չի հեռանում, գնալ գիշեր");
            
            if (eliminateAll) {
                tiedPlayersOrder.forEach(id => {
                    const card = document.getElementById(`card_${id}`);
                    if (card && !card.classList.contains('dead')) {
                        const sBtn = card.querySelector('.status-btn');
                        if (sBtn) sBtn.click();
                    }
                });
                alert("Բոլոր ավտովթարի մասնակիցները հեռացվեցին խաղից:");
            } else {
                alert("Ոչ ոք չի հեռանում խաղից:");
            }
            
            isTieBreaker = false;
            nominations = [];
            renderNominations();
            triggerNightPhase(); 
        } else {
            alert("Խնդրում ենք մուտքագրել վերաքվեարկության ճիշտ ձայները թեկնածուների ցանկում և նորից սեղմել 'Անցնել Գիշերվա':");
            isTieBreaker = false;
            turnIndex = alivePlayersOrder.length; 
            updateTurnDisplay();
        }
    }

    if(startNightBtn) {
        startNightBtn.addEventListener('click', () => {
            if (nominations.length === 1) {
                alert("⚠️ Առաջադրվել է միայն 1 թեկնածու: Ըստ կանոնների՝ մեկ թեկնածու չի քվեարկվում, և նա մնում է խաղում:");
                nominations = []; 
                renderNominations();
            } else if (nominations.length > 1) {
                let maxVotes = -1;
                let candidatesWithMax = [];
                let totalVotes = 0;
                
                nominations.forEach(n => {
                    totalVotes += n.votes;
                    if (n.votes > maxVotes) {
                        maxVotes = n.votes;
                        candidatesWithMax = [n];
                    } else if (n.votes === maxVotes) {
                        candidatesWithMax.push(n);
                    }
                });

                if (totalVotes === 0) {
                    const proceed = confirm("⚠️ Քվեարկության ձայներ մուտքագրված չեն (0 ձայն): Եթե բոլորը վրիպել են (ոչ ոք չի հեռանում), սեղմեք OK՝ գիշերվան անցնելու համար:\nԱյլապես սեղմեք Cancel և գրանցեք ձայները (+ և - կոճակներով):");
                    if (!proceed) return;
                    nominations = [];
                    renderNominations();
                } else if (candidatesWithMax.length === 1) {
                    const eliminated = candidatesWithMax[0];
                    const confirmKill = confirm(`⚖️ ՔՎԵԱՐԿՈՒԹՅԱՆ ԱՐԴՅՈՒՆՔ:\nԽաղացող ${eliminated.playerId}-ը հավաքել է առավելագույն ${eliminated.votes} ձայն:\n\nՀեռացնե՞լ նրան խաղից և անցնել գիշերվան:`);
                    if (!confirmKill) return; 
                    
                    const card = document.getElementById(`card_${eliminated.playerId}`);
                    if (card && !card.classList.contains('dead')) {
                        const sBtn = card.querySelector('.status-btn');
                        if (sBtn) sBtn.click(); 
                    }
                    nominations = [];
                    renderNominations();
                } else {
                    const tiedPlayers = candidatesWithMax.map(c => c.playerId).join(', ');
                    const confirmTie = confirm(`🚗 ԱՎՏՈՎԹԱՐ (Tie):\nԽաղացողներ ${tiedPlayers}-ը ունեն հավասար ձայներ (${maxVotes}):\n\nՍկսե՞լ Ավտովթարի փուլը (յուրաքանչյուրին տրվում է 30 վայրկյան ելույթի համար):`);
                    if (confirmTie) {
                        isTieBreaker = true;
                        tiedPlayersOrder = candidatesWithMax.map(c => c.playerId);
                        tieTurnIndex = 0;
                        updateTurnDisplay(); 
                    }
                    return; 
                }
            }

            triggerNightPhase();
        });
    }

    window.endNight = function() {
        if(nightVictimSelect) {
            const victimVal = nightVictimSelect.value;
            if(victimVal) {
                const card = document.getElementById(`card_${victimVal}`);
                if(card && !card.classList.contains('dead')) {
                    const sBtn = card.querySelector('.status-btn');
                    if(sBtn) sBtn.click();
                }
            }
        }
        
        if(nightModal) nightModal.style.display = 'none';
        currentDay++;
        startDayPhase();
    }

    // === Թեկնածություններ ===
    const addNominationBtn = document.getElementById('addNominationBtn');
    const clearNominationsBtn = document.getElementById('clearNominationsBtn');
    const nominationsList = document.getElementById('nominationsList');
    let nominations = [];

    function renderNominations() {
        if(!nominationsList) return;
        nominationsList.innerHTML = '';
        nominations.forEach((nom, index) => {
            const displayName = `Խաղացող ${nom.playerId}`;

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
        const aliveCount = document.querySelectorAll('.player-card:not(.dead)').length;
        
        if (newVotes >= 0 && newVotes <= aliveCount) {
            nominations[index].votes = newVotes;
            renderNominations();
        } else if (newVotes > aliveCount) {
            alert(`⚠️ Անհնար է! Խաղում կա ընդամենը ${aliveCount} կենդանի խաղացող:`);
        }
    };

    if(addNominationBtn) {
        addNominationBtn.addEventListener('click', () => {
            if(!nominateSelect) return;
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
    }

    if(clearNominationsBtn) {
        clearNominationsBtn.addEventListener('click', () => {
            if(nominations.length > 0 && confirm("Մաքրե՞լ ցուցակը:")) {
                nominations = [];
                renderNominations();
            }
        });
    }

    // Modal close listeners
    const rulesBtn = document.getElementById('rulesBtn');
    const rulesModal = document.getElementById('rulesModal');
    const closeRulesBtn = document.getElementById('closeRulesBtn');
    
    if(rulesBtn && rulesModal) rulesBtn.addEventListener('click', () => rulesModal.style.display = 'block');
    if(closeRulesBtn && rulesModal) closeRulesBtn.addEventListener('click', () => rulesModal.style.display = 'none');
    
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    
    if(settingsBtn && settingsModal) settingsBtn.addEventListener('click', () => settingsModal.style.display = 'block');
    if(closeSettingsBtn && settingsModal) closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
});