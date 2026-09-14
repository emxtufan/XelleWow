# Transparent bottle render diagnosis

Inspected `original/app.js`, working integration in `scripts/build_xelle.cjs`, bottle generator, and `audit/xelle-first-render.jpg`. No renderer edits performed by this subtask.

## Root cause

`ULt` binds `tAlbedo` to `Ol(i,Mo)`, where `i` is the albedo texture. `yl` forwards missing source `.map` as `null`, not the white fallback used by AO/alpha textures. Bottle glass, perfume liquid, foot and dip tube have scalar base colors and no `.map`.

Original `OLt` fragment shader samples this missing texture, then overrides only RGB:

```glsl
vec4 albedo=(texture(tAlbedo,albedoUv));
#ifdef USE_COLOR
albedo.xyz=uColor;
#endif
```

Later it computes `alpha*=albedo.w;alpha*=uAlpha;`. The engine's null texture is explicitly allocated from `new Uint8Array(4)` in WebGL state helper `lt(Tt,qa,ia,nr)`, so it is RGBA `(0,0,0,0)`. Thus scalar-color transparent materials retain `albedo.w == 0` and all disappear. Opaque cap/atomizer still draw because opaque blending ignores output alpha; the label has a real opaque texture and also draws.

## Minimal fix

Exactly one shader replacement:

```js
old = '#ifdef USE_COLOR\nalbedo.xyz=uColor;\n#endif'
replacement = '#ifdef USE_COLOR\nalbedo=vec4(uColor,1.0);\n#endif'
```

This makes scalar-color materials have the expected opaque source texel, allowing the explicitly supplied `uAlpha` to control transparency. For even narrower scope, add `albedo.a=1.0` only under `#ifdef IS_WATCH` within the existing `USE_COLOR` branch. The general replacement matches intended semantics of all scalar colors.

Existing integration should remain: `opacity:o.opacity`, `material.alpha=mesh.userData.xelleOpacity`, `depthWrite=false` for transparent bottle meshes, and LUT strength zero. No need to toggle `IS_TRANSPARENT` off or make glass opaque.

## Pass flags checked

`ULt` computes `Ve=R||z<1` and supplies both `transparent:Ve` and shader define `IS_TRANSPARENT:Ve`; these correctly enable transparency for glass and liquid.

The scene renderer's WATCH path clears depth, calls `setWatchRender(!0,2)`, and calls standard `renderer.instance.render(scene,watchCamera)`. It does not selectively omit transparent meshes. `watch_mode=2` on all bottle meshes is correct.

Original `IS_TRANSPARENT` only bypasses the stochastic opacity-dither branch used on opaque objects. It does not discard transparent fragments.

## Validation to run

Reload the original-runtime page after patch, move to Spiced Peach Negroni, and check the glass silhouette, amber liquid and foot around the previously floating label. Then inspect product detail view and rotation; transparent object ordering or reflection strength may require tuning, but should be assessed only after source alpha is corrected.
