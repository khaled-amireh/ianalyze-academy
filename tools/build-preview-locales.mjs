import { readFileSync, writeFileSync } from 'node:fs';
const base = new URL('../design-preview/', import.meta.url);
const locales = Object.fromEntries(['ar','en'].map(lang => [lang, JSON.parse(readFileSync(new URL(`locales/${lang}.json`,base),'utf8'))]));
writeFileSync(new URL('locales.js',base), `/* Generated from locales/ar.json and en.json. Run node tools/build-preview-locales.mjs after editing. */\nwindow.ACADEMY_LOCALES = ${JSON.stringify(locales)};\n`);
console.log('Built bilingual dictionary bundle for HTTP and file:// previews.');
