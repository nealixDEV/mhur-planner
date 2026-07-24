// Build PNG Generator - Premium Edition
function generateBuildPNG(){
  var ch=gc();
  if(!ch){alert('Select a character first.');return;}
  var W=1200,H=800;
  var cv=document.createElement('canvas');cv.width=W;cv.height=H;
  var ctx=cv.getContext('2d');
  var role=getCharacterRole(ch);
  var cos=ch.c?ch.c[ST.cosIdx]:null;
  var cosName=cos?cos.n:'Default Costume';
  var cosImgList=COSTUME_IMG[CH_NUM[ch.id]];
  var RC={'Strike':'#dc2626','Assault':'#d97706','Rapid':'#2563eb','Technical':'#7c3aed','Support':'#16a34a'};
  var rc=RC[role]||'#94a3b8';
  var RCGlow={'Strike':'rgba(220,38,38,','Assault':'rgba(217,119,6,','Rapid':'rgba(37,99,235,','Technical':'rgba(124,58,237,','Support':'rgba(22,163,74,'};
  var rcGlow=RCGlow[role]||'rgba(148,163,184,';
  var playerName=localStorage.getItem('forumUsername')||'YourPlayerName';
  var slotImgs={};var specIcons={};
  document.getElementById('btnPng').textContent='Generating...';

  var alL=function(){ctx.textAlign='left';};
  var alR=function(){ctx.textAlign='right';};
  var alC=function(){ctx.textAlign='center';};

  function loadImg(src){
    return new Promise(function(resolve){
      if(!src){resolve(null);return;}
      var img=new Image();img.crossOrigin='anonymous';
      img.onload=function(){resolve(img);};
      img.onerror=function(){resolve(null);};
      img.src='/img-proxy?url='+encodeURIComponent(src);
    });
  }

  function rr(x,y,w,h,r,fill,stroke){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  }

  function bdg(x,y,text,color,sz){
    var fs=sz||14;
    ctx.font='bold '+fs+'px Rajdhani,sans-serif';
    var tw=ctx.measureText(text).width+14;
    rr(x,y,tw,fs+10,5,color);
    ctx.fillStyle='#fff';
    alC();
    ctx.fillText(text,x+tw/2,y+fs+5);
    alL();
  }

  function wrap(txt,x,y,mw,lh){
    if(!txt)return y;
    var words=txt.split(' '),line='';
    for(var i=0;i<words.length;i++){
      var test=line+words[i]+' ';
      if(ctx.measureText(test).width>mw&&line!==''){
        ctx.fillText(line.trim(),x,y);y+=lh;line=words[i]+' ';
      }else{line=test;}
    }
    if(line)ctx.fillText(line.trim(),x,y);
    return y;
  }

  function circ(x,y,sz,img,bc){
    if(img){
      ctx.save();ctx.beginPath();ctx.arc(x+sz/2,y+sz/2,sz/2,0,Math.PI*2);
      ctx.clip();ctx.drawImage(img,x,y,sz,sz);ctx.restore();
    }
    if(bc){
      ctx.strokeStyle=bc;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(x+sz/2,y+sz/2,sz/2,0,Math.PI*2);ctx.stroke();
    }
  }

  function drawStatIcon(type,cx,cy,s){
    ctx.save();
    if(type==='heart'){
      ctx.fillStyle='#ef4444';
      ctx.beginPath();
      ctx.arc(cx,cy+s*0.32,s*0.32,Math.PI,0);
      ctx.arc(cx+s*0.32,cy+s*0.32,s*0.32,Math.PI,0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx-s*0.52,cy+s*0.35);
      ctx.lineTo(cx,cy+s*0.9);
      ctx.lineTo(cx+s*0.52,cy+s*0.35);
      ctx.fill();
    }else if(type==='bolt'){
      ctx.fillStyle='#38bdf8';
      ctx.beginPath();
      ctx.moveTo(cx+s*0.1,cy);
      ctx.lineTo(cx-s*0.2,cy+s*0.4);
      ctx.lineTo(cx+s*0.08,cy+s*0.37);
      ctx.lineTo(cx-s*0.1,cy+s);
      ctx.lineTo(cx+s*0.22,cy+s*0.43);
      ctx.lineTo(cx,cy+s*0.46);
      ctx.closePath();
      ctx.fill();
    }else if(type==='shield'){
      ctx.fillStyle='#4ade80';
      ctx.beginPath();
      ctx.moveTo(cx-s*0.38,cy);
      ctx.lineTo(cx+s*0.38,cy);
      ctx.lineTo(cx+s*0.38,cy+s*0.48);
      ctx.quadraticCurveTo(cx,cy+s*0.95,cx-s*0.38,cy+s*0.48);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function letterSpacingDraw(text,x,y,spacing){
    var cx2=x;
    for(var i=0;i<text.length;i++){
      ctx.fillText(text[i],cx2,y);
      cx2+=ctx.measureText(text[i]).width+spacing;
    }
  }
  function letterSpacingStroke(text,x,y,spacing){
    var cx2=x;
    for(var i=0;i<text.length;i++){
      ctx.strokeText(text[i],cx2,y);
      cx2+=ctx.measureText(text[i]).width+spacing;
    }
  }

  async function render(){
    var chNum=CH_NUM[ch.id];
    var cosImg=null;
    if(cosImgList&&cosImgList[ST.cosIdx]!==undefined){
      var cn2=String(chNum).padStart(3,'0');
      cosImg=await loadImg(BASE+'Ch'+cn2+'/GUI/Costume/L/T_ui_Thumb_4_'+cosImgList[ST.cosIdx]+'_L.png');
    }
    var bannerImg=chNum?await loadImg(bnPortrait(chNum,ST.styleIdx)):null;

    slotImgs={};specIcons={};
    var proms=[];
    ST.left.concat(ST.right).forEach(function(s){
      if(!s||!s.tid)return;
      var e=findNormal(s.tid);
      if(e&&e.chara&&!slotImgs[e.chara]){
        var pNum=parseInt(e.chara);
        if(pNum){slotImgs[e.chara]=null;proms.push(loadImg(portraitHQ(pNum)).then(function(img){slotImgs[e.chara]=img;}));}
      }
    });
    ST.specs.forEach(function(s){
      if(!s||!s.tid)return;
      var e=findSpecial(s.tid);
      if(e){
        var iconUrl=specialTuningIcon(e);
        if(iconUrl){specIcons[s.tid]=null;proms.push(loadImg(iconUrl).then(function(img){specIcons[s.tid]=img;}));}
        if(e.chara&&!slotImgs[e.chara]){
          var pN=parseInt(e.chara);
          if(pN){slotImgs[e.chara]=null;proms.push(loadImg(portraitHQ(pN)).then(function(img){slotImgs[e.chara]=img;}));}
        }
      }
    });
    await Promise.all(proms);

    // === BACKGROUND: dark navy gradient + purple glow + vignette ===
    var bgGrad=ctx.createLinearGradient(0,0,0,H);
    bgGrad.addColorStop(0,'#080c18');
    bgGrad.addColorStop(0.5,'#0d1225');
    bgGrad.addColorStop(1,'#080c18');
    ctx.fillStyle=bgGrad;ctx.fillRect(0,0,W,H);

    var purpleGlow=ctx.createRadialGradient(W*0.35,H*0.5,0,W*0.35,H*0.5,W*0.5);
    purpleGlow.addColorStop(0,'rgba(88,28,135,0.08)');
    purpleGlow.addColorStop(0.6,'rgba(88,28,135,0.03)');
    purpleGlow.addColorStop(1,'rgba(88,28,135,0)');
    ctx.fillStyle=purpleGlow;ctx.fillRect(0,0,W,H);

    if(bannerImg){ctx.save();ctx.globalAlpha=0.08;ctx.drawImage(bannerImg,0,0,W,H);ctx.restore();}

    var vig=ctx.createRadialGradient(W/2,H/2,W*0.28,W/2,H/2,W*0.75);
    vig.addColorStop(0,'rgba(0,0,0,0)');
    vig.addColorStop(1,'rgba(0,0,0,0.55)');
    ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

    // === HEADER BAR ===
    rr(0,0,W,56,0,'#0c1020');
    ctx.fillStyle=rc;ctx.fillRect(0,55,W,2);
    ctx.fillStyle='#f5c800';ctx.font='bold 20px Rajdhani,sans-serif';alL();
    ctx.fillText('MY HERO',16,23);
    ctx.font='bold 14px Rajdhani,sans-serif';ctx.fillText('ULTRA RUMBLE',16,41);
    ctx.fillStyle='#f1f5f9';ctx.font='bold 20px Rajdhani,sans-serif';
    ctx.fillText('BUILD SUMMARY',128,25);
    bdg(128,32,role+' Type',rc,11);
    ctx.fillStyle='#64748b';ctx.font='bold 10px Rajdhani,sans-serif';alR();
    ctx.fillText('BUILT WITH',W-16,14);
    ctx.fillStyle='#f5c800';ctx.font='bold 14px Rajdhani,sans-serif';
    ctx.fillText('MHUR T.U.N.I.N.G. PLANNER',W-16,30);
    ctx.fillStyle='#e2e8f0';ctx.font='bold 11px Rajdhani,sans-serif';
    ctx.fillText('mhur-planner.duckdns.org',W-16,44);
    alL();

    // === CHARACTER ART with radial glow + floor shadow ===
    var artEndX=310;
    if(cosImg){
      var boxH=H-56-36;
      var imgRatio=cosImg.width/cosImg.height;
      var drawH=boxH;
      var drawW=drawH*imgRatio;
      var drawX=drawW<=artEndX?(artEndX-drawW)/2:-(drawW-artEndX)/2;

      // Radial glow behind character
      var artGlow=ctx.createRadialGradient(artEndX/2-20,H/2,10,artEndX/2-20,H/2,220);
      artGlow.addColorStop(0,rcGlow+'0.14)');
      artGlow.addColorStop(0.5,rcGlow+'0.05)');
      artGlow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=artGlow;ctx.fillRect(0,56,artEndX+20,boxH);

      // Clip and draw character
      ctx.save();
      ctx.beginPath();ctx.rect(0,56,artEndX,boxH);ctx.clip();
      ctx.drawImage(cosImg,drawX,56,drawW,drawH);
      ctx.restore();

      // Floor shadow at bottom of character area
      var floorShadow=ctx.createLinearGradient(0,H-36,0,H-110);
      floorShadow.addColorStop(0,'rgba(0,0,0,0.5)');
      floorShadow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=floorShadow;ctx.fillRect(0,H-110,artEndX,74);

      // Fade right edge
      var fg=ctx.createLinearGradient(artEndX-50,0,artEndX+20,0);
      fg.addColorStop(0,'rgba(8,12,24,0)');fg.addColorStop(1,'rgba(8,12,24,1)');
      ctx.fillStyle=fg;ctx.fillRect(artEndX-50,56,70,boxH);
    }

    // === INFO OVERLAY ===
    var ix=20,iw=artEndX-40,iy=H-260;
    var infoOverlay=ctx.createLinearGradient(0,H-320,0,H-36);
    infoOverlay.addColorStop(0,'rgba(8,12,24,0)');
    infoOverlay.addColorStop(0.2,'rgba(8,12,24,.85)');
    infoOverlay.addColorStop(1,'rgba(8,12,24,.95)');
    ctx.fillStyle=infoOverlay;ctx.fillRect(0,H-320,artEndX+20,320-36);

    // Character name: golden gradient + glow + outline
    var nameSize=38;
    var nameText=ch.n.toUpperCase();
    ctx.font='bold '+nameSize+'px Rajdhani,sans-serif';
    var approxW=ctx.measureText(nameText).width+nameText.length*3;
    while(approxW>iw&&nameSize>22){
      nameSize-=2;
      ctx.font='bold '+nameSize+'px Rajdhani,sans-serif';
      approxW=ctx.measureText(nameText).width+nameText.length*3;
    }
    // Shadow glow
    ctx.save();
    ctx.shadowColor='rgba(245,200,0,0.5)';
    ctx.shadowBlur=20;
    // Outline
    ctx.strokeStyle='#1a1200';
    ctx.lineWidth=4;
    ctx.lineJoin='round';
    letterSpacingStroke(nameText,ix,iy,3);
    // Golden gradient fill
    var nameGrad=ctx.createLinearGradient(ix,iy-30,ix,iy+4);
    nameGrad.addColorStop(0,'#fde68a');
    nameGrad.addColorStop(0.4,'#f5c800');
    nameGrad.addColorStop(0.7,'#d97706');
    nameGrad.addColorStop(1,'#f5c800');
    ctx.fillStyle=nameGrad;
    letterSpacingDraw(nameText,ix,iy,3);
    ctx.restore();

    ctx.fillStyle='#94a3b8';ctx.font='15px Rajdhani,sans-serif';
    ctx.fillText((ch.g==='Hero'?'Pro Hero: ':'Villain: ')+ch.n,ix,iy+22);

    // Badges — right below role, near character info
    var bgy=iy+34,bx=ix,maxBx=artEndX+10;
    function badgeOrWrap(text,color){
      var tw=ctx.measureText(text).width+14+4;
      if(bx+tw>maxBx&&bx>ix){bx=ix;bgy+=26;}
      bdg(bx,bgy,text,color,11);bx+=tw;
    }
    badgeOrWrap('Original: '+role,rc);
    if(cos){
      var ra=cos.ra||'R';
      var raC={'R':'#991b1b','SR':'#92400e','PUR':'#581c87'};
      var starCount={'R':1,'SR':2,'PUR':3};
      var stars='';
      var sc=starCount[ra]||1;
      for(var sti=0;sti<sc;sti++)stars+='\u2605';
      badgeOrWrap(stars+' '+ra,raC[ra]||'#374151');
    }
    badgeOrWrap(ch.g,ch.g==='Hero'?'#1e40af':'#991b1b');

    var cy2=bgy+34;
    rr(ix,cy2,72,22,5,'#1a2332');
    ctx.fillStyle='#f5c800';ctx.font='bold 12px Rajdhani,sans-serif';
    ctx.fillText('Costume',ix+8,cy2+15);
    ctx.fillStyle='#e2e8f0';ctx.font='14px Rajdhani,sans-serif';
    ctx.fillText(cosName,ix+80,cy2+15);

    ctx.fillStyle='#94a3b8';ctx.font='12px Rajdhani,sans-serif';
    var descEnd=wrap(ch.desc||'',ix,cy2+30,iw,15);

    // === STATS with emoji icons ===
    var sd=CHAR_STATS[ch.id];
    var baseHp=sd?sd.hp:0,baseGp=sd?sd.gp:0,baseDown=sd?sd.downedHealth:0;
    var hpB=0,gpB=0,downB=0;
    var cmL=specialColumnMultiplier(findSpecial(ST.specs[0]&&ST.specs[0].tid),ST.specs[0]&&ST.specs[0].lv);
    var cmR=specialColumnMultiplier(findSpecial(ST.specs[1]&&ST.specs[1].tid),ST.specs[1]&&ST.specs[1].lv);
    function calcSB(s,side){
      if(!s||!s.tid)return;
      var e2=findNormal(s.tid);if(!e2)return;
      var m=side==='left'?cmL:cmR;
      var sb=getStatBonus(e2,s.lv);
      if(sb){
        if(sb.type==='hp')hpB+=sb.value*m;
        else if(sb.type==='gp')gpB+=sb.value*m;
        else if(sb.type==='downhp')downB+=sb.value*m;
      }
      if(e2.subEffects&&e2.subEffects.length>0){
        for(var si2=0;si2<e2.subEffects.length;si2++){
          var sub=e2.subEffects[si2];
          var subStat=getStatBonusForSkill(sub.skillName,sub.levels,s.lv);
          if(subStat){
            if(subStat.type==='hp')hpB+=subStat.value*m;
            else if(subStat.type==='gp')gpB+=subStat.value*m;
            else if(subStat.type==='downhp')downB+=subStat.value*m;
          }
        }
      }
    }
    for(var ci=0;ci<ST.left.length;ci++){calcSB(ST.left[ci],'left');}
    for(var cj=0;cj<ST.right.length;cj++){calcSB(ST.right[cj],'right');}
    var totalHp=baseHp+Math.round(hpB),totalGp=baseGp+Math.round(gpB),totalDown=baseDown+Math.round(downB);

    var sty=Math.max(descEnd+18,cy2+68);
    ctx.fillStyle='#f5c800';ctx.font='bold 14px Rajdhani,sans-serif';alL();
    ctx.fillText('CHARACTER STATS',ix,sty);

    [{l:'HP',v:totalHp,b:Math.round(hpB),c:'#4ade80',icon:'heart'},
     {l:'GP',v:totalGp,b:Math.round(gpB),c:'#38bdf8',icon:'bolt'},
     {l:'Down HP',v:totalDown,b:Math.round(downB),c:'#ef4444',icon:'shield'}].forEach(function(st,i){
      var sx2=ix+i*Math.floor((iw)/3),sy2=sty+10;
      var scW=Math.floor((iw-10)/3);

      // Subtle gradient card bg
      var cardBg=ctx.createLinearGradient(sx2,sy2,sx2,sy2+50);
      cardBg.addColorStop(0,'#141c2e');
      cardBg.addColorStop(1,'#0f1520');
      rr(sx2,sy2,scW,50,6,cardBg,'rgba(255,255,255,.06)');

      // Draw stat icon
      ctx.fillStyle=st.c;
      drawStatIcon(st.icon,sx2+scW/2,sy2+2,9);

      // Label
      ctx.fillStyle='#94a3b8';ctx.font='bold 10px Rajdhani,sans-serif';
      alC();ctx.fillText(st.l,sx2+scW/2,sy2+18);
      // Value
      ctx.fillStyle=st.c;ctx.font='bold 22px Rajdhani,sans-serif';
      ctx.fillText(st.v+'',sx2+scW/2,sy2+38);
      // Bonus
      if(st.b!==0){
        ctx.fillStyle='#4ade80';ctx.font='bold 10px Rajdhani,sans-serif';
        ctx.fillText((st.b>0?'+':'')+st.b,sx2+scW/2,sy2+48);
      }
      alL();
    });

    // === TUNING & MEMORY SLOTS ===
    var rx=artEndX+10,rw=W-rx-16;
    var colW=Math.floor((rw-12)/2);
    var lcx=rx,rcx=rx+colW+12;

    ctx.fillStyle='#f5c800';ctx.font='bold 17px Rajdhani,sans-serif';alL();
    ctx.fillText('TUNING & MEMORY SLOTS',rx,76);
    ctx.fillStyle='#a855f7';ctx.fillRect(rx,82,280,2);
    ctx.fillStyle='#f5c800';ctx.font='bold 13px Rajdhani,sans-serif';
    ctx.fillText('LEFT MEMORY',lcx,98);
    ctx.fillText('RIGHT MEMORY',rcx,98);

    var slotH=84,slotGap=6,sStartY=106;
    var leftDefs=cos?buildSlotDefs(ch,'left'):[];var rightDefs=cos?buildSlotDefs(ch,'right'):[];

    function memSlot(x,y,w,tid,lv,num,al){
      var e=tid?findNormal(tid):null;
      if(!e){
        rr(x,y,w,slotH,8,'#111827','rgba(255,255,255,.06)');
        ctx.fillStyle='#374151';ctx.font='bold 13px Rajdhani,sans-serif';
        alC();ctx.fillText('No Tuning Set',x+w/2,y+slotH/2+5);alL();
        return;
      }
      var rc3=RC[e.role]||'#94a3b8';

      // Dark gradient card bg
      var slotBg=ctx.createLinearGradient(x,y,x,y+slotH);
      slotBg.addColorStop(0,'#151d2e');
      slotBg.addColorStop(1,'#0f1520');
      rr(x,y,w,slotH,8,slotBg,'rgba(255,255,255,.06)');

      // Role-colored left border glow
      ctx.save();
      ctx.shadowColor=rc3;
      ctx.shadowBlur=10;
      ctx.fillStyle=rc3;
      ctx.fillRect(x+1,y+6,3,slotH-12);
      ctx.restore();

      ctx.fillStyle='#6b7280';ctx.font='bold 13px Rajdhani,sans-serif';alL();
      ctx.fillText('#'+num,x+10,y+18);
      var roleText=e.role||'?';
      if(al)roleText+=' '+(al==='hero'?'H':'V');
      bdg(x+30,y+4,roleText,rc3,11);
      ctx.fillStyle='#e2e8f0';ctx.font='bold 13px Rajdhani,sans-serif';
      alR();ctx.fillText('Lv.'+lv,x+w-50,y+18);alL();
      ctx.fillStyle='#f1f5f9';ctx.font='bold 14px Rajdhani,sans-serif';
      var tn='';
      if(e.subEffects&&e.subEffects.length){
        var names=[];
        for(var ti=0;ti<e.subEffects.length;ti++){
          var sn2=e.subEffects[ti]&&e.subEffects[ti].skillName?e.subEffects[ti].skillName.trim():'';
          if(sn2)names.push(sn2);
        }
        tn=names.join(' / ');
      }
      if(!tn)tn=e.name||'';
      if(tn.length>50)tn=tn.substring(0,50)+'...';
      ctx.fillText(tn,x+10,y+38);
      ctx.fillStyle='#a0aec0';ctx.font='12px Rajdhani,sans-serif';
      var td=tuningDesc(e)||'';if(td.length>48)td=td.substring(0,48)+'...';
      ctx.fillText(td,x+10,y+54);
      if(tuningDesc(e)&&tuningDesc(e).length>48){
        var t2=tuningDesc(e).substring(48,96);
        if(t2)ctx.fillText(t2,x+10,y+68);
      }
      if(e.chara&&slotImgs[e.chara]){
        circ(x+w-42,y+8,38,slotImgs[e.chara],rc3);
      }else if(e.chara){
        rr(x+w-42,y+8,38,38,19,'rgba(255,255,255,.04)','rgba(255,255,255,.08)');
      }
    }

    for(var li=0;li<5;li++){
      var ls=ST.left[li];
      var la=leftDefs[li]?leftDefs[li].a:null;
      memSlot(lcx,sStartY+li*(slotH+slotGap),colW,ls?ls.tid:null,ls?ls.lv:1,li+1,la);
    }
    for(var ri=0;ri<5;ri++){
      var rs=ST.right[ri];
      var ra2=rightDefs[ri]?rightDefs[ri].a:null;
      memSlot(rcx,sStartY+ri*(slotH+slotGap),colW,rs?rs.tid:null,rs?rs.lv:1,ri+1,ra2);
    }

    // === SPECIAL TUNING: dark red gradient bg, larger icon with glow ===
    var specY=sStartY+5*(slotH+slotGap)+10;
    ctx.fillStyle='#f5c800';ctx.font='bold 17px Rajdhani,sans-serif';alL();
    ctx.fillText('SPECIAL TUNING',rx,specY+14);
    ctx.fillStyle='#a855f7';ctx.fillRect(rx,specY+20,220,2);

    var specH=130,specW=Math.floor((rw-12)/2),specGap=12;
    for(var si=0;si<2;si++){
      var ss=ST.specs[si];
      var sx=rx+si*(specW+specGap);

      // Dark red gradient bg
      var specBg=ctx.createLinearGradient(sx,specY+28,sx,specY+28+specH);
      specBg.addColorStop(0,'#1a0a0f');
      specBg.addColorStop(1,'#110508');
      rr(sx,specY+28,specW,specH,8,specBg,'rgba(167,139,250,.12)');

      if(ss&&ss.tid){
        var se=findSpecial(ss.tid);
        if(se){
          var rc4=RC[se.role]||'#94a3b8';

          // Role-colored left border glow
          ctx.save();
          ctx.shadowColor=rc4;
          ctx.shadowBlur=10;
          ctx.fillStyle=rc4;
          ctx.fillRect(sx+2,specY+34,3,specH-12);
          ctx.restore();

          ctx.fillStyle='#6b7280';ctx.font='bold 12px Rajdhani,sans-serif';alL();
          ctx.fillText(si===0?'LEFT':'RIGHT',sx+10,specY+44);
          var specRoleText=se.role||'SPEC';
          var specAl=cos&&cos.sp&&cos.sp[si]?cos.sp[si].a:(se.align||null);
          if(specAl){specRoleText+=' '+(specAl==='hero'?'H':'V');}
          bdg(sx+52,specY+34,specRoleText,rc4,11);
          var textW=specW-70;
          ctx.fillStyle='#f1f5f9';ctx.font='bold 13px Rajdhani,sans-serif';
          var sn=se.skillName||se.name||'';
          ctx.fillText(sn,sx+12,specY+66);
          ctx.fillStyle='#a0aec0';ctx.font='10px Rajdhani,sans-serif';
          var sd2=se.effect||se.desc||se.skillDesc||'';
          var sdWords=sd2.split(' '),sdLine='',sdY=specY+80,sdLines=0;
          for(var sdi=0;sdi<sdWords.length;sdi++){
            var sdTest=sdLine+sdWords[sdi]+' ';
            if(ctx.measureText(sdTest).width>textW&&sdLine!==''){
              ctx.fillText(sdLine.trim(),sx+12,sdY);sdY+=13;sdLine=sdWords[sdi]+' ';sdLines++;
            }else{sdLine=sdTest;}
          }
          if(sdLine){ctx.fillText(sdLine.trim(),sx+12,sdY);sdLines++;}
          ctx.fillStyle='#e2e8f0';ctx.font='bold 11px Rajdhani,sans-serif';
          var lvY=specY+80+sdLines*13+4;
          ctx.fillText('Lv. '+(ss?ss.lv:1),sx+12,lvY);

          // Icon with glow — right side, centered vertically
          var iconX=sx+specW-60,iconY=specY+50,iconSz=48;
          ctx.save();
          ctx.shadowColor=rc4;
          ctx.shadowBlur=15;
          ctx.beginPath();ctx.arc(iconX+iconSz/2,iconY+iconSz/2,iconSz/2,0,Math.PI*2);ctx.clip();
          if(specIcons[ss.tid]){ctx.drawImage(specIcons[ss.tid],iconX,iconY,iconSz,iconSz);}
          else if(se.chara&&slotImgs[se.chara]){ctx.drawImage(slotImgs[se.chara],iconX,iconY,iconSz,iconSz);}
          ctx.restore();
          ctx.strokeStyle=rc4;ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(iconX+iconSz/2,iconY+iconSz/2,iconSz/2,0,Math.PI*2);ctx.stroke();
        }
      }else{
        rr(sx,specY+28,specW,specH,8,'#0d1020','rgba(255,255,255,.04)');
        alC();
        ctx.fillStyle='#484f58';ctx.font='bold 28px Rajdhani,sans-serif';
        ctx.fillText('+',sx+specW/2,specY+28+specH/2-4);
        ctx.fillStyle='#374151';ctx.font='12px Rajdhani,sans-serif';
        ctx.fillText('No Special Tuning Equipped',sx+specW/2,specY+28+specH/2+16);
        alL();
      }
    }

    // === FOOTER ===
    rr(0,H-36,W,36,0,'#0c1020');
    ctx.fillStyle=rc;ctx.fillRect(0,H-36,W,2);
    ctx.fillStyle='#484f58';ctx.font='11px Rajdhani,sans-serif';alL();
    ctx.fillText('BUILD ID',16,H-18);
    ctx.fillStyle='#94a3b8';ctx.font='bold 12px Rajdhani,sans-serif';
    ctx.fillText('Loading...',16,H-5);
    ctx.fillStyle='#484f58';ctx.font='11px Rajdhani,sans-serif';
    ctx.fillText('PLAYER',160,H-18);
    ctx.fillStyle='#94a3b8';ctx.font='bold 12px Rajdhani,sans-serif';
    ctx.fillText(playerName||'YourPlayerName',160,H-5);
    ctx.fillStyle='#484f58';ctx.font='11px Rajdhani,sans-serif';
    ctx.fillText('DATE',340,H-18);
    ctx.fillStyle='#94a3b8';ctx.font='bold 12px Rajdhani,sans-serif';
    ctx.fillText(new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}),340,H-5);

    // Save build to server and get short ID
    var buildData={v:4,charId:ch.id,cosIdx:ST.cosIdx,styleIdx:ST.styleIdx,
      left:ST.left.map(function(s){return{t:s.tid,l:s.lv};}),
      right:ST.right.map(function(s){return{t:s.tid,l:s.lv};}),
      specs:ST.specs.map(function(s){return{t:s.tid,l:s.lv};})};
    var buildId='#LOADING';
    try{
      var xhr=new XMLHttpRequest();
      xhr.open('POST','/api/builds',false);
      xhr.setRequestHeader('Content-Type','application/json');
      xhr.send(JSON.stringify({build:buildData}));
      if(xhr.status===200){
        var resp=JSON.parse(xhr.responseText);
        if(resp.id)buildId='#'+resp.id;
      }
    }catch(e2){buildId='#'+btoa(JSON.stringify(buildData)).replace(/[^a-zA-Z0-9]/g,'').slice(0,10);}

    // Overwrite the BUILD ID text
    ctx.fillStyle='#0c1020';ctx.fillRect(12,H-36,140,36);
    ctx.fillStyle='#484f58';ctx.font='11px Rajdhani,sans-serif';alL();
    ctx.fillText('BUILD ID',16,H-18);
    ctx.fillStyle='#94a3b8';ctx.font='bold 12px Rajdhani,sans-serif';
    ctx.fillText(buildId,16,H-5);

    cv.toBlob(function(blob){
      var url=URL.createObjectURL(blob);
      var buildUrl=window.location.origin+'/?build='+buildId.replace(/^#/,'');

      // Create preview modal
      var ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
      var bx=document.createElement('div');
      bx.style.cssText='background:#1a1a2e;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:20px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;gap:12px;';

      var img=document.createElement('img');
      img.src=url;img.style.cssText='max-width:100%;max-height:70vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
      bx.appendChild(img);

      var btns=document.createElement('div');
      btns.style.cssText='display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';

      var saveBtn=document.createElement('button');
      saveBtn.textContent='Save Image';
      saveBtn.style.cssText='padding:10px 24px;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;background:linear-gradient(135deg,#f5c800,#f59e0b);color:#000;';
      saveBtn.onclick=function(){var a=document.createElement('a');a.href=url;a.download='MHUR_'+ch.n.replace(/\s+/g,'_')+'_Build.png';document.body.appendChild(a);a.click();document.body.removeChild(a);};

      var copyBtn=document.createElement('button');
      copyBtn.textContent='Copy Image';
      copyBtn.style.cssText='padding:10px 24px;border:1px solid rgba(255,255,255,.2);border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;background:rgba(255,255,255,.05);color:#e2e8f0;';
      copyBtn.onclick=function(){navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(function(){copyBtn.textContent='Copied!';setTimeout(function(){copyBtn.textContent='Copy Image';},2000);}).catch(function(){alert('Copy failed — try Save instead.');});};

      var linkBtn=document.createElement('button');
      linkBtn.textContent='Copy Link';
      linkBtn.style.cssText='padding:10px 24px;border:1px solid rgba(167,139,250,.4);border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;background:rgba(167,139,250,.1);color:#c084fc;';
      linkBtn.onclick=function(){navigator.clipboard.writeText(buildUrl).then(function(){linkBtn.textContent='Copied!';setTimeout(function(){linkBtn.textContent='Copy Link';},2000);});};

      var closeBtn=document.createElement('button');
      closeBtn.textContent='X';
      closeBtn.style.cssText='padding:10px 16px;border:1px solid rgba(255,255,255,.1);border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;background:transparent;color:#64748b;';
      closeBtn.onclick=function(){ov.remove();URL.revokeObjectURL(url);};

      btns.appendChild(saveBtn);btns.appendChild(copyBtn);btns.appendChild(linkBtn);btns.appendChild(closeBtn);
      bx.appendChild(btns);ov.appendChild(bx);document.body.appendChild(ov);
    },'image/png');
  }
  render().catch(function(err){
    console.error('PNG generation failed:',err);
    document.getElementById('btnPng').textContent='PNG';
    alert('Failed to generate image.');
  });
}
