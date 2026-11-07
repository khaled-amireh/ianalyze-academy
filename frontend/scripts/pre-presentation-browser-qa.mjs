// Local production-mode browser regression suite. Never accepts a hosted target.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { browser, pause, save } from './pre-presentation-browser-client.mjs';

const argument = (name, fallback) =>
  process.argv
    .find((s) => s.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') || fallback;
const origin = argument('origin', 'http://127.0.0.1:4193');
const engine = argument('engine', 'chrome');
const part = argument('part', 'matrix');
assert.ok(['matrix', 'video', 'stability', 'accessibility', 'navigation', 'fonts'].includes(part));
const target = new URL(origin);
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && target.protocol === 'http:');
assert.ok(
  !target.username && !target.password && target.pathname === '/' && !target.search && !target.hash,
);
assert.ok(['chrome', 'edge'].includes(engine));
const axePath = part === 'accessibility' ? argument('axe', '') : '';
if (part === 'accessibility')
  assert.ok(axePath && existsSync(axePath), 'Provide --axe=<path-to-axe-core-4.11.0/axe.min.js>');
const b = await browser(
  engine,
  (engine === 'chrome' ? 9270 : 9280) +
    ({ matrix: 0, video: 1, stability: 2, accessibility: 3, navigation: 4 }[part] ?? 5),
);
const widths = [320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920];
const routes = [
  '/',
  '/eda',
  '/about',
  '/ai-tools',
  '/ai-tools/google-colab',
  '/ai-tools/python',
  '/ai-tools/vscode',
  '/ai-tools/kaggle',
  '/ai-tools/power-bi',
  '/videos',
  '/join',
  '/login',
  '/auth/recover',
  '/contact',
  '/leaderboard',
  '/privacy',
  '/audit-invalid-url',
  '/ai-tools/invalid-tool',
  '/team',
  '/student',
  '/workspace',
  '/profile',
  '/profile/edit',
  '/notifications',
  '/auth/reset',
  '/auth/callback',
  '/_preview/components',
  '/admin',
  '/organizer',
];
const result = {
  engine,
  part,
  origin,
  version: b.version,
  checks: [],
  layouts: [],
  failures: [],
  providerNotes: [],
};
const slowNetwork = part === 'stability' && argument('throttle', 'routes') === 'network';
const file = `browser-${engine}-${part}${slowNetwork ? '-network' : ''}.json`;
const check = async (name, action) => {
  try {
    const detail = await action();
    result.checks.push({ name, passed: true, detail });
  } catch (e) {
    result.checks.push({ name, passed: false, error: e.message });
    result.failures.push({ name, error: e.stack });
  } finally {
    if (part === 'video') {
      try {
        if (await b.ev("!!document.querySelector('.drive-video:modal')")) {
          await b.ev("document.querySelector('.drive-video-toolbar button').click();true");
          await b.wait("!document.querySelector('.drive-video:modal')");
        }
      } catch {
        // Keep the original assertion failure; the next case reloads if necessary.
      }
    }
  }
  save(file, result);
};
const preferences = async (lang, theme) =>
  b.ev(
    `localStorage.setItem('ianalyze.language','${lang}');localStorage.setItem('ianalyze.theme','${theme}');true`,
  );
