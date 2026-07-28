// AI Chat — Mei Hatsume personality with Groq backend
var coachMemory={lastTopic:'',lastChar:'',lastAnalysis:null,lastGoal:null,buildState:{phase:'idle'},history:[]};
var MAX_HISTORY=10; // keep last 5 exchanges (user + bot)

function toggleCoachChat(){
  var p=document.getElementById('coachChatPanel');
  p.style.display=p.style.display==='none'||!p.style.display?'flex':'none';
  if(p.style.display==='flex')setTimeout(function(){document.getElementById('coachInput').focus();},100);
}
function addCoachMsg(text,isUser){
  var m=document.getElementById('coachMessages');
  if(!text||!text.trim())text='...';
  var d=document.createElement('div');
  d.style.cssText='background:'+(isUser?'rgba(5,150,105,.12)':'rgba(255,255,255,.04)')+';border-radius:10px;padding:8px 12px;max-width:90%;align-self:'+(isUser?'flex-end':'flex-start')+';font-size:.72rem;color:#cbd5e1;line-height:1.5;'+(isUser?'border:1px solid rgba(5,150,105,.15);':'');
  d.innerHTML=text;
  m.appendChild(d);m.scrollTop=m.scrollHeight;
}
function coachThink(){addCoachMsg('<span style="color:#64748b;">Thinking...</span>',false);}
// Show a "thinking" message with detailed sub-text
function coachThinkDetailed(main,sub){
  var m=document.getElementById('coachMessages');
  coachStop();
  var d=document.createElement('div');
  d.style.cssText='background:rgba(255,255,255,.04);border-radius:10px;padding:8px 12px;max-width:90%;align-self:flex-start;font-size:.72rem;color:#cbd5e1;line-height:1.5;';
  d.id='coachThinking';
  d.innerHTML=main+'<br><span style="color:#64748b;font-size:.6rem;">'+esc(sub)+'</span>';
  m.appendChild(d);m.scrollTop=m.scrollHeight;
}
function coachStop(){
  var m=document.getElementById('coachMessages');
  var last=m.lastChild;if(last&&last.innerHTML.indexOf('Thinking...')>=0)last.remove();
  var thinking=document.getElementById('coachThinking');
  if(thinking){thinking.remove();}
}
function sendCoachMsg(){
  var inp=document.getElementById('coachInput');
  var txt=inp.value.trim();if(!txt)return;
  inp.value='';
  addCoachMsg(esc(txt),true);
  coachThink();
  setTimeout(function(){processCoach(txt);},400);
}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

function groqChat(msg, cb, includeBuild){
  var fullMsg=msg;
  if(includeBuild){
    var ch=window.gc();
    // Use build state tunings if available (more accurate than ST.list which doesn't exist)
    var tuningNames=[];
    var bs=coachMemory.buildState;
    if(bs&&bs.build){
      (bs.build.left||[]).concat(bs.build.right||[]).forEach(function(s){if(s.name)tuningNames.push(s.name);});
      bs.build.specs.forEach(function(s){if(s.name&&s.name!=='Locked')tuningNames.push('Special: '+s.name);});
    }else{
      // Fallback: read from planner slots
      var allSlots=(window.ST.left||[]).concat(window.ST.right||[]);
      allSlots.forEach(function(s){
        if(s.tid){
          var e=window.findNormal?window.findNormal(s.tid):null;
          var label=e?((e.skillName||e.name)||'Tuning'):'Tuning';
          tuningNames.push(label+' (Lv'+s.lv+')');
        }else tuningNames.push('Empty');
      });
      (window.ST.specs||[]).forEach(function(s){
        if(s.tid){
          var e=window.findSpecial?window.findSpecial(s.tid):null;
          var label=e?((e.skillName||e.name)||'Special'):'Special';
          tuningNames.push('Special: '+label+' (Lv'+s.lv+')');
        }
      });
    }
    if(ch){
      var lines=[];
      lines.push('Character: '+ch.n+' ('+(ch.bs&&ch.bs[window.ST.styleIdx]?ch.bs[window.ST.styleIdx].n:'Original')+')');
      lines.push('Current Build Tunings:');
      tuningNames.forEach(function(tn,i){lines.push('  Slot '+(i+1)+': '+tn);});
      try{
        var coachAnalysis=window.AICoach&&window.AICoach.analyzeBuild();
        if(coachAnalysis&&coachAnalysis.totals){
          lines.push('Score: '+coachAnalysis.overall+'/100 | Dmg: '+Math.round(coachAnalysis.categories.damage)+'% | Def: '+Math.round(coachAnalysis.categories.defense)+'%');
          for(var c in coachAnalysis.categories){
            if(c!='damage'&&c!='defense')lines.push('  '+c+': '+Math.round(coachAnalysis.categories[c])+'%');
          }
          if(coachAnalysis.flags&&coachAnalysis.flags.length)lines.push('Issues: '+coachAnalysis.flags.join(', '));
        }
      }catch(e){}
      fullMsg=msg+'\n\n[User has this build equipped:\n'+lines.join('\n')+'\n]';
    }
  }
  // Add user message to history
  coachMemory.history.push({role:'user', content:msg});
  if(coachMemory.history.length>MAX_HISTORY)coachMemory.history.splice(0,2);
  try{
    var xhr=new XMLHttpRequest();xhr.open('POST','/api/chat',true);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.onload=function(){
      try{var r=JSON.parse(xhr.responseText);
        if(r&&r.reply){
          coachMemory.history.push({role:'assistant', content:r.reply});
          if(coachMemory.history.length>MAX_HISTORY)coachMemory.history.splice(0,2);
          cb(r.reply);
        }else{cb(null);}
      }catch(e){cb(null);}
    };
    xhr.onerror=function(){cb(null);};
    xhr.send(JSON.stringify({message:msg,history:coachMemory.history}));
  }catch(e){cb(null);}
}

// === AI Build Generator — Conversational Build Engineer ===
var TUNING_MAX_LV=4;
var SPECIAL_MAX_LV=11;
// Character aliases: nickname → character ID
var CHAR_ALIAS={'deku':'izuku','midoriya':'izuku','kacchan':'katsuki','uraraka':'ochaco','todoroki':'shoto',
  'iida':'tenya','froppy':'tsuyu','asui':'tsuyu','eijiro':'eijiro','kaminari':'denki',
  'tokoyami':'fumikage','fumikage':'fumikage','yaoyorozu':'momo','monoma':'neito',
  'shiozaki':'ibara','togata':'mirio','lemillion':'mirio','amajiki':'tamaki','suneater':'tamaki',
  'hado':'nejire','shinso':'hitoshi','allmight':'allmight','shota':'aizawa','eraserhead':'aizawa',
  'present mic':'mic','cementoss':'cement','endeavour':'endeavor','shigaraki':'tomura',
  'afo':'afo','toga':'himiko','mr compress':'compress','lady nagant':'nagant','chisaki':'overhaul'};
// Character ID → style index for role+alias combos (e.g. "rapid deku" → OFA)
var CHAR_ROLE_STYLES={
  izuku:{assault:0,strike:1}, // Original=Assault, Full Bullet=Strike
  izuku_ofa:{rapid:0}, // OFA=Rapid, no alt styles
};
// Special tuning priority lists by goal type
var SPEC_PRIORITY={
  damage:[
    {n:'fixer',s:55},{n:'revenge strike',s:50},{n:'iron fist',s:45},{n:'embrittlement',s:45},
    {n:'hip hop',s:40},{n:'hiphop',s:40},{n:'ability manifest',s:35},{n:'twisted fortune',s:30},
    {n:'plus ultra intensified',s:25},{n:'power intensified',s:25}
  ],
  defense:[
    {n:'revenge support',s:50},{n:'revenge assault',s:50},{n:'willpower',s:45},{n:'quasi-permeation',s:42},
    {n:'hp sucker',s:40},{n:'gp sucker',s:40},{n:'critical permeation',s:38},
    {n:'reinforced revive',s:35},{n:'hyper regeneration',s:30},
    {n:'high-speed replenishment',s:25},{n:'camouflage',s:15}
  ],
  mobility:[
    {n:'space hop',s:55},{n:'wall runner',s:55},{n:'revenge rapid',s:45},{n:'bunny hop',s:35},
    {n:'pu turbo',s:35},{n:'acceleration',s:30},{n:'spiraling leap',s:20}
  ],
  reload:[
    {n:'revenge technical',s:50},{n:'quirk factor release',s:45},{n:'special attack reload',s:35},
    {n:'high-speed replenishment',s:30},{n:'quick reload',s:30},{n:'pu/pc reload',s:25}
  ],
  support:[
    {n:'reinforced revive',s:45},{n:'warp heal',s:45},{n:'foundation of peace',s:40},
    {n:'card duplication',s:30},{n:'area analysis',s:25},{n:'annihilation',s:25},
    {n:'divine protection',s:20},{n:'battlefield analysis',s:20},{n:'kota finder',s:15}
  ]
};
var buildPhases={idle:0,asking_char:1,asking_style:2,asking_costume:3,asking_goal:4,ready:5};
var buildRoles=['Strike','Assault','Rapid','Technical','Support'];
var buildGoals=[
  {id:'damage',label:'🔥 Max Damage',desc:'Glass cannon, max output'},
  {id:'balanced',label:'⚖️ Balanced',desc:'All-around reliable'},
  {id:'defensive',label:'🛡️ Defensive',desc:'Tanky, survive longer'},
  {id:'mobility',label:'💨 Mobility',desc:'Speed, repositioning'},
  {id:'reload',label:'🔄 Reload',desc:'High uptime, spam skills'},
  {id:'support',label:'💚 Support',desc:'Team utility, healing'}
];
var buildExplanations={
  alpha:'Your Alpha is your main pressure tool. Stacking Alpha damage makes each clip hit harder.',
  beta:'Your Beta is your heavy hitter. Focused Beta damage makes those hits devastating.',
  gamma:'Gamma damage stacked up — watch your enemies melt.',
  melee:'Melee focus means getting up close. These tunings reward aggressive play.',
  defensive:'Tanky setup! Stay in the fight longer and trade hits confidently.',
  mobility:'Speed build! Zoom around and reposition constantly.',
  reload:'Max uptime! Less downtime means more pressure.',
  'max damage':'Full glass cannon! Kill them before they kill you.',
  support:'Team player! Keeping your squad alive wins games.',
  balanced:'Solid foundation with damage and survivability balanced.'
};

