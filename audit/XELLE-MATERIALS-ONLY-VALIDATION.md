# Runtime material adjustment — 14 September 2026

Scope confirmed by the user: apply materials to the existing website flacon and preserve its original geometry, dimensions and label. The supplied Blender model is not imported.

Only the three existing runtime material helpers and generated bundle are changed:

- Less diffuse light on glass, retaining defined edges and studio reflections.
- Liquid uses its existing perfume color with a darker tint at grazing angles.
- Lower key/fill intensity on the black cap.
- Opaque label, atomizer, tube, geometry, scale, animation and placement behavior retain their existing paths.

Validation:

- SHA-256 comparison against the preceding Desktop project: all eight desktop/mobile perfume GLBs are byte-identical. Their mesh geometry, UVs and embedded label textures therefore remain exact.
- Placement helper is byte-identical to the preceding version.
- Independent shader review confirmed scoped liquid tagging, bounded powers/interpolation and unchanged label rendering branch.
- Rebuilt bundle: 64 guarded patches and seven content tables. JavaScript syntax check and existing static asset checks passed.
- Browser inspected at 1280 × 800 and 393 × 852, including front/rotated product view and return to the home scene. The narrow viewport is not a physical mobile device test.
- No new shader errors observed. Existing Theatre studio initialization and video play/pause messages remain unrelated.

The adjustments remain compatible with the existing alpha-blended renderer; no physical refraction is added.
