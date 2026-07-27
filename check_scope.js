var fs=require('fs');
var h=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html','utf8');
var s=h.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
var a=s.map(function(m){return m.replace(/<\/?script[^>]*>/g,'');}).join('\n');
try{
  new Function(a);
  console.log('JS OK');
}catch(e){
  console.log('ERR:',e.message.substring(0,200));
}
