import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { portalTranslations } from '../src/features/portal/copy.ts';
import { publicNavigation, publicPages } from '../src/app/navigation.ts';

test('unreleased EDA stays out of public navigation and page metadata', () => {
  assert.ok(publicNavigation.every(({ to }) => !to.startsWith('/eda')));
  assert.ok(publicPages.every((page) => !page.startsWith('eda')));
});
const flatten = (value: unknown, path = ''): [string, string][] =>
  typeof value === 'string'
    ? [[path, value]]
    : Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
        flatten(item, path ? `${path}.${key}` : key),
      );
function rejectDuplicateKeys(source: string, json = false) {
  const tree = ts.createSourceFile(
    json ? 'locale.json' : 'copy.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    json ? ts.ScriptKind.JSON : ts.ScriptKind.TS,
  );
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set<string>();
      for (const prop of node.properties) {
        const key = prop.name?.getText(tree);
        if (key) {
          assert.ok(!seen.has(key), `Duplicate translation key ${key}`);
          seen.add(key);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
const load = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalogues = [
  ['public', load('../src/locales/en.json'), load('../src/locales/ar.json')],
  ['dev', load('../src/dev/locales/en.json'), load('../src/dev/locales/ar.json')],
  ['portal', portalTranslations.en, portalTranslations.ar],
] as const;

test('team names remain English in both languages and visible public copy contains no curriculum details', () => {
  for (const locale of ['en', 'ar']) {
    const copy = load(`../src/locales/${locale}.json`);
    assert.deepEqual(
      ['khaled', 'yomna', 'hussein'].map((id) => copy.academy.team[id]),
      ['Khaled Amireh', 'Yomna Al-jabiri', 'Hussein Zahran'],
    );
    const visible = [
      copy.home.description,
      copy.academy.home.resourceTitle,
      copy.academy.home.resourceText,
      copy.academy.home.communityText,
      ...flatten(copy.academy.about).map(([, value]) => value),
      ...flatten(copy.academy.faq).map(([, value]) => value),
      copy.academy.join.prepareText,
    ].join('\n');
    assert.doesNotMatch(
      visible,
      /Python|Pandas|Matplotlib|Google Colab|Power BI|\bEDA\b|Introduction to Data Science|six teaching weeks|18 planned|final project|مقدمة في علم البيانات|أسابيع تدريبية|ساعات تدريبية|مشروع نهائي/i,
    );
  }
});
test('all three bilingual catalogues have unique keys, equivalent placeholders, Unicode and intentional English exceptions only', () => {
  for (const dir of ['src/locales', 'src/dev/locales'])
    for (const locale of ['ar', 'en'])
      rejectDuplicateKeys(
        readFileSync(new URL(`../${dir}/${locale}.json`, import.meta.url), 'utf8'),
        true,
      );
  rejectDuplicateKeys(
    readFileSync(new URL('../src/features/portal/copy.ts', import.meta.url), 'utf8'),
  );
  for (const [name, en, ar] of catalogues) {
    const english = new Map(flatten(en)),
      arabic = new Map(flatten(ar));
    assert.deepEqual([...english.keys()].sort(), [...arabic.keys()].sort());
    for (const [key, text] of arabic) {
      assert.ok(text.trim() && !/\uFFFD|\?{2,}/.test(text), `${name}.${key}: malformed Arabic`);
      const other = english.get(key)!;
      const slots = (x: string) => [...x.matchAll(/{{\s*([^}]+)\s*}}/g)].map((m) => m[1]).sort();
      assert.deepEqual(slots(text), slots(other), `${name}.${key}: interpolation mismatch`);
      if (
        ![
          'common.arabic',
          'common.english',
          'home.note',
          'home.toolkit',
          'academy.team.khaled',
          'academy.team.yomna',
          'academy.team.hussein',
        ].includes(key)
      )
        assert.ok(/[\u0600-\u06FF]/.test(text), `${name}.${key}: untranslated Arabic`);
    }
  }
  assert.throws(() => rejectDuplicateKeys('{"same":"a","same":"b"}', true), /Duplicate/);
});
test('official library, product and EDA names survive translation across all user-facing catalogues', () => {
  const terms = [
    'Python',
    'Pandas',
    'NumPy',
    'Power BI',
    'Google Colab',
    'Matplotlib',
    'Supabase',
    'Cloudflare',
    'WhatsApp',
    'Google Drive',
    'iAnalyze',
    'iTeam',
    'Instagram',
    'LinkedIn',
    'EDA',
  ];
  for (const [name, en, ar] of catalogues) {
    const arabic = new Map(flatten(ar));
    for (const [key, text] of flatten(en)) {
      for (const term of terms)
        if (text.includes(term))
          assert.ok(arabic.get(key)?.includes(term), `${name}.${key}: missing ${term}`);
      assert.ok(
        !/باندا|بانداس|نمباي|نومباي|بايثون/.test(arabic.get(key)!),
        `${name}.${key}: inconsistent technical name`,
      );
    }
  }
});
