/* Browser QA via installed Chrome's DevTools protocol; no dependencies. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const out = new URL('docs/phase-00/',root);
mkdirSync(new URL('screenshots/',out),{recursive:true});
const response = await fetch('http://127.0.0.1:4173/');
if(!response.ok) throw new Error(`Preview HTTP ${response.status}`);
const tabs = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = tabs.find(t=>t.type==='page');
if(!page) throw new Error('No Chrome page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let seq=0; const pending=new Map(), exceptions=[], failures=[], requests=[];
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);else if(m.method==='Network.loadingFailed')failures.push(m.params);else if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);});
function send(method,params={}) { return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));}); }
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function settle(){return evaluate('new Promise(async resolve=>{await document.fonts.ready;requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))})');}
async function go(route,lang,width,height=1000){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate(`document.querySelector('[data-lang="${lang}"]').click(); location.hash='${route}';`);await settle();}
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
await send('Page.navigate',{url:'http://127.0.0.1:4173/'});
await new Promise(resolve=>{const poll=async()=>{if(await evaluate('Boolean(window.ACADEMY_LOCALES && document.querySelector("h1"))'))resolve();else setTimeout(poll,50);};poll();});
await settle();
const locales = Object.fromEntries(['ar','en'].map(l=>[l,JSON.parse(readFileSync(new URL(`design-preview/locales/${l}.json`,root),'utf8'))]));
function shape(v,p=''){if(Array.isArray(v))return v.flatMap((x,i)=>shape(x,p+'.'+i));if(typeof v==='object')return Object.keys(v).sort().flatMap(k=>shape(v[k],p+'.'+k));return[p];}
const parity=JSON.stringify(shape(locales.ar))===JSON.stringify(shape(locales.en));
const routes=['home','about','syllabus','videos','team','join','leaderboard','contact','student','activity','organizer','admin','wireframes'];
const checks=[];
for(const lang of ['ar','en'])for(const width of [320,390,768,1024,1440])for(const route of routes){
  await go(route,lang,width);
  const result=await evaluate(`(()=>{const bad=[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return s.display!=='none'&&s.position!=='fixed'&&r.width>0&&(r.right>innerWidth+1||r.left< -1)}).slice(0,6).map(el=>({tag:el.tagName,cls:el.className,rect:[Math.round(el.getBoundingClientRect().left),Math.round(el.getBoundingClientRect().right)]}));return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,overflowElements:bad,h1:document.querySelectorAll('h1').length,dir:document.documentElement.dir,lang:document.documentElement.lang,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),undefinedText:/undefined|\\[object Object\\]/.test(document.querySelector('main').textContent),unlabeledInputs:[...document.querySelectorAll('input,textarea,select')].filter(i=>!i.labels?.length&&!i.getAttribute('aria-label')).map(i=>i.outerHTML),unlabeledButtons:[...document.querySelectorAll('button')].filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')).length,codeDirections:[...document.querySelectorAll('pre')].map(el=>getComputedStyle(el).direction)}})()`);
  checks.push({lang,width,route,...result});
}
const interactions={};
await go('home','en',390,844);
await evaluate('document.getElementById("menu-toggle").focus()');
async function key(key,code=key){const vk={Enter:13,Escape:27,Tab:9}[key]||0;await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await settle();}
await key('Enter');
interactions.keyboardMenuOpen=await evaluate('document.getElementById("menu-toggle").getAttribute("aria-expanded")==="true" && getComputedStyle(document.getElementById("public-nav")).display!=="none"');
await key('Escape');
interactions.escapeClosesMenu=await evaluate('document.getElementById("menu-toggle").getAttribute("aria-expanded")==="false" && document.activeElement.id==="menu-toggle"');
await go('home','ar',320,800);await evaluate('document.getElementById("menu-toggle").click()');
interactions.menu320NoOverflow=await evaluate('document.documentElement.scrollWidth<=innerWidth && document.getElementById("menu-toggle").getAttribute("aria-expanded")==="true"');
await evaluate('document.querySelector("[data-lang=ar]").click();location.hash="syllabus"');await settle();
interactions.languagePreservedOnNavigation=await evaluate('document.documentElement.lang==="ar" && localStorage.getItem("ianalyze-preview-language")==="ar" && location.hash==="#syllabus"');
await send('Page.reload');await settle();
interactions.languagePreservedOnReload=await evaluate('document.documentElement.lang==="ar" && location.hash==="#syllabus"');
await evaluate('document.querySelector("[data-lang=en]").click()');await settle();
interactions.switchPreservesRoute=await evaluate('location.hash==="#syllabus" && document.documentElement.dir==="ltr"');
await evaluate('document.querySelector("summary").focus()');
const wasOpen=await evaluate('document.querySelector("details").open');await key('Enter');
interactions.keyboardDisclosure=await evaluate(`document.querySelector('details').open!==${wasOpen}`);
await go('activity','ar',320,800);
interactions.states=[];
for(let i=0;i<4;i++){await evaluate(`(()=>{const select=document.getElementById('state-select');select.value='${i}';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);interactions.states.push(await evaluate(`Boolean(document.querySelector('.state-${i}'))`));}
interactions.noUploadControl=await evaluate('document.querySelectorAll("input[type=file]").length===0');
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
interactions.reducedMotion=await evaluate('getComputedStyle(document.documentElement).scrollBehavior==="auto" && getComputedStyle(document.querySelector(".button")).transitionDuration==="0s"');
await send('Emulation.setEmulatedMedia',{features:[]});
// Reflow proxy: 1440px at 200% browser-equivalent CSS width is 720px.
await go('home','ar',720,900);interactions.reflow720=await evaluate('document.documentElement.scrollWidth<=innerWidth');
// WCAG text spacing settings applied at the narrowest required width.
await go('join','ar',320,900);await evaluate(`document.head.insertAdjacentHTML('beforeend','<style id="qa-spacing">p,li,label{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}</style>')`);
interactions.textSpacingNoOverflow=await evaluate('document.documentElement.scrollWidth<=innerWidth');await evaluate('document.getElementById("qa-spacing").remove()');
interactions.noServiceForm=await evaluate('document.querySelectorAll("form").length===1 && !document.querySelector("form").getAttribute("action") && document.querySelector("form button").disabled');
const beforeSubmitRequests=requests.length;
interactions.submitPrevented=await evaluate('!document.querySelector("form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
await settle();interactions.submitMakesNoRequest=requests.length===beforeSubmitRequests;
await evaluate('document.getElementById("menu-toggle").focus()');await key('Tab');
interactions.keyboardFocusVisible=await evaluate('document.activeElement.matches(":focus-visible") && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3');
await go('wireframes','en',1440);
interactions.tenWireframePairs=await evaluate('document.querySelectorAll(".wire-sheet").length===10 && document.querySelectorAll(".wire-desktop").length===10 && document.querySelectorAll(".wire-mobile").length===10');
await go('student','ar',390);
interactions.numericRatioIsolated=await evaluate('document.querySelector(".progress-stat strong bdi").textContent==="2 / 6" && getComputedStyle(document.querySelector(".progress-stat strong bdi")).direction==="ltr"');
const screenshots=[['home','en',1440],['home','ar',1440],['home','en',390],['home','ar',390],['syllabus','ar',768],['student','en',1440],['student','ar',390],['admin','en',1440],['organizer','ar',390],['activity','ar',320],['leaderboard','ar',390],['wireframes','en',1440]];
const captures=[];
for(const [route,lang,width] of screenshots){await go(route,lang,width,width<640?844:1000);await evaluate('document.activeElement.blur()');const dimensions=await send('Page.getLayoutMetrics');const fullHeight=Math.min(Math.ceil(dimensions.cssContentSize.height),route==='wireframes'?1600:10000);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:fullHeight,scale:1}});const name=`${route}-${lang}-${width}.png`;writeFileSync(new URL('screenshots/'+name,out),Buffer.from(shot.data,'base64'));captures.push(name);}
function lum(hex){const rgb=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function contrast(a,b){const x=lum(a),y=lum(b);return Math.round((Math.max(x,y)+.05)/(Math.min(x,y)+.05)*100)/100;}
const pairs=[['text/white','#142e3a','#ffffff',4.5],['muted/canvas','#526875','#f3f7fa',4.5],['muted/tint','#526875','#eaf3f5',4.5],['primary/white','#ffffff','#08546f',4.5],['hover/white','#ffffff','#063f53',4.5],['text/teal','#142e3a','#429eab',4.5],['text/orange','#142e3a','#df8a48',4.5],['error/white','#9e2619','#ffffff',4.5],['success','#216344','#e9f5ed',4.5],['warning','#784319','#fbf2e9',4.5],['input boundary','#738894','#ffffff',3],['focus/canvas','#08546f','#f3f7fa',3],['disabled text','#526875','#e8edf0',4.5]];
const contrasts=pairs.map(([name,foreground,background,min])=>({name,foreground,background,ratio:contrast(foreground,background),min,pass:contrast(foreground,background)>=min}));
const assetHashes={};for(const name of ['ianalyze-logo.png','iteam-logo.png']){const copy=readFileSync(new URL('design-preview/assets/'+name,root));const original=readFileSync('C:/Users/khale/Downloads/'+name);assetHashes[name]={sha256:createHash('sha256').update(copy).digest('hex'),matchesOriginal:copy.equals(original)};}
const browser=await send('Browser.getVersion');
// Direct opening is supported without a server or fetch-based locale loading.
await send('Page.navigate',{url:new URL('design-preview/index.html',root).href+'#activity'});
await new Promise(resolve=>{const poll=async()=>{if(await evaluate('location.protocol==="file:" && Boolean(document.querySelector("pre"))'))resolve();else setTimeout(poll,50);};poll();});
await settle();
interactions.directFileOpen=await evaluate('document.querySelectorAll("h1").length===1 && [...document.images].every(i=>i.complete&&i.naturalWidth>0) && document.fonts.check("16px Cairo") && document.fonts.check("16px Inter")');
await evaluate('document.querySelector("[data-lang=en]").click();location.hash="student"');await settle();
interactions.directFileNavigationAndLanguage=await evaluate('location.hash==="#student" && document.documentElement.lang==="en" && document.documentElement.dir==="ltr"');
const report={date:'2026-10-31',browser,httpStatus:response.status,translationShapeParity:parity,matrixCount:checks.length,checks,interactions,contrasts,assetHashes,screenshots:captures,exceptions,networkFailures:failures,externalRequests:[...new Set(requests.filter(u=>!u.startsWith('http://127.0.0.1:4173/')&&!u.startsWith('data:')&&!u.startsWith('file:')))]};
writeFileSync(new URL('qa-results.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify({matrix:checks.length,layoutFailures:checks.filter(x=>x.overflow||x.h1!==1||x.brokenImages.length||x.undefinedText||x.unlabeledInputs.length||x.unlabeledButtons).map(x=>({lang:x.lang,width:x.width,route:x.route,overflow:x.overflow,elements:x.overflowElements})),parity,interactions,contrastFailures:contrasts.filter(x=>!x.pass),exceptions:exceptions.length,networkFailures:failures.length,externalRequests:report.externalRequests,screenshots:captures},null,2));
ws.close();
if(!parity||checks.some(x=>x.overflow||x.h1!==1||x.dir!==(x.lang==='ar'?'rtl':'ltr')||x.codeDirections.some(d=>d!=='ltr')||x.brokenImages.length||x.undefinedText||x.unlabeledInputs.length||x.unlabeledButtons)||contrasts.some(x=>!x.pass)||Object.values(interactions).some(x=>Array.isArray(x)?x.some(v=>!v):!x)||exceptions.length||failures.length) process.exitCode=1;
