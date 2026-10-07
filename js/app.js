const NN=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const I={
piano:{n:'Piano',e:'🎹',o:[['triangle',1,0,1],['sine',2,0,.3]],a:.004,dec:1.4,sus:.02,rel:.25,f:6000,pk:.5},
lead:{n:'Synth lead',e:'🎛️',o:[['sawtooth',1,-7,.5],['sawtooth',1,7,.5]],a:.02,dec:0,sus:1,rel:.12,f:2400,pk:.28},
bass:{n:'Bass',e:'🎸',o:[['square',.5,0,.6],['sine',.5,0,.8]],a:.01,dec:.3,sus:.6,rel:.1,f:700,pk:.5},
pluck:{n:'Pluck',e:'🪕',o:[['sawtooth',1,0,1]],a:.002,dec:.5,sus:.01,rel:.1,f:600,fs:5000,pk:.4},
strings:{n:'Strings',e:'🎻',o:[['sawtooth',1,-8,.5],['sawtooth',1,8,.5]],a:.18,dec:0,sus:1,rel:.3,f:1800,pk:.28},
flute:{n:'Flute',e:'🪈',o:[['sine',1,0,1],['triangle',2,0,.12]],a:.06,dec:0,sus:1,rel:.12,f:4000,pk:.4,vib:1},
epiano:{n:'Electric piano',e:'⌨️',o:[['sine',1,0,1],['sine',2,3,.35]],a:.005,dec:.9,sus:.08,rel:.3,f:4500,pk:.5,pro:1},
organ:{n:'Organ',e:'⛪',o:[['sine',1,0,1],['sine',2,0,.5],['sine',3,0,.3]],a:.02,dec:0,sus:1,rel:.08,f:5000,pk:.3,pro:1},
bell:{n:'Bell',e:'🔔',o:[['sine',1,0,1],['sine',2.76,0,.5],['sine',5.4,0,.25]],a:.002,dec:1.8,sus:.01,rel:.6,f:8000,pk:.4,pro:1},
marimba:{n:'Marimba',e:'🎼',o:[['sine',1,0,1],['sine',4,0,.3]],a:.002,dec:.35,sus:.01,rel:.1,f:5000,pk:.6,pro:1},
brass:{n:'Brass',e:'🎺',o:[['sawtooth',1,-5,.5],['sawtooth',1,5,.5]],a:.08,dec:0,sus:1,rel:.15,f:2600,fs:700,pk:.3,pro:1},
pad:{n:'Warm pad',e:'☁️',o:[['triangle',1,-10,.6],['triangle',1,10,.6]],a:.5,dec:0,sus:1,rel:.7,f:1500,pk:.3,pro:1},
chip:{n:'Chiptune',e:'👾',o:[['square',1,0,1]],a:.003,dec:.15,sus:.7,rel:.05,f:6000,pk:.2,pro:1}
};
let ctx,master,mc,analyser,stream,buf,timer,raw=[],cur=null,cand=-2,candN=0,t0=0,rec=false,keyRoot=null,playT0=0,playEnd=0,raf,live,beats=[],prevR=0,lastHit=-1,fbuf,PRO=false,V=[],sel=-1,playIdx=-1;
const $=id=>document.getElementById(id);
function say(t){let m=$('msg');if(!m){m=document.createElement('div');m.id='msg';m.className='mu';m.style.cssText='color:var(--ac2);margin-top:10px';$('hz').parentNode.parentNode.appendChild(m);}m.textContent=t;}
function ensure(){
  if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();newMaster();}
  if(ctx.state!=='running')ctx.resume();
}
function newMaster(){
  master=ctx.createGain();master.gain.value=.7;
  const c=ctx.createDynamicsCompressor();mc=c;master.connect(c);c.connect(ctx.destination);const dl=ctx.createDelay(1),fb=ctx.createGain(),wt=ctx.createGain();dl.delayTime.value=.27;fb.gain.value=.3;wt.gain.value=.16;master.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(wt);wt.connect(c);
}
function voice(k,m,t,d,out){
  const c=I[k];d=Math.max(d,.1);
  const f=440*2**((m-69)/12);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';
  lp.frequency.setValueAtTime(c.fs||c.f,t);if(c.fs)lp.frequency.setTargetAtTime(c.f,t,.12);
  const g=ctx.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(c.pk,t+c.a);
  if(c.dec)g.gain.setTargetAtTime(c.sus*c.pk,t+c.a,c.dec/3);
  g.gain.setTargetAtTime(0,t+d,c.rel/3);
  const end=t+d+c.rel+.15;
  c.o.forEach(([ty,mu,de,ga])=>{
    const o=ctx.createOscillator();o.type=ty;o.frequency.value=f*mu;o.detune.value=de;
    const gg=ctx.createGain();gg.gain.value=ga;o.connect(gg);gg.connect(lp);
    if(c.vib){const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=5.5;lg.gain.value=9;l.connect(lg);lg.connect(o.detune);l.start(t);l.stop(end);}
    o.start(t);o.stop(end);
  });
  lp.connect(g);g.connect(out);
}
 
