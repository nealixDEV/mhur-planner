// AI Chat — Mei Hatsume personality with Groq backend
var coachMemory={lastTopic:'',lastChar:'',lastAnalysis:null};

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
    var xhr=new XMLHttpRequest();xhr.open('POST','/api/chat',true);
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
  
  // Universal short reactions (no API needed)
  if(lower.match(/^(lol|lmao|lmfao|haha|lolol|dead|ded|heh)/i)){addCoachMsg(pick(['😂','lol','heh']),false);return;}
  if(/^(thanks|thx|ty|appreciate)/i.test(lower)){addCoachMsg(pick(['Happy to help!','Anytime!','No problem!']),false);return;}
  if(/^(yo|sup|wsp|hey|hello|hi|howdy|what'?s up|wassup|ay|aye|oi)$/i.test(lower.trim())){
    addCoachMsg(ch?pick(['Hey! Got a build for me?','Oh hey! Whatcha working on?','Yo! Need help tuning?']):'Hey! Pick a character first!',false);return;
  }
  if(/^(hm|hmm|idk|dunno|maybe|cool|gotcha|aight|ight|true|fair|same|oof|rip|bet|fr|ngl|tbh|yeah|yep|ok|okay|kk|alright|sure|nah|nope|no)$/i.test(lower.trim())){
    addCoachMsg(pick(['Got it.','Fair.','Okay!','Alright.']),false);return;
  }
  
  // Build commands — only trigger when user asks about THEIR build specifically
  var isBuildCmd=lower.match(/(analyze|review|check|rate|evaluate|explain|breakdown|what'?s wrong|improve|fix|upgrade|swap|replace) (my|this|the|it)|how'?s (my|this|the|it) (build|look|setup|tuning)|look at (my|this|the)/i)||
                  lower.match(/^my (damage|defense|reload|mobility|build|tunings?|slot|score)/i)||
                  (lower.match(/build|tune|slot|scor/)&&lower.match(/(my|check|review|rate|analyze|help|how'?s|what'?s)/i));
  
  if(isBuildCmd){
    if(!ch){addCoachMsg('Pick a character first!',false);return;}
    var analysis,problems,suggestions;
    try{
      analysis=window.AICoach&&window.AICoach.analyzeBuild();
      if(analysis){problems=window.AICoach.findProblems(analysis);suggestions=window.AICoach.suggestReplacements(analysis,ch,window.gcos(ch),problems);}
    }catch(e){}
    if(!analysis||!analysis.slots){addCoachMsg('Make sure you have some tunings equipped!',false);return;}
    var filled=0;analysis.slots.forEach(function(s){if(!s.r.empty)filled++;});
    if(filled<3){addCoachMsg('You barely have a build yet. Start with some Attack Power+ tunings at level 3-4, then come back.',false);return;}
    var cat=analysis.categories;
    if(lower.match(/explain|breakdown|walk me through/i)){
      var msg='';try{
        var mhd=window.MULTI_HIT_DATA;var sk=ch.id+'_'+(window.ST.styleIdx||0);
        if(mhd&&mhd[sk]){Object.keys(mhd[sk]).forEach(function(t){var s=mhd[sk][t];if(!s||!s.baseDamage)return;var b=s.baseDamage[Math.min(s.baseDamage.length-1,8)];msg+=t.toUpperCase()+': <b>'+b+'</b> &rarr; <b style="color:#4ade80;">'+Math.round(b+analysis.totals.dmg)+'</b><br>';});}else{msg='Dmg: '+Math.round(cat.damage)+'%<br>Def: '+Math.round(cat.defense)+'%';}
      }catch(e){msg='Dmg: '+Math.round(cat.damage)+'%';}
      addCoachMsg(msg,false);return;
    }
    var best='',worst='',bV=0,wV=100;
    ['damage','defense','reload','mobility'].forEach(function(k){var v=cat[k]||0;if(v>bV){bV=v;best=k;}if(v<wV){wV=v;worst=k;}});
    var msg='Let me look...<br><br>';
    if(analysis.overall>=65)msg+='Solid build. Score <b style="color:#f5c800;">'+analysis.overall+'</b>.<br><br>';
    else if(analysis.overall>=40)msg+='Not bad! <b style="color:#f5c800;">'+analysis.overall+'</b>.<br><br>';
    else msg+='<b style="color:#f5c800;">'+analysis.overall+'</b>. Room to grow.<br><br>';
    if(bV>=50)msg+='Best category: <b>'+best+'</b> ('+Math.round(bV)+'%). ';
    if(wV<40)msg+='Work on: <b>'+worst+'</b> ('+Math.round(wV)+'%). ';
    msg+='<br><span style="color:#64748b;font-size:.65rem;">'+Math.round(cat.damage)+'% dmg &middot; '+Math.round(cat.defense)+'% def &middot; '+Math.round(cat.reload)+'% rel &middot; '+Math.round(cat.mobility)+'% mob</span>';
    if(suggestions.length){msg+='<br><br><span style="color:#4ade80;">&#8226;</span> Try <b>'+esc(suggestions[0].rep)+'</b> <span style="color:#4ade80;">+'+suggestions[0].gain+'</span>';}
    addCoachMsg(msg,false);
    return;
  }
  
  // Everything else goes to Mei (Groq) — no forced context, let her be natural
  groqChat(txt, function(reply){
    if(reply)addCoachMsg(reply,false);
    else addCoachMsg(pick(['Hmm, not sure. Want me to look at your build?','I got nothing. Try asking about your build?']),false);
  });
}
