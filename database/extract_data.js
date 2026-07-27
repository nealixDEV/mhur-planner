// Extract all game data into structured JSON for the AI assistant
var fs = require('fs');
var html = fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html', 'utf8');
var path = 'C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\database\\';

function extractVar(name) {
  var re = new RegExp('var\\s+' + name + '\\s*=\\s*(\\[[\\s\\S]*?\\]);', 'm');
  var m = html.match(re);
  if (m) {
    try { return JSON.parse(m[1]); } catch (e) { console.log('Parse failed for', name); return null; }
  }
  // Try object pattern
  var re2 = new RegExp('var\\s+' + name + '\\s*=\\s*(\\{[\\s\\S]*?\\});', 'm');
  var m2 = html.match(re2);
  if (m2) {
    try { return JSON.parse(m2[1]); } catch (e) { console.log('Parse failed for', name); return null; }
  }
  console.log('Not found:', name);
  return null;
}

// 1. Characters
var charStats = JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\char_stats.json', 'utf8'));
var characters = {};
Object.keys(charStats).forEach(function(id) {
  var c = charStats[id];
  characters[id] = {
    id: id,
    name: id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' '),
    num: c.num,
    hp: c.hp || 0,
    gp: c.gp || 0,
    downedHealth: c.downedHealth || 400,
    melee: c.melee || 0,
    alpha: c.alpha || 0,
    beta: c.beta || 0,
    gamma: c.gamma || 0,
    sa: c.sa || 0,
    movement: c.movement || {},
    defenseMult: c.defenseMult || {},
    damageMult: c.damageMult || {},
    reloadMult: c.reloadMult || {},
    size: c.size || 'Medium',
    udClass: c.udClass || '',
    effective: c.effective || {}
  };
});
fs.writeFileSync(path + 'characters.json', JSON.stringify(characters, null, 2));
console.log('characters.json:', Object.keys(characters).length, 'entries');

// 2. Normal Tunings
var normalTuning = JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\normal_tuning_parsed.json', 'utf8'));
var normalMap = {};
normalTuning.forEach(function(t, i) {
  normalMap['n' + i] = {
    chara: t.chara,
    role: t.role,
    class: t.class,
    name: t.name,
    skillName: t.skillName || '',
    skillDesc: t.skillDesc || '',
    levels: t.levels || [],
    subEffects: (t.subEffects || []).map(function(s) {
      return { skillName: s.skillName, skillDesc: s.skillDesc, levels: s.levels || [] };
    })
  };
});
fs.writeFileSync(path + 'tunings.json', JSON.stringify(normalMap, null, 2));
console.log('tunings.json:', Object.keys(normalMap).length, 'entries');

// 3. Special Tunings
var specialTuning = JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\special_tuning_parsed.json', 'utf8'));
var specialMap = {};
specialTuning.forEach(function(t, i) {
  specialMap['s' + i] = {
    chara: t.chara,
    role: t.role,
    class: t.class || '',
    name: t.name,
    skillName: t.skillName || '',
    skillDesc: t.skillDesc || '',
    align: t.align || '',
    levels: t.levels || [],
    effect: t.effect || ''
  };
});
fs.writeFileSync(path + 'special_tunings.json', JSON.stringify(specialMap, null, 2));
console.log('special_tunings.json:', Object.keys(specialMap).length, 'entries');

// 4. Costumes (extract from CH array in HTML)
var chMatch = html.match(/var CH=\[([\s\S]*?)\];/);
if (chMatch) {
  try {
    var CH = JSON.parse(chMatch[1]);
    var costumes = {};
    CH.forEach(function(ch) {
      if (ch.c && ch.c.length) {
        costumes[ch.id] = ch.c.map(function(cos, idx) {
          return {
            idx: idx,
            name: cos.n || 'Default',
            rarity: cos.ra || 'R',
            alignment: cos.al || '',
            sp1: cos.sp1 || null,
            sp2: cos.sp2 || null,
            slots: cos.s || []
          };
        });
      }
    });
    fs.writeFileSync(path + 'costumes.json', JSON.stringify(costumes, null, 2));
    console.log('costumes.json:', Object.keys(costumes).length, 'characters with costumes');
  } catch (e) { console.log('Costume parse error:', e.message); }
}

// 5. CH_NUM mapping
var chNumMatch = html.match(/var CH_NUM=\{[^}]+\};/);
if (chNumMatch) {
  try {
    var chNum = eval('(' + chNumMatch[0].replace('var CH_NUM=', '') + ')');
    fs.writeFileSync(path + 'character_ids.json', JSON.stringify(chNum, null, 2));
    console.log('character_ids.json:', Object.keys(chNum).length, 'entries');
  } catch (e) { console.log('CH_NUM parse error:', e.message); }
}

console.log('Done - database files created');
