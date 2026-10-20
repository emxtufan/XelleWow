// Concentric transparent surfaces must draw from the interior to the outer glass.
// Keep the opaque label/cap in the depth buffer, so glass never veils their print.
function xelleConfigureBottleMaterial(mesh) {
  const material = mesh.material;
  material.defines.XELLE_BOTTLE = 1;
  if (mesh.name === 'xelle_bottle_glass' || mesh.name === 'xelle_glass_inner') {
    material.defines.XELLE_GLASS = 1;
  }
  if (mesh.name === 'xelle_spherical_black_cap') {
    material.defines.XELLE_CAP = 1;
  }
  if (mesh.name === 'xelle_fragrance_liquid') {
    material.defines.XELLE_LIQUID = 1;
  }
  // The printed label is seen small and at an angle: sharpen its texture
  // sampling (the renderer clamps this to what the device supports).
  const labelMap = /^xelle_front_label(_test)?$/.test(mesh.name) && material.reference?.map;
  if (labelMap && labelMap.anisotropy < 16) {
    labelMap.anisotropy = 16;
    labelMap.needsUpdate = true;
  }
  if (mesh.userData.xelleOpacity != null) {
    material.alpha = mesh.userData.xelleOpacity;
    material.depthWrite = false;
    material.depthTest = true;
    // Far inner wall of the glass, then the perfume, then the outer wall.
    const order = {
      xelle_glass_inner: 1,
      xelle_fragrance_liquid: 2,
      xelle_bottle_glass: 3
    };
    mesh.renderOrder = order[mesh.name] || 1;
  }
}

// Product scenes show the flacon larger than the original watch size so its
// label reads (bottle.sceneScale in scripts/xelle-products.json); the base
// stays where it was (the model's foot sits at y = -2.1).
function xelleBottleScale() { return XELLE_FLACON.bottle.sceneScale[oo.device.mobile ? 'mobile' : 'desktop']; }
