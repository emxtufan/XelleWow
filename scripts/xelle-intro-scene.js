// Intro copies reuse the existing flacons and label textures. Product geometry,
// wrappers and their dimensions remain untouched.
const XELLE_INTRO_MODELS = ['roadster', 'baignoire', 'crash', 'santos'];
// Desktop hero: one straight row facing the camera.
const XELLE_INTRO_SLOTS = [[4.8, 0.65, 5.8], [1.6, 1.1, 5.8], [-1.6, 1.1, 5.8], [-4.8, 0.65, 5.8]];
// Real phones only: their scroll camera runs at zoom 0.6, unlike narrow desktop windows.
function xellePhoneLayout() { return oo.device.mobile; }

function xelleCreateIntro(main) {
  const set = xelleCreateIntroSet();
  const state = { ...set, bottles: [], width: 0, height: 0 };
  set.meshes.forEach(mesh => { mesh.userData.xelleOriginalPosition = mesh.position.toArray(); });
  XELLE_INTRO_MODELS.forEach((model, index) => {
    const bottle = Pr.get('watch_model_' + model).scene.clone(true);
    bottle.name = 'Xelle_intro_bottle_' + model;
    bottle.traverse(mesh => {
      if (!(mesh instanceof Sa)) return;
      const reference = mesh.material.reference || mesh.material;
      mesh.geometry = mesh.geometry.clone();
      mesh.material = new z2t(model, {
        material: reference, object: mesh,
        isTransparent: !!mesh.userData.isTransparent,
        lut: Pr.get('watch_lut_' + model), opacity: reference.opacity
      });
      xelleConfigureBottleMaterial(mesh);
      // Layered clear glass must preserve the background's light-effect mask.
      if (mesh.userData.xelleOpacity < 1) mesh.material.defines.XELLE_INTRO_TRANSPARENT = 1;
      ['watch_mode', 'stencil_by', 'stencil_id', 'mirror', 'lightmap'].forEach(key => { delete mesh.userData[key]; });
      mesh.userData.no_watch = true;
      mesh.userData.no_mirror = false;
      mesh.userData.sceneIndex = 0;
      mesh.material.dark = 0;
      state.meshes.push(mesh);
    });
    set.group.add(bottle);
    state.bottles.push(bottle);
    xelleRegisterLabels(bottle, model, true);
  });
  state.meshes.forEach(mesh => {
    mesh.userData.no_watch = true;
    main._objectsTraverse.push(mesh);
  });
  // The original floor reflects this wrapper in its dedicated mirror pass.
  main._sceneWrapper.add(set.group);
  main._xelleIntro = state;
  xelleOpenDoorFrames(main);
  // Portrait screens (phones, tablets) frame the centre painting exactly behind
  // the single flacon, which hides it; xelleResizeIntro leaves it out there,
  // reflection included, and brings it back in landscape.
  const doors = /^(MIRROR_)?(GEO_doorCenter_(frame|paper)|Xelle_painting_centerRight)$/;
  state.doors = main._meshes.filter(mesh => doors.test(mesh.name));
  state.doors.forEach(mesh => { mesh.userData.xelleNoMirror = mesh.userData.no_mirror; });
  xelleResizeIntro(main);
  xelleUpdateIntro(main);
}

