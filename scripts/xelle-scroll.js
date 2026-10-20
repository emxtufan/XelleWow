// Scroll pacing for the stage journey. The timeline gives stages unequal
// lengths (the film to gallery stretch is twice the others), and a quick swipe
// could carry the camera past a whole stage before the snap. Here every stage
// takes the same amount of input, and one gesture (input without a pause of
// XELLE_GESTURE_GAP ms) travels at most to the neighbouring stage.
const XELLE_GESTURE_GAP = 220;

// Visitors who ask for reduced motion get short automatic camera moves and no
// cursor-driven tilt; scrolling itself stays in their hands.
const xelleMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
function xelleReducedMotion() { return !!(xelleMotionQuery && xelleMotionQuery.matches); }
function xelleMoveDuration(seconds) { return xelleReducedMotion() ? Math.min(seconds, 0.6) : seconds; }
const XELLE_LAST_STAGE = 6;

function xelleScrollTarget(camera, delta, now) {
  const gesture = camera._xelleGesture || (camera._xelleGesture = {last: 0, targets: null, min: 0, max: Infinity, anchor: 0});
  if (now - gesture.last > XELLE_GESTURE_GAP || !gesture.targets) {
    const targets = [];
    for (let i = 0; i <= XELLE_LAST_STAGE; i++) targets.push(Number(camera.getSceneScrollTarget(i)));
    const valid = targets.every((t, i) => Number.isFinite(t) && (i === 0 || t > targets[i - 1]));
    gesture.targets = valid ? targets : null;
    if (valid) {
      // The gesture starts from the stage nearest to where the camera is heading.
      let anchor = 0;
      targets.forEach((t, i) => { if (Math.abs(t - camera._scrollTarget) < Math.abs(targets[anchor] - camera._scrollTarget)) anchor = i; });
      gesture.anchor = anchor;
      gesture.min = targets[Math.max(0, anchor - 1)];
      gesture.max = targets[Math.min(XELLE_LAST_STAGE, anchor + 1)];
    }
  }
  gesture.last = now;
  const targets = gesture.targets;
  if (!targets) return camera._scrollTarget + delta;
  // Scale the input by how long the stage being crossed is, against the average.
  const position = camera._scrollTarget;
  let segment = 0;
  for (let i = 0; i < XELLE_LAST_STAGE; i++) if (position >= targets[i]) segment = i;
  // Standing on a stage and going back crosses the stretch before it.
  if (delta < 0 && segment > 0 && position - targets[segment] < 1) segment--;
  const length = targets[segment + 1] - targets[segment];
  const average = (targets[XELLE_LAST_STAGE] - targets[0]) / XELLE_LAST_STAGE;
  const pace = Math.max(0.4, Math.min(2.5, length / average));
  return Math.max(gesture.min, Math.min(gesture.max, position + delta * pace));
}

// Some stretches have no snap keyframes in the timeline (film to gallery), so
// the engine leaves the camera between stages. Shortly after a gesture ends
// without an engine snap, finish it: on to the next stage once the gesture
// covered a little of the way, otherwise back to where it started.
const XELLE_SETTLE_DELAY = 450;
function xelleScrollSettle(camera, now) {
  const gesture = camera._xelleGesture;
  if (!gesture || !gesture.targets || gesture.settled === gesture.last || now - gesture.last < XELLE_SETTLE_DELAY) return;
  if (camera._snapping || camera._scrollToTl || camera._programmaticScrollActive) return;
  gesture.settled = gesture.last;
  const {targets, anchor} = gesture, position = camera._scrollTarget;
  // The engine's own snap rounds its stop a little; that counts as on a stage.
  const tolerance = 0.02 * (targets[XELLE_LAST_STAGE] - targets[0]) / XELLE_LAST_STAGE;
  if (targets.some(t => Math.abs(t - position) < tolerance)) return;
  const forward = position > targets[anchor];
  const next = Math.max(0, Math.min(XELLE_LAST_STAGE, anchor + (forward ? 1 : -1)));
  const covered = Math.abs(position - targets[anchor]) / Math.max(1, Math.abs(targets[next] - targets[anchor]));
  const stage = covered > 0.12 ? next : anchor;
  if (stage > 0) camera.scrollToScene(stage, xelleMoveDuration(1.4));
  else camera.scrollToSceneModular(0, xelleMoveDuration(1.4), false);
}
