// src/assets.mjs -- image loading with a cache. Every picture the game draws
// goes through here so it can be preloaded before the screen that needs it.

const cache = new Map();

export function loadImage(url) {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${url}`));
      img.src = url;
    });
    cache.set(url, p);
  }
  return p;
}

// The image if it's already loaded, else null (and start loading it).
const loaded = new Map();
export function imageNow(url) {
  if (loaded.has(url)) return loaded.get(url);
  loadImage(url).then((img) => loaded.set(url, img), () => loaded.set(url, null));
  return null;
}

export function loadAll(urls) {
  return Promise.all(urls.map((u) => loadImage(u).then((img) => { loaded.set(u, img); return img; })));
}

export const TUFT_URLS = Object.freeze({
  default: 'assets/tufts/default.png',
  tall: 'assets/tufts/tall.png',
  short: 'assets/tufts/short.png',
  flowered: 'assets/tufts/flowered.png',
  stiff: 'assets/tufts/stiff.png',
  loosened: 'assets/tufts/loosened.png',
  flat: 'assets/tufts/flat.png',
});

export const FLOWER_URLS = Object.freeze([
  'assets/sprites/buttercup.png', 'assets/sprites/daisy.png', 'assets/sprites/clover.png',
]);

export function sceneUrl(time, portrait) {
  return `assets/scenes/${time}-${portrait ? '9x16' : '16x9'}.jpg`;
}

export const SOIL_URL = 'assets/textures/soil.jpg';
