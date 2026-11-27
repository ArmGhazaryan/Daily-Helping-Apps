const fs = require('fs');
const c = fs.readFileSync('js\\mafia-manager.js', 'utf8');
const lines = c.split('\n');
console.log('LINE 57:', lines[56]);
console.log('CODE POINTS:', [...lines[56]].map(ch => ch.codePointAt(0).toString(16)).join(' '));
console.log('---');
console.log('LINE 171:', lines[170]);
console.log('CODE POINTS:', [...lines[170]].map(ch => ch.codePointAt(0).toString(16)).join(' '));