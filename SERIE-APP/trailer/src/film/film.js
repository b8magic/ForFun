// Composites every act for a moment in time.
import { T } from './timeline.js';
import { PAL, win, smooth, clamp, gauss } from '../lib/util.js';
import { W, H, fillBG } from './draw.js';
import { drawAct12 } from './act12.js';
import { drawHUD } from './hud.js';
import { act4Post } from './act4.js';

import { extra } from './registry.js';

export const isLight = (t) => t >= T.impact;

export function drawFilm(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  fillBG(ctx, isLight(t) ? PAL.bone : PAL.ink);
  const [sx, sy] = shake(t);
  ctx.translate(sx, sy);
  drawAct12(ctx, t);
  for (const fn of extra) { ctx.save(); fn(ctx, t); ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHUD(ctx, t, isLight(t));
}

export function postParams(t) {
  const light = isLight(t);
  return {
    grain: light ? 0.016 : 0.024,
    vignette: light ? 0.18 : 0.5,
    bloom: light ? 0 : 0.9,
    bloomThr: 0.18,
    bloomRadius: 6,
    ca: 0,
    zoom: 0,
    flash: 0,
    ...(t > T.tube[0] && t < T.impact ? act4Post(t) : {}),
    ...(t >= T.impact - 0.03 ? impactPost(t) : {}),
  };
}

function impactPost(t) {
  const dt = t - T.impact;
  const flash = dt < 0 ? smooth(win(t, T.impact - 0.03, T.impact)) : Math.exp(-dt * 7);
  return { flash: flash * 0.9, flashCol: [1, 0.99, 0.97], ca: 10 * Math.exp(-Math.max(0, dt) * 6), grain: 0.016 + 0.02 * Math.exp(-Math.max(0, dt) * 5) };
}

// Camera shake after the impact (applied to the whole picture).
export function shake(t) {
  const dt = t - T.impact;
  if (dt < 0 || dt > 0.6) return [0, 0];
  const a = 26 * Math.exp(-dt * 7);
  return [a * Math.sin(dt * 91.0 + 1.3), a * Math.cos(dt * 77.0)];
}
