const fs = require('fs');
const h = fs.readFileSync('index.html', 'utf8');
const s = h.match(/<script>([\s\S]*?)<\/script>/);
const c = s[1];
const lines = c.split('\n');
let parens = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '(') parens++;
    if (ch === ')') parens--;
  }
  if (parens < 0) {
    console.log('Negative at line ' + (i + 644) + ': ' + parens + ' ' + line.substring(0, 60));
    break;
  }
}
console.log('Final: ' + parens);
