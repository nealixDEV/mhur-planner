// Advanced Costume Search Engine v2
(function(){
  var specialList = [];
  var normalTuningNames = [];

  function initTuningData(){
    if(specialList.length)return;
    for(var i=0;i<SPECIAL_TUNING.length;i++){
      var s=SPECIAL_TUNING[i];
      if(s.skillName && specialList.indexOf(s.skillName)===-1)specialList.push(s.skillName);
    }
    specialList.sort();
    normalTuningNames=[
      "Max HP+","Max DOWN HP+","HP Attack Power+","HP Defense+",
      "Max GP+","GP Attack Power+","GP Defense+",
      "Run Speed+","Dash Speed+","Wall Shuffle Speed+","Downed Crawl Speed+",
      "Forward Jump HT+","Vertical Jump HT+","Wall Jump HT+",
      "Quirk Skill \u03b1 Attack Power+","Quirk Skill \u03b2 Attack Power+","Quirk Skill \u03b3 Attack Power+",
      "Melee Attack Power+",
      "Quirk Skill \u03b1 Defense+","Quirk Skill \u03b2 Defense+","Quirk Skill \u03b3 Defense+",
      "Melee Defense+",
      "Quirk Skill \u03b1 Reload+","Quirk Skill \u03b2 Reload+","Quirk Skill \u03b3 Reload+",
      "Special Action Reload+","PU/PC Reload+","PU/PC Active Duration+"
    ];
  }

  function getSpecialOptions(){initTuningData();var o=[{v:"",l:"Any"}];for(var i=0;i<specialList.length;i++){o.push({v:specialList[i],l:specialList[i]});}return o;}

  // Character-aware normal tuning options — show all, but sort character-specific ones first
  function getNormalOptions(ch){
    initTuningData();
    var cn,chStr,subSet={};
    if(ch){cn=typeof CH_NUM!=='undefined'?CH_NUM[ch.id]:null;chStr=String(cn);}
    if(chStr && chStr!=='null' && chStr!=='undefined'){
      var data=typeof window.NORMAL_TUNING_DATA!=='undefined'?window.NORMAL_TUNING_DATA:[];
      for(var i=0;i<data.length;i++){
        var e=data[i];
        if(String(e.chara)!==chStr)continue;
        if(e.subEffects){
          for(var j=0;j<e.subEffects.length;j++){
            var sn=e.subEffects[j].skillName;
            if(sn)subSet[sn]=true;
          }
        }
      }
    }
    var charNames=Object.keys(subSet);
    var o=[{v:"",l:"Any"}];
    // Character-specific first
    if(charNames.length){
      charNames.sort();
      for(var i=0;i<charNames.length;i++){o.push({v:charNames[i],l:charNames[i]+" \u2605"});}
    }
    // Then all other normal tunings
    for(var i=0;i<normalTuningNames.length;i++){
      if(!subSet[normalTuningNames[i]]){o.push({v:normalTuningNames[i],l:normalTuningNames[i]});}
    }
    return o;
  }

  function canEquipSpecial(cosSlot,ch,specName){
    if(!cosSlot||!cosSlot.r||!specName)return false;
    var role=window.normRole(cosSlot.r);
    if(!role)return false;
    var align=cosSlot.a?cosSlot.a.toLowerCase():null;
    var available=specialOptions(role,null,align,null)||[];
    for(var i=0;i<available.length;i++){
      if(available[i].skillName===specName)return true;
    }
    return false;
  }

  function countTuningSlots(cos,effectName){
    var slotMap=cos.s||[];
    var count=0;
    var cleanName=effectName.replace(/[+]/g,'').trim().toLowerCase();
    for(var si=0;si<slotMap.length;si++){
      var slot=slotMap[si];
      if(!slot||!slot.r)continue;
      var slotRole=window.normRole(slot.r);
      for(var ni=0;ni<window.NORMAL_TUNING.length;ni++){
        var nt=window.NORMAL_TUNING[ni];
        if(window.normRole(nt.role)!==slotRole)continue;
        if(!nt.subEffects)continue;
        for(var ei=0;ei<nt.subEffects.length;ei++){
          var se=nt.subEffects[ei];
          if(se&&se.skillName){
            var sn=se.skillName.replace(/[+]/g,'').trim().toLowerCase();
            if(sn===cleanName || sn.indexOf(cleanName)!==-1 || cleanName.indexOf(sn)!==-1){
              count++;
              ni=window.NORMAL_TUNING.length;
              break;
            }
          }
        }
      }
    }
    return count;
  }

  function scoreCostume(cos,ch,filters){
    var score=0,maxScore=0;
    var totalSlots=10;
    var usedSlotsCount=0;

    var sp1=cos.sp1||(cos.s&&cos.s[0]?{r:cos.s[0].r,a:cos.s[0].a}:null);
    var sp2=cos.sp2||(cos.s&&cos.s[5]?{r:cos.s[5].r,a:cos.s[5].a}:null);

    var leftMatch=false,rightMatch=false;
    if(filters.leftSpec && filters.leftSpec!==""){
      leftMatch=canEquipSpecial(sp1,ch,filters.leftSpec) || canEquipSpecial(sp2,ch,filters.leftSpec);
      if(filters.lrPos && canEquipSpecial(sp1,ch,filters.leftSpec)){
        leftMatch=true;score+=10;
      }else if(!filters.lrPos && leftMatch){score+=10;}
      maxScore+=10;
    }
    if(filters.rightSpec && filters.rightSpec!==""){
      rightMatch=canEquipSpecial(sp2,ch,filters.rightSpec) || canEquipSpecial(sp1,ch,filters.rightSpec);
      if(filters.lrPos && canEquipSpecial(sp2,ch,filters.rightSpec)){
        rightMatch=true;score+=10;
      }else if(!filters.lrPos && rightMatch){score+=10;}
      maxScore+=10;
    }

    var tuningCounts={};
    if(filters.tunings && filters.tunings.length){
      for(var ti=0;ti<filters.tunings.length;ti++){
        var ft=filters.tunings[ti];
        if(!ft.name)continue;
        var count=countTuningSlots(cos,ft.name);
        tuningCounts[ft.name]=count;
        var emptySlots=0;
        var slotMap=cos.s||[];
        for(var ei=0;ei<slotMap.length;ei++){if(!slotMap[ei]||!slotMap[ei].tid)emptySlots++;}
        var totalPossible=count+emptySlots;
        if(ft.min){
          var achieved=Math.max(0,count);
          var pts=Math.min(achieved,ft.min)*5;
          score+=pts;
          maxScore+=ft.min*5;
          usedSlotsCount+=Math.min(achieved,ft.min);
        }
      }
    }
    var usedSlots=usedSlotsCount;
    var wasted=Math.max(0,totalSlots-usedSlots);
    var efficiency=maxScore>0?Math.round((score/maxScore)*100):0;
    return {
      score:score,maxScore:maxScore,efficiency:efficiency,
      used:usedSlots,wasted:wasted,
      leftScore:leftMatch?10:0,rightScore:rightMatch?10:0,
      tuningCounts:tuningCounts||{}
    };
  }

  function buildAdvancedSearch(modal,ch,baseRender){
    var advWrap=document.createElement("div");
    advWrap.className="adv-filter-wrap";

    var toggleBtn=document.createElement("button");
    toggleBtn.textContent="Advanced Filters";
    toggleBtn.className="adv-filter-toggle";
    advWrap.appendChild(toggleBtn);

    var panel=document.createElement("div");
    panel.className="adv-filter-panel";

    var specSec=document.createElement("div");
    specSec.className="adv-filter-section";
    var specTitle=document.createElement("div");
    specTitle.textContent="Special Slot Filters";
    specTitle.className="adv-filter-title";
    specSec.appendChild(specTitle);

    function makeSpecialRow(label,defVal){
      var row=document.createElement("div");row.className="adv-filter-row";
      var lbl=document.createElement("span");lbl.className="adv-filter-label";lbl.textContent=label;
      var sel=document.createElement("select");sel.className="adv-filter-select";
      var opts=getSpecialOptions();
      for(var i=0;i<opts.length;i++){var o=document.createElement("option");o.value=opts[i].v;o.textContent=opts[i].l.length>30?opts[i].l.slice(0,30)+'...':opts[i].l;sel.appendChild(o);}
      if(defVal)sel.value=defVal;
      row.appendChild(lbl);row.appendChild(sel);
      return {el:row,sel:sel};
    }
    var leftRow=makeSpecialRow("Left");
    var rightRow=makeSpecialRow("Right");
    specSec.appendChild(leftRow.el);specSec.appendChild(rightRow.el);

    var posRow=document.createElement("div");posRow.className="adv-filter-check-row";
    var posChk=document.createElement("input");posChk.type="checkbox";posChk.id="advPosChk2";posChk.className="adv-filter-check";
    var posLbl=document.createElement("label");posLbl.htmlFor="advPosChk2";posLbl.className="adv-filter-check-label";posLbl.textContent="Ignore slot position";
    posRow.appendChild(posChk);posRow.appendChild(posLbl);
    specSec.appendChild(posRow);

    var normSec=document.createElement("div");
    normSec.className="adv-filter-section";
    var normTitle=document.createElement("div");
    normTitle.textContent="Normal Tuning Filters (min slots)";
    normTitle.className="adv-filter-title";
    normSec.appendChild(normTitle);

    var tuningFilters=[];
    function addTuningRow(val,minVal){
      var row=document.createElement("div");row.className="adv-filter-tuning-row";
      var sel=document.createElement("select");sel.className="adv-filter-select";
      sel.style.fontSize='.5rem';
      var opts=getNormalOptions(ch);
      for(var i=0;i<opts.length;i++){var o=document.createElement("option");o.value=opts[i].v;o.textContent=opts[i].l;sel.appendChild(o);}
      if(val)sel.value=val;
      var minInput=document.createElement("input");minInput.type="number";minInput.min="1";minInput.max="10";minInput.value=minVal||"1";
      minInput.className="adv-filter-min";
      var rmBtn=document.createElement("span");rmBtn.textContent="X";rmBtn.className="adv-filter-rm";
      rmBtn.onclick=function(){row.remove();};
      row.appendChild(sel);row.appendChild(minInput);row.appendChild(rmBtn);
      tuningFilters.push({el:row,sel:sel,min:minInput});
      normSec.appendChild(row);
    }
    var addBtn=document.createElement("span");
    addBtn.textContent="+ Add Tuning";
    addBtn.className="adv-filter-add";
    addBtn.onclick=function(){addTuningRow();};
    normSec.appendChild(addBtn);

    var actions=document.createElement("div");actions.className="adv-filter-actions";
    var applyBtn=document.createElement("button");
    applyBtn.textContent="Apply";
    applyBtn.className="adv-filter-apply";
    actions.appendChild(applyBtn);
    var resetBtn=document.createElement("button");
    resetBtn.textContent="Clear";
    resetBtn.className="adv-filter-clear";
    actions.appendChild(resetBtn);
    panel.appendChild(specSec);panel.appendChild(normSec);panel.appendChild(actions);

    toggleBtn.onclick=function(){
      var open=panel.style.display!="none";
      panel.style.display=open?"none":"block";
      toggleBtn.textContent=open?"Advanced Filters":"Hide Filters";
    };
    advWrap.appendChild(panel);
    var body=modal.querySelector('.cos-modal-body');
    modal.insertBefore(advWrap,body);

    applyBtn.onclick=function(){
      var filters={
        leftSpec:leftRow.sel.value,
        rightSpec:rightRow.sel.value,
        lrPos:!posChk.checked,
        tunings:[]
      };
      for(var ti=0;ti<tuningFilters.length;ti++){
        var tf=tuningFilters[ti];
        var name=tf.sel.value;
        var min=parseInt(tf.min.value)||0;
        if(name){filters.tunings.push({name:name,min:min});}
      }
      var scored=[];
      var debugInfo='';
      for(var ci=0;ci<ch.c.length;ci++){
        var cos=ch.c[ci];
        var s={score:0,maxScore:0,efficiency:0,leftScore:0,rightScore:0,tuningCounts:{}};
        try{s=scoreCostume(cos,ch,filters);}catch(e){}
        var pass=true;
        if(filters.leftSpec && s.leftScore===0)pass=false;
        if(filters.rightSpec && s.rightScore===0)pass=false;
        if(filters.tunings && filters.tunings.length){
          for(var tti=0;tti<filters.tunings.length;tti++){
            var ft=filters.tunings[tti];
            if(!ft.name)continue;
            if(s.tuningCounts && s.tuningCounts[ft.name] < ft.min){pass=false;break;}
          }
        }
        scored.push({idx:ci,cos:cos,score:s,pass:pass});
        if(ci===0 && filters.leftSpec){
          var sp1=cos.sp1||(cos.s&&cos.s[0]?{r:cos.s[0].r}:null);
          var sp2=cos.sp2||(cos.s&&cos.s[5]?{r:cos.s[5].r}:null);
          var av1=sp1?specialOptions(String(sp1.r||"").toLowerCase(),null,sp1.a?sp1.a.toLowerCase():null,null):[];
          var av2=sp2?specialOptions(String(sp2.r||"").toLowerCase(),null,sp2.a?sp2.a.toLowerCase():null,null):[];
          debugInfo='Costume 0: "'+cos.n+'" | sp1:'+(sp1?sp1.r:'?')+' ('+av1.length+' avail) | sp2:'+(sp2?sp2.r:'?')+' ('+av2.length+' avail) | leftScore:'+s.leftScore;
        }
      }
      scored.sort(function(a,b){return b.score.score-a.score.score;});
      window.__advSearchResults=scored;
      var lbl=document.getElementById('advStatus');
      if(!lbl){
        lbl=document.createElement('div');lbl.id='advStatus';
        lbl.className='adv-filter-status';
        var be=document.querySelector('.cos-modal-body');
        if(be)be.insertBefore(lbl,be.firstChild);
      }
      var count=scored.filter(function(r){return r.pass;}).length;
      lbl.textContent='Pass: '+count+'/'+scored.length+' | '+debugInfo;
      baseRender();
    };
    resetBtn.onclick=function(){
      leftRow.sel.value="";rightRow.sel.value="";posChk.checked=false;
      tuningFilters.forEach(function(tf){tf.sel.value="";tf.min.value="1";});
      window.__advSearchResults=null;window.__advSearchFilters=null;
      baseRender();
    };
  }

  function init(){initTuningData();window.__advSearchResults=null;window.__advSearchFilters=null;}
  window.advSearchInit=init;
  window.advSearchBuild=buildAdvancedSearch;
  window.advSearchScore=scoreCostume;
  if(document.readyState==='complete')init();else window.addEventListener('DOMContentLoaded',init);
})();