// The entrance door frames keep only their outer border so each painting shows
// whole. A frame triangle belongs to the inner lattice when one of its corners
// lies more than a few units inside the convex outline of its painting, both
// measured in the painting's own plane (its photo basis axes). The painting's
// paper is cut into separate panes under that lattice, so it is redrawn as one
// fan over its outline; its UVs come from the basis, not from the panes.
function xelleOpenDoorFrames(main) {
  const done = new Set();
  main._meshes.forEach(frame => {
    if (!/^(MIRROR_)?GEO_door(Center|Left|Right)_frame$/.test(frame.name)) return;
    if (done.has(frame.geometry) || !frame.geometry.index) return;
    const paper = main._meshes.find(mesh => mesh.name === frame.name.replace('_frame', '_paper'));
    const basis = paper && paper.userData.xellePhoto && paper.userData.xellePhoto.basis;
    if (!basis) return;
    done.add(frame.geometry);
    const unit = axis => axis.slice(0, 3).map(value => value / Math.hypot(axis[0], axis[1], axis[2]));
    const eu = unit(basis.u), ev = unit(basis.v), point = frame.position.clone();
    const flat = () => [point.x * eu[0] + point.y * eu[1] + point.z * eu[2],
                        point.x * ev[0] + point.y * ev[1] + point.z * ev[2]];
    const outline = [], paperPosition = paper.geometry.attributes.position;
    for (let i = 0; i < paperPosition.count; i++) outline.push([...(point.fromBufferAttribute(paperPosition, i), flat()), i]);
    outline.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    // Monotone chain: lower then upper half of the counter-clockwise hull.
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const hull = [];
    [outline, outline.slice().reverse()].forEach(points => {
      const start = hull.length;
      points.forEach(p => {
        while (hull.length >= start + 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
        hull.push(p);
      });
      hull.pop();
    });
    if (!done.has(paper.geometry)) {
      done.add(paper.geometry);
      const fan = [];
      for (let j = 1; j + 1 < hull.length; j++) fan.push(hull[0][2], hull[j][2], hull[j + 1][2]);
      paper.geometry.setIndex(fan);
    }
    frame.updateWorldMatrix(true, false);
    paper.updateWorldMatrix(true, false);
    const toPaper = paper.matrixWorld.clone().invert().multiply(frame.matrixWorld);
    const position = frame.geometry.attributes.position, depth = [];
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(toPaper);
      const [x, y] = flat();
      depth.push(Math.min(...hull.map((a, j) => {
        const b = hull[(j + 1) % hull.length], ex = b[0] - a[0], ey = b[1] - a[1];
        return (ex * (y - a[1]) - ey * (x - a[0])) / Math.hypot(ex, ey);
      })));
    }
    const index = frame.geometry.index.array, kept = [];
    for (let i = 0; i < index.length; i += 3) {
      if (Math.max(depth[index[i]], depth[index[i + 1]], depth[index[i + 2]]) <= 8) kept.push(index[i], index[i + 1], index[i + 2]);
    }
    frame.geometry.setIndex(kept);
    // The centre door's two leaves stop short of each other along local x;
    // with their meeting stiles gone, close the outer rails across that gap.
    if (/Center/.test(frame.name)) {
      kept.forEach(i => { if (Math.abs(position.getX(i)) < 40) position.setX(i, 0); });
      position.needsUpdate = true;
    }
  });
}

function xelleResizeIntro(main) {
  const state = main._xelleIntro;
  if (!state) return;
  const width = wi.innerWidth, height = wi.innerHeight;
  if (state.width === width && state.height === height) return;
  state.width = width; state.height = height;
  const narrow = width / height < 0.90;
  (state.doors || []).forEach(mesh => {
    mesh.userData.xelleHidden = narrow;
    mesh.userData.no_mirror = narrow || mesh.userData.xelleNoMirror;
    mesh.visible = !narrow;
  });
  state.group.position.z = narrow ? -0.4 : -1.5;
  const scale = narrow ? 1.22 : Math.min(1.12, Math.max(0.90, width / height * 0.76));
  // Phones render the scroll camera at zoom 0.6 (see _baseZoom), which pushes
  // the centred flacon far back; bring it to 7.5 units from the camera there.
  const closeZ = xellePhoneLayout() ? 1.4 : 8.2;
  state.bottles.forEach((bottle, index) => {
    const [x, top, z] = XELLE_INTRO_SLOTS[index];
    bottle.visible = !narrow || index === 0;
    bottle.scale.setScalar(scale);
    // Each label faces the camera, about 6.2 units in front of the desktop row.
    bottle.rotation.set(0, Math.PI + (narrow ? 0 : Math.atan2(x, 6.2)), 0);
    bottle.position.set(narrow ? 0 : x, top + 2.1 * scale + 0.004, narrow ? closeZ : z);
  });
  state.meshes.forEach(mesh => {
    if (!mesh.userData.xelleIntroSet) return;
    const slot = mesh.name.match(/_(0[1-4])$/);
    const original = mesh.userData.xelleOriginalPosition;
    if (slot) {
      const index = Number(slot[1]) - 1;
      // Gate the parent of decorative plinth meshes through an explicit flag;
      // the main render-pass switch restores only their previous visibility.
      mesh.userData.xelleIntroLayoutHidden = narrow && index !== 0;
      mesh.position.fromArray(original);
      if (narrow && index === 0) { mesh.position.x = 0; mesh.position.z = closeZ; }
    }
  });
}

