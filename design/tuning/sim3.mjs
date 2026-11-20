// Refiner round 2 sim: real polygons + mixes, px layouts, px/s profiles, flatten threshold F.
const TYPES={def:{m:1.0,r:0.30},tall:{m:1.6,r:0.18},short:{m:0.7,r:0.55},flow:{m:1.2,r:0.30},stiff:{m:1.0,r:0.25}};
const L=[
 [12,12,[[[0,0],[12,0],[12,12],[0,12]]],{def:1}],
 [13,13,[[[0,0],[13,0],[13,13],[0,13]]],{def:1}],
 [15,15,[[[0,0],[15,0],[15,15],[0,15]]],{def:.8,short:.2}],
 [17,19,[[[0,0],[17,0],[17,19],[0,19]]],{def:.7,tall:.3}],
 [19,19,[[[0,0],[19,0],[19,19],[0,19]]],{def:.6,short:.2,flow:.2}],
 [21,21,[[[0,0],[21,0],[21,12],[12,12],[12,21],[0,21]]],{def:.6,tall:.2,short:.2}],
 [23,23,[[[0,0],[23,0],[23,23],[0,23]]],{def:.5,tall:.2,short:.2,flow:.1}],
 [25,25,[[[0,0],[25,0],[25,15],[14,15],[14,25],[0,25]]],{def:.5,tall:.25,flow:.25}],
 [27,27,[[[9,0],[18,0],[18,9],[27,9],[27,18],[18,18],[18,27],[9,27],[9,18],[0,18],[0,9],[9,9]]],{def:.5,tall:.2,flow:.2,stiff:.1}],
 [29,29,[[[0,0],[29,0],[29,29],[0,29]]],{def:.4,tall:.2,short:.2,flow:.1,stiff:.1}],
 [31,31,[[[0,0],[31,0],[31,18],[18,18],[18,31],[0,31]]],{def:.4,tall:.25,flow:.2,stiff:.15}],
 [33,33,[[[16,0],[33,12],[27,33],[6,33],[0,12]]],{def:.4,tall:.2,short:.2,flow:.1,stiff:.1}],
 [34,34,[[[0,0],[34,0],[34,34],[0,34]]],{def:.3,tall:.25,short:.15,flow:.2,stiff:.1}],
 [35,35,[[[0,0],[35,0],[35,20],[0,20]],[[8,25],[28,25],[28,33],[8,33]]],{def:.3,tall:.25,short:.15,flow:.15,stiff:.15}],
 [36,36,[[[6,0],[30,0],[36,10],[36,26],[30,36],[6,36],[0,26],[0,10]]],{def:.25,tall:.25,short:.2,flow:.15,stiff:.15}],
];
function pip(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y)){const xc=(xj-xi)*(y-yi)/(yj-yi)+xi;if(xc>x)c=!c;}}return c}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// layouts (CSS px usable area for the field)
const LAYOUT={phone:{w:366,h:603,touch:true},desktop:{w:902,h:752,touch:false}};
export function makeField(n,dev,opt){
  const [W,H,polys,mix]=L[n-1]; const rnd=mulberry(n*7919);
  const cell=Math.min(LAYOUT[dev].w/W,LAYOUT[dev].h/H);
  const N=W*H, valid=new Uint8Array(N), type=new Array(N);
  const names=Object.keys(mix);
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){const i=r*W+c;valid[i]=polys.some(p=>pip(c+.5,r+.5,p))?1:0;let u=rnd(),t=names[names.length-1];for(const k of names){if(u<mix[k]){t=k;break}u-=mix[k]}type[i]=t;}
  let vc=0,sm=0;for(let i=0;i<N;i++)if(valid[i]){vc++;sm+=TYPES[type[i]].m}
  const side=Math.min(W,H)*cell; const brushPx = Math.max(LAYOUT[dev].touch?opt.touchMin:opt.mouseMin, opt.cellFrac*cell, (opt.fieldFrac||0)*side);
  return {n,W,H,polys,valid,type,vc,avgM:sm/vc,cell,R:brushPx/cell,brushPx,dev};
}
export function run(f,prof,opt){
  const {W,H,valid,type,vc,avgM,cell,R}=f; const N=W*H; const g=opt.g[f.n-1], k=opt.k[f.n-1];
  const F=opt.F, line=k*vc*avgM;
  const h=new Float32Array(N), rest=new Float32Array(N), tough=new Uint8Array(N), loosenedBy=new Int32Array(N).fill(-1), touched=new Uint8Array(N);
  for(let i=0;i<N;i++){h[i]=valid[i]?1:0; tough[i]=type[i]==='stiff'?1:0;}
  let E=(opt.startFrac||0)*line,t=0; const dt=1/60; let stroke=0; const vCells=prof.v/cell; // cells/s
  const sf=1+0.2*Math.min(1,Math.max(0,(prof.v-150)/450));
  // path generator
  let x,y,dir=1,lane=0, lift=0, down=true; const sp=Math.max(1, 2*R*0.9); // lane spacing in cells
  const lanes=[]; for(let yy=Math.min(R,H/2); yy<H; yy+=sp) lanes.push(yy);
  // for serpentine: lanes span only valid extent of each row band
  function laneExtent(yy){let lo=W,hi=0;const r=Math.min(H-1,Math.floor(yy));for(let c=0;c<W;c++)if(valid[r*W+c]){lo=Math.min(lo,c);hi=Math.max(hi,c+1)}return lo<=hi?[lo,hi]:null}
  let rnd=mulberry(99+f.n), ang=rnd()*6.28, strokeT=0;
  if(prof.kind==='serp'){ lane=0; y=lanes[0]; const e=laneExtent(y)||[0,W]; x=e[0]; dir=1; }
  else { x=W/2; y=H/2; }
  let px=x,py=y;
  const stamp=(x0,y0,x1,y1)=>{
    const r0=Math.max(0,Math.floor(Math.min(y0,y1)-R)), r1=Math.min(H-1,Math.ceil(Math.max(y0,y1)+R));
    const c0=Math.max(0,Math.floor(Math.min(x0,x1)-R)), c1=Math.min(W-1,Math.ceil(Math.max(x0,x1)+R));
    const dx=x1-x0, dy=y1-y0, L2=dx*dx+dy*dy;
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){const i=r*W+c; if(!valid[i])continue;
      const cx=c+.5,cy=r+.5; let u=L2>0?((cx-x0)*dx+(cy-y0)*dy)/L2:0; u=Math.max(0,Math.min(1,u));
      const ex=x0+u*dx-cx, ey=y0+u*dy-cy; if(ex*ex+ey*ey>R*R)continue;
      touched[i]=1;
      if(opt.rule==='old'){ if(rest[i]>0||h[i]<=0)continue; if(tough[i]&&loosenedBy[i]!==stroke){ if(loosenedBy[i]<0){loosenedBy[i]=stroke;continue} }
        E+=TYPES[type[i]].m*Math.min(1,Math.max(0,(h[i]-0.3)/0.7))*sf; h[i]=0; rest[i]=1.5; tough[i]=0; loosenedBy[i]=-1; continue; }
      if(h[i]<F)continue; // bends only
      if(tough[i]){ if(loosenedBy[i]<0){loosenedBy[i]=stroke;continue} if(loosenedBy[i]===stroke)continue; }
      E+=TYPES[type[i]].m*opt.yieldFn(h[i])*sf; h[i]=0; rest[i]=1.5; tough[i]=0; loosenedBy[i]=-1;
    }
  };
  let lastWasDown=true;
  while(E<line && t<opt.tmax){
    for(let i=0;i<N;i++){ if(!valid[i])continue; if(rest[i]>0){rest[i]-=dt;continue}
      if(h[i]<1){const was=h[i]; h[i]=Math.min(1,h[i]+TYPES[type[i]].r*g*Math.max(h[i],0.08)*(1-h[i])*dt); if(type[i]==='stiff'&&was<F&&h[i]>=F&&opt.rule!=='old'){tough[i]=1;loosenedBy[i]=-1}}}
    t+=dt;
    if(lift>0){lift-=dt; if(lift<=0){stroke++; px=x;py=y;} continue;}
    px=x;py=y;
    if(prof.kind==='serp'){
      x+=dir*vCells*dt; const e=laneExtent(y)||[0,W];
      if((dir>0&&x>e[1])||(dir<0&&x<e[0])){ x=dir>0?e[1]:e[0]; stamp(px,py,x,y);
        lane=(lane+1)%lanes.length; y=lanes[lane]; const e2=laneExtent(y)||[0,W]; dir=-dir; x=dir>0?e2[0]:e2[1];
        lift=prof.turn; continue; }
    } else { // scribble: random walk with bounces; strokes of prof.strokeLen s then a short lift
      ang+=(rnd()-0.5)*prof.wiggle; x+=Math.cos(ang)*vCells*dt; y+=Math.sin(ang)*vCells*dt;
      if(x<0||x>W){ang=Math.PI-ang;x=Math.max(0,Math.min(W,x))} if(y<0||y>H){ang=-ang;y=Math.max(0,Math.min(H,y))}
      strokeT+=dt; if(strokeT>prof.strokeLen){strokeT=0; stamp(px,py,x,y); lift=prof.turn; continue;}
    }
    stamp(px,py,x,y);
  }
  let tc=0; for(let i=0;i<N;i++) if(valid[i]&&touched[i]) tc++;
  return {t:E>=line?+t.toFixed(0):null, meter:Math.round(100*E/line), touchedPct:Math.round(100*tc/vc)};
}
export const PROFILES={
  fast:{kind:'serp',v:600,turn:0.12},
  average:{kind:'serp',v:350,turn:0.2},
  calm:{kind:'serp',v:150,turn:0.4},
  scribble:{kind:'scrib',v:700,turn:0.1,wiggle:1.2,strokeLen:1.5},
};