function findChar(q){
  q=q.toLowerCase().replace(/[^a-z0-9 ]/g,'');
  var chs=window.CH||[];var best=null,bs=0;
  chs.forEach(function(c){
    var n=c.n.toLowerCase(),sc=0;
    if(n.indexOf(q)>=0)sc=q.length;
    else{q.split(' ').forEach(function(p){if(n.indexOf(p)>=0)sc+=p.length;});}
    if(c.bs)c.bs.forEach(function(b){var s=b.n.toLowerCase();if(s.indexOf(q)>=0)sc+=5;});
    if(sc>bs){bs=sc;best=c;}
  });
  return best;
}
function goalFromText(txt){
  txt=txt.toLowerCase();var g={focus:null,damage:0.4,defense:0.15,reload:0.15,mobility:0.15,hp:0.1,gp:0.05,desc:'balanced',skillDesc:''};
  if(/tank|defen|survive|hp|health|shield|bulky|tough|durable|frontline|immortal|unkillable/i.test(txt)){g.defense=0.6;g.hp=0.4;g.gp=0.3;g.damage=0.1;g.desc='defensive';}
  if(/mobilit|speed|dash|fast|agile|slippery|zoom|run/i.test(txt)){g.mobility=0.45;g.damage=Math.max(g.damage-0.15,0.1);g.desc='mobility';}
  if(/reload|cooldown|uptime|ammo|replenish|recovery/i.test(txt)){g.reload=0.45;g.damage=Math.max(g.damage-0.1,0.2);g.desc='reload';}
  if(/alpha/.test(txt)){g.focus='alpha';}
  if(/beta/.test(txt)){g.focus='beta';}
  if(/gamma/.test(txt)){g.focus='gamma';}
  if(/melee/.test(txt)){g.focus='melee';}
  if(/balanced|all.?round|versatile|general/i.test(txt)){g.desc='balanced';}
  if(/max.?dmg|glass.?cannon|sweaty|ranked|try.?hard|aggress|^max$|^max\b|high.?risk|risk.?reward/i.test(txt)){g.damage=0.7;g.defense=0.05;g.desc='max damage';}
  // "damage" alone should imply damage focus
  if(/damage|dmg|offensive|attack.?power/i.test(txt)&&g.desc==='balanced'){g.damage=0.55;g.defense=0.1;g.desc='damage';}
  if(/heal|gp|support|team|healer/i.test(txt)){g.gp=0.4;g.hp=0.3;g.damage=0.15;g.desc='support';}
  // Don't store _specialHint in goal — it gets lost on re-parse
  g.skillDesc=g.focus||'';
  if(g.skillDesc&&g.desc!=='balanced')g.display=g.skillDesc+' '+g.desc;
  else if(g.skillDesc)g.display=g.skillDesc+' focus';
  else g.display=g.desc;
  return g;
}
function scoreTuning(t,goal){
  var n=(t.name||'').toLowerCase();
  var et=(t.subEffects||[]).map(function(e){return(typeof e==='string'?e:(e&&e.skillName?e.skillName:''))+' '+(typeof e==='string'?'':(e&&e.skillDesc||''));}).join(' ').toLowerCase();
  var a=n+' '+et;var sc=0;
  var dmg=/damage|attack|power|strike|punch/i.test(a);
  var al=/alpha|α/i.test(a),be=/beta|β/i.test(a),ga=/gamma|γ/i.test(a),me=/melee/i.test(a);
  var all=/all skills|all dmg|attack pow/i.test(a);
  var def=/hp|defense|guard|shield|tough|survive/i.test(a)&&!/damage/i.test(a);
  var rel=/reload|cooldown|ammo|replenish|reload/i.test(a);
  var mob=/dash|movement|speed|mobility|wall.?run|space.?hop|acceleration/i.test(a);
  var gp=/gp|guard|heal|support|recovery|divine|kota/i.test(a);
  // Count matching effects for multi-effect tunings
  var matchCount=(al?1:0)+(be?1:0)+(ga?1:0)+(me?1:0)+(def?1:0)+(rel?1:0)+(mob?1:0)+(gp?1:0)+(dmg?1:0);
  if(goal.focus&&goal.focus!=='all'){
    if(goal.focus==='alpha'&&al)sc+=80;else if(goal.focus==='beta'&&be)sc+=80;
    else if(goal.focus==='gamma'&&ga)sc+=80;else if(goal.focus==='melee'&&me)sc+=80;
  }
  sc+=dmg*30*goal.damage+def*30*goal.defense+rel*30*goal.reload+mob*30*goal.mobility+gp*30*goal.gp+all*10
  // HP stat bonus — separate from defense
  if(/max hp|hp\+|hp defense|hp attack/i.test(a))sc+=20*goal.hp;
  if(/max gp|gp\+|gp attack|gp defense/i.test(a))sc+=20*goal.gp;
  // Multi-effect bonus (+5 per extra matching effect)
  if(matchCount>=2)sc+=matchCount*5;
  // Penalize unfocused skill damage (e.g., beta when focusing alpha)
  if(goal.focus==='alpha'&&(be||ga||me))sc-=35;
  if(goal.focus==='beta'&&(al||ga||me))sc-=25;
  if(goal.focus==='gamma'&&(al||be||me))sc-=25;
  if(t.rarity==='UR')sc+=5;else if(t.rarity==='SR')sc+=3;
  if(t.chara)sc-=3;
  if(t.name&&(t.name.indexOf('Attack Power')>=0||t.name.indexOf('Damage')>=0)&&goal.damage>0.3)sc+=8;
  if(goal.damage<0.3&&(t.name||'').match(/(attack|damage|power|strike)/i))sc-=5;
  return Math.max(1,sc);
}
function generateBuild(ch,si,goal,cosIdx,reservedTids){
  var cos=window.gcos(ch),CH_NUM=window.CH_NUM,used={};
  // Merge reserved tids into used so they get excluded during generation
  if(reservedTids){Object.keys(reservedTids).forEach(function(t){used[t]=true;});}
  // Set costume index if specified
  if(cosIdx!==undefined&&ch.c&&ch.c[cosIdx]){window.ST.cosIdx=cosIdx;cos=ch.c[cosIdx];}
  var build={left:[],right:[],specs:[],charId:ch.id,styleIdx:si,cosIdx:window.ST.cosIdx};
  ['left','right'].forEach(function(side){
    var defs=window.buildSlotDefs(ch,side);
    defs.forEach(function(def,idx){
      var opts=window.normalOptions(def.r,def.a,CH_NUM[ch.id],'');
      var avail=opts.filter(function(o){return !used[o.id];});
      var scored=avail.map(function(o){
        var sc=scoreTuning(o,goal);
        // Fixer bonus: if Fixer is equipped, boost offensive tunings
        if(hasFixer){
          var sn=(o.skillName||o.name||'').toLowerCase();
          if(/attack|power|damage|alpha|beta|gamma|melee/.test(sn))sc+=10;
        }
        return {t:o,s:sc};
      });
      scored.sort(function(a,b){return b.s-a.s;});
      var best=scored.length&&scored[0].s>0?scored[0].t:(avail.length?avail[0]:null);
      if(best)used[best.id]=true;
      var label=tuningDisplayName(best)||'Empty';
      build[side].push({tid:best?best.id:'',lv:best?TUNING_MAX_LV:1,label:label,name:label,rarity:best?best.rarity:''});
    });
  });
  var srs={};if(cos&&cos.sp1){srs.left={r:cos.sp1.r||'',a:cos.sp1.a||null};srs.right=cos.sp2?{r:cos.sp2.r||'',a:cos.sp2.a||null}:null;}
  // Check if Fixer is one of the special overrides — boost damage tunings
  var hasFixer=false;
  if(window.coachMemory&&window.coachMemory.buildState&&window.coachMemory.buildState._specialOverrides){
    window.coachMemory.buildState._specialOverrides.forEach(function(ov){if(ov.name&&ov.name.toLowerCase().indexOf('fixer')>=0)hasFixer=true;});
  }
  ['left','right'].forEach(function(side,si2){
    var sr=srs[side];if(!sr||!sr.r||sr.r==='/'){build.specs.push({tid:'',lv:1,name:'Locked'});return;}
    var opts=window.specialOptions(sr.r,CH_NUM[ch.id],sr.a||'',null);
    var avail=opts.filter(function(o){return o&&!used[o.id];});
    var scored=avail.map(function(o){
      var sc=scoreTuning(o,goal);var sn=(o.skillName||'').toLowerCase();
      // Boost mobility-related names when goal is mobility
      if(goal.mobility>0.4){
        if(sn.indexOf('run speed')>=0||sn.indexOf('dash speed')>=0||sn.indexOf('movement')>=0)sc+=40;
        if(sn.indexOf('wall jump')>=0||sn.indexOf('vertical jump')>=0||sn.indexOf('forward jump')>=0||sn.indexOf('jump ht')>=0)sc+=35;
        if(sn.indexOf('wall shuffle')>=0||sn.indexOf('downed crawl')>=0)sc+=20;
      }
      // Boost reload names when goal is reload
      if(goal.reload>0.4){
        if(sn.indexOf('reload')>=0)sc+=30;
      }
      // Special priority lists
      var priorityList=null;
      if(goal.damage>0.5)priorityList=SPEC_PRIORITY.damage;
      else if(goal.defense>0.4)priorityList=SPEC_PRIORITY.defense;
      else if(goal.mobility>0.4)priorityList=SPEC_PRIORITY.mobility;
      else if(goal.reload>0.4)priorityList=SPEC_PRIORITY.reload;
      else if(goal.gp>0.3)priorityList=SPEC_PRIORITY.support;
      if(priorityList){
        // Boost melee specials when focus is melee
        var meleeBonus=(goal.focus==='melee')?30:0;
        for(var pi=0;pi<priorityList.length;pi++){
          if(sn.indexOf(priorityList[pi].n)>=0){
            var bonus=meleeBonus;
            // Extra boost for melee-specific specials
            if(goal.focus==='melee'&&(sn.indexOf('embrittlement')>=0||sn.indexOf('trance blow')>=0))bonus+=20;
            else if(goal.focus==='melee'&&sn.indexOf('iron fist')>=0)bonus+=10;
            sc+=priorityList[pi].s+bonus;break;
          }
        }
      }
      // Mobility/reload specials also get secondary bonuses from goal values
      if(sn.indexOf('wall runner')>=0&&goal.mobility>0.3)sc+=15;
      if(sn.indexOf('space hop')>=0&&goal.mobility>0.3)sc+=15;
      if(goal.damage>0.5){
        if(sn.indexOf('hp sucker')>=0)sc+=10;
        if(sn.indexOf('gp sucker')>=0)sc+=10;
      }
      return {t:o,s:sc};
    });
    scored.sort(function(a,b){return b.s-a.s;});
    var best=scored.length&&scored[0].s>0?scored[0].t:(avail.length?avail[0]:null);
    if(best)used[best.id]=true;
    var sLabel=tuningDisplayName(best);
    build.specs.push({tid:best?best.id:'',lv:best?SPECIAL_MAX_LV:1,name:sLabel});
  });
  return build;
}
function applyBuild(build){
  if(!build)return false;
  try{
    var sid=build.styleIdx||0;
    if(build.charId!==window.ST.charId||sid!==window.ST.styleIdx){
      window.saveState();
      window.ST.charId=build.charId;
      window.ST.styleIdx=sid;
      window.loadState(build.charId,sid);
    }else{
      window.resetBuild();
    }
    // Set costume
    if(build.cosIdx!==undefined)window.ST.cosIdx=build.cosIdx;
    // Apply tunings directly
    ['left','right'].forEach(function(side){
      var arr=build[side]||[];
      for(var i=0;i<Math.min(arr.length,window.ST[side].length);i++){
        window.ST[side][i].tid=arr[i].tid||'';
        window.ST[side][i].lv=arr[i].lv||TUNING_MAX_LV;
      }
    });
    var sp=build.specs||[];
    console.log('APPLY SPECIALS:',JSON.stringify(sp.map(function(s){return{name:s.name,tid:s.tid};})),'ST.specs before:',JSON.stringify(window.ST.specs.map(function(s){return{tid:s.tid};})));
    for(var i=0;i<Math.min(sp.length,window.ST.specs.length);i++){
      window.ST.specs[i].tid=sp[i].tid||'';
      window.ST.specs[i].lv=sp[i].lv||SPECIAL_MAX_LV;
    }
    window.saveState();
    if(typeof window.renderAll==='function'){window.renderAll();}
    else if(typeof buildGrids==='function'){buildGrids();var gcd=gc();if(gcd)buildSlots(gcd);}
    return true;
  }catch(e){console.warn('applyBuild error:',e.message);return false;}
}
function buildTuningList(build){
  var parts=[];
  build.left.forEach(function(s){if(s.name)parts.push(s.name+(s.rarity?' <span style="font-size:.5rem;color:#94a3b8;">['+s.rarity+']</span>':''));});
  build.right.forEach(function(s){if(s.name)parts.push(s.name+(s.rarity?' <span style="font-size:.5rem;color:#94a3b8;">['+s.rarity+']</span>':''));});
  return parts.join('<span style="color:#475569;margin:0 2px;">·</span>');
}
function getCostumeList(ch){
  if(!ch||!ch.c)return[];
  return ch.c.map(function(c,i){return{idx:i,name:c.n||'Costume '+(i+1),rarity:c.ra||'R',slots:(c.s?c.s.length:0)+(c.sp1?2:0)+(c.sp2?2:0)||'?'};});
}
function getStyleList(ch){
  if(!ch||!ch.bs)return[];
  var list=[{idx:0,name:'Original',role:ch.role}];
  ch.bs.forEach(function(b,i){list.push({idx:i+1,name:b.n,role:b.t});});
  return list;
}
function getStyleRole(ch,si){
  if(!ch)return null;
  if(si>0&&ch.bs&&ch.bs[si-1])return ch.bs[si-1].t;
  return ch.role||null;
}
// Get display name from a tuning — joins all sub-effects
function tuningDisplayName(t){
  if(!t)return'';
  // Try top-level skillName
  if(t.skillName&&t.skillName.trim())return t.skillName.trim();
  // Collect all sub-effect names
  var names=[];
  if(t.subEffects&&t.subEffects.length){
    t.subEffects.forEach(function(se){
      if(typeof se==='object'&&se.skillName&&se.skillName.trim())names.push(se.skillName.trim());
      else if(typeof se==='string'){
        var clean=se.replace(/^Sub Effect \d+:\s*/,'').trim();
        if(clean)names.push(clean);
      }
    });
  }
  if(names.length)return names.join(' + ');
  return t.name||'';
}
// Analyze costumes — column-aware when a special role is preferred
function pickBestCostume(ch,goal,preferRarity,preferSpRole,preferStyleRole){
  if(!ch||!ch.c||!ch.c.length)return 0;
  var bestIdx=0,bestScore=-999;
  ch.c.forEach(function(cos,i){
    if(preferRarity&&cos.ra!==preferRarity)return;
    var score=0;
    // Determine which column the preferred special would go in
    var spCol=null; // null = no special, 'L' or 'R' = column
    if(preferSpRole){
      if(cos.sp1&&cos.sp1.r===preferSpRole)spCol='L';
      else if(cos.sp2&&cos.sp2.r===preferSpRole)spCol='R';
    }
    if(cos.s){
      cos.s.forEach(function(sl,idx){
        var r=sl.r||'Strike';
        var inSpCol=(spCol==='L'&&idx<5)||(spCol==='R'&&idx>=5);
        // Slots in the special's column get higher weight
        if(inSpCol&&preferSpRole){
          if(r==='Strike')score+=12;
          else if(r==='Technical')score+=8;
          else if(r==='Assault')score+=4;
          else if(r==='Rapid')score+=2;
          if(goal.damage>0.5){if(r==='Strike')score+=10;else if(r==='Technical')score+=5;}
        }else{
          if(r==='Strike')score+=4;
          else if(r==='Technical')score+=3;
          else if(r==='Assault')score+=2;
          else if(r==='Rapid')score+=1;
          if(goal.damage>0.5){if(r==='Strike')score+=7;else if(r==='Technical')score+=3;}
        }
        if(r===ch.role)score+=2;
        if(preferStyleRole&&r===preferStyleRole)score+=10;
        if(goal.defense>0.4&&(r==='Support'||r==='Assault'))score+=3;
        if(goal.mobility>0.4&&r==='Rapid')score+=10;
        if(goal.reload>0.4)score+=5;
        if(goal.gp>0.3&&r==='Support')score+=3;
      });
    }
    // Bonus for special slot roles matching the goal type, considering alignment
    if(cos.sp1||cos.sp2){
      var sa=function(slot,roles,prefAlign){
        if(!slot||!slot.r)return false;
        var ok=false;
        (Array.isArray(roles)?roles:[roles]).forEach(function(r){if(slot.r===r)ok=true;});
        if(!ok)return false;
        if(!prefAlign)return true;
        if(!slot.a)return true;
        return slot.a.toLowerCase()===prefAlign.toLowerCase();
      };
      // For defensive builds, prefer Support + Assault slots with hero alignment
      if(goal.defense>0.4){
        if(sa(cos.sp1,['Support','Assault'],'hero')||sa(cos.sp2,['Support','Assault'],'hero'))score+=10;
        if((sa(cos.sp1,'Support','hero')&&sa(cos.sp2,'Assault','hero'))||
           (sa(cos.sp1,'Assault','hero')&&sa(cos.sp2,'Support','hero')))score+=15;
      }
      // For damage builds, prefer Technical + Strike slots
      if(goal.damage>0.5){
        if(sa(cos.sp1,'Technical',null)||sa(cos.sp2,'Technical',null))score+=10;
        if(sa(cos.sp1,'Strike',null)||sa(cos.sp2,'Strike',null))score+=8;
      }
      // For mobility, prefer Rapid slots
      if(goal.mobility>0.4){
        if(sa(cos.sp1,'Rapid',null)||sa(cos.sp2,'Rapid',null))score+=10;
      }
    }
    if(preferSpRole&&spCol)score+=25;
    if(cos.sp1)score+=2;
    if(cos.sp2)score+=2;
    var rarityBonus={PUR:3,UR:2,SR:1,R:0};
    score+=(rarityBonus[cos.ra||'R']||0);
    if(score>bestScore){bestScore=score;bestIdx=i;}
  });
  return bestIdx;
}
function startBuildConversation(txt,lower,ch,styleIdx){
  // Clear ALL existing build state — no stale data survives
  coachMemory.buildState=null;
  coachMemory.lastGoal=null;
  // Fresh state with NO default character
  var state={phase:'gathering',char:null,styleIdx:0,cosIdx:0,goal:null,build:null,questions:[],qIdx:0,missingInfo:[],_rarityPref:null,_specialHint:null,_specialOverrides:null};
  // Character detection with fuzzy matching for typos
  var chs=window.CH||[];
  var bestChar=null,bestScore=0;
  // First pass: exact ID/name matches get priority — prefer LONGER matches (more specific)
  for(var ci=0;ci<chs.length;ci++){
    var c=chs[ci];
    var cn=c.n.toLowerCase(),cid=c.id.toLowerCase();
    var exactScore=0;
    if(lower.indexOf(cn)>=0)exactScore=cn.length*2;
    else if(lower.indexOf(cid)>=0)exactScore=cid.length*2;
    if(exactScore>bestScore){bestChar=c;bestScore=exactScore;}
  }
  // Second pass: partial and fuzzy if no exact match
  if(bestScore<999){
    for(var ci=0;ci<chs.length;ci++){
      var c=chs[ci];
      var cn=c.n.toLowerCase(),cid=c.id.toLowerCase();
      var matchScore=0;
      var parts=cn.split(' ');
      for(var pi=0;pi<parts.length;pi++){
        if(parts[pi].length>2&&lower.indexOf(parts[pi])>=0)matchScore+=parts[pi].length*2;
      }
      // Also check id parts (e.g. "ofa" from "izuku_ofa")
      var idParts=cid.split('_');
      for(var pi=0;pi<idParts.length;pi++){
        if(idParts[pi].length>2&&lower.indexOf(idParts[pi])>=0)matchScore+=idParts[pi].length*2;
      }
      // Fuzzy char-level match only if no partial match
      if(!matchScore){
        var raw=lower.replace(/[^a-z]/g,'');
        var cleanName=cn.replace(/[^a-z]/g,'');
        var cleanId=cid.replace(/[^a-z]/g,'');
        var mi=0,seq=0;
        for(var chi=0;chi<raw.length&&mi<cleanName.length;chi++){if(raw[chi]===cleanName[mi]){seq++;mi++;}}
        if(seq/cleanName.length>0.65)matchScore=Math.round(seq*1.5);
        mi=0;var seq2=0;
        for(var chi=0;chi<raw.length&&mi<cleanId.length;chi++){if(raw[chi]===cleanId[mi]){seq2++;mi++;}}
        if(seq2/cleanId.length>0.7)matchScore=Math.max(matchScore,Math.round(seq2*1.5));
      }
      if(c.bs)c.bs.forEach(function(b){var s=b.n.toLowerCase();if(lower.indexOf(s)>=0)matchScore+=5;});
      if(matchScore>bestScore){bestScore=matchScore;bestChar=c;}
    }
  }
  // Third pass: alias matching (e.g. "deku" → izuku, "rapid deku" → izuku_ofa)
  if(!bestChar||bestScore<20){
    // Check for role+alias combos first (e.g. "rapid deku" → OFA)
    var roleFound=null;
    ['strike','rapid','assault','technical','support','tech'].forEach(function(r){
      if(lower.indexOf(r)>=0)roleFound=r;
    });
    for(var alias in CHAR_ALIAS){
      if(lower.indexOf(alias)>=0){
        var cid=CHAR_ALIAS[alias];
        // If role is specified, check for a variant character
        var targetId=cid;
        if(roleFound){
          // Check if base character has this role as a style
          var baseCh=chs.find(function(c){return c.id===cid;});
          if(baseCh&&baseCh.bs){
            for(var si=0;si<baseCh.bs.length;si++){
              if(baseCh.bs[si].t.toLowerCase()===roleFound){
                targetId=cid; // base character with the right style, keep it
                break;
              }
            }
          }
          // Check for variant character (e.g. "izuku_ofa" for "rapid deku")
          if(targetId===cid){
            for(var vi=0;vi<chs.length;vi++){
              if(chs[vi].id!==cid&&chs[vi].id.indexOf(cid)===0){
                var vRole=(chs[vi].role||'').toLowerCase();
                if(vRole===roleFound){targetId=chs[vi].id;break;}
              }
            }
          }
        }
        for(var ci=0;ci<chs.length;ci++){
          if(chs[ci].id===targetId){
            var sc=alias.length*3;
            if(sc>bestScore){bestScore=sc;bestChar=chs[ci];console.log('ALIAS MATCH:',alias,(targetId!==cid?'→ variant '+targetId:''),'→',chs[ci].n);}
            break;
          }
        }
      }
    }
  }
  // Fourth pass: scan chat history for character mentions (e.g. "make a build for him")
  if(!bestChar&&coachMemory.history&&coachMemory.history.length){
    var allChatText=coachMemory.history.map(function(h){return h.content||'';}).join(' ').toLowerCase();
    for(var ci=0;ci<chs.length;ci++){
      var c=chs[ci];
      var cn=c.n.toLowerCase();
      if(allChatText.indexOf(cn)>=0||allChatText.indexOf(c.id)>=0){
        var sc=20;
        var mentions=0;
        coachMemory.history.forEach(function(h){
          var hc=(h.content||'').toLowerCase();
          if(hc.indexOf(cn)>=0||hc.indexOf(c.id)>=0)mentions++;
        });
        sc+=mentions*5;
        if(sc>bestScore){bestScore=sc;bestChar=c;console.log('HISTORY MATCH:',c.n,'mentions:',mentions);}
      }
    }
  }
  if(bestChar){state.char=bestChar;console.log('CHAR DETECTED:',bestChar.n,bestChar.id,'score:',bestScore);}
  // If no character detected in text, ask instead of assuming current
  if(!bestChar)state.missingInfo.push('character');
  // Style detection — only if character is known (flexible spacing/punctuation matching)
  if(state.char&&state.char.bs&&state.char.bs.length){
    var cleanLower=lower.replace(/[^a-z0-9]/g,'');
    for(var si=0;si<state.char.bs.length;si++){
      var sn=state.char.bs[si].n.toLowerCase().replace(/[^a-z0-9]/g,'');
      if(cleanLower.indexOf(sn)>=0){state.styleIdx=si+1;break;}
    }
    // Also check role keywords (e.g. "strike aizawa" → Flow Runner [Strike])
    if(!state.styleIdx){
      var skMap={'strike':'Strike','rapid':'Rapid','assault':'Assault','technical':'Technical','support':'Support','tech':'Technical'};
      for(var sk in skMap){
        if(lower.indexOf(sk)>=0){
          for(var si=0;si<state.char.bs.length;si++){
            if(state.char.bs[si].t.toLowerCase()===sk||state.char.bs[si].t===skMap[sk]){
              state.styleIdx=si+1;break;
            }
          }
          if(state.styleIdx)break;
        }
      }
    }
  }
  // Goal parsing
  state.goal=goalFromText(txt);
  state.goal.display=state.goal.display||state.goal.desc;
  state.goal._fromText=txt;
  // Determine missing info — DON'T reset, build on top of prior detections
  // Check style ambiguity — if character has multiple styles and we couldn't determine
  if(state.char&&state.char.bs&&state.char.bs.length>0){
    var styleGuessed=false;
    for(var si=0;si<state.char.bs.length;si++){
      if(lower.indexOf(state.char.bs[si].n.toLowerCase())>=0){styleGuessed=true;break;}
    }
    // Also check for role keywords in the text
    if(!styleGuessed){
      var roleKeywords={'strike':'Strike','rapid':'Rapid','assault':'Assault','technical':'Technical','support':'Support','tech':'Technical','tank':'Defense','dmg':'Damage'};
      for(var kw in roleKeywords){
        if(lower.indexOf(kw)>=0){
          // If the keyword matches the base role, use style 0 (original)
          if(roleKeywords[kw]===state.char.role){styleGuessed=true;break;}
          // If it matches an alternate style's role
          for(var si=0;si<state.char.bs.length;si++){
            if(state.char.bs[si].t.toLowerCase()===kw||state.char.bs[si].t.toLowerCase().indexOf(kw)>=0){
              state.styleIdx=si+1;styleGuessed=true;break;
            }
          }
          if(styleGuessed)break;
        }
      }
    }
    if(!styleGuessed&&state.char.bs.length>=1)state.missingInfo.push('style');
  }
  // Check costume rarity — ask if not specified in text
  var rarityPref=null;
  var rm=lower.match(/\b(R|SR|UR|PUR)\b/i);
  if(rm)rarityPref=rm[1].toUpperCase();
  if(/highest.?rarity|best.?costume|legendary/i.test(lower))rarityPref='PUR';
  if(/ur\b|epic/i.test(lower))rarityPref='UR';
  if(/sr\b|rare/i.test(lower))rarityPref='SR';
  if(/common|budget|cheap|\br\b/i.test(lower))rarityPref='R';
  if(!rarityPref&&state.char){
    var rarities={};
    var hasC=!!(state.char&&state.char.c);
    if(hasC)state.char.c.forEach(function(c){rarities[c.ra||'R']=true;});
    console.log('RARITY CHECK: char='+(state.char?state.char.id:'NULL')+', hasC='+hasC+', rarities='+JSON.stringify(Object.keys(rarities))+', count='+Object.keys(rarities).length+', missingInfo='+JSON.stringify(state.missingInfo));
    if(hasC&&Object.keys(rarities).length>1)state.missingInfo.push('rarity');
  }
  state._rarityPref=rarityPref;
  // Detect special tuning hint from text (stored at state level, survives goal re-parse)
  state._specialHint=null;
  if(/fixer/i.test(txt))state._specialHint='Fixer';
  else if(/wall.?runner|wall.?run/i.test(txt))state._specialHint='Wall Runner';
  else if(/space.?hop/i.test(txt))state._specialHint='Space Hop';
  else if(/willpower/i.test(txt))state._specialHint='Willpower';
  else if(/hp.?sucker|hp.?suck/i.test(txt))state._specialHint='HP Sucker';
  else if(/revenge.?strike|revenge.?assault|revenge.?rapid|revenge.?techn|revenge.?support/i.test(txt))state._specialHint='Revenge Strike';
  else if(/kota.?finder|kota/i.test(txt))state._specialHint='Kota Finder';
  if(state.char&&(rarityPref||!state.missingInfo.length||state.missingInfo[state.missingInfo.length-1]!=='rarity')){
    state.cosIdx=pickBestCostume(state.char,state.goal,rarityPref,null,getStyleRole(state.char,state.styleIdx));
  }
  // Check goal — if it's generic "balanced", ask for more specific
  if(state.char&&state.goal.desc==='balanced'&&!state.goal.focus)state.missingInfo.push('goal');
  return state;
}
function askNextQuestion(state){
  if(!state||!state.missingInfo||state.qIdx>=state.missingInfo.length){
    // All info gathered — generate the build
    state.phase='ready';
    return null;
  }
  var info=state.missingInfo[state.qIdx];
  var msg='';
  if(info==='character'){
    var allChars=window.CH||[];
    msg='Which character?<br><br>';
    var shown=0;
    allChars.forEach(function(c){
      if(shown>=15)return;
      var cn=c.n.toLowerCase();
      var match=lower.indexOf(cn)>=0;
      if(!match)cn.split(' ').forEach(function(p){if(p.length>2&&lower.indexOf(p)>=0)match=true;});
      if(match||allChars.length<=15){
        msg+='<span style="font-size:.65rem;color:#94a3b8;">&nbsp;&nbsp;· </span>'+esc(c.n)+'<br>';
        shown++;
      }
    });
    if(shown>=15)msg+='<span style="font-size:.6rem;color:#475569;">&nbsp;&nbsp;...type a character name</span>';
    msg+='<br><span style="font-size:.65rem;color:#64748b;">Type a character name!</span>';
  }else if(info==='style'){
    var slist=getStyleList(state.char);
    msg='Which style for <b>'+esc(state.char.n)+'</b>?<br>';
    slist.forEach(function(s){msg+='<span style="font-size:.65rem;color:#94a3b8;">&nbsp;&nbsp;· </span>'+esc(s.name)+' <span style="font-size:.6rem;color:'+(s.role==='Strike'?'#ef4444':s.role==='Assault'?'#f59e0b':s.role==='Rapid'?'#22c55e':s.role==='Technical'?'#a855f7':'#3b82f6')+';">['+s.role+']</span><br>';});
    msg+='<br><span style="font-size:.65rem;color:#64748b;">Just type the style name!</span>';
  }else if(info==='rarity'){
    var rarities=[];var seen={};
    if(state.char.c)state.char.c.forEach(function(c){var r=c.ra||'R';if(!seen[r]){seen[r]=true;rarities.push(r);}});
    msg='What rarity costume?<br><br>';
    rarities.sort(function(a,b){var o={PUR:4,UR:3,SR:2,R:1};return (o[b]||0)-(o[a]||0);});
    rarities.forEach(function(r){msg+='<span style="font-size:.65rem;color:#94a3b8;">&nbsp;&nbsp;· </span>'+r+'<br>';});
    msg+='<br><span style="font-size:.65rem;color:#64748b;">Type the rarity (R/SR/UR/PUR) or "auto" for best fit.</span>';
  }else if(info==='goal'){
    msg='What playstyle are you looking for?<br><br>';
    buildGoals.forEach(function(g){msg+='<span style="font-size:.65rem;color:#94a3b8;">&nbsp;&nbsp;'+(g.id==='balanced'?'<b style="color:#f5c800;">⚖️ Balanced (default)</b>':g.id==='damage'?'🔥 Max Damage':g.id==='defensive'?'🛡️ Defensive':g.id==='mobility'?'💨 Mobility':g.id==='reload'?'🔄 Reload':g.id==='support'?'💚 Support':'')+'</span><br>';});
    msg+='<br><span style="font-size:.65rem;color:#64748b;">Or specify a skill focus: "alpha", "beta", "gamma", "melee".</span>';
  }
  coachMemory.buildState=state;
  return msg;
}
function processBuildAnswer(txt,lower){
  var state=coachMemory.buildState;
  if(!state||state.phase==='idle'||state.phase==='ready')return false;
  var info=state.missingInfo[state.qIdx];
  var answered=false;
  if(info==='character'){
    var allChars=window.CH||[];
    // Try to find the character from the answer
    var bestMatch=null,bestScore=0;
    allChars.forEach(function(c){
      var cn=c.n.toLowerCase();
      var sc=0;
      if(cn.indexOf(lower)>=0)sc=lower.length*2;
      else{cn.split(' ').forEach(function(p){if(p.length>2&&lower.indexOf(p)>=0)sc+=p.length;});}
      if(sc>bestScore){bestScore=sc;bestMatch=c;}
    });
    if(bestMatch&&bestScore>0){state.char=bestMatch;answered=true;}
    else{addCoachMsg('Sorry, didn\'t catch that character. Try typing the name!',false);return true;}
  }else if(info==='style'){
    var slist=getStyleList(state.char);
    for(var i=0;i<slist.length;i++){
      if(lower.indexOf(slist[i].name.toLowerCase())>=0||lower.indexOf(slist[i].role.toLowerCase())>=0){
        state.styleIdx=slist[i].idx;answered=true;break;
      }
    }
    if(!answered){
      // Try matching by role name
      for(var i=0;i<buildRoles.length;i++){
        if(lower.indexOf(buildRoles[i].toLowerCase())>=0){
          // Find first style with this role
          for(var j=0;j<slist.length;j++){
            if(slist[j].role===buildRoles[i]){state.styleIdx=slist[j].idx;answered=true;break;}
          }
          if(answered)break;
        }
      }
    }
    if(!answered){addCoachMsg('Sorry, didn\'t catch that style. Try: original, '+(state.char.bs?state.char.bs.map(function(b){return b.n;}).join(', '):''),false);return true;}
  }else if(info==='rarity'){
    var rarityPref=null;
    var rml=lower.match(/\b(R|SR|UR|PUR)\b/i);
    if(rml)rarityPref=rml[1].toUpperCase();
    if(/auto|best|default/i.test(lower))rarityPref=null;
    if(rarityPref||/auto|best/i.test(lower)){answered=true;}
    state._rarityPref=rarityPref;
    state.cosIdx=pickBestCostume(state.char,state.goal,rarityPref,null,getStyleRole(state.char,state.styleIdx));
  }else if(info==='goal'){
    var newGoal=goalFromText(txt);
    if(newGoal.desc!=='balanced'||newGoal.focus){
      state.goal=newGoal;answered=true;
    }else{
      // Check if they picked from the list
      for(var i=0;i<buildGoals.length;i++){
        if(lower.indexOf(buildGoals[i].id)>=0){state.goal=goalFromText(buildGoals[i].id);answered=true;break;}
      }
    }
    if(!answered){state.goal=goalFromText('balanced');answered=true;} // Default
  }
  state.qIdx++;
  // Check if we have all info
  var nextQ=askNextQuestion(state);
  if(nextQ){
    coachMemory.buildState=state;
    addCoachMsg(nextQ,false);
  }else{
    // All info gathered — check if we should ask about specials
    // Don't pick costume yet — let special choice or generate decide
    console.log('BUILD STATE:',JSON.stringify({char:state.char?state.char.n:'?',style:state.styleIdx,rarity:state._rarityPref,goal:state.goal?state.goal.desc:'?',focus:state.goal?state.goal.focus:'?',special:state._specialHint}));
    var sch=state.char;var scos=sch.c&&sch.c[state.cosIdx];
    if(!state._specialsShown&&sch.c&&sch.c.length){
      // Check if ANY costume for this character has special slots
      var hasSpSlots=false;
      sch.c.forEach(function(c){if(c.sp1||c.sp2)hasSpSlots=true;});
      if(hasSpSlots){
        state._specialsShown=true;
        // Pick a decent costume for previewing specials
        if(state.cosIdx===0)state.cosIdx=pickBestCostume(state.char,state.goal,state._rarityPref,null,getStyleRole(state.char,state.styleIdx));
        coachMemory.buildState=state;
        showSpecialOptions(state);
        return;
      }
    }
    // No specials to pick — generate with current costume
    coachMemory.buildState=state;
    try{generateAndShowBuild(state);}catch(e){console.warn('build gen error:',e);addCoachMsg('Build error: '+e.message,false);}
  }
  return true;
}
function generateAndShowBuild(state){
  console.log('GENERATE START:',JSON.stringify({style:state.styleIdx,char:state.char?state.char.id:'?',cosIdx:state.cosIdx,rarity:state._rarityPref,goal:state.goal?state.goal.desc:'?',focus:state.goal?state.goal.focus:'?',special:state._specialHint}));
  try{
  // Auto-pick costume if not yet set
  if(!state.cosIdx&&state.cosIdx!==0)state.cosIdx=0;
  var cosValid=window.ST&&window.ST.cosIdx!==undefined&&state.cosIdx!==null&&state.char.c&&state.char.c[state.cosIdx];
  if(!cosValid){
    // If special is hinted, pass its role for column-aware costume scoring
    var spRoleHint=null;
    if(state._specialHint){
      // Look up the special's role from all costumes' special options
      var sch=state.char;
      if(sch&&sch.c){
        for(var sci=0;sci<sch.c.length&&!spRoleHint;sci++){
          var sc=sch.c[sci];if(!sc)continue;
          [sc.sp1,sc.sp2].forEach(function(sp){
            if(!sp||!sp.r||spRoleHint)return;
            try{
              var sopts=window.specialOptions(sp.r,window.CH_NUM[sch.id],'',null);
              sopts.forEach(function(so){
                if(spRoleHint)return;
                if((so.skillName||so.name||'').toLowerCase().indexOf(state._specialHint.toLowerCase())>=0)spRoleHint=sp.r;
              });
            }catch(e){}
          });
        }
      }
    }
    state.cosIdx=pickBestCostume(state.char,state.goal,state._rarityPref,spRoleHint,getStyleRole(state.char,state.styleIdx));
  }
  var goal=state.goal;
  var ch=state.char;
  var si=state.styleIdx;
  goal._fromText='';
  coachMemory.lastGoal=goal;
  // Show scanning animation
  var cos=ch.c&&ch.c[state.cosIdx];
  var cosName=cos?cos.n+' ('+(cos.ra||'R')+')':'Unknown';
  // Build slot analysis for the picked costume
  var slotBreakdown={};
  if(cos&&cos.s){
    cos.s.forEach(function(sl){
      var r=sl.r||'Strike';
      slotBreakdown[r]=(slotBreakdown[r]||0)+1;
    });
  }
  var slotSummary=Object.keys(slotBreakdown).map(function(r){return r+' x'+slotBreakdown[r];}).join(', ');
  // Count total tunings available across all slots
  var totalOpts=0;
  ['left','right'].forEach(function(side){
    var defs=window.buildSlotDefs(ch,side);
    defs.forEach(function(def){
      var opts=window.normalOptions(def.r,def.a,window.CH_NUM[ch.id],'');
      totalOpts+=opts.length;
    });
  });
  // Show analysis with reasoning
  // Build a simple score explanation
  var leftSlots=[],rightSlots=[];
  if(cos&&cos.s){
    for(var _si=0;_si<5;_si++)leftSlots.push((cos.s[_si]&&cos.s[_si].r)||'Strike');
    for(var _si=5;_si<10;_si++)rightSlots.push((cos.s[_si]&&cos.s[_si].r)||'Strike');
  }
  var leftDmg=leftSlots.filter(function(r){return r==='Strike'||r==='Technical';}).length;
  var rightDmg=rightSlots.filter(function(r){return r==='Strike'||r==='Technical';}).length;
  var spInfo='';
  if(cos&&cos.sp1)spInfo+='L:'+cos.sp1.r+' ';
  if(cos&&cos.sp2)spInfo+='R:'+cos.sp2.r;
  var reasoning='<b>'+esc(cosName)+'</b> — '+slotSummary;
  reasoning+='<br>Left col: '+leftDmg+' dmg slots | Right col: '+rightDmg+' dmg slots';
  if(spInfo)reasoning+=' | Specials: '+spInfo;
  var analysisMsg='🔍 <b>Scanning '+ch.n+' costumes...</b><br><span style="color:#64748b;font-size:.6rem;">'+reasoning+'<br>Scanned '+totalOpts+' tunings for <b>'+esc(goal.display||goal.desc)+'</b>.</span>';
  addCoachMsg(analysisMsg,false);
  
  // Generate — pass reservedTids from special overrides to prevent duplicates
  var genReserved={};
  if(state._specialOverrides){
    state._specialOverrides.forEach(function(ov){if(ov.tid)genReserved[ov.tid]=true;});
  }
  var build=generateBuild(ch,si,goal,state.cosIdx,Object.keys(genReserved).length?genReserved:null);
  // Reapply any special overrides (e.g. Fixer chosen by user)
  if(state._specialOverrides){
    var usedOverrideTids={};
    state._specialOverrides.forEach(function(ov){
      if(build&&build.specs&&build.specs[ov.idx]){
        // Skip if this tid is already applied to another slot (dedup)
        if(usedOverrideTids[ov.tid])return;
        build.specs[ov.idx].tid=ov.tid;
        build.specs[ov.idx].name=ov.name;
        build.specs[ov.idx].lv=SPECIAL_MAX_LV;
        usedOverrideTids[ov.tid]=true;
      }
    });
  }
  state.build=build;
  state.phase='ready';
  if(!build||!build.left){addCoachMsg('⚠️ Build generation failed — no valid tunings found.',false);return;}
  applyBuild(build);
  // Build response
  var msg='';
  var slist=getStyleList(ch);
  console.log('STYLE DEBUG: si='+si+', slist='+JSON.stringify(slist.map(function(s){return s.name;}))+', styleName='+(slist.length>si?slist[si].name:'FALLBACK'));
  var styleName=slist.length>si?slist[si].name:'Original';
  msg+='<b style="color:#f5c800;">🔧 Mei\'s Prototype Build</b><br><br>';
  msg+='<span style="color:#94a3b8;">Character:</span> '+esc(ch.n)+'<br>';
  msg+='<span style="color:#94a3b8;">Style:</span> '+esc(styleName)+'<br>';
  msg+='<span style="color:#94a3b8;">Costume:</span> '+esc(cosName)+' <span style="font-size:.55rem;color:#64748b;">('+slotSummary+')</span><br>';
  msg+='<span style="color:#94a3b8;">Focus:</span> '+esc(goal.display||goal.desc)+'<br><br>';
  // Tunings by slot
  msg+='<b style="color:#f5c800;">Fit Tunings</b><br>';
  var slotIdx=1;
  build.left.forEach(function(s){
    var rarTag=s.rarity?' <span style="font-size:.5rem;color:#94a3b8;">['+s.rarity+']</span>':'';
    msg+='<span style="font-size:.65rem;color:#64748b;">Slot '+slotIdx+':</span> '+(s.name?esc(s.name)+rarTag:'<span style="color:#475569;">Empty</span>')+'<br>';
    slotIdx++;
  });
  build.right.forEach(function(s){
    var rarTag=s.rarity?' <span style="font-size:.5rem;color:#94a3b8;">['+s.rarity+']</span>':'';
    msg+='<span style="font-size:.65rem;color:#64748b;">Slot '+slotIdx+':</span> '+(s.name?esc(s.name)+rarTag:'<span style="color:#475569;">Empty</span>')+'<br>';
    slotIdx++;
  });
  // Specials with reasoning
  var sNames=build.specs.filter(function(s){return s.name&&s.name!=='Locked';}).map(function(s){return s.name;});
  if(sNames.length){
    msg+='<br><b style="color:#a855f7;">✦ Specials</b><br>';
    sNames.forEach(function(sn){
      msg+='<span style="color:#c084fc;">▸</span> '+esc(sn)+'<br>';
    });
  }
  // Explanation — derived from actual tunings, not hardcoded
  var exp='';
  var dmgCount=0,defCount=0,relCount=0,mobCount=0;
  var alphaCount=0,betaCount=0,gammaCount=0;
  build.left.concat(build.right).forEach(function(s){if(!s.tid)return;
    var name=(s.name||'').toLowerCase();
    if(/attack|power|damage|alpha|beta|gamma|melee/.test(name))dmgCount++;
    if(/hp|defense|guard|shield|survive/.test(name))defCount++;
    if(/reload|cooldown|ammo|replenish/.test(name))relCount++;
    if(/dash|movement|speed|mobility|jump/.test(name))mobCount++;
    if(/alpha|α/.test(name))alphaCount++;
    if(/beta|β/.test(name))betaCount++;
    if(/gamma|γ/.test(name))gammaCount++;
  });
  var total=dmgCount+defCount+relCount+mobCount||1;
  var dmgPct=Math.round(dmgCount/total*100);
  var defPct=Math.round(defCount/total*100);
  // Count costume damage slots vs what was filled
  var cosSlots=0;var cosSlotTypes={};
  if(cos&&cos.s){cos.s.forEach(function(sl){var r=sl.r||'';if(r==='Strike'||r==='Technical')cosSlots++;cosSlotTypes[r]=(cosSlotTypes[r]||0)+1;});}
  var forcedDef=Math.max(0,cosSlots-dmgCount);
  // Total special count
  var specCount=sNames.length;
  
  if(goal.focus&&goal.focus==='alpha'){
    exp='<b style="color:#f59e0b;">⚔️ Alpha Damage:</b> '+alphaCount+'/10<br>';
    exp+='<b style="color:#94a3b8;">🏷️ Build:</b> '+esc(goal.display||goal.desc)+'<br>';
    exp+='<b style="color:#94a3b8;">📊 Slots:</b> '+dmgCount+' offensive, '+defCount+' defensive'+(relCount?', '+relCount+' reload':'')+(mobCount?', '+mobCount+' mobility':'')+'<br>';
    if(forcedDef>0)exp+='<span style="color:#f59e0b;">⚠️</span> '+cosSlots+' dmg slots available, '+dmgCount+' filled ('+forcedDef+' forced to survival by slot restrictions).';
    else exp+='<span style="color:#22c55e;">✅</span> All damage-capable slots filled.';
  }else if(dmgPct>=60){
    exp='<b style="color:#f59e0b;">⚔️ Damage:</b> '+dmgPct+'% offensive<br>';
    if(forcedDef>0)exp+='<span style="color:#f59e0b;">⚠️</span> '+cosSlots+' dmg slots, '+forcedDef+' forced to survival.';
  }else{
    exp='<b style="color:#94a3b8;">📊</b> '+dmgPct+'% offense, '+defPct+'% defense'+(relCount?', '+relCount+' reload':'')+(mobCount?', '+mobCount+' mobility':'')+'<br>';
    if(forcedDef>0)exp+='<span style="color:#f59e0b;">⚠️</span> '+cosSlots+' dmg slots, '+forcedDef+' forced to survival.';
  }
  msg+='<br><span style="color:#4ade80;font-size:.65rem;">'+exp+'</span>';
  msg+='<br><br><span style="color:#64748b;font-size:.6rem;">Say "make it more defensive", "switch to alpha", "change special",<br>or "make me a PUR build" for different rarity!</span>';
  coachMemory.buildState=state;
  addCoachMsg(msg,false);
  }catch(e){console.warn('generateAndShowBuild error:',e,state);addCoachMsg('⚠️ Build error: '+e.message+'. Try again with fewer details.',false);}
}
function showSpecialOptions(state){
  if(!state||!state.char)return;
  var ch=state.char;
  // Collect ALL possible specials across ALL costumes for this rarity
  var allSpecials=[];var seenRoles={};
  var rarityFilter=state._rarityPref||null;
  ch.c.forEach(function(cos){
    if(rarityFilter&&cos.ra!==rarityFilter)return;
    [cos.sp1,cos.sp2].forEach(function(sp){
      if(!sp||!sp.r||sp.r==='/')return;
      var role=sp.r;
      if(seenRoles[role])return; // only list each role once
      seenRoles[role]=true;
      var al=sp.a||'';
      var opts=window.specialOptions(role,window.CH_NUM[ch.id],al,null);
      opts.forEach(function(o){
        var sn=tuningDisplayName(o);
        var roleTag=o.role?' <span style="font-size:.5rem;color:#64748b;">['+o.role+']</span>':'';
        allSpecials.push({name:sn,role:o.role||role,tag:roleTag,tid:o.id,slotRole:role,o:o});
      });
    });
  });
  // Deduplicate by tid
  var seen={};var unique=[];
  allSpecials.forEach(function(s){
    if(!seen[s.tid]){seen[s.tid]=true;unique.push(s);}
  });
  if(!unique.length){addCoachMsg('No special tunings available for this character.',false);return;}
  // Sort: damage specials first when goal is damage
  var damageSpecials=['fixer','hip hop','revenge strike','revenge assault','iron fist','embrittlement','hp sucker','willpower'];
  if(state.goal&&state.goal.damage>0.4){
    unique.sort(function(a,b){
      var aDmg=0,bDmg=0;
      damageSpecials.forEach(function(ds){if((a.name||'').toLowerCase().indexOf(ds)>=0)aDmg++;if((b.name||'').toLowerCase().indexOf(ds)>=0)bDmg++;});
      return bDmg-aDmg;
    });
  }
  // Auto-select if user mentioned a special in their initial request
  var autoSp=null;
  if(state._specialHint){
    var hint=state._specialHint.toLowerCase();
    unique.forEach(function(s){
      if((s.name||'').toLowerCase().indexOf(hint)>=0)autoSp=s;
    });
  }
  if(autoSp){
    // Auto-picked — show confirmation
    state._allSpecials=unique;
    state._autoSpecial=autoSp;
    state.phase='gathering';
    addCoachMsg('✅ Auto-selected <b>'+esc(autoSp.name)+'</b> special tuning.',false);
    processAutoSpecial(state,autoSp);
    return;
  }
  var msg='<b style="color:#a855f7;">✧ Choose Special Tunings (or type "auto")</b><br><br>';
  unique.slice(0,12).forEach(function(s){
    msg+='<span style="font-size:.65rem;color:#94a3b8;">&nbsp;&nbsp;▸ </span>'+esc(s.name)+s.tag+'<br>';
  });
  if(unique.length>12)msg+='<span style="font-size:.6rem;color:#475569;">&nbsp;&nbsp;...and '+(unique.length-12)+' more</span><br>';
  msg+='<br><span style="font-size:.65rem;color:#64748b;">Type a name to equip it, "auto" for best pick.</span>';
  state._allSpecials=unique;
  state.phase='choosing_special';
  coachMemory.buildState=state;
  addCoachMsg(msg,false);
}
function processAutoSpecial(state,bestSp){
  // Find the BEST costume with a special slot matching this tuning's role
  var ch=state.char;
  var bestCosIdx=0,bestCosScore=-999;
  for(var ci=0;ci<ch.c.length;ci++){
    var c=ch.c[ci];if(!c)continue;
    var rarityFilter=state._rarityPref;
    if(rarityFilter&&c.ra!==rarityFilter)continue;
    var leftMatch=c.sp1&&c.sp1.r===bestSp.slotRole;
    var rightMatch=c.sp2&&c.sp2.r===bestSp.slotRole;
    if(!leftMatch&&!rightMatch)continue;
    var sRole=getStyleRole(ch,state.styleIdx);
    var sc=0;
    if(c.s){
      var start=leftMatch?0:5;
      for(var si=start;si<start+5;si++){
        var sl=c.s[si];if(!sl)continue;
        var r=sl.r||'Strike';
        if(r==='Strike')sc+=9;else if(r==='Technical')sc+=6;
        else if(r==='Assault')sc+=3;else if(r==='Rapid')sc+=2;
        if(sRole&&r===sRole)sc+=8;
      }
      var oStart=leftMatch?5:0;
      for(var si=oStart;si<oStart+5;si++){
        var sl=c.s[si];if(!sl)continue;
        var r=sl.r||'Strike';
        if(r==='Strike'||r==='Technical')sc+=2;else if(r==='Assault')sc+=1;
      }
    }
    if(c.sp1)sc+=1;if(c.sp2)sc+=1;
    if(sc>bestCosScore){bestCosScore=sc;bestCosIdx=ci;}
  }
  state.cosIdx=bestCosIdx;
  var spSide=-1;
  var cos=ch.c[bestCosIdx];
  if(cos&&cos.sp1&&cos.sp1.r===bestSp.slotRole)spSide=0;
  else if(cos&&cos.sp2&&cos.sp2.r===bestSp.slotRole)spSide=1;
  var tmpGoal=state.goal||goalFromText('balanced');
  var tmpBuild=generateBuild(state.char,state.styleIdx,tmpGoal,bestCosIdx);
  if(tmpBuild&&tmpBuild.specs&&tmpBuild.specs[spSide]&&spSide>=0){
    tmpBuild.specs[spSide].tid=bestSp.tid;
    tmpBuild.specs[spSide].name=bestSp.name;
    tmpBuild.specs[spSide].lv=5;
  }
  state._specialOverrides=[];
  if(spSide>=0&&bestSp.tid){
    state._specialOverrides.push({idx:spSide,tid:bestSp.tid,name:bestSp.name});
  }
  state.build=tmpBuild;
  coachMemory.buildState=state;
  try{generateAndShowBuild(state);}catch(e){console.warn('build gen error:',e);addCoachMsg('Build error: '+e.message,false);}
}
function adjustBuild(txt,lower){
  var state=coachMemory.buildState;
  if(!state||!state.goal)return;
  var goal=JSON.parse(JSON.stringify(state.goal));
  if(/more defensive|more tank|more hp|more surviv/i.test(txt)){goal.defense=Math.min(1,goal.defense+0.25);goal.damage=Math.max(0,goal.damage-0.15);goal.desc='defensive';}
  else if(/more mobil|more speed|more dash/i.test(txt)){goal.mobility=Math.min(1,goal.mobility+0.25);goal.desc='mobility';}
  else if(/more reload|more uptime/i.test(txt)){goal.reload=Math.min(1,goal.reload+0.25);goal.desc='reload';}
  else if(/more dmg|more damage|more attack|more aggress/i.test(txt)){goal.damage=Math.min(1,goal.damage+0.25);goal.desc='max damage';}
  else if(/less defensive|less tank/i.test(txt)){goal.defense=Math.max(0,goal.defense-0.25);goal.desc='aggressive';}
  else if(/alpha/.test(txt)){goal.focus='alpha';}
  else if(/beta/.test(txt)){goal.focus='beta';}
  else if(/gamma/.test(txt)){goal.focus='gamma';}
  goal.display=(goal.focus||'')+' '+(goal.desc||'');
  state.goal=goal;
  coachMemory.lastGoal=goal;
  generateAndShowBuild(state);
}

