// The photo store: every picture the cover can use, built-in artwork and
// the maker's own photos side by side. User photos are read with object
// URLs on this machine only — nothing is uploaded, nothing is fetched
// beyond the app's own sample files.
//
// Each built-in sample carries the two things a poster panel needs: a
// character name tag for its label, and a focal point (fx, fy in 0..1)
// the crop centres on by default — upper-centre for the character
// photos, so a tight panel crop lands on the face, not the torso.

export const SAMPLE_PHOTOS = [
  { id: 'kit-boulevard', src: 'samples/kit-boulevard.jpg', name: 'Boulevard portrait', tag: 'THE DRIVER', fx: 0.36, fy: 0.27 },
  { id: 'kit-pier', src: 'samples/kit-pier.jpg', name: 'Pier portrait', tag: 'THE CAPTAIN', fx: 0.62, fy: 0.20 },
  { id: 'sample-boulevard', src: 'samples/boulevard.jpg', name: 'Neon boulevard', tag: 'THE GETAWAY', fx: 0.5, fy: 0.42 },
  { id: 'sample-speedboat', src: 'samples/speedboat.jpg', name: 'Speedboat', tag: 'THE LOOKOUT', fx: 0.5, fy: 0.45 },
  { id: 'sample-skyline', src: 'samples/skyline.jpg', name: 'Skyline', tag: 'THE BOSS', fx: 0.5, fy: 0.40 },
  { id: 'sample-boardwalk', src: 'samples/boardwalk.jpg', name: 'Boardwalk', tag: 'THE MECHANIC', fx: 0.5, fy: 0.40 },
];

export const DEFAULT_FOCAL = { fx: 0.5, fy: 0.35 };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

// createPhotoStore keeps an ordered list of photos and hands them out
// by id. `ready` resolves once the built-in samples have loaded, so the
// first render already shows a finished cover.
export function createPhotoStore() {
  const photos = [];
  const byId = new Map();
  let userCount = 0;

  function register(def, img) {
    const photo = { tag: '', fx: DEFAULT_FOCAL.fx, fy: DEFAULT_FOCAL.fy, ...def, img };
    photos.push(photo);
    byId.set(photo.id, photo);
    return photo;
  }

  const ready = (async () => {
    for (const sample of SAMPLE_PHOTOS) {
      const img = await loadImage(sample.src);
      register(sample, img);
    }
  })();

  return {
    ready,
    list: () => photos.slice(),
    get: (id) => byId.get(id) ?? null,
    first: () => photos[0] ?? null,

    // addFiles reads picked or dropped image files and appends them to
    // the tray, returning the photos that were added.
    async addFiles(fileList) {
      const added = [];
      for (const file of fileList) {
        if (!file.type.startsWith('image/')) continue;
        const url = URL.createObjectURL(file);
        const img = await loadImage(url);
        userCount += 1;
        added.push(register({
          id: `user-${userCount}`,
          name: file.name.replace(/\.[^.]+$/, ''),
        }, img));
      }
      return added;
    },
  };
}

// defaultAssignment deals the built-in samples across the panels in
// order, so a fresh cover never repeats one photo in two panels.
export function defaultAssignment(panelCount) {
  return SAMPLE_PHOTOS.slice(0, panelCount).map((s) => s.id);
}
