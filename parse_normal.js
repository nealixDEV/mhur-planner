const fs = require('fs');
const html = fs.readFileSync('tuning_page.html','utf8');

// Parse all normalslots
const normalResults = [];
let pos = 0;
const tag = '<div class="normalslots"';
while(true) {
  const start = html.indexOf(tag, pos);
  if(start === -1) break;
  const next = html.indexOf(tag, start + tag.length);
  const end = next === -1 ? start + 5000 : next;
  const chunk = html.substring(start, end);
  
  const roleMatch = chunk.match(/data-slotrole="([^"]+)"/);
  const classMatch = chunk.match(/data-slotClass="([^"]+)"/);
  const charaMatch = chunk.match(/data-slotchara="([^"]+)"/);
  
  // Extract name and skill from the slot-character-info div
  const infoMatch = chunk.match(/<div class="slot-character-info">([\s\S]*?)<\/div>/);
  let name = '', skillName = '', skillDesc = '';
  const subEffects = [];
  if(infoMatch) {
    const info = infoMatch[1];
    const nameM = info.match(/<strong><span[^>]*>([^<]+)<\/span><\/strong>/);
    if(nameM) name = nameM[1].trim();
    
    // Extract all skill lines (main + sub effects)
    const skillLines = info.match(/<span[^>]*>[^<]+<\/span>/g) || [];
    for(let i = 0; i < skillLines.length; i++) {
      const line = skillLines[i].replace(/<[^>]+>/g, '').trim();
      if(line && !line.includes('⏵')) continue; // Skip empty or non-skill lines
      
      const parts = line.split(/\s*[⏵▶→>]\s*/);
      const sName = parts[0].trim();
      const sDesc = parts[1] ? parts[1].trim() : '';
      
      if(i === 0) {
        skillName = sName;
        skillDesc = sDesc;
      } else {
        subEffects.push({skillName: sName, skillDesc: sDesc});
      }
    }
  }
  
  // Get levels for main effect
  const levelMatches = chunk.match(/Level \d+: [0-9.]+/g) || [];
  
  // Try to extract sub-effect levels if they exist
  const subLevels = [];
  const subLevelSections = chunk.match(/<div class="sub-effect-levels">([\s\S]*?)<\/div>/g) || [];
  subLevelSections.forEach(section => {
    const levels = section.match(/Level \d+: [0-9.]+/g) || [];
    if(levels.length > 0) subLevels.push(levels.slice(0,4));
  });
  
  normalResults.push({
    chara: charaMatch ? charaMatch[1] : '?',
    role: roleMatch ? roleMatch[1] : '?',
    class: classMatch ? classMatch[1] : '?',
    name,
    skillName,
    skillDesc,
    levels: levelMatches.slice(0,4),
    subEffects: subEffects.map((se, i) => ({
      ...se,
      levels: subLevels[i] || levelMatches.slice(0,4)
    }))
  });
  
  pos = start + tag.length;
}

console.log('Parsed', normalResults.length, 'normal tuning entries');
fs.writeFileSync('normal_tuning_parsed.json', JSON.stringify(normalResults, null, 2), 'utf8');
console.log(JSON.stringify(normalResults, null, 2));
