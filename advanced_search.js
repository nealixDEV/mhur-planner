// Advanced Costume Search Engine v2
(function(){
  var specialList = [];
  var normalTuningNames = [];

  function initTuningData(){
    if(specialList.length)return;
    // Collect all unique special tuning names
    for(var i=0;i<SPECIAL_TUNING.length;i++){
      var s=SPECIAL_TUNING[i];
      if(s.skillName && specialList.indexOf(s.skillName)===-1)specialList.push(s.skillName);
    }
    specialList.sort();
    // Exact normal tuning names from user spec
    normalTuningNames=[
      "Max HP+","Max DOWN HP+","HP Attack Power+","HP Defense+",
      "Max GP+","GP Attack Power+","GP Defense+",
      "Run Speed+","Dash Speed+","Wall Shuffle Speed+","Downed Crawl Speed+",
      "Forward Jump HT+","Vertical Jump HT+","Wall Jump HT+",
      "Quirk Skill α Attack Power+","Quirk Skill β Attack Power+","Quirk Skill γ Attack Power+",
      "Melee Attack Power+",
      "Quirk Skill α Defense+","Quirk Skill β Defense+","Quirk Skill γ Defense+",
      "Melee Defense+",
      "Quirk Skill α Reload+","Quirk Skill β Reload+","Quirk Skill γ Reload+",
      "Special Action Reload+","PU/PC Reload+","PU/PC Active Duration+"
    ];
  }

  function getSpecialOptions(){initTuningData();var o=[{v:"",l:"Any"}];for(var i=0;i<specialList.length;i++){o.push({v:specialList[i],l:specialList[i]});}return o;}
  function getNormalOptions(){initTuningData();var o=[{v:"",l:"Any"}];for(var i=0;i<normalTuningNames.length;i++){o.push({v:normalTuningNames[i],l:normalTuningNames[i]});}return o;}

  // Check if a costume slot can accept a given special tuning
  function canEquipSpecial(cosSlot,ch,specName){
    if(!cosSlot||!cosSlot.r||!specName)return false;
    var role=normRole(cosSlot.r);
    var align=cosSlot.a?cosSlot.a.toLowerCase():null;
    // Find the special tuning by name
    for(var i=0;i<SPECIAL_TUNING.length;i++){
      var st=SPECIAL_TUNING[i];
      if(st.skillName!==specName)continue;
      // Check role match
      if(normRole(st.role)!==role)continue;
      // Check alignment if specified
      if(align && st.class && st.class.toLowerCase()!==align)continue;
      return true;
    }
    return false;
  }

  // Count how many slots CAN equip a given tuning effect
  // Uses slot role + available normal tunings for that role
  function countTuningSlots(cos,effectName){
    var slotMap=cos.s||[];
    var count=0;
    var cleanName=effectName.replace(/[+]/g,'').trim().toLowerCase();
    for(var si=0;si<slotMap.length;si++){
      var slot=slotMap[si];
      if(!slot||!slot.r)continue;
      var slotRole=normRole(slot.r);
      // Find all normal tunings matching this slot role
      for(var ni=0;ni<NORMAL_TUNING.length;ni++){
        var nt=NORMAL_TUNING[ni];
        if(normRole(nt.role)!==slotRole)continue;
        if(!nt.subEffects)continue;
        for(var ei=0;ei<nt.subEffects.length;ei++){
          var se=nt.subEffects[ei];
          if(se&&se.skillName){
            var sn=se.skillName.replace(/[+]/g,'').trim().toLowerCase();
            if(sn===cleanName || sn.indexOf(cleanName)!==-1 || cleanName.indexOf(sn)!==-1){
              count++;
              ni=NORMAL_TUNING.length; // break outer loop
              break;
            }
          }
        }
      }
    }
    return count;
  }

  // Score a costume against filters
  function scoreCostume(cos,ch,filters){
    var score=0,maxScore=0;
    var totalSlots=10;
    var usedSlotsCount=0;

    var sp1=cos.sp1||(cos.s&&cos.s[0]?{r:cos.s[0].r,a:cos.s[0].a}:null);
    var sp2=cos.sp2||(cos.s&&cos.s[5]?{r:cos.s[5].r,a:cos.s[5].a}:null);

    // Special slot matching with role/alignment check
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

    // Normal tuning slot matching
    var tuningCounts={};
    if(filters.tunings && filters.tunings.length){
      for(var ti=0;ti<filters.tunings.length;ti++){
        var ft=filters.tunings[ti];
        if(!ft.name)continue;
        var count=countTuningSlots(cos,ft.name);
        tuningCounts[ft.name]=count;
        // Also count empty slots as potential
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

  // Build the advanced search UI
  function buildAdvancedSearch(modal,ch,baseRender){
    var advWrap=document.createElement("div");
    advWrap.style.cssText='padding:6px 8px 2px;border-bottom:1px solid rgba(72,208,218,.1);';

    var toggleBtn=document.createElement("button");
    toggleBtn.textContent="Advanced Filters";
    toggleBtn.style.cssText='width:100%;padding:5px;border:1px solid rgba(72,208,218,.2);border-radius:3px;background:rgba(72,208,218,.06);color:#b9f5f8;font-size:.62rem;font-weight:800;cursor:pointer;letter-spacing:.04em;';
    advWrap.appendChild(toggleBtn);

    var panel=document.createElement("div");
    panel.style.cssText='display:none;margin-top:5px;';

    // === SPECIAL SLOTS ===
    var specSec=document.createElement("div");
    specSec.style.cssText='margin-bottom:4px;';
    var specTitle=document.createElement("div");
    specTitle.textContent="Special Slot Filters";
    specTitle.style.cssText='font-size:.55rem;font-weight:900;color:#b9f5f8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;';
    specSec.appendChild(specTitle);

    function makeSpecialRow(label,defVal){
      var row=document.createElement("div");row.style.cssText='display:flex;gap:3px;align-items:center;margin-bottom:2px;';
      var lbl=document.createElement("span");lbl.textContent=label;lbl.style.cssText='font-size:.52rem;color:#7fa8ae;min-width:30px;';
      var sel=document.createElement("select");
      sel.style.cssText='flex:1;padding:2px 4px;font-size:.52rem;background:#030a0e;color:#e4fafb;border:1px solid rgba(72,208,218,.2);border-radius:2px;';
      var opts=getSpecialOptions();
      for(var i=0;i<opts.length;i++){var o=document.createElement("option");o.value=opts[i].v;o.textContent=opts[i].l.length>30?opts[i].l.slice(0,30)+'...':opts[i].l;sel.appendChild(o);}
      if(defVal)sel.value=defVal;
      row.appendChild(lbl);row.appendChild(sel);
      return {el:row,sel:sel};
    }
    var leftRow=makeSpecialRow("Left");
    var rightRow=makeSpecialRow("Right");
    specSec.appendChild(leftRow.el);specSec.appendChild(rightRow.el);

    var posRow=document.createElement("div");posRow.style.cssText='display:flex;align-items:center;gap:3px;margin-bottom:2px;';
    var posChk=document.createElement("input");posChk.type="checkbox";posChk.id="advPosChk2";posChk.style.cssText='accent-color:#f59e0b;width:11px;height:11px;';
    var posLbl=document.createElement("label");posLbl.htmlFor="advPosChk2";posLbl.style.cssText='font-size:.5rem;color:#7fa8ae;';posLbl.textContent="Ignore slot position";
    posRow.appendChild(posChk);posRow.appendChild(posLbl);
    specSec.appendChild(posRow);

    // === NORMAL TUNING SLOTS ===
    var normSec=document.createElement("div");
    normSec.style.cssText='margin-bottom:4px;';
    var normTitle=document.createElement("div");
    normTitle.textContent="Normal Tuning Filters (min slots)";
    normTitle.style.cssText='font-size:.55rem;font-weight:900;color:#b9f5f8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;';
    normSec.appendChild(normTitle);

    var tuningFilters=[];
    function addTuningRow(val,minVal){
      var row=document.createElement("div");row.style.cssText='display:flex;gap:2px;align-items:center;margin-bottom:1px;';
      var sel=document.createElement("select");
      sel.style.cssText='flex:1;padding:1px 3px;font-size:.5rem;background:#030a0e;color:#e4fafb;border:1px solid rgba(72,208,218,.15);border-radius:2px;';
      var opts=getNormalOptions();
      for(var i=0;i<opts.length;i++){var o=document.createElement("option");o.value=opts[i].v;o.textContent=opts[i].l;sel.appendChild(o);}
      if(val)sel.value=val;
      var minInput=document.createElement("input");minInput.type="number";minInput.min="1";max="10";minInput.value=minVal||"1";
      minInput.style.cssText='width:26px;padding:1px 2px;font-size:.5rem;background:#030a0e;color:#e4fafb;border:1px solid rgba(72,208,218,.15);border-radius:2px;text-align:center;';
      var rmBtn=document.createElement("span");rmBtn.textContent="X";rmBtn.style.cssText='font-size:.45rem;color:#ef4444;cursor:pointer;padding:1px 3px;';
      rmBtn.onclick=function(){row.remove();};
      row.appendChild(sel);row.appendChild(minInput);row.appendChild(rmBtn);
      tuningFilters.push({el:row,sel:sel,min:minInput});
      normSec.appendChild(row);
    }
    var addBtn=document.createElement("span");
    addBtn.textContent="+ Add Tuning";
    addBtn.style.cssText='display:inline-block;font-size:.5rem;color:#b9f5f8;cursor:pointer;padding:1px 4px;border:1px dashed rgba(72,208,218,.15);border-radius:2px;margin-top:1px;';
    addBtn.onclick=function(){addTuningRow();};
    normSec.appendChild(addBtn);

    // === ACTIONS ===
    var actions=document.createElement("div");actions.style.cssText='display:flex;gap:3px;margin-top:4px;';
    var applyBtn=document.createElement("button");
    applyBtn.textContent="Apply";
    applyBtn.style.cssText='flex:1;padding:4px;border:none;border-radius:3px;background:linear-gradient(180deg,#ffe064,#e4aa09);color:#1d1b0d;font-size:.58rem;font-weight:900;cursor:pointer;';
    actions.appendChild(applyBtn);
    var resetBtn=document.createElement("button");
    resetBtn.textContent="Clear";
    resetBtn.style.cssText='padding:4px 8px;border:1px solid rgba(72,208,218,.15);border-radius:2px;background:transparent;color:#7fa8ae;font-size:.52rem;cursor:pointer;';
    actions.appendChild(resetBtn);
    panel.appendChild(specSec);panel.appendChild(normSec);panel.appendChild(actions);

    toggleBtn.onclick=function(){
      var open=panel.style.display!="none";
      panel.style.display=open?"none":"block";
      toggleBtn.textContent=open?"Advanced Filters":"Hide Filters";
    };
    advWrap.appendChild(panel);
    // Insert after searchWrap, before body
    var body=modal.querySelector('.cos-modal-body');
    modal.insertBefore(advWrap,body);

    // Apply
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
      }
      scored.sort(function(a,b){return b.score.score-a.score.score;});
      window.__advSearchResults=scored;
      // Debug label
      var lbl=document.getElementById('advStatus');
      if(!lbl){
        lbl=document.createElement('div');lbl.id='advStatus';
        lbl.style.cssText='padding:3px 6px;font-size:.5rem;color:#f59e0b;background:rgba(245,158,11,.08);border-radius:2px;text-align:center;';
        var be=document.querySelector('.cos-modal-body');
        if(be)be.insertBefore(lbl,be.firstChild);
      }
      var count=scored.filter(function(r){return r.pass;}).length;
      lbl.textContent='Pass: '+count+'/'+scored.length;
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
