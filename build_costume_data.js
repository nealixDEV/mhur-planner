// Build new COSTUME_DATA with per-slot types from costume_slots_raw.json
// Matches costumes by fetching costume name from page title/metadata
const fs = require('fs');
const https = require('https');
const vm = require('vm');
const raw = require('./costume_slots_raw.json');

const CHAR_MAP = {
  1:'izuku', 2:'katsuki', 3:'ochaco', 4:'shoto', 5:'tenya', 6:'tsuyu', 7:'denki',
  8:'eijiro', 10:'momo', 11:'fumikage', 12:'allmight', 13:'aizawa', 15:'tomura',
  16:'afo', 17:'dabi', 18:'himiko', 23:'endeavor', 24:'mirio', 25:'nejire',
  26:'tamaki', 34:'overhaul', 37:'twice', 38:'compress', 43:'hawks', 46:'kendo',
  100:'mtlady', 101:'cement', 102:'ibara', 103:'kurogiri', 104:'neito', 105:'hitoshi',
  109:'mic', 111:'mirko', 114:'star', 115:'nagant', 200:'armored', 201:'afo_youth', 202:'izuku_ofa'
};
const SORTED_CHAR_NUMS = Object.keys(CHAR_MAP).map(Number).sort((a,b)=>String(b).length-String(a).length||b-a);

function getCharNum(costumeId) {
  const s = String(costumeId);
  for (const num of SORTED_CHAR_NUMS) {
    const prefix = String(num);
    if (s.startsWith(prefix) && s.length > prefix.length + 5) return num;
  }
  return null;
}

// Extract COSTUME_DATA from index.html
const html = fs.readFileSync('./index.html', 'utf8');
const cdStart = html.indexOf('var COSTUME_DATA = {');
const after = html.slice(cdStart);
const varBase = after.indexOf('\nvar BASE=');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(after.slice(0, varBase), ctx);
const COSTUME_DATA = ctx.COSTUME_DATA;

// Extract costume names from the HTML of the costumes page (already fetched in costumes list)
// Better: extract name from each costume's page URL-metadata we already have
// We need to fetch costume names. Let's use the costumes page HTML to build ID->name map.
// Actually we have the costume IDs and can get names from the individual pages we already scraped.
// Wait - we didn't save the HTML pages. Let's use another approach:
// The costume IDs encode character + variant. We can fetch the costumes list page once
// and extract all costume names and their IDs.

async function fetchCostumesPage() {
  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.get('https://ultrarumble.com/costumes', { timeout: 30000 }, res => {
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  console.log('Fetching costumes list page...');
  const cosPage = await fetchCostumesPage();
  
  // Extract costume name + ID pairs from the page
  // Pattern: href="/costume/XXXXXXX" ... class="name" title="COSTUME NAME">
  const cosNameMap = {}; // costumeId -> name (trimmed)
  const linkRe = /href="\/costume\/(\d+)"[\s\S]{0,2000}?class="name"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = linkRe.exec(cosPage)) !== null) {
    cosNameMap[m[1]] = m[2].trim();
  }
  console.log(`Extracted ${Object.keys(cosNameMap).length} costume names`);
  
  // Group costume IDs by character
  const charCostumes = {}; // charId -> [{id, name}]
  for (const costumeId of Object.keys(cosNameMap)) {
    const charNum = getCharNum(parseInt(costumeId));
    if (charNum === null) continue;
    const charId = CHAR_MAP[charNum];
    if (!charId) continue;
    if (!charCostumes[charId]) charCostumes[charId] = [];
    charCostumes[charId].push({ id: costumeId, name: cosNameMap[costumeId] });
  }
  
  // Fix garbled unicode names in COSTUME_DATA to match website names
  const NAME_FIX = {
    'Costume \u256C\u2561': 'Costume \u03b5',
    'Villain Costume Mask \u256C\u2593 ver.': 'Villain Costume Mask \u03b2 ver.'
  };
  function fixName(n) {
    if (NAME_FIX[n]) return NAME_FIX[n];
    // Also fix variant suffixes
    for (const [bad, good] of Object.entries(NAME_FIX)) {
      if (n.startsWith(bad + ' (')) return good + n.slice(bad.length);
    }
    return n;
  }
  
  // Build new COSTUME_DATA: match by costume name
  const NEW_COSTUME_DATA = {};
  for (const charId of Object.keys(COSTUME_DATA)) {
    const costumes = COSTUME_DATA[charId];
    const available = charCostumes[charId] || [];
    // Build name->id map for this character
    const nameToId = {};
    for (const { id, name } of available) {
      nameToId[name] = id;
    }
    
    NEW_COSTUME_DATA[charId] = costumes.map((cos, i) => {
      const webName = fixName(cos.n);
      const cosId = nameToId[webName];
      const slotData = cosId ? raw[cosId] : null;
      if (!slotData) {
        console.log(`Missing: ${charId}[${i}] "${cos.n}" -> "${webName}" (ID=${cosId})`);
        return cos;
      }
      return { n:cos.n, ra:cos.ra, al:cos.al, s:slotData.s, sp1:slotData.sp1, sp2:slotData.sp2 };
    });
  }
  
  // Count matches
  let found = 0, missing = 0;
  for (const costumes of Object.values(NEW_COSTUME_DATA)) {
    for (const cos of costumes) {
      if (cos.s) found++; else missing++;
    }
  }
  console.log(`Matched: ${found}, Missing: ${missing}`);
  
  // Generate compact JS
  let js = 'var COSTUME_DATA = {\n';
  for (const [charId, costumes] of Object.entries(NEW_COSTUME_DATA)) {
    js += '  ' + charId + ': [\n';
    for (const cos of costumes) {
      const sArr = (cos.s||[]).map(sl => sl ? (sl.a ? `{r:"${sl.r}",a:"${sl.a}"}` : `{r:"${sl.r}"}`) : 'null');
      const sp1 = cos.sp1 ? (cos.sp1.a ? `{r:"${cos.sp1.r}",a:"${cos.sp1.a}"}` : `{r:"${cos.sp1.r}"}`) : 'null';
      const sp2 = cos.sp2 ? (cos.sp2.a ? `{r:"${cos.sp2.r}",a:"${cos.sp2.a}"}` : `{r:"${cos.sp2.r}"}`) : 'null';
      js += `    {n:${JSON.stringify(cos.n)},ra:"${cos.ra}",al:"${cos.al}",s:[${sArr.join(',')}],sp1:${sp1},sp2:${sp2}},\n`;
    }
    js += '  ],\n';
  }
  js += '};';
  
  fs.writeFileSync('./new_costume_data.js', js);
  console.log(`Wrote new_costume_data.js`);
  
  // Spot check
  const c = NEW_COSTUME_DATA.izuku[11];
  console.log('\nIzuku[11]:', c.n);
  if (c.s) {
    console.log('Slots L:', c.s.slice(0,5).map(s=>`${s.r}${s.a?'('+s.a[0].toUpperCase()+')':''}`).join(', '));
    console.log('Slots R:', c.s.slice(5).map(s=>`${s.r}${s.a?'('+s.a[0].toUpperCase()+')':''}`).join(', '));
    console.log('SP1:', c.sp1 ? `${c.sp1.r}${c.sp1.a?'('+c.sp1.a[0].toUpperCase()+')':''}` : 'null');
    console.log('SP2:', c.sp2 ? `${c.sp2.r}${c.sp2.a?'('+c.sp2.a[0].toUpperCase()+')':''}` : 'null');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
