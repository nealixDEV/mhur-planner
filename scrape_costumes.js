const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// char id -> our internal id map
const CHAR_MAP = {
  '1':'izuku','202':'izuku_ofa','2':'katsuki','3':'ochaco','5':'tenya',
  '4':'shoto','6':'tsuyu','8':'eijiro','10':'momo','11':'fumikage',
  '7':'denki','104':'neito','46':'kendo','102':'ibara','24':'mirio',
  '26':'tamaki','25':'nejire','105':'hitoshi','12':'allmight','200':'armored',
  '13':'aizawa','109':'mic','101':'cement','23':'endeavor','43':'hawks',
  '111':'mirko','114':'star','100':'mtlady',
  '15':'tomura','16':'afo','201':'afo_youth','17':'dabi','18':'himiko',
  '37':'twice','38':'compress','103':'kurogiri','115':'nagant','34':'overhaul'
};

(async () => {
  const html = await get('https://ultrarumble.com/costumes');

  // Match each costume block
  const blockRe = /data-chara="(\d+)"[^>]*data-unique1="(\w+)"[^>]*data-unique2="(\w+)"([\s\S]*?)(?=<a href="\/costume\/|\s*<\/div>\s*<hr>|\s*<h1>)/g;
  const nameRe = /<div class="name"[^>]*>\s*([\s\S]*?)\s*<\/div>/;
  const obtainRe = /<div class="costumeOBTAIN"[^>]*>\s*([\s\S]*?)\s*<\/div>/;
  const alignRe = /CostumeUnique2mark\s+(\w+)"/;
  const rarityRe = /rarity_(r_1star|sr_2star|pur_3star)/;

  const byChar = {};

  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const charaNum = m[1];
    const u1 = m[2];
    const u2 = m[3];
    const block = m[4];

    const nameM = nameRe.exec(block);
    const obtainM = obtainRe.exec(block);
    const alignM = alignRe.exec(block);
    const rarityM = rarityRe.exec(block);

    const name = nameM ? nameM[1].replace(/<[^>]+>/g,'').trim() : '?';
    const obtain = obtainM ? obtainM[1].replace(/<[^>]+>/g,'').trim() : '?';
    const align = alignM ? alignM[1].toLowerCase() : 'hero';
    const rarRaw = rarityM ? rarityM[1] : 'r_1star';
    const rarity = rarRaw.includes('3star') ? 'PUR' : rarRaw.includes('2star') ? 'SR' : 'R';

    const internalId = CHAR_MAP[charaNum];
    if (!internalId) continue;

    if (!byChar[internalId]) byChar[internalId] = [];
    byChar[internalId].push({ n: name, ra: rarity, al: align, u1, u2, obtain });
  }

  // Output as JS object literal for copy-paste into index.html
  console.log('// COSTUME DATA scraped from ultrarumble.com/costumes');
  console.log('// Format: { charId: [{n, ra, al, u1, u2}] }');
  console.log('var COSTUME_DATA = {');
  for (const [id, costumes] of Object.entries(byChar)) {
    console.log(`  ${id}: [`);
    for (const c of costumes) {
      console.log(`    {n:${JSON.stringify(c.n)},ra:"${c.ra}",al:"${c.al}",u1:"${c.u1}",u2:"${c.u2}"},`);
    }
    console.log(`  ],`);
  }
  console.log('};');
  console.log(`\n// Total characters: ${Object.keys(byChar).length}`);
  console.log(`// Total costumes: ${Object.values(byChar).reduce((s,a)=>s+a.length,0)}`);
})();
