# Xellé UI patch map

Read-only inspection of `original/app.js` and `original/app.css`, 2026-09-14. No bundle or stylesheet edits made by this subtask. Apply exact replacements to the working bundle, require one occurrence per replacement, and retain the originals.

## Header logo

`GCt` (`CartierIcon`) renders the inline Cartier SVG. `qCt` is its scoped component, used by `s1t` / `HeaderBlock`. Scope IDs: logo `data-v-8cff3fd8`, header `data-v-2078fbf4`.

Exact old factory:

```js
GCt=ui({__name:"CartierIcon",props:{size:{default:"m"}},setup(r){return(e,t)=>(sa(),Qa("svg",{class:zr(["cartierIcon",`cartierIcon--${e.size}`]),viewBox:"0 0 110 31",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",focusable:"false"},VCt,2))}})
```

Replacement preserving parent classes and dimensions:

```js
GCt=ui({__name:"XelleIcon",props:{size:{default:"m"}},setup(r){return(e,t)=>(sa(),Qa("img",{class:zr(["cartierIcon",`cartierIcon--${e.size}`,"xelleIcon"]),src:"/xelle/xelle-wordmark.png",alt:"Xellé",draggable:"false"},null,2))}})
```

Replace exact `"aria-label":"Cartier — accueil"` with `"aria-label":"Xellé — colecția de parfumuri"`.

`xelle-wordmark.png` is the original white wordmark, visually inspected. Append CSS to preserve white on home and turn it black on product pages:

```css
.xelleIcon{object-fit:contain;object-position:center}
.cartierIcon--s.xelleIcon{width:112px;height:28px}
.cartierIcon--m.xelleIcon{width:150px;height:38px}
.headerBlock__icon.xelleIcon{filter:none;transition:opacity .22s ease,filter .4s ease .2s}
.headerBlock__icon--black.xelleIcon{filter:brightness(0)}
```

Original small SVG dimensions were 86 × 24; medium 110 × 31. Header center is still the original local router link with `to:p.value` and supports returning home.

## Loader

`LEt` / `Loader`, scoped by `data-v-e393307d`, supplies six watch silhouettes. Exact array:

```js
v=[{name:"tank",src:a+"/images/shapes/shape-tank.png"},{name:"santos",src:a+"/images/shapes/shape-santos.png"},{name:"roadster",src:a+"/images/shapes/shape-roadster.png"},{name:"myst",src:a+"/images/shapes/shape-myst.png"},{name:"crash",src:a+"/images/shapes/shape-crash.png"},{name:"baignoire",src:a+"/images/shapes/shape-baignoire.png"}]
```

Replace with `v=[{name:"xelle",src:a+"/xelle/xelle-wordmark.png"}]` for a clean white wordmark while retaining real load progress. The large ornamental `/xelle/xelle-emblem.png` is black on white and is too elaborate for the current 90 px silhouette slot.

The old `mainLoader__icons>*` animation flashes six alternating images over 2.4 seconds. Disable it for one wordmark; otherwise the logo appears only one sixth of the cycle.

```css
.mainLoader[data-v-e393307d]{background:#151311}
.mainLoader__icons[data-v-e393307d]{width:180px;height:56px}
.mainLoader__icons[data-v-e393307d]>.xelle{animation:none!important;width:100%;height:auto;opacity:1}
```

`mainLoader__baseline` is already provided by `IG.loader`; `mainLoader__progress` is numeric percent and remains functional. Do not remove the loader's loading/progress listeners.

## Audio and podcast controls

**Critical:** hiding controls does not disable audio. `fRt` / default layout starts Cartier ambient audio on first click.

Exact old function:

```js
const h=()=>{l.value||(ch.init(),ch.start(),t.toggleMute(!1)),l.value=!0};
```

Replace with `const h=()=>{l.value=!0};`. Within this `fRt` component only, initialize `const l=Pa(!0),u=Pa(!1);` instead of `const l=Pa(!1),u=Pa(!1);` so `awaitFirstAudioClick` styling/cursor never activates. This declaration fragment may occur elsewhere; scope the replacement to the default component.

`UCt` / `SoundButton` (`jCt`) has a fallback label `Sound`, so omitting locale text will not remove it. Exact label computed function:

```js
u=fa(()=>{var b;return((b=t.ctas)==null?void 0:b.soundBttn)||"Sound"})
```

Replace with `u=fa(()=>"")` to remove all rendered sound buttons without altering store state. Its render is already conditional on `u.value`.

