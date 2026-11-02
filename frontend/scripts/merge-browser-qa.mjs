// UI integration checks only. The optional configured origin uses a fake local key,
// no session and no backend. This harness does not establish real Auth/RLS behavior.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const debuggerOrigin = process.env.ACADEMY_BROWSER_DEBUGGER ?? 'http://127.0.0.1:9225';
const publicOrigin = process.env.ACADEMY_BROWSER_ORIGIN ?? 'http://127.0.0.1:4174';
const configuredOrigin = process.env.ACADEMY_CONFIGURED_BROWSER_ORIGIN;
const out = new URL('../artifacts/merge-validation/', import.meta.url);
mkdirSync(out, { recursive: true });
const tabs = await (await fetch(`${debuggerOrigin}/json/list`)).json();
const pages = tabs.filter((tab) => tab.type === 'page');
assert.equal(pages.length, 1, 'Use an isolated, task-owned Chrome profile');
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const exceptions = [];
const cases = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(message.error);
    else entry.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown')
    exceptions.push(message.params.exceptionDetails);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser timeout: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Browser state not reached: ${expression}`);
}
async function load(origin, path, expected = path.split('?')[0]) {
  await send('Page.navigate', { url: origin + path });
  await waitFor(
    `location.pathname===${JSON.stringify(expected)}&&!!document.querySelector('#page-title')`,
  );
  await evaluate('document.fonts.ready');
}
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*drive.google.com*'] });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  for (const route of ['/student', '/workspace']) {
    await load(publicOrigin, route, '/login');
    assert.equal(await evaluate('document.querySelectorAll("input[name=password]").length'), 0);
    cases.push({ route, check: 'Unconfigured protected route redirects; login stays closed' });
  }
  await load(publicOrigin, '/auth/callback?error=access_denied', '/auth/callback');
  await waitFor('location.search===""');
  assert.ok(await evaluate(`!!document.querySelector('a[href="/login"]')`));
  cases.push({ route: '/auth/callback', check: 'Failed callback scrubs URL and permits retry' });
  if (configuredOrigin) {
    for (const locale of ['ar', 'en']) {
      for (const theme of ['light', 'dark']) {
        for (const width of [320, 390, 768, 1120, 1440]) {
          await send('Emulation.setDeviceMetricsOverride', {
            width,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false,
          });
          await load(configuredOrigin, '/about');
          await evaluate(
            `localStorage.clear();localStorage.setItem('ianalyze.language',${JSON.stringify(locale)});localStorage.setItem('ianalyze.theme',${JSON.stringify(theme)})`,
          );
          await load(configuredOrigin, '/about');
          await waitFor(`document.documentElement.lang===${JSON.stringify(locale)}`);
          assert.equal(await evaluate('!!document.querySelector(".utility-bar")'), false);
          assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
          assert.equal(
            await evaluate('document.documentElement.dir'),
            locale === 'ar' ? 'rtl' : 'ltr',
          );
          assert.equal(await evaluate('document.documentElement.dataset.theme'), theme);
          if (width < 1120) {
            await evaluate('document.querySelector(".mobile-menu-trigger").click()');
            await waitFor('!!document.querySelector("[role=dialog]")');
          }
          const selector = width < 1120 ? '.mobile-dialog a[href="/login"]' : '.header-account';
          assert.equal(
            await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`),
            1,
          );
          if (width === 390 || width === 1440) {
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            writeFileSync(
              new URL(`account-${locale}-${theme}-${width}.png`, out),
              Buffer.from(shot.data, 'base64'),
            );
          }
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
          await waitFor('location.pathname==="/login"&&!document.querySelector("[role=dialog]")');
          await waitFor('document.activeElement.id==="page-title"');
          assert.equal(
            await evaluate('document.title.startsWith(document.querySelector("h1").textContent)'),
            true,
          );
          assert.equal(
            await evaluate('document.querySelectorAll("input[name=password]").length'),
            1,
          );
          assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
          cases.push({
            locale,
            theme,
            width,
            check: 'Signed-out account navigation, menu closure, focus and title',
          });
        }
      }
    }
  }
  assert.deepEqual(exceptions, []);
  console.log(
    `Merge browser checks passed: ${cases.length} cases; configured signed-out UI only, no real backend.`,
  );
} finally {
  writeFileSync(
    new URL('navigation-results.json', out),
    JSON.stringify({ cases, exceptions, realBackendTested: false }, null, 2) + '\n',
  );
  ws.close();
}
