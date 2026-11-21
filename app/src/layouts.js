// Panel geometry for the cover layouts.
//
// Every layout is a list of polygons in normalised canvas coordinates
// (0..1 on both axes, y pointing down). Neighbouring panels share edges;
// the renderer insets each polygon toward its own centroid by the keyline
// gap, so the dark gutters of the poster look come from the geometry
// itself rather than from borders drawn afterwards.

export const LAYOUTS = [
  { id: 'key-art', name: 'Key Art', blurb: 'One hero panel ringed by character and scene panels — the movie-poster composition' },
  { id: 'classic-grid', name: 'Classic Grid', blurb: 'One tall hero panel, two stacked beside it' },
  { id: 'vice-slice', name: 'Vice Slice', blurb: 'Three diagonal slash panels' },
  { id: 'hero-strips', name: 'Hero Strips', blurb: 'A wide hero over three story strips' },
];

// Key Art, landscape or square: a tall hero takes the left ~46%, and the
// right side carries two pairs of character panels over one wide scene
// strip — six panels, none of them equal, like a poster wall.
const KEY_ART_WIDE = [
  [[0, 0], [0.46, 0], [0.44, 1], [0, 1]],
  [[0.475, 0], [0.735, 0], [0.73, 0.325], [0.465, 0.325]],
  [[0.75, 0], [1, 0], [1, 0.325], [0.745, 0.325]],
  [[0.465, 0.345], [0.73, 0.345], [0.725, 0.66], [0.455, 0.66]],
  [[0.745, 0.345], [1, 0.345], [1, 0.66], [0.74, 0.66]],
  [[0.455, 0.68], [1, 0.68], [1, 1], [0.44, 1]],
];

// Key Art, portrait: the hero takes the top half, four panels beneath.
const KEY_ART_TALL = [
  [[0, 0], [1, 0], [1, 0.52], [0, 0.52]],
  [[0, 0.535], [0.495, 0.535], [0.495, 0.765], [0, 0.765]],
  [[0.505, 0.535], [1, 0.535], [1, 0.765], [0.505, 0.765]],
  [[0, 0.78], [0.495, 0.78], [0.495, 1], [0, 1]],
  [[0.505, 0.78], [1, 0.78], [1, 1], [0.505, 1]],
];

const CLASSIC_WIDE = [
  [[0, 0], [0.59, 0], [0.55, 1], [0, 1]],
  [[0.59, 0], [1, 0], [1, 0.5], [0.57, 0.5]],
  [[0.57, 0.5], [1, 0.5], [1, 1], [0.55, 1]],
];

const CLASSIC_TALL = [
  [[0, 0], [1, 0], [1, 0.56], [0, 0.56]],
  [[0, 0.56], [0.5, 0.56], [0.5, 1], [0, 1]],
  [[0.5, 0.56], [1, 0.56], [1, 1], [0.5, 1]],
];

const VICE_SLICE = [
  [[0, 0], [0.44, 0], [0.31, 1], [0, 1]],
  [[0.44, 0], [0.73, 0], [0.60, 1], [0.31, 1]],
  [[0.73, 0], [1, 0], [1, 1], [0.60, 1]],
];

const HERO_STRIPS = [
  [[0, 0], [1, 0], [1, 0.60], [0, 0.60]],
  [[0, 0.60], [0.335, 0.60], [0.335, 1], [0, 1]],
  [[0.335, 0.60], [0.667, 0.60], [0.667, 1], [0.335, 1]],
  [[0.667, 0.60], [1, 0.60], [1, 1], [0.667, 1]],
];

// panelsFor returns the polygon list for a layout at a canvas shape.
// Key Art and Classic Grid change with orientation; the others read
// well at any shape.
export function panelsFor(layoutId, portrait) {
  if (layoutId === 'vice-slice') return VICE_SLICE;
  if (layoutId === 'hero-strips') return HERO_STRIPS;
  if (layoutId === 'classic-grid') return portrait ? CLASSIC_TALL : CLASSIC_WIDE;
  return portrait ? KEY_ART_TALL : KEY_ART_WIDE;
}

// panelBounds is the axis-aligned box a polygon covers, in the same
// normalised space. Photo fitting works on this box; the clip path keeps
// the corners honest.
export function panelBounds(poly) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function polygonCentroid(poly) {
  let sx = 0, sy = 0;
  for (const [x, y] of poly) { sx += x; sy += y; }
  return [sx / poly.length, sy / poly.length];
}

// insetPolygon pulls every vertex toward the centroid so the panel
// shrinks by roughly `gapPx` on each side once scaled to pixels. The
// shrink factor is driven by the smaller box dimension so thin strips
// keep a sane shape.
export function insetPolygon(poly, gapPx, canvasW, canvasH) {
  const b = panelBounds(poly);
  const minDimPx = Math.min(b.w * canvasW, b.h * canvasH);
  const f = minDimPx <= 0 ? 1 : Math.max(0.5, 1 - (2 * gapPx) / minDimPx);
  const [cx, cy] = polygonCentroid(poly);
  return poly.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
}

// pointInPolygon: plain ray casting, used by the editor's hit test when
// a panel is clicked.
export function pointInPolygon(poly, px, py) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
