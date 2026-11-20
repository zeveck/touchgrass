import {makeField,run,PROFILES} from './sim3.mjs';
const lin=(a,b)=>Array.from({length:15},(_,i)=>+(a+(b-a)*i/14).toFixed(2));
const gOld=[1.5,1.5,1.3,1.3,1.2,1.1,1.0,1.0,1.0,0.95,0.9,0.9,0.85,0.85,0.8];
const k=process.argv[2]?JSON.parse(process.argv[2]):lin(1.5,3.0);
const g=process.argv[3]?JSON.parse(process.argv[3]):gOld;
const opt={rule:'new',F:0.4,k,g,tmax:900,touchMin:18,mouseMin:14,cellFrac:0.75,fieldFrac:0.05,yieldFn:h=>h};
const profs=(process.argv[4]||'average').split(',');
const tot={};
for(let n=1;n<=15;n++){const row=[`f${n} k${k[n-1]} g${g[n-1]}`];
 for(const dev of ['phone','desktop']){const f=makeField(n,dev,opt); for(const p of profs){const r=run(f,PROFILES[p],opt); row.push(`${dev[0]}-${p}: ${r.t??'STALL '+r.meter+'%'} (touched ${r.touchedPct}%)`); tot[dev+p]=(tot[dev+p]||0)+(r.t||900);}}
 console.log(row.join(' | '));}
for(const key in tot) console.log(key,'total',(tot[key]/60).toFixed(1),'min');
