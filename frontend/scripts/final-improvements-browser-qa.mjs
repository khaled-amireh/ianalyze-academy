// Local UI fixture only. PostgreSQL/RLS and SDK session tests run separately.
// Start Vite on 5187 with LOCAL fixture configuration documented in final-improvements.md.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const origin = 'http://127.0.0.1:5187',
  api = 'http://127.0.0.1:54321';
const out = new URL('../artifacts/final-improvements/', import.meta.url);
mkdirSync(out, { recursive: true });
const chrome = spawn(
  process.env.ACADEMY_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=9237',
    `--user-data-dir=${fileURLToPath(new URL('browser-fixture/', out))}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, inspectPage;
const cases = [],
  errors = [],
  requests = [],
  pending = new Map();
let seq = 0;
try {
  let tabs;
  for (let n = 0; n < 80; n++) {
    try {
      tabs = await (await fetch('http://127.0.0.1:9237/json/list')).json();
      break;
    } catch {
      await pause(100);
    }
  }
  assert.ok(tabs, 'Dedicated headless Chrome unavailable');
  assert.equal(tabs.filter((t) => t.type === 'page').length, 1, 'Dedicated browser required');
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(`Browser timeout: ${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  const uid = '00000000-0000-4000-8000-000000000091';
  const user = {
    id: uid,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'fixture@example.test',
    email_confirmed_at: '2026-11-04T09:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-11-04T09:00:00Z',
  };
  let profile = {
    id: uid,
    email: user.email,
    full_name: 'Fixture Student',
    whatsapp: '+962790000001',
    major: 'Historical AI major',
    university: null,
    university_id: null,
    academic_year: 4,
    python_experience: 'basic',
    locale: 'en',
    registered_at: null,
    consent_at: null,
    consent_version: null,
    created_at: user.created_at,
    updated_at: user.created_at,
  };
  let items = [];
  const token = () => ({
    access_token: 'fixture-access-token',
    refresh_token: 'fixture-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  });
  async function intercept(p) {
    const url = new URL(p.request.url),
      headers = p.request.headers,
      body = p.request.postData ? JSON.parse(p.request.postData) : {};
    requests.push({ path: url.pathname, method: p.request.method });
    let data = null,
      status = 200;
    if (p.request.method === 'OPTIONS') status = 204;
    else if (url.pathname === '/auth/v1/token') data = token();
    else if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname === '/auth/v1/logout') status = 204;
    else if (url.pathname === '/rest/v1/rpc/current_academy_role') data = 'student';
    else if (url.pathname === '/rest/v1/rpc/academy_capabilities')
      data = { submissions: false, leaderboard: false };
    else if (url.pathname === '/rest/v1/rpc/academy_notifications') data = items;
    else if (url.pathname === '/rest/v1/rpc/read_notification') {
      items = items.map((x) =>
        !body.p_event_key || x.event_key === body.p_event_key
          ? { ...x, read_at: new Date().toISOString() }
          : x,
      );
    } else if (url.pathname === '/rest/v1/rpc/complete_registration') {
      profile = {
        ...profile,
        registered_at: new Date().toISOString(),
        consent_at: new Date().toISOString(),
        consent_version: 'registration-v1',
      };
    } else if (url.pathname === '/rest/v1/profiles') {
      if (p.request.method === 'PATCH') profile = { ...profile, ...body };
      data = Object.values(headers).includes('application/vnd.pgrst.object+json')
        ? profile
        : [profile];
    } else if (url.pathname.startsWith('/rest/v1/')) data = [];
    else throw Error(`Unexpected fixture route ${url.pathname}`);
    await send('Fetch.fulfillRequest', {
      requestId: p.requestId,
      responseCode: status,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Headers', value: '*' },
        { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
        { name: 'Access-Control-Expose-Headers', value: 'Content-Range' },
        { name: 'Content-Range', value: url.pathname === '/rest/v1/profiles' ? '0-0/1' : '*/0' },
      ],
      body: Buffer.from(status === 204 ? '' : JSON.stringify(data)).toString('base64'),
    });
  }
  ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(m.id);
        if (m.error) p.reject(Error(m.error.message));
        else p.resolve(m.result);
      }
    } else if (m.method === 'Fetch.requestPaused') {
      void intercept(m.params).catch((e) => errors.push(e.message));
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.text);
    }
  });
  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  inspectPage = evaluate;
  async function wait(expression, label) {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      await pause(40);
    }
    throw Error(`UI did not settle: ${label}`);
  }
  async function load(path) {
    await send('Page.navigate', { url: origin + path });
    await wait("document.readyState==='complete'&&!!document.querySelector('#page-title')", path);
    await evaluate('document.fonts.ready.then(()=>true)');
  }
  async function set(selector, value) {
    await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
    );
  }
  async function click(selector) {
    const point = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...point,
      button: 'left',
      clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...point,
      button: 'left',
      clickCount: 1,
    });
  }
  async function overflow() {
    assert.ok(
      await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),
      'Horizontal page overflow',
    );
  }
  async function locale(lang, theme) {
    await evaluate(
      `localStorage.setItem('ianalyze.language',${JSON.stringify(lang)});localStorage.setItem('ianalyze.theme',${JSON.stringify(theme)})`,
    );
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: api + '/*' }] });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await load('/');
  await locale('en', 'light');
  await load('/login');
  assert.equal(await evaluate("document.querySelector('input[name=remember]').checked"), false);
  assert.ok(await evaluate('!!document.querySelector(\'header a[href="/join"]\')'));
  await set('[name=email]', user.email);
  await set('[name=password]', 'Fixture-password-123!');
  await click('form button[type=submit]');
  await wait(
    "location.pathname==='/student'&&!!document.querySelector('[name=full_name]')",
    'registration form',
  );
  await wait(
    "Array.from(document.querySelectorAll('header a')).some(a=>a.textContent==='Complete registration')",
    'incomplete navigation',
  );
  assert.ok(
    await evaluate(
      "sessionStorage.getItem('ianalyze.auth')!==null&&localStorage.getItem('ianalyze.auth')===null",
    ),
  );
  assert.ok(await evaluate('!!document.querySelector(\'.portal-check a[href="/privacy"]\')'));
  assert.equal(await evaluate("document.querySelector('[name=major]').value"), 'other');
  assert.equal(
    await evaluate("document.querySelector('[name=major_other]').value"),
    'Historical AI major',
  );
  await set('[name=university_choice]', 'Al-Zaytoonah University of Jordan');
  assert.ok(await evaluate("document.querySelector('[name=university_id]').required"));
  await set('[name=university_id]', '202311432');
  await set('[name=major]', 'Computer Science');
  await click('[name=consent]');
  await click('form button[type=submit]');
  await wait("!!document.querySelector('[data-student-dashboard]')", 'registered dashboard');
  await wait(
    "!document.querySelector('header a[href=\"/join\"]')&&!Array.from(document.querySelectorAll('header a')).some(a=>a.textContent==='Complete registration')",
    'completed navigation',
  );
  assert.ok(
    await evaluate(
      '!!document.querySelector(\'header a[href="/student"]\')&&!!document.querySelector(\'header button[aria-label="My profile"]\')',
    ),
  );
  cases.push(
    'Anonymous, incomplete and complete navigation; session-scoped login; registration; historical major preservation',
  );
  await click('header button[aria-label="My profile"]');
  await wait("!!document.querySelector('[role=menuitem]')", 'profile dropdown');
  assert.equal(await evaluate("document.querySelectorAll('[role=menuitem]').length"), 4);
  await evaluate(
    "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))",
  );
  await load('/profile/edit');
  await wait("!!document.querySelector('[name=full_name]')", 'edit profile');
  await set('[name=university_choice]', 'other');
  await set('[name=university]', 'Another University');
  assert.equal(await evaluate("document.querySelector('[name=university_id]').required"), false);
  await set('[name=university_id]', '');
  await set('[name=full_name]', 'Updated Fixture Student');
  await set('[name=major]', 'other');
  await set('[name=major_other]', 'Robotics');
  await click('form button[type=submit]');
  await wait(
    "!!document.querySelector('.portal-notice-success')||document.body.innerText.includes('Saved successfully')",
    'profile saved',
  );
  assert.equal(profile.full_name, 'Updated Fixture Student');
  assert.equal(profile.major, 'Robotics');
  assert.equal(profile.university, 'Another University');
  await load('/profile');
  await wait("document.body.innerText.includes('Updated Fixture Student')", 'profile persisted');
  assert.ok(await evaluate("document.body.innerText.includes('Robotics')"));
  cases.push(
    'Profile edit, university switch, optional ID, Other major and persisted profile view',
  );
  await load('/notifications');
  await wait(
    "document.body.innerText.includes('You have no notifications yet.')",
    'empty notifications',
  );
  items = [
    {
      event_key: 'announcement:fixture',
      title_ar: 'إعلان تجريبي',
      title_en: 'Fixture announcement',
      body_ar: 'نص الإعلان',
      body_en: 'Published fixture announcement',
      href: '/notifications',
      created_at: new Date().toISOString(),
      read_at: null,
    },
  ];
  await evaluate("window.dispatchEvent(new Event('academy-notifications-updated'))");
  await wait("!!document.querySelector('.notification-count')", 'unread bell');
  assert.equal(await evaluate("document.querySelector('.notification-count').textContent"), '1');
  await evaluate(
    "Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='Mark as read').click()",
  );
  await wait("!document.querySelector('.notification-count')", 'mark read');
  items = items.map((x) => ({ ...x, read_at: null }));
  await evaluate("window.dispatchEvent(new Event('academy-notifications-updated'))");
  await wait("!!document.querySelector('.notification-unread')", 'unread item');
  await evaluate(
    "Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='Mark all as read').click()",
  );
  await wait("!document.querySelector('.notification-unread')", 'mark all');
  cases.push('Notification empty state, unread bell, mark one and mark all persisted receipts');
  const logoChecks = [];
  for (const width of [1440, 390, 320])
    for (const lang of ['en', 'ar'])
      for (const theme of ['light', 'dark']) {
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 500,
        });
        await locale(lang, theme);
        await load('/team');
        await wait("document.querySelectorAll('.leader-card').length===3", 'three team cards');
        await overflow();
        assert.equal(await evaluate('document.documentElement.dir'), lang === 'ar' ? 'rtl' : 'ltr');
        const logos = await evaluate(
          `Array.from(document.querySelectorAll('.theme-logo')).map(e=>{const i=Array.from(e.querySelectorAll('img')).find(i=>getComputedStyle(i).opacity==='1');return {loaded:i.complete&&i.naturalWidth>0,background:getComputedStyle(e.parentElement).backgroundColor,width:Math.round(e.getBoundingClientRect().width)};})`,
        );
        assert.ok(
          logos.every((x) => x.loaded && x.background === 'rgba(0, 0, 0, 0)'),
          JSON.stringify(logos),
        );
        assert.equal(logos[0].width, width < 768 ? 158 : 180);
        logoChecks.push({ width, lang, theme, logos });
        assert.equal(await evaluate("document.querySelectorAll('.team-linkedin').length"), 3);
        assert.ok(await evaluate('!document.querySelector(\'a[href="/eda"]\')'));
        if (width === 390) {
          await load('/profile/edit');
          await wait("!!document.querySelector('[name=major]')", 'mobile edit');
          await overflow();
          await load('/notifications');
          await wait("!!document.querySelector('.notification-item')", 'localized notifications');
          await overflow();
        }
      }
  cases.push(
    '12 desktop/mobile Arabic/English light/dark team and logo checks; mobile profile and notification layouts',
  );
  for (const [width, lang, theme] of [
    [1440, 'en', 'light'],
    [1440, 'en', 'dark'],
    [390, 'ar', 'light'],
    [390, 'ar', 'dark'],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 500,
    });
    await locale(lang, theme);
    await load('/about');
    await overflow();
    const logos = await evaluate(
      "Array.from(document.querySelectorAll('.theme-logo')).map(e=>({loaded:Array.from(e.querySelectorAll('img')).filter(i=>getComputedStyle(i).opacity==='1').every(i=>i.complete&&i.naturalWidth>0),background:getComputedStyle(e.parentElement).backgroundColor}))",
    );
    assert.equal(logos.length, 3);
    assert.ok(logos.every((x) => x.loaded && x.background === 'rgba(0, 0, 0, 0)'));
    logoChecks.push({ width, lang, theme, about: true, logos });
    if ((width === 1440 && theme === 'dark') || (width === 390 && theme === 'light')) {
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      writeFileSync(
        new URL(`review-about-${width}-${theme}.png`, out),
        Buffer.from(shot.data, 'base64'),
      );
    }
  }
  await load('/eda');
  assert.ok(await evaluate("!document.querySelector('.syllabus-timeline')"));
  await load('/videos');
  assert.equal(
    await evaluate("document.querySelector('iframe').getAttribute('src')"),
    'https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/preview',
  );
  await load('/privacy');
  assert.ok(await evaluate("document.body.innerText.includes('Supabase')"));
  await load('/');
  assert.equal(
    await evaluate("document.querySelectorAll('.learning-preview,.curriculum-section').length"),
    0,
  );
  cases.push(
    'Direct syllabus route blocked, public previews removed, privacy route loads, Google Drive embed preserved',
  );
  await locale('en', 'light');
  await load('/profile');
  await click('header button[aria-label="My profile"]');
  await wait("!!document.querySelector('[role=menuitem]')", 'logout menu');
  await evaluate(
    "Array.from(document.querySelectorAll('[role=menuitem]')).find(e=>e.textContent==='Log out').click()",
  );
  await wait("location.pathname==='/login'", 'logout');
  await wait("sessionStorage.getItem('ianalyze.auth')===null", 'logout storage cleared');
  await set('[name=email]', user.email);
  await set('[name=password]', 'Fixture-password-123!');
  await click('[name=remember]');
  await click('form button[type=submit]');
  await wait("location.pathname==='/student'", 'persistent login');
  assert.ok(
    await evaluate(
      "localStorage.getItem('ianalyze.auth')!==null&&sessionStorage.getItem('ianalyze.auth')===null",
    ),
  );
  cases.push('Logout clears session credentials; checked Remember Me uses persistent storage');
  assert.deepEqual(errors, [], 'Browser exceptions/fixture errors');
  writeFileSync(
    new URL('browser-results.json', out),
    JSON.stringify(
      { passed: true, fixtureOnly: true, cases, logoChecks, exceptions: errors },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      passed: true,
      fixtureOnly: true,
      cases: cases.length,
      logoChecks: logoChecks.length,
      exceptions: errors.length,
    }),
  );
} catch (e) {
  let page;
  try {
    page = await inspectPage('({url:location.href,text:document.body.innerText.slice(0,5000)})');
  } catch {
    // The browser may have exited before diagnostics can be read.
  }
  writeFileSync(
    new URL('browser-results.json', out),
    JSON.stringify(
      { passed: false, cases, error: e.message, exceptions: errors, requests, page },
      null,
      2,
    ) + '\n',
  );
  throw e;
} finally {
  ws?.close();
  chrome.kill();
}
