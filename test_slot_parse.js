const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.get(url, { timeout: 15000 }, res => {
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const html = await fetch('https://ultrarumble.com/costume/1000004');
  
  // Get ALL slot tab entries including slot10
  const tabRe = /id="((?:special)?slot\d+)-tab"[\s\S]{0,400}?style="background-color:\s*(#[0-9a-fA-F]+)!?\s*"[\s\S]{0,200}?>(.*?)<\/a>/g;
  let m;
  while ((m = tabRe.exec(html)) !== null) {
    console.log(`${m[1]}: color=${m[2]}, label=${m[3].trim()}`);
  }
  
  // Also find slot10-tab specifically
  const idx10 = html.indexOf('slot10-tab');
  if (idx10 >= 0) {
    console.log('\nslot10 tab context:');
    console.log(html.slice(Math.max(0, idx10-50), idx10+400));
  } else {
    console.log('\nslot10-tab not found!');
  }
  
  // Print all tabs in order
  console.log('\n\nAll slot buttons:');
  const allBtns = html.match(/id="((?:special)?slot\d+)-tab"[^>]*>[^<]+<\/a>/g);
  if (allBtns) allBtns.forEach(b => console.log(b.replace(/\s+/g,' ')));
}

main().catch(e => console.error(e));
