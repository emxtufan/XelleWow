# Workflow: parfumuri, scene, lumină, cameră, testare

Experiența rulează motorul compilat Cartier (`original/app.js`), adaptat de `scripts/build_xelle.cjs`. Ce se poate schimba prin configurare și fișiere e separat mai jos de ce cere modificări în datele de animație ale motorului.

## Comenzi de bază

```powershell
python scripts/build_xelle_models.py            # etichete + măști + sticle (Blender) + manifest
python scripts/build_xelle_backdrops.py         # fotografiile de pe pereți
node --expose-internals scripts/build_xelle.cjs # bundle-ul site-ului
python audit/check_xelle_static.py              # verificare statică
node audit/check_xelle_intro.cjs                # verificare intro
node audit/e2e.mjs --gpu=nvidia                 # 16 scenarii în browser (server pornit)
```

Blender: scriptul folosește cea mai nouă instalare din `C:/Program Files/Blender Foundation`, sau calea din variabila `BLENDER`.

## 1. Înlocuirea sticlei unui parfum cu un model nou din Blender

Sticla generată se poate înlocui cu un model făcut de un artist, fără să atingi camera, scroll-ul sau animațiile.

1. Pornește din `blender/xelle_bottle.blend` (scara, axele și numele sunt deja corecte) sau respectă standardul din GLB_AUDIT.md:
   - piciorul la y = −2,1, fața etichetei spre +Z (−Y în Blender);
   - nodurile `xelle_bottle_glass`, `xelle_glass_inner`, `xelle_fragrance_liquid`, `xelle_gold_collar`, `xelle_spherical_black_cap`, `xelle_front_label`;
   - proprietăți custom: `xelleBottle`, plus `isTransparent` și `xelleOpacity` pe piesele transparente.
2. Exportă GLB (Draco nivel 6, poziții 14 biți, normale 12 biți) în `public/xelle/models/<key>_desktop.glb` și `<key>_mobile.glb`. `<key>` este `roadster`, `baignoire`, `crash` sau `santos`, după `scripts/xelle-products.json`.
3. Dacă proporțiile se schimbă, actualizează `bottle` și `label` în `scripts/xelle-products.json`. Stratul de etichetă clară și măștile de tranziție citesc de acolo.
   - **Atenție:** `python scripts/build_xelle_models.py` regenerează sticlele din parametri și **suprascrie** un model făcut manual. După un model manual, rulează doar `python scripts/build_xelle_labels.py` (dacă s-au schimbat etichetele) și funcția de măști, sau păstrează modelul în altă parte și copiază-l după build.
4. `node --expose-internals scripts/build_xelle.cjs`, apoi `python audit/check_xelle_static.py`. Verificarea confirmă opacitățile, `alphaMode` și poziția piciorului.
5. Verifică vizual: `node audit/responsive.mjs` (planșe în `audit/perf/`).

**Test cu un model descărcat, fără să înlocuiești nimic:**
1. Rulează:
   ```
   blender -b --factory-startup -P scripts/blender_import_test_bottle.py -- <model.glb>
   ```
   Scriptul e făcut pentru „Perfume Bottle” de pe Sketchfab. Pentru alt model, ajustează `PARTS`: materialul sursă → piesa motorului.
2. Rezultatul ajunge în `public/xelle/models/test/` și se vede cu `?flacon=test`, de exemplu `http://127.0.0.1:4173/?flacon=test`.

**Mărimea în scene:** `bottle.sceneScale` (desktop 1,5; mobil 1,3) în `xelle-products.json`.
**Poziția în intro:** `XELLE_INTRO_SLOTS` în `scripts/xelle-intro-scene.js`.

## 2. Eticheta oficială

Când primești fișierul de print de la designer:
- **Varianta simplă:**
  1. Exportă eticheta ca PNG la 2048 × 1452 (proporția 1,41, a etichetei reale) în `public/xelle/labels/<key>.png`, la 1024 × 726 în `<key>_mobile.png`, și o variantă doar cu cerneala (hârtie transparentă) în `<key>_print.png`.
  2. Rulează scriptul Blender (sau tot `build_xelle_models.py`, dacă nu ai sticle făcute manual).
  3. Scoate apelul `build_xelle_labels.py` din `build_xelle_models.py`, ca să nu-ți suprascrie fișierele.
- **Varianta parametrică:** schimbă `label.fonts`, `label.colors` și `label.layout` în `xelle-products.json`. Emblema se poate înlocui cu un PNG oficial, modificând `extract_emblem` în `build_xelle_labels.py`.

## 3. Adăugarea unui parfum sau a unei scene