const dimensions = `(()=>{const root=document.documentElement;return {path:location.pathname,lang:root.lang,dir:root.dir,theme:root.dataset.theme,width:innerWidth,height:innerHeight,scrollWidth:root.scrollWidth,overflow:root.scrollWidth>innerWidth+1,h1:document.querySelector('h1')?.textContent,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth&&getComputedStyle(i).display!=='none').map(i=>i.src),weeklyPlan:!!document.querySelector('#weekly-modules')}})()`;
const team = `(()=>{const issues=[],targets=[];for(const p of document.querySelectorAll('.s-person')){const a=p.querySelector('a'),ar=a.getBoundingClientRect();targets.push({width:ar.width,height:ar.height});for(const e of p.querySelectorAll('strong,span')){const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);for(const t of r.getClientRects()){if(Math.min(t.right,ar.right)-Math.max(t.left,ar.left)>1&&Math.min(t.bottom,ar.bottom)-Math.max(t.top,ar.top)>1)issues.push({name:p.querySelector('strong').textContent,tag:e.tagName});}}}}return {issues,targets}})()`;
const assertLayout = (row) => {
  assert.equal(row.overflow, false, JSON.stringify(row));
  assert.deepEqual(row.broken, []);
  assert.equal(row.weeklyPlan, false);
};
const iframeState = `(()=>{const d=document.querySelector('.drive-video'),i=d.querySelector('iframe'),r=i.getBoundingClientRect();return {modal:d.matches(':modal'),fullscreen:!!document.fullscreenElement,same:window.auditFrame===i&&window.auditWindow===i.contentWindow,count:document.querySelectorAll('.drive-video iframe').length,src:i.src,focus:document.activeElement===d.querySelector('button'),box:{x:r.x,y:r.y,w:r.width,h:r.height},viewport:{w:innerWidth,h:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth+1}})()`;
try {
  await b.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await b.load(origin + '/');
  if (part === 'matrix') {
    for (const path of routes) {
      await check('responsive ' + path, async () => {
        for (const lang of ['ar', 'en'])
          for (const theme of ['light', 'dark']) {
            await preferences(lang, theme);
            await b.load(origin + path);
            for (const width of widths) {
              await b.size(width, width < 500 ? 844 : 1000);
              await b.ev('scrollTo(0,0)');
              const row = {
                requested: path,
                lang,
                theme,
                requestedWidth: width,
                ...(await b.ev(dimensions)),
              };
              result.layouts.push(row);
              assertLayout(row);
              if (['/', '/about'].includes(path)) {
                const geometry = await b.ev(team);
                assert.deepEqual(
                  geometry.issues,
                  [],
                  JSON.stringify({ path, width, lang, geometry }),
                );
                if (width <= 640)
                  assert.ok(geometry.targets.every((r) => r.width >= 44 && r.height >= 44));
                row.team = geometry;
              }
              if (
                ([320, 390].includes(width) && ['/', '/about'].includes(path)) ||
                (width === 390 && path === '/videos')
              ) {
                await b.shot(
                  `fixed-${engine}-${path === '/' ? 'home' : path.slice(1)}-${lang}-${theme}-${width}.png`,
                  true,
                );
              }
            }
          }
        await b.send('Page.reload');
        await pause(100);
        await b.wait("document.readyState==='complete'&&!!document.querySelector('h1')");
        return { observations: 44, refreshPath: await b.ev('location.pathname') };
      });
      console.log(`${engine} ${path} ${result.layouts.length}`);
    }
    await check('landscape layouts', async () => {
      for (const [width, height] of [
        [844, 390],
        [1024, 768],
        [1180, 820],
      ])
        for (const lang of ['ar', 'en'])
          for (const theme of ['light', 'dark'])
            for (const path of ['/', '/about', '/ai-tools', '/videos', '/join']) {
              await preferences(lang, theme);
              await b.size(width, height);
              await b.load(origin + path);
              const row = {
                requested: path,
                lang,
                theme,
                orientation: 'landscape',
                ...(await b.ev(dimensions)),
              };
              result.layouts.push(row);
              assertLayout(row);
            }
      return { observations: 60 };
    });
    await check('long names do not collide on mobile', async () => {
      for (const lang of ['ar', 'en'])
        for (const width of [320, 360, 375, 390, 430]) {
          await preferences(lang, 'light');
          await b.size(width, 844);
          await b.load(origin + '/about');
          await b.ev(
            `document.querySelectorAll('.s-person strong').forEach(e=>e.textContent='Alexandria Ahmad Al-Abdullah LongFamilyNameWithoutSpaces');true`,
          );
          assert.deepEqual((await b.ev(team)).issues, []);
          assertLayout(await b.ev(dimensions));
        }
      return { cases: 10 };
    });
  }
  if (part === 'stability') {
    await b.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.auditShifts=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.auditShifts.push({value:e.value,time:e.startTime,sources:e.sources.map(s=>({tag:s.node?.tagName,cls:String(s.node?.className)}))})}).observe({type:'layout-shift',buffered:true});`,
    });
    b.listeners.push((m) => {
      if (m.method === 'Fetch.requestPaused')
        void (async () => {
          await pause(1200);
          await b.send('Fetch.continueRequest', { requestId: m.params.requestId });
        })().catch(() => {});
    });
    await b.send('Fetch.enable', {
      patterns: [
        { urlPattern: '*ai-tools-page*.js' },
        { urlPattern: '*about-page*.js' },
        { urlPattern: '*syllabus-page*.js' },
      ],
    });
    await b.send('Network.setCacheDisabled', { cacheDisabled: true });
    await b.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (slowNetwork)
      await b.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 93750,
      });
    for (const path of ['/ai-tools', '/about', '/eda'])
      for (const lang of ['ar', 'en'])
        for (const theme of ['light', 'dark'])
          for (const width of slowNetwork
            ? [390]
            : [320, 360, 375, 390, 430, 768, 1024, 1440, 1920]) {
            await check(`stability ${path} ${lang} ${theme} ${width}`, async () => {
              await preferences(lang, theme);
              await b.size(width, width < 500 ? 844 : 1000);
              await b.send('Network.clearBrowserCache');
              await b.load(origin + path);
              await pause(800);
              const row = {
                path,
                lang,
                theme,
                width,
                ...(await b.ev(
                  '({cls:window.auditShifts.reduce((s,e)=>s+e.value,0),shifts:window.auditShifts})',
                )),
              };
              result.layouts.push(row);
              assert.ok(row.cls < 0.1, JSON.stringify(row));
              return row.cls;
            });
          }
  }
  if (part === 'video') {
    for (const lang of ['ar', 'en'])
      for (const theme of ['light', 'dark']) {
        await preferences(lang, theme);
        await b.size(1440, 1000);
        await b.load(origin + '/videos');
        await b.ev(
          `void(window.auditFrame=document.querySelector('.drive-video iframe'));void(window.auditWindow=window.auditFrame.contentWindow);void(window.auditFullscreen=Element.prototype.requestFullscreen)`,
        );
        const kaggle = await b.ev("document.querySelector('#kaggle').outerHTML");
        for (const [width, height] of [
          ...widths.map((w) => [w, w < 500 ? 844 : 1000]),
          [844, 390],
          [1024, 768],
        ])
          for (const mode of ['native', 'denied', 'unavailable']) {
            await check(`video ${lang} ${theme} ${width}x${height} ${mode}`, async () => {
              await b.size(width, height);
              await b.ev(
                mode === 'native'
                  ? `void(Element.prototype.requestFullscreen=window.auditFullscreen)`
                  : mode === 'denied'
                    ? `void(Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Synthetic API denial')))`
                    : `void(Element.prototype.requestFullscreen=undefined)`,
              );
              await b.click('.drive-video-expand');
              await b.wait("document.querySelector('.drive-video').matches(':modal')");
              await pause(80);
              const state = await b.ev(iframeState);
              assert.ok(
                state.same && state.modal && state.count === 1 && state.focus,
                JSON.stringify(state),
              );
              assert.equal(state.overflow, false);
              if (mode === 'native' && (await b.ev('document.fullscreenEnabled')))
                assert.ok(state.fullscreen);
              else assert.equal(state.fullscreen, false);
              assert.ok(Math.abs(state.box.w / state.box.h - 16 / 9) < 0.03, JSON.stringify(state));
              assert.ok(
                state.box.x >= -1 &&
                  state.box.y >= -1 &&
                  state.box.x + state.box.w <= state.viewport.w + 1 &&
                  state.box.y + state.box.h <= state.viewport.h + 1,
              );
              if ([320, 390, 768, 1440].includes(width) && mode !== 'unavailable')
                await b.shot(`video-${engine}-${lang}-${theme}-${width}-${height}-${mode}.png`);
              await b.key('Tab', true);
              assert.ok(await b.ev("!!document.activeElement.closest('.drive-video')"));
              await b.key('Tab');
              if (mode === 'denied') {
                // Google may consume keys inside its cross-origin frame. Test our Escape
                // handling with focus in the app's own controls, without modifying Google.
                await b.ev("document.querySelector('.drive-video-toolbar button').focus()");
                await b.key('Escape');
              } else await b.click('.drive-video-toolbar button');
              await b.wait(
                "!document.querySelector('.drive-video').matches(':modal')&&!document.fullscreenElement",
              );
              await b.wait("document.activeElement.classList.contains('drive-video-expand')");
              assert.ok(
                await b.ev(
                  "window.auditFrame===document.querySelector('.drive-video iframe')&&window.auditWindow===window.auditFrame.contentWindow",
                ),
              );
              assert.equal(await b.ev("document.querySelector('#kaggle').outerHTML"), kaggle);
              return state;
            });
          }
        await b.ev('void(Element.prototype.requestFullscreen=window.auditFullscreen)');
      }
    await check('native fullscreen Escape closes and restores focus', async () => {
      await b.size(390, 844);
      await b.click('.drive-video-expand');
      await b.wait('!!document.fullscreenElement');
      await b.key('Escape');
      await b.wait("!document.querySelector('.drive-video').matches(':modal')");
      assert.ok(await b.ev("document.activeElement.classList.contains('drive-video-expand')"));
      return true;
    });
    await check('Android Chrome user-agent and touch emulation fallback', async () => {
      await b.send('Emulation.setUserAgentOverride', {
        userAgent:
          'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36',
        platform: 'Android',
      });
      await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await b.size(390, 844);
      await b.load(origin + '/videos');
      await b.ev('void(Element.prototype.requestFullscreen=undefined)');
      await b.click('.drive-video-expand');
      await b.wait("document.querySelector('.drive-video').matches(':modal')");
      await b.shot(`video-${engine}-android-emulation.png`);
      assert.equal((await b.ev(dimensions)).overflow, false);
      await b.click('.drive-video-toolbar button');
      return { emulationOnly: true, realAndroid: false, realIOS: false };
    });
  }
  if (part === 'fonts') {
    for (const lang of ['ar', 'en'])
      for (const theme of ['light', 'dark'])
        await check(`same-origin fonts ${lang} ${theme}`, async () => {
          await preferences(lang, theme);
          await b.size(390, 844);
          await b.load(origin + '/');
          const loaded = await b.ev(`Promise.all([
            document.fonts.load('400 16px "Manrope Variable"','iAnalyze'),
            document.fonts.load('400 16px "Manrope Variable"','\u0460'),
            document.fonts.load('400 16px "IBM Plex Sans Arabic"','العربية')
          ]).then(groups=>groups.map(g=>g.map(f=>({family:f.family,status:f.status,weight:f.weight}))))`);
          assert.ok(loaded.every((g) => g.length > 0 && g.every((f) => f.status === 'loaded')));
          return loaded;
        });
    assert.ok(
      b.events.some(
        (e) =>
          e.method === 'Network.responseReceived' &&
          e.params.response.url.includes('manrope-cyrillic-ext-wght-normal') &&
          e.params.response.status === 200,
      ),
      'The originally blocked font must be served successfully',
    );
  }
  if (part === 'navigation') {
    await check('desktop navigation and focus', async () => {
      await preferences('en', 'light');
      await b.size(1440, 1000);
      await b.load(origin + '/');
      for (const path of ['/eda', '/about', '/ai-tools', '/videos', '/']) {
        await b.click(`.desktop-nav a[href="${path}"]`);
        await pause(100);
        assert.equal(await b.ev('location.pathname'), path);
        assert.equal(await b.ev('document.activeElement.id'), 'page-title');
      }
      return { links: 5 };
    });
    await check('mobile menu selection, preferences, focus and Escape', async () => {
      let count = 0;
      for (const width of [320, 390, 820, 1024])
        for (const lang of ['ar', 'en'])
          for (const theme of ['light', 'dark']) {
            await preferences(lang, theme);
            await b.size(width, width === 820 ? 390 : 844);
            await b.load(origin + '/');
            await b.click('.mobile-menu-trigger');
            const hrefs = await b.ev(
              "[...document.querySelectorAll('.mobile-nav-links a')].map(a=>a.getAttribute('href'))",
            );
            for (let i = 0; i < 20; i++) {
              await b.key('Tab');
              assert.ok(await b.ev("!!document.activeElement.closest('.mobile-dialog')"));
            }
            await b.key('Escape');
            assert.ok(
              await b.ev("document.activeElement.classList.contains('mobile-menu-trigger')"),
            );
            for (const path of hrefs) {
              await b.click('.mobile-menu-trigger');
              await b.click(`.mobile-nav-links a[href="${path}"]`);
              await pause(100);
              assert.equal(await b.ev('location.pathname'), path);
              assert.ok(await b.ev("!document.querySelector('.mobile-dialog')"));
              count++;
            }
          }
      return { selections: count };
    });
    await check('footer navigation and guide links', async () => {
      let count = 0;
      await b.size(1440, 1000);
      for (const lang of ['ar', 'en']) {
        await preferences(lang, 'light');
        await b.load(origin + '/');
        const hrefs = await b.ev(
          "[...document.querySelectorAll('footer a[href^=\"/\"]')].map(a=>a.getAttribute('href'))",
        );
        for (const path of hrefs) {
          await b.load(origin + '/');
          await b.click(`footer a[href="${path}"]`);
          await pause(100);
          assert.equal(await b.ev('location.pathname'), path);
          count++;
        }
        for (const id of ['google-colab', 'python', 'vscode', 'kaggle', 'power-bi']) {
          await b.load(origin + '/ai-tools');
          await b.click(`main a[href="/ai-tools/${id}"]`);
          await pause(100);
          assert.equal(await b.ev('location.pathname'), '/ai-tools/' + id);
          assert.ok(
            await b.ev(
              "[...document.querySelectorAll('.guide-steps li')].every(e=>e.textContent.trim())",
            ),
          );
          await b.click('main a[href="/ai-tools"]');
          assert.equal(await b.ev('location.pathname'), '/ai-tools');
        }
      }
      return { footerSelections: count, guideRoundTrips: 10 };
    });
    await check('FAQ keyboard expansion and skip link', async () => {
      let count = 0;
      for (const lang of ['ar', 'en'])
        for (const path of ['/', '/contact']) {
          await preferences(lang, 'light');
          await b.load(origin + path);
          const n = await b.ev("document.querySelectorAll('main button[aria-expanded]').length");
          for (let i = 0; i < n; i++) {
            await b.ev(`document.querySelectorAll('main button[aria-expanded]')[${i}].focus()`);
            await b.key('Enter');
            await b.wait(
              `document.querySelectorAll('main button[aria-expanded]')[${i}].getAttribute('aria-expanded')==='true'`,
            );
            await b.key('Enter');
            await b.wait(
              `document.querySelectorAll('main button[aria-expanded]')[${i}].getAttribute('aria-expanded')==='false'`,
            );
            count++;
          }
        }
      await b.load(origin + '/');
      await b.key('Tab');
      assert.equal(await b.ev('document.activeElement.getAttribute("href")'), '#main');
      await b.key('Enter');
      assert.equal(await b.ev('document.activeElement.id'), 'main');
      return { faqItems: count };
    });
    await check(
      'language/theme controls retain physical positions and avoid page transitions',
      async () => {
        const positions = [];
        const geometry =
          "['.brand-logo','.header-actions','.mobile-menu-trigger'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})";
        const animations =
          "document.getAnimations().filter(a=>String(a.effect?.target?.className).includes('page-transition'))";
        for (const width of widths) {
          await b.size(width, 900);
          await preferences('ar', 'light');
          await b.load(origin + '/about');
          const before = await b.ev(geometry);
          if (width < 1280) {
            await b.click('.mobile-menu-trigger');
            await b.click('.mobile-preferences [lang=en]');
            await b.click('.mobile-preferences .theme-toggle');
            await b.key('Escape');
          } else {
            await b.click('header [lang=en]');
            await b.click('header .theme-toggle');
          }
          const after = await b.ev(geometry);
          assert.deepEqual(after, before);
          assert.equal(await b.ev(animations + '.length'), 0);
          assert.equal(await b.ev('document.documentElement.lang'), 'en');
          assert.equal(await b.ev('document.documentElement.dataset.theme'), 'dark');
          positions.push({ width, before, after });
        }
        await b.load(origin + '/about');
        assert.equal(await b.ev('document.documentElement.lang'), 'en');
        assert.equal(await b.ev('document.documentElement.dataset.theme'), 'dark');
        return positions;
      },
    );
    await check(
      '800ms transition, immediate authentication, back/forward and reduced motion',
      async () => {
        await b.size(1440, 1000);
        await b.load(origin + '/about');
        await b.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
        });
        const animations =
          "document.getAnimations().filter(a=>String(a.effect?.target?.className).includes('page-transition'))";
        await b.click('.desktop-nav a[href="/ai-tools"]');
        const timings = await b.ev(animations + '.map(a=>a.effect.getTiming().duration)');
        assert.equal(timings.length, 3);
        assert.ok(timings.every((t) => t === 800));
        await pause(850);
        assert.equal(await b.ev(animations + '.length'), 0);
        await b.ev('history.back()');
        await pause(850);
        assert.equal(await b.ev('location.pathname'), '/about');
        await b.ev('history.forward()');
        await pause(850);
        assert.equal(await b.ev('location.pathname'), '/ai-tools');
        await b.click('header a[href="/login"]');
        assert.equal(await b.ev(animations + '.length'), 0);
        await b.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        });
        await b.load(origin + '/about');
        await b.click('.desktop-nav a[href="/eda"]');
        assert.equal(await b.ev(animations + '.length'), 0);
        assert.equal(
          await b.ev(
            "getComputedStyle(document.querySelector('.page-transition-overlay')).display",
          ),
          'none',
        );
        return { timings };
      },
    );
    await check('Kaggle card markup is identical to latest-main baseline', async () => {
      const baseline = argument('baseline', 'http://127.0.0.1:4192');
      assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseline).hostname));
      const rows = [];
      for (const lang of ['ar', 'en'])
        for (const theme of ['light', 'dark']) {
          await b.load(baseline + '/');
          await preferences(lang, theme);
          await b.load(baseline + '/videos');
          const before = await b.ev("document.querySelector('#kaggle').outerHTML");
          await b.load(origin + '/');
          await preferences(lang, theme);
          await b.load(origin + '/videos');
          assert.equal(await b.ev("document.querySelector('#kaggle').outerHTML"), before);
          assert.equal(
            await b.ev("document.querySelectorAll('#kaggle .drive-video-expand').length"),
            0,
          );
          rows.push({ lang, theme, identical: true });
        }
      return rows;
    });
  }
  if (part === 'accessibility') {
    const axe = readFileSync(axePath, 'utf8');
    for (const lang of ['ar', 'en'])
      for (const theme of ['light', 'dark'])
        for (const path of routes.slice(0, 17))
          await check(`axe ${path} ${lang} ${theme}`, async () => {
            await preferences(lang, theme);
            await b.size(lang === 'ar' ? 390 : 1440, 1000);
            await b.load(origin + path);
            await b.ev(axe);
            const r = await b.ev(
              `axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}}).then(r=>({violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length,incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))}))`,
            );
            result.layouts.push({ path, lang, theme, ...r });
            assert.deepEqual(
              r.violations.filter(
                (v) =>
                  !(
                    path === '/leaderboard' &&
                    v.id === 'color-contrast' &&
                    v.nodes.every((n) => n.target.join().includes('podium-number'))
                  ),
              ),
              [],
            );
            return { violations: r.violations.length };
          });
    for (const lang of ['ar', 'en'])
      for (const theme of ['light', 'dark'])
        for (const width of [320, 390, 1440])
          await check(`axe expanded ${lang} ${theme} ${width}`, async () => {
            await preferences(lang, theme);
            await b.size(width, 844);
            await b.load(origin + '/videos');
            await b.ev('void(Element.prototype.requestFullscreen=undefined)');
            await b.click('.drive-video-expand');
            await b.ev(axe);
            const r = await b.ev(
              `axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})))`,
            );
            result.layouts.push({ lang, theme, width, expanded: true, violations: r });
            assert.deepEqual(r, []);
            await b.click('.drive-video-toolbar button');
            return true;
          });
  }
} finally {
  const network = b.events.filter(
    (e) =>
      e.method !== 'Network.responseReceived' ||
      e.params.response.status >= 400 ||
      e.params.type === 'Font',
  );
  const applicationErrors = network.filter(
    (e) =>
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Network.responseReceived' &&
        e.params.response.url.startsWith(origin) &&
        e.params.response.status >= 400) ||
      (e.method === 'Log.entryAdded' &&
        e.params.entry.level === 'error' &&
        e.params.entry.url?.startsWith(origin)),
  );
  if (applicationErrors.length)
    result.failures.push({ name: 'application browser errors', errors: applicationErrors });
  result.passed = result.failures.length === 0;
  save(file, result);
  save(file.replace(/\.json$/, '-events.json'), network);
  await b.close();
}
console.log(
  JSON.stringify({
    engine,
    part,
    passed: result.passed,
    checks: result.checks.length,
    observations: result.layouts.length,
    failures: result.failures.map((f) => ({ name: f.name, error: f.error?.slice(0, 180) })),
  }),
);
if (!result.passed) process.exitCode = 1;
