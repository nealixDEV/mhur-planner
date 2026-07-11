const fs = require('fs');
const html = fs.readFileSync('tuning_page.html','utf8');

// Extract all normalslots divs
const normalSlotRe = /<div class="normalslots"([^>]*)>([\s\S]*?)(?=<div class="normalslots"|<div class="specialslots"|<h2|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<br)/g;

// Actually let's find all normalslots blocks
const starts = [];
let idx = 0;
while((idx = html.indexOf('<div class="normalslots"', idx)) !== -1) {
  starts.push(idx);
  idx++;
}
console.log('Found', starts.length, 'normalslots divs');

// For each, extract data attributes and skill info
const results = [];
for(let i = 0; i < starts.length; i++) {
  const start = starts[i];
  const end = i+1 < starts.length ? starts[i+1] : start + 5000;
  const chunk = html.substring(start, end);
  
  // Extract data attributes
  const roleMatch = chunk.match(/data-slotrole="([^"]+)"/);
  const classMatch = chunk.match(/data-slotClass="([^"]+)"/);
  const charaMatch = chunk.match(/data-slotchara="([^"]+)"/);
  
  // Extract character name
  const nameMatch = chunk.match(/<strong><span[^>]*>([^<]+)<\/span>/);
  
  // Extract skill info from slot-skill-info divs
  const skillDivs = [];
  let si = 0;
  const skillRe = /<div class="slot-skill-info">([\s\S]*?)(?=<div class="slot-skill-info">|<\/a>)/g;
  let sm;
  while((sm = skillRe.exec(chunk)) !== null) {
    const text = sm[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    skillDivs.push(text);
  }
  
  results.push({
    chara: charaMatch ? charaMatch[1] : '?',
    role: roleMatch ? roleMatch[1] : '?',
    class: classMatch ? classMatch[1] : '?',
    name: nameMatch ? nameMatch[1] : '?',
    skills: skillDivs
  });
}

// Save to JSON
fs.writeFileSync('normal_tuning_data.json', JSON.stringify(results, null, 2), 'utf8');
console.log('Saved normal_tuning_data.json');
console.log('Sample:');
console.log(JSON.stringify(results.slice(0,5), null, 2));
