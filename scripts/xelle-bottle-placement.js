// Bottles use a separate fixed-camera render pass. Keep their soft shadow in that
// same pass, with an offset that fades out into the original product presentation.
const XELLE_BOTTLE_DROP = 0.90;
const XELLE_BOTTLE_BASE = -0.84; // Model minimum Y (-2.1) times runtime scale (0.4).

function xelleCreateBottleShadow(wrapper) {
  const material = new Hi({
    name: 'XelleBottleShadowMaterial',
    glslVersion: Fi,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: {uAlpha: {value: 0}},
    vertexShader: `precision highp float;
      in vec3 position;
      in vec2 uv;
      uniform mat4 projectionMatrix;
      uniform mat4 modelViewMatrix;
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `precision highp float;
      in vec2 vUv;
      uniform float uAlpha;
      out vec4 FragColor[2];
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        float soft = exp(-4.5 * r * r) * (1.0 - smoothstep(0.65, 1.0, r));
        float alpha = uAlpha * soft;
        if (alpha < 0.001) discard;
        FragColor[0] = vec4(0.0, 0.0, 0.0, alpha);
        FragColor[1] = vec4(0.0);
      }`
  });
  const shadow = new Sa(new df(1.65, 0.28), material);
  shadow.name = 'XelleBottleShadow';
  shadow.userData.watch_mode = 2;
  shadow.userData.no_mirror = true;
  // A soft ellipse stays readable through the original camera's shallow angle.
  // Match the render camera orientation even while the bottle wrapper turns.
  const parentRotation = shadow.quaternion.clone();
  const cameraRotation = shadow.quaternion.clone();
  const parentScale = new at();
  shadow.onBeforeRender = (renderer, scene, camera) => {
    if (material.uniforms.uAlpha.value < 0.001 || shadow.scale.x < 0.001) return;
    shadow.parent.getWorldScale(parentScale);
    if (Math.min(Math.abs(parentScale.x), Math.abs(parentScale.y), Math.abs(parentScale.z)) < 0.001) return;
    shadow.parent.getWorldQuaternion(parentRotation);
    camera.getWorldQuaternion(cameraRotation);
    shadow.quaternion.copy(parentRotation.invert()).multiply(cameraRotation);
    shadow.updateMatrixWorld(true);
  };
  wrapper._scrollWrapper.add(shadow);
  wrapper._xelleBottleShadow = shadow;
}

function xelleUpdateBottleShadow(wrapper, bottleScale, productProgress) {
  const home = 1 - Math.max(0, Math.min(1, productProgress));
  const drop = XELLE_BOTTLE_DROP * home;
  wrapper._dragWrapper.position.y = -0.3 - drop;
  const shadow = wrapper._xelleBottleShadow;
  shadow.scale.setScalar(bottleScale);
  shadow.position.set(0, -0.3 - drop + XELLE_BOTTLE_BASE * bottleScale - 0.025, -0.15);
  const inPerfumeScene = wrapper._currentScene >= 1 && wrapper._currentScene <= 4;
  // Visibility is also controlled by render passes; alpha prevents stray shadows.
  shadow.material.uniforms.uAlpha.value = inPerfumeScene ? 0.34 * home : 0;
}

function xelleDestroyBottleShadow(wrapper) {
  const shadow = wrapper._xelleBottleShadow;
  if (!shadow) return;
  shadow.removeFromParent();
  shadow.geometry.dispose();
  shadow.material.dispose();
  wrapper._xelleBottleShadow = null;
}
