// The cover renderer: one routine draws the preview and the exported
// PNG, so what the maker sees is byte-for-byte the art they download.
// A view is { width, height, layoutId, grade, panels, caption,
// furniture } where panels[i] is { photo, dx, dy, zoom, fx, fy, tag } —
// photo an image or null, dx/dy the maker's drag in -1..1 of the
// available slack, zoom 1..3, fx/fy the crop's focal point, tag the
// panel's character name label.

import { panelsFor, panelBounds, insetPolygon } from './layouts.js';
import { paintSunsetSky } from './grades.js';

const KEYLINE = '#0d0714';
const LETTER_FILL = '#fff6e8';
const LETTER_EDGE = '#160510';
const GOLD = '#ffd23e';

function tracePath(ctx, poly, w, h) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * w, y * h);
    else ctx.lineTo(x * w, y * h);
  });
  ctx.closePath();
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function srcW(img) { return img.naturalWidth ?? img.width; }
function srcH(img) { return img.naturalHeight ?? img.height; }

// ---- the Illustrated grade's posterize --------------------------------

const illustratedCache = new Map();

// illustratedVersion returns a posterized copy of a photo: colours
// quantized to a few levels over a saturation/contrast boost, drawn at
// a working width and cached, so a photograph reads as painted key art.
// The cache is keyed by the image itself; drags and re-renders reuse it.
export function illustratedVersion(img) {
  if (illustratedCache.has(img)) return illustratedCache.get(img);
  const maxW = 880;
  const scale = Math.min(1, maxW / srcW(img));
  const cw = Math.max(2, Math.round(srcW(img) * scale));
  const ch = Math.max(2, Math.round(srcH(img) * scale));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, cw, ch);
  const data = cx.getImageData(0, 0, cw, ch);
  const px = data.data;
  const LEVELS = 5;
  const SAT = 1.45;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * SAT;
    g = luma + (g - luma) * SAT;
    b = luma + (b - luma) * SAT;
    r = (r - 128) * 1.12 + 134;
    g = (g - 128) * 1.12 + 134;
    b = (b - 128) * 1.12 + 134;
    px[i] = Math.round((Math.round(clamp(r, 0, 255) / 255 * (LEVELS - 1)) / (LEVELS - 1)) * 255);
    px[i + 1] = Math.round((Math.round(clamp(g, 0, 255) / 255 * (LEVELS - 1)) / (LEVELS - 1)) * 255);
    px[i + 2] = Math.round((Math.round(clamp(b, 0, 255) / 255 * (LEVELS - 1)) / (LEVELS - 1)) * 255);
  }
  cx.putImageData(data, 0, 0);
  illustratedCache.set(img, c);
  return c;
}

// ---- panels -------------------------------------------------------------

// fitFor works out how a photo sits in a panel's box under cover-fit:
// scaled until the box is covered, then zoomed, with the leftover slack
// the drag can spend. Returns the draw size and the slack so the editor
// clamps drags with the same numbers the renderer draws with.
export function fitFor(img, box, zoom) {
  const scale = Math.max(box.w / srcW(img), box.h / srcH(img)) * zoom;
  const dw = srcW(img) * scale;
  const dh = srcH(img) * scale;
  return {
    dw,
    dh,
    slackX: Math.max(0, (dw - box.w) / 2),
    slackY: Math.max(0, (dh - box.h) / 2),
  };
}

// drawPanelPhoto places the photo so its focal point sits at the box's
// centre by default — faces land in frame on tight crops — then spends
// the maker's drag, the whole position clamped so no edge can bare.
function drawPanelPhoto(ctx, img, box, state, filter) {
  const fit = fitFor(img, box, state.zoom);
  const minX = box.x + box.w - fit.dw;
  const minY = box.y + box.h - fit.dh;
  const baseX = clamp(box.x + box.w / 2 - state.fx * fit.dw, minX, box.x);
  const baseY = clamp(box.y + box.h / 2 - state.fy * fit.dh, minY, box.y);
  const ox = clamp(baseX + state.dx * fit.slackX, minX, box.x);
  const oy = clamp(baseY + state.dy * fit.slackY, minY, box.y);
  ctx.save();
  ctx.filter = filter;
  ctx.drawImage(img, ox, oy, fit.dw, fit.dh);
  ctx.restore();
}

