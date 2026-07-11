const https = require('https');

function fetchCostume(id) {
  return new Promise((resolve, reject) => {
    let data = '';
    https.get('https://ultrarumble.com/costume/' + id, res => {
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  // Hero Costume (Combat) for Izuku = costume ID 1000004
  const data = await fetchCostume(1000004);
  
  // Find all slot framing divs - these have the slot type
  const framingRe = /class="framing (Strike|Assault|Rapid|Technical|Support)"/g;
  let m, slots = [];
  while ((m = framingRe.exec(data)) !== null) slots.push(m[1]);
  
  // Find mark divs for alignment
  const markRe = /class="mark (HERO|VILLAIN)"/g;
  let m2, marks = [];
  while ((m2 = markRe.exec(data)) !== null) marks.push(m2[1]);
  
  console.log('Slot types (framing):', JSON.stringify(slots));
  console.log('Marks (alignment):', JSON.stringify(marks));
  
  // Print context around first slot
  const fi = data.indexOf('class="framing ');
  if (fi >= 0) {
    console.log('\n--- First slot context ---');
    console.log(data.slice(Math.max(0, fi - 300), fi + 800));
  }
  
  // Also show 2nd costume for comparison (Hero Costume = 1000001)
  const data2 = await fetchCostume(1000001);
  const slots2 = [];
  const re2 = /class="framing (Strike|Assault|Rapid|Technical|Support)"/g;
  let m3;
  while ((m3 = re2.exec(data2)) !== null) slots2.push(m3[1]);
  console.log('\n\nHero Costume (1000001) slot types:', JSON.stringify(slots2));
}

main().catch(e => console.error(e));
