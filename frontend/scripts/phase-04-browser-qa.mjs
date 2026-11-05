// Synthetic fixtures and a dedicated headless Chrome profile only. Never hosted targets.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { localTestTarget } from './local-test-target.mjs';
if (process.env.RUN_LOCAL_SUPABASE_TESTS !== '1')
  throw new Error('Explicit local-test opt-in required');
const api = localTestTarget(process.env.LOCAL_SUPABASE_URL),
  db = localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database');
const key = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.LOCAL_SUPABASE_SECRET_KEY;
assert.ok(key && secret);
const origin = 'http://127.0.0.1:5173';
const admin = createClient(api, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  sql = postgres(db, { max: 1 });
const ids = {
  week: randomUUID(),
  activity: randomUUID(),
  rubric: randomUUID(),
  criterion: randomUUID(),
};
const suffix = randomUUID(),
  email = `ui-student-${suffix}@example.test`,
  teamEmail = `ui-team-${suffix}@example.test`;
const password = `Local-${randomUUID()}-Aa9!`;
const arabicWeekTitle =
  'اختبار محلي لعنوان أسبوع طويل: أساسيات Python وتطبيقات مكتبة Pandas وقراءة البيانات وتنظيفها وعرض النتائج بوضوح على الشاشات الصغيرة دون تغيير ترتيب الخطة الدراسية';
const arabicActivityTitle =
  'نشاط اختبار محلي طويل: استخدام Pandas لاستكشاف البيانات وتنظيفها وكتابة ملاحظات واضحة ومراجعة النتائج ضمن نشاط تدريبي مخصص لاختبار الواجهة العربية على الهاتف';
const users = [],
  paths = [],
  exceptions = [],
  portalLayouts = [];
let socket;
let sequence = 0;
const pending = new Map();
let approved = false;
const artifact = new URL('../artifacts/', import.meta.url);
mkdirSync(artifact, { recursive: true });
const file = new URL('ui-test-notebook.ipynb', artifact);
writeFileSync(
  file,
  JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [
      {
        id: 'ui-code',
        cell_type: 'code',
        metadata: {},
        source: 'print("LOCAL UI TEST ONLY")',
        execution_count: null,
        outputs: [],
      },
    ],
  }),
);
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser timeout: ${method}`));
    }, 15000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(expression, sessionId) {
  const r = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (r.exceptionDetails) throw new Error('Browser evaluation failed');
  return r.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function wait(expression, label, sessionId) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression, sessionId)) return;
    await pause(100);
  }
  throw new Error(`UI did not reach ${label}`);
}
async function navigate(path) {
  await send('Page.navigate', { url: origin + path });
  const pathname = path.split(/[?#]/)[0];
  // Production callbacks can finish before the first browser poll. Assert the
  // final destination in the caller instead of requiring a transient frame.
  const reached =
    pathname === '/auth/callback'
      ? "['/auth/callback','/student','/workspace','/auth/reset'].includes(location.pathname)"
      : `location.pathname===${JSON.stringify(pathname)}`;
  await wait(
    `${reached}&&document.readyState==='complete'&&Boolean(document.querySelector('h1'))`,
    path.split('?')[0],
  );
}
async function fill(selector, value) {
  assert.equal(
    await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
    ),
    true,
    `Missing form field ${selector}`,
  );
}
async function login(address) {
  await navigate('/login');
  await fill('input[name=email]', address);
  await fill('input[name=password]', password);
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    address === teamEmail
      ? "location.pathname==='/workspace'&&Boolean(document.querySelector('#students'))"
      : "location.pathname==='/student'&&Boolean(document.querySelector('[data-student-dashboard]'))",
    'verified role dashboard',
  );
}
async function logout() {
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Log out').click()",
  );
  await wait("location.pathname==='/login'", 'logout');
}
async function portalMatrix(path, role) {
  for (const language of ['ar', 'en'])
    for (const theme of ['light', 'dark'])
      for (const width of [320, 390, 768, 1440]) {
        await evaluate(
          `localStorage.setItem('ianalyze.language',${JSON.stringify(language)});localStorage.setItem('ianalyze.theme',${JSON.stringify(theme)})`,
        );
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await navigate(path);
        await wait(
          role === 'student'
            ? "Boolean(document.querySelector('[data-student-dashboard]'))"
            : "Boolean(document.querySelector('#students'))",
          'authenticated dashboard data',
        );
        assert.equal(
          await evaluate('document.documentElement.dir'),
          language === 'ar' ? 'rtl' : 'ltr',
        );
        assert.equal(await evaluate('document.documentElement.dataset.theme'), theme);
        const headings = await evaluate(
          "[...document.querySelectorAll('h3')].map(h=>h.textContent)",
        );
        const weekTitles =
          role === 'student'
            ? headings
            : await evaluate(
                "[...document.querySelectorAll('#activities > .portal-actions > span')].map(e=>e.textContent)",
              );
        assert.ok(
          weekTitles.some((text) =>
            text.includes(language === 'ar' ? arabicWeekTitle : 'LOCAL UI TEST'),
          ),
          'Database week title respects selected language',
        );
        if (language === 'ar') {
          assert.ok(
            headings.some((text) => text.includes(arabicActivityTitle)),
            'Database activity title is Arabic in Student and Team views',
          );
          assert.ok(
            !headings.some((text) => text.includes('LOCAL UI ACTIVITY')),
            'No English-only activity headings in Arabic',
          );
          assert.ok(
            headings.some((text) => text.includes('Pandas')),
            'Official library names remain identifiable',
          );
        }
        assert.equal(
          await evaluate('document.documentElement.scrollWidth>innerWidth+2'),
          false,
          `${role} overflow ${language}/${theme}/${width}`,
        );
        if (role === 'team' && width <= 390)
          assert.equal(
            await evaluate(
              "(()=>{const table=document.querySelector('#students .portal-table');return table.scrollWidth>table.clientWidth&&table.tabIndex===0&&Boolean(table.getAttribute('aria-label'))})()",
            ),
            true,
            'Team contacts remain readable in an accessible internal scroll region',
          );
        portalLayouts.push({ role, language, theme, width });
        if (language === 'ar' && theme === 'dark' && width === 390) {
          const shot = await send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(
            new URL(`mvp-${role}-ar-dark-390.png`, artifact),
            Buffer.from(shot.data, 'base64'),
          );
        }
      }
  await evaluate(
    "localStorage.setItem('ianalyze.language','en');localStorage.setItem('ianalyze.theme','light')",
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(path);
  await wait(
    role === 'student'
      ? "Boolean(document.querySelector('[data-student-dashboard]'))"
      : "Boolean(document.querySelector('#students'))",
    'restored dashboard',
  );
}
async function capturedLink(type = 'signup', address = email, excluded = new Set()) {
  for (let i = 0; i < 50; i++) {
    const list = await (
      await fetch(
        `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
      )
    ).json();
    for (const m of list.messages ?? []) {
      if (excluded.has(m.ID ?? m.id)) continue;
      const body = await (
        await fetch(`http://127.0.0.1:54324/api/v1/message/${m.ID ?? m.id}`)
      ).json();
      const links =
        String(body.HTML ?? body.Text ?? '')
          .replaceAll('&amp;', '&')
          .match(/https?:\/\/[^\s"<>]+/g) ?? [];
      for (const link of links) {
        const p = new URL(link);
        if (
          p.origin === api &&
          p.pathname === '/auth/v1/verify' &&
          p.searchParams.get('type') === type
        )
          return link;
      }
    }
    await pause(100);
  }
  throw new Error('Signup email not captured');
}
try {
  assert.equal(Number((await sql`select count(*) as n from public.academy_weeks`)[0].n), 0);
  assert.equal(
    (await sql`select app_private.submission_service_enabled() as enabled`)[0].enabled,
    false,
  );
  approved = true;
  await sql`create or replace function app_private.submission_service_enabled() returns boolean language sql immutable set search_path='' as $$select true$$`;
  await sql`create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select true$$`;
  await sql`insert into public.academy_weeks(id,week_number,kind,title_ar,title_en,description_ar,description_en,status) values(${ids.week},1,'teaching',${arabicWeekTitle},'LOCAL UI TEST','وصف محلي لاختبار اتجاه Python وPandas في المحتوى المخزن في قاعدة البيانات.','LOCAL DATABASE DESCRIPTION: Python and Pandas.','published')`;
  await sql`insert into public.activities(id,week_id,title_ar,title_en,instructions_ar,instructions_en,max_score,status) values(${ids.activity},${ids.week},${arabicActivityTitle},'LOCAL UI ACTIVITY','اختبار فقط','LOCAL UI TEST instructions',10,'published')`;
  await sql`insert into public.rubrics(id,activity_id,version) values(${ids.rubric},${ids.activity},1)`;
  await sql`insert into public.rubric_criteria(id,rubric_id,label_ar,label_en,max_points,sort_order) values(${ids.criterion},${ids.rubric},'اختبار محلي','LOCAL UI criterion',10,0)`;
  await sql`update public.rubrics set status='published' where id=${ids.rubric}`;
  const team = await admin.auth.admin.createUser({
    email: teamEmail,
    password,
    email_confirm: true,
  });
  assert.equal(team.error, null);
  users.push(team.data.user.id);
  await sql`update app_private.user_roles set role='team',grant_reason='LOCAL UI TEST ONLY' where user_id=${team.data.user.id}`;
  const targets = await (
    await fetch(`${process.env.ACADEMY_BROWSER_DEBUGGER ?? 'http://127.0.0.1:9237'}/json/list`)
  ).json();
  const pages = targets.filter((t) => t.type === 'page');
  assert.equal(pages.length, 1);
  socket = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p?.reject(new Error(m.error.message));
      else p?.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown')
      exceptions.push(m.params.exceptionDetails.text);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Network.enable');
  await navigate('/');
  await evaluate(
    "localStorage.setItem('ianalyze.language','en');localStorage.setItem('ianalyze.theme','light')",
  );
  await navigate('/join');
  await wait("Boolean(document.querySelector('input[name=password]'))", 'real signup form');
  await fill('input[name=email]', '');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "Boolean(document.querySelector('input[name=email][aria-invalid=true]'))",
    'required signup validation',
  );
  await fill('input[name=email]', 'invalid');
  await fill('input[name=password]', 'short');
  await fill('input[name=confirmation]', 'different');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "document.body.innerText.includes('Passwords do not match')",
    'signup password mismatch',
  );
  assert.equal(await evaluate('document.activeElement.name'), 'email');
  await send('Page.captureScreenshot', { format: 'png' }).then((r) =>
    writeFileSync(new URL('auth-validation-en.png', artifact), Buffer.from(r.data, 'base64')),
  );
  await fill('input[name=email]', email);
  await fill('input[name=password]', password);
  await fill('input[name=confirmation]', password);
  await evaluate("document.querySelector('[aria-controls][aria-pressed]').click()");
  assert.equal(await evaluate("document.querySelector('input[name=password]').type"), 'text');
  await evaluate("document.querySelector('[aria-controls][aria-pressed]').click()");
  await evaluate(
    "document.querySelector('input[type=checkbox]').click();document.querySelector('form').requestSubmit()",
  );
  await wait("document.body.innerText.includes('Check your inbox')", 'confirmation message');
  const successColor = await evaluate(
    "getComputedStyle(document.querySelector('.portal-notice-success p')).color",
  );
  const successRgb = successColor.match(/[\d.]+/g).map(Number);
  assert.ok(successRgb[1] > successRgb[0], 'Confirmed success text must use the green token');
  const authUsers = await admin.auth.admin.listUsers();
  const student = authUsers.data.users.find((u) => u.email === email);
  assert.ok(student);
  users.push(student.id);
  const verified = await fetch(await capturedLink(), { redirect: 'manual' });
  assert.equal(verified.status, 303);
  const callback = new URL(verified.headers.get('location'));
  assert.equal(callback.origin, origin);
  await navigate(callback.pathname + callback.search);
  await wait(
    "location.pathname==='/student'&&Boolean(document.querySelector('input[name=full_name]'))",
    'verified signup callback',
  );
  assert.equal(await evaluate("location.search.includes('code=')"), false);
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "document.body.innerText.includes('Please select your academic year')",
    'registration required fields',
  );
  await fill('input[name=whatsapp]', '0760000001');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "document.body.innerText.includes('Enter a Jordanian mobile number')",
    'registration phone validation',
  );
  await send('Page.captureScreenshot', { format: 'png' }).then((r) =>
    writeFileSync(
      new URL('registration-validation-en.png', artifact),
      Buffer.from(r.data, 'base64'),
    ),
  );
  await fill('[name=university_choice]', 'other');
  for (const [name, value] of Object.entries({
    full_name: 'LOCAL UI STUDENT',
    whatsapp: '0790000001',
    major: 'Computer Science',
    university: 'Local Test University',
    academic_year: '4',
    python_experience: 'basic',
  }))
    await fill(`[name=${name}]`, value);
  const studentSessionBeforeSave = await evaluate(
    "JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth'))).user.id",
  );
  await evaluate("document.querySelector('input[name=consent]').click()");
  await send('Network.setBlockedURLs', { urls: [api + '/rest/v1/rpc/complete_registration*'] });
  try {
    await evaluate("document.querySelector('form').requestSubmit()");
    await wait(
      "Boolean(document.querySelector('[role=alert]'))",
      'failed registration remains on form',
    );
    assert.equal(
      await evaluate("document.querySelector('input[name=full_name]').value"),
      'LOCAL UI STUDENT',
    );
    assert.equal(await evaluate('location.pathname'), '/student');
    assert.equal(
      (await sql`select registered_at from public.profiles where id=${student.id}`)[0]
        .registered_at,
      null,
    );
  } finally {
    await send('Network.setBlockedURLs', { urls: [] });
  }
  await evaluate(
    "document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit()",
  );
  await wait(
    "Boolean(document.querySelector('[data-student-dashboard]'))&&document.body.innerText.includes('LOCAL UI ACTIVITY')",
    'confirmed Save opens dashboard without login',
  );
  assert.equal(
    await evaluate("Boolean(document.querySelector('input[name=full_name]'))"),
    false,
    'Registered users do not see the registration form again',
  );
  assert.equal(
    await evaluate(
      "JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth'))).user.id",
    ),
    studentSessionBeforeSave,
  );
  assert.ok(await evaluate("Boolean(document.querySelector('.portal-notice-success'))"));
  assert.equal(
    Number(
      (
        await sql`select count(*) as n from public.profiles where id=${student.id} and registered_at is not null`
      )[0].n,
    ),
    1,
  );

  await send('Page.reload');
  await wait(
    "Boolean(document.querySelector('[data-student-dashboard]'))&&document.body.innerText.includes('LOCAL UI ACTIVITY')",
    'persistent session after document refresh',
  );
  // Expired cache metadata forces the SDK through the real local refresh-token endpoint.
  await evaluate(
    "const saved=JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth')));saved.expires_at=1;(sessionStorage.getItem('ianalyze.auth') ? sessionStorage : localStorage).setItem('ianalyze.auth',JSON.stringify(saved))",
  );
  await send('Page.reload');
  await wait(
    "Boolean(document.querySelector('[data-student-dashboard]'))&&document.body.innerText.includes('LOCAL UI ACTIVITY')",
    'real session refresh',
  );
  await send('Network.setBlockedURLs', { urls: [api + '/rest/v1/rpc/current_academy_role*'] });
  try {
    await send('Page.reload');
    await wait(
      "Boolean(document.querySelector('[role=alert]'))",
      'session verification failure is retryable',
    );
    assert.equal(await evaluate('location.pathname'), '/student');
    assert.equal(
      await evaluate("Boolean(document.querySelector('[data-student-dashboard]'))"),
      false,
    );
  } finally {
    await send('Network.setBlockedURLs', { urls: [] });
  }
  await evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh').click()",
  );
  await wait(
    "Boolean(document.querySelector('[data-student-dashboard]'))",
    'session retry without password',
  );
  const doc = await send('DOM.getDocument');
  const input = await send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'input[type=file]',
  });
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [fileURLToPath(file)] });
  await evaluate("document.querySelector('input[type=file]').closest('form').requestSubmit()");
  await wait("document.body.innerText.includes('Submitted')", 'notebook upload');
  const submission = (
    await sql`select * from public.submissions where student_id=${student.id}`
  )[0];
  assert.equal(submission.status, 'submitted');
  paths.push(submission.object_path);
  await send('Page.captureScreenshot', { format: 'png' }).then((r) =>
    writeFileSync(new URL('mvp-student-en.png', artifact), Buffer.from(r.data, 'base64')),
  );
  await portalMatrix('/student', 'student');
  await logout();
  await fill('input[name=email]', email);
  await fill('input[name=password]', password + '-wrong');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("document.body.innerText.includes('Unable to log in')", 'invalid password feedback');
  assert.equal(await evaluate('location.pathname'), '/login');
  await login(teamEmail);
  await navigate('/student');
  await wait(
    "Boolean(document.querySelector('input[name=full_name]'))",
    'Team profile registration',
  );
  await fill('[name=university_choice]', 'other');
  for (const [name, value] of Object.entries({
    full_name: 'LOCAL UI TEAM',
    whatsapp: '+962790000002',
    major: 'Computer Science',
    university: 'Local Test University',
    academic_year: '4',
    python_experience: 'experienced',
  }))
    await fill('[name=' + name + ']', value);
  const teamBeforeSave = await evaluate(
    "JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth'))).user.id",
  );
  await evaluate(
    "document.querySelector('input[name=consent]').click();document.querySelector('form').requestSubmit()",
  );
  await wait(
    "location.pathname==='/workspace'&&Boolean(document.querySelector('#students'))",
    'Team Save returns to management without login',
  );
  assert.equal(
    await evaluate(
      "JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth'))).user.id",
    ),
    teamBeforeSave,
  );
  assert.equal(
    (await sql`select role from app_private.user_roles where user_id=${teamBeforeSave}::uuid`)[0]
      .role,
    'team',
  );
  await navigate('/workspace');
  await wait("document.body.innerText.includes('LOCAL UI STUDENT')", 'Team student list');
  assert.equal(
    await evaluate("document.querySelector('#students').innerText.includes('+962790000001')"),
    true,
  );
  await fill(`#reviews input[name='${ids.criterion}']`, '8.5');
  await fill('#reviews textarea[name=feedback]', 'LOCAL UI published feedback');
  await evaluate(
    "const form=document.querySelector('#reviews form');form.requestSubmit(form.querySelector('[value=publish]'))",
  );
  for (let i = 0; i < 50; i++) {
    if (
      Number(
        (
          await sql`select count(*) as n from public.grades where submission_id=${submission.id} and status='published'`
        )[0].n,
      )
    )
      break;
    await pause(100);
  }
  assert.equal(
    Number(
      (
        await sql`select count(*) as n from public.grades where submission_id=${submission.id} and status='published'`
      )[0].n,
    ),
    1,
  );
  await send('Page.captureScreenshot', { format: 'png' }).then((r) =>
    writeFileSync(new URL('mvp-team-en.png', artifact), Buffer.from(r.data, 'base64')),
  );
  await portalMatrix('/workspace', 'team');
  await logout();
  await login(email);
  await wait(
    "document.body.innerText.includes('LOCAL UI published feedback')",
    'own grade and feedback',
  );
  const secondTab = await send('Target.createTarget', { url: origin + '/student' });
  try {
    const attached = await send('Target.attachToTarget', {
      targetId: secondTab.targetId,
      flatten: true,
    });
    await send('Runtime.enable', {}, attached.sessionId);
    await wait(
      "Boolean(document.querySelector('[data-student-dashboard]'))",
      'shared session in second tab',
      attached.sessionId,
    );
    await logout();
    await wait(
      "location.pathname==='/login'&&!document.querySelector('input[name=full_name]')&&!document.querySelector('[data-student-dashboard]')",
      'cross-tab logout clears private UI',
      attached.sessionId,
    );
  } finally {
    await send('Target.closeTarget', { targetId: secondTab.targetId });
  }
  await login(email);
  await send('Page.navigate', { url: origin + '/workspace' });
  await wait(
    "location.pathname==='/student'&&Boolean(document.querySelector('[data-student-dashboard]'))",
    'Student denied Team route',
  );
  await logout();
  const recovery = await admin.auth.admin.generateLink({ type: 'recovery', email });
  assert.equal(recovery.error, null);
  await send('Page.navigate', {
    url:
      origin +
      '/auth/callback?token_hash=' +
      encodeURIComponent(recovery.data.properties.hashed_token) +
      '&type=recovery',
  });
  await wait(
    "location.pathname==='/auth/reset'&&Boolean(document.querySelector('input[name=password]'))",
    'token-hash recovery callback',
  );
  assert.equal(await evaluate("location.search.includes('token_hash')"), false);
  await fill('input[name=password]', password + '-new');
  if (await evaluate("Boolean(document.querySelector('input[name=confirmation]'))"))
    await fill('input[name=confirmation]', password + '-new');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "location.pathname==='/login'&&document.body.innerText.includes('Saved successfully')",
    'new password saved and signed out',
  );
  await fill('input[name=email]', email);
  await fill('input[name=password]', password + '-new');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "Boolean(document.querySelector('[data-student-dashboard]'))",
    'profile after password reset',
  );
  await logout();
  await navigate('/auth/recover');
  await fill('input[name=email]', email);
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "document.body.innerText.includes('If eligible')",
    'recovery email requested through UI',
  );
  const recoveryEmail = await fetch(await capturedLink('recovery'), { redirect: 'manual' });
  assert.equal(recoveryEmail.status, 303);
  const recoveryCallback = new URL(recoveryEmail.headers.get('location'));
  assert.equal(recoveryCallback.origin, origin);
  assert.equal(recoveryCallback.searchParams.get('flow'), 'recovery');
  await navigate(recoveryCallback.pathname + recoveryCallback.search);
  await wait(
    "location.pathname==='/auth/reset'&&Boolean(document.querySelector('input[name=password]'))",
    'captured-email PKCE recovery callback',
  );
  assert.equal(await evaluate('location.search'), '');
  await fill('input[name=password]', password + '-email-reset');
  if (await evaluate("Boolean(document.querySelector('input[name=confirmation]'))"))
    await fill('input[name=confirmation]', password + '-email-reset');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "location.pathname==='/login'&&document.body.innerText.includes('Saved successfully')",
    'email recovery password saved',
  );
  await fill('input[name=email]', email);
  await fill('input[name=password]', password + '-email-reset');
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait(
    "Boolean(document.querySelector('[data-student-dashboard]'))",
    'login after captured-email recovery',
  );
  await logout();
  // A transport failure must not be reported as a successfully requested recovery email.
  await navigate('/auth/recover');
  await send('Network.setBlockedURLs', { urls: [api + '/auth/v1/recover*'] });
  try {
    await fill('input[name=email]', email);
    await evaluate("document.querySelector('form').requestSubmit()");
    await wait(
      "document.body.innerText.includes('Unable to connect')",
      'recovery transport failure shown to the user',
    );
    assert.equal(await evaluate("document.body.innerText.includes('If eligible')"), false);
  } finally {
    await send('Network.setBlockedURLs', { urls: [] });
  }
  const resendAddress = 'resend-' + suffix + '@example.test';
  await navigate('/join');
  await fill('input[name=email]', resendAddress);
  await fill('input[name=password]', password);
  await fill('input[name=confirmation]', password);
  await evaluate(
    "document.querySelector('input[name=consent]').click();document.querySelector('form').requestSubmit()",
  );
  await wait("document.body.innerText.includes('Check your inbox')", 'resend fixture signup');
  const resendUser = (await admin.auth.admin.listUsers()).data.users.find(
    (u) => u.email === resendAddress,
  );
  assert.ok(resendUser);
  users.push(resendUser.id);
  const beforeResend = await (
    await fetch(
      'http://127.0.0.1:54324/api/v1/search?query=' + encodeURIComponent('to:' + resendAddress),
    )
  ).json();
  const oldMail = new Set((beforeResend.messages ?? []).map((m) => m.ID ?? m.id));
  await pause(1100);
  await navigate('/login');
  await fill('#resend-confirmation input[name=email]', resendAddress);
  await evaluate("document.querySelector('#resend-confirmation').requestSubmit()");
  await wait(
    "document.body.innerText.includes('a new confirmation email has been requested')",
    'real resend accepted',
  );
  const resent = await fetch(await capturedLink('signup', resendAddress, oldMail), {
    redirect: 'manual',
  });
  assert.equal(resent.status, 303);
  const resentCallback = new URL(resent.headers.get('location'));
  assert.equal(resentCallback.origin, origin);
  await navigate(resentCallback.pathname + resentCallback.search + resentCallback.hash);
  if (resentCallback.hash.includes('access_token')) {
    await wait(
      "document.body.innerText.includes('The email link has returned')",
      'legacy resend guidance',
    );
    assert.equal(await evaluate('location.hash'), '');
    assert.equal(
      await evaluate("Boolean(document.querySelector('[data-student-dashboard]'))"),
      false,
    );
    await navigate('/login');
    await fill('input[name=email]', resendAddress);
    await fill('input[name=password]', password);
    await evaluate("document.querySelector('form').requestSubmit()");
  }
  await wait(
    "location.pathname==='/student'&&Boolean(document.querySelector('input[name=full_name]'))",
    'resent confirmation permits verified login',
  );
  await evaluate(
    "const saved=JSON.parse((sessionStorage.getItem('ianalyze.auth') ?? localStorage.getItem('ianalyze.auth')));saved.expires_at=1;saved.refresh_token='LOCAL_EXPIRED_REFRESH_TEST';(sessionStorage.getItem('ianalyze.auth') ? sessionStorage : localStorage).setItem('ianalyze.auth',JSON.stringify(saved))",
  );
  await send('Page.reload');
  await wait(
    "location.pathname==='/login'&&Boolean(document.querySelector('input[name=password]'))",
    'actually expired session requires login',
  );
  await navigate('/auth/callback?token_hash=LOCAL_INVALID_EXPIRED_TEST&type=signup');
  await wait(
    'Boolean(document.querySelector(\'main a[href="/login"]\'))',
    'invalid confirmation link retry',
  );
  assert.equal(await evaluate('location.search'), '');
  assert.equal(
    await evaluate("Boolean(document.querySelector('[data-student-dashboard]'))"),
    false,
  );
  await navigate('/leaderboard');
  await wait("Boolean(document.querySelector('tbody tr'))", 'real leaderboard');
  const ranking = await evaluate("document.querySelector('table').innerText");
  assert.ok(ranking.includes('8.5'));
  assert.ok(ranking.includes('Learner '));
  assert.equal(ranking.includes('LOCAL UI STUDENT'), false);
  assert.equal(ranking.includes('+962'), false);
  for (const language of ['ar', 'en'])
    for (const width of [390, 1440]) {
      await evaluate(`localStorage.setItem('ianalyze.language',${JSON.stringify(language)})`);
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const path of ['/login', '/auth/recover', '/join', '/privacy', '/leaderboard']) {
        await navigate(path);
        assert.equal(
          await evaluate('document.documentElement.dir'),
          language === 'ar' ? 'rtl' : 'ltr',
        );
        assert.equal(
          await evaluate('document.documentElement.scrollWidth>innerWidth+2'),
          false,
          `${path} overflow ${language}/${width}`,
        );
      }
    }
  let validationLayouts = 0;
  for (const language of ['ar', 'en'])
    for (const theme of ['light', 'dark'])
      for (const width of [320, 1440]) {
        await evaluate(
          `localStorage.setItem('ianalyze.language',${JSON.stringify(language)});localStorage.setItem('ianalyze.theme',${JSON.stringify(theme)})`,
        );
        await send('Emulation.setDeviceMetricsOverride', {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width === 320,
        });
        for (const path of ['/login', '/join', '/auth/recover']) {
          await navigate(path);
          await evaluate("document.querySelector('form').requestSubmit()");
          await wait(
            "Boolean(document.querySelector('[role=alert]'))",
            'localized validation announcement',
          );
          assert.equal(
            await evaluate(
              "[...document.querySelectorAll('[aria-invalid=true]')].every(x=>x.getAttribute('aria-describedby').split(' ').every(id=>document.getElementById(id)?.textContent.trim()))",
            ),
            true,
          );
          assert.equal(
            await evaluate("document.querySelector('.field-error').textContent.includes('???')"),
            false,
          );
          const color = await evaluate(
            "getComputedStyle(document.querySelector('.field-error')).color",
          );
          const rgb = color.match(/[\d.]+/g).map(Number);
          assert.ok(
            rgb[0] > rgb[1] && rgb[0] > rgb[2],
            'Error text must use the accessible red token',
          );
          const background = await evaluate(
            "getComputedStyle(document.querySelector('.content-card')).backgroundColor",
          );
          const channels = (text) =>
            text
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number);
          const luminance = (colors) =>
            colors
              .map((x) => x / 255)
              .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
              .reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
          const first = luminance(channels(color)),
            second = luminance(channels(background));
          assert.ok(
            (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05) >= 4.5,
            'Validation text contrast must meet 4.5:1',
          );
          assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+2'), false);
          if (path === '/join' && width === 320)
            await send('Page.captureScreenshot', { format: 'png' }).then((r) =>
              writeFileSync(
                new URL('auth-errors-' + language + '-' + theme + '.png', artifact),
                Buffer.from(r.data, 'base64'),
              ),
            );
          validationLayouts++;
        }
      }
  assert.equal(validationLayouts, 24);
  assert.deepEqual(exceptions, []);
  writeFileSync(
    new URL('mvp-browser-results.json', artifact),
    JSON.stringify(
      {
        signup: true,
        emailCallback: true,
        emailPkceRecovery: true,
        sessionPersistence: true,
        sessionRefresh: true,
        crossTabLogout: true,
        teamLoginDestination: true,
        invalidPasswordDenied: true,
        invalidEmailLinkDenied: true,
        profile: true,
        serverConfirmedDashboardHandoff: true,
        studentAndTeamSessionsRetained: true,
        registrationFailureValuesRetained: true,
        duplicateRegistrationPrevented: true,
        existingRegistrationFormHidden: true,
        sessionVerificationRetryWithoutLogin: true,
        genuinelyExpiredSessionDenied: true,
        passwordRecoveryCallback: true,
        recoveryTransportFailure: true,
        inlineValidation: true,
        validationLayoutCases: 24,
        confirmationResend: true,
        legacyResendGuidance: true,
        passwordVisibility: true,
        upload: true,
        teamGrade: true,
        privateOwnFeedback: true,
        studentTeamRouteDenied: true,
        pseudonymousLeaderboard: true,
        responsiveCombinations: 20,
        authenticatedLayouts: portalLayouts,
        exceptions,
      },
      null,
      2,
    ),
  );
  console.log(
    'Browser MVP passed: real signup, confirmation/recovery, session refresh, cross-tab logout, profiles, uploads, Team grading and privacy; 20 public/Auth and 32 authenticated bilingual/theme/responsive combinations.',
  );
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) {
    console.error(
      'UI failure state:',
      await evaluate(
        "JSON.stringify({path:location.pathname,status:[...document.querySelectorAll('[role=status]')].map(e=>e.textContent),buttons:[...document.querySelectorAll('button')].map(e=>e.textContent)})",
      ).catch(() => '(unavailable)'),
    );
  }
  throw error;
} finally {
  socket?.close();
  if (approved) {
    try {
      await sql`create or replace function app_private.submission_service_enabled() returns boolean language sql immutable set search_path='' as $$select false$$`;
      await sql`create or replace function app_private.leaderboard_enabled() returns boolean language sql immutable set search_path='' as $$select false$$`;
      // Discover only this fixture's exact paths even if a UI assertion interrupted the flow.
      for (const row of await sql`select object_path from public.submissions where activity_id=${ids.activity}`)
        if (!paths.includes(row.object_path)) paths.push(row.object_path);
      for (const path of paths)
        assert.equal((await admin.storage.from('student-submissions').remove([path])).error, null);
      await sql.begin(async (tx) => {
        await tx`set local session_replication_role=replica`;
        await tx`delete from public.grade_criterion_scores where grade_id in(select id from public.grades where submission_id in(select id from public.submissions where activity_id=${ids.activity}))`;
        await tx`delete from public.grades where submission_id in(select id from public.submissions where activity_id=${ids.activity})`;
        await tx`delete from public.submissions where activity_id=${ids.activity}`;
        await tx`delete from public.rubric_criteria where rubric_id=${ids.rubric}`;
        await tx`delete from public.rubrics where id=${ids.rubric}`;
        await tx`delete from public.activities where id=${ids.activity}`;
        await tx`delete from public.academy_weeks where id=${ids.week}`;
      });
      const all = await admin.auth.admin.listUsers();
      for (const u of all.data.users)
        if (u.email === email && !users.includes(u.id)) users.push(u.id);
      for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    } finally {
      await sql.end();
    }
  } else await sql.end();
}
