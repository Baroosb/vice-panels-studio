// The editor: owns the cover's state, wires every control to it, and
// keeps the preview canvas — which is kept at the exact export
// resolution — redrawing through render.js's single draw routine.

import { LAYOUTS, panelsFor, panelBounds, pointInPolygon } from './layouts.js';
import { GRADES, gradeById } from './grades.js';
import { createPhotoStore, SAMPLE_PHOTOS } from './photos.js';
import { drawCover, drawSelection, fitFor } from './render.js';

const START_SIZE = { w: 1920, h: 1080 };

const CAPTION_STYLES = [
  { id: 'poster', name: 'Poster', blurb: 'Striped chrome title with a glowing neon script line' },
  { id: 'classic', name: 'Classic', blurb: 'Bold cream Anton lettering with an accent rule' },
];

// The three post sizes the bounty asks for, offered as one segmented
// picker in the export step. Switching size rebuilds the canvas at the
// exact export resolution and re-deals the layout for the new shape.
export const EXPORT_SIZES = [
  { w: 1080, h: 1080, label: '1080 × 1080' },
  { w: 1080, h: 1350, label: '1080 × 1350' },
  { w: 1920, h: 1080, label: '1920 × 1080' },
];

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export async function startEditor(doc) {
  const canvas = doc.querySelector('#cover');
  const ctx = canvas.getContext('2d');
  const store = createPhotoStore();

  const state = {
    layoutId: 'key-art',
    gradeId: 'illustrated',
    size: { ...START_SIZE },
    caption: { line1: 'SUNDOWN HEAT', line2: 'welcome back', scale: 1, style: 'poster' },
    furniture: {
      strip: true,
      seal: true,
      ribbon: true,
      billing: true,
      quote: '“Pure sunshine and trouble.” — The Daily Vice',
      tagline: 'ONE LAST SUMMER JOB',
      credits: 'A Vice Panels Production · Starring You · Shot on Your Own Camera · Graded by Hand',
    },
    panels: [],
    selected: 0,
    activePhotoId: SAMPLE_PHOTOS[0].id,
  };

  const portrait = () => state.size.h > state.size.w;
  const panelPolys = () => panelsFor(state.layoutId, portrait());

  // syncPanels keeps one placement per panel of the current layout,
  // dealing the built-in samples across any panel that has none yet so
  // a fresh cover never repeats a photo. A dealt panel inherits its
  // sample's name tag and focal point.
  function syncPanels() {
    const count = panelPolys().length;
    const next = [];
    for (let i = 0; i < count; i++) {
      if (state.panels[i]) { next.push(state.panels[i]); continue; }
      const sample = SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length];
      next.push({
        photoId: sample.id,
        dx: 0, dy: 0, zoom: 1,
        fx: sample.fx, fy: sample.fy, tag: sample.tag,
      });
    }
    state.panels = next;
    state.selected = clamp(state.selected, 0, count - 1);
  }

  function view() {
    return {
      width: state.size.w,
      height: state.size.h,
      layoutId: state.layoutId,
      grade: gradeById(state.gradeId),
      caption: state.caption,
      furniture: state.furniture,
      panels: state.panels.map((p) => ({
        photo: store.get(p.photoId)?.img ?? null,
        dx: p.dx, dy: p.dy, zoom: p.zoom, fx: p.fx, fy: p.fy, tag: p.tag,
      })),
    };
  }

  function redraw() {
    canvas.width = state.size.w;
    canvas.height = state.size.h;
    const v = view();
    drawCover(ctx, v);
    drawSelection(ctx, v, state.selected);
  }

  // ---- panel info + zoom controls ------------------------------------

  const panelLabel = doc.querySelector('#panel-label');
  const zoomInput = doc.querySelector('#zoom');
  const tagInput = doc.querySelector('#panel-tag');

  function refreshPanelControls() {
    const p = state.panels[state.selected];
    const photo = p ? store.get(p.photoId) : null;
    panelLabel.textContent = `Panel ${state.selected + 1} — ${photo ? photo.name : 'empty sunset'}`;
    zoomInput.value = String(Math.round((p?.zoom ?? 1) * 100));
    tagInput.value = p?.tag ?? '';
    renderTray();
  }

  zoomInput.addEventListener('input', () => {
    const p = state.panels[state.selected];
    if (p) { p.zoom = Number(zoomInput.value) / 100; redraw(); }
  });

  tagInput.addEventListener('input', () => {
    const p = state.panels[state.selected];
    if (p) { p.tag = tagInput.value; redraw(); }
  });

  doc.querySelector('#reset-panel').addEventListener('click', () => {
    const p = state.panels[state.selected];
    if (p) {
      const photo = store.get(p.photoId);
      p.dx = 0; p.dy = 0; p.zoom = 1;
      p.fx = photo?.fx ?? 0.5;
      p.fy = photo?.fy ?? 0.35;
    }
    refreshPanelControls();
    redraw();
  });

  // ---- photo tray -----------------------------------------------------

  const tray = doc.querySelector('#tray');

  function renderTray() {
    tray.replaceChildren();
    for (const photo of store.list()) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb';
      if (photo.id === state.activePhotoId) btn.classList.add('picked');
      if (photo.id === state.panels[state.selected]?.photoId) btn.classList.add('in-panel');
      const img = doc.createElement('img');
      img.src = photo.img.src;
      img.alt = photo.name;
      const label = doc.createElement('span');
      label.textContent = photo.name;
      btn.append(img, label);
      btn.addEventListener('click', () => assignPhoto(state.selected, photo.id));
      tray.append(btn);
    }
  }

  function assignPhoto(panelIndex, photoId) {
    const p = state.panels[panelIndex];
    const photo = store.get(photoId);
    if (!p || !photo) return;
    p.photoId = photoId;
    // A newly assigned photo brings its own name tag and focal point;
    // both stay editable afterwards.
    p.tag = photo.tag ?? '';
    p.fx = photo.fx ?? 0.5;
    p.fy = photo.fy ?? 0.35;
    p.dx = 0;
    p.dy = 0;
    state.activePhotoId = photoId;
    refreshPanelControls();
    redraw();
  }

  doc.querySelector('#fill-all').addEventListener('click', () => {
    for (const p of state.panels) p.photoId = state.activePhotoId;
    refreshPanelControls();
    redraw();
  });

  const fileInput = doc.querySelector('#photo-files');
  fileInput.addEventListener('change', async () => {
    const added = await store.addFiles(fileInput.files);
    if (added.length > 0) assignPhoto(state.selected, added[0].id);
    renderTray();
    fileInput.value = '';
  });

  const stage = doc.querySelector('.stage');
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dropping'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
  stage.addEventListener('drop', async (e) => {
    e.preventDefault();
    stage.classList.remove('dropping');
    const added = await store.addFiles(e.dataTransfer.files);
    if (added.length > 0) assignPhoto(state.selected, added[0].id);
    renderTray();
  });

  // ---- layout + grade pickers -----------------------------------------

  function buildPicker(container, items, currentId, onPick) {
    container.replaceChildren();
    for (const item of items) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'choice';
      btn.dataset.id = item.id;
      if (item.id === currentId) btn.classList.add('on');
      const name = doc.createElement('strong');
      name.textContent = item.name;
      const blurb = doc.createElement('span');
      blurb.textContent = item.blurb ?? '';
      btn.append(name, blurb);
      btn.addEventListener('click', () => onPick(item.id));
      container.append(btn);
    }
  }

  const layoutBox = doc.querySelector('#layout-choices');
  const gradeBox = doc.querySelector('#grade-choices');

  function refreshPickers() {
    buildPicker(layoutBox, LAYOUTS, state.layoutId, (id) => {
      state.layoutId = id;
      syncPanels();
      refreshPickers();
      refreshPanelControls();
      redraw();
    });
    buildPicker(gradeBox, GRADES, state.gradeId, (id) => {
      state.gradeId = id;
      refreshPickers();
      redraw();
    });
    buildPicker(styleBox, CAPTION_STYLES, state.caption.style, (id) => {
      state.caption.style = id;
      refreshPickers();
      redraw();
    });
  }

  // ---- caption --------------------------------------------------------

  const line1 = doc.querySelector('#caption-1');
  const line2 = doc.querySelector('#caption-2');
  line1.value = state.caption.line1;
  line2.value = state.caption.line2;
  line1.addEventListener('input', () => { state.caption.line1 = line1.value; redraw(); });
  line2.addEventListener('input', () => { state.caption.line2 = line2.value; redraw(); });

  const lettering = doc.querySelector('#lettering');
  lettering.addEventListener('input', () => {
    state.caption.scale = Number(lettering.value) / 100;
    redraw();
  });

  const styleBox = doc.querySelector('#style-choices');

  // ---- poster furniture -------------------------------------------------

  const fw = state.furniture;
  for (const key of ['strip', 'seal', 'ribbon', 'billing']) {
    const el = doc.querySelector(`#fw-${key}`);
    el.checked = fw[key];
    el.addEventListener('change', () => { fw[key] = el.checked; redraw(); });
  }
  for (const key of ['quote', 'tagline', 'credits']) {
    const el = doc.querySelector(`#fw-${key}`);
    el.value = fw[key];
    el.addEventListener('input', () => { fw[key] = el.value; redraw(); });
  }

  // ---- canvas: select + drag ------------------------------------------

  let drag = null;

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (canvas.width / rect.width),
      py: (e.clientY - rect.top) * (canvas.height / rect.height),
      nx: (e.clientX - rect.left) / rect.width,
      ny: (e.clientY - rect.top) / rect.height,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    const pt = canvasPoint(e);
    const polys = panelPolys();
    const hit = polys.findIndex((poly) => pointInPolygon(poly, pt.nx, pt.ny));
    if (hit < 0) return;
    state.selected = hit;
    const p = state.panels[hit];
    drag = { x: pt.px, y: pt.py, dx: p.dx, dy: p.dy };
    canvas.setPointerCapture(e.pointerId);
    refreshPanelControls();
    redraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = state.panels[state.selected];
    const photo = p ? store.get(p.photoId) : null;
    if (!p || !photo) return;
    const pt = canvasPoint(e);
    const b = panelBounds(panelPolys()[state.selected]);
    const box = { x: b.x * canvas.width, y: b.y * canvas.height, w: b.w * canvas.width, h: b.h * canvas.height };
    const fit = fitFor(photo.img, box, p.zoom);
    if (fit.slackX > 0) p.dx = clamp(drag.dx + (pt.px - drag.x) / fit.slackX, -1, 1);
    if (fit.slackY > 0) p.dy = clamp(drag.dy + (pt.py - drag.y) / fit.slackY, -1, 1);
    redraw();
  });

  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ---- export ----------------------------------------------------------

  const sizePicker = doc.querySelector('#size-picker');

  function setSize(w, h) {
    state.size = { w, h };
    for (const btn of sizePicker.children) {
      btn.classList.toggle('on', Number(btn.dataset.w) === w && Number(btn.dataset.h) === h);
    }
    syncPanels();
    refreshPanelControls();
    redraw();
  }

  for (const size of EXPORT_SIZES) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = size.label;
    btn.dataset.w = String(size.w);
    btn.dataset.h = String(size.h);
    if (size.w === state.size.w && size.h === state.size.h) btn.classList.add('on');
    btn.addEventListener('click', () => setSize(size.w, size.h));
    sizePicker.append(btn);
  }

  doc.querySelector('#download').addEventListener('click', () => {
    // Redraw without the selection outline: the export is the pure cover.
    drawCover(ctx, view());
    canvas.toBlob((blob) => {
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vice-panels-cover.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      redraw();
    }, 'image/png');
  });

  // ---- boot ------------------------------------------------------------

  try {
    const anton = new FontFace('Anton', "url('fonts/Anton-Regular.ttf')");
    const yellowtail = new FontFace('Yellowtail', "url('fonts/Yellowtail-Regular.ttf')");
    await Promise.all([anton.load(), yellowtail.load()]);
    doc.fonts.add(anton);
    doc.fonts.add(yellowtail);
  } catch {
    // The caption falls back to a heavy sans; the app still works.
  }
  await store.ready;
  syncPanels();
  refreshPickers();
  refreshPanelControls();
  redraw();

  // A small handle for the maker's own tooling and screenshots.
  return {
    state,
    store,
    redraw,
    setLayout(id) { state.layoutId = id; syncPanels(); refreshPickers(); refreshPanelControls(); redraw(); },
    setGrade(id) { state.gradeId = id; refreshPickers(); redraw(); },
    setCaption(l1, l2) {
      state.caption.line1 = l1; state.caption.line2 = l2;
      line1.value = l1; line2.value = l2; redraw();
    },
    assign: assignPhoto,
    setSize,
    setStyle(style) { state.caption.style = style; refreshPickers(); redraw(); },
    setTag(i, tag) {
      if (state.panels[i]) { state.panels[i].tag = tag; refreshPanelControls(); redraw(); }
    },
    setFurniture(partial) { Object.assign(state.furniture, partial); redraw(); },
    select(i) { state.selected = i; refreshPanelControls(); redraw(); },
  };
}
