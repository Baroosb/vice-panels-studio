// The photo store: every picture the maker can place, kept only in
// this page's memory. Uploads are read from the maker's own machine
// and never sent anywhere; the two bundled samples are loaded from
// the app folder so the studio works the moment it opens.

export class PhotoStore {
  constructor() {
    this.items = [];
    this.byId = new Map();
    this.seq = 0;
  }

  register(img, name) {
    const id = `photo-${++this.seq}`;
    const item = { id, name, img };
    this.items.push(item);
    this.byId.set(id, item);
    return id;
  }

  /** Load an image from a URL (app-relative for samples). */
  loadUrl(url, name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(this.register(img, name));
      img.onerror = () => reject(new Error(`could not load ${url}`));
      img.src = url;
    });
  }

  /** Read a File from the maker's machine into the store. */
  loadFile(file) {
    const url = URL.createObjectURL(file);
    return this.loadUrl(url, file.name || 'Uploaded photo').then((id) => id);
  }

  get(id) {
    const item = this.byId.get(id);
    return item ? item.img : null;
  }

  has(id) {
    return this.byId.has(id);
  }
}
