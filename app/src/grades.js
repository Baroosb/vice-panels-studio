// The colour grades. A grade is the layers the renderer stacks on every
// panel: a canvas filter pushed hard on saturation and contrast, a
// soft-light wash in the grade's colours, and an accent colour the
// caption rule and editor chrome borrow. Each grade also carries the
// sky palette used when a panel has no photo yet.
//
// The first grade is the flagship: Illustrated posterizes the photo
// itself (colour quantization over a saturation/contrast boost, done in
// render.js) so a snapshot reads as drawn key art, not a photograph.

export const GRADES = [
  {
    id: 'illustrated',
    name: 'Illustrated',
    blurb: 'Posterized key-art grade — photos read as drawn poster art',
    filter: 'saturate(1.22) contrast(1.10) brightness(1.03)',
    illustrated: true,
    wash: ['rgba(255, 62, 150, 0.42)', 'rgba(255, 150, 50, 0.30)', 'rgba(70, 0, 100, 0.42)'],
    accent: '#ffd23e',
    sky: ['#23063e', '#7c1d68', '#e83e7e', '#ff8a4a', '#ffd76a'],
    sun: '#ffe9a8',
  },
  {
    id: 'neon-sunset',
    name: 'Neon Sunset',
    blurb: 'Hot pink and orange, the classic Vice City sunset',
    filter: 'saturate(1.55) contrast(1.14) brightness(1.04) hue-rotate(-6deg)',
    wash: ['rgba(255, 62, 150, 0.55)', 'rgba(255, 138, 42, 0.38)', 'rgba(64, 0, 96, 0.50)'],
    accent: '#ff4fa0',
    sky: ['#23063e', '#7c1d68', '#e83e7e', '#ff8a4a', '#ffd76a'],
    sun: '#ffe9a8',
  },
  {
    id: 'midnight-vice',
    name: 'Midnight Vice',
    blurb: 'Deep blue night with cyan and magenta neon',
    filter: 'saturate(1.38) contrast(1.24) brightness(0.92) hue-rotate(10deg)',
    wash: ['rgba(16, 0, 64, 0.62)', 'rgba(0, 170, 255, 0.30)', 'rgba(255, 0, 128, 0.34)'],
    accent: '#2fd8f2',
    sky: ['#02020e', '#0a1440', '#123a7a', '#0e7fa8', '#59d8d0'],
    sun: '#c8f6ff',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    blurb: 'Warm amber light, late-afternoon glow',
    filter: 'saturate(1.42) contrast(1.08) brightness(1.10) sepia(0.22)',
    wash: ['rgba(255, 176, 48, 0.52)', 'rgba(255, 96, 54, 0.32)', 'rgba(96, 32, 0, 0.38)'],
    accent: '#ffb340',
    sky: ['#3a0d02', '#93300e', '#e86a24', '#ffb340', '#ffe9a8'],
    sun: '#fff3c4',
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

// paintSunsetSky fills a pixel box with the grade's retro sunset: flat
// colour bands running down the sky and a banded sun whose lower half is
// sliced by stripes, the synthwave-poster fallback for an empty panel.
export function paintSunsetSky(ctx, x, y, w, h, grade) {
  const bands = grade.sky;
  const bandH = h / bands.length;
  for (let i = 0; i < bands.length; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(x, y + i * bandH, w, bandH + 1);
  }
  const sunR = Math.min(w, h) * 0.30;
  const sunX = x + w * 0.5;
  const sunY = y + h * 0.44;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grade.sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  // Cut the stripes out of the sun's lower half with the band colour
  // beneath, widening as they descend.
  ctx.fillStyle = bands[bands.length - 2];
  let stripeY = sunY + sunR * 0.08;
  let stripeH = sunR * 0.05;
  while (stripeY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, stripeY, sunR * 2, stripeH);
    stripeY += stripeH + sunR * 0.13;
    stripeH *= 1.45;
  }
  ctx.restore();
}
