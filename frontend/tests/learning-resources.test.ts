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

test('the two featured videos keep the original Drive media and correct per-video fallbacks', () => {
  assert.deepEqual(
    featuredVideos.map((video) => video.id),
    ['147puYxGioHyoYjSwxktgGP4RRWeM_qn4', '1Qh5BPaoR125I00znXsaCF6e1s5HpuPBS'],
  );
  assert.equal(featuredVideos[0].embedUrl, introductoryVideo.embedUrl);
  for (const video of featuredVideos) {
    assert.equal(video.embedUrl, `https://drive.google.com/file/d/${video.id}/preview`);
    assert.equal(video.fallbackUrl, `https://drive.google.com/file/d/${video.id}/view?usp=sharing`);
    assert.ok(!video.embedUrl.includes('autoplay'));
  }
  assert.equal(featuredVideos[1].sourceUrl, 'https://youtu.be/bR2y1MMW5IE');
});