function xelleUpdateIntro(main) {
  xelleSyncSectionLink(main);
  const state = main._xelleIntro;
  if (!state) return;
  xelleResizeIntro(main);
  const sceneIn = Number(Yr.config.currentScene.in);
  const sceneOut = Number(Yr.config.currentScene.out);
  const time = main._scrollCamera?._action?.time || 0;
  const progress = Math.max(0, Math.min(1, (time - 0.12) / 1.15));
  const eased = progress * progress * (3 - 2 * progress);
  state.group.visible = !main._open && !main._loopMade && (sceneIn === 0 || sceneOut === 0) && time < 1.30;
  state.group.position.y = -13 * eased;
  state.meshes.forEach(mesh => {
    if (!mesh.userData.xelleIntroSet) return;
    if (mesh.userData.xelleIntroLayoutHidden) { mesh.visible = false; mesh.prevVisible = null; }
    else mesh.visible = true;
  });
}

function xelleIntroLightScale(main, intensity) {
  const time = main._scrollCamera?._action?.time || 0;
  const {in: sceneIn, out: sceneOut} = Yr.config.currentScene;
  if (main._open || main._loopMade || time >= 1.30 ||
      (Number(sceneIn) !== 0 && Number(sceneOut) !== 0)) return 1;
  const progress = Math.max(0, Math.min(1, (time - 0.12) / 1.15));
  const eased = progress * progress * (3 - 2 * progress);
  return intensity + (1 - intensity) * eased;
}

// The original renders desktops at 1.5× and phones at 1.25× the CSS pixels,
// whatever the screen: on 2× laptops and 3× phones the frame was stretched and
// looked soft. The scene now starts at the screen's own density, up to 2×.
// Cards that cannot hold 50 fps (labels stay sharp through xelle-label-print.js,
// so fluency wins over render scale) drop straight to the level
// their measured speed allows (cost grows with the square of the scale); it
// only steps down, so the picture never pumps. Strong cards keep full sharpness.
const XELLE_RENDER_SCALES = [2, 1.75, 1.5, 1.25, 1, 0.75];
function xelleStartRenderScale(original) {
  return Math.min(2, Math.max(original, window.devicePixelRatio || 1));
}
const xelleFrameRate = {last: 0, frames: 0, time: 0, settleUntil: 0, window: 1000};
function xelleAdaptResolution() {
  const rate = xelleFrameRate, now = performance.now(), delta = now - rate.last;
  rate.last = now;
  if (!no().mainLoader.progressComplete) return;
  // The first verdict comes while the sound question still blurs the scene,
  // so a resolution change there goes unseen; later checks use longer windows.
  if (!rate.settleUntil) rate.settleUntil = now + 500;
  // Pauses (hidden tab, shop pages) and the moments right after a change do not count.
  if (delta > 250 || now < rate.settleUntil || document.hidden) { rate.frames = 0; rate.time = 0; return; }
  rate.frames++;
  rate.time += delta;
  if (rate.time < rate.window) return;
  const fps = rate.frames * 1000 / rate.time;
  rate.frames = 0;
  rate.time = 0;
  rate.window = 2000;
  if (fps >= 50) return;
  const renderer = Ir.renderer;
  const current = renderer._forcedRenderScale ?? renderer._renderScale;
  const lower = XELLE_RENDER_SCALES.filter(scale => scale < current - 0.01);
  if (!lower.length) return;
  const next = lower.find(scale => fps * (current / scale) ** 2 >= 55) ?? lower[lower.length - 1];
  renderer._forcedRenderScale = next;
  Ir.forceResize();
  rate.settleUntil = now + 1500;
}

