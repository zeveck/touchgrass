// sw.js: offline play. The GitHub Pages workflow stamps VERSION with the
// commit and fills FILES with everything in the game folder, so each deploy
// caches a fresh copy on the next launch. Unstamped copies (local play-tests
// with ?sw=1) cache LOCAL_FILES under LOCAL_VERSION instead: raise the version
// when the game changes, and run `node tools/sw-files.mjs` when files are
// added or removed.
'use strict';
const VERSION = '__BUILD__';
const FILES = [/*__FILES__*/];
const PREFIX = 'touchgrass-';
const LOCAL_VERSION = 'local-m4-1';
const LOCAL_FILES = [
  'apple-touch-icon.png',
  'assets/audio/amb-dusk.mp3',
  'assets/audio/amb-meadow.mp3',
  'assets/audio/bonk.mp3',
  'assets/audio/buzz.wav',
  'assets/audio/chirp.mp3',
  'assets/audio/click.mp3',
  'assets/audio/gust.mp3',
  'assets/audio/music-afternoon.mp3',
  'assets/audio/music-golden.mp3',
  'assets/audio/music-morning.mp3',
  'assets/audio/music-title.mp3',
  'assets/audio/rustle.wav',
  'assets/audio/swish.mp3',
  'assets/audio/tap.mp3',
  'assets/audio/twang.mp3',
  'assets/audio/whoomp.mp3',
  'assets/audio/whoosh.mp3',
  'assets/scenes/afternoon-16x9.jpg',
  'assets/scenes/afternoon-9x16.jpg',
  'assets/scenes/ending-16x9.jpg',
  'assets/scenes/ending-9x16.jpg',
  'assets/scenes/garden-16x9.jpg',
  'assets/scenes/garden-9x16.jpg',
  'assets/scenes/golden-16x9.jpg',
  'assets/scenes/golden-9x16.jpg',
  'assets/scenes/map-16x9.jpg',
  'assets/scenes/map-9x16.jpg',
  'assets/scenes/morning-16x9.jpg',
  'assets/scenes/morning-9x16.jpg',
  'assets/scenes/title-16x9.jpg',
  'assets/scenes/title-9x16.jpg',
  'assets/sprites/ant.png',
  'assets/sprites/bee-body.png',
  'assets/sprites/bee-full.png',
  'assets/sprites/bee-wing.png',
  'assets/sprites/buttercup.png',
  'assets/sprites/butterfly-body.png',
  'assets/sprites/butterfly-full.png',
  'assets/sprites/butterfly-wing.png',
  'assets/sprites/caterpillar.png',
  'assets/sprites/clover.png',
  'assets/sprites/daisy.png',
  'assets/sprites/ladybug-crawl/frame_0.png',
  'assets/sprites/ladybug-crawl/frame_1.png',
  'assets/sprites/ladybug-crawl/frame_2.png',
  'assets/sprites/ladybug-crawl/frame_3.png',
  'assets/sprites/ladybug.png',
  'assets/sprites/snail.png',
  'assets/sprites/wasp-body.png',
  'assets/sprites/wasp-full.png',
  'assets/sprites/wasp-wing.png',
  'assets/sprites/wings.json',
  'assets/textures/paper.jpg',
  'assets/textures/soil.jpg',
  'assets/tufts/default.png',
  'assets/tufts/flat.png',
  'assets/tufts/flowered.png',
  'assets/tufts/loosened.png',
  'assets/tufts/short.png',
  'assets/tufts/stiff.png',
  'assets/tufts/tall.png',
  'assets/ui/clear.png',
  'assets/ui/flower-centre.png',
  'assets/ui/flower-petal.png',
  'assets/ui/garden.png',
  'assets/ui/hand.png',
  'assets/ui/line.png',
  'assets/ui/map.png',
  'assets/ui/patch-bare.png',
  'assets/ui/patch-bloom.png',
  'assets/ui/pause.png',
  'assets/ui/ring.png',
  'assets/ui/settings.png',
  'assets/ui/share.png',
  'assets/ui/sound-off.png',
  'assets/ui/sound-on.png',
  'favicon.png',
  'fonts/OFL-Fraunces.txt',
  'fonts/OFL-Nunito.txt',
  'fonts/fraunces-600-latin.woff2',
  'fonts/nunito-latin.woff2',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'index.html',
  'manifest.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'social-card.jpg',
  'src/assets.mjs',
  'src/audio.mjs',
  'src/game.mjs',
  'src/haptics.mjs',
  'src/hints.mjs',
  'src/input/pointer.mjs',
  'src/input/tap.mjs',
  'src/loop.mjs',
  'src/main.mjs',
  'src/nav.mjs',
  'src/prefs.mjs',
  'src/render/atlas.mjs',
  'src/render/bloom.mjs',
  'src/render/bugs.mjs',
  'src/render/canvas.mjs',
  'src/render/edge.mjs',
  'src/render/grade.mjs',
  'src/render/grass.mjs',
  'src/render/moves.mjs',
  'src/render/particles.mjs',
  'src/render/titletoy.mjs',
  'src/share/flow.mjs',
  'src/share/link.mjs',
  'src/share/scorecard.mjs',
  'src/sim/brush.mjs',
  'src/sim/energy.mjs',
  'src/sim/grid.mjs',
  'src/sim/insects.mjs',
  'src/sim/layout.mjs',
  'src/sim/levels.mjs',
  'src/sim/mask.mjs',
  'src/sim/moves.mjs',
  'src/sim/rng.mjs',
  'src/sim/score.mjs',
  'src/sim/solver.mjs',
  'src/sim/types.mjs',
  'src/sim/world.mjs',
  'src/state.mjs',
  'src/storage.mjs',
  'src/style.css',
  'src/ui/cards.mjs',
  'src/ui/challenge.mjs',
  'src/ui/dom.mjs',
  'src/ui/ending.mjs',
  'src/ui/garden.mjs',
  'src/ui/hud.mjs',
  'src/ui/map.mjs',
  'src/ui/maplayout.mjs',
  'src/ui/modal.mjs',
  'src/ui/screens.mjs',
  'src/ui/settings.mjs',
  'src/ui/share.mjs',
  'src/ui/title.mjs',
  'src/ui/toolbar.mjs',
  'vendor/gh-feedback.js',
  'vendor/report.js',
];
const STAMPED = !VERSION.startsWith('__');
const CACHE = PREFIX + (STAMPED ? VERSION : LOCAL_VERSION);
const LIST = STAMPED ? FILES : LOCAL_FILES;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(['./', ...LIST].map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './' : req;
  event.respondWith(caches.open(CACHE).then(cache =>
    cache.match(key, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    }))));
});
