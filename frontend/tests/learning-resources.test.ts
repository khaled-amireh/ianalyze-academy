import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { learningTools, findLearningTool } from '../src/content/learning-tools.ts';
import { featuredVideos, introductoryVideo } from '../src/content/video-resources.ts';
import { publicNavigation } from '../src/app/navigation.ts';

test('the five public tools use the approved official destinations and distinguish optional local tools', () => {
  assert.deepEqual(
    learningTools.map(({ id, href }) => [id, href]),
    [
      ['google-colab', 'https://colab.research.google.com/'],
      ['python', 'https://www.python.org/downloads/'],
      ['vscode', 'https://code.visualstudio.com/download'],
      ['kaggle', 'https://www.kaggle.com/'],
      ['power-bi', 'https://www.microsoft.com/en-us/power-platform/products/power-bi/desktop'],
    ],
  );
  assert.deepEqual(
    learningTools.filter((tool) => tool.category === 'course').map((tool) => tool.id),
    ['google-colab'],
  );
  assert.deepEqual(
    learningTools.filter((tool) => tool.mode === 'online').map((tool) => tool.id),
    ['google-colab', 'kaggle'],
  );
  assert.equal(findLearningTool('power-bi')?.platform, 'windows');
  assert.equal(findLearningTool('not-a-tool'), undefined);
  for (const path of ['/ai-tools', '/videos'])
    assert.ok(publicNavigation.some((item) => item.to === path));
});

test('each tool guide has complete English and Arabic content for every configured setup step', () => {
  for (const locale of ['en', 'ar']) {
    const copy = JSON.parse(
      readFileSync(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8'),
    ).learning;
    for (const tool of learningTools) {
      const entry = copy.tools[tool.id];
      for (const field of ['description', 'why', 'requirements', 'open', 'verification'])
        assert.ok(entry[field]?.trim(), `${locale}/${tool.id}/${field}`);
      assert.deepEqual(Object.keys(entry.steps), tool.steps, `${locale}/${tool.id} steps`);
      for (const step of tool.steps) assert.ok(entry.steps[step]?.trim());
      assert.ok(
        copy.categories[tool.category] && copy.modes[tool.mode] && copy.platforms[tool.platform],
      );
    }
  }
});

test('the introduction stays on Drive and Kaggle uses the corrected YouTube source and fallback', () => {
  assert.deepEqual(
    featuredVideos.map((video) => video.id),
    ['147puYxGioHyoYjSwxktgGP4RRWeM_qn4', 'bR2y1MMW5IE'],
  );
  assert.equal(featuredVideos[0].embedUrl, introductoryVideo.embedUrl);
  assert.equal(featuredVideos[0].provider, 'drive');
  assert.equal(
    introductoryVideo.embedUrl,
    'https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/preview',
  );
  assert.equal(
    introductoryVideo.fallbackUrl,
    'https://drive.google.com/file/d/147puYxGioHyoYjSwxktgGP4RRWeM_qn4/view?usp=sharing',
  );
  assert.equal(featuredVideos[1].provider, 'youtube');
  assert.equal(featuredVideos[1].embedUrl, 'https://www.youtube-nocookie.com/embed/bR2y1MMW5IE');
  assert.equal(featuredVideos[1].fallbackUrl, 'https://www.youtube.com/watch?v=bR2y1MMW5IE');
  assert.ok(featuredVideos.every((video) => !video.embedUrl.includes('autoplay')));
  assert.equal(featuredVideos[1].sourceUrl, 'https://youtu.be/bR2y1MMW5IE');
});
