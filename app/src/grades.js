// Colour grades for Vice Panels.
//
// A grade is three treatments layered in the renderer: a canvas
// filter applied while each photo is drawn, a gradient wash laid
// over the whole cover in a blend mode, and a vignette. Each grade
// also names the accent used for the caption rule and selection
// outline, and the sky its empty panels fall back to.

export const GRADES = {
  neon: {
    name: 'Neon Sunset',
    filter: 'saturate(1.45) contrast(1.1) brightness(1.04)',
    washMode: 'soft-light',
    wash: [
      [0, 'rgba(255, 94, 58, 0.55)'],
      [0.45, 'rgba(255, 45, 149, 0.45)'],
      [1, 'rgba(24, 8, 64, 0.6)'],
    ],
    vignette: 0.36,
    accent: '#ff2e88',
    sun: '#ffd23d',
    sky: ['#2b0a4a', '#8a1c7c', '#ff4e50', '#ff9a3d', '#ffd23d'],
  },
  midnight: {
    name: 'Midnight Vice',
    filter: 'saturate(1.15) contrast(1.16) brightness(0.93) hue-rotate(-8deg)',
    washMode: 'soft-light',
    wash: [
      [0, 'rgba(0, 229, 255, 0.35)'],
      [0.5, 'rgba(6, 40, 90, 0.45)'],
      [1, 'rgba(2, 0, 40, 0.75)'],
    ],
    vignette: 0.46,
    accent: '#19d3ff',
    sun: '#bfefff',
    sky: ['#020024', '#07304d', '#0a5e6e', '#12a5b8', '#7fe7f2'],
  },
  golden: {
    name: 'Golden Hour',
    filter: 'saturate(1.25) contrast(1.05) brightness(1.06) sepia(0.25)',
    washMode: 'soft-light',
    wash: [
      [0, 'rgba(255, 190, 60, 0.5)'],
      [0.55, 'rgba(255, 120, 40, 0.35)'],
      [1, 'rgba(80, 30, 0, 0.45)'],
    ],
    vignette: 0.3,
    accent: '#ffb300',
    sun: '#fff3b0',
    sky: ['#3d1e04', '#8a4b08', '#e07b24', '#ffc53d', '#ffe89a'],
  },
};

export const GRADE_ORDER = ['neon', 'midnight', 'golden'];
