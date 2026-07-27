// AI Chat — Mei Hatsume personality
var coachMemory={lastTopic:'',lastChar:'',lastAnalysis:null};
var coachPersonality='mei';

function toggleCoachChat(){
  var p=document.getElementById('coachChatPanel');
  p.style.display=p.style.display==='none'||!p.style.display?'flex':'none';
  if(p.style.display==='flex')setTimeout(function(){document.getElementById('coachInput').focus();},100);
}
function addCoachMsg(text,isUser){
  var m=document.getElementById('coachMessages');
  var d=document.createElement('div');
  d.style.cssText='background:'+(isUser?'rgba(5,150,105,.12)':'rgba(255,255,255,.04)')+';border-radius:10px;padding:8px 12px;max-width:90%;align-self:'+(isUser?'flex-end':'flex-start')+';font-size:.72rem;color:#cbd5e1;line-height:1.5;'+(isUser?'border:1px solid rgba(5,150,105,.15);':'');
  d.innerHTML=text;
  m.appendChild(d);m.scrollTop=m.scrollHeight;
}
function coachThink(){addCoachMsg('<span style="color:#64748b;">Thinking...</span>',false);}
function coachStop(){
  var m=document.getElementById('coachMessages');
  var last=m.lastChild;if(last&&last.innerHTML.indexOf('Thinking...')>=0)last.remove();
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

function groqChat(msg, cb){
  try{
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/api/chat',true);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.onload=function(){try{var r=JSON.parse(xhr.responseText);cb(r&&r.reply?r.reply:null);}catch(e){cb(null);}};
    xhr.onerror=function(){cb(null);};
    xhr.send(JSON.stringify({message:msg}));
  }catch(e){cb(null);}
}

function processCoach(txt){
  coachStop();
  var lower=txt.toLowerCase().trim();
  var ch=window.gc();
  var chName=ch?ch.n:'';
  
  // ===== SMALLTALK =====
  if(lower.match(/^(lol|lmao|lmfao|haha|lolol|dead|ded)/i)){
    addCoachMsg(pick(['Heh.','Glad I could entertain.','My jokes need work, I know.']),false);return;
  }
  if(/bored/i.test(lower)){
    addCoachMsg(pick(['Bored? Perfect. Let me show you some tuning combinations.','Boredom = good time to experiment.','I never get bored of testing new setups.']),false);return;
  }
  if(/(favorite|main) (character|chara|class)/i.test(lower)){
    addCoachMsg('I don\'t really pick favorites — I just like optimizing whatever comes through. Every character has interesting tuning options.',false);return;
  }
  if(/roast|destroy|cook (me|my|this)/i.test(lower)){
    addCoachMsg(pick(['I don\'t roast builds — I improve them. Let me see what we\'re working with.','Roasting isn\'t really my style. But I can definitely optimize it.','Let\'s just look at the numbers and see what needs work.']),false);return;
  }
  if(/thanks|thx|ty|appreciate/i.test(lower)){
    addCoachMsg(pick(['Happy to help!','Anytime. That\'s what I\'m here for.','Glad I could help!']),false);return;
  }
  if(/(smart|genius|goat|cracked)/i.test(lower)){
    addCoachMsg(pick(['I just like figuring out what works.','It\'s the engineer in me.','Thanks! Optimization is my thing.']),false);return;
  }
  if(/(play mhur|you play|ranked|what rank|do you play)/i.test(lower)){
    addCoachMsg('I don\'t play, but I spend a lot of time looking at tuning data. Same result, different approach.',false);return;
  }
  if(/(how'?s your|how are|you good)/i.test(lower)){
    addCoachMsg(pick(['Doing well! Been running some tuning tests. You?','Good, good. Always working on something. What\'s up?']),false);return;
  }
  if(/(tired|exhausted)/i.test(lower)){
    addCoachMsg('I never get tired of testing new combinations. Want to see something interesting?',false);return;
  }
  
  // ===== GREETINGS =====
  if(lower.match(/^(yo|sup|wsp|hey|hello|hi|howdy|what'?s up|wassup|good (morning|afternoon|evening)|ay|aye|oi)/i)){
    var g=ch?pick(['Hey! Working on a build?','Oh, nice to see you! Got a build for me to look at?',"Hey! Whatcha working on?"]):
      pick(['Hey! Pick a character and let\'s get to work!','Hello! Select someone first, then I can help you tune.']);
    addCoachMsg(g,false);return;
  }
  if(txt.trim().length<=3&&!lower.match(/yeah|no|ok|kk/)){
    addCoachMsg(pick(['Hm?','Yeah?','What\'s up?']),false);return;
  }
  if(lower.match(/^(hm|hmm|idk|dunno|maybe|cool|gotcha|aight|ight|true|fair|same|oof|rip|bet|fr|ngl|tbh)/i)){
    addCoachMsg(pick(['Got it.','Fair.','Okay!','Alright.']),false);return;
  }
  if(lower.match(/^(yeah|yep|ok|okay|kk|alright|sure|nah|nope|no)/i)){
    addCoachMsg(pick(['Got it.','Okay!','Alright. Let me know when you\'re ready.']),false);return;
  }
  
  // ===== UNKNOWN QUESTIONS — ask the real AI =====
  if((/\?$/.test(txt)||lower.match(/^(what|how|when|where|why|who|do you|does|is there|are there|can you|tell me about)/i))&&
     !lower.match(/analyze|build|my build|damage|defense|reload|mobility|explain|issue|swap|change|replace|suggest|help|tune|slot|scor/i)){
    var buildContext=ch?ch.n:'someone';
    groqChat(txt+' (the user is looking at a '+buildContext+' build in MHUR)', function(reply){
      addCoachMsg(reply||pick(['Hmm, not sure about that one. Want me to look at your build instead?']),false);
    });
    return;
  }
  
  // ===== INTENT =====
  var intent='analyze',focus='';
  if(lower.match(/build (me|a|one|something|for|cooking)|create|make (me|a)|generate|give me|recommend|optimal|min[- ]?max|cook me|theorycraft/i))intent='build';
  else if(lower.match(/explain|breakdown|walk me through|why (is|does|would)|how (does|come|is|can)/i))intent='explain';
  else if(lower.match(/issue|problem|weak|bad|wrong|improve|fix|upgrade|change|swap|replace|suggestion|what should|what can i/i))intent='issues';
  
  if(lower.match(/gamma|quirk skill y|prominence/i))focus='gamma';
  else if(lower.match(/alpha|quirk skill a|delaware|carolina/i))focus='alpha';
  else if(lower.match(/beta|quirk skill b|detroit|missouri/i))focus='beta';
  else if(lower.match(/melee|punch|kick/i))focus='melee';
  
  // ===== BUILD GENERATOR =====
  if(intent==='build'){
    if(!ch){addCoachMsg('Pick a character first, then we can cook!',false);return;}
    addCoachMsg('Build generator is still being put together. For now I can analyze your current build if you want.',false);
    return;
  }
  
  // ===== GET ANALYSIS =====
  if(!ch){addCoachMsg('Select a character first!',false);return;}
  
  coachMemory.lastChar=ch.id;
  var analysis,problems,suggestions;
  try{
    analysis=window.AICoach&&window.AICoach.analyzeBuild();
    if(analysis){problems=window.AICoach.findProblems(analysis);suggestions=window.AICoach.suggestReplacements(analysis,ch,window.gcos(ch),problems);}
  }catch(e){}
  coachMemory.lastAnalysis=analysis;
  
  if(!analysis||!analysis.slots){
    addCoachMsg('Couldn\'t analyze that. Make sure you have some tunings equipped!',false);return;
  }
  
  var filled=0;
  analysis.slots.forEach(function(s){if(!s.r.empty)filled++;});
  var cat=analysis.categories;
  
  if(intent==='explain'){
    var msg='';
    try{
      var mhd=window.MULTI_HIT_DATA;var sk=ch.id+'_'+(window.ST.styleIdx||0);
      if(mhd&&mhd[sk]){
        Object.keys(mhd[sk]).forEach(function(t){
          var s=mhd[sk][t];if(!s||!s.baseDamage)return;
          var base=s.baseDamage[Math.min(s.baseDamage.length-1,8)];
          var tuned=Math.round(base+analysis.totals.dmg);
          var pct=Math.round(tuned/300*100);
          msg+=t.toUpperCase()+': <b>'+base+'</b> &rarr; <b style="color:#4ade80;">'+tuned+'</b> <span style="color:#64748b;">('+pct+'% of 300)</span><br>';
        });
        msg+='<br><span style="color:#94a3b8;">300 is roughly the max a skill can hit before PU/PC. Higher numbers = better optimization.</span>';
      }else{
        msg='Damage: <b>'+Math.round(cat.damage)+'%</b><br>Defense: <b>'+Math.round(cat.defense)+'%</b><br>Reload: <b>'+Math.round(cat.reload)+'%</b>';
      }
    }catch(e){msg='Damage: '+Math.round(cat.damage)+'%';}
    addCoachMsg(msg,false);return;
  }
  
  // ===== EMPTY BUILD =====
  if(filled<3){
    addCoachMsg('You don\'t have much equipped yet! I\'d recommend starting with some Attack Power+ tunings and leveling them to 3-4. Come back when you\'ve got a few slots filled and I\'ll take a proper look.',false);
    return;
  }
  
  // ===== BUILD REVIEW =====
  var best='',worst='',bestV=0,worstV=100;
  ['damage','defense','reload','mobility'].forEach(function(k){
    var v=cat[k]||0;
    if(v>bestV){bestV=v;best=k;}
    if(v<worstV||(v===0&&worstV===100)){worstV=v;worst=k;}
  });
  
  var msg='';
  
  if(intent==='issues'){
    if(!problems.length){msg='Not much to complain about here. Solid build overall.';}
    else{
      msg='Here\'s what I noticed:<br>';
      problems.slice(0,3).forEach(function(p){msg+='<span style="color:#ef4444;font-size:.65rem;">&#8226;</span> '+esc(p.effect||p.name)+'<br>';});
      if(suggestions.length){
        msg+='<br>If you want to swap something:<br>';
        suggestions.slice(0,2).forEach(function(s){msg+='<span style="color:#4ade80;font-size:.65rem;">&#8226;</span> '+esc(s.slot)+': <b>'+esc(s.rep)+'</b> <span style="color:#4ade80;">+'+s.gain+'</span><br>';});
      }
    }
    addCoachMsg(msg,false);return;
  }
  
  // Full review
  msg='Let me take a look...<br><br>';
  
  if(analysis.overall>=65)msg+='This is actually a <b>really solid build</b>. Score of <b style="color:#f5c800;">'+analysis.overall+'</b>. Whoever put this together knew what they were doing.<br><br>';
  else if(analysis.overall>=40)msg+='Not bad at all! Score of <b style="color:#f5c800;">'+analysis.overall+'</b>. I can already see a few upgrades though.<br><br>';
  else msg+='Well... it\'s a start. <b style="color:#f5c800;">'+analysis.overall+'</b> overall. Let\'s see what we can improve.<br><br>';
  
  if(bestV>=50){msg+='Your <b>'+best+'</b> is looking good at <b>'+Math.round(bestV)+'%</b>. ';}
  else{msg+='Your highest category is <b>'+best+'</b> at <b>'+Math.round(bestV)+'%</b>. ';}
  
  if(worstV<40){msg+='The <b>'+worst+'</b> could use some attention ('+Math.round(worstV)+'%). ';}
  msg+='<br><br><span style="color:#64748b;font-size:.65rem;">Dmg: '+Math.round(cat.damage)+'% &middot; Def: '+Math.round(cat.defense)+'% &middot; Rel: '+Math.round(cat.reload)+'% &middot; Mob: '+Math.round(cat.mobility)+'%</span>';
  
  addCoachMsg(msg,false);
}
