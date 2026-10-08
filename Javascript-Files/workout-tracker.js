document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('taskInput');
    const dateInput = document.getElementById('dateInput');
    const timeInput = document.getElementById('timeInput');
    const addBtn = document.getElementById('addBtn');
    const taskList = document.getElementById('taskList');
    const displayDateLabel = document.getElementById('displayDateLabel');

    // Top Progress Bar elements
    const topProgressPercent = document.getElementById('topProgressPercent');
    const topProgressBarFill = document.getElementById('topProgressBarFill');
    const topProgressTitle = document.getElementById('topProgressTitle');

    // UI Toast Notification
    const toastElement = document.getElementById('toast');
    let toastTimeout;
    function showNotification(message, isError = false) {
        toastElement.textContent = message;
        toastElement.className = `toast show ${isError ? 'error' : 'success'}`;
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastElement.className = 'toast';
        }, 3000);
    }

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    // Load tasks & water history from LocalStorage
    let tasks = JSON.parse(localStorage.getItem('workoutTasks')) || [];
    let waterHistory = JSON.parse(localStorage.getItem('waterHistory')) || {};
    
    // Assign IDs to old tasks if missing
    tasks.forEach(t => {
        if (!t.id) t.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    });

    // Helper: format date for display
    function formatDate(dateString) {
        if (!dateString) return '';
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // Function to render ONLY tasks for the selected date
    function renderTasks() {
        taskList.innerHTML = '';
        const selectedDate = dateInput.value;
        
        displayDateLabel.textContent = `( ${formatDate(selectedDate)} )`;
        const dailyTasks = tasks.filter(t => t.date === selectedDate);
        
        dailyTasks.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

        if (dailyTasks.length === 0) {
            taskList.innerHTML = '<li style="color: #94a3b8; text-align: center; padding: 20px;">No tasks for this date.</li>';
        } else {
            dailyTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.innerHTML = `
                    <label class="checkbox-container">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')">
                        <span class="checkmark"></span>
                        <div class="task-info">
                            <span class="task-datetime">${task.time ? task.time : 'Anytime'}</span>
                            <span class="task-text-content">${task.text}</span>
                        </div>
                    </label>
                    <div class="task-actions">
                        <button class="delete-btn" onclick="deleteTask('${task.id}')" title="Delete Task">🗑️</button>
                    </div>
                `;
                taskList.appendChild(li);
            });
        }
        
        // Update Productivity Stats whenever tasks are rendered
        calculateProductivityStats(selectedDate);
    }

    dateInput.addEventListener('change', renderTasks);

    // Add new task
    addBtn.addEventListener('click', () => {
        const text = taskInput.value.trim();
        const date = dateInput.value;
        const time = timeInput.value;

        if (text === '') {
            showNotification('Please enter a goal or meal.', true);
            return;
        }

        tasks.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            text: text, date: date, time: time, completed: false
        });
        saveAndRender();
        taskInput.value = '';
    });

    window.toggleTask = function(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveAndRender();
        }
    };

    window.deleteTask = function(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveAndRender();
    };

    function saveAndRender() {
        localStorage.setItem('workoutTasks', JSON.stringify(tasks));
        renderTasks();
    }


    // ==========================================
    // --- ADVANCED ROUTINE MANAGER LOGIC ---
    // ==========================================
    let savedRoutines = JSON.parse(localStorage.getItem('savedRoutines')) || {};
    const routineSelect = document.getElementById('routineSelect');
    const routineNameInput = document.getElementById('routineNameInput');
    
    function updateRoutineSelect() {
        routineSelect.innerHTML = '<option value="" disabled selected>Select a routine...</option>';
        for (let name in savedRoutines) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            routineSelect.appendChild(opt);
        }
    }
    updateRoutineSelect();

    document.getElementById('saveRoutineBtn').addEventListener('click', () => {
        const name = routineNameInput.value.trim();
        if (!name) return showNotification('Please enter a new name for your routine.', true);
        
        const selectedDate = dateInput.value;
        const dailyTasks = tasks.filter(t => t.date === selectedDate);
        if (dailyTasks.length === 0) return showNotification('No tasks found to save!', true);
        
        savedRoutines[name] = dailyTasks.map(t => ({ text: t.text, time: t.time }));
        localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
        updateRoutineSelect();
        routineNameInput.value = '';
        showNotification(`Routine "${name}" saved!`);
    });

    document.getElementById('loadRoutineBtn').addEventListener('click', () => {
        const name = routineSelect.value;
        if (!name) return showNotification('Please select a routine to paste.', true);
        
        const template = savedRoutines[name];
        const selectedDate = dateInput.value;
        
        if (tasks.filter(t => t.date === selectedDate).length > 0) {
            if (!confirm(`Clear current tasks for ${formatDate(selectedDate)} and paste "${name}"?`)) return;
        }

        tasks = tasks.filter(t => t.date !== selectedDate);
        template.forEach(item => {
            tasks.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                text: item.text, date: selectedDate, time: item.time, completed: false
            });
        });

        saveAndRender();
        showNotification(`Pasted "${name}".`);
    });

    document.getElementById('updateRoutineBtn').addEventListener('click', () => {
        const name = routineSelect.value;
        if (!name) return showNotification('Select a routine to update.', true);

        const dailyTasks = tasks.filter(t => t.date === dateInput.value);
        if (dailyTasks.length === 0) return showNotification('No tasks to update!', true);

        savedRoutines[name] = dailyTasks.map(t => ({ text: t.text, time: t.time }));
        localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
        showNotification(`Routine "${name}" updated!`);
    });

    document.getElementById('deleteRoutineBtn').addEventListener('click', () => {
        const name = routineSelect.value;
        if (!name) return;
        if (confirm(`Delete routine "${name}" forever?`)) {
            delete savedRoutines[name];
            localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
            updateRoutineSelect();
            showNotification(`Routine deleted.`);
        }
    });

    document.getElementById('clearTasksBtn').addEventListener('click', () => {
        const selectedDate = dateInput.value;
        if (tasks.filter(t => t.date === selectedDate).length === 0) return;
        if (confirm(`Clear ALL tasks for ${formatDate(selectedDate)}?`)) {
            tasks = tasks.filter(t => t.date !== selectedDate);
            saveAndRender();
            showNotification('Tasks cleared.');
        }
    });


    // ==========================================
    // --- WATER TRACKER LOGIC ---
    // ==========================================
    const waterSettings = document.getElementById('waterSettings');
    const waterMain = document.getElementById('waterMain');
    const calcWaterBtn = document.getElementById('calcWaterBtn');
    
    // Collapsible elements
    const waterCollapsed = document.getElementById('waterCollapsed');
    const waterExpandedContent = document.getElementById('waterExpandedContent');
    const collapseWaterBtn = document.getElementById('collapseWaterBtn');
    const expandWaterBtn = document.getElementById('expandWaterBtn');
    const collapsedWaterText = document.getElementById('collapsedWaterText');

    let waterGoal = parseFloat(localStorage.getItem('waterGoal')) || 0;
    let currentWater = parseFloat(localStorage.getItem('currentWater')) || 0;
    let lastWaterDate = localStorage.getItem('lastWaterDate');
    let isWaterCollapsed = localStorage.getItem('isWaterCollapsed') === 'true';

    if (lastWaterDate !== today) {
        currentWater = 0;
        localStorage.setItem('currentWater', currentWater);
        localStorage.setItem('lastWaterDate', today);
    }

    function updateCollapseUI() {
        if (isWaterCollapsed) {
            waterCollapsed.style.display = 'block';
            waterExpandedContent.style.display = 'none';
        } else {
            waterCollapsed.style.display = 'none';
            waterExpandedContent.style.display = 'block';
        }
        
        if (waterGoal > 0) {
            const percent = Math.min(Math.round((currentWater / waterGoal) * 100), 100);
            collapsedWaterText.textContent = `Water: ${currentWater.toFixed(1)}L (${percent}%)`;
        } else {
            collapsedWaterText.textContent = `Water Tracker`;
        }
    }

    collapseWaterBtn.addEventListener('click', () => {
        isWaterCollapsed = true;
        localStorage.setItem('isWaterCollapsed', 'true');
        updateCollapseUI();
    });

    expandWaterBtn.addEventListener('click', () => {
        isWaterCollapsed = false;
        localStorage.setItem('isWaterCollapsed', 'false');
        updateCollapseUI();
    });

    function initWaterTracker() {
        if (waterGoal > 0) {
            waterSettings.style.display = 'none';
            waterMain.style.display = 'block';
            updateWaterDisplay();
        } else {
            waterSettings.style.display = 'block';
            waterMain.style.display = 'none';
        }
        updateCollapseUI();
    }

    function updateWaterDisplay() {
        document.getElementById('currentWater').textContent = currentWater.toFixed(2);
        document.getElementById('goalWater').textContent = waterGoal.toFixed(1);
        
        let percentage = (currentWater / waterGoal) * 100;
        if (percentage > 100) percentage = 100;
        
        const bar = document.getElementById('waterProgressBar');
        bar.style.width = `${percentage}%`;
        bar.style.background = percentage >= 100 
            ? 'linear-gradient(90deg, #10b981, #34d399)' 
            : 'linear-gradient(90deg, #0ea5e9, #38bdf8)';

        waterHistory[today] = { goal: waterGoal, current: currentWater };
        localStorage.setItem('waterHistory', JSON.stringify(waterHistory));
        
        calculateProductivityStats(dateInput.value);
        updateCollapseUI();
    }

    calcWaterBtn.addEventListener('click', () => {
        const weight = parseFloat(document.getElementById('weightInput').value);
        const activity = document.getElementById('activityInput').value;
        if (!weight || !activity) return showNotification('Please enter weight and activity.', true);

        let baseMl = weight * 35; 
        if (activity === 'medium') baseMl += 500;
        if (activity === 'high') baseMl += 1000;

        waterGoal = parseFloat((baseMl / 1000).toFixed(1));
        localStorage.setItem('waterGoal', waterGoal);
        localStorage.setItem('waterSettings', JSON.stringify({
            weight: weight, height: document.getElementById('heightInput').value,
            gender: document.getElementById('genderInput').value, activity: activity
        }));

        initWaterTracker();
    });

    document.getElementById('editWaterBtn').addEventListener('click', () => {
        const s = JSON.parse(localStorage.getItem('waterSettings'));
        if (s) {
            document.getElementById('weightInput').value = s.weight;
            document.getElementById('heightInput').value = s.height;
            document.getElementById('genderInput').value = s.gender;
            document.getElementById('activityInput').value = s.activity;
        }
        waterSettings.style.display = 'block';
        waterMain.style.display = 'none';
    });

    document.querySelectorAll('.add-water-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentWater += parseFloat(e.target.getAttribute('data-amount'));
            localStorage.setItem('currentWater', currentWater.toFixed(2));
            updateWaterDisplay();
        });
    });

    document.getElementById('resetWaterBtn').addEventListener('click', () => {
        currentWater = 0;
        localStorage.setItem('currentWater', 0);
        updateWaterDisplay();
    });

    initWaterTracker();


    // ==========================================
    // --- PRODUCTIVITY STATS LOGIC ---
    // ==========================================
    function calculateProductivityStats(selectedDateStr) {
        const selectedDate = new Date(selectedDateStr);
        const selectedMonthPrefix = selectedDateStr.substring(0, 7); 
        
        let dTotal = 0, dComp = 0;
        let wTotal = 0, wComp = 0;
        let mTotal = 0, mComp = 0;

        // Process Tasks (Whole numbers: 0 or 1)
        tasks.forEach(t => {
            const taskDate = new Date(t.date);
            const isCompleted = t.completed ? 1 : 0;
            
            if (t.date === selectedDateStr) { dTotal++; dComp += isCompleted; }
            if (t.date.startsWith(selectedMonthPrefix)) { mTotal++; mComp += isCompleted; }
            
            const diffDays = Math.ceil((taskDate - selectedDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0 && diffDays >= -6) { wTotal++; wComp += isCompleted; }
        });

        // Process Water (Proportional tracking, max 1.0)
        for (const [wDate, wData] of Object.entries(waterHistory)) {
            if (wData.goal <= 0) continue; 
            
            const waterProgress = Math.min(wData.current / wData.goal, 1);
            const taskDate = new Date(wDate);
            
            if (wDate === selectedDateStr) { dTotal++; dComp += waterProgress; }
            if (wDate.startsWith(selectedMonthPrefix)) { mTotal++; mComp += waterProgress; }
            
            const diffDays = Math.ceil((taskDate - selectedDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0 && diffDays >= -6) { wTotal++; wComp += waterProgress; }
        }

        // --- UPDATE TOP DAILY PROGRESS BAR (Proposal 3) ---
        if (dTotal === 0) {
            topProgressPercent.textContent = "0%";
            topProgressBarFill.style.width = "0%";
            topProgressTitle.textContent = `${formatDate(selectedDateStr)} Progress (No Goals)`;
        } else {
            const dPercentage = Math.round((dComp / dTotal) * 100);
            topProgressPercent.textContent = `${dPercentage}%`;
            topProgressBarFill.style.width = `${dPercentage}%`;
            
            if (dPercentage >= 80) {
                topProgressBarFill.style.background = "linear-gradient(90deg, #10b981, #34d399)";
            } else if (dPercentage >= 50) {
                topProgressBarFill.style.background = "linear-gradient(90deg, #f59e0b, #fbbf24)";
            } else {
                topProgressBarFill.style.background = "linear-gradient(90deg, #0ea5e9, #3b82f6)";
            }
            topProgressTitle.textContent = `${formatDate(selectedDateStr)} Progress`;
        }

        function updateStatUI(elValue, elCount, comp, total) {
            if (total === 0) {
                elValue.textContent = "-";
                elValue.style.color = "#64748b"; 
                elCount.textContent = "No Goals";
            } else {
                const percentage = Math.round((comp / total) * 100);
                elValue.textContent = `${percentage}%`;
                
                const compFormatted = Number.isInteger(comp) ? comp : comp.toFixed(1);
                elCount.textContent = `${compFormatted}/${total} Goals`;
                
                if (percentage >= 80) elValue.style.color = "#10b981"; 
                else if (percentage >= 50) elValue.style.color = "#f59e0b"; 
                else elValue.style.color = "#ef4444"; 
            }
        }

        updateStatUI(document.getElementById('dailyStat'), document.getElementById('dailyCount'), dComp, dTotal);
        updateStatUI(document.getElementById('weeklyStat'), document.getElementById('weeklyCount'), wComp, wTotal);
        updateStatUI(document.getElementById('monthlyStat'), document.getElementById('monthlyCount'), mComp, mTotal);
    }

    // ==========================================
    // --- HISTORY VIEWER LOGIC ---
    // ==========================================
    const historyDateInput = document.getElementById('historyDateInput');
    const checkHistoryBtn = document.getElementById('checkHistoryBtn');
    const historyResult = document.getElementById('historyResult');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    historyDateInput.value = yesterday.toISOString().split('T')[0];

    checkHistoryBtn.addEventListener('click', () => {
        const dateStr = historyDateInput.value;
        if (!dateStr) return;

        let total = 0;
        let comp = 0;

        const dayTasks = tasks.filter(t => t.date === dateStr);
        total += dayTasks.length;
        comp += dayTasks.filter(t => t.completed).length;

        if (waterHistory[dateStr] && waterHistory[dateStr].goal > 0) {
            total += 1;
            comp += Math.min(waterHistory[dateStr].current / waterHistory[dateStr].goal, 1);
        }

        if (total === 0) {
            historyResult.innerHTML = `<span style="color: #94a3b8;">No records found for ${formatDate(dateStr)}.</span>`;
        } else {
            const percentage = Math.round((comp / total) * 100);
            let color = "#ef4444";
            if (percentage >= 80) color = "#10b981";
            else if (percentage >= 50) color = "#f59e0b";

            const compFormatted = Number.isInteger(comp) ? comp : comp.toFixed(1);

            historyResult.innerHTML = `
                <div style="font-size: 2rem; font-weight: bold; color: ${color}; margin-bottom: 5px;">${percentage}%</div>
                <div style="font-size: 0.95rem; color: #cbd5e1;">${compFormatted} out of ${total} Goals Completed</div>
            `;
        }
    });

    // ==========================================
    // --- DATA EXPORT / IMPORT (BACKUP) ---
    // ==========================================
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    exportBtn.addEventListener('click', () => {
        const backupData = {
            workoutTasks: localStorage.getItem('workoutTasks'),
            savedRoutines: localStorage.getItem('savedRoutines'),
            waterSettings: localStorage.getItem('waterSettings'),
            waterGoal: localStorage.getItem('waterGoal'),
            currentWater: localStorage.getItem('currentWater'),
            lastWaterDate: localStorage.getItem('lastWaterDate'),
            waterHistory: localStorage.getItem('waterHistory')
        };

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `Workout_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification("Data backed up successfully!");
    });

    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                String(e.target.result);
                const importedData = JSON.parse(e.target.result);
                if (importedData.workoutTasks !== undefined) {
                    for (const key in importedData) {
                        if (importedData[key] !== null && importedData[key] !== undefined) {
                            localStorage.setItem(key, importedData[key]);
                        }
                    }
                    showNotification("Data restored successfully! Refreshing...");
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showNotification("Error: Invalid backup file format.", true);
                }
            } catch (error) {
                showNotification("Error reading the backup file.", true);
            }
        };
        
        reader.readAsText(file);
        importFile.value = '';
    });

    renderTasks();
});