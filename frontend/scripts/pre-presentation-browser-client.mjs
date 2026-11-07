import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
export const out = resolve(root, 'docs/audits/fixes-evidence');
mkdirSync(out, { recursive: true });
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export const save = (name, data) =>
  writeFileSync(resolve(out, name), JSON.stringify(data, null, 2));
export async function browser(engine = 'chrome', port = 9248) {
  const exe =
    engine === 'edge'
      ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
      : 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const child = spawn(
    exe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${resolve(root, 'frontend/artifacts/pre-presentation-fixes/profile-' + engine + '-' + port)}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let tabs;
  for (let i = 0; i < 100; i++) {
    try {
      tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      break;
    } catch {
      await pause(100);
    }
  }
  if (!tabs) throw Error('Browser launch failed: ' + engine);
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', j, { once: true });
  });
  let seq = 0;
  const pending = new Map(),
    events = [];
  let tag = '';
  const listeners = [];
  ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.error) p.reject(Error(m.error.message));
        else p.resolve(m.result);
      }
    } else {
      if (
        [
          'Runtime.exceptionThrown',
          'Runtime.consoleAPICalled',
          'Network.loadingFailed',
          'Network.responseReceived',
          'Log.entryAdded',
        ].includes(m.method)
      )
        events.push({ tag, method: m.method, params: m.params });
      for (const fn of listeners) fn(m);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error('CDP timeout ' + method));
      }, 20000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const wait = async (expression, ms = 12000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      try {
        if (await ev(expression)) return;
      } catch {
        // A document can change execution context while navigation is settling.
      }
      await pause(50);
    }
    throw Error('Wait timed out: ' + expression);
  };
  const load = async (url) => {
    tag = url;
    await send('Page.navigate', { url });
    await wait("document.readyState==='complete'&&!!document.querySelector('h1')", 18000);
    await ev('document.fonts.ready.then(()=>true)');
    await pause(100);
  };
  const size = async (width, height = 900) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 500,
      screenOrientation: {
        type: width > height ? 'landscapePrimary' : 'portraitPrimary',
        angle: width > height ? 90 : 0,
      },
    });
    await pause(40);
  };
  const shot = async (name, full = false) => {
    const r = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: full,
      ...(full
        ? {
            clip: {
              x: 0,
              y: 0,
              width: await ev('innerWidth'),
              height: await ev('Math.min(document.documentElement.scrollHeight,16000)'),
              scale: 1,
            },
          }
        : {}),
    });
    writeFileSync(resolve(out, name), Buffer.from(r.data, 'base64'));
  };
  const click = async (selector) => {
    const p = await ev(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing ${selector}');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...p,
      button: 'left',
      clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...p,
      button: 'left',
      clickCount: 1,
    });
    await pause(80);
  };
  const key = async (key, shift = false) => {
    const code = { Tab: 9, Enter: 13, Escape: 27, ArrowDown: 40 }[key] || 0;
    for (const type of ['keyDown', 'keyUp'])
      await send('Input.dispatchKeyEvent', {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: code,
        nativeVirtualKeyCode: code,
        modifiers: shift ? 8 : 0,
        ...(type === 'keyDown' && key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
      });
    await pause(30);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return {
    send,
    ev,
    wait,
    load,
    size,
    shot,
    click,
    key,
    events,
    listeners,
    setTag: (t) => (tag = t),
    version: await send('Browser.getVersion'),
    close: async () => {
      await send('Browser.close').catch(() => {});
      ws.close();
      child.kill();
    },
  };
}
