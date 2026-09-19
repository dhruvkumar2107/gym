const fs=require('fs'),p=require('path'),o=p.join(__dirname,'site.js');
fs.writeFileSync(o,'','utf8');
function w(s){fs.appendFileSync(o,s,'utf8')}
function r(f){w(fs.readFileSync(p.join(__dirname,f),'utf8'))}
const parts=fs.readdirSync(__dirname).filter(f=>f.startsWith('part')&&f.endsWith('.txt')).sort();
parts.forEach(r);
console.log('Done:',fs.statSync(o).size,'bytes');
