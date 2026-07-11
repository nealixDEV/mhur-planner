const fs = require('fs');
const html = fs.readFileSync('tuning_page.html','utf8');
const start = html.indexOf('<div class="normalslots"');
console.log(html.substring(start, start+4000));
