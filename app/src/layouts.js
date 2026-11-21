// Panel geometry for Vice Panels.
//
// Every layout is a list of panels in normalised canvas coordinates
// (0..1 on both axes), so the same arrangement works at any export
// size. A panel is a polygon plus its bounding box: photos are drawn
// cover-fit into the box and clipped to the polygon, which is what
// lets the diagonal layout share one code path with the rectangles.

function makePanel(id, poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    id,
    poly,
    bbox: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
  };
}

function classicGrid(aspect) {
  if (aspect < 0.95) {
    // Portrait posters: one wide hero over two square panels.
    return [
      makePanel('hero', [[0, 0], [1, 0], [1, 0.55], [0, 0.55]]),
      makePanel('low-left', [[0, 0.55], [0.5, 0.55], [0.5, 1], [0, 1]]),
      makePanel('low-right', [[0.5, 0.55], [1, 0.55], [1, 1], [0.5, 1]]),
    ];
  }
  // Square and landscape: a tall panel on the left, two stacked right.
  return [
    makePanel('tall', [[0, 0], [0.46, 0], [0.46, 1], [0, 1]]),
    makePanel('top', [[0.46, 0], [1, 0], [1, 0.52], [0.46, 0.52]]),
    makePanel('bottom', [[0.46, 0.52], [1, 0.52], [1, 1], [0.46, 1]]),
  ];
}

function viceSlice() {
  // Three diagonal slashes leaning the same way, like a cut poster.
  return [
    makePanel('slash-a', [[0, 0], [0.45, 0], [0.3, 1], [0, 1]]),
    makePanel('slash-b', [[0.45, 0], [0.74, 0], [0.59, 1], [0.3, 1]]),
    makePanel('slash-c', [[0.74, 0], [1, 0], [1, 1], [0.59, 1]]),
  ];
}

function heroStrips() {
  // One wide hero panel over a row of three narrow strips.
  return [
    makePanel('hero', [[0, 0], [1, 0], [1, 0.62], [0, 0.62]]),
    makePanel('strip-a', [[0, 0.62], [1 / 3, 0.62], [1 / 3, 1], [0, 1]]),
    makePanel('strip-b', [[1 / 3, 0.62], [2 / 3, 0.62], [2 / 3, 1], [1 / 3, 1]]),
    makePanel('strip-c', [[2 / 3, 0.62], [1, 0.62], [1, 1], [2 / 3, 1]]),
  ];
}

export const LAYOUTS = {
  classic: { name: 'Classic Grid', build: classicGrid },
  slice: { name: 'Vice Slice', build: viceSlice },
  strips: { name: 'Hero Strips', build: heroStrips },
};

export const LAYOUT_ORDER = ['classic', 'slice', 'strips'];

/** The panels for a layout at a canvas aspect ratio (width / height). */
export function layoutPanels(name, aspect) {
  const layout = LAYOUTS[name] ?? LAYOUTS.classic;
  return layout.build(aspect);
}

/** Ray-casting point-in-polygon test in normalised coordinates. */
export function pointInPanel(panel, nx, ny) {
  const pts = panel.poly;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const crosses = yi > ny !== yj > ny;
    if (crosses && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
