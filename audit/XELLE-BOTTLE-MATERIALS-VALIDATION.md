# Bottle material refinement — 14 September 2026

The four Xellé flacons now use denser glass and liquid, defined glass edges and product studio reflections. The spherical black cap no longer reflects the inherited watch environment's ring of six lights.

## Implementation

- Glass opacity: 0.38; thick base: 0.68; liquid: 0.85. Glass and liquid are nonmetallic. The black cap uses roughness 0.17 and metalness 0.05.
- Glass diffuse light is reduced to avoid a white painted appearance. Grazing-angle opacity reaches 0.92, making the silhouette and base more legible.
- Camera-relative key/fill reflections describe the curved glass and cap; the cap's broad highlight is separated from the thin glass highlights. The light basis handles vertical viewing directions.
- Transparent interior surfaces render before the base and shell, with depth tests enabled and depth writes disabled. The opaque label and cap remain in the depth buffer.
- Geometry, normals, UVs and embedded label image bytes are identical to the preceding eight desktop/mobile GLBs. The home offset remains 0.90 and its soft shadow is unchanged.

## Validation

- Bundle rebuilt successfully with 64 guarded runtime patches and seven content tables; JavaScript syntax check passed.
- Static asset checks passed, including matching glTF opacity and mesh metadata, the eight bottle GLBs and two scene GLBs, retained film/gallery resources, and all previous scene visibility rules.
- Independent comparison confirmed byte-identical binary chunks for all eight perfume GLBs; changes are limited to material records and opacity metadata.
- Browser: Spiced Peach Negroni and Pornstar Martini inspected at 1280 × 800. Prosecco di Cherry and Maracuja Mojito inspected at 393 × 852. The latter is a narrow desktop viewport, not a physical mobile device test.
- Product 360° view inspected from the front and side/back after dragging. Label remains unobscured and glass highlights follow the curved surface. Home/product navigation retained the existing placement behavior.
- Final browser builds rendered without new shader errors. Existing Theatre studio initialization and video play/pause interruption messages remain unrelated to these material changes.

This is a lightweight visual approximation within the preserved custom renderer; it does not add physical ray-traced transmission or refraction.
