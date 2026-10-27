// ==========================================
// 🟢 1. SUPABASE AUTH & DATABASE HELPER FUNCTIONS
// ==========================================

// 1. Ստուգում ենք ընթացիկ օգտատիրոջը (առանց forced alert/redirect-ի)
async function getCurrentUser() {
    if (typeof supabaseClient === 'undefined') return null;
    try {
        // Առաջին հերթին ստուգում ենք persisted session-ը (mobile persistence)
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.warn('Session resolution pending:', sessionError.message);
        }
        const session = sessionData?.session;
        if (session && session.user) {
            // Ստուգում ենք token-ի ժամկետը; եթե լրացել է, autoRefreshToken-ը թարմացնում է ֆոնում
            const expiresAt = session.expires_at;
            const now = Math.floor(Date.now() / 1000);
            if (expiresAt && now >= expiresAt) {
                try {
                    const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
                    if (refreshError) {
                        console.warn('Token refresh pending:', refreshError.message);
                    }
                    if (refreshData?.session?.user) {
                        return refreshData.session.user;
                    }
                } catch (refreshErr) {
                    // Ֆոնային թարմացումը չհաջողվեց; guest ռեժիմ
                }
                return null;
            }
            return session.user;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// 2. 🟢 LocalStorage-ի չսինխրոնացված տվյալները ուղարկում ենք Supabase daily_tasks (միայն Logged-in-ի համար)
async function syncLocalTasksToSupabase() {
    const user = await getCurrentUser();
    if (!user) return;

    const localTasks = JSON.parse(localStorage.getItem('workoutTasks')) || [];
    if (localTasks.length === 0) return;

    console.log("Migrating local tasks to Supabase cloud...");

    const tasksToInsert = localTasks.map(task => ({
        user_id: user.id,
        date: task.date,
        task_text: task.text,
        time_text: task.time || '',
        is_completed: !!task.completed
    }));

    const { error } = await supabaseClient
        .from('daily_tasks')
        .insert(tasksToInsert);

    if (!error) {
        console.log("Local tasks successfully synced to account!");
        localStorage.removeItem('workoutTasks');
        if (typeof showNotification === 'function') {
            showNotification("Your local progress was synced to your account!");
        }
    } else {
        console.error("Migration error:", error.message);
    }
}

// 2b. 🟢 LocalStorage-ի չսինխրոնացված routines-ը ուղարկում ենք Supabase routines (միայն Logged-in-ի համար)
async function syncLocalRoutinesToSupabase() {
    const user = await getCurrentUser();
    if (!user) return;

    const localRoutines = JSON.parse(localStorage.getItem('savedRoutines')) || {};
    const names = Object.keys(localRoutines);
    if (names.length === 0) return;

    console.log("Migrating local routines to Supabase cloud...");

    const { data: existing, error: fetchError } = await supabaseClient
        .from('routines')
        .select('id, routine_name')
        .eq('user_id', user.id);

    if (fetchError) {
        console.error("Migration error (fetch routines):", fetchError.message);
        return;
    }

    const existingMap = {};
    (existing || []).forEach(row => {
        existingMap[row.routine_name] = row.id;
    });

    let hasError = false;
    for (const name of names) {
        const tasks = Array.isArray(localRoutines[name]) ? localRoutines[name] : [];
        if (existingMap[name]) {
            const { error } = await supabaseClient
                .from('routines')
                .update({ tasks: tasks })
                .eq('id', existingMap[name])
                .eq('user_id', user.id);
            if (error) {
                console.error("Migration error (update routine):", error.message);
                hasError = true;
            }
        } else {
            const { error } = await supabaseClient
                .from('routines')
                .insert({ user_id: user.id, routine_name: name, tasks: tasks });
            if (error) {
                console.error("Migration error (insert routine):", error.message);
                hasError = true;
            }
        }
    }

    if (!hasError) {
        console.log("Local routines successfully synced to account!");
        localStorage.removeItem('savedRoutines');
        if (typeof showNotification === 'function') {
            showNotification("Your local routines were synced to your account!");
        }
    }
}

// 3. Կարդում ենք օգտատիրոջ daily tasks-ը բազայից (SELECT)
async function loadAllTasks() {
    const user = await getCurrentUser();

    if (user) {
        const { data, error } = await supabaseClient
            .from('daily_tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error loading tasks from Supabase:", error.message);
            return [];
        }

        return (data || []).map(row => ({
            id: row.id,
            text: row.task_text,
            date: row.date,
            time: row.time_text || '',
            completed: !!row.is_completed
        }));
    }

    // Guest mode: LocalStorage
    const localTasks = JSON.parse(localStorage.getItem('workoutTasks')) || [];
    localTasks.forEach(t => {
        if (!t.id) t.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    });
    return localTasks;
}


// ==========================================
// 🟢 2. MAIN APPLICATION LOGIC (DOM & UI)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Top Input elements
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
    window.showNotification = function (message, isError = false) {
        if (!toastElement) return;
        toastElement.textContent = message;
        toastElement.className = `toast show ${isError ? 'error' : 'success'}`;
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastElement.className = 'toast';
        }, 3000);
    };

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    if (dateInput) dateInput.value = today;

    // Tasks are loaded dynamically (Supabase for logged-in users, LocalStorage for guests)
    let tasks = [];
    let waterHistory = JSON.parse(localStorage.getItem('waterHistory')) || {};

    // Helper: format date for display
    function formatDate(dateString) {
        if (!dateString) return '';
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // Function to render ONLY tasks for the selected date
    function renderTasks() {
        if (!taskList || !dateInput) return;
        taskList.innerHTML = '';
        const selectedDate = dateInput.value;

        if (displayDateLabel) displayDateLabel.textContent = `( ${formatDate(selectedDate)} )`;
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

        calculateProductivityStats(selectedDate);
    }

    if (dateInput) dateInput.addEventListener('change', renderTasks);

    // Add new task & sync with Supabase daily_tasks (or LocalStorage for guests)
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const text = taskInput.value.trim();
            const date = dateInput.value;
            const time = timeInput.value;

            if (text === '') {
                showNotification('Please enter a goal or meal.', true);
                return;
            }

            const user = await getCurrentUser();

            if (user) {
                const { data, error } = await supabaseClient
                    .from('daily_tasks')
                    .insert([{
                        user_id: user.id,
                        date: date,
                        task_text: text,
                        time_text: time || '',
                        is_completed: false
                    }])
                    .select();

                if (error) {
                    console.error("Error adding task to Supabase:", error.message);
                    showNotification('Failed to add goal.', true);
                    return;
                }

                const row = (data && data[0]) ? data[0] : null;
                tasks.push({
                    id: row ? row.id : (Date.now().toString(36) + Math.random().toString(36).substr(2)),
                    text: text, date: date, time: time, completed: false
                });
            } else {
                tasks.push({
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    text: text, date: date, time: time, completed: false
                });
                localStorage.setItem('workoutTasks', JSON.stringify(tasks));
            }

            renderTasks();
            taskInput.value = '';
        });
    }

    window.toggleTask = async function (id) {
        const task = tasks.find(t => String(t.id) === String(id));
        if (!task) return;

        const newCompleted = !task.completed;
        const user = await getCurrentUser();

        if (user) {
            const { error } = await supabaseClient
                .from('daily_tasks')
                .update({ is_completed: newCompleted })
                .eq('id', task.id)
                .eq('user_id', user.id);

            if (error) {
                console.error("Error updating task in Supabase:", error.message);
                showNotification('Failed to update task.', true);
                return;
            }
        }

        task.completed = newCompleted;
        if (!user) localStorage.setItem('workoutTasks', JSON.stringify(tasks));
        renderTasks();
    };

    window.deleteTask = async function (id) {
        const user = await getCurrentUser();

        if (user) {
            const { error } = await supabaseClient
                .from('daily_tasks')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                console.error("Error deleting task from Supabase:", error.message);
                showNotification('Failed to delete task.', true);
                return;
            }
        }

        tasks = tasks.filter(t => String(t.id) !== String(id));
        if (!user) localStorage.setItem('workoutTasks', JSON.stringify(tasks));
        renderTasks();
    };

    async function saveAndRender() {
        const user = await getCurrentUser();
        if (!user) localStorage.setItem('workoutTasks', JSON.stringify(tasks));
        renderTasks();
    }


    // ==========================================
    // --- ADVANCED ROUTINE MANAGER LOGIC ---
    // ==========================================
    let savedRoutines = {};
    let routineIds = {};
    const routineSelect = document.getElementById('routineSelect');
    const routineNameInput = document.getElementById('routineNameInput');

    async function updateRoutineSelect() {
        if (!routineSelect) return;
        const user = await getCurrentUser();
        if (user) {
            const { data, error } = await supabaseClient
                .from('routines')
                .select('*')
                .eq('user_id', user.id);
            if (error) {
                console.error("Error loading routines from Supabase:", error.message);
                savedRoutines = {};
                routineIds = {};
            } else {
                savedRoutines = {};
                routineIds = {};
                (data || []).forEach(row => {
                    savedRoutines[row.routine_name] = Array.isArray(row.tasks) ? row.tasks : [];
                    routineIds[row.routine_name] = row.id;
                });
            }
        } else {
            savedRoutines = JSON.parse(localStorage.getItem('savedRoutines')) || {};
            routineIds = {};
        }
        routineSelect.innerHTML = '<option value="" disabled selected>Select a routine...</option>';
        for (let name in savedRoutines) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            routineSelect.appendChild(opt);
        }
    }

    // Backwards-compatible alias
    const loadRoutines = () => updateRoutineSelect();

    document.getElementById('saveRoutineBtn')?.addEventListener('click', async () => {
        const name = routineNameInput.value.trim();
        if (!name) return showNotification('Please enter a new name for your routine.', true);

        const selectedDate = dateInput.value;
        const dailyTasks = tasks.filter(t => t.date === selectedDate);
        if (dailyTasks.length === 0) return showNotification('No tasks found to save!', true);

        const taskList = dailyTasks.map(t => ({ text: t.text, time: t.time }));

        const user = await getCurrentUser();
        if (user) {
            const existingId = routineIds[name];
            if (existingId) {
                const { error } = await supabaseClient
                    .from('routines')
                    .update({ tasks: taskList })
                    .eq('id', existingId)
                    .eq('user_id', user.id);
                if (error) {
                    console.error("Error updating routine in Supabase:", error.message);
                    showNotification('Failed to save routine.', true);
                    return;
                }
            } else {
                const { data, error } = await supabaseClient
                    .from('routines')
                    .insert({ user_id: user.id, routine_name: name, tasks: taskList })
                    .select();
                if (error) {
                    console.error("Error saving routine to Supabase:", error.message);
                    showNotification('Failed to save routine.', true);
                    return;
                }
                if (data && data[0]) routineIds[name] = data[0].id;
            }
        } else {
            savedRoutines[name] = taskList;
            localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
        }

        await updateRoutineSelect();
        routineNameInput.value = '';
        showNotification(`Routine "${name}" saved!`);
    });

    document.getElementById('loadRoutineBtn')?.addEventListener('click', async () => {
        const name = routineSelect.value;
        if (!name) return showNotification('Please select a routine to paste.', true);

        if (!savedRoutines[name] || !Array.isArray(savedRoutines[name])) {
            await updateRoutineSelect();
        }
        const routineTasks = savedRoutines[name];
        if (!routineTasks || !Array.isArray(routineTasks)) {
            return showNotification('Routine not found.', true);
        }
        const selectedDate = dateInput.value;

        if (tasks.filter(t => t.date === selectedDate).length > 0) {
            if (!confirm(`Clear current tasks for ${formatDate(selectedDate)} and paste "${name}"?`)) return;
        }

        const user = await getCurrentUser();

        if (user) {
            const { error: delError } = await supabaseClient
                .from('daily_tasks')
                .delete()
                .eq('user_id', user.id)
                .eq('date', selectedDate);
            if (delError) {
                console.error("Error clearing tasks in Supabase:", delError.message);
                showNotification('Failed to paste routine.', true);
                return;
            }
        }

        tasks = tasks.filter(t => t.date !== selectedDate);

        const newTasks = routineTasks.map(item => ({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            text: item.text, date: selectedDate, time: item.time, completed: false
        }));

        if (user) {
            const rows = newTasks.map(t => ({
                user_id: user.id,
                date: selectedDate,
                task_text: t.text,
                time_text: t.time || '',
                is_completed: false
            }));
            const { data, error } = await supabaseClient
                .from('daily_tasks')
                .insert(rows)
                .select();
            if (error) {
                console.error("Error pasting routine to Supabase:", error.message);
                showNotification('Failed to paste routine.', true);
                return;
            }
            (data || []).forEach((row, idx) => {
                if (newTasks[idx]) newTasks[idx].id = row.id;
            });
        }

        tasks.push(...newTasks);
        if (!user) localStorage.setItem('workoutTasks', JSON.stringify(tasks));
        renderTasks();
        showNotification(`Pasted "${name}".`);
    });

    document.getElementById('updateRoutineBtn')?.addEventListener('click', async () => {
        const name = routineSelect.value;
        if (!name) return showNotification('Select a routine to update.', true);

        const dailyTasks = tasks.filter(t => t.date === dateInput.value);
        if (dailyTasks.length === 0) return showNotification('No tasks to update!', true);

        const taskList = dailyTasks.map(t => ({ text: t.text, time: t.time }));

        const user = await getCurrentUser();
        if (user) {
            const existingId = routineIds[name];
            if (existingId) {
                const { error } = await supabaseClient
                    .from('routines')
                    .update({ tasks: taskList })
                    .eq('id', existingId)
                    .eq('user_id', user.id);
                if (error) {
                    console.error("Error updating routine in Supabase:", error.message);
                    showNotification('Failed to update routine.', true);
                    return;
                }
            } else {
                const { data, error } = await supabaseClient
                    .from('routines')
                    .insert({ user_id: user.id, routine_name: name, tasks: taskList })
                    .select();
                if (error) {
                    console.error("Error updating routine in Supabase:", error.message);
                    showNotification('Failed to update routine.', true);
                    return;
                }
                if (data && data[0]) routineIds[name] = data[0].id;
            }
        } else {
            savedRoutines[name] = taskList;
            localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
        }

        await updateRoutineSelect();
        showNotification(`Routine "${name}" updated!`);
    });

    document.getElementById('deleteRoutineBtn')?.addEventListener('click', async () => {
        const name = routineSelect.value;
        if (!name) return;
        if (!confirm(`Delete routine "${name}" forever?`)) return;

        const user = await getCurrentUser();
        if (user) {
            const existingId = routineIds[name];
            if (existingId) {
                const { error } = await supabaseClient
                    .from('routines')
                    .delete()
                    .eq('id', existingId)
                    .eq('user_id', user.id);
                if (error) {
                    console.error("Error deleting routine from Supabase:", error.message);
                    showNotification('Failed to delete routine.', true);
                    return;
                }
            } else {
                const { error } = await supabaseClient
                    .from('routines')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('routine_name', name);
                if (error) {
                    console.error("Error deleting routine from Supabase:", error.message);
                    showNotification('Failed to delete routine.', true);
                    return;
                }
            }
            delete routineIds[name];
        } else {
            delete savedRoutines[name];
            localStorage.setItem('savedRoutines', JSON.stringify(savedRoutines));
        }

        await updateRoutineSelect();
        showNotification(`Routine deleted.`);
    });

    document.getElementById('clearTasksBtn')?.addEventListener('click', async () => {
        const selectedDate = dateInput.value;
        if (tasks.filter(t => t.date === selectedDate).length === 0) return;
        if (confirm(`Clear ALL tasks for ${formatDate(selectedDate)}?`)) {
            const user = await getCurrentUser();
            if (user) {
                const { error } = await supabaseClient
                    .from('daily_tasks')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('date', selectedDate);
                if (error) {
                    console.error("Error clearing tasks in Supabase:", error.message);
                    showNotification('Failed to clear tasks.', true);
                    return;
                }
            }
            tasks = tasks.filter(t => t.date !== selectedDate);
            if (!user) localStorage.setItem('workoutTasks', JSON.stringify(tasks));
            renderTasks();
            showNotification('Tasks cleared.');
        }
    });


    // ==========================================
    // --- WATER TRACKER LOGIC ---
    // ==========================================
    const waterSettings = document.getElementById('waterSettings');
    const waterMain = document.getElementById('waterMain');
    const calcWaterBtn = document.getElementById('calcWaterBtn');

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
        if (!waterCollapsed || !waterExpandedContent) return;
        if (isWaterCollapsed) {
            waterCollapsed.style.display = 'block';
            waterExpandedContent.style.display = 'none';
        } else {
            waterCollapsed.style.display = 'none';
            waterExpandedContent.style.display = 'block';
        }

        if (collapsedWaterText) {
            if (waterGoal > 0) {
                const percent = Math.min(Math.round((currentWater / waterGoal) * 100), 100);
                collapsedWaterText.textContent = `Water: ${currentWater.toFixed(1)}L (${percent}%)`;
            } else {
                collapsedWaterText.textContent = `Water Tracker`;
            }
        }
    }

    collapseWaterBtn?.addEventListener('click', () => {
        isWaterCollapsed = true;
        localStorage.setItem('isWaterCollapsed', 'true');
        updateCollapseUI();
    });

    expandWaterBtn?.addEventListener('click', () => {
        isWaterCollapsed = false;
        localStorage.setItem('isWaterCollapsed', 'false');
        updateCollapseUI();
    });

    function initWaterTracker() {
        if (!waterSettings || !waterMain) return;
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
        const curEl = document.getElementById('currentWater');
        const goalEl = document.getElementById('goalWater');
        if (curEl) curEl.textContent = currentWater.toFixed(2);
        if (goalEl) goalEl.textContent = waterGoal.toFixed(1);

        let percentage = waterGoal > 0 ? (currentWater / waterGoal) * 100 : 0;
        if (percentage > 100) percentage = 100;

        const bar = document.getElementById('waterProgressBar');
        if (bar) {
            bar.style.width = `${percentage}%`;
            bar.style.background = percentage >= 100
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #0ea5e9, #38bdf8)';
        }

        waterHistory[today] = { goal: waterGoal, current: currentWater };
        localStorage.setItem('waterHistory', JSON.stringify(waterHistory));

        if (dateInput) calculateProductivityStats(dateInput.value);
        updateCollapseUI();
    }

    calcWaterBtn?.addEventListener('click', () => {
        const weight = parseFloat(document.getElementById('weightInput')?.value);
        const activity = document.getElementById('activityInput')?.value;
        if (!weight || !activity) return showNotification('Please enter weight and activity.', true);

        let baseMl = weight * 35;
        if (activity === 'medium') baseMl += 500;
        if (activity === 'high') baseMl += 1000;

        waterGoal = parseFloat((baseMl / 1000).toFixed(1));
        localStorage.setItem('waterGoal', waterGoal);
        localStorage.setItem('waterSettings', JSON.stringify({
            weight: weight, height: document.getElementById('heightInput')?.value,
            gender: document.getElementById('genderInput')?.value, activity: activity
        }));

        initWaterTracker();
    });

    document.getElementById('editWaterBtn')?.addEventListener('click', () => {
        const s = JSON.parse(localStorage.getItem('waterSettings'));
        if (s && waterSettings && waterMain) {
            document.getElementById('weightInput').value = s.weight || '';
            document.getElementById('heightInput').value = s.height || '';
            document.getElementById('genderInput').value = s.gender || '';
            document.getElementById('activityInput').value = s.activity || '';
            waterSettings.style.display = 'block';
            waterMain.style.display = 'none';
        }
    });

    document.querySelectorAll('.add-water-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentWater += parseFloat(e.target.getAttribute('data-amount'));
            localStorage.setItem('currentWater', currentWater.toFixed(2));
            updateWaterDisplay();
        });
    });

    document.getElementById('resetWaterBtn')?.addEventListener('click', () => {
        currentWater = 0;
        localStorage.setItem('currentWater', 0);
        updateWaterDisplay();
    });

    // ==========================================
    function calculateProductivityStats(selectedDateStr) {
        if (!selectedDateStr) return;
        const selectedDate = new Date(selectedDateStr);
        const selectedMonthPrefix = selectedDateStr.substring(0, 7);

        let dTotal = 0, dComp = 0;
        let wTotal = 0, wComp = 0;
        let mTotal = 0, mComp = 0;

        tasks.forEach(t => {
            const taskDate = new Date(t.date);
            const isCompleted = t.completed ? 1 : 0;

            if (t.date === selectedDateStr) { dTotal++; dComp += isCompleted; }
            if (t.date.startsWith(selectedMonthPrefix)) { mTotal++; mComp += isCompleted; }

            const diffDays = Math.ceil((taskDate - selectedDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0 && diffDays >= -6) { wTotal++; wComp += isCompleted; }
        });

        for (const [wDate, wData] of Object.entries(waterHistory)) {
            if (wData.goal <= 0) continue;

            const waterProgress = Math.min(wData.current / wData.goal, 1);
            const taskDate = new Date(wDate);

            if (wDate === selectedDateStr) { dTotal++; dComp += waterProgress; }
            if (wDate.startsWith(selectedMonthPrefix)) { mTotal++; mComp += waterProgress; }

            const diffDays = Math.ceil((taskDate - selectedDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0 && diffDays >= -6) { wTotal++; wComp += waterProgress; }
        }

        if (topProgressPercent && topProgressBarFill && topProgressTitle) {
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
        }

        function updateStatUI(elValue, elCount, comp, total) {
            if (!elValue || !elCount) return;
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

    if (historyDateInput) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        historyDateInput.value = yesterday.toISOString().split('T')[0];
    }

    checkHistoryBtn?.addEventListener('click', () => {
        const dateStr = historyDateInput.value;
        if (!dateStr || !historyResult) return;

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

    exportBtn?.addEventListener('click', () => {
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

    importBtn?.addEventListener('click', () => {
        if (importFile) importFile.click();
    });

    importFile?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
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

    // Initial renders & automatic sync
    async function initApp() {
        const user = await getCurrentUser();
        if (user) {
            await syncLocalTasksToSupabase();
            await syncLocalRoutinesToSupabase();
        }
        tasks = await loadAllTasks();
        renderTasks();
        initWaterTracker();
        await updateRoutineSelect();
    }

    initApp();
});