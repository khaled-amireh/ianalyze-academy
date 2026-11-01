/* Paired still captures; reduced motion gives a stable final composition. */
import {writeFileSync,mkdirSync} from 'node:fs';
const stage=process.argv[2];
if(!['before','after'].includes(stage))throw new Error('Use before or after');
const root=new URL('../',import.meta.url), out=new URL(`docs/phase-00/refinement/${stage}/`,root);
mkdirSync(out,{recursive:true});
const targets=await(await fetch('http://127.0.0.1:9222/json/list')).json();
const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
await send('Page.enable');await send('Runtime.enable');
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Page.navigate',{url:'http://127.0.0.1:4173/'});
for(let i=0;i<100;i++){if(await evaluate('Boolean(document.querySelector("[data-lang=en]"))'))break;await new Promise(r=>setTimeout(r,50));}
const routes=['home','about','syllabus','videos','team','join','leaderboard','contact','student','activity','organizer','admin'];
const shots=routes.flatMap(route=>[[route,'en',1440],[route,'ar',390]]).concat([['home','ar',1440],['home','en',390],['syllabus','ar',768],['activity','ar',320],['wireframes','en',1440]]);
for(const [route,lang,width] of shots){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width<640?844:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('[data-lang=${lang}]').click();location.hash='${route}';`);
  await evaluate('new Promise(async resolve=>{await document.fonts.ready;requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))})');
  await evaluate('document.activeElement.blur();window.scrollTo(0,0);');
  const metrics=await send('Page.getLayoutMetrics');
  const height=Math.min(Math.ceil(metrics.cssContentSize.height),route==='wireframes'?1600:14000);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});
  writeFileSync(new URL(`${route}-${lang}-${width}.png`,out),Buffer.from(shot.data,'base64'));
}
await send('Emulation.setEmulatedMedia',{features:[]});ws.close();
console.log(`${shots.length} ${stage} screenshots captured.`);
