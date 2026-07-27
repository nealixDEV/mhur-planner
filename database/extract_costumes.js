var fs=require('fs');
var path='C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\database\\';
var html=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html','utf8');
var chNumRaw=JSON.parse(fs.readFileSync(path+'character_ids.json','utf8'));
console.log('CH_NUM:',Object.keys(chNumRaw).length,'entries');

// Find CH array in HTML - parse it manually because the format escapes quotes
var chIdx=html.indexOf('var CH=[');
var chStart=html.indexOf('[',chIdx);
var depth=0,pos=chStart;
var inStr=false,strChar='',isEsc=false;
for(var i=chStart;i<html.length;i++){
  var c=html[i];
  if(isEsc){isEsc=false;continue;}
  if(c==='\\'){isEsc=true;continue;}
  if(inStr){
    if(c===strChar)inStr=false;
    continue;
  }
  if(c==='"'||c==="'"){inStr=true;strChar=c;continue;}
  if(c==='[')depth++;
  if(c===']'){
    depth--;
    if(depth===0){pos=i+1;break;}
  }
}
try{
  var CH=JSON.parse(html.substring(chStart,pos));
  console.log('CH:',CH.length,'characters');
  
  var costumes={};
  CH.forEach(function(ch){
    if(ch.c&&ch.c.length){
      costumes[ch.id]=ch.c.map(function(cos,i){
        return{
          idx:i,name:cos.n||'Default',rarity:cos.ra||'R',align:cos.al||'',
          sp1:cos.sp1||null,sp2:cos.sp2||null,slots:cos.s||[]
        };
      });
    }
  });
  fs.writeFileSync(path+'costumes.json',JSON.stringify(costumes,null,2));
  console.log('costumes.json:',Object.keys(costumes).length,'entries');
  
  var chSimple=CH.map(function(ch){return{id:ch.id,g:ch.g,role:ch.role,num:ch.num,n:ch.n};});
  fs.writeFileSync(path+'character_list.json',JSON.stringify(chSimple,null,2));
  console.log('character_list.json saved');
}catch(e){console.log('CH parse error:',e.message);}
