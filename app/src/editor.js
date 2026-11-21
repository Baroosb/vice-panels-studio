// The Vice Panels editor: owns the cover state, wires the four-step
// control panel to it, and keeps the preview canvas painted. The
// preview canvas is kept at the exact export resolution, so the PNG
// the maker downloads is the very pixels they have been arranging.

import { drawCover, coverFit } from './render.js';
import { layoutPanels, pointInPanel } from './layouts.js';
import { GRADES } from './grades.js';
import { PhotoStore } from './photos.js';

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

const SAMPLES = [
  ['samples/boulevard.jpg', 'Boulevard sample'],
  ['samples/pier.jpg', 'Pier sample'],
];

export function initEditor() {
  const canvas = document.getElementById('cv');
  const ctx = canvas.getContext('2d');
  const store = new PhotoStore();
  const sampleIds = [];

  const state = {
    layout: 'classic',
    grade: 'neon',
    sizeKey: '1080x1080',
    panels: [],
    selected: 0,
    caption: ['VICE CITY', 'HEAT'],
    letterScale: 1,
    showSelection: true,
  };

  let chosenPhoto = null; // tray pick used by "fill every panel"
  let ready = false;

  const sizeWH = () => SIZES[state.sizeKey];
  const aspect = () => {
    const [w, h] = sizeWH();
    return w / h;
  };
  const panelCount = () => layoutPanels(state.layout, aspect()).length;

  function blankPanel(i) {
    return {
      photo: sampleIds.length ? sampleIds[i % sampleIds.length] : null,
      zoom: 1,
      ox: 0,
      oy: 0,
    };
  }

  function syncPanels() {
    const n = panelCount();
    while (state.panels.length < n) state.panels.push(blankPanel(state.panels.length));
    state.panels.length = n;
    if (state.selected >= n) state.selected = 0;
  }

  function redraw() {
    const [w, h] = sizeWH();
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    drawCover(ctx, w, h, state, (id) => store.get(id));
    updatePanelLabel();
  }

  // ---------------------------------------------------------- tray
  const tray = document.getElementById('tray');
  function renderTray() {
    tray.replaceChildren();
    for (const item of store.items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (item.id === chosenPhoto ? ' chosen' : '');
      btn.title = item.name;
      const img = document.createElement('img');
      img.src = item.img.src;
      img.alt = item.name;
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        chosenPhoto = item.id;
        const panel = state.panels[state.selected];
        if (panel) panel.photo = item.id;
        renderTray();
        redraw();
      });
      tray.appendChild(btn);
    }
  }

  // ------------------------------------------------------ controls
  function markActive(selector, attr, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.classList.toggle('active', el.dataset[attr] === value);
    });
  }

  document.querySelectorAll('[data-layout]').forEach((el) => {
    el.addEventListener('click', () => {
      state.layout = el.dataset.layout;
      markActive('[data-layout]', 'layout', state.layout);
      syncPanels();
      redraw();
    });
  });

  document.querySelectorAll('[data-grade]').forEach((el) => {
    el.addEventListener('click', () => {
      state.grade = el.dataset.grade;
      markActive('[data-grade]', 'grade', state.grade);
      redraw();
    });
  });

  document.querySelectorAll('[data-size]').forEach((el) => {
    el.addEventListener('click', () => {
      state.sizeKey = el.dataset.size;
      markActive('[data-size]', 'size', state.sizeKey);
      syncPanels();
      redraw();
    });
  });

  const zoom = document.getElementById('zoom');
  zoom.addEventListener('input', () => {
    const panel = state.panels[state.selected];
    if (panel) panel.zoom = Number(zoom.value);
    redraw();
  });

  document.getElementById('reset-pos').addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (panel) {
      panel.ox = 0;
      panel.oy = 0;
      panel.zoom = 1;
      zoom.value = '1';
    }
    redraw();
  });

  document.getElementById('fill-all').addEventListener('click', () => {
    if (!chosenPhoto) return;
    for (const panel of state.panels) panel.photo = chosenPhoto;
    redraw();
  });

  const cap1 = document.getElementById('cap1');
  const cap2 = document.getElementById('cap2');
  cap1.addEventListener('input', () => { state.caption[0] = cap1.value.toUpperCase(); redraw(); });
  cap2.addEventListener('input', () => { state.caption[1] = cap2.value.toUpperCase(); redraw(); });

  document.getElementById('lettering').addEventListener('input', (ev) => {
    state.letterScale = Number(ev.target.value);
    redraw();
  });

  document.getElementById('export').addEventListener('click', () => {
    const clean = { ...state, showSelection: false };
    drawCover(ctx, canvas.width, canvas.height, clean, (id) => store.get(id));
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-panels-${state.sizeKey}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      redraw();
    }, 'image/png');
  });

  // -------------------------------------------------------- photos
  const fileInput = document.getElementById('files');
  document.getElementById('pick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    for (const file of fileInput.files) {
      const id = await store.loadFile(file);
      chosenPhoto = id;
    }
    renderTray();
    syncPanels();
    redraw();
  });

  const drop = document.getElementById('drop');
  drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    drop.classList.remove('over');
    for (const file of ev.dataTransfer.files) {
      if (file.type.startsWith('image/')) {
        chosenPhoto = await store.loadFile(file);
      }
    }
    renderTray();
    syncPanels();
    redraw();
  });

  // --------------------------------------------- canvas pointer use
  function canvasPoint(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (canvas.width / rect.width),
      y: (ev.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (ev) => {
    const pt = canvasPoint(ev);
    const panels = layoutPanels(state.layout, aspect());
    const nx = pt.x / canvas.width;
    const ny = pt.y / canvas.height;
    const hit = panels.findIndex((p) => pointInPanel(p, nx, ny));
    if (hit === -1) return;
    state.selected = hit;
    const panel = state.panels[hit];
    const img = panel && panel.photo ? store.get(panel.photo) : null;
    if (img) {
      const fit = coverFit(img, panels[hit].bbox, canvas.width, canvas.height, panel.zoom, panel.ox, panel.oy);
      drag = { x: pt.x, y: pt.y, ox: panel.ox, oy: panel.oy, slackX: fit.slackX, slackY: fit.slackY };
      canvas.setPointerCapture(ev.pointerId);
    }
    syncZoomControl();
    redraw();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const pt = canvasPoint(ev);
    const panel = state.panels[state.selected];
    if (!panel) return;
    if (drag.slackX > 0) panel.ox = clamp(drag.ox + (pt.x - drag.x) / drag.slackX);
    if (drag.slackY > 0) panel.oy = clamp(drag.oy + (pt.y - drag.y) / drag.slackY);
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });

  function clamp(v) {
    return Math.max(-0.5, Math.min(0.5, v));
  }

  const panelLabel = document.getElementById('panel-label');
  function updatePanelLabel() {
    panelLabel.textContent = `Panel ${state.selected + 1} of ${panelCount()} selected — drag its photo to reposition`;
  }
  function syncZoomControl() {
    const panel = state.panels[state.selected];
    zoom.value = panel ? String(panel.zoom) : '1';
  }

  // ------------------------------------------------- URL parameters
  function applyParams() {
    const q = new URLSearchParams(location.search);
    if (q.get('layout') && ['classic', 'slice', 'strips'].includes(q.get('layout'))) {
      state.layout = q.get('layout');
    }
    if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
    if (q.get('size') && SIZES[q.get('size')]) state.sizeKey = q.get('size');
    if (q.get('l1') !== null) state.caption[0] = q.get('l1').toUpperCase();
    if (q.get('l2') !== null) state.caption[1] = q.get('l2').toUpperCase();
    cap1.value = state.caption[0];
    cap2.value = state.caption[1];
    markActive('[data-layout]', 'layout', state.layout);
    markActive('[data-grade]', 'grade', state.grade);
    markActive('[data-size]', 'size', state.sizeKey);
  }

  // An embed hook: render the current cover, without editor chrome,
  // at any size, as a PNG data URL.
  window.VicePanels = {
    renderToDataURL(w, h) {
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const clean = { ...state, showSelection: false };
      drawCover(off.getContext('2d'), w, h, clean, (id) => store.get(id));
      return off.toDataURL('image/png');
    },
    get ready() { return ready; },
  };

  // ------------------------------------------------------------ go
  applyParams();
  syncPanels();
  redraw();
  Promise.all(SAMPLES.map(([url, name]) => store.loadUrl(url, name)))
    .then((ids) => {
      sampleIds.push(...ids);
      chosenPhoto = ids[0];
      // Panels created before the samples arrived get them now.
      state.panels.forEach((panel, i) => {
        if (!panel.photo) panel.photo = ids[i % ids.length];
      });
      renderTray();
      redraw();
    })
    .catch(() => { /* samples are a convenience; uploads still work */ })
    .finally(() => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          ready = true;
          window.__vpReady = true;
          redraw();
        });
      } else {
        ready = true;
        window.__vpReady = true;
      }
    });
  document.fonts?.load('80px Anton').then(() => redraw()).catch(() => {});
}
