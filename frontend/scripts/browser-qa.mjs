/* Uses installed Chrome via CDP. No browser-testing dependency or external service. */
import { mkdirSync, writeFileSync } from 'node:fs';
const out = new URL('../../docs/phase-01/', import.meta.url);
mkdirSync(new URL('screenshots/', out), { recursive: true });
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const ws = new WebSocket(targets.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let id = 0;
const pending = new Map(),
  exceptions = [],
  consoleErrors = [],
  requests = [],
  failures = [];
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(m.error);
    else p.resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails);
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    consoleErrors.push(m.params.args);
  else if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
  else if (m.method === 'Network.loadingFailed' && !m.params.canceled) failures.push(m.params);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const seq = ++id;
    pending.set(seq, { resolve, reject });
    ws.send(JSON.stringify({ id: seq, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function settle() {
  await evaluate(
    'new Promise(async resolve=>{await document.fonts.ready;requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))})',
  );
}
async function load(path, port = 5173) {
  await send('Page.navigate', { url: `http://127.0.0.1:${port}${path}` });
  for (let n = 0; n < 100; n++) {
    await pause(50);
    if (
      await evaluate(
        `location.pathname===${JSON.stringify(path)} && document.querySelectorAll('h1').length===1 && document.readyState==='complete'`,
      )
    ) {
      await settle();
      return;
    }
  }
  throw new Error(`Page did not render: ${path}`);
}
async function size(width, height = 1000) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}
async function key(key, shift = false) {
  const vk = { Enter: 13, Escape: 27, Tab: 9 }[key] || 0;
  const params = {
    key,
    code: key,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers: shift ? 8 : 0,
  };
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    ...params,
    ...(key === 'Enter' ? { text: '\r' } : {}),
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
  await settle();
}
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Page.bringToFront');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await size(1440);
await load('/');
const interactions = {},
  checks = [],
  screenshots = [];
await evaluate('localStorage.clear()');
await load('/');
interactions.defaultArabicLight = await evaluate(
  'document.documentElement.lang === "ar" && document.documentElement.dir === "rtl" && document.documentElement.dataset.theme === "light"',
);
const routes = [
  '/',
  '/about',
  '/eda',
  '/videos',
  '/team',
  '/join',
  '/leaderboard',
  '/contact',
  '/_preview/components',
  '/_preview/student',
  '/_preview/organizer',
  '/_preview/admin',
  '/missing-page',
];
for (const locale of ['ar', 'en'])
  for (const theme of ['light', 'dark']) {
    await evaluate(
      `localStorage.setItem('ianalyze.language','${locale}');localStorage.setItem('ianalyze.theme','${theme}')`,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await size(width);
      for (const route of routes) {
        await load(route);
        const result = await evaluate(
          `(()=>{const main=document.querySelector('main');return {lang:document.documentElement.lang,dir:document.documentElement.dir,theme:document.documentElement.dataset.theme,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('h1').length,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,brandChildren:[...document.querySelector('.brand-logo').children].map(e=>e.tagName),brandText:document.querySelector('.brand-logo').textContent.trim(),unlabeledInputs:[...document.querySelectorAll('input,textarea,select')].filter(i=>!i.labels?.length&&!i.getAttribute('aria-label')).length,unlabeledButtons:[...document.querySelectorAll('button')].filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')).length,codeDirections:[...document.querySelectorAll('pre')].map(e=>getComputedStyle(e).direction),badText:/undefined|\\[object Object\\]|components\\.dialog|pages\\.about|workspace\\./.test(main.textContent),overflowElements:[...main.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1)}).slice(0,6).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'svg'}))}})()`,
        );
        checks.push({ route, locale, requestedTheme: theme, requestedWidth: width, ...result });
      }
    }
    console.log(`Reviewed ${locale}/${theme}: ${checks.length} layouts`);
  }
await size(390, 844);
await load('/');
await evaluate('document.querySelector(".mobile-menu-trigger").focus()');
await key('Enter');
interactions.keyboardMenuOpen = await evaluate('Boolean(document.querySelector("[role=dialog]"))');
await key('Tab');
interactions.menuFocusContained = await evaluate(
  'document.querySelector("[role=dialog]").contains(document.activeElement)',
);
await key('Escape');
await pause(50);
interactions.menuEscapeRestoresFocus = await evaluate(
  '!document.querySelector("[role=dialog]") && document.activeElement.classList.contains("mobile-menu-trigger")',
);
await evaluate('document.querySelector(".mobile-menu-trigger").click()');
await settle();
await evaluate(`document.querySelector('.mobile-nav-links a[href="/eda"]').click()`);
await settle();
await pause(50);
interactions.menuLinkNavigates = await evaluate(
  'location.pathname==="/eda"&&!document.querySelector("[role=dialog]")&&document.activeElement.id==="page-title"',
);
await evaluate('document.querySelector(".language-switcher button[lang=ar]").click()');
await settle();
interactions.switchKeepsRoute = await evaluate(
  'location.pathname==="/eda"&&document.documentElement.lang==="ar"&&document.documentElement.dir==="rtl"',
);
await evaluate('document.querySelector(".utility-actions button[data-slot=button]").click()');
await settle();
await load('/eda');
interactions.preferencePersistence = await evaluate(
  'document.documentElement.lang==="ar"&&document.documentElement.dataset.theme==="light"&&localStorage.getItem("ianalyze.theme")==="light"',
);
await size(1440);
await load('/_preview/components');
await load('/');
interactions.englishPhraseIsolation = await evaluate(
  `document.documentElement.lang==='ar' && [...document.querySelectorAll('.notebook-note bdi')].some(el=>el.textContent==='Hello, Python.')`,
);
await load('/_preview/components');
await evaluate('document.querySelector(".component-gallery button[aria-haspopup=dialog]").focus()');
await key('Enter');
interactions.dialogOpens = await evaluate('Boolean(document.querySelector("[role=dialog]"))');
for (let n = 0; n < 6; n++) await key('Tab');
interactions.dialogTabTrap = await evaluate(
  'document.querySelector("[role=dialog]").contains(document.activeElement)',
);
await key('Tab', true);
interactions.dialogReverseTabTrap = await evaluate(
  'document.querySelector("[role=dialog]").contains(document.activeElement)',
);
await key('Escape');
await pause(50);
interactions.dialogEscapeRestoresFocus = await evaluate(
  '!document.querySelector("[role=dialog]")&&document.activeElement.getAttribute("aria-haspopup")==="dialog"',
);
await evaluate('document.querySelector("[data-slot=accordion-trigger]").focus()');
await key('Enter');
interactions.keyboardAccordion = await evaluate(
  'document.querySelector("[data-slot=accordion-trigger]").getAttribute("aria-expanded")==="true"',
);
interactions.reducedMotion = await evaluate(
  'document.getAnimations().length===0 && getComputedStyle(document.querySelector(".academy-button")).transitionDuration==="0s"',
);
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
});
await load('/');
interactions.motionEnabled = await evaluate(
  'getComputedStyle(document.querySelector(".academy-button")).transitionDuration!=="0s"',
);
await pause(1000);
interactions.entranceSettles = await evaluate(
  '[...document.querySelectorAll(".hero-copy>*")].every(e=>getComputedStyle(e).opacity==="1")',
);
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
for (const [name, path, locale, theme, width, height] of [
  ['home-en-light-desktop', '/', 'en', 'light', 1440, 1000],
  ['home-ar-light-desktop', '/', 'ar', 'light', 1440, 1000],
  ['home-en-dark-desktop', '/', 'en', 'dark', 1440, 1000],
  ['home-ar-dark-mobile', '/', 'ar', 'dark', 390, 844],
  ['home-en-light-mobile', '/', 'en', 'light', 390, 844],
  ['eda-ar-light-desktop', '/eda', 'ar', 'light', 1440, 1000],
  ['components-en-light', '/_preview/components', 'en', 'light', 1440, 1000],
  ['components-ar-dark-mobile', '/_preview/components', 'ar', 'dark', 390, 844],
  ['student-ar-light', '/_preview/student', 'ar', 'light', 1440, 1000],
  ['organizer-en-dark', '/_preview/organizer', 'en', 'dark', 1440, 1000],
  ['admin-en-light', '/_preview/admin', 'en', 'light', 1440, 1000],
  ['student-ar-mobile', '/_preview/student', 'ar', 'light', 320, 844],
]) {
  await evaluate(
    `localStorage.setItem('ianalyze.language','${locale}');localStorage.setItem('ianalyze.theme','${theme}')`,
  );
  await size(width, height);
  await load(path);
  const metrics = await send('Page.getLayoutMetrics');
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 },
  });
  writeFileSync(new URL(`screenshots/${name}.png`, out), Buffer.from(shot.data, 'base64'));
  screenshots.push(`${name}.png`);
}
const contrastPairs = [
  ['body', '--foreground', '--background', 4.5],
  ['muted canvas', '--muted-foreground', '--background', 4.5],
  ['muted card', '--muted-foreground', '--card', 4.5],
  ['primary button', '--primary-foreground', '--primary', 4.5],
  ['secondary', '--secondary-foreground', '--secondary', 4.5],
  ['success', '--success', '--success-surface', 4.5],
  ['warning', '--warning', '--warning-surface', 4.5],
  ['error', '--destructive', '--error-surface', 4.5],
  ['input boundary', '--input', '--card', 3],
  ['focus', '--ring', '--background', 3],
];
function luminance(hex) {
  const v = hex.trim().replace('#', '');
  const n =
    v.length === 3
      ? v
          .split('')
          .map((x) => x + x)
          .join('')
      : v;
  return [0.2126, 0.7152, 0.0722].reduce((sum, w, i) => {
    const c = parseInt(n.slice(i * 2, i * 2 + 2), 16) / 255;
    return sum + w * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  }, 0);
}
const contrasts = [];
for (const theme of ['light', 'dark']) {
  await evaluate(`document.documentElement.classList.toggle('dark','${theme}'==='dark')`);
  for (const [label, fg, bg, min] of contrastPairs) {
    const [a, b] = await evaluate(
      `[getComputedStyle(document.documentElement).getPropertyValue('${fg}'),getComputedStyle(document.documentElement).getPropertyValue('${bg}')]`,
    );
    const x = luminance(a),
      y = luminance(b),
      ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    contrasts.push({ theme, label, ratio: Math.round(ratio * 100) / 100, min, pass: ratio >= min });
  }
}
const renderedButtonContrasts = [];
for (const theme of ['light', 'dark']) {
  await evaluate(`localStorage.setItem('ianalyze.theme','${theme}')`);
  await size(1440);
  await load('/');
  const colors = await evaluate(
    `(()=>{const s=getComputedStyle(document.querySelector('.hero-actions .academy-button'));return [s.color,s.backgroundColor]})()`,
  );
  function rgbLuminance(rgb) {
    const channels = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
    return [0.2126, 0.7152, 0.0722].reduce((sum, w, i) => {
      const c = channels[i] / 255;
      return sum + w * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    }, 0);
  }
  const a = rgbLuminance(colors[0]),
    b = rgbLuminance(colors[1]),
    ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  renderedButtonContrasts.push({
    theme,
    colors,
    ratio: Math.round(ratio * 100) / 100,
    pass: ratio >= 4.5,
  });
}
const layoutFailures = checks.filter(
  (x) =>
    x.lang !== x.locale ||
    x.theme !== x.requestedTheme ||
    x.width !== x.requestedWidth ||
    x.dir !== (x.locale === 'ar' ? 'rtl' : 'ltr') ||
    x.overflow ||
    x.h1 !== 1 ||
    x.brokenImages ||
    x.brandText ||
    x.brandChildren.join() !== 'IMG' ||
    x.unlabeledInputs ||
    x.unlabeledButtons ||
    x.badText ||
    x.codeDirections.some((d) => d !== 'ltr'),
);
const externalRequests = [
  ...new Set(
    requests.filter(
      (url) =>
        !url.startsWith('http://127.0.0.1:5173/') &&
        !url.startsWith('ws://127.0.0.1:5173/') &&
        !url.startsWith('data:'),
    ),
  ),
];
const report = {
  date: '2026-10-31',
  browser: await send('Browser.getVersion'),
  matrixCount: checks.length,
  checks,
  layoutFailures,
  interactions,
  contrasts,
  renderedButtonContrasts,
  exceptions,
  consoleErrors,
  networkFailures: failures,
  externalRequests,
  screenshots,
};
writeFileSync(new URL('browser-results.json', out), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      matrix: checks.length,
      layoutFailures,
      interactions,
      contrastFailures: [...contrasts, ...renderedButtonContrasts].filter((c) => !c.pass),
      exceptions: exceptions.length,
      consoleErrors: consoleErrors.length,
      networkFailures: failures.length,
      externalRequests,
      screenshots: screenshots.length,
    },
    null,
    2,
  ),
);
ws.close();
if (
  layoutFailures.length ||
  Object.values(interactions).some((v) => !v) ||
  [...contrasts, ...renderedButtonContrasts].some((c) => !c.pass) ||
  exceptions.length ||
  consoleErrors.length ||
  failures.length ||
  externalRequests.length
)
  process.exitCode = 1;
