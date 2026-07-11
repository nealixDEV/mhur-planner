const fs = require('fs');
const html = fs.readFileSync('tuning_page.html','utf8');

// Parse all unique/special slots.
const results = [];
let pos = 0;
const tag = '<div class="uniqueslotter"';
while(true) {
  const start = html.indexOf(tag, pos);
  if(start === -1) break;
  const next = html.indexOf(tag, start + tag.length);
  const end = next === -1 ? start + 6000 : next;
  const chunk = html.substring(start, end);
  
  const roleMatch = chunk.match(/data-slotrole="([^"]+)"/);
  const classMatch = chunk.match(/data-slotClass="([^"]+)"/);
  const charaMatch = chunk.match(/data-slotchara="([^"]+)"/);
  
  // Extract name and skill from the slot-character-info div
  const infoMatch = chunk.match(/<div class="slot-character-info">([\s\S]*?)<\/div>/);
  let name = '', skillName = '', skillDesc = '';
  if(infoMatch) {
    const info = infoMatch[1];
    const nameM = info.match(/<strong><span[^>]*>([^<]+)<\/span><\/strong>/);
    if(nameM) name = nameM[1].trim();
    const skillM = info.match(/<\/strong><br><span[^>]*>([^<]+)<\/span>/);
    if(skillM) {
      const full = skillM[1];
      const parts = full.split(/\s*[⏵▶→>]\s*/);
      skillName = parts[0].trim();
      skillDesc = parts[1] ? parts[1].trim() : '';
    }
  }
  
  const levelMatches = chunk.match(/Level \d+: [0-9.]+/g) || [];
  const subEffects = chunk.match(/Sub Effect \d+: [0-9.]+/g) || [];
  
  results.push({
    chara: charaMatch ? charaMatch[1] : '?',
    role: roleMatch ? roleMatch[1] : '?',
    class: classMatch ? classMatch[1] : '?',
    name,
    skillName,
    skillDesc,
    levels: levelMatches.slice(0,11),
    subEffects
  });
  
  pos = start + tag.length;
}

console.log('Parsed', results.length, 'special tuning entries');
fs.writeFileSync('special_tuning_parsed.json', JSON.stringify(results, null, 2), 'utf8');
console.log(JSON.stringify(results, null, 2));