// The grade's wash: a vertical soft-light gradient so the panels share
// one sunset even when the photos were taken on different days.
function drawWash(ctx, box, grade) {
  const grad = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  grad.addColorStop(0, grade.wash[0]);
  grad.addColorStop(0.55, grade.wash[1]);
  grad.addColorStop(1, grade.wash[2]);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grad;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const r = Math.hypot(w, h) / 2;
  const grad = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  grad.addColorStop(0, 'rgba(6, 0, 14, 0)');
  grad.addColorStop(1, 'rgba(6, 0, 14, 0.44)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ---- character name tags -------------------------------------------------

// drawNameTag stamps one panel's label: a black tag with a yellow slash
// and the character's name in Anton caps, poster-style. It sits at the
// panel's top-left, stepping below the review strip when that is on —
// except on bottom-row panels beside the hero, where the title block
// owns the top-left and the tag moves to the panel's bottom-right.
function drawNameTag(ctx, box, tag, stripBottom, canvasW, canvasH) {
  const text = (tag ?? '').trim().toUpperCase();
  if (!text) return;
  const size = clamp(box.h * 0.088, 12, 40);
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(text).width;
  const slashW = size * 0.52;
  const padX = size * 0.42;
  const tagH = size * 1.52;
  const tagW = slashW + padX * 2 + textW;
  const bottomRow = box.y > canvasH * 0.55 && box.x > canvasW * 0.02;
  let x = box.x + size * 0.55;
  let y = box.y + size * 0.55;
  if (bottomRow) {
    x = box.x + box.w - tagW - size * 0.55;
    y = box.y + box.h - tagH - size * 0.55;
  } else if (y < stripBottom) {
    y = stripBottom + size * 0.3;
  }
  if (y + tagH > box.y + box.h || x + tagW > box.x + box.w) { ctx.restore(); return; }
  // Hard shadow, then the tag body.
  ctx.fillStyle = 'rgba(5, 0, 10, 0.55)';
  ctx.fillRect(x + 4, y + 5, tagW, tagH);
  ctx.fillStyle = '#0a0510';
  ctx.fillRect(x, y, tagW, tagH);
  // The yellow slash: a slanted block at the tag's left edge.
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.16, y + tagH);
  ctx.lineTo(x + size * 0.30, y);
  ctx.lineTo(x + size * 0.30 + slashW * 0.55, y);
  ctx.lineTo(x + size * 0.16 + slashW * 0.55, y + tagH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x + slashW + padX * 0.9, y + tagH / 2 + 1);
  ctx.restore();
}

// ---- poster furniture -----------------------------------------------------

// drawTopStrip: the review band across the poster's top — five gold
// stars, a short quote, and the VOL. 1 tag at the right.
function drawTopStrip(ctx, view) {
  const { width: w, height: h, furniture } = view;
  const sh = h * 0.058;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 4, 16, 0.88)';
  ctx.fillRect(0, 0, w, sh);
  ctx.textBaseline = 'middle';
  const margin = w * 0.03;
  ctx.font = `${sh * 0.5}px sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText('★★★★★', margin, sh / 2 + 1);
  const quote = (furniture.quote ?? '').trim();
  if (quote) {
    let size = sh * 0.40;
    ctx.font = `${size}px Anton, sans-serif`;
    const maxW = w * 0.58;
    const tw = ctx.measureText(quote.toUpperCase()).width;
    if (tw > maxW) { size *= maxW / tw; ctx.font = `${size}px Anton, sans-serif`; }
    ctx.fillStyle = LETTER_FILL;
    ctx.textAlign = 'center';
    ctx.fillText(quote.toUpperCase(), w / 2, sh / 2 + 1);
    ctx.textAlign = 'left';
  }
  // VOL. 1 tag.
  const label = 'VOL. 1';
  const tsize = sh * 0.42;
  ctx.font = `${tsize}px Anton, sans-serif`;
  const tw = ctx.measureText(label).width;
  const bw = tw + tsize * 1.1;
  const bx = w - margin - bw;
  ctx.fillStyle = '#000000';
  ctx.fillRect(bx, sh * 0.18, bw, sh * 0.64);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, sh * 0.18, bw, sh * 0.64);
  ctx.fillStyle = GOLD;
  ctx.fillText(label, bx + tsize * 0.55, sh / 2 + 1);
  ctx.restore();
  return sh;
}

// drawSeal stamps the gold starburst badge, straddling the hero panel's
// edge like a sticker on the poster.
function drawSeal(ctx, view) {
  const { width: w, height: h } = view;
  const portrait = h > w;
  const cx = portrait ? w * 0.85 : w * 0.815;
  const cy = portrait ? h * 0.50 : h * 0.715;
  const R = Math.min(w, h) * 0.088;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  // Starburst body.
  const spikes = 18;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? R : R * 0.80;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  const grad = ctx.createLinearGradient(-R, -R, R, R);
  grad.addColorStop(0, '#ffe95a');
  grad.addColorStop(1, '#f0a020');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner disc and its two lines of type.
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.66, 0, Math.PI * 2);
  ctx.fillStyle = '#f7b733';
  ctx.fill();
  ctx.strokeStyle = '#7a4d00';
  ctx.stroke();
  ctx.fillStyle = '#3a2400';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${R * 0.30}px Anton, sans-serif`;
  ctx.fillText('ORIGINAL', 0, -R * 0.17);
  ctx.fillText('COVER ART', 0, R * 0.17);
  ctx.restore();
}

