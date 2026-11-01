import { initText } from './lib/text.js';
import { createPost } from './lib/post.js';
import { subframes, FPS } from './film/timeline.js';
import { drawFilm, postParams } from './film/film.js';
import './film/act3.js';
import './film/act4.js';
import './film/act56.js';

await initText({ flex: '/fonts/RobotoFlex.ttf', mono: '/fonts/MartianMono.ttf' });

const W = 1080, H = 1920;
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const scene = mk(), accum = mk();
const sctx = scene.getContext('2d', { willReadFrequently: true }), actx = accum.getContext('2d', { willReadFrequently: true });
const out = document.getElementById('out');
const post = createPost(out, W, H);

// Motion blur: running average of K subframes across a 180° shutter.
window.renderFrame = (t, opts = {}) => {
  const K = opts.k ?? subframes(t);
  const shutter = 0.5 / FPS;
  if (K <= 1) {
    drawFilm(actx, t);
  } else {
    for (let i = 0; i < K; i++) {
      const ts = t + (i / (K - 1) - 0.5) * shutter;
      drawFilm(sctx, ts);
      actx.globalAlpha = 1 / (i + 1);
      actx.drawImage(scene, 0, 0);
    }
    actx.globalAlpha = 1;
  }
  const p = postParams(t);
  p.seed = Math.floor(t * FPS / 2 + 1e-6) % 977;
  if (opts.nopost) { p.grain = 0; }
  post(accum, p);
  return out.toDataURL('image/png');
};
window.__ready = true;
