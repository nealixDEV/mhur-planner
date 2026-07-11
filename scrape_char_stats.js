const https = require('https');
const fs = require('fs');

// All char IDs and page numbers
const CH_NUM = {
  izuku:1,izuku_ofa:202,katsuki:2,ochaco:3,tenya:5,tsuyu:6,shoto:4,
  eijiro:8,momo:10,fumikage:11,denki:7,neito:104,kendo:46,ibara:102,
  mirio:24,tamaki:26,nejire:25,hitoshi:105,allmight:12,armored:200,
  aizawa:13,mic:109,cement:101,endeavor:23,hawks:43,mirko:111,
  star:114,mtlady:100,
  tomura:15,afo:16,afo_youth:201,dabi:17,himiko:18,twice:37,
  compress:38,kurogiri:103,nagant:115,overhaul:34
};

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

function extractText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

// Find Lv.1 damage for a skill section.
// Handles both "Base X Values Level Damage ... Lv.1 NNN" and "Additional X Damage Values ... Lv.1 NNN NNN"
function findSkillDamage(text, sectionHeader) {
  const idx = text.indexOf(sectionHeader);
  if (idx < 0) return null;
  const chunk = text.substring(idx, idx + 2000);
  // Try "Base ... Values Level Damage ... Lv.1 NNN"
  const base = chunk.match(/Base[^L]*?Level Damage[^L]*?Lv\.1 (\d+)/);
  if (base) return parseInt(base[1]);
  // Try "Additional ... Damage Values ... Lv.1 NNN" — first numeric after "Lv.1"
  const addl = chunk.match(/Additional[^L]*?Lv\.1 \w[^L]*?Lv\.1 (\d+)/);
  if (addl) return parseInt(addl[1]);
  // Try any "Lv.1 NNN" pattern within the section (skip ammo/reload values)
  // Find first "Lv.1 " followed by a reasonable damage number (>=1, <=9999)
  const any = chunk.match(/Lv\.1 (\d+)/g);
  if (any) {
    for (const m of any) {
      const v = parseInt(m.replace('Lv.1 ', ''));
      if (v > 0 && v <= 9999) return v;
    }
  }
  return null;
}

function parseCharPage(id, num, text) {
  const result = { id, num, hp: null, gp: 250, melee: null, alpha: null, beta: null, gamma: null, sa: null };

  // HP
  const hpM = text.match(/Max Main Health (\d+)/);
  if (hpM) result.hp = parseInt(hpM[1]);

  // Skills — find each section
  result.alpha = findSkillDamage(text, 'Quirk Skill α');
  result.beta  = findSkillDamage(text, 'Quirk Skill β');
  result.gamma = findSkillDamage(text, 'Quirk Skill γ');
  result.sa    = findSkillDamage(text, 'Special Action');

  // Melee — look for "Melee Combat" or plain "Melee" in additional damage values
  const meleeM = text.match(/Melee(?: Combat[^L]*?)? Lv\.1 (\d+)/);
  if (meleeM) result.melee = parseInt(meleeM[1]);

  return result;
}

async function main() {
  const results = {};
  const entries = Object.entries(CH_NUM);

  for (const [id, num] of entries) {
    const url = `https://ultrarumble.com/character/${num}`;
    try {
      const html = await get(url);
      const text = extractText(html);
      const stat = parseCharPage(id, num, text);
      results[id] = stat;
      console.log(`OK ${id}(${num}): HP=${stat.hp} α=${stat.alpha} β=${stat.beta} γ=${stat.gamma} melee=${stat.melee} sa=${stat.sa}`);
    } catch (e) {
      console.log(`FAIL ${id}(${num}): ${e.message}`);
      results[id] = { id, num, hp: null, gp: 250, melee: null, alpha: null, beta: null, gamma: null, sa: null };
    }
    await new Promise(r => setTimeout(r, 160));
  }

  fs.writeFileSync('char_stats.json', JSON.stringify(results, null, 2));
  console.log('\nSaved char_stats.json');
}

main().catch(console.error);
