// Real local Supabase + captured mail; isolated Chrome profile. Never hosted data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { localTestTarget } from './local-test-target.mjs';

if (process.env.RUN_LOCAL_SUPABASE_TESTS !== '1') throw new Error('Local test opt-in required');
const api = localTestTarget(process.env.LOCAL_SUPABASE_URL);
const sql = postgres(localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'), { max: 1 });
const origin = 'http://localhost:5173'; // Matches the local email template Site URL.
const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    flowType: 'pkce',
    detectSessionInUrl: false,
  },
};
const admin = createClient(api, process.env.LOCAL_SUPABASE_SECRET_KEY, options);
const source = createClient(api, key, options);
const password = `Local-${randomUUID()}-Aa9!`;
const out = new URL('../../docs/final-quality/registration-browser/', import.meta.url);
mkdirSync(out, { recursive: true });
const users = [],
  cases = [],
  exceptions = [];
const tabs = await (
  await fetch(`${process.env.ACADEMY_BROWSER_DEBUGGER ?? 'http://127.0.0.1:9226'}/json/list`)
).json();
assert.equal(tabs.filter((tab) => tab.type === 'page').length, 1, 'Dedicated browser required');
const socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown')
    exceptions.push(m.params.exceptionDetails.text);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!r.exceptionDetails, 'Browser evaluation failed');
  return r.result.value;
}
async function wait(expression, label) {
  for (let n = 0; n < 120; n++) {
    if (await evaluate(expression)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`UI did not settle: ${label}`);
}
async function load(path) {
  await send('Page.navigate', { url: path.startsWith('http:') ? path : origin + path });
  await wait("document.readyState==='complete'&&!!document.querySelector('#page-title')", 'page');
  await evaluate('document.fonts.ready.then(()=>true)');
}
async function fill(name, value, form = '') {
  await evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(form + '[name="' + name + '"]')}); const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL(name + '.png', out), Buffer.from(shot.data, 'base64'));
}
async function captured(email, type, excluded = new Set()) {
  for (let n = 0; n < 40; n++) {
    const messages = await (
      await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent('to:' + email)}`)
    ).json();
    for (const m of messages.messages ?? []) {
      const id = m.ID ?? m.id;
      if (excluded.has(id)) continue;
      const body = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json();
      for (const href of String(body.HTML ?? '')
        .replaceAll('&amp;', '&')
        .match(/https?:\/\/[^\s"<>]+/g) ?? []) {
        const u = new URL(href);
        if (
          u.origin === origin &&
          u.pathname === '/auth/callback' &&
          u.searchParams.get('type') === type &&
          u.searchParams.has('token_hash')
        )
          return { href, id };
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Local verification email missing');
}
async function signup(label) {
  const email = `browser-${label}-${randomUUID()}@example.test`;
  const result = await source.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: origin + '/auth/callback' },
  });
  assert.equal(result.error, null);
  users.push(result.data.user.id);
  return { email, id: result.data.user.id };
}
async function logout() {
  await wait(
    "[...document.querySelectorAll('button')].some(b=>/^(Log out|تسجيل الخروج)$/.test(b.textContent))",
    'logout control',
  );
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>/^(Log out|تسجيل الخروج)$/.test(b.textContent)).click()",
  );
  await wait("location.pathname==='/login'", 'logout');
}
async function matrix(path, kind) {
  for (const locale of ['ar', 'en'])
    for (const theme of ['light', 'dark'])
      for (const width of [320, 390, 768, 1440]) {
        await evaluate(
          `localStorage.setItem('ianalyze.language','${locale}');localStorage.setItem('ianalyze.theme','${theme}')`,
        );
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 950,
          deviceScaleFactor: 1,
          mobile: width <= 390,
        });
        await load(path);
        await wait(
          kind === 'profile'
            ? "!!document.querySelector('input[name=whatsapp]')"
            : "!!document.querySelector('.portal-password input')",
          kind,
        );
        assert.equal(
          await evaluate('document.documentElement.dir'),
          locale === 'ar' ? 'rtl' : 'ltr',
        );
        assert.equal(await evaluate('document.documentElement.dataset.theme'), theme);
        assert.ok(
          await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),
          `${kind} ${locale}/${theme}/${width} overflow`,
        );
        if (kind === 'profile') {
          const details = await evaluate(
            `(()=>{const p=document.querySelector('[name=whatsapp]');const s=document.querySelector('[name=academic_year]');return {direction:getComputedStyle(p).direction,placeholder:p.placeholder,label:document.querySelector('label[for="'+p.id+'"]').textContent,years:[...s.options].map(o=>o.value).filter(Boolean)}})()`,
          );
          assert.deepEqual(details.years, ['1', '2', '3', '4', '5']);
          assert.equal(details.direction, 'ltr');
          assert.equal(details.placeholder, '07XXXXXXXX');
          assert.equal(details.label, locale === 'ar' ? 'رقم الهاتف' : 'Phone Number');
        } else {
          assert.ok(
            await evaluate(
              `Array.from(document.querySelectorAll('.portal-password')).every(w=>{const i=w.querySelector('input'),b=w.querySelector('button'),ir=i.getBoundingClientRect(),br=b.getBoundingClientRect();return !!b.getAttribute('aria-label')&&b.getAttribute('aria-controls')===i.id&&getComputedStyle(i).direction==='ltr'&&parseFloat(getComputedStyle(i).paddingRight)>=br.width+3&&br.left>=ir.left&&br.right<=ir.right&&br.top>=ir.top-1&&br.bottom<=ir.bottom+1})`,
            ),
            `Password geometry ${locale}/${theme}/${width}`,
          );
          await fill('password', 'Local-visibility-check-123');
          await evaluate("document.querySelector('.portal-password-toggle').click()");
          await wait("document.querySelector('[name=password]').type==='text'", 'show password');
          assert.equal(
            await evaluate("document.querySelector('[name=password]').value"),
            'Local-visibility-check-123',
          );
          await evaluate("document.querySelector('.portal-password-toggle').focus()");
          await send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: ' ',
            code: 'Space',
            windowsVirtualKeyCode: 32,
          });
          await send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: ' ',
            code: 'Space',
            windowsVirtualKeyCode: 32,
          });
          await wait(
            "document.querySelector('[name=password]').type==='password'",
            'keyboard hide password',
          );
        }
        cases.push({ check: kind, path, locale, theme, width, passed: true });
        if (locale === 'ar' && theme === 'dark' && width === 390)
          await screenshot(kind + '-' + path.replaceAll('/', '-') + '-ar-dark-390');
      }
  await evaluate(
    "localStorage.setItem('ianalyze.language','en');localStorage.setItem('ianalyze.theme','light')",
  );
  await load(path);
  await wait(
    kind === 'profile'
      ? "!!document.querySelector('input[name=whatsapp]')"
      : "!!document.querySelector('.portal-password input')",
    'restore',
  );
}
let passed = false;
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await load('/login');
  await evaluate('localStorage.clear()');
  await load('/join');
  await matrix('/join', 'signup-password');
  await matrix('/login', 'login-password');
  await load('/join');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("!!document.querySelector('[name=email][aria-invalid=true]')", 'required email');
  assert.equal(await evaluate('document.activeElement.name'), 'email');
  assert.ok(
    await evaluate(
      "[...document.querySelectorAll('[aria-invalid=true]')].every(e=>e.getAttribute('aria-describedby').split(' ').every(id=>!!document.getElementById(id)))",
    ),
  );
  cases.push({ check: 'associated errors and focus', passed: true });

  const account = await signup('cross-browser');
  const confirmation = await captured(account.email, 'email');
  assert.ok(await evaluate("!localStorage.getItem('ianalyze.auth-code-verifier')"));
  await load(confirmation.href);
  await wait(
    "location.pathname==='/student'&&!!document.querySelector('[name=whatsapp]')",
    'fresh-browser email callback',
  );
  assert.equal(await evaluate('location.search + location.hash'), '');
  assert.ok(await evaluate("!!document.querySelector('.portal-notice-success')"));
  cases.push({
    check: 'captured confirmation opened without signup browser verifier',
    passed: true,
  });
  await matrix('/student', 'profile');
  await fill('university_choice', 'other');
  for (const [name, value] of Object.entries({
    full_name: 'LOCAL COMPLETE PARTICIPANT',
    whatsapp: '(079) 723-2936',
    major: 'Data Science & Artificial Intelligence',
    university: 'Local Test University',
    academic_year: '5',
    python_experience: 'experienced',
    university_id: 'LOCAL-OPTIONAL-ID',
  }))
    await fill(name, value);
  const token = await evaluate(
    "JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth'))).access_token",
  );
  await evaluate(
    "document.querySelector('[name=consent]').click();document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit()",
  );
  await wait("!!document.querySelector('[data-student-dashboard]')", 'registration save');
  assert.ok(
    (await evaluate(
      "JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth'))).access_token",
    )) === token,
    'Save preserves session',
  );
  const profile = (
    await sql`select whatsapp,academic_year,university_id from public.profiles where id=${account.id}`
  )[0];
  assert.deepEqual(profile, {
    whatsapp: '+962797232936',
    academic_year: 5,
    university_id: 'LOCAL-OPTIONAL-ID',
  });
  cases.push({
    check: 'double Save persists normalized registration and existing session',
    passed: true,
  });
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Edit profile').click()",
  );
  await fill('whatsapp', '00962797232936');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "!!document.querySelector('[data-student-dashboard]')&&!document.querySelector('[name=whatsapp]')",
    'profile edit saved',
  );
  assert.equal(await evaluate('location.pathname'), '/student');
  cases.push({ check: 'profile Save stays authenticated', passed: true });
  await logout();
  await load(confirmation.href);
  await wait(
    "!!document.querySelector('[role=alert]')&&!!document.querySelector('#resend-confirmation')",
    'used link',
  );
  assert.equal(await evaluate('location.search + location.hash'), '');
  cases.push({ check: 'used link is scrubbed and offers resend', passed: true });

  const pendingAccount = await signup('resend');
  await sql`update auth.users set confirmation_sent_at=now()-interval '2 minutes' where id=${pendingAccount.id}`;
  await fill('email', pendingAccount.email, '#resend-confirmation ');
  await evaluate(
    "document.querySelector('#resend-confirmation').requestSubmit();document.querySelector('#resend-confirmation').requestSubmit()",
  );
  await wait(
    "!!document.querySelector('#resend-confirmation .portal-notice-success')",
    'resend success',
  );
  assert.ok(await evaluate("document.querySelector('#resend-confirmation button').disabled"));
  cases.push({ check: 'resend success with double-submit guard and cooldown', passed: true });
  await load('/login');
  await sql`update auth.users set confirmation_sent_at=now()+interval '5 minutes' where id=${pendingAccount.id}`;
  await fill('email', pendingAccount.email, '#resend-confirmation ');
  await evaluate("document.querySelector('#resend-confirmation').requestSubmit()");
  await wait(
    "document.querySelector('#resend-confirmation').textContent.includes('Too many requests')",
    'server email rate limit',
  );
  cases.push({ check: 'real Supabase 429 has actionable feedback and cooldown', passed: true });

  const expiredAccount = await signup('expired');
  const expired = await captured(expiredAccount.email, 'email');
  await sql`update auth.users set confirmation_sent_at=now()-interval '2 hours' where id=${expiredAccount.id}`;
  await load(expired.href);
  await wait(
    "!!document.querySelector('[role=alert]')&&!!document.querySelector('#resend-confirmation')",
    'expired email',
  );
  cases.push({ check: 'expired captured email fails safely with resend', passed: true });

  assert.equal(
    (
      await source.auth.resetPasswordForEmail(account.email, {
        redirectTo: origin + '/auth/callback?flow=recovery',
      })
    ).error,
    null,
  );
  const recovery = await captured(account.email, 'recovery');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await load(recovery.href);
  await wait(
    "location.pathname==='/auth/reset'&&!!document.querySelector('[name=password]')",
    'mobile external-mail recovery',
  );
  assert.equal(await evaluate('location.search + location.hash'), '');
  cases.push({
    check: 'mobile-emulated recovery in a different browser from request',
    passed: true,
  });
  await matrix('/auth/reset', 'reset-password');
  await fill('password', password + '-changed');
  await fill('confirmation', password + '-changed');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "location.pathname==='/login'&&!!document.querySelector('.portal-notice-success')",
    'password reset',
  );
  await fill('email', account.email);
  await fill('password', password + '-changed');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("!!document.querySelector('[data-student-dashboard]')", 'new password login');
  await load('/workspace');
  await wait("location.pathname==='/student'", 'Student denied workspace');
  cases.push({ check: 'password reset, re-login and protected Team route', passed: true });
  await logout();

  const teamEmail = `browser-team-${randomUUID()}@example.test`;
  const team = await admin.auth.admin.createUser({
    email: teamEmail,
    password,
    email_confirm: true,
  });
  assert.equal(team.error, null);
  users.push(team.data.user.id);
  await sql`update app_private.user_roles set role='team',grant_reason='LOCAL ONLY browser participant test' where user_id=${team.data.user.id}`;
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: teamEmail });
  assert.equal(link.error, null);
  await load(
    origin +
      '/auth/callback?token_hash=' +
      encodeURIComponent(link.data.properties.hashed_token) +
      '&type=email',
  );
  await wait(
    "location.pathname==='/workspace'&&!!document.querySelector('#students')",
    'Team callback destination',
  );
  const cells = await evaluate(
    "[...document.querySelectorAll('#students tbody tr')].find(r=>r.textContent.includes('LOCAL COMPLETE PARTICIPANT'))?.innerText",
  );
  for (const value of [
    'LOCAL COMPLETE PARTICIPANT',
    account.email,
    '+962797232936',
    'Data Science',
    'Fifth Year',
    'Experienced',
    'LOCAL-OPTIONAL-ID',
    'English',
  ])
    assert.ok(cells?.includes(value), 'Complete participant data: ' + value);
  assert.equal(await evaluate("document.querySelectorAll('#students th').length"), 9);
  cases.push({
    check: 'verified Team callback and private registration fields',
    passed: true,
  });
  await screenshot('complete-participants-en');
  await logout();
  assert.deepEqual(exceptions, []);
  passed = true;
} finally {
  writeFileSync(
    new URL('results.json', out),
    JSON.stringify(
      {
        localOnly: true,
        realSupabase: true,
        mobile: 'Chrome viewport emulation, not a physical mail app',
        passed,
        cases,
        exceptions,
      },
      null,
      2,
    ) + '\n',
  );
  socket.close();
  for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
  await sql.end();
  console.log(JSON.stringify({ passed, checks: cases.length, exceptions: exceptions.length }));
}
