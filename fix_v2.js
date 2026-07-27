var fs=require('fs');
var c=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\png_gen.js','utf8');

// Fix 1: Section headers - 18px, longer underline
c=c.replace("ctx.fillText('TUNING & MEMORY SLOTS',rx,76);\n    ctx.fillStyle='#a855f7';ctx.fillRect(rx,82,230,3);",
  "ctx.fillText('TUNING & MEMORY SLOTS',rx,76);\n    ctx.fillStyle='#a855f7';ctx.fillRect(rx,82,280,2);");

c=c.replace("ctx.fillText('SPECIAL TUNING',rx,specY+14);\n    ctx.fillStyle='#a855f7';ctx.fillRect(rx,specY+20,180,3);",
  "ctx.fillText('SPECIAL TUNING',rx,specY+14);\n    ctx.fillStyle='#a855f7';ctx.fillRect(rx,specY+20,220,2);");

// Fix 2: Card description color - more readable
c=c.replace(/ctx\.fillStyle='#94a3b8';ctx\.font='12px Rajdhani,sans-serif';\n      var td=tuningDesc/g, 
  "ctx.fillStyle='#a0aec0';ctx.font='12px Rajdhani,sans-serif';\n      var td=tuningDesc");

// Fix 3: Empty special tuning - neutral bg + icon
var emptySpecOld = "      rr(sx,specY+28,specW,specH,8,'#1a0a0f','rgba(167,139,250,.12)');\n\n      if(ss&&ss.tid){";
var emptySpecNew = "      if(ss&&ss.tid){";
if(c.indexOf(emptySpecOld)!==-1){
  c=c.replace(emptySpecOld,emptySpecNew);
}

// Fix 4: Add empty special slot handler before closing bracket
var specCloseOld = "        }\n      }\n    }\n\n    // === FOOTER ===";
var specCloseNew = "        }\n      }else{\n        rr(sx,specY+28,specW,specH,8,'#0d1020','rgba(255,255,255,.04)');\n        alC();\n        ctx.fillStyle='#484f58';ctx.font='bold 28px Rajdhani,sans-serif';\n        ctx.fillText('+',sx+specW/2,specY+28+specH/2-4);\n        ctx.fillStyle='#374151';ctx.font='12px Rajdhani,sans-serif';\n        ctx.fillText('No Special Tuning Equipped',sx+specW/2,specY+28+specH/2+16);\n        alL();\n      }\n    }\n\n    // === FOOTER ===";
if(c.indexOf(specCloseOld)!==-1){
  c=c.replace(specCloseOld,specCloseNew);
}

// Fix 5: Card accent bar 5px wide
c=c.replace("ctx.fillRect(x+1,y+6,3,slotH-12);", "ctx.fillRect(x+1,y+5,5,slotH-10);");

// Fix 6: Description bump color
c=c.replace("ctx.fillStyle='#94a3b8';ctx.font='11px Rajdhani,sans-serif';\n          var sd2=", 
  "ctx.fillStyle='#a0aec0';ctx.font='11px Rajdhani,sans-serif';\n          var sd2=");

fs.writeFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\png_gen.js',c);
console.log('Fixes applied');
