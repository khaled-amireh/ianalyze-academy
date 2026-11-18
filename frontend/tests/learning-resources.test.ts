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
    ['power-bi'],
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

test('both lessons use the exact requested YouTube IDs and privacy-enhanced embeds', () => {
  assert.deepEqual(
    featuredVideos.map((video) => video.id),
    ['KE4KF03j_oM', '2hqkdoqQ7IU'],
  );
  assert.equal(featuredVideos[0].embedUrl, introductoryVideo.embedUrl);
  assert.equal(featuredVideos[0].provider, 'youtube');
  assert.equal(introductoryVideo.embedUrl, 'https://www.youtube-nocookie.com/embed/KE4KF03j_oM');
  assert.equal(introductoryVideo.fallbackUrl, 'https://www.youtube.com/watch?v=KE4KF03j_oM');
  assert.equal(featuredVideos[1].provider, 'youtube');
  assert.equal(featuredVideos[1].embedUrl, 'https://www.youtube-nocookie.com/embed/2hqkdoqQ7IU');
  assert.equal(featuredVideos[1].fallbackUrl, 'https://www.youtube.com/watch?v=2hqkdoqQ7IU');
  assert.ok(featuredVideos.every((video) => !video.embedUrl.includes('autoplay')));
  assert.equal(featuredVideos[1].sourceUrl, 'https://youtu.be/2hqkdoqQ7IU');
  assert.equal(featuredVideos[1].cover, '/video-thumbnails/2hqkdoqQ7IU.jpg');
  assert.equal(featuredVideos[0].cover, '/video-thumbnails/KE4KF03j_oM.jpg');
});

test('both cards defer their iframe until activation and share one persistent player', () => {
  const component = readFileSync(
    new URL('../src/components/shared/drive-video.tsx', import.meta.url),
    'utf8',
  );
  const card = readFileSync(
    new URL('../src/components/shared/learning-video.tsx', import.meta.url),
    'utf8',
  );
  const styles = readFileSync(
    new URL('../src/styles/learning-resources.css', import.meta.url),
    'utf8',
  );
  assert.match(component, /!activated \? \(/);
  assert.match(component, /setActivated\(true\)/);
  assert.match(component, /<iframe/);
  assert.match(component, /allowFullScreen/);
  assert.match(component, /requestFullscreen/);
  assert.match(component, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.equal((card.match(/<VideoPlayer/g) ?? []).length, 1);
  assert.equal((component.match(/<iframe/g) ?? []).length, 1);
  assert.match(styles, /\.video-player-frame[\s\S]*inline-size: 100%/);
  assert.match(styles, /\.video-player-frame[\s\S]*max-inline-size: 100%/);
  assert.match(styles, /\.video-player-frame[\s\S]*aspect-ratio: 16 \/ 9/);
  assert.match(styles, /\.video-player-frame iframe[\s\S]*position: absolute/);
});
