/* Isolated headless Chrome regression checks. Never attaches to a personal browser. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = new URL(
  process.env.ACADEMY_BROWSER_OUTPUT ?? '../../docs/ui-redesign/',
  import.meta.url,
);
const origin = process.env.ACADEMY_BROWSER_ORIGIN ?? 'http://127.0.0.1:4174';
const debuggerOrigin = process.env.ACADEMY_BROWSER_DEBUGGER ?? 'http://127.0.0.1:9225';
const captureOnly = process.argv.includes('--screenshots-only');
mkdirSync(new URL('screenshots/', out), { recursive: true });
const targets = await (await fetch(`${debuggerOrigin}/json/list`)).json();
assert.equal(targets.filter((tab) => tab.type === 'page').length, 1);
const ws = new WebSocket(targets.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map(),
  exceptions = [],
  failedLocalRequests = [],
  externalResponses = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown')
    exceptions.push(message.params.exceptionDetails);
  else if (message.method === 'Network.responseReceived') {
    const response = message.params.response;
    if (response.url.startsWith(origin) && response.status >= 400)
      failedLocalRequests.push({ url: response.url, status: response.status });
    if (response.url.includes('drive.google.com'))
      externalResponses.push({ url: response.url, status: response.status });
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await pause(30);
  }
  throw new Error(`Browser state did not settle: ${expression}`);
}
async function settle() {
  await evaluate(
    'Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error("Font loading exceeded 8 seconds")),8000))]).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))',
  );
}
async function load(path) {
  await send('Page.navigate', { url: `${origin}${path}` });
  for (let n = 0; n < 100; n++) {
    await pause(25);
    if (
      await evaluate(
        `location.pathname===${JSON.stringify(path)} && !!document.querySelector('h1')`,
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
  const vk = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40 }[key] || 0;
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
  await pause(30);
}
async function screenshot(name, fullPage = true) {
  // Scroll naturally so lazy portraits and scroll reveals are represented.
  await evaluate('window.scrollTo(0,document.body.scrollHeight)');
  await pause(150);
  await evaluate('window.scrollTo(0,0)');
  await settle();
  const layout = await send('Page.getLayoutMetrics');
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: fullPage,
    ...(fullPage
      ? {
          clip: {
            x: 0,
            y: 0,
            width: Math.max(layout.cssContentSize.width, await evaluate('innerWidth')),
            height: layout.cssContentSize.height,
            scale: 1,
          },
        }
      : {}),
  });
  writeFileSync(new URL(`screenshots/${name}.png`, out), Buffer.from(result.data, 'base64'));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
// This matrix repeatedly tears down documents; avoid reusing cancelled font requests.
await send('Network.setCacheDisabled', { cacheDisabled: true });
// Keep the layout matrix independent of third-party connectivity; test Drive separately below.
await send('Network.setBlockedURLs', { urls: ['https://drive.google.com/*'] });
await send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'light' },
  ],
});
await size(1440);
await load('/');
await evaluate('localStorage.clear()');
await load('/');
const interactions = {};
interactions.defaults = await evaluate(
  'document.documentElement.lang==="ar" && document.documentElement.dir==="rtl" && document.documentElement.dataset.theme==="light"',
);
const routes = ['/', '/about', '/eda', '/videos', '/team', '/join', '/leaderboard', '/contact'];
const checks = [],
  screenshots = [],
  contrastChecks = [];
function contrastAudit() {
  const rgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
  const luminance = (color) =>
    color
      .slice(0, 3)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const failures = [];
  let checked = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode,
      element = node.parentElement;
    if (
      !node.textContent.trim() ||
      !element ||
      element.closest('[aria-hidden=true],script,style') ||
      !element.getClientRects().length
    )
      continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || +style.opacity === 0) continue;
    let ancestor = element,
      background;
    while (ancestor) {
      const color = rgb(getComputedStyle(ancestor).backgroundColor);
      if (color.length === 3 || color[3] === 1) {
        background = color;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!background) continue;
    const levels = [luminance(rgb(style.color)), luminance(background)].sort((a, b) => a - b);
    const ratio = (levels[1] + 0.05) / (levels[0] + 0.05);
    const large =
      parseFloat(style.fontSize) >= 24 ||
      (parseFloat(style.fontSize) >= 18.66 && +style.fontWeight >= 700);
    checked++;
    if (ratio + 0.01 < (large ? 3 : 4.5))
      failures.push({
        text: node.textContent.trim().slice(0, 60),
        ratio: Math.round(ratio * 100) / 100,
        foreground: style.color,
        background,
      });
  }
  return { checked, failures };
}
for (const locale of ['ar', 'en'])
  for (const theme of ['light', 'dark']) {
    await evaluate(
      `localStorage.setItem('ianalyze.language','${locale}');localStorage.setItem('ianalyze.theme','${theme}')`,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await size(width);
      for (const route of routes) {
        const shouldCapture =
          (theme === 'light' &&
            ((locale === 'en' && width === 1440) || (locale === 'ar' && width === 390))) ||
          (theme === 'dark' &&
            ((route === '/' && width === 1440) || (route === '/join' && width === 390)));
        if (captureOnly && !shouldCapture) continue;
        await load(route);
        const result = await evaluate(`(() => {
        const root=document.documentElement;
        const visible=e=>!!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const overflowing=[...document.querySelectorAll('main *,header *,footer *')].filter(e=>visible(e)&&!e.closest('[aria-hidden=true],.curriculum-track')&&getComputedStyle(e).position!=='absolute').filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left < -1 || r.right>innerWidth+1)}).slice(0,5).map(e=>({tag:e.tagName,class:e.className}));
        return {
          title:document.querySelector('h1').textContent,
          oneHeading:document.querySelectorAll('h1').length===1,
          direction:root.lang===${JSON.stringify(locale)}&&root.dir===${JSON.stringify(locale === 'ar' ? 'rtl' : 'ltr')},
          themeApplied:root.dataset.theme===${JSON.stringify(theme)},
          noOverflow:root.scrollWidth<=innerWidth+1,
          overflowing,
          imagesHaveAlt:[...document.images].every(e=>e.hasAttribute('alt')&&(e.alt.trim()||e.getAttribute('aria-hidden')==='true'))&&[...document.querySelectorAll('.theme-logo')].every(e=>e.getAttribute('role')==='img'&&!!e.getAttribute('aria-label')?.trim()),
          noBrokenLoadedImages:[...document.images].every(e=>!e.complete||e.naturalWidth>0),
          noPreviewLinks:![...document.querySelectorAll('a')].some(e=>e.getAttribute('href')?.startsWith('/_preview/')),
          noForms:document.querySelectorAll('form').length===0,
          noMissingTranslations:!/(academy\\.|pages\\.|home\\.)/.test(document.querySelector('main').textContent),
          safeExternalLinks:[...document.querySelectorAll('a[target=_blank]')].every(a=>a.rel.includes('noopener')&&a.rel.includes('noreferrer')),
        };
      })()`);
        checks.push({ locale, theme, width, route, ...result });
        if (width === 1440)
          contrastChecks.push({
            locale,
            theme,
            route,
            ...(await evaluate(`(${contrastAudit.toString()})()`)),
          });
        if (
          theme === 'light' &&
          ((locale === 'en' && width === 1440) || (locale === 'ar' && width === 390))
        ) {
          const name = `${route === '/' ? 'home' : route.slice(1)}-${locale}-${theme}-${width}`;
          await screenshot(name);
          screenshots.push(`${name}.png`);
        }
        if (
          theme === 'dark' &&
          ((route === '/' && width === 1440) || (route === '/join' && width === 390))
        ) {
          const name = `${route === '/' ? 'home' : route.slice(1)}-${locale}-${theme}-${width}`;
          await screenshot(name);
          screenshots.push(`${name}.png`);
        }
      }
    }
  }
console.log(`Layout matrix completed: ${checks.length} cases; ${screenshots.length} screenshots.`);
if (captureOnly) {
  ws.close();
  process.exit(0);
}
await size(1440);
await load('/about');
await evaluate('document.querySelector(".language-switcher button[lang=en]").click()');
await pause(50);
await evaluate('document.querySelector(".header-preferences button[data-slot=button]").click()');
await pause(50);
const savedTheme = await evaluate('document.documentElement.dataset.theme');
await load('/about');
interactions.preferencesPersist = await evaluate(
  `document.documentElement.lang==='en'&&document.documentElement.dir==='ltr'&&document.documentElement.dataset.theme===${JSON.stringify(savedTheme)}`,
);
await evaluate('document.querySelector(".desktop-nav a[href$=eda]").click()');
await waitFor('location.pathname==="/eda"&&document.activeElement.id==="page-title"');
interactions.routeFocus = await evaluate(
  'location.pathname==="/eda"&&document.activeElement.id==="page-title"',
);
await load('/');
await key('Tab');
interactions.skipLinkAndFocusRing = await evaluate(
  'document.activeElement.classList.contains("skip-link")&&getComputedStyle(document.activeElement).outlineStyle!=="none"',
);
await key('Enter');
interactions.skipToMain = await evaluate('document.activeElement.id==="main"');
await size(390);
await load('/');
await evaluate('document.querySelector(".mobile-menu-trigger").focus()');
await key('Enter');
interactions.menuOpens = await evaluate(
  '!!document.querySelector("[role=dialog][aria-modal=true]")&&document.querySelectorAll(".mobile-nav-links a").length===8',
);
let focusContained = true;
for (let n = 0; n < 16; n++) {
  await key('Tab');
  focusContained &&= await evaluate('!!document.activeElement.closest("[role=dialog]")');
}
interactions.menuFocusContained = focusContained;
await key('Escape');
interactions.menuEscapeRestoresFocus = await evaluate(
  '!document.querySelector("[role=dialog]")&&document.activeElement.classList.contains("mobile-menu-trigger")',
);
await key('Enter');
await evaluate('document.querySelector(".mobile-nav-links a[href$=contact]").click()');
await waitFor(
  'location.pathname==="/contact"&&document.querySelectorAll("[data-slot=accordion-trigger]").length===9&&document.activeElement.id==="page-title"',
);
interactions.mobileNavigation = await evaluate(
  'location.pathname==="/contact"&&!document.querySelector("[role=dialog]")&&document.activeElement.id==="page-title"',
);
interactions.faqCount = await evaluate(
  'document.querySelectorAll("[data-slot=accordion-trigger]").length===9',
);
await evaluate('document.querySelector("[data-slot=accordion-trigger]").focus()');
await key('Enter');
interactions.faqKeyboardToggle = await evaluate(
  'document.activeElement.getAttribute("aria-expanded")==="true"&&!!document.getElementById(document.activeElement.getAttribute("aria-controls"))',
);
await key('ArrowDown');
interactions.faqArrowNavigation = await evaluate(
  'document.activeElement===document.querySelectorAll("[data-slot=accordion-trigger]")[1]',
);
await load('/eda');
await evaluate(
  'document.querySelectorAll("[data-slot=accordion-trigger]").forEach(e=>{if(e.getAttribute("aria-expanded")==="false")e.click()})',
);
await pause(50);
interactions.allSyllabusModulesExpand = await evaluate(
  'document.querySelectorAll("[data-slot=accordion-trigger][aria-expanded=true]").length===6&&!!document.querySelector(".buffer-note")',
);
await load('/join');
interactions.disabledRegistration = await evaluate(
  'document.querySelectorAll(".registration-preview input,.registration-preview select").length===8&&[...document.querySelectorAll(".registration-preview input,.registration-preview select,.registration-preview button")].every(e=>e.matches(":disabled"))&&!document.querySelector("form")',
);
interactions.consentAndFields = await evaluate(
  'document.querySelectorAll(".registration-preview input[required],.registration-preview select[required]").length===7&&!!document.querySelector("input[type=tel]")&&!!document.querySelector("input[type=checkbox][required]")',
);
await load('/team');
await evaluate('window.scrollTo(0,document.body.scrollHeight)');
await pause(150);
interactions.confirmedPortraitsLoaded = await evaluate(
  'document.querySelectorAll(".leader-image img").length===2&&[...document.querySelectorAll(".leader-image img")].every(e=>e.complete&&e.naturalWidth>0)',
);
await load('/contact');
interactions.socialLinks = await evaluate(
  '(()=>{const links=[...document.querySelectorAll("a")];return links.filter(a=>a.href==="https://www.instagram.com/iteamzuj/").length===2&&links.filter(a=>a.href==="https://www.linkedin.com/company/iteamzuj/posts/").length===2})()',
);
await load('/');
interactions.reducedMotion = await evaluate(
  '[...document.querySelectorAll(".stagger-enter > *, .data-dots, .academy-button")].every(e=>getComputedStyle(e).animationName==="none"&&getComputedStyle(e).transitionDuration==="0s")',
);
await send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-reduced-motion', value: 'no-preference' },
    { name: 'prefers-color-scheme', value: 'light' },
  ],
});
await load('/');
interactions.normalMotionPresent = await evaluate(
  'getComputedStyle(document.querySelector(".academy-button")).transitionDuration!=="0s"',
);
await send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'light' },
  ],
});
const notFound = JSON.parse(
  readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'),
).error.notFoundTitle;
for (const route of [
  '/_preview/student',
  '/_preview/organizer',
  '/_preview/admin',
  '/_preview/components',
  '/organizer',
  '/admin',
  '/unknown',
]) {
  await load(route);
  interactions[`privateBoundary:${route}`] = await evaluate(
    `document.querySelector('h1').textContent===${JSON.stringify(notFound)}&&!document.querySelector('.dashboard-shell')`,
  );
}
await send('Page.navigate', { url: `${origin}/student` });
await waitFor("location.pathname==='/login'&&!!document.querySelector('#page-title')");
interactions.studentBoundary = await evaluate(
  "!document.querySelector('.portal-grid')&&!document.querySelector('input[name=password]')",
);
const injection = await send('Page.addScriptToEvaluateOnNewDocument', {
  source:
    "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})",
});
await load('/');
interactions.blockedStorageFallback = await evaluate(
  'document.documentElement.lang==="ar"&&document.documentElement.dataset.theme==="light"&&!!document.querySelector(".hero")',
);
await evaluate('document.querySelector(".language-switcher button[lang=en]").click()');
await pause(50);
interactions.blockedStorageSwitch = await evaluate('document.documentElement.lang==="en"');
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
await load('/');

// New presentation interactions: RTL switching, keyboard controls and touch drag.
await size(390);
await evaluate(
  "localStorage.setItem('ianalyze.language','en');localStorage.setItem('ianalyze.theme','light')",
);
await load('/');
await evaluate("document.querySelector('.carousel-controls button:last-child').focus()");
await key('Enter');
interactions.carouselKeyboardNext = await evaluate(
  "document.querySelector('.carousel-status').textContent==='Module 2 of 6'",
);
await evaluate("document.querySelector('.carousel-controls button:first-child').click()");
interactions.carouselPrevious = await evaluate(
  "document.querySelector('.carousel-status').textContent==='Module 1 of 6'",
);
await evaluate("document.querySelectorAll('[data-slide] a')[5].focus()");
interactions.carouselFocusRevealsSlide = await evaluate(
  "(()=>{const r=document.activeElement.getBoundingClientRect();const v=document.querySelector('.curriculum-viewport').getBoundingClientRect();return r.left>=v.left-1&&r.right<=v.right+1})()",
);
await evaluate("document.querySelectorAll('[data-slide] a')[0].focus()");
const drag = await evaluate(
  "(()=>{document.querySelector('.curriculum-viewport').scrollIntoView({block:'center'});const r=document.querySelector('.curriculum-viewport').getBoundingClientRect();return {x:r.right-30,y:r.top+r.height/2}})()",
);
await send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ x: drag.x, y: drag.y }],
});
for (let n = 1; n <= 8; n++) {
  await send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: drag.x - n * 30, y: drag.y }],
  });
  await pause(16);
}
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await pause(400);
interactions.carouselTouchDrag = await evaluate(
  "document.querySelector('.carousel-status').textContent!=='Module 1 of 6'",
);
await evaluate("document.querySelector('.mobile-menu-trigger').click()");
await evaluate(
  "document.querySelector('[role=dialog] .language-switcher button[lang=ar]').click()",
);
await key('Escape');
await pause(100);
await evaluate("document.querySelectorAll('[data-slide] a')[0].focus()");
await evaluate("document.querySelector('.carousel-controls button:last-child').click()");
interactions.carouselLiveRtlSwitch = await evaluate(
  "document.documentElement.dir==='rtl'&&document.querySelector('.carousel-status').textContent==='الوحدة 2 من 6'",
);
await evaluate("document.querySelectorAll('[data-slide] a')[1].click()");
await waitFor("location.pathname==='/eda'&&document.activeElement.id==='weekly-modules'");
interactions.curriculumAnchor = await evaluate(
  "location.pathname==='/eda'&&location.hash==='#weekly-modules'&&document.activeElement.id==='weekly-modules'&&document.querySelector('#weekly-modules').getBoundingClientRect().top>=70",
);
await send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-color-scheme', value: 'dark' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ],
});
await evaluate('localStorage.clear()');
await load('/');
interactions.systemDarkFallback = await evaluate("document.documentElement.dataset.theme==='dark'");
await evaluate("localStorage.setItem('ianalyze.theme','light')");
await load('/');
interactions.savedThemeOverridesSystem = await evaluate(
  "document.documentElement.dataset.theme==='light'",
);
await send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-color-scheme', value: 'light' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ],
});

// A real external embed attempt, with no authentication or download.
await send('Network.setBlockedURLs', { urls: [] });
await size(1440);
await load('/videos');
interactions.iframeContract = await evaluate(
  '(()=>{const f=document.querySelector("iframe");const r=f.getBoundingClientRect();return f.src==="https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/preview"&&f.loading==="lazy"&&f.allowFullscreen&&!!f.title&&Math.abs(r.width/r.height-16/9)<.01})()',
);
await pause(5000);
const frames = await send('Page.getFrameTree');
const targetInfo = await send('Target.getTargets');
const playerSessions = [];
for (const target of targetInfo.targetInfos.filter((t) => t.type === 'iframe')) {
  const attached = await send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });
  playerSessions.push({ url: target.url, sessionId: attached.sessionId });
}
let playControlFound = false;
for (const player of playerSessions.filter((p) => p.url.startsWith('https://drive.google.com/'))) {
  const click = await send(
    'Runtime.evaluate',
    {
      expression: `(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')?.endsWith(': k')&&e.offsetWidth>0);if(b){b.click();return true}return false})()`,
      returnByValue: true,
      userGesture: true,
    },
    player.sessionId,
  );
  playControlFound ||= click.result.value === true;
}
let playback = [];
for (let attempt = 0; attempt < 10; attempt++) {
  await pause(1000);
  playback = [];
  for (const player of playerSessions) {
    const state = await send(
      'Runtime.evaluate',
      {
        expression: `[...document.querySelectorAll('video')].map(v=>({readyState:v.readyState,paused:v.paused,currentTime:v.currentTime,videoWidth:v.videoWidth,error:v.error?.code}))`,
        returnByValue: true,
      },
      player.sessionId,
    );
    if (state.result?.value) playback.push(...state.result.value);
  }
  if (playback.some((v) => !v.paused && v.currentTime > 1 && v.readyState >= 2 && v.videoWidth > 0))
    break;
}
await screenshot('video-embed-attempt', false);
const videoAttempt = {
  responses: externalResponses,
  frames: frames.frameTree.childFrames?.map((f) => ({
    url: f.frame.url,
    unreachableUrl: f.frame.unreachableUrl,
  })),
  screenshot: 'video-embed-attempt.png',
  playControlFound,
  playback,
  playbackVerified: playback.some(
    (v) => !v.paused && v.currentTime > 1 && v.readyState >= 2 && v.videoWidth > 0,
  ),
};
const results = {
  date: '2026-11-02',
  origin,
  checks,
  contrastChecks,
  interactions,
  exceptions,
  failedLocalRequests,
  screenshots,
  videoAttempt,
};
writeFileSync(new URL('browser-results.json', out), JSON.stringify(results, null, 2) + '\n');
const failed = checks.filter(
  (c) =>
    !c.oneHeading ||
    !c.direction ||
    !c.themeApplied ||
    !c.noOverflow ||
    !c.imagesHaveAlt ||
    !c.noBrokenLoadedImages ||
    !c.noPreviewLinks ||
    !c.noForms ||
    !c.noMissingTranslations ||
    !c.safeExternalLinks,
);
const failedInteractions = Object.entries(interactions).filter(([, value]) => !value);
const contrastFailures = contrastChecks.filter((c) => c.failures.length);
console.log(
  JSON.stringify(
    {
      cases: checks.length,
      failed,
      failedInteractions,
      contrastFailures,
      exceptions,
      failedLocalRequests,
      videoAttempt,
    },
    null,
    2,
  ),
);
ws.close();
if (
  failed.length ||
  failedInteractions.length ||
  exceptions.length ||
  failedLocalRequests.length ||
  contrastFailures.length
)
  process.exitCode = 1;