// Answer post-build questions from actual build data, not Groq
function answerFromBuild(state,lower){
  var b=state.build;if(!b)return null;
  var ch=state.char;var goal=state.goal;
  var tunings=(b.left||[]).concat(b.right||[]);
  // Count categories
  var dmg=0,def=0,rel=0,mob=0;
  tunings.forEach(function(s){var n=(s.name||'').toLowerCase();
    if(/attack|power|damage|alpha|beta|gamma|melee/.test(n))dmg++;
    else if(/hp|defense|guard|shield|survive/.test(n))def++;
    else if(/reload|cooldown|ammo/.test(n))rel++;
    else if(/dash|movement|speed|mobility|jump/.test(n))mob++;
  });
  var total=dmg+def+rel+mob||1;
  var spNames=(b.specs||[]).filter(function(s){return s.name&&s.name!=='Locked';}).map(function(s){return s.name;});
  var slist=getStyleList(ch);
  var styleName=slist.length>state.styleIdx?slist[state.styleIdx].name:'Original';
  
  // Route by question type
  if(/why (this|the) build|explain this build|tell me about/i.test(lower)){
    return'<span style="color:#4ade80;">💬</span> This <b>'+esc(state.goal.display||'build')+'</b> build for <b>'+esc(ch.n)+'</b> ('+esc(styleName)+') uses '+(spNames.length?'<b>'+esc(spNames.join(', '))+'</b> specials. ':'')+'Offensive tunings: <b>'+dmg+'/'+total+'</b> ('+Math.round(dmg/total*100)+'%). '+(def>0?'Defensive: '+Math.round(def/total*100)+'%. ':'')+(rel>0?'Reload: '+Math.round(rel/total*100)+'%. ':'')+'.';
  }
  if(/more damage|more dmg|increase damage|max dmg/i.test(lower)){
    if(dmg/total>=0.6)return'<span style="color:#4ade80;">💬</span> This build is already '+(Math.round(dmg/total*100))+'% offensive — swapping defensive tunings for damage could help, but slot restrictions may limit options.';
    return'<span style="color:#4ade80;">💬</span> Currently '+Math.round(dmg/total*100)+'% offensive. To push higher, prioritize Attack Power+ and skill-specific damage over HP/defense.';
  }
  if(/more defense|more hp|surviv|tank/i.test(lower)){
    if(def/total>=0.4)return'<span style="color:#4ade80;">💬</span> Already '+(Math.round(def/total*100))+'% defensive. Should hold up well in fights.';
    return'<span style="color:#4ade80;">💬</span> Currently '+Math.round(def/total*100)+'% defensive. Adding HP+/GP+ tunings would help survivability.';
  }
  if(/alpha|beta|gamma|melee/i.test(lower)){
    var skill='';if(/alpha/i.test(lower))skill='Alpha';else if(/beta/i.test(lower))skill='Beta';else if(/gamma/i.test(lower))skill='Gamma';else skill='Melee';
    var count=0;tunings.forEach(function(s){if((s.name||'').toLowerCase().indexOf(skill.toLowerCase())>=0)count++;});
    if(count>0)return'<span style="color:#4ade80;">💬</span> This build has <b>'+count+'</b> '+skill+' tuning'+(count>1?'s':'')+'. '+(count>=2?'Strong focus!':'Decent investment.');
    return'<span style="color:#4ade80;">💬</span> No specific '+skill+' tunings in this build. The optimizer may not have found suitable options for your slot roles.';
  }
  if(/special|fixer/i.test(lower)){
    return spNames.length?'<span style="color:#4ade80;">💬</span> Specials equipped: <b>'+esc(spNames.join(', '))+'</b>. The Fixer special boosts tunings in its column.':'No specials equipped.';
  }
  // Default
  return'<span style="color:#4ade80;">💬</span> This <b>'+esc(goal.display||'build')+'</b> build has '+dmg+' offensive, '+def+' defensive, '+rel+' reload, '+mob+' mobility tunings. Say "explain this build" for details.';
}function processCoach(txt){
  coachStop();
  try{
    var lower=txt.toLowerCase().trim();
  var ch=window.gc();
  
  // Check if we're in an active build conversation
  if(coachMemory.buildState){
    if(coachMemory.buildState.phase==='gathering'&&processBuildAnswer(txt,lower))return;
    // Handle special tuning selection
    if(coachMemory.buildState.phase==='choosing_special'){
      if(/auto|keep|default|yes|done|ready/i.test(lower)){
        // Auto-pick: search all costumes for the best goal-matched special, then pick costume
        var bs=coachMemory.buildState;
        if(bs&&bs.char){
          var g=bs.goal;
          var priorityList=null;
          if(g&&g.damage>0.5)priorityList=SPEC_PRIORITY.damage;
          else if(g&&g.defense>0.4)priorityList=SPEC_PRIORITY.defense;
          else if(g&&g.mobility>0.4)priorityList=SPEC_PRIORITY.mobility;
          else if(g&&g.reload>0.4)priorityList=SPEC_PRIORITY.reload;
          else if(g&&g.gp>0.3)priorityList=SPEC_PRIORITY.support;
          if(!priorityList)priorityList=SPEC_PRIORITY.damage; // default
          // Score each costume by how many top priority specials it can equip
          var bestCosIdx=-1,bestCosScore=-999;
          for(var ci=0;ci<bs.char.c.length;ci++){
            var c=bs.char.c[ci];if(!c)continue;
            var rar=bs._rarityPref;if(rar&&c.ra!==rar)continue;
            // Count how many of the top 5 priority specials each slot can support
            var slotMatches=[0,0];
            var hasTopSp=[false,false];
            var allSt=window.SPECIAL_TUNING||[];
            [c.sp1,c.sp2].forEach(function(sp,si){
              if(!sp||!sp.r)return;
              var bestSingle=0;
              allSt.forEach(function(so){
                var sn=(so.skillName||so.name||'').toLowerCase();
                if(so.role===sp.r){
                  if(!sp.a||!so.class||sp.a.toLowerCase()===so.class.toLowerCase()){
                    for(var pi=0;pi<priorityList.length&&pi<5;pi++){
                      if(sn.indexOf(priorityList[pi].n)>=0){
                        if(priorityList[pi].s>bestSingle){
                          bestSingle=priorityList[pi].s;
                          if(pi<2)hasTopSp[si]=true;
                        }
                      }
                    }
                  }
                }
              });
              slotMatches[si]=bestSingle;
            });
            if(!hasTopSp[0]&&!hasTopSp[1])continue;
            // Prefer costumes where BOTH slots can equip a top priority special
            var cosScore=slotMatches[0]+slotMatches[1];
            if(hasTopSp[0]&&hasTopSp[1])cosScore+=30; // big bonus for dual top-tier support
            else if(hasTopSp[0]||hasTopSp[1])cosScore+=10; // smaller bonus for one top-tier
            // Slot quality bonus
            if(c.s){
              for(var si2=0;si2<10;si2++){
                var sl=c.s[si2];if(!sl)continue;
                var r=sl.r||'';
                if(g&&g.defense>0.4&&(r==='Support'||r==='Assault'))cosScore+=2;
                if(g&&g.damage>0.5&&(r==='Strike'||r==='Technical'))cosScore+=2;
                if(g&&g.mobility>0.4&&(r==='Rapid'))cosScore+=3;
              }
            }
            if(cosScore>bestCosScore){bestCosScore=cosScore;bestCosIdx=ci;console.log('AUTO COSTUME:',c.n,'slotMatches='+JSON.stringify(slotMatches),'hasTopSp='+JSON.stringify(hasTopSp),'qualityBonus='+(cosScore-slotMatches[0]-slotMatches[1]-(hasTopSp[0]&&hasTopSp[1]?30:hasTopSp[0]||hasTopSp[1]?10:0)),'total='+cosScore);}
          }
          if(bestCosIdx>=0){
            // Found best costume — pick the highest-priority specials for its slots
            bs.cosIdx=bestCosIdx;
            var cos=bs.char.c[bestCosIdx];
            var overrides=[];
            var usedSpecialTids={};
            [cos.sp1,cos.sp2].forEach(function(sp,si){
              if(!sp||!sp.r)return;
              var bestForSlot=null,bestForSlotScore=0;
              allSt.forEach(function(so){
                if(usedSpecialTids[so.id]){console.log('DEDUP SKIP:',so.skillName,so.id);return;}
                if(so.role!==sp.r)return;
                if(sp.a&&so.class&&sp.a.toLowerCase()!==so.class.toLowerCase())return;
                var sn=(so.skillName||so.name||'').toLowerCase();
                for(var pi=0;pi<priorityList.length;pi++){
                  if(sn.indexOf(priorityList[pi].n)>=0){
                    var sc=priorityList[pi].s;
                    // Boost melee specials when focus is melee
                    if(g&&g.focus==='melee'){
                      if(sn.indexOf('embrittlement')>=0||sn.indexOf('trance blow')>=0)sc+=50;
                      else if(sn.indexOf('iron fist')>=0)sc+=30;
                      else if(sn.indexOf('perception')>=0)sc+=15;
                      else if(sn.indexOf('sisterly')>=0)sc+=10;
                    }
                    if(sc>bestForSlotScore){bestForSlotScore=sc;bestForSlot=so;break;}
                  }
                }
              });
              if(bestForSlot&&bestForSlot.id){
                  console.log('OVERRIDE SLOT',si,':',bestForSlot.skillName,bestForSlot.id,'score:',bestForSlotScore);
                  usedSpecialTids[bestForSlot.id]=true;
                  overrides.push({idx:si,tid:bestForSlot.id,name:bestForSlot.skillName||bestForSlot.name||'Special'});
                }
            });
            var tmpGoal=bs.goal||goalFromText('balanced');
            // Pass reservedTids so generateBuild doesn't pick already-reserved specials
            var tmpBuild=generateBuild(bs.char,bs.styleIdx,tmpGoal,bestCosIdx,usedSpecialTids);
            overrides.forEach(function(ov){
              if(tmpBuild&&tmpBuild.specs&&tmpBuild.specs[ov.idx]){
                tmpBuild.specs[ov.idx].tid=ov.tid;
                tmpBuild.specs[ov.idx].name=ov.name;
                tmpBuild.specs[ov.idx].lv=SPECIAL_MAX_LV;
              }
            });
            bs._specialOverrides=overrides;
            bs.build=tmpBuild;
            bs.phase='gathering';
            try{generateAndShowBuild(bs);}catch(e){console.warn('build gen error:',e);addCoachMsg('Build error: '+e.message,false);}
            return;
          }
        }
        // Fallback: generate with current costume's auto specials
        bs.phase='gathering';
        try{generateAndShowBuild(bs);}catch(e){console.warn('build gen error:',e);addCoachMsg('Build error: '+e.message,false);}
        return;
      }
      // Try to match the special name from the compiled list
      var specList=coachMemory.buildState._allSpecials||[];
      console.log('SPECIAL SEARCH: lower='+lower+', list size='+specList.length);
      if(specList.length<5)console.log('SPECIAL LIST:',JSON.stringify(specList.map(function(s){return s.name;})));
      var found=false;
      var bestSp=null;
      specList.forEach(function(s){
        if(found)return;
        var searchText=(s.name||'').toLowerCase()+' '+(s.role||'').toLowerCase();
        var idx=searchText.indexOf(lower);
        if(idx>=0){bestSp=s;found=true;console.log('MATCH: '+s.name+' at pos '+idx);}
      });
      // Fallback: search ALL specials from all costumes if not found in filtered list
      if(!found){
        var allCh=coachMemory.buildState.char;
        if(allCh&&allCh.c){
          for(var ci=0;ci<allCh.c.length&&!found;ci++){
            var c=allCh.c[ci];if(!c)continue;
            [c.sp1,c.sp2].forEach(function(sp,si){
              if(!sp||!sp.r||found)return;
              try{
                var opts=window.specialOptions(sp.r,window.CH_NUM[allCh.id],'',null);
                opts.forEach(function(o){
                  if(found)return;
                  var oname=tuningDisplayName(o).toLowerCase();
                  if(oname.indexOf(lower)>=0){
                    bestSp={name:tuningDisplayName(o),role:o.role||sp.r,tid:o.id,slotRole:sp.r,o:o};
                    found=true;
                    console.log('FALLBACK MATCH: '+oname+' from costume '+ci);
                  }
                });
              }catch(e){}
            });
          }
        }
      }
      if(found&&bestSp){
        var ch=coachMemory.buildState.char;
        // First check if current costume already supports this special
        var curCos=ch.c&&ch.c[coachMemory.buildState.cosIdx];
        var curLeft=curCos&&curCos.sp1&&curCos.sp1.r===bestSp.slotRole;
        var curRight=curCos&&curCos.sp2&&curCos.sp2.r===bestSp.slotRole;
        if(curLeft||curRight){
          // Current costume works — keep it, just swap the special
          var spSide=curLeft?0:1;
          var tmpGoal=coachMemory.buildState.goal||goalFromText('balanced');
          var tmpBuild=generateBuild(coachMemory.buildState.char,coachMemory.buildState.styleIdx,tmpGoal,coachMemory.buildState.cosIdx);
          if(tmpBuild&&tmpBuild.specs&&tmpBuild.specs[spSide]&&spSide>=0){
            tmpBuild.specs[spSide].tid=bestSp.tid;
            tmpBuild.specs[spSide].name=bestSp.name;
            tmpBuild.specs[spSide].lv=SPECIAL_MAX_LV;
          }
          coachMemory.buildState._specialOverrides=[{idx:spSide,tid:bestSp.tid,name:bestSp.name}];
          coachMemory.buildState.build=tmpBuild;
          try{generateAndShowBuild(coachMemory.buildState);}catch(e){console.warn('build gen error:',e);addCoachMsg('Build error: '+e.message,false);}
          return;
        }
        // Current costume doesn't support it — find the BEST costume
        var bestCosIdx=0,bestCosScore=-999;
        for(var ci=0;ci<ch.c.length;ci++){
          var c=ch.c[ci];if(!c)continue;
          var rarityFilter=coachMemory.buildState._rarityPref;
          if(rarityFilter&&c.ra!==rarityFilter)continue;
          // Check if this costume has a slot that supports this special's role
          var leftMatch=c.sp1&&c.sp1.r===bestSp.slotRole;
          var rightMatch=c.sp2&&c.sp2.r===bestSp.slotRole;
          if(!leftMatch&&!rightMatch)continue;
          // Style role bonus
          var sRole=getStyleRole(ch,coachMemory.buildState.styleIdx);
          // Score slots in the Fixer column (left=sp1, right=sp2) heavily
          var sc=0;
          if(c.s){
            var start=leftMatch?0:5;
            for(var si=start;si<start+5;si++){
              var sl=c.s[si];if(!sl)continue;
              var r=sl.r||'Strike';
              if(r==='Strike')sc+=9;else if(r==='Technical')sc+=6;
              else if(r==='Assault')sc+=3;else if(r==='Rapid')sc+=2;
              if(sRole&&r===sRole)sc+=8;
            }
            // Also add some score for the other column
            var oStart=leftMatch?5:0;
            for(var si=oStart;si<oStart+5;si++){
              var sl=c.s[si];if(!sl)continue;
              var r=sl.r||'Strike';
              if(r==='Strike'||r==='Technical')sc+=2;else if(r==='Assault')sc+=1;
            }
          }
          if(c.sp1)sc+=1;if(c.sp2)sc+=1;
          if(sc>bestCosScore){bestCosScore=sc;bestCosIdx=ci;}
        }
        // Always try first matching costume
        if(bestCosIdx===0&&ch.c.length)bestCosIdx=0;
        coachMemory.buildState.cosIdx=bestCosIdx;
        // Find which side has the matching slot
        var spSide=-1;
        var cos=ch.c[bestCosIdx];
        if(cos&&cos.sp1&&cos.sp1.r===bestSp.slotRole)spSide=0;
        else if(cos&&cos.sp2&&cos.sp2.r===bestSp.slotRole)spSide=1;
        // Generate build with the special pre-set
        var tmpGoal=coachMemory.buildState.goal||goalFromText('balanced');
        var tmpBuild=generateBuild(coachMemory.buildState.char,coachMemory.buildState.styleIdx,tmpGoal,bestCosIdx);
        if(tmpBuild&&tmpBuild.specs&&tmpBuild.specs[spSide]&&spSide>=0){
          tmpBuild.specs[spSide].tid=bestSp.tid;
          tmpBuild.specs[spSide].name=bestSp.name;
          tmpBuild.specs[spSide].lv=5;
        }
        coachMemory.buildState.build=tmpBuild;
        // Store any special override to reapply after fresh generate
        coachMemory.buildState._specialOverrides=[];
        if(spSide>=0&&bestSp.tid){
          coachMemory.buildState._specialOverrides.push({idx:spSide,tid:bestSp.tid,name:bestSp.name});
        }
        try{generateAndShowBuild(coachMemory.buildState);}catch(e){console.warn('build gen error:',e);addCoachMsg('Build error: '+e.message,false);}
        return;
      }
      addCoachMsg('Didn\'t recognize that special. Type "auto" to keep current, or check the list above.',false);
      return;
    }
  }
  // Handle "change special" for ready builds
  if(coachMemory.buildState&&coachMemory.buildState.phase==='ready'&&coachMemory.buildState.build){
    if(/change special|different special|pick special|switch special|specials/i.test(lower)){
      showSpecialOptions(coachMemory.buildState);
      return;
    }
    // Handle post-build follow-up questions and edits using actual build data
    // "make one with X" or "make it X" = edit current build's specials
    var editMatch=lower.match(/make (one|it) with (.+)/i)||lower.match(/^make it (.+)/i);
    if(editMatch){
      var specialNames=(editMatch[2]||editMatch[1]).toLowerCase();
      var specialNames=editMatch[1].toLowerCase();
      var bs=coachMemory.buildState;
      if(bs&&bs.build){
        // Parse requested specials (split by "and", ",")
        var requested=specialNames.split(/\band\b|[,]/).map(function(s){return s.trim();}).filter(function(s){return s.length>2;});
        console.log('EDIT SEARCH: requested=',JSON.stringify(requested));
        // Search ALL specials directly (not through specialOptions which filters used tids)
        var ch=bs.char;
        var foundSpecials=[];
        var allSpecials=window.SPECIAL_TUNING||[];
        requested.forEach(function(req){
          for(var si=0;si<allSpecials.length&&foundSpecials.length<2;si++){
            var so=allSpecials[si];
            var sn=(so.skillName||so.name||'').toLowerCase();
            if(sn.indexOf(req)>=0){
              // Find which costume+slot supports this special
              for(var ci=0;ci<ch.c.length&&foundSpecials.length<2;ci++){
                var c=ch.c[ci];if(!c)continue;
                var rar=bs._rarityPref;if(rar&&c.ra!==rar)continue;
                [c.sp1,c.sp2].forEach(function(sp,spi){
                  if(!sp||!sp.r||foundSpecials.length>=2)return;
                  if(sp.r===so.role){
                    // Check alignment compatibility
                    if(!sp.a||!so.class||sp.a.toLowerCase()===so.class.toLowerCase()){
                      var dup=false;
                      foundSpecials.forEach(function(fs){if(fs.id===so.id)dup=true;});
                      if(!dup)foundSpecials.push({id:so.id,name:so.skillName||so.name||'Special',slotRole:sp.r,cosIdx:ci});
                    }
                  }
                });
              }
            }
          }
        });
        if(foundSpecials.length>0){
          // Apply found specials to the current build
          // First check if current costume supports them
          var curCos=ch.c[bs.cosIdx];
          var overrides=[];
          var slotsUsed=0;
          foundSpecials.forEach(function(fs){
            if(slotsUsed>=2)return;
            var side=-1;
            if(curCos&&curCos.sp1&&curCos.sp1.r===fs.slotRole)side=0;
            else if(curCos&&curCos.sp2&&curCos.sp2.r===fs.slotRole)side=1;
            if(side>=0){overrides.push({idx:side,tid:fs.id,name:fs.name});slotsUsed++;}
          });
          // If not all fit in current costume, find a better one
          if(foundSpecials.length>slotsUsed){
            // Deep search all costumes for one that can equip ALL requested specials
            addCoachMsg('🔍 <b>Searching all costumes for '+(foundSpecials.map(function(fs){return fs.name;}).join(' + '))+'...</b>',false);
            var bestIdx=-1,bestMatch=0;
            for(var ci=0;ci<ch.c.length;ci++){
              var c=ch.c[ci];if(!c)continue;
              var rar=bs._rarityPref;if(rar&&c.ra!==rar)continue;
              // Actually verify each special can be equipped in this costume
              var canEquip=0;
              foundSpecials.forEach(function(fs){
                for(var si=0;si<2;si++){
                  var sp=si===0?c.sp1:c.sp2;
                  if(!sp||!sp.r)continue;
                  if(sp.r===fs.slotRole){
                    try{
                      var sopts=window.specialOptions(sp.r,window.CH_NUM[ch.id],sp.a||'',null);
                      for(var oi=0;oi<sopts.length;oi++){
                        if(sopts[oi].id===fs.id||(sopts[oi].skillName||'').toLowerCase().indexOf(fs.name.toLowerCase())>=0){
                          canEquip++;return;
                        }
                      }
                    }catch(e){}
                  }
                }
              });
              if(canEquip>bestMatch){bestMatch=canEquip;bestIdx=ci;console.log('DEEP SEARCH: costume['+ci+']='+c.n+' canEquip='+canEquip+'/'+foundSpecials.length);}
            }
            if(bestIdx>=0){
              bs.cosIdx=bestIdx;
              overrides=[];
              foundSpecials.forEach(function(fs){
                if(overrides.length>=2)return;
                var side=-1;
                var nc=ch.c[bestIdx];
                if(nc&&nc.sp1&&nc.sp1.r===fs.slotRole)side=0;
                else if(nc&&nc.sp2&&nc.sp2.r===fs.slotRole)side=1;
                if(side>=0){overrides.push({idx:side,tid:fs.id,name:fs.name});}
              });
            }
          }
          if(overrides.length>0){
            bs._specialOverrides=overrides;
            var tmpGoal=bs.goal||goalFromText('balanced');
            var editReserved={};
            overrides.forEach(function(ov){editReserved[ov.tid]=true;});
            var tmpBuild=generateBuild(bs.char,bs.styleIdx,tmpGoal,bs.cosIdx,editReserved);
            overrides.forEach(function(ov){
              if(tmpBuild&&tmpBuild.specs&&tmpBuild.specs[ov.idx]){
                tmpBuild.specs[ov.idx].tid=ov.tid;
                tmpBuild.specs[ov.idx].name=ov.name;
                tmpBuild.specs[ov.idx].lv=SPECIAL_MAX_LV;
              }
            });
            bs.build=tmpBuild;
            bs.phase='gathering';
            try{generateAndShowBuild(bs);}catch(e){console.warn('edit build error:',e);addCoachMsg('Build error: '+e.message,false);}
            return;
          }
        }
      }
      // Fall through to normal handling if edit fails
    }else if(lower.match(/(why|explain|how|what|tell|about|for|this|the build|my build|rate|review|thoughts?|opinion|look|good|bad|strong|weak)/i)&&
       lower.match(/(build|tuning|slot|damage|defense|reload|mobility|special|alpha|beta|gamma|melee|fixer|the build|my build|this|it)/i)){
      // "rate", "review", and "make" should use the full flow, not quick answer
      if(!lower.match(/^rate|^review|^make|make me|make a|make an/i)){
        var bs=coachMemory.buildState;
        if(bs&&bs.build){
          var reply=answerFromBuild(bs,lower);
          addCoachMsg(reply,false);
          return;
        }
      }
    }
    // Post-build small talk — keep it short and grounded, no Groq
    if(lower.match(/^(nice|good|great|awesome|perfect|sick|cool|thanks|thx|ty|ok|okay|got it|works|love it|bet|aight)/i)){
      addCoachMsg(pick(['Glad you like it! 🔥','Happy building!','Let me know if you want changes!','Tweak it anytime!']),false);
      return;
    }
  }
  
  // Universal short reactions (no API needed)
  if(lower.match(/^(lol|lmao|lmfao|haha|lolol|dead|ded|heh)/i)){addCoachMsg(pick(['😂','lol','heh']),false);return;}
  if(/^(thanks|thx|ty|appreciate)/i.test(lower)){addCoachMsg(pick(['Happy to help!','Anytime!','No problem!']),false);return;}
  if(/^(yo|sup|wsp|hey|hello|hi|howdy|what'?s up|wassup|ay|aye|oi)$/i.test(lower.trim())){
    addCoachMsg(ch?pick(['Hey! Got a build for me?','Oh hey! Whatcha working on?','Yo! Need help tuning?']):'Hey! Pick a character first!',false);return;
  }
  if(/^(hm|hmm|idk|dunno|maybe|cool|gotcha|aight|ight|true|fair|same|oof|rip|bet|fr|ngl|tbh|yeah|yep|ok|okay|kk|alright|sure|nah|nope|no)$/i.test(lower.trim())){
    addCoachMsg(pick(['Got it.','Fair.','Okay!','Alright.']),false);return;
  }
  
  // Build commands — include common typos
  // Fix common typos
  var fixedTypo=false;
  if(/^ake\b/i.test(txt)&&!fixedTypo){txt='m'+txt;lower='m'+lower;fixedTypo=true;}
  if(/^mak /i.test(txt)&&!fixedTypo){txt='make '+txt.substring(4);lower='make '+lower.substring(4);fixedTypo=true;}
  // Loose pattern: any "make/build/etc" anywhere + "build/set/etc" anywhere = build command
  var hasMake=/mak\w*|creat\w*|giv\w*|generat\w*|optim\w*|setup/i.test(lower);
  var hasBuild=/build|set.?up|load.?out|tuning/i.test(lower);
  // Only count as build INTENT if directed at the AI (me/us/imperative), not general talk
  var isBuildRequest=lower.match(/\b(mak|build|creat|generat|optim)\w*\b.*\b(m[ey]|u?s|a build|this)\b/i)||
                     lower.match(/\b(mak|creat|generat|optim)\w*\b.*\bbuild\b/i)||
                     lower.match(/\b(i need|i want|can you|could you|would you)\b.*\b(build|tuning|set)\b/i);
  var isBuildCmd=lower.match(/(analyze|review|check|rate|tate|rait|evaluate|how'?s|explain|breakdown|wrong|improv|fix|upgrade|swap|replace|what'?s (wrong|bad|the issue)) (my|this|the|it|build)/i)||
                  lower.match(/^my (damage|defense|reload|mobility|build|tunings?|slot|score)/i)||
                  isBuildRequest||
                  (lower.match(/build|tune|slot|scor|damage/)&&lower.match(/(my|check|review|rate|analyze|help|how'?s|what'?s)/i));
  
  if(isBuildCmd){
    if(!ch){addCoachMsg('Pick a character first!',false);return;}
    
    // "Make a build" — start conversational build engineer
    var isMakeCmd=isBuildRequest||
                  lower.match(/make (it|this) (more|less)/i)||
                  lower.match(/(switch|change|turn) (it|this) (to|into|more)/i);
    if(isMakeCmd){
      // Require a character name in the text OR a character selected in the planner
      var hasCharInText=lower.match(/(aizawa|bakugo|midoriya|izuku|deku|ochaco|uraraka|shoto|todoroki|shigaraki|tomura|all.?might|all.?for.?one|dabi|toga|hawks|mirko|overhaul|kurogiri|twice|compress|nagant|mirio|tamaki|nejire|kirishima|eijiro|kaminari|denki|tokoyami|fumikage|aoyama|mina|ashido|sero|shinsou|hitoshi|monoma|neito|kendo|itsuka|shiozaki|ibara|yaoyorozu|momo|iida|tenya|asui|tsuyu|shinso|cementoss|mic|present.?mic|endeavor|star.?stripe|mt.?lady|mtlady)/i);
      if(!ch&&!hasCharInText){addCoachMsg('Sure! Which character are we building for?',false);return;}
      // Check for tweaks on existing build
      var isTweak=lower.match(/make (it|this) (more|less)/i)||lower.match(/(switch|change|turn) (it|this) (to|into|more)/i);
      if(isTweak&&coachMemory.buildState&&coachMemory.buildState.phase==='ready'){
        adjustBuild(txt,lower);return;
      }
      // Start new build conversation
      var state=startBuildConversation(txt,lower,ch,window.ST.styleIdx||0);
      var firstQ=askNextQuestion(state);
      if(firstQ){
        coachMemory.buildState=state;
        addCoachMsg('🔧 <b>Let\'s engineer a build!</b><br><br>'+firstQ,false);
      }else{
        // All info available from text — generate directly
        generateAndShowBuild(state);
      }
      return;
    }
    try {
      var coach=window.AICoach;
      if(!coach){console.warn('AICoach undefined — build_coach.js not loaded');addCoachMsg('Build coach not loaded. Try refreshing.',false);return;}
      analysis=coach.analyzeBuild();
      if(analysis) {
        problems=coach.findProblems(analysis);
        suggestions=coach.suggestReplacements(analysis,ch,window.gcos(ch),problems);
      }
    } catch(e) {
      console.warn('analyzeBuild failed:',e);
      addCoachMsg('Build analysis error: '+e.message+'. Try refreshing.',false);
      return;
    }
    if(!analysis||!analysis.slots){addCoachMsg('Make sure you have some tunings equipped!',false);return;}
    var filled=0;analysis.slots.forEach(function(s){if(!s.r.empty)filled++;});
    if(filled<3){addCoachMsg('You barely have a build yet. Start with some Attack Power+ tunings at level 3-4, then come back.',false);return;}
    var cat=analysis.categories;
    // Build the detailed coach response
    var opens=pick(['Ooh, let me take a look!','Alright, running the numbers!','Let me analyze this...','Time for the diagnosis!']);
    var msg=opens+'<br><br>';
    
    // Score with Mei personality
    var sc=analysis.overall;
    if(sc>=75)msg+='<span style="color:#f5c800;">🌟🌟🌟</span> Score: <b style="color:#f5c800;font-size:.95rem;">'+sc+'</b> — this is <span style="color:#4ade80;">clean</span>! Really solid work!<br><br>';
    else if(sc>=60)msg+='<span style="color:#f5c800;">🌟🌟</span> Score: <b style="color:#f5c800;font-size:.95rem;">'+sc+'</b> — getting there! A few tweaks and it\'ll be <span style="color:#4ade80;">nasty</span>.<br><br>';
    else if(sc>=40)msg+='Score: <b style="color:#f5c800;font-size:.95rem;">'+sc+'</b> — decent foundation. Needs more <span style="color:#60a5fa;">focus</span> though.<br><br>';
    else msg+='Score: <b style="color:#f5c800;font-size:.95rem;">'+sc+'</b> — rough around the edges. Let\'s <span style="color:#f87171;">fix</span> it up!<br><br>';
    
    // Category breakdown with visual bars
    var bars='';var catNames={'damage':'<span style="color:#ef4444;">DMG</span>','defense':'<span style="color:#3b82f6;">DEF</span>','reload':'<span style="color:#a855f7;">REL</span>','mobility':'<span style="color:#22c55e;">MOB</span>'};
    ['damage','defense','reload','mobility'].forEach(function(k){
      var v=Math.round(cat[k]||0);
      var barW=Math.min(v,100);
      bars+=catNames[k]+' <span style="display:inline-block;width:50px;background:#1e293b;border-radius:4px;overflow:hidden;vertical-align:middle;margin:1px 0;"><span style="display:block;height:8px;width:'+barW+'%;background:'+(k==='damage'?'#ef4444':k==='defense'?'#3b82f6':k==='reload'?'#a855f7':'#22c55e')+';border-radius:4px;"></span></span> <span style="color:#94a3b8;font-size:.65rem;">'+v+'%</span><br>';
    });
    msg+=bars+'<br>';
    
    // Pros — find strong categories and good specials
    var pros=[];
    if(cat.damage>=50)pros.push('Damage output is solid ('+Math.round(cat.damage)+'%)');
    if(cat.defense>=40)pros.push('Good survivability ('+Math.round(cat.defense)+'%)');
    if(cat.reload>=50)pros.push('Fast reloads ('+Math.round(cat.reload)+'%)');
    if(cat.mobility>=40)pros.push('Nice mobility ('+Math.round(cat.mobility)+'%)');
    // Check specials
    if(analysis.specials){
      analysis.specials.forEach(function(sp){
        if(!sp.empty&&sp.score&&sp.score.name)pros.push('Got <b>'+esc(sp.score.name)+'</b> special');
      });
    }
    if(pros.length)msg+='<span style="color:#4ade80;">👍 Pros:</span> '+pros.join(' · ')+'<br>';
    else msg+='<span style="color:#64748b;">No standout strengths yet. Let\'s work on that!</span><br>';
    
    // Cons/issues
    var realIssues=problems.filter(function(p){return p.name.indexOf('Empty')===-1&&p.name.indexOf('empty')===-1;});
    if(realIssues.length){
      msg+='<span style="color:#f87171;">👎 Issues:</span><br>';
      realIssues.slice(0,3).forEach(function(p){
        msg+='<span style="color:#fbbf24;font-size:.65rem;">&#9888;</span> <b>'+esc(p.name)+'</b><br><span style="color:#64748b;font-size:.65rem;margin-left:12px;">'+esc(p.effect)+'</span><br>';
      });
    }
    
    // Suggestions (top 2)
    if(suggestions.length){
      msg+='<br><span style="color:#60a5fa;">💡 Suggestions:</span><br>';
      suggestions.slice(0,2).forEach(function(s){
        msg+='<span style="color:#4ade80;font-size:.65rem;">&#9654;</span> Swap <b>'+esc(s.cur)+'</b> &rarr; <b>'+esc(s.rep)+'</b> <span style="color:#4ade80;">+'+s.gain+'</span><br>';
      });
    }
    
    // Closing personality
    var closings=['Keep cooking! 🔥','Almost there!','You\'re on the right track!','Let\'s get this dialed in!'];
    msg+='<br><span style="color:#94a3b8;font-size:.65rem;">'+pick(closings)+'</span>';
    
    addCoachMsg(msg,false);
    return;
  }
  
  // Everything else goes to Mei (Groq) — with build context if one exists
  var refsBuild=lower.match(/(this|my|the|current) (build|setup|loadout|character)|what (do|did) (you|u) (think|reckon)|how'?s (it )?look|rate it|review it|is (it|this) good/i);
  // Force build context if a build was recently generated
  if(coachMemory.buildState&&coachMemory.buildState.phase==='ready')refsBuild=true;
  groqChat(txt, function(reply){
    if(reply)addCoachMsg(reply,false);
    else addCoachMsg(pick(['Hmm, not sure. Want me to look at your build?','I got nothing. Try asking about your build?']),false);
  }, refsBuild);
 }catch(e){console.warn('processCoach error:',e);addCoachMsg('Something glitched — try again?',false);}
}
