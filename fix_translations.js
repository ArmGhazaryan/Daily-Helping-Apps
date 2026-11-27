const fs = require('fs');
const path = 'js\\mafia-manager.js';
let content = fs.readFileSync(path, 'utf8');

// Edit 10: Sheriff label ՇevesՖ -> Շevesֆ (capital Фё to small ֆ)
// The character U+0536 (Ֆ) -> U+0565 (ֆ)
content = content.replace(/ՇevesՖ/g, 'Շevesֆ');

// Edit 11: Role sub Տիմ -> թім (capital Տ U+0542 -> small թ U+056E)
// Replace 'Սև Տim' with 'Սև թim' and 'Կatholik Տim' with 'Կatholik թim'
content = content.replace(/Սევ Տim/g, 'Սև թim');
content = content.replace(/Կatholik Տim/g, 'Կatholik թim');

fs.writeFileSync(path, content, 'utf8');
console.log('TRANSLATION_FIXES_DONE');
console.log('Sheriff label contains ֆ:', content.includes('Շevesֆ'));
console.log('Role sub contains թ:', content.includes('թim'));