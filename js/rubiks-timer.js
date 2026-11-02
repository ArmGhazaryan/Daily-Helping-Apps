(function (global) {
  "use strict";

  // ---------- Scramble Generator ----------
  const FACES = ["R", "L", "U", "D", "F", "B"];
  const MODS = ["", "'", "2"];
  function generateScramble(moves) {
    moves = moves || 20;
    const seq = [];
    let lastFace = null;
    while (seq.length < moves) {
      const face = FACES[Math.floor(Math.random() * FACES.length)];
      if (face === lastFace) continue;
      // avoid redundant same-axis immediate repeats (e.g., R then L is okay, but R then R is blocked above)
      const mod = MODS[Math.floor(Math.random() * MODS.length)];
      seq.push(face + mod);
      lastFace = face;
    }
    return seq.join(" ");
  }

  // ---------- Time Formatting ----------
  function formatTime(ms) {
    if (ms === null || ms === undefined) return "-";
    if (!Number.isFinite(ms)) return "DNF";
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds - minutes * 60;
    const secStr = seconds.toFixed(3).padStart(6, "0");
    if (minutes > 0) return minutes + ":" + secStr;
    return secStr;
  }

  function penaltyTime(solve) {
    if (!solve) return Infinity;
    if (solve.penalty === "DNF") return Infinity;
    let t = Number(solve.time_ms);
    if (solve.penalty === "+2") t += 2000;
    return t;
  }

  function calculatePB(solves) {
    const times = (solves || []).map(penaltyTime).filter(Number.isFinite);
    return times.length ? Math.min(...times) : null;
  }

  function calculateAo(solves, n) {
    const list = (solves || []).slice();
    if (list.length < n) return null;
    const last = list.slice(list.length - n);
    const times = last.map(penaltyTime);
    const sorted = times.slice().sort((a, b) => a - b);
    // trim best and worst
    sorted.shift();
    sorted.pop();
    if (sorted.some(t => !Number.isFinite(t))) return "DNF";
    const sum = sorted.reduce((a, b) => a + b, 0);
    return sum / sorted.length;
  }

  // ---------- Persistence Helpers ----------
  function getClient() {
    if (typeof supabaseClient !== "undefined") return supabaseClient;
    if (global && global.supabaseClient) return global.supabaseClient;
    return null;
  }

  async function getCurrentUser() {
    const client = getClient();
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      return data?.session?.user || null;
    } catch (e) {
      return null;
    }
  }

  const STORAGE_KEY = "dha_rubiks_solves";

  async function loadSolves() {
    const user = await getCurrentUser();
    if (user) {
      const client = getClient();
      try {
        const { data, error } = await client.from("solves").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
        if (error) throw error;
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  async function saveSolve(solve) {
    const user = await getCurrentUser();
    if (user) {
      const client = getClient();
      try {
        const { data, error } = await client.from("solves").insert([{
          user_id: user.id,
          time_ms: solve.time_ms,
          scramble: solve.scramble,
          penalty: solve.penalty || "none"
        }]).select();
        if (error) throw error;
        if (Array.isArray(data) && data[0]) solve.id = data[0].id;
      } catch (e) {
        console.error("Save solve failed:", e);
      }
    } else {
      solve.id = solve.id || Date.now() + Math.random();
      try {
        const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        arr.push(solve);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      } catch (e) {}
    }
    return solve;
  }

  async function deleteSolve(id) {
    const user = await getCurrentUser();
    if (user) {
      const client = getClient();
      try {
        await client.from("solves").delete().eq("id", id);
      } catch (e) {
        console.error("Delete solve failed:", e);
      }
    } else {
      try {
        const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const filtered = arr.filter(s => String(s.id) !== String(id));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {}
    }
  }

  // ---------- UI Binding (browser only) ----------
  function initUI() {
    if (typeof document === "undefined") return;
    const timerArea = document.getElementById("timerArea");
    const timerDisplay = document.getElementById("timerDisplay");
    const scrambleEl = document.getElementById("scramble");
    const newScrambleBtn = document.getElementById("newScrambleBtn");
    const inspectionToggle = document.getElementById("inspectionToggle");
    const inspectionDisplay = document.getElementById("inspectionDisplay");
    const pbEl = document.getElementById("pb");
    const ao5El = document.getElementById("ao5");
    const ao12El = document.getElementById("ao12");
    const historyList = document.getElementById("historyList");
    const toggleHistory = document.getElementById("toggleHistory");

    let solves = [];
    let currentScramble = generateScramble();
    let timerState = "idle"; // idle, holding, ready, running
    let startTime = 0;
    let rafId = null;
    let holdTimeout = null;
    let spaceDown = false;
    let lastTouch = 0;
    let inspectionEnabled = false;
    let inspectionTimer = null;
    let inspectionRemaining = 15;

    function setScrambleText() {
      if (scrambleEl) scrambleEl.textContent = currentScramble;
    }
    setScrambleText();

    function updateStats() {
      if (pbEl) pbEl.textContent = formatTime(calculatePB(solves));
      if (ao5El) ao5El.textContent = formatTime(calculateAo(solves, 5));
      if (ao12El) ao12El.textContent = formatTime(calculateAo(solves, 12));
    }

    function renderHistory() {
      if (!historyList) return;
      historyList.innerHTML = "";
      solves.slice().reverse().forEach(solve => {
        const row = document.createElement("div");
        row.className = "solve-row";
        const timeSpan = document.createElement("span");
        timeSpan.textContent = formatTime(penaltyTime(solve)) + "  " + (solve.scramble || "");
        row.appendChild(timeSpan);

        const plus2Btn = document.createElement("button");
        plus2Btn.textContent = solve.penalty === "+2" ? "+2 ✓" : "+2";
        plus2Btn.addEventListener("click", async () => {
          solve.penalty = solve.penalty === "+2" ? "none" : "+2";
          await saveSolveUpdate(solve);
          renderHistory();
          updateStats();
        });
        row.appendChild(plus2Btn);

        const dnfBtn = document.createElement("button");
        dnfBtn.textContent = solve.penalty === "DNF" ? "DNF ✓" : "DNF";
        dnfBtn.addEventListener("click", async () => {
          solve.penalty = solve.penalty === "DNF" ? "none" : "DNF";
          await saveSolveUpdate(solve);
          renderHistory();
          updateStats();
        });
        row.appendChild(dnfBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑️";
        delBtn.addEventListener("click", async () => {
          await deleteSolve(solve.id);
          solves = solves.filter(s => String(s.id) !== String(solve.id));
          renderHistory();
          updateStats();
        });
        row.appendChild(delBtn);

        historyList.appendChild(row);
      });
    }

    async function saveSolveUpdate(solve) {
      const user = await getCurrentUser();
      if (user) {
        const client = getClient();
        try {
          await client.from("solves").update({ penalty: solve.penalty }).eq("id", solve.id);
        } catch (e) {}
      } else {
        try {
          const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          const idx = arr.findIndex(s => String(s.id) === String(solve.id));
          if (idx !== -1) { arr[idx].penalty = solve.penalty; localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
        } catch (e) {}
      }
    }

    // load solves
    (async () => {
      solves = await loadSolves();
      updateStats();
      renderHistory();
    })();

    function updateTimerDisplay() {
      if (timerState === "running") {
        const now = performance.now();
        const elapsed = now - startTime;
        if (timerDisplay) timerDisplay.textContent = formatTime(elapsed);
        rafId = requestAnimationFrame(updateTimerDisplay);
      }
    }

    function startHold() {
      if (timerState === "running") return;
      timerState = "holding";
      if (timerDisplay) { timerDisplay.style.color = "#f59e0b"; }
      holdTimeout = setTimeout(() => {
        timerState = "ready";
        if (timerDisplay) { timerDisplay.style.color = "#22c55e"; }
      }, 300);
    }

    function releaseHold() {
      if (timerState === "holding") {
        clearTimeout(holdTimeout);
        timerState = "idle";
        if (timerDisplay) { timerDisplay.style.color = ""; }
        return;
      }
      if (timerState === "ready") {
        timerState = "running";
        startTime = performance.now();
        if (timerDisplay) { timerDisplay.style.color = ""; }
        rafId = requestAnimationFrame(updateTimerDisplay);
      }
    }

    function stopTimer() {
      if (timerState !== "running") return;
      if (rafId) cancelAnimationFrame(rafId);
      const elapsed = performance.now() - startTime;
      timerState = "stopped";
      if (timerDisplay) timerDisplay.textContent = formatTime(elapsed);
      // save solve
      const solve = { time_ms: Math.round(elapsed), scramble: currentScramble, penalty: "none" };
      (async () => {
        const saved = await saveSolve(solve);
        solves.push(saved);
        updateStats();
        renderHistory();
      })();
      // new scramble
      currentScramble = generateScramble();
      setScrambleText();
      // reset state after short delay
      setTimeout(() => { timerState = "idle"; }, 500);
    }

    function handlePressStart() {
      if (timerState === "running") { stopTimer(); return; }
      startHold();
    }
    function handlePressEnd() { releaseHold(); }

    if (timerArea) {
      timerArea.addEventListener("touchstart", (e) => { e.preventDefault(); lastTouch = Date.now(); handlePressStart(); }, { passive: false });
      timerArea.addEventListener("touchend", (e) => { e.preventDefault(); handlePressEnd(); }, { passive: false });
      timerArea.addEventListener("mousedown", (e) => { if (Date.now() - lastTouch < 500) return; e.preventDefault(); handlePressStart(); });
      timerArea.addEventListener("mouseup", (e) => { if (Date.now() - lastTouch < 500) return; e.preventDefault(); handlePressEnd(); });
    }

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!spaceDown) { spaceDown = true; handlePressStart(); }
      }
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        spaceDown = false;
        handlePressEnd();
      }
    });

    if (newScrambleBtn) {
      newScrambleBtn.addEventListener("click", () => {
        currentScramble = generateScramble();
        setScrambleText();
      });
    }

    if (inspectionToggle) {
      inspectionToggle.addEventListener("change", () => {
        inspectionEnabled = inspectionToggle.checked;
        if (inspectionDisplay) {
          inspectionDisplay.textContent = inspectionEnabled ? "Inspection: 15s" : "";
        }
      });
    }

    if (toggleHistory && historyList) {
      toggleHistory.addEventListener("click", () => {
        historyList.classList.toggle("collapsed");
      });
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initUI);
    } else {
      initUI();
    }
  }

  // Exports
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      generateScramble: generateScramble,
      formatTime: formatTime,
      calculatePB: calculatePB,
      calculateAo: calculateAo,
      penaltyTime: penaltyTime
    };
  } else {
    global.generateScramble = generateScramble;
    global.formatTime = formatTime;
    global.calculatePB = calculatePB;
    global.calculateAo = calculateAo;
    global.penaltyTime = penaltyTime;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