- **Al cincilea parfum:** motorul are exact 4 sloturi de produs (`roadster`, `baignoire`, `crash`, `santos`), iar timeline-ul Theatre are 7 scene (intrare, 4 parfumuri, film, galerie; clamp `Og(e,0,6)` în `build_xelle.cjs`). Un parfum în plus cere o scenă nouă în timeline. Asta nu e configurabil fără să editezi proiectul Theatre din bundle (vezi 5).
- **Altă fotografie pe pereții unei scene:** `PHOTOS` și `PAINTINGS` în `scripts/build_xelle_backdrops.py`, apoi `python scripts/build_xelle_backdrops.py` și build-ul.
- **Texte, butoane, produse din pagini:** `scripts/build_xelle_content.py` (locale) și catalogul Shopify (`node scripts/build_xelle_shop.mjs`).
- **Numele secțiunilor și adresele `?sectiune=`:** `XELLE_SECTIONS` în `scripts/xelle-sections.js`.

## 4. Iluminare

| Ce | Unde |
|---|---|
| Reflexiile sticlei și ale capacului (softbox-uri de studio) | `scripts/xelle-bottle-studio.glsl` |
| Sticla (transparență pe margini, reflexii) și lichidul (culoare străbătută de lumină, menisc) | `scripts/xelle-bottle-glass.glsl`; opacitățile în `MATERIALS` din `scripts/blender_build_xelle_bottles.py` |
| Culoarea lichidului | `products[].liquid` în `xelle-products.json` |
| Razele de lumină și halo-ul din intro, saturația și contrastul de la intrare | `xelleApplyIntroLighting` în `scripts/xelle-intro-scene.js` |
| Luminile scenelor (hărți de mediu EXR, lightmap-uri, post-procesare) | asset-urile motorului (`public/webgl/textures/`), nemodificate |

## 5. Camera și timeline-ul

- Mișcarea camerei între scene, încadrarea fiecărei scene și animația „Descoperă parfumul” sunt keyframe-uri Theatre.js, compilate în bundle (proiectul cu `sheetsById`, foile `timeline`, `homeToProduct`, `productWatchScroll`; obiectul `currentScene` marchează intrarea și ieșirea fiecărei scene). Nu sunt într-un fișier separat.
- Ca să le modifici cu editorul vizual, inițializează `@theatre/studio`, inclus deja în bundle (de aici mesajul pe care l-am eliminat din consolă). Apoi exportă proiectul și înlocuiește obiectul din bundle printr-un patch în `build_xelle.cjs`. E o lucrare separată, de planificat.
- **Configurabile fără timeline:**
  - mărimea sticlei în scene (`sceneScale`);
  - poziția sticlelor în intro;
  - durata „lipirii” între scene (`z=xelleMoveDuration(Math.max(.8,Math.min(3,z)))` în `build_xelle.cjs`);
  - regulile de scroll (`scripts/xelle-scroll.js`: pauza care încheie un gest, pragul de 12%, durata 1,4 s).

## 6. Scroll

- O singură sursă de adevăr: virtual-scroll → `_scrollTarget` al camerei → timeline-ul Theatre.
- `xelleScrollTarget`:
  - un gest avansează cel mult o scenă;
  - toate scenele cer același input.
- `xelleScrollSettle`: termină gesturile pe segmentele fără marcaje de lipire.
- Adresa `?sectiune=` se actualizează doar când scena e așezată, cu `replaceState`, deci nu umple istoricul. Paginile de magazin sunt intrări în istoric (Înapoi le închide).
- `prefers-reduced-motion`: mutările automate sunt scurtate la 0,6 s, iar înclinarea după cursor e oprită.

## 7. Calitate adaptivă

`xelleAdaptResolution` în `scripts/xelle-intro-scene.js`:
- Pornește la densitatea ecranului (maximum 2×).
- Dacă placa nu ține 50 fps, coboară direct la treapta care o duce la ~55 fps (2 → 1,75 → 1,5 → 1,25 → 1 → 0,75).
- Prima decizie se ia în timpul întrebării despre sunet, ca să nu se vadă.
- Etichetele rămân clare la orice treaptă, prin `scripts/xelle-label-print.js`. Stratul clar se desenează la fiecare cadru, și în mișcare, după randare, din pozițiile aceluiași cadru, deci nu rămâne în urma sticlei.

## 8. Testarea performanței

```powershell
node audit/perf-run.mjs --gpu=intel --size=1920x1080 --dpr=1     # fps, draw calls, triunghiuri, CPU, memorie pe scene
node audit/perf-run.mjs --gpu=nvidia --size=390x844 --dpr=3 --mobile
node audit/gpu-passes.mjs --gpu=intel --section=pornstar-martini # ms GPU pe fiecare etapă de randare
node audit/cpu-profile.mjs --mobile --cpu=4                     # funcțiile JS cele mai costisitoare
node audit/load-bytes.mjs --mobile                              # ce se descarcă la pornire
node audit/e2e.mjs                                              # 16 scenarii (scroll, resize, back/forward, memorie, context WebGL)
```

**Repere de acceptare:**
- 120 fps pe placă dedicată;
- ≥ 55 fps pe ecran de telefon pe plăci integrate;
- 0 erori în consolă;
- creștere de memorie < 1 MB după 3 tururi;
- toate testele e2e trec.

Testul final rămâne pe telefoane reale.
