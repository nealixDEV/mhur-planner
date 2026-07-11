// Full scraper: get per-slot types for all costumes from ultrarumble.com/costume/XXXXXXX
const https = require('https');
const fs = require('fs');

// Map hex color to role type
function colorToRole(hex) {
  if (!hex) return 'Strike';
  const c = hex.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (c === '00ff01' || c === '02db18' || c === '00ff00' || c === '00c800' || c === '00d000') return 'Support';
  if (c === '00cbe6' || c === '00c8ff' || c === '0084ff' || c === '00a0ff' || c === '0080ff' || c === '0064ff') return 'Rapid';
  if (c === 'ffff00' || c === 'ffd700' || c === 'f5c800' || c === 'ffdd00' || c === 'ffc800') return 'Assault';
  if (c === 'c913c9' || c === '8400ff' || c === '9400d3' || c === 'c900c9' || c === '8000ff' || c === 'a000ff') return 'Technical';
  if (c === 'fc0102' || c === 'ff0000' || c === 'ff0001') return 'Strike';
  console.warn('Unknown color:', hex, '->', c);
  return 'Strike';
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.get(url, { timeout: 20000 }, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetch(res.headers.location).then(resolve).catch(reject);
        return;
      }
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseCostumeSlots(html) {
  // Extract slot colors from tab button styles
  // Pattern: id="specialslot1-tab" ... style="background-color: #XXXXXX !important;"
  // Or: id="slot1-tab" ... style="background-color: #XXXXXX !important;"
  const result = {
    slots: {},      // slot1..slot10: { role, align }
    specials: {}    // specialslot1, specialslot2: { role, align }
  };
  
  // Match each tab button's color
  // The style is in the <a ... style="..."> tag
  const btnRe = /<a\s[^>]*style="background-color:\s*(#[0-9a-fA-F]+)[^"]*"[^>]*id="((?:special)?slot\d+)-tab"[^>]*>([\s\S]{0,300}?)<\/a>/g;
  let m;
  while ((m = btnRe.exec(html)) !== null) {
    const color = m[1];
    const id = m[2];
    const label = m[3].replace(/<[^>]+>/g, '').trim();
    const role = colorToRole(color);
    // Detect alignment mark from label: "(V)" = villain, "(H)" = hero, otherwise null
    const alignMatch = label.match(/\(([VH])\)/);
    const align = alignMatch ? (alignMatch[1] === 'V' ? 'villain' : 'hero') : null;
    
    if (id.startsWith('specialslot')) {
      result.specials[id] = { role, align, label };
    } else {
      result.slots[id] = { role, align, label };
    }
  }
  
  // Also try alternate style order: id first, then style
  const btnRe2 = /<a\s[^>]*id="((?:special)?slot\d+)-tab"[^>]*style="background-color:\s*(#[0-9a-fA-F]+)[^"]*"[^>]*>([\s\S]{0,300}?)<\/a>/g;
  let m2;
  while ((m2 = btnRe2.exec(html)) !== null) {
    const id = m2[1];
    if (result.slots[id] || result.specials[id]) continue; // already got it
    const color = m2[2];
    const label = m2[3].replace(/<[^>]+>/g, '').trim();
    const role = colorToRole(color);
    const alignMatch = label.match(/\(([VH])\)/);
    const align = alignMatch ? (alignMatch[1] === 'V' ? 'villain' : 'hero') : null;
    
    if (id.startsWith('specialslot')) {
      result.specials[id] = { role, align, label };
    } else {
      result.slots[id] = { role, align, label };
    }
  }
  
  return result;
}

// Build clean slot array: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10] and specials
function buildCleanSlots(parsed) {
  const slots = [];
  for (let i = 1; i <= 10; i++) {
    const s = parsed.slots['slot' + i];
    slots.push(s ? { r: s.role, a: s.align } : null);
  }
  const spec1 = parsed.specials['specialslot1'];
  const spec2 = parsed.specials['specialslot2'];
  return {
    s: slots,  // 10 normal slots
    sp1: spec1 ? { r: spec1.role, a: spec1.align } : null,  // left special
    sp2: spec2 ? { r: spec2.role, a: spec2.align } : null   // right special
  };
}

async function main() {
  // Get all costume IDs
  console.log('Fetching costume list...');
  const listHtml = await fetch('https://ultrarumble.com/costumes');
  const idRe = /href="\/costume\/(\d+)"/g;
  let idM;
  const ids = new Set();
  while ((idM = idRe.exec(listHtml)) !== null) ids.add(parseInt(idM[1]));
  const allIds = [...ids].sort((a, b) => a - b);
  console.log(`Found ${allIds.length} costume IDs`);
  
  const results = {};
  let done = 0;
  
  // Process in batches of 4
  for (let i = 0; i < allIds.length; i += 4) {
    const batch = allIds.slice(i, i + 4);
    await Promise.all(batch.map(async id => {
      try {
        const html = await fetch(`https://ultrarumble.com/costume/${id}`);
        const parsed = parseCostumeSlots(html);
        const clean = buildCleanSlots(parsed);
        results[id] = clean;
        done++;
        if (done % 20 === 0 || done <= 5) console.log(`[${done}/${allIds.length}] costume ${id}: slots=${JSON.stringify(clean.s)}`);
      } catch (e) {
        console.warn(`Failed ${id}: ${e.message}`);
      }
    }));
    await new Promise(r => setTimeout(r, 300));
  }
  
  fs.writeFileSync('costume_slots_raw.json', JSON.stringify(results, null, 2));
  console.log(`\nDone! Saved ${Object.keys(results).length} costumes to costume_slots_raw.json`);
  
  // Print a few samples
  const samples = allIds.slice(0, 3);
  for (const id of samples) {
    if (results[id]) {
      console.log(`\nCostume ${id}:`, JSON.stringify(results[id]));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
