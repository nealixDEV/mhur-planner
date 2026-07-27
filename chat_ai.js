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
    var ch=window.gc(),slist=window.ST?window.ST.list:[];
    if(ch){
      var lines=[];
      lines.push('Character: '+ch.n+' ('+(ch.styles?ch.styles[window.ST.styleIdx]:'Style '+(window.ST.styleIdx||0))+')');
      // Tunings slots
      for(var i=0;i<Math.min(slist.length,10);i++){
        var s=slist[i];
        var tn=s.t?window.tuningNames[s.t.id]||'Tuning':'Empty';
        var tier=window.tierNames?window.tierNames[i]:'';
        if(s.t)lines.push('  Slot '+(i+1)+': '+tn+(s.t.values?' ('+s.t.values.join('/')+')':''));
        else lines.push('  Slot '+(i+1)+': Empty');
      }
      // Analysis
      var analysis=window.AICoach&&window.AICoach.analyzeBuild();
      if(analysis&&analysis.totals){
        lines.push('Score: '+analysis.overall+'/100 | Dmg: '+Math.round(analysis.categories.damage)+'% | Def: '+Math.round(analysis.categories.defense)+'%');
        // Per-category breakdown
        for(var c in analysis.categories){
          if(c!='damage'&&c!='defense')lines.push('  '+c+': '+Math.round(analysis.categories[c])+'%');
        }
        // Warnings
        if(analysis.flags&&analysis.flags.length)lines.push('Issues: '+analysis.flags.join(', '));
      }
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
// Phase flow: idle → gathering (questions) → ready (generate) → modifying
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
  if(/tank|defen|survive|hp|health|shield|bulky|tough|durable|frontline/i.test(txt)){g.defense=0.5;g.damage=0.2;g.desc='defensive';}
  if(/mobilit|speed|dash|fast|agile|slippery|zoom|run/i.test(txt)){g.mobility=0.45;g.damage=Math.max(g.damage-0.15,0.1);g.desc='mobility';}
  if(/reload|cooldown|uptime|ammo|replenish|recovery/i.test(txt)){g.reload=0.45;g.damage=Math.max(g.damage-0.1,0.2);g.desc='reload';}
  if(/alpha/.test(txt)){g.focus='alpha';}
  if(/beta/.test(txt)){g.focus='beta';}
  if(/gamma/.test(txt)){g.focus='gamma';}
  if(/melee/.test(txt)){g.focus='melee';}
  if(/balanced|all.?round|versatile|general/i.test(txt)){g.desc='balanced';}
  if(/max.?dmg|glass.?cannon|sweaty|ranked|try.?hard|aggress|^max$|^max\b|high.?risk|risk.?reward/i.test(txt)){g.damage=0.7;g.defense=0.05;g.desc='max damage';}
  if(/heal|gp|support|team|healer/i.test(txt)){g.gp=0.4;g.hp=0.3;g.damage=0.15;g.desc='support';}
  // Build display description separate from analytical data
  g.skillDesc=g.focus||'';
  if(g.skillDesc)g.display=g.skillDesc+' '+g.desc;
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
    if(goal.focus==='alpha'&&al)sc+=50;else if(goal.focus==='beta'&&be)sc+=50;
    else if(goal.focus==='gamma'&&ga)sc+=50;else if(goal.focus==='melee'&&me)sc+=50;
  }
  sc+=dmg*30*goal.damage+def*30*goal.defense+rel*30*goal.reload+mob*30*goal.mobility+gp*30*goal.gp+all*10;
  // Bonus for multi-effect tunings that match multiple goal categories
  if(matchCount>=2)sc+=matchCount*5;
  if(goal.focus==='alpha'&&(be||ga||me))sc-=25;
  if(goal.focus==='beta'&&(al||ga||me))sc-=25;
  if(goal.focus==='gamma'&&(al||be||me))sc-=25;
  if(t.rarity==='UR')sc+=5;else if(t.rarity==='SR')sc+=3;
  if(t.chara)sc-=3;
  if(t.name&&(t.name.indexOf('Attack Power')>=0||t.name.indexOf('Damage')>=0))sc+=8;
  return Math.max(1,sc);
}
function generateBuild(ch,si,goal,cosIdx){
  var cos=window.gcos(ch),CH_NUM=window.CH_NUM,used={};
  // Set costume index if specified
  if(cosIdx!==undefined&&ch.c&&ch.c[cosIdx]){window.ST.cosIdx=cosIdx;cos=ch.c[cosIdx];}
  var build={left:[],right:[],specs:[],charId:ch.id,styleIdx:si,cosIdx:window.ST.cosIdx};
  ['left','right'].forEach(function(side){
    var defs=window.buildSlotDefs(ch,side);
    defs.forEach(function(def,idx){
      var opts=window.normalOptions(def.r,def.a,CH_NUM[ch.id],'');
      var avail=opts.filter(function(o){return !used[o.id];});
      var scored=avail.map(function(o){return {t:o,s:scoreTuning(o,goal)};});
      scored.sort(function(a,b){return b.s-a.s;});
      var best=scored.length&&scored[0].s>0?scored[0].t:(avail.length?avail[0]:null);
      if(best)used[best.id]=true;
      var label=tuningDisplayName(best)||'Empty';
      build[side].push({tid:best?best.id:'',lv:best?9:1,label:label,name:label,rarity:best?best.rarity:''});
    });
  });
  var srs={};if(cos&&cos.sp1){srs.left={r:cos.sp1.r||'',a:cos.sp1.a||null};srs.right=cos.sp2?{r:cos.sp2.r||'',a:cos.sp2.a||null}:null;}
  ['left','right'].forEach(function(side,si2){
    var sr=srs[side];if(!sr||!sr.r||sr.r==='/'){build.specs.push({tid:'',lv:1,name:'Locked'});return;}
    var opts=window.specialOptions(sr.r,CH_NUM[ch.id],sr.a||'',null);
    var avail=opts.filter(function(o){return o&&!used[o.id];});
    var scored=avail.map(function(o){
      var sc=scoreTuning(o,goal);var sn=(o.skillName||'').toLowerCase();
      if(sn.indexOf('wall runner')>=0&&goal.mobility>0.3)sc+=40;
      if(sn.indexOf('space hop')>=0&&goal.mobility>0.3)sc+=35;
      if(sn.indexOf('revenge')>=0&&(goal.defense>0.3||goal.damage>0.5))sc+=30;
      if(sn.indexOf('hp sucker')>=0&&goal.defense>0.3)sc+=25;
      if(sn.indexOf('acceleration')>=0&&goal.mobility>0.3)sc+=25;
      return {t:o,s:sc};
    });
    scored.sort(function(a,b){return b.s-a.s;});
    var best=scored.length&&scored[0].s>0?scored[0].t:(avail.length?avail[0]:null);
    if(best)used[best.id]=true;
    var sLabel=tuningDisplayName(best);
    build.specs.push({tid:best?best.id:'',lv:best?5:1,name:sLabel});
  });
  return build;
}
function applyBuild(build){
  if(!build)return false;
  try{
    var sid=build.styleIdx||0;
    // Switch character+style if needed (mimics onCardClick logic)
    if(build.charId!==window.ST.charId||sid!==window.ST.styleIdx){
      saveState();
      window.ST.charId=build.charId;
      window.ST.styleIdx=sid;
      loadState(build.charId,sid);
    }else{
      resetBuild();
    }
    // Set costume
    if(build.cosIdx!==undefined)window.ST.cosIdx=build.cosIdx;
    // Apply tunings directly
    ['left','right'].forEach(function(side){
      var arr=build[side]||[];
      for(var i=0;i<Math.min(arr.length,window.ST[side].length);i++){
        window.ST[side][i].tid=arr[i].tid||'';
        window.ST[side][i].lv=arr[i].lv||9;
      }
    });
    var sp=build.specs||[];
    for(var i=0;i<Math.min(sp.length,window.ST.specs.length);i++){
      window.ST.specs[i].tid=sp[i].tid||'';
      window.ST.specs[i].lv=sp[i].lv||5;
    }
    saveState();
    // Full UI refresh
    if(typeof renderAll==='function'){renderAll();}
    else if(typeof buildGrids==='function'){buildGrids();buildSlots(gc());}
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
// Analyze costumes to find the one with slots best matching the goal
function pickBestCostume(ch,goal,preferRarity,preferSpRole,preferStyleRole){
  if(!ch||!ch.c||!ch.c.length)return 0;
  var bestIdx=0,bestScore=-999;
  ch.c.forEach(function(cos,i){
    if(preferRarity&&cos.ra!==preferRarity)return;
    var score=0;
    if(cos.s){
      cos.s.forEach(function(sl){
        var r=sl.r||'Strike';
        if(r==='Strike')score+=4;
        else if(r==='Technical')score+=3;
        else if(r==='Assault')score+=2;
        else if(r==='Rapid')score+=1;
        // Style role bonus — if user chose Technical, Technical slots get +10
        if(preferStyleRole&&r===preferStyleRole)score+=10;
        // Goal-specific bonuses
        if(goal.damage>0.5){if(r==='Strike')score+=5;else if(r==='Technical')score+=3;}
        if(goal.defense>0.4&&(r==='Support'||r==='Assault'))score+=3;
        if(goal.mobility>0.4&&r==='Rapid')score+=3;
        if(goal.reload>0.4)score+=1;
        if(goal.gp>0.3&&r==='Support')score+=3;
      });
    }
    // Check special slot roles — big bonus if matches preferred
    var spRoles={};
    if(cos.sp1)spRoles[cos.sp1.r]=true;
    if(cos.sp2)spRoles[cos.sp2.r]=true;
    if(preferSpRole&&spRoles[preferSpRole])score+=20;
    if(cos.sp1)score+=2;
    if(cos.sp2)score+=2;
    var rarityBonus={PUR:3,UR:2,SR:1,R:0};
    score+=(rarityBonus[cos.ra||'R']||0);
    if(score>bestScore){bestScore=score;bestIdx=i;}
  });
  return bestIdx;
}
function startBuildConversation(txt,lower,ch,styleIdx){
  // Clear any existing build state
  coachMemory.buildState=null;
  // Extract what info we can from the initial text
  var state={phase:'gathering',char:ch,styleIdx:styleIdx||0,cosIdx:0,goal:null,build:null,questions:[],qIdx:0,missingInfo:[]};
  // Character detection with fuzzy matching for typos
  var chs=window.CH||[];
  var bestChar=null,bestScore=0;
  for(var ci=0;ci<chs.length;ci++){
    var c=chs[ci];
    var cn=c.n.toLowerCase(),cid=c.id.toLowerCase();
    // Exact substring match on name
    var matchScore=0;
    if(lower.indexOf(cn)>=0)matchScore=cn.length*2;
    else if(lower.indexOf(cid)>=0)matchScore=cid.length*2;
    // Partial word match
    if(!matchScore){
      var parts=cn.split(' ');
      for(var pi=0;pi<parts.length;pi++){
        if(parts[pi].length>2&&lower.indexOf(parts[pi])>=0)matchScore+=parts[pi].length;
      }
      if(cid.length>2&&lower.indexOf(cid)>=0)matchScore+=cid.length;
    }
    // Fuzzy char-level match for typos (e.g. "aziawa" → "aizawa")
    if(!matchScore){
      var raw=lower.replace(/[^a-z]/g,'');
      var cleanName=cn.replace(/[^a-z]/g,'');
      var cleanId=cid.replace(/[^a-z]/g,'');
      // Count matching characters in sequence
      var mi=0;var seq=0;
      for(var chi=0;chi<raw.length&&mi<cleanName.length;chi++){
        if(raw[chi]===cleanName[mi]){seq++;mi++;}
      }
      if(seq/cleanName.length>0.5)matchScore=Math.round(seq*1.5);
      // Also check against character id
      mi=0;var seq2=0;
      for(var chi=0;chi<raw.length&&mi<cleanId.length;chi++){
        if(raw[chi]===cleanId[mi]){seq2++;mi++;}
      }
      if(seq2/cleanId.length>0.6)matchScore=Math.max(matchScore,Math.round(seq2*1.5));
    }
    // Check style names too
    if(c.bs)c.bs.forEach(function(b){var s=b.n.toLowerCase();if(lower.indexOf(s)>=0)matchScore+=5;});
    if(matchScore>bestScore){bestScore=matchScore;bestChar=c;}
  }
  if(bestChar)state.char=bestChar;
  // Style detection — check style name in text first
  if(state.char.bs&&state.char.bs.length){
    for(var si=0;si<state.char.bs.length;si++){
      var sn=state.char.bs[si].n.toLowerCase();
      if(lower.indexOf(sn)>=0){state.styleIdx=si+1;break;}
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
  // Determine missing info
  state.missingInfo=[];
  // Check style ambiguity — if character has multiple styles and we couldn't determine
  if(state.char.bs&&state.char.bs.length>0){
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
  if(/highest.?rarity|best.?costume|pur|legendary/i.test(lower))rarityPref='PUR';
  if(/ur|epic/i.test(lower))rarityPref='UR';
  if(/sr|rare/i.test(lower))rarityPref='SR';
  if(/common|budget|r |cheap/i.test(lower))rarityPref='R';
  if(!rarityPref){
    var rarities={};
    if(state.char.c)state.char.c.forEach(function(c){rarities[c.ra||'R']=true;});
    if(Object.keys(rarities).length>1)state.missingInfo.push('rarity');
  }
  state._rarityPref=rarityPref;
  if(rarityPref||!state.missingInfo.length||state.missingInfo[state.missingInfo.length-1]!=='rarity'){
    state.cosIdx=pickBestCostume(state.char,state.goal,rarityPref,null,getStyleRole(state.char,state.styleIdx));
  }
  // Check goal — if it's generic "balanced", ask for more specific
  if(state.goal.desc==='balanced'&&!state.goal.focus)state.missingInfo.push('goal');
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
  if(info==='style'){
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
  if(info==='style'){
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
  try{
  // Auto-pick costume if not yet set
  if(!state.cosIdx&&state.cosIdx!==0)state.cosIdx=0;
  if(state.cosIdx===0||!state.char.c||!state.char.c[state.cosIdx]){
    state.cosIdx=pickBestCostume(state.char,state.goal,state._rarityPref,null,getStyleRole(state.char,state.styleIdx));
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
    for(var si=0;si<5;si++)leftSlots.push((cos.s[si]&&cos.s[si].r)||'Strike');
    for(var si=5;si<10;si++)rightSlots.push((cos.s[si]&&cos.s[si].r)||'Strike');
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
  
  // Generate
  var build=generateBuild(ch,si,goal,state.cosIdx);
  // Reapply any special overrides (e.g. Fixer chosen by user)
  if(state._specialOverrides){
    state._specialOverrides.forEach(function(ov){
      if(build&&build.specs&&build.specs[ov.idx]){
        build.specs[ov.idx].tid=ov.tid;
        build.specs[ov.idx].name=ov.name;
        build.specs[ov.idx].lv=5;
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
  build.left.concat(build.right).forEach(function(s){if(!s.tid)return;
    var name=(s.name||'').toLowerCase();
    if(/attack|power|damage|alpha|beta|gamma|melee/.test(name))dmgCount++;
    if(/hp|defense|guard|shield|survive/.test(name))defCount++;
    if(/reload|cooldown|ammo|replenish/.test(name))relCount++;
    if(/dash|movement|speed|mobility|jump/.test(name))mobCount++;
  });
  var total=dmgCount+defCount+relCount+mobCount||1;
  var dmgPct=Math.round(dmgCount/total*100);
  var defPct=Math.round(defCount/total*100);
  if(dmgPct>=60)exp='Aggressive damage focus — '+dmgPct+'% offensive tunings. Hits hard but watch your HP.';
  else if(defPct>=50)exp='Defensive setup — '+defPct+'% survival tunings. Hard to take down.';
  else if(dmgPct>=40)exp='Balanced with damage priority ('+dmgPct+'% offense). Solid all-around.';
  else exp='Balanced mix of stats. Reliable performance.';
  msg+='<br><span style="color:#4ade80;font-size:.65rem;">💬 '+exp+'</span>';
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

function processCoach(txt){
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
        coachMemory.buildState.phase='gathering';
        // Generate the build now with current specials
        try{generateAndShowBuild(coachMemory.buildState);}catch(e){console.warn('build gen error:',e);addCoachMsg('Build error: '+e.message,false);}
        return;
      }
      // Try to match the special name from the compiled list
      var specList=coachMemory.buildState._allSpecials||[];
      var found=false;
      var bestSp=null;
      specList.forEach(function(s){
        if(found)return;
        var searchText=(s.name||'').toLowerCase()+' '+(s.role||'').toLowerCase();
        if(searchText.indexOf(lower)>=0){bestSp=s;found=true;}
      });
      if(found&&bestSp){
        // Find the BEST costume — score based on the column Fixer will be in
        var ch=coachMemory.buildState.char;
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
  // Fix common typos: "ake" -> "make", etc.
  var fixedTypo=false;
  if(/^ake\b/i.test(txt)&&!fixedTypo){txt='m'+txt;lower='m'+lower;fixedTypo=true;}
  var isBuildCmd=lower.match(/(analyze|review|check|rate|tate|rait|evaluate|how'?s|explain|breakdown|wrong|improv|fix|upgrade|swap|replace|what'?s (wrong|bad|the issue)) (my|this|the|it|build)/i)||
                  lower.match(/^my (damage|defense|reload|mobility|build|tunings?|slot|score)/i)||
                  lower.match(/(make|build|create|give|generate) (me|a|us|him|her|it).*(build|set|loadout|tuning)/i)||
                  (lower.match(/build|tune|slot|scor|damage/)&&lower.match(/(my|check|review|rate|analyze|help|how'?s|what'?s)/i));
  
  if(isBuildCmd){
    if(!ch){addCoachMsg('Pick a character first!',false);return;}
    
    // "Make a build" — start conversational build engineer
    var isMakeCmd=lower.match(/(make|build|create|give|generate).*(build|set|loadout|tuning|load.?out)/i)||
                  lower.match(/make (it|this) (more|less)/i)||
                  lower.match(/(switch|change|turn) (it|this) (to|into|more)/i);
    if(isMakeCmd){
      if(!ch){addCoachMsg('Pick a character first!',false);return;}
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
  
  // Everything else goes to Mei (Groq) — but block build-related queries
  var buildKeywords=/(build|tuning|tune|slot|costume|damage boost|ability|quirk|skill|loadout|set)/i;
  var buildContext=/(my|this|me|for|make|give|rate|check|how)/i;
  if(lower.match(buildKeywords)&&lower.match(buildContext)){
    addCoachMsg('I can help with that in the Build Engineer! Try <b>"make me a build"</b>.',false);
    return;
  }
  var refsBuild=lower.match(/(this|my|the|current) (build|setup|loadout|character)|what (do|did) (you|u) (think|reckon)|how'?s (it )?look|rate it|review it|is (it|this) good/i);
  groqChat(txt, function(reply){
    if(reply)addCoachMsg(reply,false);
    else addCoachMsg(pick(['Hmm, not sure. Want me to look at your build?','I got nothing. Try asking about your build?']),false);
  }, refsBuild);
 }catch(e){console.warn('processCoach error:',e);addCoachMsg('Something glitched — try again?',false);}
}
