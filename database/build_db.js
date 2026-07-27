var fs=require('fs');
var path='C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\database\\';
var html=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html','utf8');
var costumeJS=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\new_costume_data.js','utf8');

// Extract CH_NUM
var cnM=html.match(/var CH_NUM=\{[\s\S]*?\};/);
var CH_NUM=eval('('+cnM[0].replace('var CH_NUM=','').replace(';','')+')');
fs.writeFileSync(path+'character_ids.json',JSON.stringify(CH_NUM,null,2));
console.log('CH_NUM:',Object.keys(CH_NUM).length);

// Extract CH array
var chIdx=html.indexOf('var CH=[');
var chStart=html.indexOf('[',chIdx);
var chEnd=html.indexOf('];',chStart);
var CH=new Function('return '+html.substring(chStart,chEnd+1))();
var chById={};
CH.forEach(function(c){chById[c.id]={id:c.id,g:c.g,role:c.role,n:c.n};});
fs.writeFileSync(path+'character_index.json',JSON.stringify(chById,null,2));
console.log('CH:',CH.length);

// Extract COSTUME_DATA
var cdM=costumeJS.match(/var COSTUME_DATA = (\{[\s\S]*?\});/);
if(cdM){
  var COSTUME_DATA=eval('('+cdM[1]+')');
  console.log('Costume characters:',Object.keys(COSTUME_DATA).length);
  
  // Build structured costumes database
  var costumes={};
  Object.keys(COSTUME_DATA).forEach(function(charId){
    var num=CH_NUM[charId];
    costumes[charId]=COSTUME_DATA[charId].map(function(cos,i){
      return{
        idx:i,
        name:cos.n||'Unknown',
        rarity:cos.ra||'R',
        align:cos.al||'',
        slots:cos.s||[],
        sp1:cos.sp1||null,
        sp2:cos.sp2||null
      };
    });
  });
  fs.writeFileSync(path+'costumes.json',JSON.stringify(costumes,null,2));
  console.log('costumes.json saved');
}

// Character stats
var cs=JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\char_stats.json','utf8'));
fs.writeFileSync(path+'characters.json',JSON.stringify(cs,null,2));
console.log('characters.json:',Object.keys(cs).length);

// Tunings
var nt=JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\normal_tuning_parsed.json','utf8'));
var nm={};
nt.forEach(function(t,i){nm['n'+i]={chara:t.chara,role:t.role,cl:t.class||'',name:t.name,sn:t.skillName||'',sd:t.skillDesc||'',lv:t.levels||[],sub:(t.subEffects||[]).map(function(s){return{sn:s.skillName,sd:s.skillDesc,lv:s.levels||[]};})};});
fs.writeFileSync(path+'tunings.json',JSON.stringify(nm,null,2));
console.log('tunings.json:',Object.keys(nm).length);

// Special tunings
var st=JSON.parse(fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\special_tuning_parsed.json','utf8'));
var sm={};
st.forEach(function(t,i){sm['s'+i]={chara:t.chara,role:t.role,cl:t.class||'',name:t.name,sn:t.skillName||'',sd:t.skillDesc||'',al:t.align||'',lv:t.levels||[],ef:t.effect||''};});
fs.writeFileSync(path+'special_tunings.json',JSON.stringify(sm,null,2));
console.log('special_tunings.json:',Object.keys(sm).length);

// Multi-hit data
var mh=fs.existsSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\multi_hit_data.js');
if(mh) console.log('multi_hit_data.js exists (will need parsing)');
console.log('Done');
