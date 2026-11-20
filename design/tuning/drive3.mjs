import {makeField,run,PROFILES} from './sim3.mjs';
const lin=(a,b)=>Array.from({length:15},(_,i)=>+(a+(b-a)*i/14).toFixed(2));
const gOld=[1.5,1.5,1.3,1.3,1.2,1.1,1.0,1.0,1.0,0.95,0.9,0.9,0.85,0.85,0.8];
const cfgs={
 old:{rule:'old',F:0,k:lin(1.0,2.4),g:gOld,tmax:600,touchMin:18,mouseMin:10,cellFrac:1.5,yieldFn:h=>h},
 newA:{rule:'new',F:+process.argv[2]||0.4,k:lin(+process.argv[3]||1.5,+process.argv[4]||3.0),g:gOld,tmax:600,touchMin:18,mouseMin:+process.argv[5]||14,cellFrac:0.75,fieldFrac:+process.argv[8]||0,yieldFn:h=>h},
};
const which=(process.argv[6]||'old,newA').split(',');
const fields=(process.argv[7]||'1,15').split(',').map(Number);
for(const c of which){ console.log('==',c, JSON.stringify({F:cfgs[c].F,k1:cfgs[c].k[0],k15:cfgs[c].k[14],mouseMin:cfgs[c].mouseMin}));
 for(const n of fields) for(const dev of ['phone','desktop']){ const f=makeField(n,dev,cfgs[c]);
  const row=[`f${n} ${dev} cell ${f.cell.toFixed(1)}px brush r ${f.brushPx.toFixed(0)}px (${f.R.toFixed(2)} cells)`];
  for(const p of ['fast','average','calm','scribble']){const r=run(f,PROFILES[p],cfgs[c]); row.push(`${p}: ${r.t??('stall '+r.meter+'%')}s`);}
  console.log(row.join(' | ')); } }
