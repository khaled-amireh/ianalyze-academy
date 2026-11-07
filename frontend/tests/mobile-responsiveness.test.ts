import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const frontend = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, frontend), 'utf8');

test('mobile viewport, sticky header and page shell account for iPhone browser geometry', () => {
  const html = read('index.html');
  const academy = read('src/styles/academy.css');
  const redesign = read('src/styles/redesign.css');
  const mobile = read('src/styles/mobile-responsiveness.css');

  assert.match(html, /width=device-width, initial-scale=1, viewport-fit=cover/);
  assert.match(redesign, /\.site-header[\s\S]*position: sticky/);
  assert.doesNotMatch(redesign.match(/\.site-header\s*\{[^}]+\}/)?.[0] ?? '', /position: fixed/);
  assert.match(mobile, /padding-block-start: env\(safe-area-inset-top\)/);
  assert.match(mobile, /scroll-margin-block-start: calc\(82px \+ env\(safe-area-inset-top\)\)/);
  assert.match(academy, /\.page-container[\s\S]*min-width: 0[\s\S]*max-width: 100%/);
  assert.match(academy, /overflow-x: clip/);
});

test('video cards keep one flexible 16:9 window and never size the iframe in pixels', () => {
  const styles = read('src/styles/learning-resources.css');
  const player = read('src/components/shared/drive-video.tsx');
  const resources = read('src/content/video-resources.ts');

  assert.match(
    styles,
    /\.video-player-frame\s*\{[\s\S]*inline-size: 100%[\s\S]*max-inline-size: 100%[\s\S]*aspect-ratio: 16 \/ 9[\s\S]*overflow: hidden/,
  );
  assert.match(
    styles,
    /\.video-player-frame iframe\s*\{[\s\S]*position: absolute[\s\S]*inline-size: 100%[\s\S]*block-size: 100%/,
  );
  assert.match(styles, /\.drive-video\s*\{[\s\S]*width: 100%[\s\S]*max-width: 100%/);
  assert.equal((player.match(/<iframe/g) ?? []).length, 1);
  assert.doesNotMatch(player, /<iframe[^>]+(?:width|height)=/s);
  assert.match(resources, /drive\.google\.com\/file\/d\/\$\{id\}\/preview/);
  assert.doesNotMatch(resources, /autoplay/i);
});

test('phone video cards wrap content and keep controls inside the card', () => {
  const styles = read('src/styles/learning-resources.css');
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /\.learning-video\s*\{[\s\S]*padding: clamp\(1rem, 5vw, 1\.25rem\)/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /\.drive-video-expand[\s\S]*max-width: 100%/);
  assert.match(styles, /min-height: 44px/);
});
