var fs=require('fs');
var path='C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\database\\';
var html=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html','utf8');

// 1. CH_NUM
var cn = html.match(/var CH_NUM=\{[\s\S]*?\};/);
if(cn){
  var cnStr = cn[0].replace('var CH_NUM=','').replace(';','');
  var CH_NUM = eval('(' + cnStr + ')');
  fs.writeFileSync(path+'character_ids.json', JSON.stringify(CH_NUM, null, 2));
  console.log('CH_NUM:', Object.keys(CH_NUM).length);
}

// 2. CH array
var chIdx = html.indexOf('var CH=[');
var chStart = html.indexOf('[', chIdx);
var depth=0, pos=chStart, inStr=false, strChar='', isEsc=false;
for(var i=chStart; i<html.length; i++){
  var c=html[i];
  if(isEsc){isEsc=false; continue;}
  if(c==='\\'){isEsc=true; continue;}
  if(inStr){if(c===strChar)inStr=false; continue;}
  if(c==='"'||c==="'"){inStr=true; strChar=c; continue;}
  if(c==='[') depth++;
  if(c===']'){depth--; if(depth===0){pos=i+1; break;}}
}
try{
  var CH = JSON.parse(html.substring(chStart, pos));
  console.log('CH:', CH.length, 'characters');
  
  // CH by ID for quick lookup
  var chById = {};
  CH.forEach(function(c){chById[c.id] = {id:c.id,g:c.g,role:c.role,num:c.num,n:c.n,c:c.c||[],bs:c.bs||[]};});
  fs.writeFileSync(path+'character_index.json', JSON.stringify(chById, null, 2));
  console.log('character_index.json saved');
  
  // Costumes
  var costumes = {};
  CH.forEach(function(ch){
    if(ch.c && ch.c.length){
      costumes[ch.id] = ch.c.map(function(cos,i){
        return {idx:i,name:cos.n||'Default',rarity:cos.ra||'R',align:cos.al||'',sp1:cos.sp1||null,sp2:cos.sp2||null,slots:cos.s||[]};
      });
    }
  });
  fs.writeFileSync(path+'costumes.json', JSON.stringify(costumes, null, 2));
  console.log('costumes.json:', Object.keys(costumes).length, 'entries');
  
} catch(e) { console.log('CH parse error:', e.message); }

// 3. Tunings
var nt = JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\normal_tuning_parsed.json', 'utf8'));
var nm = {};
nt.forEach(function(t,i){nm['n'+i]={chara:t.chara,role:t.role,cl:t.class||'',name:t.name,sn:t.skillName||'',sd:t.skillDesc||'',lv:t.levels||[],sub:(t.subEffects||[]).map(function(s){return{sn:s.skillName,sd:s.skillDesc,lv:s.levels||[]};})};});
fs.writeFileSync(path+'tunings.json', JSON.stringify(nm, null, 2));
console.log('tunings.json:', Object.keys(nm).length);

var st = JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\special_tuning_parsed.json', 'utf8'));
var sm = {};
st.forEach(function(t,i){sm['s'+i]={chara:t.chara,role:t.role,cl:t.class||'',name:t.name,sn:t.skillName||'',sd:t.skillDesc||'',al:t.align||'',lv:t.levels||[],ef:t.effect||''};});
fs.writeFileSync(path+'special_tunings.json', JSON.stringify(sm, null, 2));
console.log('special_tunings.json:', Object.keys(sm).length);

// 4. Characters
var cs = JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\char_stats.json', 'utf8'));
fs.writeFileSync(path+'characters.json', JSON.stringify(cs, null, 2));
console.log('characters.json:', Object.keys(cs).length);

console.log('All database files created');
