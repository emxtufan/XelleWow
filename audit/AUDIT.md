# Cartier Watches & Wonders original bundle audit

Inspected the exact browser-captured `original/app.js` (7,287,260 bytes), `original/app.css`, and `original/browser-inventory.json`. JavaScript was parsed with Acorn 8.16.0, rather than relying only on regular expressions.

## Download manifest

`asset-paths.json` is an array of **890 ww26-relative paths**. Resolve against `https://websitefactory.cartier.com/akamai-storage/videos/ww26/`. `asset-path-sources.json` explains each path's provenance.

- 14 assets: original JS, CSS, twelve original font files (six WOFF/WOFF2 pairs).
- 16 audio files: main theme, podcast theme, sprites, thirteen podcast recordings.
- 774 image paths: literal product images, all responsive variants, masks, shapes and both podcast thumbnail resolutions.
- 11 videos: full movie, preview movie, four product-page movies, plus portrait versions of the full movie and four product-page movies.
- 75 WebGL resources: desktop/mobile main scenes and characters, four desktop/mobile watch models, EXR environment maps, SH JSON, lightmaps, masks, noise textures, four 3DL LUTs, and five Draco/Basis decoder files.

The manifest is intentionally a capture superset. Literal product image strings often serve only as inputs to the responsive URL resolver and their unsized URLs may not exist upstream. Five literal images belong to other locales; see `other-locale-literals.json`. HTTP failure for an unused raw input is not proof that a used responsive image is missing.

## Dynamic resource rules that matter

1. `/images/productPages/<group>/<filename>.webp` becomes `/images/productPages/<normalized-group>/<size>/<filename>.webp`. Sizes are `0.05`, `0.1`, `0.2`, `0.4`, `0.6`, `0.8`, `1.0`. Initial images advance through lower resolutions; full gallery uses `1.0`. Viewport target minimum is `0.6`.
2. The ORIGINAL resolver maps group `roadster` to **`roaster`** for product images. Preserve this spelling. Video remains `/videos/productPages/roadster/videoBlock.mp4`.
3. The Baignoire video contains a capital M: `/videos/productPages/baignoire-and-Myst/videoBlock.mp4`.
4. Podcast thumbnails concatenate `/images/podcasts/thumbnails/{LD,HD}/` + image name + `.webp`; masks concatenate `/images/podcasts/masks/` + the locale's mask filename.
5. Draco base is `/webgl/libs/draco/`: `draco_decoder.js`, `draco_wasm_wrapper.js`, `draco_decoder.wasm`. Basis base is `/webgl/libs/basis/`: `basis_transcoder.js`, `basis_transcoder.wasm`.
6. Embedded ZSTD and MikkTSpace WASM are data URLs already inside app.js, requiring no separate downloads. Decoder workers are generated Blob URLs.
7. After capturing GLBs, inspect each binary glTF JSON chunk for external `buffers[].uri` and `images[].uri`. Such references cannot be determined solely from the app entrypoint; add any that are not data URLs to the capture manifest relative to the GLB directory.
8. Both `VideoBlock` and `VideoPopupBlock` apply `sRe`/`uTt`: on `(orientation: portrait)`, append `Vertical` before the extension. Thus all four product `videoBlock.mp4` paths also require `videoBlockVertical.mp4`, and the full film requires `/videos/movie/movieVertical.mp4`. The fixed `movie_preview.mp4` WebGL preview does not pass through this resolver.

## Application content and routes

All 114 locale datasets are embedded in app.js. The exact English-France data was statically unpacked to `en_fr-data.json` with no unsupported expressions. There is no content JSON/API request required for those pages. All lazy route components also resolve to already embedded JavaScript modules: there are zero external `import` declarations or expressions.

Hash routes:

- `#/` — Watches & Wonders, original interactive home scene.
- `#/tailored-crafts-serving-one-form` — Roadster.
- `#/the-eye-of-the-jeweller` — Baignoire and Myst de Cartier.
- `#/shaping-movement` — Crash and Tortue Monopusher.
- `#/the-manufacture-between-innovation-and-tradition` — Santos-Dumont and Tortue.

The global dataset contains thirteen podcast entries. The route table handles `/:page()` and `/:page()/:subPage()` generically.

## External dependencies and local runtime

Set `window.__NUXT__.config.public.LANG` to `en_fr`; point both `public.CDN_URL` and `app.cdnURL` to local resources. Resource loader paths use simple prefix concatenation; avoid accidental remote paths or ensure repeated slashes are normalized by the local server. Serve through HTTP with correct JS, WASM, GLB, video and font MIME types. Video/audio range support is useful for seeking.

GPU tier detection loads `https://unpkg.com/detect-gpu@5.0.70/dist/benchmarks/<device>-<vendor>[-ipad].json`. Desktop vendors: intel, apple, amd, radeon, nvidia, geforce, adreno. Mobile vendors: adreno, apple, mali-t, mali, nvidia, powervr, samsung. Capture the observed benchmark and preferably the supported benchmark directory, and replace only the benchmark base URL with a local path. Failure is caught and yields a fallback tier, but that can change quality/performance behavior offline.

Firebase, GitHub dispatch and Theatre editor code exists in the bundle's embedded development tooling; its presence does not establish that production browsing invokes those services. The normal app's content and animation state are bundled. Original analytics can stay inert by omitting optional analytics config and external tracker scripts.

The surrounding AEM shell's account, cart, contact, store lookup, and shopping links refer to live services outside this immersive experience. They cannot be represented as fully functional offline commerce merely by capturing static assets.

## Validation boundaries

This audit establishes URL construction and bundled content, not successful HTTP capture or browser rendering. Parent task should verify models' nested resources, successful local network requests, scene scrolling, all four product routes, gallery, sound, full movie, and a mobile viewport with external network blocked.
