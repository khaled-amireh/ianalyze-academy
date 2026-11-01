import { readFileSync, writeFileSync } from 'node:fs';
const notFoundTitles = Object.fromEntries(
  ['ar', 'en'].map((locale) => [
    locale,
    JSON.parse(readFileSync(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'))
      .error.notFoundTitle,
  ]),
);
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const ws = new WebSocket(targets.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let seq = 0;
const pending = new Map(),
  exceptions = [];
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(m.error);
    else p.resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function load(url) {
  await send('Page.navigate', { url });
  for (let n = 0; n < 100; n++) {
    await pause(50);
    if (await evaluate('document.readyState==="complete"&&Boolean(document.querySelector("h1"))')) {
      await evaluate('document.fonts.ready.then(()=>true)');
      return;
    }
  }
  throw new Error(`Unable to load ${url}`);
}
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
const checks = [];
for (const locale of ['ar', 'en']) {
  await load('http://127.0.0.1:4174/');
  await evaluate(`localStorage.setItem('ianalyze.language','${locale}')`);
  for (const path of [
    '/_preview/components',
    '/_preview/student',
    '/_preview/organizer',
    '/_preview/admin',
    '/student',
    '/organizer',
    '/admin',
  ]) {
    await load(`http://127.0.0.1:4174${path}`);
    checks.push({
      locale,
      path,
      ...(await evaluate(
        `({notFound:document.querySelector('h1').textContent===${JSON.stringify(notFoundTitles[locale])},noFixture:!document.querySelector('[data-preview],.dashboard-shell,.preview-tabs'),noPreviewLink:![...document.querySelectorAll('a')].some(a=>a.getAttribute('href')?.startsWith('/_preview/'))})`,
      )),
    });
  }
}
// The exact translated title is read from source in the final check, not inferred from URL.
const interactions = {};
await load('http://127.0.0.1:4174/about');
await evaluate('document.querySelector(".language-switcher button[lang=en]").click()');
await evaluate('document.querySelector(".utility-actions button[data-slot=button]").click()');
const desiredTheme = await evaluate('document.documentElement.dataset.theme');
await load('http://127.0.0.1:4174/about');
interactions.preferencesPersist = await evaluate(
  `document.documentElement.lang==='en'&&document.documentElement.dir==='ltr'&&document.documentElement.dataset.theme==='${desiredTheme}'`,
);
await evaluate(`document.querySelector('.desktop-nav a[href="/eda"]').click()`);
await pause(50);
interactions.navigation = await evaluate(
  'location.pathname==="/eda"&&document.activeElement.id==="page-title"',
);
// Native keyboard: initial Tab reaches the skip link after a direct load.
await load('http://127.0.0.1:4174/');
await send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Tab',
  code: 'Tab',
  windowsVirtualKeyCode: 9,
});
await send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Tab',
  code: 'Tab',
  windowsVirtualKeyCode: 9,
});
interactions.firstTabSkipLink = await evaluate(
  'document.activeElement.classList.contains("skip-link")',
);
const injection = await send('Page.addScriptToEvaluateOnNewDocument', {
  source:
    "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})",
});
await load('http://127.0.0.1:4174/');
interactions.blockedStorageRendersDefaults = await evaluate(
  'document.documentElement.lang==="ar"&&document.documentElement.dataset.theme==="light"&&Boolean(document.querySelector(".hero"))',
);
await evaluate('document.querySelector(".language-switcher button[lang=en]").click()');
await pause(50);
interactions.blockedStorageStillSwitches = await evaluate('document.documentElement.lang==="en"');
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
const results = { date: '2026-10-31', checks, interactions, exceptions };
writeFileSync(
  new URL('../../docs/phase-01/production-browser-results.json', import.meta.url),
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
ws.close();
if (
  checks.some((c) => !c.notFound || !c.noFixture || !c.noPreviewLink) ||
  Object.values(interactions).some((v) => !v) ||
  exceptions.length
)
  process.exitCode = 1;
