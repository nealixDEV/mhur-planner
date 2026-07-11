const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('ud_izuku.json','utf8'));
// SvelteKit data shape: {type:'data', nodes:[null, {...data...}, ...]}
function shape(obj, depth, maxDepth) {
  if (depth > maxDepth) return '…';
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return 'Array(' + obj.length + ')[' + shape(obj[0], depth+1, maxDepth) + ']';
  }
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    const out = {};
    for (const k of keys.slice(0, 40)) out[k] = shape(obj[k], depth+1, maxDepth);
    return out;
  }
  const s = String(obj);
  return s.length > 60 ? s.slice(0,60)+'…' : s;
}
// find the data node (the one with type=data and a data object)
function findData(n){
  if (n && typeof n === 'object' && n.type === 'data' && n.data) return n.data;
  if (Array.isArray(n)) { for (const c of n) { const r = findData(c); if (r) return r; } }
  return null;
}
const data = findData(raw.nodes);
console.log('TOP-LEVEL KEYS:', Object.keys(data));
console.log('SHAPE (depth 3):');
console.log(JSON.stringify(shape(data, 0, 3), null, 2));
