/* Separate external playback check; the layout matrix remains network-independent. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const targets = await (await fetch('http://127.0.0.1:9225/json/list')).json();
const page = targets.filter((t) => t.type === 'page');
assert.equal(page.length, 1, 'Use the isolated test browser, with one page');
const ws = new WebSocket(page[0].webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: 'http://127.0.0.1:4174/videos' });
const evidence = {
  date: '2026-11-01',
  method: 'Muted playback in the nested video element, using a headless user gesture',
  playback: [],
  playbackVerified: false,
  initialized: false,
};
try {
  for (let attempt = 0; attempt < 10; attempt++) {
    await pause(1000);
    const targetInfo = await send('Target.getTargets');
    if (!evidence.initialized) {
      const drive = targetInfo.targetInfos.find(
        (t) => t.type === 'iframe' && t.url.startsWith('https://drive.google.com/'),
      );
      if (drive) {
        const session = await send('Target.attachToTarget', {
          targetId: drive.targetId,
          flatten: true,
        });
        const initialize = await send(
          'Runtime.evaluate',
          {
            expression: `(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')?.endsWith(': k')&&e.offsetWidth>0);if(b){b.click();return true}return false})()`,
            returnByValue: true,
            userGesture: true,
          },
          session.sessionId,
        );
        evidence.initialized = initialize.result?.value === true;
      }
      if (!evidence.initialized) continue;
      await pause(2000);
    }
    const nested = targetInfo.targetInfos.find(
      (t) => t.type === 'iframe' && t.url.startsWith('https://youtube.googleapis.com/'),
    );
    if (!nested) continue;
    const attached = await send('Target.attachToTarget', {
      targetId: nested.targetId,
      flatten: true,
    });
    const result = await send(
      'Runtime.evaluate',
      {
        expression: `(async()=>{const v=document.querySelector('video');if(!v)return null;v.muted=true;try{await Promise.race([v.play(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Playback startup timed out')),3000))]);return {started:true}}catch(e){return {started:false,error:e.message}}})()`,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      },
      attached.sessionId,
    );
    evidence.start = result.result.value;
    await pause(2500);
    const state = await send(
      'Runtime.evaluate',
      {
        expression: `[...document.querySelectorAll('video')].map(v=>({readyState:v.readyState,paused:v.paused,currentTime:v.currentTime,videoWidth:v.videoWidth,muted:v.muted,error:v.error?.code}))`,
        returnByValue: true,
      },
      attached.sessionId,
    );
    evidence.playback = state.result.value;
    evidence.playbackVerified = evidence.playback.some(
      (v) => !v.paused && v.currentTime > 1 && v.readyState >= 2 && v.videoWidth > 0,
    );
    if (evidence.playbackVerified) break;
  }
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(
    new URL('../../docs/phase-02/screenshots/video-playback.png', import.meta.url),
    Buffer.from(screenshot.data, 'base64'),
  );
  evidence.screenshot = 'screenshots/video-playback.png';
  writeFileSync(
    new URL('../../docs/phase-02/video-results.json', import.meta.url),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  ws.close();
}
if (!evidence.playbackVerified) process.exitCode = 1;
