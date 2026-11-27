$path = "c:\Users\annag\OneDrive\Рабочий стол\Usefull Software Apps\js\mafia-manager.js"
$content = [System.IO.File]::ReadAllText($path)

# Edit 1: checkWin early return
$old1 = "    if (alive === 0) return;`n    stopTimer();"
$new1 = "    if (alive === 0) return;`n    if (maf !== 0 && maf < red) return;`n    stopTimer();"
if ($content.Contains($old1)) { $content = $content.Replace($old1, $new1); "EDIT1 OK" } else { "EDIT1 FAILED" }

# Edit 2: eliminatePlayer renominations
$old2 = "    p.eliminated = true;`n    p.nominated = null;`n    renderModerator();"
$new2 = "    p.eliminated = true;`n    p.nominated = null;`n    renominations();`n    renderModerator();"
if ($content.Contains($old2)) { $content = $content.Replace($old2, $new2); "EDIT2 OK" } else { "EDIT2 FAILED" }

# Edit 3: foulDelta early return
$old3 = "  function foulDelta(id, delta) {`n    const p = players.find(x => x.id === id);`n    if (!p || p.eliminated) return;"
$new3 = "  function foulDelta(id, delta) {`n    const p = players.find(x => x.id === id);`n    if (!p || (p.eliminated && delta !== -1)) return;"
if ($content.Contains($old3)) { $content = $content.Replace($old3, $new3); "EDIT3 OK" } else { "EDIT3 FAILED" }

# Edit 4: Drag object with currentDx
$old4 = "  let drag = { active: false, row: null, startX: 0 };"
$new4 = "  let drag = { active: false, row: null, startX: 0, currentDx: 0 };"
if ($content.Contains($old4)) { $content = $content.Replace($old4, $new4); "EDIT4 OK" } else { "EDIT4 FAILED" }

# Edit 5: Drag move currentDx tracking
$old5 = "    const dx = x - drag.startX;`n    if (dx < 0) drag.row.style.transform = `translateX(${Math.max(dx, -90)}px)`;"
$new5 = "    const dx = x - drag.startX;`n    drag.currentDx = dx;`n    if (dx < 0) drag.row.style.transform = `translateX(${Math.max(dx, -90)}px)`;"
if ($content.Contains($old5)) { $content = $content.Replace($old5, $new5); "EDIT5 OK" } else { "EDIT5 FAILED" }

# Edit 6: Drag end - use currentDx instead of regex
$old6 = "    const computed = row.style.transform;`n    const m = computed.match(/translateX\\((-?\\d+)px\\)/);`n    const dx = m ? parseInt(m[1], 10) : 0;"
$new6 = "    const dx = drag.currentDx;"
if ($content.Contains($old6)) { $content = $content.Replace($old6, $new6); "EDIT6 OK" } else { "EDIT6 FAILED" }

# Edit 7: btnExitMod optional chaining
$old7 = "  btnExitMod.addEventListener('click', exitFullscreen);"
$new7 = "  btnExitMod?.addEventListener('click', exitFullscreen);"
if ($content.Contains($old7)) { $content = $content.Replace($old7, $new7); "EDIT7 OK" } else { "EDIT7 FAILED" }

# Edit 8: btnNewGameMod exitFullscreen
$old8 = "  btnNewGameMod.addEventListener('click', () => { stopTimer(); goToStep(1); });"
$new8 = "  btnNewGameMod.addEventListener('click', () => { exitFullscreen(); });"
if ($content.Contains($old8)) { $content = $content.Replace($old8, $new8); "EDIT8 OK" } else { "EDIT8 FAILED" }

# Edit 9: btnWinNewGame exitFullscreen
$old9 = "  btnWinNewGame.addEventListener('click', () => {`n    winModal.classList.add('hidden');`n    stopTimer();`n    goToStep(1);`n  });"
$new9 = "  btnWinNewGame.addEventListener('click', () => {`n    winModal.classList.add('hidden');`n    exitFullscreen();`n  });"
if ($content.Contains($old9)) { $content = $content.Replace($old9, $new9); "EDIT9 OK" } else { "EDIT9 FAILED" }

# Edit 10: Sheriff label - ՇevesՖ -> Շevesֆ
# Read the exact bytes from the file
$lines = $content.Split("`n")
$sheriffLine = $lines | Where-Object { $_ -match "sheriff.*label" }
if ($sheriffLine) {
    "Sheriff line found: $sheriffLine"
    # Replace the last character of the label (Ֆ -> ֆ)
    $oldLabel = $sheriffLine.Substring($sheriffLine.IndexOf("label: '") + 8, $sheriffLine.IndexOf("',   icon") - ($sheriffLine.IndexOf("label: '") + 8))
    "Old label: [$oldLabel]"
}

[System.IO.File]::WriteAllText($path, $content)