`pSt` / `HomePage` includes obsolete podcast button `Ext`, movie, transcript, mobile switcher, and sound indications. Hide these classes as a defensive layer:

```css
.soundButton,.homePage__podcastWrapper,.homePage__podcastClosePlay,
.homePage__bottomRightWrapper,.homePage__movieScreenInlineVideo,
.homePage__bottomWrapper--watchMovieText,
.homePage__bottomWrapper--podcastAudioIndicationText,
.homePage__bottomWrapper--soundOnIndicationText,
.podcastTextPopupBlock,.podcastModeDismissOverlay,
.cursorClickSoundEnable{display:none!important}
```

Prefer also remove the podcast trigger from `HomePage` rendering. Exact wrapper block:

```js
rr(So,{name:"fade-global"},{default:ti(()=>[Dt(Jt).ui.exploreBttn&&Dt(Ee)&&Dt(Ee).exploreUrl?(sa(),Qa("div",{key:Dt(Le),class:"homePage__podcastWrapper"},[rr(Ext,{ref_key:"$podcastCta",ref:p,class:"homePage__podcastButton",visible:Dt(Jt).ui.podcastCta,onClick:Lt,onPointerenter:Yt,onPointerleave:Ea},null,8,["visible"])])):Xr("",!0)]),_:1})
```

Replace that expression with `Xr("",!0)`. Home has `function Lt(){zl(),l.setPodcastMode(!l.podcastMode.active)}`; set it to `function Lt(){}` to disable its development `p` shortcut. There are also 3D podcast meshes/interaction/config handled by the scene patch; CSS alone does not disable them.

Movie render and data use scene index 5; podcast full scene uses 6; wrap scene uses 7. After home is shortened to intro+four perfumes, scene loop/clamping must also exclude 5/6/7. Original scene pagination checks `Dt(Le)>0&&Dt(Le)!==7` and passes `scene-count:Dt(de)-1`; new de=5 yields four dots. Home intro `RG.scenes[0].title` is **not** rendered by `Vxt` because visibility requires `Le>0`; the original large intro title is part of the scene, so the 3D/text patch must replace it separately.

## Document title and route behavior

`C$(page)` calls `f7e(page, route.path, Un().metas)` then `_xe(...)`. `f7e` chooses `page.title` and optionally appends `global.metas.seo.title`. New locale page titles therefore update browser titles automatically; no direct `document.title` mutation is needed. Current static fallback in `public/index.html` is `Watches &amp; Wonders — Cartier Local` and `<html lang="en">`; replace with Xellé and `ro`.

To add a consistent brand suffix, `IG.metas={seo:{title:"Xellé",description:"Descoperă colecția de parfumuri Xellé."}}` is supported, but then home title should omit duplicate Xellé. Existing locale map already gives home title `Xellé — Extrait de parfum`.

The router uses `F0e` generic routes `/:page()` and `/`; `Un.getPage` finds the actual page through matching `uri`. `tEe` normalizes each product `uri` to a slash-terminated URL. No new route declaration is necessary when swapping locale page handles. Hash mode is already configured in working bundle; product crosslinks should be local `/actual-handle`, not Shopify `/products/...` routes.

## Slider links and purchase CTA

`rTt` / `SliderProductsBlock` currently forces a new tab even for internal card routes. Exact function:

```js
function R(Q){var me;const ue=(me=Q.url)==null?void 0:me.trim();if(ue)return TJ(ue,{external:a(ue),open:{target:"_blank",windowFeatures:{noopener:!0,noreferrer:!0}}})}
```

Replacement:

```js
function R(Q){var me;const ue=(me=Q.url)==null?void 0:me.trim();if(ue)return a(ue)?TJ(ue,{external:!0,open:{target:"_blank",windowFeatures:{noopener:!0,noreferrer:!0}}}):TJ(ue)}
```

This preserves Shopify/official outbound behavior but uses the Nuxt router for local collection cards. Parent component already prevents default and distinguishes drag from click.

`lTt` / `TextBlock` supports `button:[{url,label}]` for a normal text block; `WY` receives `external` based on HTTPS. New content uses exact official product URL and `Cumpără pe xelle.ro`, so checkout stays functional on the official store. No CTA renderer rewrite required.

`NPt` / `ScrollMediasBlock` explicitly checks `o.value.length>1` before rendering extra gallery images. A one-image gallery is supported by its existing code and retains the working popup.
