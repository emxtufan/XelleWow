// Sharp label print. The 3D label is a texture the camera resamples, so its
// text softens with distance and render scale. Every frame, moving or not, the
// label's ink (text, emblem, border; transparent paper) is drawn again as an
// image at the screen's own pixel density, mapped strip by strip onto the
// projected curve of the label. The lit paper stays in 3D underneath.
// Label surface from scripts/xelle-products.json (XELLE_FLACON, compiled in by
// build_xelle.cjs): image left at negative x, image top at label.top.
const XELLE_LABEL = {...XELLE_FLACON.label, strips: 32};
const xelleLabelPrint = {labels: [], images: {}, canvas: null, context: null, alpha: 0};

function xelleRegisterLabels(root, model, isIntro) {
  root.traverse(mesh => {
    if (mesh.name !== 'xelle_front_label') return;
    const label = {mesh, root, model, isIntro, modelView: null, projection: null, drawnAt: 0};
    // Flacons render with their own camera; keep the matrices of the pass that
    // draws the label upright on screen (the floor reflection draws it flipped).
    const previous = mesh.onBeforeRender;
    mesh.onBeforeRender = function (renderer, scene, camera) {
      previous.apply(this, arguments);
      const upright = mesh.modelViewMatrix.elements[5] * camera.projectionMatrix.elements[5] > 0;
      if (!upright) return;
      label.modelView = (label.modelView || mesh.modelViewMatrix.clone()).copy(mesh.modelViewMatrix);
      label.projection = (label.projection || camera.projectionMatrix.clone()).copy(camera.projectionMatrix);
      label.drawnAt = performance.now();
    };
    xelleLabelPrint.labels.push(label);
    xelleLabelImage(model);
  });
}

// A flacon may carry another print than its model's (root.userData.xelleLabel:
// the single intro flacon of portrait screens reads "Colecția Xellé").
function xelleLabelImage(key) {
  const images = xelleLabelPrint.images;
  if (!images[key]) {
    images[key] = new Image();
    images[key].decoding = 'async';
    images[key].src = `/xelle/labels/${key}_print.png`;
  }
  return images[key];
}

