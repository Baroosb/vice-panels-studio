// Vice Panels — Cover Art Studio: the page's entry module. It boots the
// editor and leaves its handle on window.VicePanels for the maker's own
// tooling. Everything runs from the app's own files, offline.

import { startEditor } from './editor.js';

startEditor(document).then((api) => {
  window.VicePanels = api;
});
