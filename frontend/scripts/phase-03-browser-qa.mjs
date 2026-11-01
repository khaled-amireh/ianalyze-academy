// Connects only to the dedicated headless test browser on port 9237.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:4177';
const targets = await (await fetch('http://127.0.0.1:9237/json/list')).json();
assert.equal(targets.filter((t) => t.type === 'page').length, 1);
const socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const exceptions = [],
  backendRequests = [],
  localErrors = [],
  checks = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    if (!details.url || details.url.startsWith(origin)) exceptions.push(details.text);
  } else if (message.method === 'Network.requestWillBeSent') {
    const url = new URL(message.params.request.url);
    if (
      url.hostname.endsWith('.supabase.co') ||
      (url.hostname === '127.0.0.1' && url.port === '54321')
    )
      backendRequests.push(url.origin + url.pathname);
  } else if (message.method === 'Network.responseReceived') {
    const response = message.params.response;
    if (response.url.startsWith(origin) && response.status >= 400)
      localErrors.push({ path: new URL(response.url).pathname, status: response.status });
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser command timed out: ${method}`));
    }, 15000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function load(path) {
  await send('Page.navigate', { url: origin + path });
  for (let attempt = 0; attempt < 100; attempt++) {
    await pause(30);
    if (
      await evaluate(
        `location.pathname===${JSON.stringify(path)} && Boolean(document.querySelector('h1'))`,
      )
    ) {
      await evaluate('document.fonts.ready.then(()=>true)');
      return;
    }
  }
  throw new Error(`Route did not render: ${path}`);
}
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.clearBrowserCache');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await load('/');
  for (const locale of ['ar', 'en'])
    for (const theme of ['light', 'dark'])
      for (const width of [390, 1440]) {
        await evaluate(
          `localStorage.setItem('ianalyze.language',${JSON.stringify(locale)});localStorage.setItem('ianalyze.theme',${JSON.stringify(theme)})`,
        );
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: false,
        });
        for (const path of [
          '/',
          '/about',
          '/eda',
          '/videos',
          '/team',
          '/join',
          '/leaderboard',
          '/contact',
        ]) {
          await load(path);
          const result = await evaluate(
            `({lang:document.documentElement.lang,dir:document.documentElement.dir,theme:document.documentElement.dataset.theme,title:document.querySelector('h1').textContent,overflow:document.documentElement.scrollWidth>innerWidth+2})`,
          );
          assert.equal(result.lang, locale);
          assert.equal(result.dir, locale === 'ar' ? 'rtl' : 'ltr');
          assert.equal(result.theme, theme);
          assert.equal(result.overflow, false);
          assert.ok(result.title.trim());
          if (path === '/join')
            assert.equal(await evaluate("document.querySelector('fieldset').disabled"), true);
          if (path === '/videos')
            assert.equal(
              await evaluate("document.querySelector('.video-frame iframe').src"),
              'https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/preview',
            );
          if (path === '/team') {
            await evaluate(
              "document.querySelector('.leaders-grid').scrollIntoView(); Promise.all([...document.querySelectorAll('.leader-card img')].map(img=>{img.loading='eager';return img.decode()}))",
            );
            assert.deepEqual(
              await evaluate(
                "[...document.querySelectorAll('.leader-card img')].map(img=>[img.naturalWidth,img.naturalHeight])",
              ),
              [
                [1024, 1106],
                [1385, 1385],
              ],
            );
          }
          checks.push({ path, locale, theme, width });
        }
        console.log(`Public routes passed: ${locale}/${theme}/${width}`);
      }
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
  // Unchanged Phase 02 HTML has no favicon; Chrome may automatically request one.
  const baselineWarnings = localErrors.filter(
    (error) => error.path === '/favicon.ico' && error.status === 404,
  );
  const unexpectedErrors = localErrors.filter((error) => !baselineWarnings.includes(error));
  writeFileSync(
    new URL('../artifacts/phase-03-browser.json', import.meta.url),
    JSON.stringify(
      { checks, exceptions, unexpectedErrors, baselineWarnings, backendRequests },
      null,
      2,
    ),
  );
  assert.deepEqual(exceptions, []);
  assert.deepEqual(unexpectedErrors, []);
  assert.deepEqual(backendRequests, []);
  console.log(
    `${checks.length} production route combinations passed; no configured-backend requests or application exceptions.`,
  );
} finally {
  socket.close();
}