function xelleWorldVisible(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

function xelleLabelCanvas(scene) {
  const state = xelleLabelPrint;
  if (!state.canvas) {
    state.canvas = document.createElement('canvas');
    state.canvas.className = 'xelle-label-print';
    state.canvas.setAttribute('aria-hidden', 'true');
    state.context = state.canvas.getContext('2d');
  }
  if (state.canvas.previousElementSibling !== scene) scene.after(state.canvas);
  const ratio = Math.min(3, window.devicePixelRatio || 1);
  const width = Math.round(scene.clientWidth * ratio), height = Math.round(scene.clientHeight * ratio);
  if (state.canvas.width !== width || state.canvas.height !== height) {
    state.canvas.width = width;
    state.canvas.height = height;
    state.canvas.style.width = scene.clientWidth + 'px';
    state.canvas.style.height = scene.clientHeight + 'px';
  }
  if (state.canvas.style.filter !== scene.style.filter) state.canvas.style.filter = scene.style.filter;
  return state.context;
}

// Called from the scene update, before the frame renders: the print is drawn
// once the frame's work is done, from the matrices of the render just made, so
// it moves with the flacon instead of a frame behind it.
function xelleDrawLabels() {
  const state = xelleLabelPrint;
  state.frameAt = performance.now();
  if (state.queued) return;
  state.queued = true;
  queueMicrotask(() => { state.queued = false; xelleDrawLabelPrint(); });
}

function xelleDrawLabelPrint() {
  const scene = document.querySelector('.gpuApp canvas');
  if (!scene || !xelleLabelPrint.labels.length) return;
  const state = xelleLabelPrint, context = xelleLabelCanvas(scene);
  const {current} = Yr.config.currentScene;
  // Only labels rendered in this frame; the renderer toggles the label mesh
  // itself between passes, so the flacon above it carries the real visibility.
  const shown = state.labels.filter(label => {
    const image = xelleLabelImage(label.root.userData.xelleLabel || label.model);
    return image.complete && image.naturalWidth && label.drawnAt >= state.frameAt && xelleWorldVisible(label.mesh.parent)
      && !(label.isIntro && Number(current) !== 0);
  });
  // The 3D label is blank paper, so the print shows at once with its flacon;
  // labels turning into view fade in strip by strip (facing, below).
  state.alpha = shown.length ? 1 : 0;
  // Nothing moved since the last frame: the print on screen is still right.
  const signature = state.alpha + '|' + state.canvas.width + 'x' + state.canvas.height + '|'
    + shown.map(label => label.modelView.elements.join(',') + label.projection.elements.join(',')).join('|');
  if (signature === state.signature) return;
  state.signature = signature;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, state.canvas.width, state.canvas.height);
  if (!state.alpha) return;
  const width = state.canvas.width, height = state.canvas.height;
  const {radius, angle, top, bottom, strips} = XELLE_LABEL;
  for (const label of shown) {
    const image = xelleLabelImage(label.root.userData.xelleLabel || label.model);
    const Vector = label.mesh.position.constructor;
    const point = new Vector(), normal = new Vector();
    const normalMatrix = new (label.mesh.normalMatrix.constructor)().getNormalMatrix(label.modelView);
    const screen = (theta, y) => {
      point.set(radius * Math.sin(theta), y, radius * Math.cos(theta)).applyMatrix4(label.modelView).applyMatrix4(label.projection);
      return [(point.x + 1) / 2 * width, (1 - point.y) / 2 * height, point.z];
    };
    const imageWidth = image.naturalWidth, imageHeight = image.naturalHeight;
    // Intro flacons sink into their pedestals: the print is cut where the
    // pedestal top crosses the label (xelleLabelCut, in the label's own units).
    const cut = Math.max(bottom, label.root.userData.xelleLabelCut ?? bottom);
    if (cut >= top) continue;
    for (let i = 0; i < strips; i++) {
      const a0 = -angle + 2 * angle * i / strips, a1 = -angle + 2 * angle * (i + 1) / strips;
      const middle = (a0 + a1) / 2;
      // Strips turned away from the camera stay with the 3D label (360° view).
      point.set(radius * Math.sin(middle), (top + bottom) / 2, radius * Math.cos(middle)).applyMatrix4(label.modelView);
      normal.set(Math.sin(middle), 0, Math.cos(middle)).applyMatrix3(normalMatrix).normalize();
      const facing = -normal.dot(point.normalize());
      if (facing < 0.12) continue;
      const topLeft = screen(a0, top), topRight = screen(a1, top), bottomLeft = screen(a0, bottom), bottomRight = screen(a1, bottom);
      if (topLeft[2] > 1 || topRight[2] > 1 || bottomLeft[2] > 1) continue;
      const cutLeft = cut > bottom ? screen(a0, cut) : bottomLeft, cutRight = cut > bottom ? screen(a1, cut) : bottomRight;
      const sourceX = imageWidth * i / strips, sourceWidth = imageWidth / strips;
      context.save();
      // Each strip is clipped to its own quad, reaching two pixels under its
      // right-hand neighbour so antialiased edges never leave a seam (the 3D
      // label is blank paper, so a seam would show it through the ink).
      const across = Math.hypot(topRight[0] - topLeft[0], topRight[1] - topLeft[1]) || 1;
      const reachX = (topRight[0] - topLeft[0]) / across * 2, reachY = (topRight[1] - topLeft[1]) / across * 2;
      context.beginPath();
      context.moveTo(topLeft[0], topLeft[1]);
      context.lineTo(topRight[0] + reachX, topRight[1] + reachY);
      context.lineTo(cutRight[0] + reachX, cutRight[1] + reachY);
      context.lineTo(cutLeft[0], cutLeft[1]);
      context.closePath();
      context.clip();
      context.globalAlpha = state.alpha * Math.min(1, (facing - 0.12) / 0.2);
      context.setTransform(
        (topRight[0] - topLeft[0]) / sourceWidth, (topRight[1] - topLeft[1]) / sourceWidth,
        (bottomLeft[0] - topLeft[0]) / imageHeight, (bottomLeft[1] - topLeft[1]) / imageHeight,
        topLeft[0], topLeft[1]);
      // Half a strip of image on each side: the strip is shrunk several times
      // on screen, so the overlap under the neighbour needs image to cover it.
      const from = Math.max(0, sourceX - sourceWidth / 2), to = Math.min(imageWidth, sourceX + sourceWidth * 1.5);
      context.drawImage(image, from, 0, to - from, imageHeight, from - sourceX, 0, to - from, imageHeight);
      context.restore();
    }
  }
}
