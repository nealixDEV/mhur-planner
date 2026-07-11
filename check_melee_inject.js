const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');
const m = html.match(/var MELEE_DATA=(\{.*?\});/);
if (!m) { console.log('no match'); process.exit(); }
const d = JSON.parse(m[1]);
console.log('keys count:', Object.keys(d).length);
console.log('keys:', Object.keys(d).sort().join(', '));
if (d['izuku_ofa']) {
  console.log('izuku_ofa variants:', d['izuku_ofa'].length);
  d['izuku_ofa'].forEach(v => console.log('  ' + v.name + ': ' + (v.damage?v.damage.gp:'?') + 'GP'));
} else {
  console.log('izuku_ofa NOT FOUND');
}
