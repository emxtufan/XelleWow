# Xelle 3D replacement audit

Read-only source investigation of original/app.js and original binary GLBs. No runtime/public assets changed. All code offsets below are JavaScript character offsets in original/app.js, not line numbers.

## Recommended seam

Preserve the original main scene, cameras, Theatre data, lighting and scroll code. Replace only U2t's loaded model scene in _createMeshes() (offset ~6938555), or redirect the eight desktop/mobile resource URLs to four new perfume GLBs. The resource keys must remain watch_model_roadster, watch_model_baignoire, watch_model_crash, watch_model_santos to avoid modifying routing/timeline internals.

kPe (offset 6945507) replaces WATCH_null_alone from mainScene. It dynamically builds U2t components in exact order roadster, baignoire, crash, santos, corresponding to currentScene values 1, 2, 3, 4. The actual watch meshes are NOT embedded in mainScene.

## Existing watch files and node names

All under public/webgl/models/watches; each has _desktop.glb and _mobile.glb versions with matching names and node structures. No animations in any of the 8 watch GLBs; motion is entirely in parent wrappers.

- roadster root (node 9): roadster_bracelet, roadster_brushed, roadster_caseBack, roadster_decal, roadster_dial, roadster_glass, roadster_number_blue, roadster_number_silver, roadster_silver.
- baignoire root (node 7): baignoire_bracelet, baignoire_case, baignoire_caseBack, baignoire_decal, baignoire_dial, baignoire_gem, baignoire_glass.
- crash root (node 9): crash_bracelet, crash_dials, crash_gem, crash_glass, crash_gold, crash_mechanism_brushed, crash_mechanism_noise, crash_rubis, crash_silver.
- santos root (node 7): santos_bracelet, santos_case_brushed, santos_decal, santos_dial, santos_gem, santos_glass, santos_gold.

No per-part node-name lookups found in the watch controller. New bottle nodes can have new names. Two material branches are name-dependent: roadster_number_silver uses a special env map; materials matching santos_decal copy albedo to alpha map. Avoid those substrings for new bottle material/node names.

Original material names:

- roadster: MT_ROADSTER_bracelet, MT_ROADSTER_brushed, MT_ROADSTER_caseBack, MT_ROADSTER_decal, MT_ROADSTER_dial, MT_WATCHES_Glass, MT_ROADSTER_blue, MT_ROADSTER_silver.
- baignoire: MT_BAIGNOIRE_Bracelet, MT_BAIGNOIRE_case, MT_BAIGNOIRE_caseBack, MT_BAIGNOIRE_decal, MT_BAIGNOIRE_dial, MT_BAIGNOIRE_Gem, MT_WATCHES_Glass.
- crash: MT_CRASH_bracelet, MT_CRASH_Dials, MT_CRASH_gem, MT_WATCHES_Glass, MT_CRASH_gold, MT_CRASH_Brushed, MT_CRASH_NOISE, MT_CRASH_rubis, MT_CRASH_silver.
- santos: MT_SANTOS_bracelet, MT_SANTOS_CaseBrushed, MT_SANTOS_decal, MT_SANTOS_dial, MT_SANTOS-BAIGNOIRE_Gem, MT_WATCHES_Glass, MT_SANTOS_gold.

## Transforms, motion and visibility

- U2t applies scale 0.4 to the whole imported scene (W2t=.4).
- Original unscaled bounding sizes: roadster 2.433 x 4.557 x 3.554; baignoire 1.470 x 4.181 x 3.650; crash 1.534 x 4.271 x 3.553; santos 2.099 x 4.047 x 3.340. Y is vertical; watch face is toward +Z. New bottle height ~4 units centered near Y=0 gives comparable screen height; orient label toward +Z. Use source photos/model dimensions to choose proportions.
- Parent structure: kPe > _scrollWrapper > _dragWrapper (position.y -= 0.3) > _animWrapper > U2t model.
- _animWrapper rotation XYZ/scale are driven by pN.config.watch; _animWrapper scale also responds to camera visibility and scroll velocity.
- _dragWrapper supplies drag Y rotation and mouse tilt. speed=.008, latency=2; keep unchanged.
- homeToProduct Theatre sheet and productWatchScroll Theatre sheet drive original move/scale/rotation/darkening. Product scroll sheet duration 4.5; home-to-product playback normalized to 2.5 seconds.
- Each mesh must retain userData.watch_mode=2. This is required for custom render passes in updateWatchRender() (~7041170). U2t adds it automatically.
- Each model must expose at least its mesh materials to U2t._meshes because dark setter writes material.dark every frame.
- Visibility uses component order and currentScene === index+1; keep order.
- BRe hover target is box geometry 0.4 x 1.7 x 1 in scene units. Its width may need widening for broad bottles, but original click navigation can remain intact.

## Shader compatibility

All imported materials are replaced by custom z2t (offset 6937146), based on yl (6903307) and ULt (6898073). Thus adding standard Three MeshPhysicalMaterial or glTF transmission alone will NOT produce physical glass after import. The wrapper retains albedo/normal/metallic-roughness/AO/emissive maps, colors, roughness, metalness; it does not copy transmission or original opacity by default.