// drawBarcode prints the little white barcode block, bottom-right, its
// bars drawn from a fixed seed so every export matches the preview.
function drawBarcode(ctx, view) {
  const { width: w, height: h } = view;
  const bw = clamp(w * 0.064, 96, 200);
  const bh = h * 0.055;
  const x = w - bw - w * 0.022;
  const y = h - bh - h * 0.088;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = '#0a0a0a';
  let seed = 1986;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bx = x + bw * 0.07;
  const barTop = y + bh * 0.10;
  const barH = bh * 0.62;
  while (bx < x + bw * 0.90) {
    const barW = (0.5 + rand() * 1.9) * (bw / 46);
    if (rand() > 0.28) ctx.fillRect(bx, barTop, barW, barH);
    bx += barW + (0.5 + rand() * 1.4) * (bw / 46);
  }
  ctx.font = `${Math.min(bh * 0.20, bw * 0.105)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('8 901986 202600', x + bw / 2, y + bh * 0.90);
  ctx.restore();
}

// drawBilling sets the bottom furniture: COMING SOON over the small
// condensed billing block, centred like a real poster's credit line.
function drawBilling(ctx, view) {
  const { width: w, height: h, furniture } = view;
  ctx.save();
  ctx.textAlign = 'center';
  try { ctx.letterSpacing = '3px'; } catch { /* older engines */ }
  ctx.fillStyle = LETTER_FILL;
  ctx.font = `${h * 0.027}px Anton, sans-serif`;
  ctx.fillText('COMING SOON', w / 2, h - h * 0.052);
  try { ctx.letterSpacing = '1.5px'; } catch { /* older engines */ }
  ctx.fillStyle = 'rgba(246, 236, 255, 0.88)';
  ctx.font = `${h * 0.0165}px Anton, sans-serif`;
  const credits = (furniture.credits ?? '').trim();
  if (credits) ctx.fillText(credits.toUpperCase(), w / 2, h - h * 0.020);
  ctx.restore();
}

// ---- the title ------------------------------------------------------------

// stripedFill builds the sunset-band gradient the chrome title is
// filled with: hard stops from yellow through orange and pink to
// purple, with a pale shine band across the middle.
function stripedFill(ctx, top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0.00, '#fff3a0');
  g.addColorStop(0.25, '#ffd23e');
  g.addColorStop(0.27, '#ff9e2c');
  g.addColorStop(0.48, '#ff6a3d');
  g.addColorStop(0.50, '#ffe9a8');
  g.addColorStop(0.53, '#ff4e79');
  g.addColorStop(0.76, '#d6339e');
  g.addColorStop(0.79, '#7b2d8b');
  g.addColorStop(1.00, '#5b2a86');
  return g;
}

// drawPosterTitle is the flagship treatment: line one in striped chrome
// — sunset bands inside the letters, a thick white keyline, a hard
// offset shadow — line two as a glowing neon script beneath it, and
// the tagline ribbon under both.
function drawPosterTitle(ctx, view, bottomEdge) {
  const { caption, furniture, width: w } = view;
  const margin = w * 0.045;
  const line1 = (caption.line1 ?? '').trim();
  const line2 = (caption.line2 ?? '').trim();
  let cursor = bottomEdge;

  // The tagline ribbon sits lowest in the block.
  const tagline = (furniture.tagline ?? '').trim();
  if (furniture.ribbon && tagline) {
    const size = view.height * 0.030 * (caption.scale ?? 1);
    ctx.save();
    ctx.font = `${size}px Anton, sans-serif`;
    const tw = ctx.measureText(tagline.toUpperCase()).width;
    const rbH = size * 1.7;
    const rbW = tw + size * 1.6;
    const rbY = cursor - rbH;
    const slant = size * 0.35;
    ctx.fillStyle = 'rgba(5, 0, 10, 0.5)';
    ctx.fillRect(margin + 4, rbY + 5, rbW, rbH);
    ctx.beginPath();
    ctx.moveTo(margin + slant, rbY);
    ctx.lineTo(margin + rbW, rbY);
    ctx.lineTo(margin + rbW - slant, rbY + rbH);
    ctx.lineTo(margin, rbY + rbH);
    ctx.closePath();
    ctx.fillStyle = '#d81b60';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagline.toUpperCase(), margin + size * 0.8, rbY + rbH / 2 + 1);
    ctx.restore();
    cursor = rbY - view.height * 0.012;
  }

  // The neon script line, tilted a touch, glowing hot pink.
  let scriptTop = cursor;
  if (line2) {
    const size = view.height * 0.075 * (caption.scale ?? 1);
    ctx.save();
    ctx.font = `${size}px Yellowtail, cursive`;
    const tw = ctx.measureText(line2).width;
    const maxW = w * 0.62;
    const s = tw > maxW ? size * (maxW / tw) : size;
    ctx.font = `${s}px Yellowtail, cursive`;
    const x = margin + view.height * 0.055;
    const y = cursor - s * 0.02;
    ctx.translate(x, y);
    ctx.rotate(-0.03);
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = s * 0.45;
    ctx.fillStyle = '#ff2e88';
    for (let i = 0; i < 3; i++) ctx.fillText(line2, 0, 0);
    ctx.shadowBlur = s * 0.12;
    ctx.fillStyle = '#ff9ec7';
    ctx.fillText(line2, 0, 0);
    ctx.restore();
    scriptTop = y - s * 0.85;
  }

  // The striped chrome main title.
  if (line1) {
    let size = view.height * 0.168 * (caption.scale ?? 1);
    ctx.save();
    ctx.font = `${size}px Anton, sans-serif`;
    const text = line1.toUpperCase();
    const tw = ctx.measureText(text).width;
    if (tw > w * 0.90) { size *= (w * 0.90) / tw; ctx.font = `${size}px Anton, sans-serif`; }
    const baseline = scriptTop + size * 0.08;
    const top = baseline - size * 0.82;
    // Hard shadow, white keyline, then the striped fill.
    ctx.fillStyle = '#1a0510';
    ctx.fillText(text, margin + size * 0.05, baseline + size * 0.06);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.20;
    ctx.strokeText(text, margin, baseline);
    ctx.fillStyle = stripedFill(ctx, top, baseline);
    ctx.fillText(text, margin, baseline);
    ctx.restore();
  }
}

// drawClassicTitle is the alternate treatment: bold Anton lettering in
// cream with a dark outline, hard shadow and the grade's accent rule.
function drawClassicTitle(ctx, view, bottomEdge) {
  const { caption, grade, width: w, height: h } = view;
  const lines = [caption.line1, caption.line2].map((s) => (s ?? '').trim()).filter(Boolean);
  if (lines.length === 0) return;
  let size = h * 0.155 * (caption.scale ?? 1);
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  const widest = Math.max(...lines.map((line) => ctx.measureText(line.toUpperCase()).width));
  if (widest > w * 0.88) {
    size *= (w * 0.88) / widest;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  const margin = w * 0.045;
  const lineHeight = size * 1.02;
  const baseY = bottomEdge - h * 0.012;
  const topY = baseY - lineHeight * lines.length + size * 0.82;
  lines.forEach((line, i) => {
    const text = line.toUpperCase();
    const y = topY + i * lineHeight;
    ctx.lineJoin = 'round';
    ctx.fillStyle = LETTER_EDGE;
    ctx.fillText(text, margin + size * 0.055, y + size * 0.055);
    ctx.strokeStyle = LETTER_EDGE;
    ctx.lineWidth = size * 0.17;
    ctx.strokeText(text, margin, y);
    ctx.fillStyle = LETTER_FILL;
    ctx.fillText(text, margin, y);
  });
  ctx.fillStyle = grade.accent;
  ctx.fillRect(margin, baseY + size * 0.16, Math.min(widest, w * 0.88), Math.max(3, size * 0.085));
  ctx.restore();
}

// ---- the cover --------------------------------------------------------------

export function drawCover(ctx, view) {
  const { width: w, height: h, layoutId, grade, furniture } = view;
  const portrait = h > w;
  const polys = panelsFor(layoutId, portrait);
  const gap = Math.max(6, Math.round(Math.min(w, h) * 0.011));

  ctx.fillStyle = KEYLINE;
  ctx.fillRect(0, 0, w, h);

  const boxes = polys.map((poly, i) => {
    const inner = insetPolygon(poly, gap, w, h);
    const b = panelBounds(inner);
    const box = { x: b.x * w, y: b.y * h, w: b.w * w, h: b.h * h };
    const state = view.panels[i] ?? { photo: null, dx: 0, dy: 0, zoom: 1, fx: 0.5, fy: 0.35, tag: '' };
    ctx.save();
    tracePath(ctx, inner, w, h);
    ctx.clip();
    if (state.photo) {
      const source = grade.illustrated ? illustratedVersion(state.photo) : state.photo;
      drawPanelPhoto(ctx, source, box, state, grade.filter);
    } else {
      paintSunsetSky(ctx, box.x, box.y, box.w, box.h, grade);
    }
    drawWash(ctx, box, grade);
    ctx.restore();
    tracePath(ctx, inner, w, h);
    ctx.strokeStyle = KEYLINE;
    ctx.lineWidth = Math.max(2, gap * 0.4);
    ctx.stroke();
    return box;
  });

  drawVignette(ctx, w, h);

  // A bottom scrim so the title block and billing read over bright art.
  const scrim = ctx.createLinearGradient(0, h * 0.76, 0, h);
  scrim.addColorStop(0, 'rgba(6, 0, 14, 0)');
  scrim.addColorStop(1, 'rgba(6, 0, 14, 0.52)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.76, w, h * 0.24);

  // The outer frame: one bold line inside the canvas edge.
  ctx.strokeStyle = KEYLINE;
  ctx.lineWidth = gap * 1.5;
  ctx.strokeRect(gap * 0.75, gap * 0.75, w - gap * 1.5, h - gap * 1.5);

  // Poster furniture and lettering, back to front.
  let stripBottom = 0;
  if (furniture.strip) stripBottom = drawTopStrip(ctx, view);
  boxes.forEach((box, i) => drawNameTag(ctx, box, view.panels[i]?.tag, stripBottom, w, h));

  const bottomEdge = h - (furniture.billing ? h * 0.085 : h * 0.03);
  if (view.caption.style === 'classic') drawClassicTitle(ctx, view, bottomEdge);
  else drawPosterTitle(ctx, view, bottomEdge);

  if (furniture.seal) drawSeal(ctx, view);
  if (furniture.billing) {
    drawBilling(ctx, view);
    drawBarcode(ctx, view);
  }
}

// drawSelection draws the editor's dashed accent outline over one panel
// so the maker can see which panel the controls are editing. It is an
// editor overlay only — never part of an export.
export function drawSelection(ctx, view, index) {
  const polys = panelsFor(view.layoutId, view.height > view.width);
  const poly = polys[index];
  if (!poly) return;
  const gap = Math.max(6, Math.round(Math.min(view.width, view.height) * 0.011));
  const inner = insetPolygon(poly, gap, view.width, view.height);
  ctx.save();
  tracePath(ctx, inner, view.width, view.height);
  ctx.strokeStyle = view.grade.accent;
  ctx.lineWidth = Math.max(2, gap * 0.3);
  ctx.setLineDash([gap * 1.1, gap * 0.7]);
  ctx.stroke();
  ctx.restore();
}