/* ---- pitch detection: normalised autocorrelation (McLeod-style) ---- */
function detect(b,sr){
  let e=0;for(let i=0;i<b.length;i++)e+=b[i]*b[i];
  if(Math.sqrt(e/b.length)<.012)return -1;
  const lo=Math.floor(sr/900),hi=Math.min(Math.floor(sr/80),b.length>>1),n=b.length-hi,ns=new Float32Array(hi+1);
  let best=0;
  for(let l=lo;l<=hi;l++){let a=0,m=0;for(let i=0;i<n;i++){a+=b[i]*b[i+l];m+=b[i]*b[i]+b[i+l]*b[i+l];}ns[l]=m?2*a/m:0;if(ns[l]>best)best=ns[l];}
  if(best<.85)return -1;
  for(let l=lo+1;l<hi;l++){
    if(ns[l]>ns[l-1]&&ns[l]>=ns[l+1]&&ns[l]>=.9*best){
      const a=ns[l-1],bb=ns[l],c=ns[l+1],den=a-2*bb+c,sh=den?.5*(a-c)/den:0;
      return sr/(l+sh);
    }
  }
  return -1;
}
 
async function start(){
  ensure();say('');
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});}
  catch(e){say('Microphone unavailable: '+(e&&e.name==='NotAllowedError'?'access was blocked. Click the lock icon in the address bar, allow the microphone, and reload.':'check that a mic is connected and the page is on https.'));return;}
  const src=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.2;src.connect(analyser);
  buf=new Float32Array(2048);fbuf=new Uint8Array(1024);beats=[];prevR=0;lastHit=-1;raw=[];cur=null;cand=-2;candN=0;t0=ctx.currentTime;rec=true;
  $('rec').textContent='■ Stop';$('rec').classList.add('on');
  timer=setInterval(tick,25);
}
function tick(){
  analyser.getFloatTimeDomainData(buf);
  const t=ctx.currentTime-t0,f=detect(buf,ctx.sampleRate),m=f>0?Math.round(69+12*Math.log2(f/440)):-1;
  $('note').textContent=m>=0?NN[m%12]+(Math.floor(m/12)-1):'–';
  $('hz').textContent=f>0?f.toFixed(1)+' Hz':(t-lastHit<.4?'🥁 '+beats[beats.length-1].k:'Listening…');
  if($('live').checked)liveSet(f);
  let r=0;for(let i=0;i<buf.length;i++)r+=buf[i]*buf[i];r=Math.sqrt(r/buf.length);
  if(f<0&&r>.03&&r>prevR*1.8&&t-lastHit>.1){analyser.getByteFrequencyData(fbuf);let a=0,b=0;for(let i=1;i<1024;i++){a+=i*fbuf[i];b+=fbuf[i];}const cn=b?a/b*ctx.sampleRate/2048:0;beats.push({k:cn<700?'kick':cn<3000?'snare':'hat',t});lastHit=t;}
  prevR=r;
  const cm=cur?cur.midi:-1;
  if(m===cm){if(cur)cur.end=t+.025;candN=0;}
  else{
    if(m===cand)candN++;else{cand=m;candN=1;}
    if(candN>=3){
      if(cur){raw.push(cur);cur=null;}
      if(m>=0){const ls=raw.length?raw[raw.length-1].end:0;cur={midi:m,start:Math.max(t-.06,ls),end:t+.025};}
      candN=0;cand=-2;
    }
  }
  draw(raw.concat(cur?[cur]:[]).map(n=>({midi:n.midi,start:n.start,dur:n.end-n.start})),t);
}
function stopRec(){
  clearInterval(timer);rec=false;if(cur)raw.push(cur);cur=null;
  raw=raw.filter(n=>n.end-n.start>=.08);
  stream.getTracks().forEach(x=>x.stop());liveSet(-1);
  $('rec').textContent='● Record';$('rec').classList.remove('on');
  $('note').textContent='–';$('hz').textContent=(raw.length||beats.length)?raw.length+' notes, '+beats.length+' beats captured':'Nothing heard. Try singing louder.';
  findKey();draw(notes());gen();
}
function liveSet(f){
  if(!live){const o=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sawtooth';lp.frequency.value=1800;g.gain.value=0;o.connect(lp);lp.connect(g);g.connect(ctx.destination);o.start();live={o,g};}
  const T=ctx.currentTime;
  if(f>0){live.o.frequency.setTargetAtTime(f,T,.02);live.g.gain.setTargetAtTime(.12,T,.03);}else live.g.gain.setTargetAtTime(0,T,.03);
}
 
/* ---- key detection, snapping, quantising ---- */
const MAJ=[0,2,4,5,7,9,11];
function findKey(){
  const h=new Array(12).fill(0);raw.forEach(n=>h[n.midi%12]+=n.end-n.start);
  let best=-1,r=null;
  for(let k=0;k<12;k++){const s=MAJ.reduce((a,p)=>a+h[(k+p)%12],0);if(s>best){best=s;r=k;}}
  keyRoot=raw.length?r:null;
  $('keyname').textContent=keyRoot===null?'Key: –':'Key: '+NN[r]+' major / '+NN[(r+9)%12]+' minor';
}
function snapKey(m){
  if(keyRoot===null)return m;
  for(const d of [0,-1,1,-2,2]){if(MAJ.includes(((m+d-keyRoot)%12+12)%12))return m+d;}
  return m;
}
function notes(bpmv){
  const step=60/(bpmv||+$('bpm').value||100)/4,q=$('grid').checked;
  let out=raw.map(n=>{
    let s=n.start,d=n.end-n.start,m=$('key').checked?snapKey(n.midi):n.midi;
    if(q){s=Math.round(s/step)*step;d=Math.max(step,Math.round(d/step)*step);}
    return{midi:m,start:s,dur:d};
  });
  return out;
}
 
function noise(t,d,ty,f,gn){const n=Math.ceil(ctx.sampleRate*d),b=ctx.createBuffer(1,n,ctx.sampleRate),x=b.getChannelData(0);for(let i=0;i<n;i++)x[i]=Math.random()*2-1;const s=ctx.createBufferSource();s.buffer=b;const fl=ctx.createBiquadFilter();fl.type=ty;fl.frequency.value=f;const g=ctx.createGain();g.gain.setValueAtTime(gn,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(fl);fl.connect(g);g.connect(master);s.start(t);}
function tone(t,f0,f1,d,gn){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d*.5);g.gain.setValueAtTime(gn,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(master);o.start(t);o.stop(t+d);}
function drum(k,t){
  if(k==='kick')tone(t,160,42,.4,.95);
  else if(k==='snare'){noise(t,.18,'bandpass',1800,.6);tone(t,220,120,.12,.35);}
  else if(k==='hat')noise(t,.05,'highpass',7500,.3);
  else if(k==='taiko'){tone(t,120,55,.7,.8);noise(t,.15,'lowpass',400,.3);}
  else noise(t,1.1,'highpass',4500,.35);
}
 
const PRS=[[[0,'m'],[8,'M'],[3,'M'],[10,'M']],[[0,'m'],[5,'m'],[10,'M'],[8,'M']],[[0,'m'],[0,'m'],[8,'M'],[7,'M']],[[0,'m'],[10,'M'],[8,'M'],[7,'M']]];
const ST={
anime:{n:'Anime fight',sub:'Fast, driving, battle-ready',bpm:172,pr:PRS[0],k:'x..xx.x.x..xx.x.',s:'....x.......x...',h:'xxxxxxxxxxxxxxxx',t:'x.......x.......',b:'x.xxx.xxx.xxx.xx',c:'x..x..x.x..x..x.',ci:'pluck',cl:2,bl:1,mel:['lead','strings'],bi:'bass'},
lofi:{n:'Lo-fi chill',sub:'Warm, slow, study vibes',bpm:78,pr:PRS[1],k:'x.....x...x.....',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',t:'................',b:'x.......x.x.....',c:'x...............',ci:'piano',cl:14,bl:3,mel:['piano'],bi:'bass'},
trap:{n:'Trap',sub:'Heavy 808 energy',bpm:140,pr:PRS[2],k:'x......x..x.....',s:'........x.......',h:'xxxxxxxxxxxxxxxx',t:'................',b:'x......x..x.....',c:'x...............',ci:'strings',cl:14,bl:5,mel:['pluck'],bi:'bass'},
edm:{n:'EDM drop',sub:'Four on the floor',bpm:128,pr:PRS[0],k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.',t:'................',b:'.xxx.xxx.xxx.xxx',c:'x..x..x.........',ci:'organ',cl:2,bl:1,mel:['lead','bell'],bi:'bass'},
epic:{n:'Epic score',sub:'Cinematic, taiko and brass',bpm:120,pr:PRS[3],k:'x.......x...x...',s:'........x.......',h:'................',t:'x...x...x...x...',b:'x...x...x...x...',c:'x...............',ci:'pad',cl:14,bl:3,mel:['brass','strings'],bi:'bass'}
};
const DEMOS=[
{n:'Anime battle',bpm:172,k:'x..xx.x.x..xx.x.',s:'....x.......x...',h:'xxxxxxxxxxxxxxxx',t:'x.......x.......',b:'x.xxx.xxx.xxx.xx',c:'x..x..x.x..x..x.'},
{n:'Boom bap',bpm:90,k:'x..x......x.x...',s:'....x.......x...',h:'x.x.x.x.x.x.x.xx',t:'................',b:'x..x......x.x...',c:'x.......x.......'},
{n:'House',bpm:124,k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.',t:'................',b:'.x.x.x.x.x.x.x.x',c:'x..x..x...x.....'},
{n:'Drum & bass',bpm:174,k:'x.........x.....',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',t:'................',b:'x.........x.....',c:'x.......x.......',pro:1},
{n:'Trap',bpm:140,k:'x......x..x.....',s:'........x.......',h:'xxxxxxxxxxxxxxxx',t:'................',b:'x......x..x.....',c:'x...............',pro:1},
{n:'Lo-fi',bpm:78,k:'x.....x...x.....',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',t:'................',b:'x.......x.x.....',c:'x...............',pro:1},
{n:'Techno',bpm:130,k:'x...x...x...x...',s:'................',h:'.x.x.x.x.x.x.x.x',t:'..x...x...x...x.',b:'x.x.x.x.x.x.x.x.',c:'x...............',pro:1},
{n:'Epic march',bpm:110,k:'x.......x.......',s:'....x.......x...',h:'................',t:'x...x...x...x...',b:'x.......x.......',c:'x...............',pro:1}
];
function arrange(t,ns,S){
  const step=60/S.bpm/4,bar=step*16,e=ns.reduce((a,n)=>Math.max(a,n.start+n.dur),0),mx=PRO?16:8;
  const bars=Math.min(mx,Math.max(4,Math.ceil(Math.ceil(e/bar)/4)*4)),len=bars*bar;
  const tonic=((keyRoot===null?0:keyRoot)+9)%12,use=$('mybeat').checked&&beats.length,D=(k,at)=>drum(k,t+at),on=(p,i)=>p[i]==='x';
  for(let b=0;b<bars;b++){
    const [r,q]=S.pr[b%4],cr=60+(tonic+r)%12,br=(S.bi==='bass'?48:36)+(tonic+r)%12,tri=q==='m'?[0,3,7]:[0,4,7],ph=b%4,intro=bars>4&&b===0;
    for(let i=0;i<16;i++){
      const at=(b*16+i)*step;
      if(!use&&!intro){if(on(S.k,i))D('kick',at);if(on(S.s,i)&&!(ph===3&&i>=8))D('snare',at);if(on(S.h,i))D('hat',at);}
      if(b>0&&on(S.t,i))D('taiko',at);
      if(!intro&&on(S.b,i))voice(S.bi,br,t+at,step*S.bl,master);
      if(on(S.c,i))tri.forEach(x=>voice(S.ci,cr+x,t+at,step*S.cl,master));
    }
    if(ph===3&&!use)for(let i=8;i<16;i++)D('snare',(b*16+i)*step);
    if(ph===0&&b>0)D('crash',b*bar);
  }
  if(use){const sp=Math.ceil(Math.max(...beats.map(x=>x.t))/bar+.01)*bar;for(let o=0;o<len;o+=sp)beats.forEach(x=>{const at=o+Math.round(x.t/step)*step;if(at<len)D(x.k,at);});}
  return len;
}
function stopAll(){if(!ctx)return;master.disconnect();mc.disconnect();newMaster();playEnd=0;playIdx=-1;renderCards();}
function play(i){
  ensure();stopAll();const S=V[i],ns=notes(S.bpm),t=ctx.currentTime+.1;
  ns.forEach(n=>S.mel.forEach(k=>voice(k,n.midi,t+n.start,n.dur,master)));
  const end=arrange(t,ns,S);playT0=t;playEnd=t+end+.6;playIdx=i;renderCards();cancelAnimationFrame(raf);
  const a=()=>{draw(ns);if(ctx.currentTime<playEnd)raf=requestAnimationFrame(a);else{playIdx=-1;renderCards();}};a();
}
function gen(){
  if(!raw.length&&!beats.length)return;
  V=Object.values(ST).map(s=>({...s,mel:[...s.mel]}));sel=-1;renderCards();renderStudio();$('tunes').scrollIntoView({behavior:'smooth'});
}
function renderCards(){
  const box=$('tunes');
  if(!V.length){box.innerHTML='<div class="empty"><b>Your tunes will appear here.</b><div class="mu">Record above, or start from a demo beat and edit it:</div><div class="row chips">'+DEMOS.map((d,j)=>'<button data-sd="'+j+'">'+((d.pro&&!PRO)?'🔒 ':'')+d.n+'</button>').join('')+'</div></div>';return;}
  box.innerHTML=V.map((v,i)=>{
    const lock=!PRO&&i>=2,mini=['k','s','h'].map(r=>'<div class="mini">'+[...v[r]].map(c=>'<i class="'+(c==='x'?r:'')+'"></i>').join('')+'</div>').join(''),ems=[...v.mel,v.ci,v.bi].map(k=>I[k].e).join(' ');
    return '<div class="tune'+(lock?' lock':'')+(i===sel?' cur':'')+'"><div class="tt"><b>'+v.n+'</b><span class="mu">'+v.bpm+' bpm</span></div><div class="mu">'+v.sub+'</div><div class="ems">'+ems+'</div>'+mini+'<div class="row">'+(lock?'<button data-a="pro">🔒 Unlock with Pro</button>':'<button class="pri" data-a="play" data-i="'+i+'">'+(playIdx===i?'■ Stop':'▶ Play')+'</button><button data-a="edit" data-i="'+i+'">Edit</button>')+'</div></div>';
  }).join('');
}
function renderStudio(){
  const el=$('studio');if(sel<0||!V[sel]){el.hidden=true;return;}
  const v=V[sel],lk=c=>c.pro&&!PRO,opts=cu=>Object.entries(I).map(([k,c])=>'<option value="'+k+'"'+(k===cu?' selected':'')+(lk(c)?' disabled':'')+'>'+c.e+' '+c.n+(lk(c)?' 🔒':'')+'</option>').join('');
  const sels=[['m0','Melody',v.mel[0]],['m1','Layer',v.mel[1]||''],['ci','Chords',v.ci],['bi','Bass',v.bi]].map(([k,l,c])=>'<label class="f">'+l+'<select data-s="'+k+'">'+(k==='m1'?'<option value="">None</option>':'')+opts(c)+'</select></label>').join('');
  const rows=[['k','Kick'],['s','Snare'],['h','Hi-hat'],['t','Taiko'],['b','Bass'],['c','Chords']].map(([r,l])=>'<div class="sr"><span>'+l+'</span>'+[...v[r]].map((c,j)=>'<button class="st '+r+(c==='x'?' on':'')+(j%4===0?' q':'')+'" data-r="'+r+'" data-j="'+j+'"></button>').join('')+'</div>').join('');
  el.hidden=false;
  el.innerHTML='<div class="row sp"><h2>✎ '+v.n+'</h2><div class="row"><button class="pri" data-a="play" data-i="'+sel+'">▶ Play</button><button data-a="close">Done</button></div></div><div class="fg">'+sels+'<label class="f">Tempo: <b id="tv">'+v.bpm+'</b> bpm<input type="range" min="60" max="200" value="'+v.bpm+'" id="tp"></label></div>'+rows+'<div class="mu" style="margin:14px 0 4px">Demo beats: tap one to load it, then tweak the grid</div><div class="row chips">'+DEMOS.map((d,j)=>'<button data-d="'+j+'">'+((d.pro&&!PRO)?'🔒 ':'')+d.n+'</button>').join('')+'</div>';
}
function refresh(){$('plan').textContent=PRO?'Pro ✓':'Free · Go Pro';renderCards();renderStudio();}
const modal=v=>$('modal').hidden=!v,PK=['k','s','h','t','b','c'];
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const a=b.dataset.a,d=b.dataset;
  if(a==='pro'||(d.d!==undefined&&DEMOS[d.d].pro&&!PRO)||(d.sd!==undefined&&DEMOS[d.sd].pro&&!PRO))return modal(true);
  if(a==='play'){const i=+d.i;playIdx===i?stopAll():play(i);}
  else if(a==='edit'){sel=+d.i;renderCards();renderStudio();$('studio').scrollIntoView({behavior:'smooth'});}
  else if(a==='close'){sel=-1;renderCards();renderStudio();}
  else if(d.d!==undefined){const m=DEMOS[d.d];PK.forEach(k=>V[sel][k]=m[k]);V[sel].bpm=m.bpm;renderCards();renderStudio();}
  else if(d.sd!==undefined){const m=DEMOS[d.sd];V=[{...ST.anime,mel:[...ST.anime.mel],n:m.n,sub:'Demo beat, make it yours',bpm:m.bpm,...Object.fromEntries(PK.map(k=>[k,m[k]]))}];sel=0;renderCards();renderStudio();}
  else if(d.r){const v=V[sel],x=[...v[d.r]],j=+d.j;x[j]=x[j]==='x'?'.':'x';v[d.r]=x.join('');b.classList.toggle('on');renderCards();}
});
$('studio').addEventListener('input',e=>{if(e.target.id==='tp'){V[sel].bpm=+e.target.value;$('tv').textContent=e.target.value;renderCards();}});
$('studio').addEventListener('change',e=>{const s=e.target.dataset.s;if(!s)return;const v=V[sel],x=e.target.value;if(s[0]==='m'){v.mel=[s==='m0'?x:v.mel[0],s==='m1'?x:v.mel[1]].filter(Boolean);}else v[s]=x;renderCards();});
$('rec').onclick=()=>rec?stopRec():start();
$('remix').onclick=()=>{V.forEach(v=>v.pr=PRS[Math.random()*4|0]);renderCards();};
$('plan').onclick=()=>{if(PRO){PRO=false;refresh();}else modal(true);};
$('upgrade').onclick=()=>{PRO=true;modal(false);refresh();};
$('mclose').onclick=()=>modal(false);
['grid','key'].forEach(i=>$(i).onchange=()=>draw(notes()));
addEventListener('resize',()=>draw(notes()));
refresh();draw([]);
 
/* ---- piano roll ---- */
function draw(ns,rt){
  const cv=$('roll'),dpr=devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;
  if(cv.width!==w*dpr){cv.width=w*dpr;cv.height=h*dpr;}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const cs=getComputedStyle(document.documentElement),bd=cs.getPropertyValue('--bd'),ac=cs.getPropertyValue('--ac'),a2=cs.getPropertyValue('--ac2'),mu=cs.getPropertyValue('--mu');
  if(!ns.length){c.fillStyle=mu;c.font='14px system-ui';c.textAlign='center';c.fillText('Press Record and sing a tune',w/2,h/2);return;}
  const ms=ns.map(n=>n.midi),lo=Math.min(...ms)-2,hi=Math.max(...ms)+2,span=Math.max(hi-lo,12);
  const tot=Math.max(4,...ns.map(n=>n.start+n.dur),rt||0,ctx&&playEnd>playT0&&ctx.currentTime<playEnd?playEnd-playT0-.5:0)*1.02,rh=h/span;
  for(let i=0;i<span;i++){if(NN[(lo+i)%12].includes('#')){c.fillStyle=bd;c.globalAlpha=.35;c.fillRect(0,h-(i+1)*rh,w,rh);c.globalAlpha=1;}}
  c.fillStyle=ac;
  ns.forEach(n=>{const x=n.start/tot*w,y=h-(n.midi-lo+1)*rh,nw=Math.max(3,n.dur/tot*w-1);c.beginPath();c.roundRect(x,y+1,nw,Math.max(4,rh-2),3);c.fill();});
  const bc={kick:a2,snare:ac,hat:mu};beats.forEach(b=>{c.fillStyle=bc[b.k];c.beginPath();c.arc(b.t/tot*w,8,b.k==='kick'?5:b.k==='snare'?4:2.5,0,7);c.fill();});
  const px=rec?rt/tot*w:(ctx&&ctx.currentTime<playEnd&&ctx.currentTime>playT0)?(ctx.currentTime-playT0)/tot*w:-1;
  if(px>=0){c.fillStyle=a2;c.fillRect(px,0,2,h);}
}
