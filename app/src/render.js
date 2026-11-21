// The cover renderer: one routine draws both the on-screen preview
// and the exported PNG, so what the maker sees is what they share.
//
//   state = {
//     layout, grade,                 // keys into layouts.js / grades.js
//     panels: [{ photo, zoom, ox, oy }],   // photo is a PhotoStore id
//     caption: [line1, line2],
//     letterScale,                   // caption size multiplier
//     selected, showSelection,       // editor chrome, off for exports
//   }
//   imageFor(id) -> HTMLImageElement | null

import { layoutPanels } from './layouts.js';
import { GRADES } from './grades.js';

function tracePolygon(ctx, panel, W, H) {
  const pts = panel.poly;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * W, pts[i][1] * H);
  ctx.closePath();
}

/** Where a cover-fit photo lands inside a panel box, in pixels. */
export function coverFit(img, bbox, W, H, zoom, ox, oy) {
  const bw = bbox.w * W;
  const bh = bbox.h * H;
  const scale = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const slackX = Math.max(0, dw - bw);
  const slackY = Math.max(0, dh - bh);
  return {
    x: bbox.x * W + slackX * (ox + 0.5) - slackX,
    y: bbox.y * H + slackY * (oy + 0.5) - slackY,
    w: dw,
    h: dh,
    slackX,
    slackY,
  };
}

function drawSunset(ctx, panel, W, H, grade) {
  const bx = panel.bbox.x * W;
  const by = panel.bbox.y * H;
  const bw = panel.bbox.w * W;
  const bh = panel.bbox.h * H;
  const sky = ctx.createLinearGradient(0, by, 0, by + bh);
  grade.sky.forEach((colour, i) => {
    sky.addColorStop(i / (grade.sky.length - 1), colour);
  });
  ctx.fillStyle = sky;
  ctx.fillRect(bx, by, bw, bh);
  // The retro sun: a disc low in the panel, cut by dark scan stripes.
  const sunR = Math.min(bw, bh) * 0.26;
  const sunX = bx + bw * 0.5;
  const sunY = by + bh * 0.58;
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10, 4, 24, 0.5)';
  for (let i = 0; i < 4; i++) {
    const stripeY = sunY + sunR * (0.08 + i * 0.22);
    ctx.fillRect(bx, stripeY, bw, sunR * (0.05 + i * 0.03));
  }
}

function drawPanel(ctx, panel, panelState, W, H, grade, imageFor) {
  const img = panelState && panelState.photo ? imageFor(panelState.photo) : null;
  tracePolygon(ctx, panel, W, H);
  ctx.save();
  ctx.clip();
  if (img && img.naturalWidth > 0) {
    const fit = coverFit(
      img,
      panel.bbox,
      W,
      H,
      panelState.zoom || 1,
      panelState.ox || 0,
      panelState.oy || 0,
    );
    ctx.filter = grade.filter;
    ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
    ctx.filter = 'none';
  } else {
    drawSunset(ctx, panel, W, H, grade);
  }
  ctx.restore();
}

function applyWash(ctx, W, H, grade) {
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  for (const [at, colour] of grade.wash) wash.addColorStop(at, colour);
  ctx.save();
  ctx.globalCompositeOperation = grade.washMode;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.78,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, `rgba(0, 0, 0, ${grade.vignette})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function drawKeylines(ctx, panels, W, H) {
  const lw = Math.max(4, W * 0.007);
  ctx.save();
  ctx.strokeStyle = '#0a0a0f';
  ctx.lineJoin = 'round';
  for (const panel of panels) {
    tracePolygon(ctx, panel, W, H);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.lineWidth = lw * 1.7;
  ctx.strokeRect(lw * 0.85, lw * 0.85, W - lw * 1.7, H - lw * 1.7);
  ctx.restore();
}

function drawSelection(ctx, panel, W, H, accent) {
  tracePolygon(ctx, panel, W, H);
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, W * 0.004);
  ctx.setLineDash([W * 0.014, W * 0.01]);
  ctx.stroke();
  ctx.restore();
}

function drawCaption(ctx, W, H, state, grade) {
  const lines = (state.caption || []).map((s) => (s || '').trim()).filter(Boolean);
  if (lines.length === 0) return;
  let size = H * 0.115 * (state.letterScale || 1);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const setFont = (px) => { ctx.font = `${px}px Anton, 'Arial Black', sans-serif`; };
  setFont(size);
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const maxW = W * 0.87;
  if (widest > maxW) {
    size *= maxW / widest;
    setFont(size);
  }
  const x = W * 0.055;
  const lineStep = size * 1.04;
  const bottom = H - H * 0.052;
  lines.forEach((line, i) => {
    const y = bottom - (lines.length - 1 - i) * lineStep;
    ctx.fillStyle = '#0a0a12';
    ctx.fillText(line, x + size * 0.05, y + size * 0.05);
    ctx.lineWidth = size * 0.16;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0a0a12';
    ctx.strokeText(line, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, x, y);
  });
  const ruleW = Math.min(W * 0.36, Math.max(...lines.map((l) => ctx.measureText(l).width)));
  ctx.fillStyle = grade.accent;
  ctx.fillRect(x, bottom + size * 0.16, ruleW, Math.max(4, size * 0.07));
  ctx.restore();
}

/** Draw the whole cover onto a 2D context at W x H pixels. */
export function drawCover(ctx, W, H, state, imageFor) {
  const grade = GRADES[state.grade] ?? GRADES.neon;
  const panels = layoutPanels(state.layout, W / H);
  ctx.save();
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, 0, W, H);
  panels.forEach((panel, i) => {
    drawPanel(ctx, panel, state.panels[i], W, H, grade, imageFor);
  });
  applyWash(ctx, W, H, grade);
  drawKeylines(ctx, panels, W, H);
  if (state.showSelection && state.selected >= 0 && panels[state.selected]) {
    drawSelection(ctx, panels[state.selected], W, H, grade.accent);
  }
  drawCaption(ctx, W, H, state, grade);
  ctx.restore();
  return panels;
}
