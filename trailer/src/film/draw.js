// Drawing primitives shared by every act.
import { drawText } from '../lib/text.js';
import { PAL, rgba, clamp } from '../lib/util.js';

export const W = 1080, H = 1920;

export function polyline(ctx, pts, close = false) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) ctx.moveTo(pts[i], pts[i + 1]); else ctx.lineTo(pts[i], pts[i + 1]);
  }
  if (close) ctx.closePath();
}

export function strokeLine(ctx, pts, color, width, alpha = 1) {
  if (pts.length < 4 || alpha <= 0.002) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  polyline(ctx, pts);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function dot(ctx, x, y, r, color, alpha = 1, glow = 0) {
  if (alpha <= 0.002 || r <= 0) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

export function ringAt(ctx, x, y, r, color, width, alpha = 1) {
  if (alpha <= 0.002 || r <= 0) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Text helpers. Display = Roboto Flex, data = Martian Mono.
export function type(ctx, text, x, y, size, o = {}) {
  if ((o.alpha ?? 1) <= 0.002) return { width: 0 };
  ctx.globalAlpha = clamp(o.alpha ?? 1);
  ctx.fillStyle = o.color || PAL.foam;
  const r = drawText(ctx, o.font || 'flex', text, x, y, size, {
    vars: o.vars || { wght: 400, wdth: 100, opsz: Math.min(144, size / 1.2) },
    align: o.align, tracking: o.tracking, warp: o.warp, perGlyph: o.perGlyph,
  });
  ctx.fill();
  ctx.globalAlpha = 1;
  return r;
}

export function mono(ctx, text, x, y, size, o = {}) {
  return type(ctx, text, x, y, size, {
    font: 'mono', tracking: o.tracking ?? 0.04,
    vars: { wght: o.wght ?? 340, wdth: o.wdth ?? 87.5 }, ...o,
    ...(o.vars ? {} : { vars: { wght: o.wght ?? 340, wdth: o.wdth ?? 87.5 } }),
  });
}

export function fillBG(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

export { PAL, rgba };
