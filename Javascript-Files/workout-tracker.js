document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('taskInput');
    const dateInput = document.getElementById('dateInput');
    const timeInput = document.getElementById('timeInput');
    const addBtn = document.getElementById('addBtn');
    const taskList = document.getElementById('taskList');
    const displayDateLabel = document.getElementById('displayDateLabel');

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

    // Load tasks from LocalStorage
    let tasks = JSON.parse(localStorage.getItem('workoutTasks')) || [];
    
    // Assign IDs to old tasks if they don't have one (for safer deleting/toggling)
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
        
        // Filter tasks for the selected date
        const dailyTasks = tasks.filter(t => t.date === selectedDate);
        
        // Sort by time
        dailyTasks.sort((a, b) => {
            let timeA = a.time || '00:00';
            let timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
        });

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

    // Re-render when date changes
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

        const newTask = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            text: text,
            date: date,
            time: time,
            completed: false
        };

        tasks.push(newTask);
        saveAndRender();
        taskInput.value = '';
    });

    // Toggle completion status
    window.toggleTask = function(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveAndRender();
        }
    };

    // Delete task
    window.deleteTask = function(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveAndRender();
    };

    // Helper to save to storage and re-render
    function saveAndRender() {
        localStorage.setItem('workoutTasks', JSON.stringify(tasks));
        renderTasks();
    }


    // ==========================================
    // --- PRODUCTIVITY STATS LOGIC ---
    // ==========================================
    function calculateProductivityStats(selectedDateStr) {
        const dailyStat = document.getElementById('dailyStat');
        const dailyCount = document.getElementById('dailyCount');
        const weeklyStat = document.getElementById('weeklyStat');
        const weeklyCount = document.getElementById('weeklyCount');
        const monthlyStat = document.getElementById('monthlyStat');
        const monthlyCount = document.getElementById('monthlyCount');
        
        const selectedDate = new Date(selectedDateStr);
        const selectedMonthPrefix = selectedDateStr.substring(0, 7); // e.g., "2026-10"
        
        let dTotal = 0, dComp = 0;
        let wTotal = 0, wComp = 0;
        let mTotal = 0, mComp = 0;

        tasks.forEach(t => {
            const taskDate = new Date(t.date);
            const isCompleted = t.completed ? 1 : 0;
            
            // Daily
            if (t.date === selectedDateStr) {
                dTotal++;
                dComp += isCompleted;
            }
            
            // Monthly
            if (t.date.startsWith(selectedMonthPrefix)) {
                mTotal++;
                mComp += isCompleted;
            }
            
            // Weekly (last 7 days including selected date)
            // Diff in days: (taskDate - selectedDate) / ms in a day
            const diffTime = taskDate - selectedDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 0 && diffDays >= -6) {
                wTotal++;
                wComp += isCompleted;
            }
        });

        // Function to update the DOM elements
        function updateStatUI(elValue, elCount, comp, total) {
            if (total === 0) {
                elValue.textContent = "-";
                elValue.style.color = "#64748b"; // gray
                elCount.textContent = "No tasks";
            } else {
                const percentage = Math.round((comp / total) * 100);
                elValue.textContent = `${percentage}%`;
                elCount.textContent = `${comp}/${total} Tasks`;
                
                // Color coding
                if (percentage >= 80) elValue.style.color = "#10b981"; // green
                else if (percentage >= 50) elValue.style.color = "#f59e0b"; // yellow
                else elValue.style.color = "#ef4444"; // red
            }
        }

        updateStatUI(dailyStat, dailyCount, dComp, dTotal);
        updateStatUI(weeklyStat, weeklyCount, wComp, wTotal);
        updateStatUI(monthlyStat, monthlyCount, mComp, mTotal);
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
    
    updateRoutineSelect(); // initialize on load

    // 1. Save NEW Routine
    document.getElementById('saveRoutineBtn').addEventListener('click', () => {
        const name = routineNameInput.value.trim();
        if (!name) {
            showNotification('Please enter a new name for your routine.', true);
            return;
        }
        
        const selectedDate = dateInput.value;
        const dailyTasks = tasks.filter(t => t.date === selectedDate);
        
        if (dailyTasks.length === 0) {
            showNotification('No tasks found on this date to save!', true);
            return;
        }
        
        const template = dailyTasks.map(t => ({ text: t.text, time: t.time }));
        savedRoutines[name] = template;
        
        localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
        updateRoutineSelect();
        routineNameInput.value = '';
        showNotification(`Routine "${name}" saved!`);
    });

    // 2. Load Routine (Replace existing day's tasks)
    document.getElementById('loadRoutineBtn').addEventListener('click', () => {
        const name = routineSelect.value;
        if (!name) {
            showNotification('Please select a routine to paste.', true);
            return;
        }
        
        const template = savedRoutines[name];
        const selectedDate = dateInput.value;
        
        const existingTasks = tasks.filter(t => t.date === selectedDate);
        if (existingTasks.length > 0) {
            const confirmOverwrite = confirm(`Warning: This will clear your current tasks for ${formatDate(selectedDate)} and paste "${name}". Continue?`);
            if (!confirmOverwrite) return;
        }

        tasks = tasks.filter(t => t.date !== selectedDate);

        template.forEach(item => {
            tasks.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                text: item.text,
                date: selectedDate,
                time: item.time,
                completed: false
            });
        });

        saveAndRender();
        showNotification(`Pasted "${name}" successfully.`);
    });

    // 3. UPDATE Existing Routine
    document.getElementById('updateRoutineBtn').addEventListener('click', () => {
        const name = routineSelect.value;
        if (!name) {
            showNotification('Select a routine to update.', true);
            return;
        }

        const selectedDate = dateInput.value;
        const dailyTasks = tasks.filter(t => t.date === selectedDate);
        
        if (dailyTasks.length === 0) {
            showNotification('No tasks found on this date to update!', true);
            return;
        }

        const template = dailyTasks.map(t => ({ text: t.text, time: t.time }));
        savedRoutines[name] = template;
        localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
        showNotification(`Routine "${name}" updated!`);
    });

    // 4. Delete a Routine
    document.getElementById('deleteRoutineBtn').addEventListener('click', () => {
        const name = routineSelect.value;
        if (!name) return;
        
        if (confirm(`Are you sure you want to delete the saved routine "${name}" forever?`)) {
            delete savedRoutines[name];
            localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
            updateRoutineSelect();
            showNotification(`Routine "${name}" deleted.`);
        }
    });

    // 5. Clear Day's Tasks
    document.getElementById('clearTasksBtn').addEventListener('click', () => {
        const selectedDate = dateInput.value;
        const dailyTasks = tasks.filter(t => t.date === selectedDate);
        
        if (dailyTasks.length === 0) return;
        
        if (confirm(`Are you sure you want to clear ALL tasks for ${formatDate(selectedDate)}?`)) {
            tasks = tasks.filter(t => t.date !== selectedDate);
            saveAndRender();
            showNotification('All tasks cleared.');
        }
    });

    // Initial render call
    renderTasks();


    // ==========================================
    // --- WATER TRACKER LOGIC ---
    // ==========================================
    const waterSettings = document.getElementById('waterSettings');
    const waterMain = document.getElementById('waterMain');
    
    const weightInput = document.getElementById('weightInput');
    const heightInput = document.getElementById('heightInput');
    const genderInput = document.getElementById('genderInput');
    const activityInput = document.getElementById('activityInput');
    
    const calcWaterBtn = document.getElementById('calcWaterBtn');
    const editWaterBtn = document.getElementById('editWaterBtn');
    const resetWaterBtn = document.getElementById('resetWaterBtn');
    const addWaterBtns = document.querySelectorAll('.add-water-btn');
    
    const currentWaterDisplay = document.getElementById('currentWater');
    const goalWaterDisplay = document.getElementById('goalWater');
    const waterProgressBar = document.getElementById('waterProgressBar');

    let waterGoal = parseFloat(localStorage.getItem('waterGoal')) || 0;
    let currentWater = parseFloat(localStorage.getItem('currentWater')) || 0;
    let lastWaterDate = localStorage.getItem('lastWaterDate');

    if (lastWaterDate !== today) {
        currentWater = 0;
        localStorage.setItem('currentWater', currentWater);
        localStorage.setItem('lastWaterDate', today);
    }

    function initWaterTracker() {
        if (waterGoal > 0) {
            waterSettings.style.display = 'none';
            waterMain.style.display = 'block';
            updateWaterDisplay();
        } else {
            waterSettings.style.display = 'block';
            waterMain.style.display = 'none';
        }
    }

    function updateWaterDisplay() {
        currentWaterDisplay.textContent = currentWater.toFixed(2);
        goalWaterDisplay.textContent = waterGoal.toFixed(1);
        
        let percentage = (currentWater / waterGoal) * 100;
        if (percentage > 100) percentage = 100;
        
        waterProgressBar.style.width = `${percentage}%`;
        
        if (percentage >= 100) {
            waterProgressBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        } else {
            waterProgressBar.style.background = 'linear-gradient(90deg, #0ea5e9, #38bdf8)';
        }
    }

    calcWaterBtn.addEventListener('click', () => {
        const weight = parseFloat(weightInput.value);
        const activity = activityInput.value;
        
        if (!weight || !activity) {
            showNotification('Please enter weight and activity level.', true);
            return;
        }

        let baseAmountMl = weight * 35; 
        if (activity === 'medium') baseAmountMl += 500;
        if (activity === 'high') baseAmountMl += 1000;

        waterGoal = parseFloat((baseAmountMl / 1000).toFixed(1));
        localStorage.setItem('waterGoal', waterGoal);
        localStorage.setItem('waterSettings', JSON.stringify({
            weight: weightInput.value,
            height: heightInput.value,
            gender: genderInput.value,
            activity: activityInput.value
        }));

        initWaterTracker();
    });

    editWaterBtn.addEventListener('click', () => {
        const savedSettings = JSON.parse(localStorage.getItem('waterSettings'));
        if (savedSettings) {
            weightInput.value = savedSettings.weight;
            heightInput.value = savedSettings.height;
            genderInput.value = savedSettings.gender;
            activityInput.value = savedSettings.activity;
        }
        waterSettings.style.display = 'block';
        waterMain.style.display = 'none';
    });

    addWaterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const amount = parseFloat(e.target.getAttribute('data-amount'));
            currentWater += amount;
            localStorage.setItem('currentWater', currentWater.toFixed(2));
            updateWaterDisplay();
        });
    });

    resetWaterBtn.addEventListener('click', () => {
        currentWater = 0;
        localStorage.setItem('currentWater', 0);
        updateWaterDisplay();
    });

    initWaterTracker();
});