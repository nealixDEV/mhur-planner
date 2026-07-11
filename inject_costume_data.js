// Replace COSTUME_DATA in index.html with new per-slot version
const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf8');
const newCdJs = fs.readFileSync('./new_costume_data.js', 'utf8');

const cdStart = html.indexOf('var COSTUME_DATA = {');
const after = html.slice(cdStart);
const varBase = after.indexOf('\nvar BASE=');

const before = html.slice(0, cdStart);
const rest = html.slice(cdStart + varBase); // includes '\nvar BASE=' onwards

const newHtml = before + newCdJs + rest;
fs.writeFileSync('./index.html', newHtml, 'utf8');
console.log('Replaced COSTUME_DATA in index.html');
console.log('Old block:', varBase, 'bytes');
console.log('New block:', newCdJs.length, 'bytes');
console.log('New file size:', newHtml.length, 'bytes');
console.log('New line count:', newHtml.split('\n').length);
