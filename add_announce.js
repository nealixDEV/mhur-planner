var fs=require('fs');
var h=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html','utf8');

var announce = `
  // Announcement v1.7
  if(!localStorage.getItem('mhurAnnounceSeen_v17')){
    (function(){
      var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;z-index:100003;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;';
      var box=document.createElement('div');box.style.cssText='background:linear-gradient(145deg,#1e1e2e,#2a2a3e);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;max-width:480px;width:90%;max-height:80vh;overflow-y:auto;text-align:center;';
      box.innerHTML='<div style="font-size:2rem;margin-bottom:6px;">&#128640;</div><h2 class="gold-grad" style="font-size:1.1rem;margin-bottom:4px;">Update v1.7</h2><div style="color:#64748b;font-size:.65rem;margin-bottom:10px;">Premium build cards &amp; major improvements</div><div style="text-align:left;font-size:.72rem;color:#cbd5e1;line-height:1.5;margin-bottom:12px;"><div style="margin-bottom:8px;"><b style="color:#f5c800;">&#127912; Premium Build Card Export</b><br>Share Build generates a game-quality PNG with golden name, role-colored cards, and stat dashboard.</div><div style="margin-bottom:8px;"><b style="color:#f5c800;">&#128279; Short Build IDs</b><br>Builds get short importable codes like #MRYL61 instead of giant URLs.</div><div style="margin-bottom:8px;"><b style="color:#f5c800;">&#128190; Cross-Device Builds</b><br>Builds save to your account. Log in anywhere to access them.</div><div style="margin-bottom:8px;"><b style="color:#f5c800;">&#128272; Browse Without Login</b><br>View forum posts without signing in.</div><div style="margin-bottom:8px;"><b style="color:#f5c800;">&#128241; Mobile Fixes</b><br>Logout &amp; password change now use proper modals.</div><div style="margin-bottom:8px;"><b style="color:#f5c800;">&#128200; Down HP Fix</b><br>Down HP bonuses now boost the correct stat.</div></div><button class="forum-btn" id="dismissV17" style="font-size:.78rem;padding:7px 20px;">Got it!</button>';
      ov.appendChild(box);document.body.appendChild(ov);
      document.getElementById('dismissV17').onclick=function(){ov.remove();localStorage.setItem('mhurAnnounceSeen_v17','1');};
    })();
  }
`;

// Insert before the v0.5 announcement
var marker = '  // Announcement v0.6?';
h = h.replace(marker, announce + '\n' + marker);

fs.writeFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html', h, 'utf8');
console.log('Announcement added');
