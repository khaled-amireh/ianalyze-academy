// Isolated browser fixtures: all API traffic is intercepted; no production accounts or data.
// Run Vite on 5191 with the local fixture configuration documented in docs/student-registration/report.md.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const origin = 'http://127.0.0.1:5191',
  api = 'http://127.0.0.1:54321';
const out = new URL('../artifacts/student-registration/', import.meta.url);
mkdirSync(out, { recursive: true });
const chrome = spawn(
  process.env.ACADEMY_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=9248',
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
      tabs = await (await fetch('http://127.0.0.1:9248/json/list')).json();
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
  let role = 'student';
  let failPatch = null;
  let failSignup = false;
  const patches = [];
  const originalProfile = { ...profile };
  const token = () => ({
    access_token: 'fixture-access-token',
    refresh_token: 'fixture-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  });
  async function intercept(p) {
    const url = new URL(p.request.url);
    if (url.origin === origin) {
      await send('Fetch.continueRequest', { requestId: p.requestId });
      return;
    }
    if (url.origin !== api) {
      errors.push('Blocked unexpected network origin: ' + url.origin);
      await send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
      return;
    }
    const headers = p.request.headers,
      body = p.request.postData ? JSON.parse(p.request.postData) : {};
    requests.push({ path: url.pathname, method: p.request.method });
    let data = null,
      status = 200;
    if (p.request.method === 'OPTIONS') status = 204;
    else if (url.pathname === '/auth/v1/signup') {
      if (failSignup) {
        status = 400;
        data = { code: 'email_address_invalid', message: 'Signup rejected' };
        failSignup = false;
      } else data = { user: { ...user, email: body.email }, session: null };
    } else if (url.pathname === '/auth/v1/token') data = token();
    else if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname === '/auth/v1/logout') status = 204;
    else if (url.pathname === '/rest/v1/rpc/current_academy_role') data = role;
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
      if (p.request.method === 'PATCH') {
        patches.push(body);
        if (!Object.keys(body).length) {
          status = 406;
          data = { code: 'PGRST116', message: 'The result contains 0 rows' };
        } else if (failPatch) {
          status = failPatch.code === '42501' ? 403 : 400;
          data = failPatch;
          failPatch = null;
        } else profile = { ...profile, ...body };
      }
      if (!data)
        data = Object.values(headers).includes('application/vnd.pgrst.object+json')
          ? profile
          : [profile];
    } else if (url.pathname === '/storage/v1/object/list/team-materials') data = [];
    else if (url.pathname.startsWith('/rest/v1/')) data = [];
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
  function receive({ data }) {
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
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
  }
  ws.addEventListener('message', receive);
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

  async function reopenedTab() {
    const previous = new URL(ws.url).pathname.split('/').at(-1);
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    ws.close();
    await fetch('http://127.0.0.1:9248/json/close/' + previous);
    const pages = await (await fetch('http://127.0.0.1:9248/json/list')).json();
    ws = new WebSocket(pages.find((page) => page.id === targetId).webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    ws.addEventListener('message', receive);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] });
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }
  async function switchTabs() {
    const previous = new URL(ws.url).pathname.split('/').at(-1);
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    await send('Target.activateTarget', { targetId });
    await send('Target.activateTarget', { targetId: previous });
    await send('Target.closeTarget', { targetId });
  }
  async function shot(name) {
    const image = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(new URL(name + '.png', out), Buffer.from(image.data, 'base64'));
  }
  async function button(text) {
    const selector = await evaluate(
      `(()=>{const b=[...document.querySelectorAll('.portal-page button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Button missing: '+${JSON.stringify(text)});b.dataset.qaButton='target';return '[data-qa-button="target"]';})()`,
    );
    await click(selector);
    await evaluate("document.querySelector('[data-qa-button]')?.removeAttribute('data-qa-button')");
  }
  async function submitProfile() {
    await click('.portal-page form button[type=submit]');
  }
  async function readyProfile() {
    await wait(
      "!!document.querySelector('.profile-details')&&!document.querySelector('[name=full_name]')",
      'read-only saved profile',
    );
  }
  async function login() {
    await load('/login');
    await set('[name=email]', user.email);
    await set('[name=password]', 'Fixture-password-123!');
    await click('form button[type=submit]');
    await wait(
      "location.pathname==='/student'||location.pathname==='/workspace'",
      'authenticated dashboard',
    );
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await load('/');
  await locale('en', 'light');
  await load('/login');
  assert.ok(await evaluate(`!!document.querySelector('header a[href="/login"]')`));
  const accountDraftKey = 'ianalyze.registration-draft.v1.account';
  const profileDraftKey = 'ianalyze.registration-draft.v1.profile.' + uid;
  await evaluate(
    "Object.keys(localStorage).filter(key=>key.startsWith('ianalyze.registration-draft.')).forEach(key=>localStorage.removeItem(key))",
  );
  await load('/join');
  await set('[name=email]', 'draft@example.test');
  await set('[name=password]', 'Draft-Password-123!');
  await set('[name=confirmation]', 'Draft-Password-123!');
  assert.deepEqual(
    await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(accountDraftKey)})).fields`),
    { email: 'draft@example.test' },
  );
  assert.ok(
    await evaluate(
      "![...Object.values(localStorage),...Object.values(sessionStorage)].join('').includes('Draft-Password-123!')",
    ),
  );
  await click('form .privacy-link');
  await wait("location.pathname==='/privacy'", 'internal privacy navigation');
  await load('/join');
  assert.equal(
    await evaluate("document.querySelector('[name=email]').value"),
    'draft@example.test',
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[name=password]').value+document.querySelector('[name=confirmation]').value",
    ),
    '',
  );
  assert.equal(await evaluate("document.querySelector('[name=consent]').checked"), false);
  cases.push(
    'Account draft: typing autosaves only email; internal navigation restores it with empty passwords and unchecked consent',
  );
  await send('Page.reload');
  await wait("!!document.querySelector('[name=email]')", 'account refresh');
  assert.equal(
    await evaluate("document.querySelector('[name=email]').value"),
    'draft@example.test',
  );
  await switchTabs();
  assert.equal(
    await evaluate("document.querySelector('[name=email]').value"),
    'draft@example.test',
  );
  await reopenedTab();
  await load('/join');
  assert.equal(
    await evaluate("document.querySelector('[name=email]').value"),
    'draft@example.test',
  );
  assert.equal(await evaluate("document.querySelector('[name=password]').value"), '');
  cases.push(
    'Account draft survives refresh, switching browser tabs, and closing/reopening the actual browser tab',
  );
  await set('[name=password]', 'Draft-Password-123!');
  await set('[name=confirmation]', 'Draft-Password-123!');
  await evaluate("document.querySelector('[name=consent]').click()");
  failSignup = true;
  await click('form button[type=submit]');
  await wait("!!document.querySelector('.portal-page [role=alert]')", 'failed account creation');
  assert.ok(await evaluate(`!!localStorage.getItem(${JSON.stringify(accountDraftKey)})`));
  await click('form button[type=submit]');
  await wait("!document.querySelector('[name=password]')", 'successful account creation');
  assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(accountDraftKey)})`), null);
  await load('/join');
  assert.equal(await evaluate("document.querySelector('[name=email]').value"), '');
  cases.push(
    'Failed signup keeps the draft; successful signup clears it and cannot restore the completed account draft',
  );
  for (const lang of ['en', 'ar'])
    for (const width of [390, 1440]) {
      await locale(lang, 'light');
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await load('/join');
      await set('[name=email]', 'localized@example.test');
      await load('/about');
      await load('/join');
      assert.equal(
        await evaluate("document.querySelector('[name=email]').value"),
        'localized@example.test',
      );
      assert.equal(await evaluate('document.documentElement.lang'), lang);
      await overflow();
      const clearText =
        lang === 'ar'
          ? '\u0645\u0633\u062d \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u062d\u0641\u0648\u0638\u0629'
          : 'Clear saved information';
      await button(clearText);
      assert.equal(
        await evaluate(`localStorage.getItem(${JSON.stringify(accountDraftKey)})`),
        null,
      );
      assert.equal(await evaluate("document.querySelector('[name=email]').value"), '');
      cases.push(`Account draft restore and accessible manual clearing: ${lang}, ${width}px`);
    }
  await locale('en', 'light');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const damaged of [
    '{',
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      version: 1,
      scope: accountDraftKey,
      savedAt: 1,
      expiresAt: 86400001,
      fields: { email: 'expired@example.test' },
    }),
  ]) {
    await evaluate(
      `localStorage.setItem(${JSON.stringify(accountDraftKey)},${JSON.stringify(damaged)})`,
    );
    await load('/join');
    assert.equal(await evaluate("document.querySelector('[name=email]').value"), '');
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(accountDraftKey)})`), null);
  }
  cases.push(
    'Corrupted, incompatible and expired browser drafts are discarded safely without filling registration',
  );
  await login();
  await wait("!!document.querySelector('[name=full_name]')", 'profile completion');
  const beforeDraftRequests = requests.filter((request) => request.method === 'PATCH').length;
  await set('[name=major]', 'Computer Science');
  await set('[name=major]', 'other');
  for (const [name, value] of Object.entries({
    full_name: 'Draft Student',
    whatsapp: '0790000002',
    major_other: 'Draft Major',
    academic_year: '3',
    python_experience: 'experienced',
    university_id: 'invalid@example.test',
    locale: 'ar',
  }))
    await set('[name=' + name + ']', value);
  await set('[name=locale]', 'en');
  assert.equal(
    requests.filter((request) => request.method === 'PATCH').length,
    beforeDraftRequests,
  );
  const savedFields = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(profileDraftKey)})).fields`,
  );
  await load('/about');
  await load('/student');
  await wait("!!document.querySelector('[name=full_name]')", 'restore profile draft');
  for (const [name, value] of Object.entries(savedFields))
    assert.equal(
      await evaluate(`document.querySelector('[name='+${JSON.stringify(name)}+']').value`),
      value,
    );
  await send('Page.reload');
  await wait("!!document.querySelector('[name=full_name]')", 'profile refresh');
  assert.equal(await evaluate("document.querySelector('[name=full_name]').value"), 'Draft Student');
  await switchTabs();
  await wait(
    "!!document.querySelector('[name=full_name]')",
    'profile after tab visibility revalidation',
  );
  assert.equal(await evaluate("document.querySelector('[name=full_name]').value"), 'Draft Student');
  await reopenedTab();
  await login();
  await wait(
    "!!document.querySelector('[name=full_name]')",
    'profile draft after tab reopen and same-user login',
  );
  assert.equal(await evaluate("document.querySelector('[name=full_name]').value"), 'Draft Student');
  assert.equal(
    await evaluate("document.querySelector('[name=university_id]').value"),
    'invalid@example.test',
  );
  await click('[name=university_id]');
  assert.ok(await evaluate("!!document.querySelector('[role=tooltip]')"));
  await click('.portal-page form button[type=submit]');
  await wait(
    "document.querySelector('[name=university_id]').getAttribute('aria-invalid')==='true'",
    'restored ID still validated',
  );
  assert.equal(
    requests.filter((request) => request.method === 'PATCH').length,
    beforeDraftRequests,
  );
  cases.push(
    'Profile draft restores non-secret fields across navigation, refresh, tab switching and tab reopening with same-user login; typing sends no PATCH; restored ID validation/help still work',
  );
  for (const lang of ['en', 'ar'])
    for (const width of [390, 1440]) {
      await locale(lang, 'dark');
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await load('/student');
      await wait(
        "!!document.querySelector('[name=university_id]')",
        'localized restored profile draft',
      );
      assert.equal(
        await evaluate("document.querySelector('[name=full_name]').value"),
        'Draft Student',
      );
      assert.equal(await evaluate("document.querySelector('[name=major]').value"), 'other');
      assert.equal(
        await evaluate("document.querySelector('[name=major_other]').value"),
        'Draft Major',
      );
      assert.equal(await evaluate('document.documentElement.lang'), lang);
      assert.equal(
        await evaluate("document.querySelector('.portal-page').dir"),
        lang === 'ar' ? 'rtl' : 'ltr',
      );
      await click('[name=university_id]');
      assert.equal(
        await evaluate("document.querySelector('[role=tooltip]').dir"),
        lang === 'ar' ? 'rtl' : 'ltr',
      );
      await overflow();
      cases.push(`Profile draft restoration and ID help: ${lang}, ${width}px`);
    }
  await locale('en', 'light');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await load('/student');
  await wait(
    "!!document.querySelector('[name=university_id]')",
    'restored profile before failed submission',
  );
  await set('[name=university_id]', '202311432');
  await evaluate("document.querySelector('[name=consent]').click()");
  failPatch = { code: '42501', message: 'Update denied' };
  await click('.portal-page form button[type=submit]');
  await wait(
    "!!document.querySelector('.portal-page [role=alert]')&&!document.querySelector('.portal-page fieldset').disabled",
    'failed completion',
  );
  assert.ok(await evaluate(`!!localStorage.getItem(${JSON.stringify(profileDraftKey)})`));
  await button('Clear saved information');
  assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(profileDraftKey)})`), null);
  assert.equal(
    await evaluate("document.querySelector('[name=full_name]').value"),
    'Fixture Student',
  );
  assert.equal(await evaluate("document.querySelector('[name=consent]').checked"), false);
  cases.push(
    'Failed profile completion retains draft; manual clear removes local information, resets to saved profile values and requires fresh consent',
  );

  assert.equal(
    await evaluate(
      "document.querySelector('[name=university_choice], select[name=university], input[name=university]')",
    ),
    null,
  );
  assert.equal(
    await evaluate("document.querySelector('[name=university_id]').labels[0].textContent.trim()"),
    'University ID *',
  );
  assert.equal(await evaluate("document.querySelector('[name=university_id]').required"), true);
  assert.equal(await evaluate(`!!document.querySelector('header a[href="/login"]')`), false);
  await evaluate("document.querySelector('[name=consent]').click()");
  const beforeInvalid = patches.length;
  await submitProfile();
  await wait(
    "document.querySelector('[name=university_id]').getAttribute('aria-invalid')==='true'",
    'required university ID error',
  );
  assert.equal(patches.length, beforeInvalid);
  assert.equal(await evaluate('document.activeElement.name'), 'university_id');
  assert.equal(
    await evaluate("document.querySelector('.university-id-hint').textContent.trim()"),
    'Enter your official Al-Zaytoonah University student ID number, as shown on your university ID card. Do not enter your email address.',
  );
  assert.ok(
    await evaluate(
      "document.querySelector('[name=university_id]').getAttribute('aria-describedby').split(' ').every(id=>!!document.getElementById(id))",
    ),
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
  assert.equal(await evaluate("!!document.querySelector('[role=tooltip]')"), false);
  await click('[name=university_id]');
  assert.ok(await evaluate("!!document.querySelector('[role=tooltip]')"));
  await set('[name=university_id]', 'student@example.test');
  await submitProfile();
  assert.equal(patches.length, beforeInvalid);
  assert.ok(await evaluate("document.querySelector('.field-error').textContent.includes('1–20')"));
  await set('[name=university_id]', ' 202311432 ');
  await submitProfile();
  await readyProfile();
  assert.equal(profile.university, 'Al-Zaytoonah University of Jordan');
  assert.equal(profile.university_id, '202311432');
  assert.ok(profile.registered_at);
  assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(profileDraftKey)})`), null);
  assert.ok(
    await evaluate("document.querySelector('.profile-details').textContent.includes('202311432')"),
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[data-student-dashboard]').textContent.includes('Weekly activities')",
    ),
    false,
  );
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('[data-student-dashboard] button')].some(b=>/refresh/i.test(b.textContent))",
    ),
    false,
  );
  assert.equal(
    requests.some((r) =>
      ['academy_weeks', 'activities', 'rubrics', 'submissions', 'grades'].some(
        (t) => r.path === '/rest/v1/' + t,
      ),
    ),
    false,
  );
  cases.push(
    'Registration: required ID, invalid email rejected, focus/error accessibility, popover click/Escape, trimmed ID saved/retrieved and university assigned',
  );
  const beforeNoop = structuredClone(profile);
  const beforeNoopPatchCount = patches.length;
  await button('Edit profile');
  await submitProfile();
  await readyProfile();
  assert.deepEqual(profile, beforeNoop);
  assert.equal(patches.length, beforeNoopPatchCount);
  assert.equal(await evaluate("!!document.querySelector('.portal-page [role=alert]')"), false);
  assert.ok(await evaluate("!!document.querySelector('.portal-page [role=status]')"));
  cases.push(
    'Unchanged Save: no PATCH, saved values preserved, success feedback and read-only profile restored',
  );
  await button('Edit profile');
  await set('[name=full_name]', '  Fixture Student  ');
  await set('[name=major_other]', '  Historical AI major  ');
  await set('[name=university_id]', ' 202311432 ');
  await set('[name=whatsapp]', '079 000 0001');
  await submitProfile();
  await readyProfile();
  assert.deepEqual(profile, beforeNoop);
  assert.equal(patches.length, beforeNoopPatchCount);
  assert.equal(await evaluate("!!document.querySelector('.portal-page [role=alert]')"), false);
  cases.push(
    'Normalized no-op Save: trimmed whitespace and equivalent phone format send no PATCH and exit editing',
  );
  await button('Edit profile');
  await set('[name=full_name]', 'Denied Update');
  failPatch = { code: '42501', message: 'Update denied' };
  await submitProfile();
  await wait(
    "!!document.querySelector('.portal-page [role=alert]')&&!document.querySelector('.portal-page fieldset').disabled",
    'real update failure feedback',
  );
  assert.equal(await evaluate("document.querySelector('[name=full_name]').value"), 'Denied Update');
  assert.deepEqual(profile, beforeNoop);
  assert.equal(patches.length, beforeNoopPatchCount + 1);
  await button('Cancel');
  await readyProfile();
  cases.push(
    'Real update failure: nonempty PATCH error stays visible, draft retained, saved data unchanged, Cancel exits',
  );
  await button('Edit profile');
  assert.equal(await evaluate("document.querySelector('[name=university_id]').value"), '202311432');
  await set('[name=full_name]', 'Unsaved Name');
  const beforeCancel = patches.length;
  await button('Cancel');
  await readyProfile();
  assert.equal(patches.length, beforeCancel);
  assert.equal(
    await evaluate(
      "document.querySelector('.profile-details').textContent.includes('Unsaved Name')",
    ),
    false,
  );
  await button('Edit profile');
  assert.equal(
    await evaluate("document.querySelector('[name=full_name]').value"),
    'Fixture Student',
  );
  await set('[name=full_name]', 'Saved Name');
  await set('[name=university_id]', '202311433');
  failPatch = {
    code: '23505',
    message: 'duplicate key violates unique constraint "profiles_zuj_university_id_unique"',
  };
  await submitProfile();
  await wait(
    "document.querySelector('[role=alert]')?.textContent.includes('already registered')",
    'duplicate ID feedback',
  );
  assert.ok(await evaluate("!!document.querySelector('[name=full_name]')"));
  assert.equal(profile.full_name, 'Fixture Student');
  await set('[name=university_id]', '202311434');
  await submitProfile();
  await readyProfile();
  assert.equal(profile.full_name, 'Saved Name');
  assert.ok(
    await evaluate(
      "document.querySelector('.profile-details').textContent.includes('Saved Name')&&document.querySelector('.profile-details').textContent.includes('202311434')",
    ),
  );
  assert.equal('university' in patches.at(-1), false);
  await load('/student');
  await readyProfile();
  assert.ok(
    await evaluate("document.querySelector('.profile-details').textContent.includes('Saved Name')"),
  );
  cases.push(
    'Student dashboard: read-only default, existing values, Cancel discards changes, duplicate errors preserve edits, successful Save exits edit mode, automatic refresh and reload persistence',
  );
  await load('/profile/edit');
  await wait("!!document.querySelector('[name=full_name]')", 'separate profile edit');
  await set('[name=full_name]', 'Profile Route Saved');
  await submitProfile();
  await wait(
    "location.pathname==='/profile'&&!!document.querySelector('.profile-details')",
    'return to profile',
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.profile-details').textContent.includes('Profile Route Saved')&&!!document.querySelector('[role=status]')",
    ),
  );
  await load('/profile/edit');
  await wait("!!document.querySelector('[name=full_name]')", 'profile route cancel');
  await set('[name=full_name]', 'Discard Route Change');
  await button('Cancel');
  await readyProfile();
  assert.equal(profile.full_name, 'Profile Route Saved');
  cases.push(
    'Separate Profile page: Save returns to read-only profile with feedback; Cancel discards edits',
  );
  const beforeRouteNoop = patches.length;
  await load('/profile/edit');
  await wait("!!document.querySelector('[name=full_name]')", 'profile route unchanged save');
  await submitProfile();
  await wait(
    "location.pathname==='/profile'&&!!document.querySelector('.profile-details')",
    'profile route no-op returns read-only',
  );
  assert.equal(patches.length, beforeRouteNoop);
  assert.equal(profile.full_name, 'Profile Route Saved');
  cases.push('Separate Profile page unchanged Save: no PATCH and read-only navigation succeeds');
  for (const lang of ['en', 'ar'])
    for (const theme of ['light', 'dark'])
      for (const width of [320, 390, 768, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 768,
        });
        await locale(lang, theme);
        await load('/student');
        await readyProfile();
        await overflow();
        assert.equal(
          await evaluate("document.querySelector('.portal-page').dir"),
          lang === 'ar' ? 'rtl' : 'ltr',
        );
        await shot(`profile-${lang}-${theme}-${width}`);
        await button(lang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit profile');
        await click('[name=university_id]');
        await overflow();
        assert.equal(
          await evaluate(
            "document.querySelector('[name=university_id]').labels[0].textContent.trim()",
          ),
          lang === 'ar' ? 'الرقم الجامعي *' : 'University ID *',
        );
        assert.equal(
          await evaluate("document.querySelector('[role=tooltip]').dir"),
          lang === 'ar' ? 'rtl' : 'ltr',
        );
        if (lang === 'ar')
          assert.equal(
            await evaluate("document.querySelector('[role=tooltip]').textContent.trim()"),
            'أدخل رقمك الجامعي الرسمي في جامعة الزيتونة الأردنية كما هو موجود على بطاقتك الجامعية، وليس بريدك الإلكتروني.',
          );
        await shot(`edit-${lang}-${theme}-${width}`);
        // Keyboard focus moves away naturally and dismisses the informational panel.
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
        assert.equal(await evaluate("!!document.querySelector('[role=tooltip]')"), false);
        await button(lang === 'ar' ? 'إلغاء' : 'Cancel');
        if (width === 390) {
          await click('.mobile-menu-trigger');
          assert.equal(
            await evaluate(`!!document.querySelector('.mobile-dialog a[href="/login"]')`),
            false,
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
        }
        cases.push(
          `Profile/edit layout: ${lang}, ${theme}, ${width}px, keyboard dismissal and no horizontal overflow`,
        );
        // Registration uses the same ID field, without exposing a university selector.
        const savedProfile = profile;
        profile = { ...originalProfile, locale: lang };
        await load('/student');
        await wait("!!document.querySelector('[name=university_id]')", 'translated registration');
        await click('[name=university_id]');
        await overflow();
        await shot(`registration-${lang}-${theme}-${width}`);
        assert.equal(
          await evaluate("!!document.querySelector('[name=university_choice], [name=university]')"),
          false,
        );
        assert.equal(
          await evaluate(
            "document.querySelector('[name=university_id]').labels[0].textContent.trim()",
          ),
          lang === 'ar' ? 'الرقم الجامعي *' : 'University ID *',
        );
        await submitProfile();
        await wait(
          "document.querySelector('[name=university_id]').getAttribute('aria-invalid')==='true'",
          'translated validation',
        );
        assert.ok(
          await evaluate("document.querySelector('.field-error').textContent.trim().length>0"),
        );
        profile = savedProfile;
      }
  await locale('en', 'light');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await load('/student');
  await readyProfile();
  await button('Log out');
  await wait(`!!document.querySelector('header a[href="/login"]')`, 'guest login restored');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await click('.mobile-menu-trigger');
  assert.ok(await evaluate(`!!document.querySelector('.mobile-dialog a[href="/login"]')`));
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
  cases.push(
    'Navigation: guest login desktop/mobile, no signed-in login desktop/mobile, logout restores guest login',
  );
  role = 'team';
  profile = {
    ...originalProfile,
    full_name: 'Historical Team',
    major: null,
    whatsapp: null,
    academic_year: null,
    python_experience: null,
  };
  await login();
  await wait(
    "location.pathname==='/workspace'&&!!document.querySelector('#page-title')",
    'team workspace',
  );
  assert.equal(
    await evaluate("document.querySelector('#page-title').textContent.trim()"),
    'Team workspace',
  );
  await load('/profile/edit');
  await wait("!!document.querySelector('[name=full_name]')", 'incomplete team profile edit');
  assert.equal(await evaluate("document.querySelector('[name=university_id]').required"), false);
  await set('[name=full_name]', 'Historical Team Updated');
  await submitProfile();
  await wait(
    "location.pathname==='/profile'&&!!document.querySelector('.profile-details')",
    'team saved profile',
  );
  assert.equal(profile.university, null);
  assert.equal(profile.university_id, null);
  assert.equal(profile.registered_at, null);
  assert.equal(profile.full_name, 'Historical Team Updated');
  assert.deepEqual(patches.at(-1), { full_name: 'Historical Team Updated' });
  await load('/workspace');
  await wait(
    "document.querySelector('#page-title')?.textContent.trim()==='Team workspace'",
    'team access after edit',
  );
  cases.push(
    'Team: workspace still opens; historical incomplete profile saves without registration, university reset, or any role/security changes; team access retained',
  );
  assert.deepEqual(errors, []);
  assert.ok(
    patches.every((patch) => Object.keys(patch).length > 0),
    'No workflow may send an empty PATCH',
  );
  const result = {
    passed: cases.length,
    cases,
    uncaughtErrors: errors,
    patchCount: patches.length,
    network: 'All HTTP API requests intercepted; unexpected origins blocked; no real accounts used',
  };
  writeFileSync(new URL('results.json', out), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  writeFileSync(
    new URL('failure.json', out),
    JSON.stringify(
      {
        error: error.stack,
        errors,
        cases,
        page: inspectPage
          ? await inspectPage('({path:location.pathname,text:document.body.innerText})').catch(
              () => null,
            )
          : null,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  ws?.close();
  chrome.kill();
}
