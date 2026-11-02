// Reuse the unchanged Phase 03 public regression suite against the deployed candidate.
// Only the dedicated isolated Chrome test profile on 9237 is used.
import { readFileSync, writeFileSync } from 'node:fs';

let source = readFileSync(new URL('./phase-03-browser-qa.mjs', import.meta.url), 'utf8');
source = source
  .replace(
    "const origin = 'http://127.0.0.1:4177';",
    "const origin = 'https://ianalyze-academy.pages.dev';",
  )
  .replace('phase-03-browser.json', 'pages-live-browser.json');
const extra = String.raw`
  // Exercise real language controls and desktop/mobile navigation, not just storage.
  async function until(expression, message) {
    for (let n = 0; n < 200; n++) {
      if (await evaluate('Boolean('+expression+')')) return;
      await pause(30);
    }
    throw new Error(message);
  }
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await load('/');
  await evaluate('document.querySelector(\'.language-switcher button[lang="ar"]\').click()');
  await until('document.documentElement.lang==="ar" && document.documentElement.dir==="rtl"','Arabic switch failed');
  await evaluate('document.querySelector(\'.desktop-nav a[href="/about"]\').click()');
  await until('location.pathname==="/about" && document.querySelector("h1")','Desktop Arabic navigation failed');
  await evaluate('document.querySelector(\'.language-switcher button[lang="en"]\').click()');
  await until('document.documentElement.lang==="en" && document.documentElement.dir==="ltr"','English switch failed');
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:1000,deviceScaleFactor:1,mobile:true});
  await evaluate('document.querySelector(".mobile-menu-trigger").click()');
  await until('Boolean(document.querySelector(".mobile-dialog"))','Mobile dialog did not open');
  await evaluate('document.querySelector(\'.mobile-nav-links a[href="/videos"]\').click()');
  await until('location.pathname==="/videos" && !document.querySelector(".mobile-dialog")','Mobile English navigation failed');
  await evaluate('document.querySelector(\'.language-switcher button[lang="ar"]\').click()');
  await until('document.documentElement.lang==="ar" && document.documentElement.dir==="rtl"','Mobile Arabic switch failed');
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+2'),false);
  for (const path of ['/login','/auth/recover']) {
    await load(path);
    assert.equal(await evaluate('document.querySelectorAll("form,input[type=email],input[type=password],input[type=file]").length'),0);
  }
  for (const path of ['/student','/workspace','/auth/reset']) {
    await send('Page.navigate',{url:origin+path});
    await until('location.pathname==="/login" && Boolean(document.querySelector("h1"))','Private portal was not guarded: '+path);
    assert.equal(await evaluate('document.querySelectorAll("form,input[type=file],.portal-table").length'),0);
  }
  await load('/leaderboard');
  assert.equal(await evaluate('document.querySelectorAll(".ranking-panel tbody tr").length'),1);
  await load('/join');
  assert.equal(await evaluate('document.querySelector("fieldset").disabled'),true);
  assert.equal(await evaluate('document.querySelectorAll("input[type=file]").length'),0);
  await load('/_preview/');
  assert.equal(await evaluate('document.querySelectorAll("form,input[type=file]").length'),0);
  await load('/privacy');
  assert.equal(await evaluate('document.querySelector(".portal-page")===null'),true);
  // Leave a representative public page in each capture; never a private record.
  await load('/');
  await evaluate('document.fonts.ready.then(()=>true)');
  const mobileShot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(new URL('../artifacts/pages-live-mobile-ar.png',import.meta.url),Buffer.from(mobileShot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate('document.querySelector(\'.language-switcher button[lang="en"]\').click()');
  await until('document.documentElement.lang==="en"','Desktop capture locale failed');
  const desktopShot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(new URL('../artifacts/pages-live-desktop-en.png',import.meta.url),Buffer.from(desktopShot.data,'base64'));
  console.log('Live controls passed: Arabic/English, desktop/mobile navigation, disabled forms, guarded private dashboards, placeholder rankings and no development preview.');
`;
const marker = "  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });";
if (
  !source.includes(marker) ||
  !source.includes("const origin = 'https://ianalyze-academy.pages.dev';")
)
  throw new Error('Public regression harness changed; review adaptation before running.');
source = source.replace(marker, extra + '\n' + marker);
const runner = new URL('../artifacts/pages-live-browser-runner.mjs', import.meta.url);
writeFileSync(runner, source);
await import(runner.href);
