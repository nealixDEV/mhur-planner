var fs=require('fs');
var h=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html','utf8');
var p=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\png_gen.js','utf8');
var s=h.indexOf('// Build PNG Generator');
var e=h.indexOf('function doExport(){');
if(s===-1||e===-1){console.log('ERROR: markers not found s='+s+' e='+e);process.exit(1);}
fs.writeFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\index.html',h.substring(0,s)+p+'\n\n\n'+h.substring(e),'utf8');
console.log('Swapped OK, png_gen='+p.length+' chars');
