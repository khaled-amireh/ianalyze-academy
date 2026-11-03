/* Focused theme/logo checks against the task-owned Chrome profile. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = process.env.ACADEMY_BROWSER_ORIGIN ?? 'http://127.0.0.1:4174';
const debuggerOrigin = process.env.ACADEMY_BROWSER_DEBUGGER ?? 'http://127.0.0.1:9225';
const out = new URL(
  process.env.ACADEMY_BROWSER_OUTPUT ?? '../../docs/ui-redesign/',
  import.meta.url,
);
mkdirSync(out, { recursive: true });
const tabs = await (await fetch(`${debuggerOrigin}/json/list`)).json();
assert.equal(tabs.filter((tab) => tab.type === 'page').length, 1);
const ws = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown')
    errors.push(message.params.exceptionDetails);
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(expression, sessionId) {
  const result = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression) {
  for (let count = 0; count < 100; count++) {
    if (await evaluate(expression)) return true;
    await pause(30);
  }
  return false;
}
async function load(path = '/') {
  await send('Page.navigate', { url: `${origin}${path}` });
  assert.ok(await waitFor("!!document.querySelector('h1')"));
}
async function media(scheme, motion = 'reduce') {
  await send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: scheme },
      { name: 'prefers-reduced-motion', value: motion },
    ],
  });
}
let secondaryTarget;
const checks = {};
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await media('light');
  await load();
  await evaluate('localStorage.clear()');
  await load();
  checks.lightSystemDefault = await waitFor("document.documentElement.dataset.theme==='light'");
  await evaluate('window.scrollTo(0,document.body.scrollHeight)');
  checks.allLogoVariantsLoaded = await waitFor(
    "[...document.querySelectorAll('.theme-logo img')].length===4&&[...document.querySelectorAll('.theme-logo img')].every(img=>img.complete&&img.naturalWidth>0)",
  );
  checks.lightLogos = await evaluate(
    "[...document.querySelectorAll('.theme-logo-light')].every(img=>getComputedStyle(img).opacity==='1')&&[...document.querySelectorAll('.theme-logo-dark')].every(img=>getComputedStyle(img).opacity==='0')",
  );
  checks.noLogoTiles = await evaluate(
    "['.brand-logo','.parent-logo'].every(selector=>getComputedStyle(document.querySelector(selector)).backgroundColor==='rgba(0, 0, 0, 0)')",
  );
  const logoWidth = await evaluate(
    "document.querySelector('.brand-logo').getBoundingClientRect().width",
  );
  await media('dark');
  checks.liveSystemSwitch = await waitFor("document.documentElement.dataset.theme==='dark'");
  checks.darkLogos = await evaluate(
    "[...document.querySelectorAll('.theme-logo-dark')].every(img=>getComputedStyle(img).opacity==='1')&&[...document.querySelectorAll('.theme-logo-light')].every(img=>getComputedStyle(img).opacity==='0')",
  );
  checks.logoSizeStable = await evaluate(
    `document.querySelector('.brand-logo').getBoundingClientRect().width===${logoWidth}`,
  );
  await media('dark', 'no-preference');
  await evaluate("document.querySelector('.header-preferences .theme-toggle').click()");
  checks.manualTransitionStarts = await evaluate(
    "document.documentElement.classList.contains('theme-changing')",
  );
  checks.manualTransitionEnds = await waitFor(
    "!document.documentElement.classList.contains('theme-changing')",
  );
  checks.manualChoiceSaved = await evaluate(
    "localStorage.getItem('ianalyze.theme')==='light'&&document.documentElement.dataset.theme==='light'",
  );
  await media('light');
  await media('dark');
  checks.manualChoiceOverridesSystemChanges = await evaluate(
    "document.documentElement.dataset.theme==='light'",
  );
  await evaluate("document.querySelector('.header-preferences .theme-toggle').click()");
  checks.reducedMotionImmediate = await evaluate(
    "document.documentElement.dataset.theme==='dark'&&!document.documentElement.classList.contains('theme-changing')&&getComputedStyle(document.querySelector('.theme-logo-dark')).transitionDuration==='0s'",
  );
  for (let count = 0; count < 8; count++)
    await evaluate("document.querySelector('.header-preferences .theme-toggle').click()");
  checks.rapidSwitchesStayConsistent = await evaluate(
    "document.documentElement.dataset.theme==='dark'&&localStorage.getItem('ianalyze.theme')==='dark'&&document.querySelector('.header-preferences .theme-toggle').dataset.themeState==='dark'",
  );
  secondaryTarget = await send('Target.createTarget', { url: `${origin}/` });
  const attached = await send('Target.attachToTarget', {
    targetId: secondaryTarget.targetId,
    flatten: true,
  });
  for (let count = 0; count < 100; count++) {
    if (
      await evaluate(
        `location.origin===${JSON.stringify(origin)}&&!!document.querySelector('h1')`,
        attached.sessionId,
      )
    )
      break;
    await pause(30);
  }
  await evaluate("localStorage.setItem('ianalyze.theme','light')", attached.sessionId);
  checks.crossTabPreferenceSync = await waitFor(
    "document.documentElement.dataset.theme==='light'&&document.querySelector('.header-preferences .theme-toggle').dataset.themeState==='light'",
  );
  await send('Target.closeTarget', { targetId: secondaryTarget.targetId });
  secondaryTarget = undefined;
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await load();
  await evaluate("document.querySelector('.mobile-menu-trigger').click()");
  checks.mobileThemeControl = await waitFor(
    "!!document.querySelector('[role=dialog] .theme-toggle')",
  );
  await evaluate("document.querySelector('[role=dialog] .theme-toggle').click()");
  checks.mobileSwitchAndLogos = await evaluate(
    "document.documentElement.dataset.theme==='dark'&&document.querySelector('[role=dialog] .theme-toggle').dataset.themeState==='dark'&&getComputedStyle(document.querySelector('.brand-logo .theme-logo-dark')).opacity==='1'",
  );
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  assert.ok(await waitFor("!document.querySelector('[role=dialog]')"));
  checks.mobileQuickSwitchAndLayout = true;
  for (const width of [320, 390, 640]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const theme of ['light', 'dark']) {
      if (await evaluate(`document.documentElement.dataset.theme!==${JSON.stringify(theme)}`))
        await evaluate("document.querySelector('.header-preferences .theme-toggle').click()");
      checks.mobileQuickSwitchAndLayout &&= await evaluate(
        "(()=>{const button=document.querySelector('.header-preferences .theme-toggle');const r=button.getBoundingClientRect();const n=document.querySelector('.navbar-inner').getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=n.left&&r.right<=n.right&&document.documentElement.scrollWidth<=innerWidth})()",
      );
    }
  }
  assert.deepEqual(errors, []);
  assert.ok(Object.values(checks).every(Boolean), JSON.stringify(checks));
} finally {
  if (secondaryTarget) await send('Target.closeTarget', { targetId: secondaryTarget.targetId });
  writeFileSync(
    new URL('theme-brand-results.json', out),
    JSON.stringify(
      {
        date: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Amman',
          dateStyle: 'short',
        }).format(new Date()),
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  ws.close();
}
console.log(JSON.stringify(checks, null, 2));
