// Advanced Costume Search Engine
// Integrates into the existing costume modal as an expandable panel

(function(){
  // ===== DATA HELPERS =====
  var specialList = [];
  var tuningCategories = {};
  var allTuningNames = [];

  function initTuningData(){
    if(specialList.length)return;
    for(var i=0;i<SPECIAL_TUNING.length;i++){
      var s=SPECIAL_TUNING[i];
      if(specialList.indexOf(s.skillName)===-1)specialList.push(s.skillName);
    }
    specialList.sort();
    // Normal tuning categories
    var cats={
      "Attack Power":[],"HP":[],"GP":[],"Reload":[],"Dash Speed":[],"Run Speed":[],"Jump HT":[],
      "Melee":[],"Defense":[],"Alpha":[],"Beta":[],"Gamma":[],"Special Action":[],"PU/PC":[],"DOWN HP":[],"Crawl Speed":[],"Wall Jump":[],"Forward Jump":[],"Reversal":[]
    };
    for(var j=0;j<NORMAL_TUNING.length;j++){
      var t=NORMAL_TUNING[j];
      if(!t.subEffects)continue;
      for(var k=0;k<t.subEffects.length;k++){
        var se=t.subEffects[k];
        if(!se||!se.skillName)continue;
        var name=se.skillName.replace(/[+]/g,'').trim();
        if(allTuningNames.indexOf(name)===-1)allTuningNames.push(name);
        for(var c in cats){
          if(name.toLowerCase().indexOf(c.toLowerCase())!==-1){
            if(cats[c].indexOf(name)===-1)cats[c].push(name);
          }
        }
      }
    }
    tuningCategories=cats;
  }

  // ===== DATA-DRIVEN SPECIAL FILTER =====
  function getSpecialOptions(){initTuningData();var o=[{v:"",l:"Any"}];for(var i=0;i<specialList.length;i++){o.push({v:specialList[i],l:specialList[i]});}return o;}
  function getNormalTuningOptions(){initTuningData();var o=[{v:"",l:"Any"}];for(var i=0;i<allTuningNames.length;i++){o.push({v:allTuningNames[i],l:allTuningNames[i]});}return o;}

  // ===== SCORE A COSTUME AGAINST FILTERS =====
  function scoreCostume(cos,ch,filters){
    var score=0,maxScore=0;
    var totalSlots=10;
    var usedSlots=0;
    // Count special slot matches
    var sp1=cos.sp1||(cos.s&&cos.s[0]?{r:cos.s[0].r}:null);
    var sp2=cos.sp2||(cos.s&&cos.s[5]?{r:cos.s[5].r}:null);
    var sp1Name=sp1?(sp1.sn||""):"";
    var sp2Name=sp2?(sp2.sn||""):"";

    if(filters.leftSpec && filters.leftSpec!==""){
      maxScore+=10;
      var matchL=sp1Name.toLowerCase()===filters.leftSpec.toLowerCase() || sp2Name.toLowerCase()===filters.leftSpec.toLowerCase();
      if(filters.lrPos && sp1Name.toLowerCase()===filters.leftSpec.toLowerCase()){score+=10;}
      else if(!filters.lrPos && matchL){score+=10;}
    }
    if(filters.rightSpec && filters.rightSpec!==""){
      maxScore+=10;
      var matchR=sp2Name.toLowerCase()===filters.rightSpec.toLowerCase() || sp1Name.toLowerCase()===filters.rightSpec.toLowerCase();
      if(filters.lrPos && sp2Name.toLowerCase()===filters.rightSpec.toLowerCase()){score+=10;}
      else if(!filters.lrPos && matchR){score+=10;}
    }
    // Normal tuning slot matching
    if(filters.tunings && filters.tunings.length){
      var slotMap=cos.s||[];
      for(var ti=0;ti<filters.tunings.length;ti++){
        var ft=filters.tunings[ti];
        if(!ft.name)continue;
        var count=0;
        for(var si=0;si<slotMap.length;si++){
          var slot=slotMap[si];
          if(!slot||!slot.tid)continue;
          var e=findNormal(slot.tid);
          if(!e||!e.subEffects)continue;
          for(var ei=0;ei<e.subEffects.length;ei++){
            var se=e.subEffects[ei];
            if(se&&se.skillName&&se.skillName.toLowerCase().indexOf(ft.name.toLowerCase())!==-1){
              count++;
            }
          }
        }
        if(ft.min){
          var pts=Math.min(count,ft.min)*5;
          score+=pts;
          maxScore+=ft.min*5;
        }
        if(ft.max){
          var pts2=count*3;
          score+=pts2;
          maxScore+=10;
        }
        // Track used slots
        usedSlots+=Math.min(count,10);
      }
    }
    // Wasted slot detection
    var wasted=Math.max(0,totalSlots-usedSlots);
    var efficiency=maxScore>0?Math.round((score/maxScore)*100):0;
    return {score:score,maxScore:maxScore,efficiency:efficiency,used:usedSlots,wasted:wasted};
  }

  // ===== BUILD ADVANCED SEARCH UI =====
  function buildAdvancedSearch(modalBody,ch,baseRender){
    var advWrap=document.createElement("div");
    advWrap.style.cssText='margin-top:8px;border-top:1px solid rgba(72,208,218,.15);padding:8px 0 0;';

    // Toggle button
    var toggleBtn=document.createElement("button");
    toggleBtn.textContent="Advanced Filters";
    toggleBtn.style.cssText='width:100%;padding:6px;border:1px solid rgba(72,208,218,.25);border-radius:4px;background:rgba(72,208,218,.06);color:#b9f5f8;font-size:.68rem;font-weight:800;cursor:pointer;';
    advWrap.appendChild(toggleBtn);

    var panel=document.createElement("div");
    panel.style.cssText='display:none;margin-top:6px;';

    // === Special Slot Filters ===
    var specSection=document.createElement("div");
    specSection.style.cssText='margin-bottom:6px;';
    var specTitle=document.createElement("div");
    specTitle.textContent="Special Slots";
    specTitle.style.cssText='font-size:.6rem;font-weight:900;color:#b9f5f8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;';
    specSection.appendChild(specTitle);

    // Left Special
    var leftRow=document.createElement("div");leftRow.style.cssText='display:flex;gap:4px;align-items:center;margin-bottom:3px;';
    var leftLbl=document.createElement("span");leftLbl.textContent="Left:";leftLbl.style.cssText='font-size:.58rem;color:#7fa8ae;min-width:30px;';
    var leftSel=document.createElement("select");
    leftSel.style.cssText='flex:1;padding:3px 5px;font-size:.6rem;background:#030a0e;color:#e4fafb;border:1px solid rgba(72,208,218,.2);border-radius:3px;';
    var sopts=getSpecialOptions();
    for(var i=0;i<sopts.length;i++){var o=document.createElement("option");o.value=sopts[i].v;o.textContent=sopts[i].l;leftSel.appendChild(o);}
    leftRow.appendChild(leftLbl);leftRow.appendChild(leftSel);
    specSection.appendChild(leftRow);

    // Right Special
    var rightRow=document.createElement("div");rightRow.style.cssText='display:flex;gap:4px;align-items:center;margin-bottom:3px;';
    var rightLbl=document.createElement("span");rightLbl.textContent="Right:";rightLbl.style.cssText='font-size:.58rem;color:#7fa8ae;min-width:30px;';
    var rightSel=document.createElement("select");
    rightSel.style.cssText='flex:1;padding:3px 5px;font-size:.6rem;background:#030a0e;color:#e4fafb;border:1px solid rgba(72,208,218,.2);border-radius:3px;';
    var sopts2=getSpecialOptions();
    for(var j=0;j<sopts2.length;j++){var o2=document.createElement("option");o2.value=sopts2[j].v;o2.textContent=sopts2[j].l;rightSel.appendChild(o2);}
    rightRow.appendChild(rightLbl);rightRow.appendChild(rightSel);
    specSection.appendChild(rightRow);

    // Position checkbox
    var posRow=document.createElement("div");posRow.style.cssText='display:flex;align-items:center;gap:4px;margin-bottom:4px;';
    var posChk=document.createElement("input");posChk.type="checkbox";posChk.id="advPosChk";posChk.style.cssText='accent-color:#f59e0b;';
    var posLbl=document.createElement("label");posLbl.htmlFor="advPosChk";posLbl.style.cssText='font-size:.55rem;color:#7fa8ae;';posLbl.textContent="Ignore slot position (match either slot)";
    posRow.appendChild(posChk);posRow.appendChild(posLbl);
    specSection.appendChild(posRow);

    // === Normal Tuning Filters ===
    var normSection=document.createElement("div");
    normSection.style.cssText='margin-bottom:6px;';
    var normTitle=document.createElement("div");
    normTitle.textContent="Normal Tuning Slots";
    normTitle.style.cssText='font-size:.6rem;font-weight:900;color:#b9f5f8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;';
    normSection.appendChild(normTitle);

    var tuningFilters=[];
    function addTuningRow(name,val){
      var row=document.createElement("div");row.style.cssText='display:flex;gap:3px;align-items:center;margin-bottom:2px;';
      var sel=document.createElement("select");
      sel.style.cssText='flex:1;padding:2px 4px;font-size:.55rem;background:#030a0e;color:#e4fafb;border:1px solid rgba(72,208,218,.2);border-radius:3px;';
      var nopts=getNormalTuningOptions();
      for(var ni=0;ni<nopts.length;ni++){var no=document.createElement("option");no.value=nopts[ni].v;no.textContent=nopts[ni].l;sel.appendChild(no);}
      if(val)sel.value=val;
      var minInput=document.createElement("input");minInput.type="number";minInput.min="1";minInput.max="10";minInput.value="1";
      minInput.style.cssText='width:32px;padding:2px;font-size:.55rem;background:#030a0e;color:#e4fafb;border:1px solid rgba(72,208,218,.2);border-radius:3px;text-align:center;';
      var rmBtn=document.createElement("span");rmBtn.textContent="X";rmBtn.style.cssText='font-size:.5rem;color:#ef4444;cursor:pointer;padding:2px;';
      rmBtn.onclick=function(){row.remove();};
      row.appendChild(sel);row.appendChild(minInput);
      if(name){} // placeholder
      row.appendChild(rmBtn);
      // Store references for filtering
      tuningFilters.push({el:row,sel:sel,min:minInput});
      normSection.appendChild(row);
    }

    var addBtn=document.createElement("span");
    addBtn.textContent="+ Add Tuning Filter";
    addBtn.style.cssText='display:inline-block;font-size:.55rem;color:#b9f5f8;cursor:pointer;padding:2px 4px;border:1px dashed rgba(72,208,218,.2);border-radius:3px;margin-top:2px;';
    addBtn.onclick=function(){addTuningRow();};
    normSection.appendChild(addBtn);

    // === Action Buttons ===
    var actions=document.createElement("div");actions.style.cssText='display:flex;gap:4px;margin-top:6px;';
    var applyBtn=document.createElement("button");
    applyBtn.textContent="Apply Filters";
    applyBtn.style.cssText='flex:1;padding:5px;border:none;border-radius:3px;background:linear-gradient(180deg,#ffe064,#e4aa09);color:#1d1b0d;font-size:.62rem;font-weight:900;cursor:pointer;';
    actions.appendChild(applyBtn);

    var resetBtn=document.createElement("button");
    resetBtn.textContent="Reset";
    resetBtn.style.cssText='padding:5px 10px;border:1px solid rgba(72,208,218,.2);border-radius:3px;background:transparent;color:#7fa8ae;font-size:.58rem;cursor:pointer;';
    actions.appendChild(resetBtn);
    panel.appendChild(specSection);panel.appendChild(normSection);panel.appendChild(actions);

    // Toggle panel
    toggleBtn.onclick=function(){
      var open=panel.style.display!="none";
      panel.style.display=open?"none":"block";
      toggleBtn.textContent=open?"Advanced Filters":"Hide Filters";
    };
    advWrap.appendChild(panel);
    modalBody.appendChild(advWrap);

    // Apply filters
    applyBtn.onclick=function(){
      var filters={
        leftSpec:leftSel.value,
        rightSpec:rightSel.value,
        lrPos:!posChk.checked,
        tunings:[]
      };
      for(var ti=0;ti<tuningFilters.length;ti++){
        var tf=tuningFilters[ti];
        var name=tf.sel.value;
        var min=parseInt(tf.min.value)||0;
        if(name){filters.tunings.push({name:name,min:min});}
      }
      // Score costumes
      var scored=[];
      for(var ci=0;ci<ch.c.length;ci++){
        var cos=ch.c[ci];
        var s=scoreCostume(cos,ch,filters);
        scored.push({idx:ci,cos:cos,score:s});
      }
      scored.sort(function(a,b){return b.score.score-a.score.score;});
      // Store scored results for rendering
      window.__advSearchResults=scored;
      window.__advSearchFilters=filters;
      // Re-render base with advanced filter
      baseRender();
    };

    resetBtn.onclick=function(){
      leftSel.value="";rightSel.value="";posChk.checked=false;
      tuningFilters.forEach(function(tf){tf.sel.value="";tf.min.value="1";});
      window.__advSearchResults=null;
      window.__advSearchFilters=null;
      baseRender();
    };
  }

  // ===== INTERCEPT THE RENDER FUNCTION =====
  function init(){
    initTuningData();
    // Patch the render function in the costume modal to support advanced search
    var origOpen=window.openCosModal;
    // Store orig for later use
    window.__advSearchOrigRender=null;
    window.__advSearchResults=null;
    window.__advSearchFilters=null;
  }

  // Expose to global scope
  window.advSearchInit=init;
  window.advSearchBuild=buildAdvancedSearch;
  window.advSearchScore=scoreCostume;

  // Auto-init on load
  if(document.readyState==='complete')init();else window.addEventListener('DOMContentLoaded',init);
})();