- Supply POSITION, NORMAL, TANGENT, TEXCOORD_0 and preferably TEXCOORD_1 for every new mesh, because z2t forces useGeometryTangent=true and useAoUv1=true. Original decal/glass meshes omit UV1 but solid meshes include it.
- Put extras.isTransparent=true on glTF nodes intended for transparency; U2t reads node userData.isTransparent (not simply alphaMode).
- Do not assume alphaMode=BLEND or baseColor alpha is enough. For convincing bottle glass either extend z2t/yl to forward opacity and suitable alpha texture, or deliberately use opaque tinted glass representation with reflection maps and separate liquid/label geometry. This needs visual verification.
- z2t uses watch_env_specular and watch_sh_constants; keep original lighting unless explicitly adjusting product fidelity.
- Original per-product LUTs are applied with strength .6 for santos/baignoire and .9 for roadster/crash. New brand/product colors may need neutral LUT/strength=0 to avoid color drift.

## Main scene objects to preserve

Desktop and mobile mainScene have 210 nodes, 187 meshes, one SCENE_01 animation:

- node 1 Camera animé, parent node 2 Empty.camera: translation [0,1.8,-6.5].
- node 205 WATCH_hover is a proxy mesh, scale [0,0,0], translation [0,32,0].
- node 206 WATCH_null_alone, children [204,205], scale [0,0,0], translation [0,2.814,0]. It is replaced by kPe during scene construction; keep its name, transform and animation channels.
- node 207 Camera fixed watches, parent 208 Empty.camera.fixed: translation [0,1.8,6.5].
- node 209 watch_bg, translation [0,2.417,-1.384], scale [1,.389,1]. Replaced by wPe to preserve product-background transition.
- Preserve EmptySC0* groups, SCENE_01 animation and both character GLBs; camera and room motion use them.

The geometry watch.001 and watch_bg.001 refers to these proxy/background meshes, not a second detailed watch asset.

## Remaining watch-shaped graphics

There are four image-based shape masks used by A2t in transitions: public/webgl/textures/masks/shape-{roadster,baignoire,crash,santos}_msdf.png. They need bottle silhouettes or a deliberate neutral shape. Image replacement alone can preserve the original stencil transition timing. These are MSDF textures; ordinary alpha PNGs cannot be substituted without updating the sampling shader.

## Verification needed after implementation

Load first room, all four product rooms, home-to-product and return, product drag, product scroll, gallery; check desktop and portrait mobile. Confirm no shader compilation errors, all added geometry appears in both custom render passes, textures stay local, no watch silhouettes remain where bottles should appear. A structural audit does not establish visual correctness.

## Implemented Xelle assets (2026-09-14)

- Generator: scripts/build_xelle_models.py. Creates all assets locally; no original models changed.
- Eight self-contained GLBs in public/xelle/models, one desktop and mobile version per internal product key. Four original-emblem label textures in public/xelle/labels. New bottle models have 8 meshes each; desktop 9,301 vertices, mobile 3,793.
- Four transition SDFs in public/xelle/masks named shape-{key}_msdf.png, 256 square, inside positive, RGB channels identical. Verified original w2t shader uses median(RGB)-0.5 then fwidth/smoothstep, so no shader sampling change is required.
- Actual bottle geometry based on supplied photos: cylinder with rounded shoulder/foot, spherical black cap, gold neck, curved ivory label and separate glass/liquid/tube. This is photo-informed reconstruction, not supplied manufacturer CAD.
- Models measure 2.35 wide x 4.12 high x 2.35 deep; labels face +Z. All meshes provide POSITION/NORMAL/TANGENT/TEXCOORD_0/TEXCOORD_1. Materials are native glTF PBR; glass nodes carry extras.isTransparent and extras.xelleOpacity.
- Minimal runtime post-conversion patch in U2t after new z2t: if(a.userData.xelleOpacity!=null){a.material.alpha=a.userData.xelleOpacity;a.material.depthWrite=false;}. Use LUT strength 0 for correct ivory label colors.
- All 8 GLB accessor buffer bounds and required attributes passed structural validation. Label texture was inspected and original alpha emblem verified. Full custom-shader browser validation belongs to parent integration.

## Restrict home to intro + four products

Changing locale home.scenes length alone is insufficient: camera animation covers 8 scenes. At beginning of ScenesCamera.update after the action/mixer guard, clamp _scrollTarget and _scrollY to this.getSceneScrollTarget(4), and set _canLoop=false. Clamp getSceneScrollTarget(e) argument to [0,4]. Replace tweenToSceneShortest with direct scrollToScene to prevent modular loops from crossing media rooms. In snapOnScrollingStopped clamp p to 4 and recompute b before constructing the snap tween. This preserves all original timeline values and movement through scenes 0..4. Remove media UI separately from the locale/routes and disable original audio auto-play.
