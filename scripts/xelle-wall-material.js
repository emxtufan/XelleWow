// Compiled into the preserved scene runtime by build_xelle.cjs.
// Photos remain unchanged; the shader fits them onto the actual 3D surfaces.
const xelleWallVertex = os(`
precision highp float;
in vec3 position;
in vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform vec4 uBounds;
uniform float uUseBounds;
out vec2 vUv;
void main() {
  vUv = uv;
  if (uUseBounds > 0.5) {
    vUv = vec2(
      (position.x - uBounds.x) / max(0.00001, uBounds.z - uBounds.x),
      1.0 - (position.y - uBounds.y) / max(0.00001, uBounds.w - uBounds.y)
    );
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`, 'vertexShader');

const xelleWallFragment = os(`
precision highp float;
uniform sampler2D tPhoto;
uniform float uWallAspect;
uniform float uImageAspect;
uniform float uCenter;
uniform float uDark;
in vec2 vUv;
out vec4 FragColor[2];
vec3 encodeSRGB(vec3 value) {
  return mix(12.92 * value,
    1.055 * pow(max(value, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), value));
}
void main() {
  vec2 fit = uWallAspect > uImageAspect
    ? vec2(uWallAspect / uImageAspect, 1.0)
    : vec2(1.0, uImageAspect / uWallAspect);
  vec2 photoUv = (vUv - vec2(uCenter, 0.5)) * fit + 0.5;
  float inside = step(0.0, photoUv.x) * step(photoUv.x, 1.0)
    * step(0.0, photoUv.y) * step(photoUv.y, 1.0);
  vec3 photo = texture(tPhoto, clamp(photoUv, 0.0, 1.0)).rgb;
  vec3 color = mix(vec3(0.82, 0.81, 0.78), photo, inside);
  color *= 1.0 - clamp(uDark, 0.0, 1.0);
  FragColor[0] = vec4(encodeSRGB(clamp(color, 0.0, 1.0)), 1.0);
  FragColor[1] = vec4(0.0);
}`, 'fragmentShader');

class XelleWallPhotoMaterial extends Hi {
  constructor({material, object} = {}) {
    const metadata = typeof object.userData.xellePhoto === 'object'
      ? object.userData.xellePhoto : {};
    const map = material.map.clone();
    map.flipY = false;
    map.colorSpace = Mo;
    map.needsUpdate = true;
    const image = map.image;
    const bounds = metadata.bounds;
    super({
      name: 'XelleWallPhotoMaterial---' + material.name,
      uniforms: {
        tPhoto: {value: map},
        uWallAspect: {value: metadata.aspect || object.userData.xelleWallAspect || 1},
        uImageAspect: {value: (image.width || image.naturalWidth || 1) / (image.height || image.naturalHeight || 1)},
        uCenter: {value: metadata.center ?? 0.5},
        uBounds: {value: new ys(...(bounds || [0, 0, 1, 1]))},
        uUseBounds: {value: bounds ? 1 : 0},
        uDark: {value: 0},
        // The existing animated panels bind these even for photo materials.
        tFluidSim: {value: null},
        tFluidVelocity: {value: null}
      },
      glslVersion: Fi,
      side: material.side,
      depthWrite: true,
      depthTest: true,
      transparent: false,
      toneMapped: false
    });
    this.object = object;
    this.reference = material;
    xelleWallVertex.use(this);
    xelleWallFragment.use(this);
    this.stencilWrite = true;
    this.stencilFunc = nf;
    this.stencilRef = 16;
    this.stencilWriteMask = 255;
    this.stencilZPass = qv;
    this.stencilZFail = so;
    this.stencilFail = so;
  }
  get dark() { return this.uniforms.uDark.value; }
  set dark(value) { this.uniforms.uDark.value = value; }
  update() {
    const index = this.object.userData.sceneIndex || 0;
    const room = Yr.config.objectsVisibility['sc0' + index + '_room'];
    this.dark = 1 - (room?.dark ?? 1);
  }
  dispose() {
    this.uniforms.tPhoto.value.dispose();
    super.dispose();
  }
}
