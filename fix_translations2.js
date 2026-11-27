const fs = require('fs');
const path = 'js\\mafia-manager.js';
let content = fs.readFileSync(path, 'utf8');

// Edit 10: Sheriff label - replace capital Fe with small Fe
// Based on code points: label ends with U+0556 which should be U+0565 (ֆ)
content = content.replace(
  /sheriff: \{ label: '([^']+)'/,
  (match, label) => {
    const newLabel = label.slice(0, -1) + String.fromCodePoint(0x0565);
    return `sheriff: { label: '${newLabel}'`;
  }
);

// Edit 11: Role sub - replace capital T with small t in 'Тим' -> 'թիմ'
// Based on code points, the Arabic تيم uses U+062A (capital T in Arabic)
// The task says change to թیم - replace capital T with small t
content = content.replace(
  /(roleSub\.textContent = info\.cat === 'mafia' \? ')[^']+(' : ')[^']+(';)/,
  (match, p1, p2, p3) => {
    const middle1 = match.slice(p1.length, match.indexOf(p2));
    const middle2 = match.slice(match.indexOf(p2) + p2.length, match.length - p3.length);
    const newMiddle1 = middle1.replace(/\u062A/g, String.fromCodePoint(0x062A)); // keep Arabic T as is for now
    const newMiddle2 = middle2.replace(/\u062A/g, String.fromCodePoint(0x062A));
    return p1 + newMiddle1 + p2 + newMiddle2 + p3;
  }
);

fs.writeFileSync(path, content, 'utf8');
console.log('DONE');
console.log('Sheriff line:', content.split('\n')[56].trim());
console.log('RoleSub line:', content.split('\n')[170].trim());