// The main scene is drawn three times a frame (scene, then two flacon passes
// that only toggle visibility), and three.js recomputed every world matrix on
// each draw. Matrices are now computed once per frame for that scene: the
// renderer (build_xelle.cjs) asks xelleUpdateSceneMatrices, and this frame
// stamp moves on once per main-scene update.
var xelleMatrixStamp = 0;
function xelleUpdateSceneMatrices(scene) {
  const stamp = scene.userData.xelleMatrixStamp;
  if (stamp === undefined) { scene.updateMatrixWorld(); return; }
  if (stamp === xelleMatrixStamp) return;
  scene.userData.xelleMatrixStamp = xelleMatrixStamp;
  scene.updateMatrixWorld();
}

function xelleApplyIntroLighting(main) {
  xelleMatrixStamp++;
  let root = main._sceneWrapper;
  while (root && root.parent) root = root.parent;
  if (root && root.userData.xelleMatrixStamp === undefined) root.userData.xelleMatrixStamp = -1;
  xelleAdaptResolution();
  // Original animation updates refresh these uniforms immediately before this
  // hook, so the attenuation never accumulates from one frame to the next.
  const shaftScale = xelleIntroLightScale(main, 0.12);
  const glowScale = xelleIntroLightScale(main, 0.08);
  for (const mesh of main._lightShafts || []) {
    if (mesh.material?.uniforms?.uAlpha) mesh.material.uniforms.uAlpha.value *= shaftScale;
  }
  for (const mesh of main._glowSpheresComponent?.spheres || []) {
    if (mesh.material?.uniforms?.uAlpha) mesh.material.uniforms.uAlpha.value *= glowScale;
  }
  // The first page reads livelier: the whole frame gains colour while the intro
  // is on screen and returns to normal along the same scroll curve.
  const vivid = 1 - xelleIntroLightScale(main, 0);
  const filter = vivid > 0.001
    ? `saturate(${(1 + 0.5 * vivid).toFixed(3)}) contrast(${(1 + 0.16 * vivid).toFixed(3)}) brightness(${(1 - 0.04 * vivid).toFixed(3)})` : '';
  const canvas = document.querySelector('.gpuApp canvas');
  if (canvas && canvas.style.filter !== filter) canvas.style.filter = filter;
}

function xelleDestroyIntro(main) {
  const state = main._xelleIntro;
  if (!state) return;
  state.group.removeFromParent();
  const owned = new Set(state.meshes);
  main._objectsTraverse = main._objectsTraverse.filter(mesh => !owned.has(mesh));
  state.meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
  main._xelleIntro = null;
}

async function xelleIntroSelect(event, index) {
  event.stopPropagation();
  await Yr.initialized;
  Ps().setPodcastMode(false);
  Ir.viewsManager.get('mainScene')?.instance.scrollCamera.scrollToScene(index + 1, 1.8);
}

function xelleIntroInterface() {
  return Na('section', {class: 'xelle-intro', 'aria-label': 'Universul parfumurilor Xellé'}, [
    Na('button', {type: 'button', class: 'xelle-intro__explore', 'aria-label': 'Descoperă colecția Xellé', onClick: event => xelleIntroSelect(event, 0)}, [
      Na('span', {class: 'xelle-intro__arrow', 'aria-hidden': 'true'}, '↓')
    ])
  ]);
}
