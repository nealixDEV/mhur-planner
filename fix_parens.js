var fs=require('fs');
var c=fs.readFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\png_gen.js','utf8');
// Restore getContext
c=c.replace("getContext('2d';","getContext('2d');");
// Find only lines where ); should be ; — lines with ctx. property assignments
// Pattern: ctx.something='value');  at end of chained statements
var lines=c.split('\n');
var fixed=0;
for(var i=0;i<lines.length;i++){
  var l=lines[i];
  // Only fix lines that contain ctx. property set AND end with ');
  // But NOT function calls like ctx.fillText(...); ctx.fillRect(...); ctx.arc(...); etc.
  if(l.match(/ctx\.(fillStyle|font|textAlign|strokeStyle|lineWidth|globalAlpha|filter|shadowColor|shadowBlur|shadowOffsetY|shadowOffsetX)='[^']*'\)$/)){
    lines[i]=l.slice(0,-2)+';';
    fixed++;
  }
}
c=lines.join('\n');
fs.writeFileSync('C:\\Users\\sport\\Documents\\MyHeroUltraTuning\\png_gen.js',c);
console.log('Fixed '+fixed+' lines');
