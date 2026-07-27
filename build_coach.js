// AI Build Coach v7 — NaN-safe, problem filtering
var AICoach=(function(){
var ST=window.ST,CH=window.CH,CH_NUM=window.CH_NUM,gc=window.gc,fn=window.findNormal,fs=window.findSpecial;
var bsd=window.buildSlotDefs,gc2=window.gcos,gcr=window.getCharacterRole,td=window.tuningDesc;
var scm=window.specialColumnMultiplier,gs=window.getStatBonus,gsfs=window.getStatBonusForSkill;
var no=window.normalOptions,ut=window.usedTids,gadb=window.getAllDamageBonuses;
var stk=window.specialTuningKind,esc=window.esc;
var arbs=window.getAllReloadBonuses,adbs=window.getAllDefenseBonuses;

var SQ={'Wall Runner':95,'Space Hop':88,'Critical Permeation':85,'Willpower':80,'HP Sucker':78,'GP Sucker':75,'Revenge Strike':75,'Revenge Assault':75,'Revenge Rapid':72,'Revenge Technical':72,'Revenge Support':75,'Quirk Factor Release':82,'Crushing PU Charge':78,'Extra Wind':76,'Acceleration':80,'High-Speed Replenishment':68,'Card Duplication':72,'Ability Manifest':74,'Divine Protection':62,'Kota Finder':60,'Foundation of Peace':65,'Embrittlement':70,'Compression Magic':45};

function n(v,d){return(isNaN(v)||v===null||v===undefined)?(d||0):v;}

function ss(e,lv,side,ch,cos){
  if(!e)return{dmg:0,def_:0,rel:0,mob:0,tot:0,dets:[]};
  var mult=n(scm(fs(ST.specs[0]&&ST.specs[0].tid),ST.specs[0]&&ST.specs[0].lv),1);
  var dmg=0,def_=0,rel=0,mob=0,dets=[];
  if(e.subEffects&&e.subEffects.length){
    e.subEffects.forEach(function(sub){
      var sn=(sub.skillName||'').toLowerCase();
      // Mobility detection from sub-effect name
      if(sn.indexOf('wall jump')>=0||sn.indexOf('forward jump')>=0||sn.indexOf('run speed')>=0||sn.indexOf('dash speed')>=0||sn.indexOf('movement speed')>=0||sn.indexOf('crawl speed')>=0){
        mob+=3;dets.push({t:'mob',txt:'Mobility +3'});
      }
      var sStat=gsfs(sub.skillName,sub.levels,lv);
      if(sStat){var sv=n(sStat.value)*mult;def_+=sv;dets.push({t:'stat',txt:sStat.type+' +'+Math.round(sv)});}
    });
  }
  // Use the same damage calculation as the planner's damage stats panel
  var allBonuses=gadb?gadb(ch,e,lv):[];
  allBonuses.forEach(function(b){
    if(b&&b.bonus&&b.bonus>0){
      var inc=b.bonus*mult;
      dmg+=inc;
      dets.push({t:'dmg',txt:(b.type||'Skill')+' +'+(inc).toFixed(1)+(b.isMultiplier?' ('+((b.current-1)*100).toFixed(1)+'%)':'')});
    }
  });
  // Estimate damage from Attack Power+ tunings using multi-hit data when available
  if(e.subEffects&&e.subEffects.length){
    var baseDmg=100;
    try{
      var mhd=window.MULTI_HIT_DATA;
      var styleIdx=ST.styleIdx||0;
      var key=ch.id+'_'+styleIdx;
      if(mhd&&mhd[key]){
        Object.keys(mhd[key]).forEach(function(skType){
          var sk=mhd[key][skType];
          if(sk&&sk.baseDamage){
            var lv9Dmg=sk.baseDamage[Math.min(sk.baseDamage.length-1,8)];
            if(lv9Dmg>baseDmg)baseDmg=lv9Dmg;
          }
        });
      }
    }catch(e){}
    e.subEffects.forEach(function(sub){
      var sn=(sub.skillName||'').toLowerCase();
      if(sn.indexOf('attack power')>=0||sn.indexOf('attack+')>=0||sn.indexOf('damage+')>=0){
        var val=null;
        try{
          var levels=sub.levels||[];
          var idx2=Math.min(levels.length-1,lv-1);
          if(idx2>=0)val=parseFloat(levels[idx2].replace(/^.*?:\s*/,''));
        }catch(e){}
        if(val&&val>0&&val<2){
          var dmgLv=window.DAMAGE_LEVEL||1;
          var scaledBase=baseDmg;
          try{
            var mhd2=window.MULTI_HIT_DATA;var sk2=ch.id+'_'+(ST.styleIdx||0);var dIdx=Math.min(8,dmgLv-1);
            if(mhd2&&mhd2[sk2]){
              Object.keys(mhd2[sk2]).forEach(function(t){
                var s=mhd2[sk2][t];if(s&&s.baseDamage&&s.baseDamage.length>dIdx){var lv=s.baseDamage[dIdx];if(lv>scaledBase)scaledBase=lv;}
              });
            }
          }catch(e){}
          var inc=(scaledBase*(val-1))*mult;
          if(inc>0){dmg+=inc;dets.push({t:'dmg',txt:'~'+(inc).toFixed(1)+' ('+((val-1)*100).toFixed(1)+'%)'});}
        }
      }
    });
  }
  if(e&&e.name&&allBonuses.length===0&&e.subEffects&&e.subEffects.length){
    // Debug: log when a slot has subEffects but no damage bonuses found
    console.log('COACH: No damage bonuses for',e.name,'subEffects:',e.subEffects.map(function(s){return s.skillName;}).join(', '),'gadb result:',allBonuses.length);
  }
  var dBon=adbs?adbs(ch,e,lv):[];
  dBon.forEach(function(d){if(d&&d.bonus){var b=n(Math.abs(d.bonus))*mult;def_+=b;dets.push({t:'def',txt:'Def +'+(b*100).toFixed(0)+'%'});}});
  var rBon=arbs?arbs(ch,e,lv):[];
  rBon.forEach(function(r){if(r&&r.bonus){var b=n(Math.abs(r.bonus))*mult;rel+=b;dets.push({t:'rel',txt:'Reload +'+(b*100).toFixed(0)+'%'});}});
  return{dmg:n(dmg),def_:n(def_),rel:n(rel),mob:n(mob),tot:n(dmg+def_*10+rel*5+mob),dets:dets,mult:mult};
}

function analyzeBuild(){
  var ch=gc();if(!ch)return null;var cos=gc2(ch);var role=gcr(ch);
  var slots=[];var tots={dmg:0,def_:0,rel:0,mob:0};
  ['left','right'].forEach(function(s){
    ST[s].forEach(function(s2,i){
      var e=s2.tid?fn(s2.tid):null;
      var r=e?ss(e,s2.lv,s,ch,cos):{dmg:0,def_:0,rel:0,mob:0,tot:0,dets:[],empty:true};r.empty=!e;
      slots.push({side:s,idx:i,num:i+1+(s==='right'?5:0),tuning:e,lv:s2.lv,r:r});
      if(e){tots.dmg+=r.dmg;tots.def_+=r.def_;tots.rel+=r.rel;tots.mob+=r.mob;}
    });
  });
  var specs=[];
  ST.specs.forEach(function(s,i){
    if(s&&s.tid){var se=fs(s.tid);if(se){var mx=cos&&cos.ra==='PUR'?11:5;var pct=n(s.lv)/mx;var sn=(se.skillName||se.name||'').trim();var q=SQ[sn]||60;specs.push({idx:i,special:se,lv:s.lv,score:{score:Math.round(q*(0.5+0.5*pct)),name:sn},empty:false});}}
    else specs.push({idx:i,empty:true,score:{score:0,name:'Empty'}});
  });
  // Realistic achievable maxima for a fully optimized build
  var maxD=10,maxDf=50,maxR=5,maxM=30;
  // Score damage: base + increase from all tunings, measured against 300 cap
  var primaryBase=100;
  try{
    var mhd=window.MULTI_HIT_DATA;var sk=ch.id+'_'+(ST.styleIdx||0);
    if(mhd&&mhd[sk]){
      Object.keys(mhd[sk]).forEach(function(t){
        var s=mhd[sk][t];
        if(s&&s.baseDamage){var lv9=s.baseDamage[Math.min(s.baseDamage.length-1,8)];if(lv9>primaryBase)primaryBase=lv9;}
      });
    }
  }catch(e){}
  var totalIncrease=tots.dmg; // sum of all tuning increases from ss()
  var tunedTotal=primaryBase+totalIncrease;
  console.log('COACH DEBUG: primaryBase='+primaryBase+' totalIncrease='+totalIncrease.toFixed(1)+' tunedTotal='+tunedTotal.toFixed(1)+' dmg%='+(tunedTotal/300*100).toFixed(1));
  var pct={damage:Math.min(100,tunedTotal/300*100),defense:Math.min(100,n(tots.def_)/maxDf*100),reload:Math.min(100,n(tots.rel)/maxR*100),mobility:Math.min(100,n(tots.mob)/maxM*100)};
  var spB=0,totalSpecScore=0,specCount=0;
  specs.forEach(function(s){
    if(s.score){totalSpecScore+=n(s.score.score);specCount++;}
    if(s.score)spB+=n(s.score.score)*0.01;
  });
  var avgSpecPct=specCount>0?totalSpecScore/specCount:0;
  // Add special tuning mobility contribution
  specs.forEach(function(s){
    if(s.score&&s.score.name){
      var nn=s.score.name.toLowerCase();
      if(nn.indexOf('wall runner')>=0||nn.indexOf('space hop')>=0||nn.indexOf('acceleration')>=0||nn.indexOf('revenge rapid')>=0)tots.mob+=8;
      if(nn.indexOf('crushing pu')>=0||nn.indexOf('pu turbo')>=0)tots.mob+=4;
    }
  });
  var overall=n(pct.damage)*0.35+n(pct.reload)*0.12+n(pct.defense)*0.15+n(pct.mobility)*0.10+n(avgSpecPct)*0.28;
  return{character:ch.n,role:role,overall:Math.round(Math.min(100,n(overall))*10)/10,categories:pct,slots:slots,specials:specs,totals:{dmg:Math.round(tots.dmg*10)/10,def_:Math.round(tots.def_*100)/100,rel:Math.round(tots.rel*10)/10,mob:Math.round(tots.mob)}};
}

function findProblems(analysis){
  var probs=[];if(!analysis||!analysis.slots)return probs;
  var ch=gc();var cos=gcos(ch);
  var role=gcr(ch);
  var isMobile=role==='Rapid';
  var isCQB=role==='Strike'||role==='Assault';

  // Count tunings by type for diminishing returns detection
  var dmgCount=0,hpCount=0,reloadCount=0,mobCount=0,gammaCount=0,alphaCount=0,betaCount=0;
  var hasSpecs={},specCounts={};
  analysis.slots.forEach(function(s){
    if(!s.tuning||s.r.empty)return;
    s.r.dets.forEach(function(d){
      if(d.t==='dmg'){
        dmgCount++;
        var txt=d.txt.toLowerCase();
        if(txt.indexOf('gamma')>=0||txt.indexOf(' y ')>=0)gammaCount++;
        else if(txt.indexOf('alpha')>=0||txt.indexOf(' a ')>=0)alphaCount++;
        else if(txt.indexOf('beta')>=0||txt.indexOf(' b ')>=0)betaCount++;
      }
      if(d.t==='stat'){hpCount++;}
      if(d.t==='rel'||d.t==='reload')reloadCount++;
      if(d.t==='mob')mobCount++;
      if(d.t==='def')hpCount++;
    });
  });

  // 1. Diminishing returns on reload (3+ reload tunings)
  if(reloadCount>=3){
    probs.push({slot:'Build-wide',name:'Over-invested in reload ('+reloadCount+'x)',effect:'Each extra reload gives less benefit. Swap 1-2 for damage.',contrib:0});
  }

  // 2. No survivability on close-range characters
  if(isCQB&&hpCount<2){
    probs.push({slot:'Build-wide',name:'Low survivability',effect:'Strike/Assault needs at least some HP/defense for close fights.',contrib:0});
  }

  // 2b. Too little damage investment overall
  var totalFilled=analysis.slots.filter(function(s){return !s.r.empty;}).length;
  if(totalFilled>=5&&dmgCount<3){
    probs.push({slot:'Build-wide',name:'Low damage investment',effect:'Only '+dmgCount+' of '+totalFilled+' slots boost damage. Double tunings (damage+reload, damage+HP) give best value.',contrib:0});
  }

  // 3. Check which specials are even available for this costume's slots
  var hasWallRunner=false,hasSpaceHop=false,hasRevenge=false,hasAccel=false;
  analysis.specials.forEach(function(sp){
    if(!sp.empty&&sp.score&&sp.score.name){
      var n=sp.score.name.toLowerCase();
      if(n.indexOf('wall runner')>=0)hasWallRunner=true;
      if(n.indexOf('space hop')>=0)hasSpaceHop=true;
      if(n.indexOf('revenge')>=0)hasRevenge=true;
      if(n.indexOf('acceleration')>=0)hasAccel=true;
    }
  });
  var specRoleL='',specRoleR='',specAlignL=null,specAlignR=null;
  if(cos&&cos.sp1){specRoleL=cos.sp1.r||'';specAlignL=cos.sp1.a||null;}
  if(cos&&cos.sp2){specRoleR=cos.sp2.r||'';specAlignR=cos.sp2.a||null;}
  var cn=CH_NUM[ch.id];
  var availLeft=window.specialOptions?window.specialOptions(specRoleL,cn,specAlignL,''):[];
  var availRight=window.specialOptions?window.specialOptions(specRoleR,cn,specAlignR,''):[];
  var allAvail=(availLeft||[]).concat(availRight||[]);
  var hasMobilitySpecial=false,hasRevengeSpecial=false;
  allAvail.forEach(function(s){
    var sn=(s.skillName||'').toLowerCase();
    if(sn.indexOf('wall runner')>=0||sn.indexOf('space hop')>=0||sn.indexOf('acceleration')>=0||sn.indexOf('revenge rapid')>=0)hasMobilitySpecial=true;
    if(sn.indexOf('revenge')>=0)hasRevengeSpecial=true;
  });
  if(!hasWallRunner&&!hasSpaceHop&&!hasAccel&&!hasMobilitySpecial&&!isMobile){
    // Only warn if a mobility special could actually be equipped
    probs.push({slot:'Special',name:'No mobility special',effect:'Consider a costume with Rapid/Assault special slots for Wall Runner or Space Hop.',contrib:0});
  }
  if(!hasRevenge&&hasRevengeSpecial){
    probs.push({slot:'Special',name:'No Revenge tuning',effect:'Revenge effects are very valuable. Your costume supports them!',contrib:0});
  }

  // 4. Fixer not optimized
  ST.specs.forEach(function(s,i){
    if(s&&s.tid){
      var se=findSpecial(s.tid);
      if(se&&(se.skillName||'').toLowerCase().indexOf('fixer')>=0){
        var slotSide=i===0?'left':'right';
        var totalDmg=0;
        analysis.slots.forEach(function(sl){
          if(sl.side===slotSide&&!sl.r.empty){sl.r.dets.forEach(function(d){totalDmg+=d.t==='dmg'?d.v:0;});}
        });
        if(totalDmg<5){
          probs.push({slot:'Build-wide',name:'Fixer not optimized',effect:'Fixer column has low damage. Replace column tunings with high-damage ones to maximize Fixer\'s multiplier.',contrib:0});
        }
      }
    }
  });

  // 5. Mismatched tunings — damage type doesn't match character's skills
  var damageTypesAvailable=[];
  var style=window.damageStyleFor?window.damageStyleFor(ch):null;
  if(style&&style.skills){
    style.skills.forEach(function(sk){
      if(sk&&sk.type&&sk.baseTable){
        var dmgIdx=sk.baseTable.headers.indexOf('Damage');
        if(dmgIdx>=0&&sk.baseTable.rows.length>1&&sk.baseTable.rows[1][dmgIdx]>0) damageTypesAvailable.push(sk.type);
      }
    });
  }
  var gammaCount=0,betaCount=0;
  analysis.slots.forEach(function(s){
    if(!s.tuning||s.r.empty)return;
    s.r.dets.forEach(function(d){
      if(d.t==='dmg'){
        var txt=d.txt.toLowerCase();
        if(txt.indexOf('gamma')>=0||txt.indexOf(' y ')>=0)gammaCount++;
        else if(txt.indexOf('beta')>=0)betaCount++;
      }
    });
  });
  if(gammaCount>=3&&damageTypesAvailable.indexOf('gamma')===-1){
    probs.push({slot:'Build-wide',name:'Gamma damage tunings wasted',effect:"This style's Gamma doesn't deal damage. Replace with Alpha/melee damage or HP/defense.",contrib:0});
  }
  if(betaCount>=3&&damageTypesAvailable.indexOf('beta')===-1){
    probs.push({slot:'Build-wide',name:'Beta damage tunings wasted',effect:"This style's Beta doesn't deal damage. Replace with Alpha damage or other effects.",contrib:0});
  }

  // 6. Ammo-weighted skill power check
  try{
    var ds=window.damageStyleFor?window.damageStyleFor(ch):null;
    if(ds&&ds.skills){
      ds.skills.forEach(function(sk){
        if(!sk.baseTable)return;
        var aI=sk.baseTable.headers.indexOf('Ammo');var dI=sk.baseTable.headers.indexOf('Damage');
        if(dI<0&&sk.additionalTable)dI=sk.additionalTable.headers.indexOf('Damage');
        if(dI<0)return;
        // Get base damage at level 9
        var baseDmg=0;
        for(var ri=1;ri<sk.baseTable.rows.length;ri++){var v=parseFloat(sk.baseTable.rows[ri][dI]);if(!isNaN(v)&&v>baseDmg)baseDmg=v;}
        if(baseDmg<=0&&sk.additionalTable){sk.additionalTable.rows.forEach(function(r){var v2=parseFloat(r[dI]);if(!isNaN(v2)&&v2>baseDmg)baseDmg=v2;});}
        if(baseDmg<=0)return;
        // Get ammo count
        var ammo=1;
        if(aI>=0){var raw=sk.baseTable.rows[Math.min(sk.baseTable.rows.length-1,8)];if(raw){var a=parseInt(String(raw[aI]).replace('x',''));if(!isNaN(a))ammo=a;}}
        // Check multi-hit
        var skey=ch.id+'_'+(ST.styleIdx||0);var hitMult=1;
        try{var mhd1=window.MULTI_HIT_DATA;if(mhd1&&mhd1[skey]&&mhd1[skey][sk.type])hitMult=mhd1[skey][sk.type].hitCount||1;}catch(e){}
        var perUseDmg=baseDmg*hitMult;
        var perMagDmg=perUseDmg*ammo;
        console.log('  '+sk.type.toUpperCase()+': '+baseDmg+'dmg x'+hitMult+'hits x'+ammo+'ammo = '+perUseDmg+'/use, '+perMagDmg+'/mag');
      });
    }
  }catch(e){}

  // 7. Empty slots
  analysis.slots.forEach(function(s){
    if(s.r.empty)probs.push({slot:'#'+s.num,name:'Empty slot',effect:'Equip a tuning here',contrib:0});
  });
  if(analysis.specials){analysis.specials.forEach(function(sp){if(sp.empty)probs.push({slot:'Special '+(sp.idx===0?'Left':'Right'),name:'Empty special',effect:'Fill this for big impact',contrib:0});});}

  return probs;
}

function suggestReplacements(analysis,ch,cos,probs){
  var suggs=[];if(!probs||!probs.length)return suggs;
  probs.forEach(function(prob){
    if(prob.slot.indexOf('Special')>=0||prob.slot==='Note'||prob.slot==='Build-wide')return;
    var sn=parseInt(prob.slot.replace('#',''))-1;var side=sn<5?'left':'right';var idx=sn<5?sn:sn-5;
    var curTid=side==='left'?ST.left[idx].tid:ST.right[idx].tid;
    var defs=bsd(ch,side);var sr=defs[idx]?defs[idx].r:'any';var sa=defs[idx]?defs[idx].a:null;
    var best=null,bestS=0;var opts=no(sr,sa,CH_NUM[ch.id],curTid);
    opts.forEach(function(o){if(ut()[o.id]&&o.id!==curTid)return;var r=ss(o,ST[side][idx].lv,side,ch,cos);if(r.tot>bestS){bestS=r.tot;best=o;}});
    if(best&&bestS>1){var rsn=best.subEffects&&best.subEffects[0]?(best.subEffects[0].skillName||best.subEffects[0].skillDesc):(best.skillName||'Better');suggs.push({slot:prob.slot,cur:prob.name,rep:best.name,gain:Math.round((bestS)*10)/10,reason:rsn});}
  });suggs.sort(function(a,b){return b.gain-a.gain;});return suggs;
}
return{analyzeBuild:analyzeBuild,findProblems:findProblems,suggestReplacements:suggestReplacements};})();
window.AICoach=AICoach;
