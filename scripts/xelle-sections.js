// Every stage of the scroll experience has its own address, ?sectiune=<slug>,
// so it can be linked and reopened. Index i is scene i of the scroll camera;
// scene 7 is only the loop back to the entrance.
const XELLE_SECTIONS = [
  {slug: 'intrare', label: 'Intrare'},
  {slug: 'spiced-peach-negroni', label: 'Spiced Peach Negroni'},
  {slug: 'pornstar-martini', label: 'Pornstar Martini'},
  {slug: 'prosecco-di-cherry', label: 'Prosecco di Cherry'},
  {slug: 'maracuja-mojito', label: 'Maracuja Mojito'},
  {slug: 'filmul-xelle', label: 'Filmul Xellé'},
  {slug: 'galeria-xelle', label: 'Galeria Xellé'},
];
const xelleSectionState = {opened: false, shown: 0};

function xelleSectionUrl(index) {
  const url = new URL(window.location.href);
  ['colectie', 'produs'].forEach(key => url.searchParams.delete(key));
  if (index > 0) url.searchParams.set('sectiune', XELLE_SECTIONS[index].slug);
  else url.searchParams.delete('sectiune');
  return url.pathname + url.search + url.hash;
}

function xelleSectionIndex() { return xelleSectionState.shown; }

async function xelleGoToSection(index, duration = 1.5) {
  await Yr.initialized;
  Ps().setPodcastMode(false);
  const camera = Ir.viewsManager.get('mainScene')?.instance.scrollCamera;
  if (!camera) return;
  // scrollToScene ignores scene 0, so the entrance goes back along the track.
  if (index > 0) camera.scrollToScene(index, xelleMoveDuration(duration));
  else camera.scrollToSceneModular(0, xelleMoveDuration(duration), false);
}

// Runs every frame from the main scene. Once the loader is done it opens the
// linked section, then keeps the address in step with the settled stage.
function xelleSyncSectionLink(main) {
  const state = xelleSectionState;
  const camera = main._scrollCamera;
  if (!camera || !no().mainLoader.progressComplete) return;
  if (!state.opened) {
    xelleShopWarmup();
    const slug = new URLSearchParams(window.location.search).get('sectiune');
    const index = XELLE_SECTIONS.findIndex(section => section.slug === slug);
    if (index > 0) {
      camera.computeScenesPosition();
      if (!Number.isFinite(camera.getSceneScrollTarget(index))) return; // timeline not ready yet
      camera.scrollToScene(index, 0);
    }
    state.opened = true;
    state.shown = Math.max(index, 0);
    return;
  }
  xelleScrollSettle(camera, performance.now());
  // The shop pages own the address while they are open.
  if (xelleShopIsOpen()) return;
  // A stage counts once its entry is complete (in === current).
  const {in: sceneIn, current} = Yr.config.currentScene;
  const index = Number(current);
  if (Number(sceneIn) !== index || !XELLE_SECTIONS[index]) return;
  if (index === state.shown) return;
  state.shown = index;
  window.history.replaceState(window.history.state, '', xelleSectionUrl(index));
}
