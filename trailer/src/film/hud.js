// Film HUD: act index top-left (the motion grammar as chapter titles),
// running timecode top-right. Tiny, quiet, always on the 64px margin.
import { ACTS, FPS, T } from './timeline.js';
import { clamp, ease, win, PAL, smooth } from '../lib/util.js';
import { mono } from './draw.js';

export function drawHUD(ctx, t, light) {
  const col = light ? PAL.ink : PAL.foam;
  const intro = smooth(win(t, 0.05, 0.5));
  const outro = 1 - smooth(win(t, 14.6, 15.2));
  const a = 0.55 * intro * outro;
  if (a <= 0) return;

  let idx = 0;
  for (let i = 0; i < ACTS.length; i++) if (t >= ACTS[i].at) idx = i;
  const since = t - ACTS[idx].at;
  const k = ease.flow(clamp(since / 0.35));

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 62, 700, 44); ctx.clip();
  const y = 96;
  const draw = (i, dy, alpha) => {
    const A = ACTS[i];
    mono(ctx, A.n, 64, y + dy, 22, { color: col, alpha: a * alpha, wght: 500 });
    ctx.globalAlpha = a * alpha * 0.8;
    ctx.fillStyle = col;
    ctx.fillRect(106, y - 8 + dy, 34, 1.5);
    ctx.globalAlpha = 1;
    mono(ctx, A.name, 152, y + dy, 22, { color: col, alpha: a * alpha, tracking: 0.22 });
  };
  if (idx > 0 && k < 1) draw(idx - 1, -k * 40, 1 - k);
  draw(idx, (1 - k) * 40, k);
  ctx.restore();

  const f = Math.floor(t * FPS);
  const s = Math.floor(f / FPS), ff = f % FPS;
  const tc = `${String(s).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  mono(ctx, tc, 1016, y, 22, { color: col, alpha: a, align: 'right', tracking: 0.12 });
  mono(ctx, 'CORDUROY / MOTION SYSTEM', 1016, 1858, 18, { color: col, alpha: a * 0.7 * (t < T.act6 ? 1 : 0), align: 'right', tracking: 0.2 });
}
