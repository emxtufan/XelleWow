// Procedural olfactory bar. Positions are in the main scene's world coordinates.
// The caller owns visibility, placement in the scene, and disposal of meshes.
function xelleCreateIntroSet() {
  const group = new cp();
  group.name = 'Xelle_intro_olfactory_bar';
  group.userData = {sceneIndex: 0, xelleIntroSet: true, no_mirror: false};
  const meshes = [];
  const pedestals = [];
  const accents = [];

  const vertexShader = `
precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

  const fragmentShader = `
precision highp float;
uniform vec3 uColor;
uniform float uMetal;
uniform float uMirrored;
uniform float uBright;
uniform vec3 cameraPosition;
in vec3 vWorld;
in vec3 vNormal;
out vec4 FragColor[2];

vec3 encodeSRGB(vec3 color) {
  return mix(12.92 * color,
    1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), color));
}

float grain(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

void main() {
  if (uMirrored > 0.5 && vWorld.y > 0.0) discard;
  vec3 color;
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 key = normalize(vec3(-0.42, 0.79, -0.46));
    vec3 fill = normalize(vec3(0.76, 0.39, -0.42));
    vec3 rim = normalize(vec3(0.24, 0.56, 0.79));
    float keyLight = max(dot(N, key), 0.0);
    float fillLight = max(dot(N, fill), 0.0);
    float rimLight = max(dot(N, rim), 0.0);
    float sky = N.y * 0.5 + 0.5;
    vec3 ambient = mix(vec3(0.21, 0.17, 0.14), vec3(0.48, 0.41, 0.32), sky);
    vec3 illumination = ambient
      + vec3(1.10, 0.88, 0.64) * keyLight
      + vec3(0.32, 0.34, 0.36) * fillLight
      + vec3(0.68, 0.43, 0.19) * rimLight;
    float stone = mix(0.975, 1.025, grain(vWorld * 77.0));
    color = uColor * illumination * mix(stone, 1.0, uMetal);
    float specular = pow(max(dot(N, normalize(key + V)), 0.0), mix(16.0, 54.0, uMetal));
    float rimSpecular = pow(max(dot(N, normalize(rim + V)), 0.0), 36.0);
    color += mix(vec3(0.035), vec3(0.71, 0.49, 0.25), uMetal)
      * (specular + rimSpecular * 0.45);
  color *= uBright;
  FragColor[0] = vec4(encodeSRGB(max(color, vec3(0.0))), 1.0);
  FragColor[1] = vec4(0.0);
}
`;

  function material(name, color, metal = 0) {
    return new Hi({
      name,
      uniforms: {
        uColor: {value: new Gr(color)},
        uMetal: {value: metal},
        uMirrored: {value: 0},
        uBright: {value: 1}
      },
      vertexShader,
      fragmentShader,
      glslVersion: Fi,
      side: 2,
      depthWrite: true,
      depthTest: true,
      transparent: false,
      toneMapped: false
    });
  }

  function add(name, geometry, surface, position, collection) {
    const mesh = new Sa(geometry, surface);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.userData = {sceneIndex: 0, xelleIntroSet: true, no_mirror: false};
    group.add(mesh);
    meshes.push(mesh);
    if (collection) collection.push(mesh);
    return mesh;
  }

  function ringGeometry(innerRadius, outerRadius) {
    const geometry = new df(1, 1, 112, 1);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const angle = (positions.getX(i) + 0.5) * Math.PI * 2;
      const radius = innerRadius + (positions.getY(i) + 0.5) * (outerRadius - innerRadius);
      positions.setXYZ(i, Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  // Keep the original room and reflective floor exposed, including its animated
  // caustics and strong backlight. This set contributes only the display objects.

  const slots = [
    {x: 4.8, z: 5.8, top: 0.65, color: '#302b27'},
    {x: 1.6, z: 5.8, top: 1.10, color: '#513722'},
    {x: -1.6, z: 5.8, top: 1.10, color: '#43282c'},
    {x: -4.8, z: 5.8, top: 0.65, color: '#363a2b'}
  ];

  slots.forEach((slot, index) => {
    const suffix = String(index + 1).padStart(2, '0');
    const baseY = 0.075;
    const body = add('Xelle_intro_plinth_' + suffix,
      new eu(1.49, 1.68, slot.top - baseY, 112, 1, false),
      material('Xelle_intro_stone_' + suffix, slot.color),
      [slot.x, (slot.top + baseY) / 2, slot.z], pedestals);
    body.userData.xelleIntroSlot = index;
    body.userData.xellePedestalTop = slot.top;

    // Recessed foot floats the matte body just above the continuous dark floor.
    add('Xelle_intro_plinth_foot_' + suffix, new eu(1.51, 1.51, 0.062, 96),
      material('Xelle_intro_foot_' + suffix, '#141311'),
      [slot.x, 0.043, slot.z]);

    add('Xelle_intro_brass_edge_' + suffix, ringGeometry(1.466, 1.492),
      material('Xelle_intro_brass_' + suffix, '#9d7949', 1),
      [slot.x, slot.top + 0.0015, slot.z], accents);
    add('Xelle_intro_brass_lip_' + suffix, new eu(1.494, 1.498, 0.019, 112, 1, true),
      material('Xelle_intro_brass_lip_material_' + suffix, '#967044', 1),
      [slot.x, slot.top - 0.008, slot.z], accents);
  });

  return {group, meshes, pedestals, accents};
}
