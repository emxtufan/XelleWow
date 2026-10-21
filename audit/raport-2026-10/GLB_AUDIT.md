# Audit GLB: flacoanele Xellé și scenele

Cifrele vin din `node audit/glb-inspect.mjs <fișiere>` (triunghiuri, draw calls, materiale, texturi, atribute, verificări de normale), plus fotografiile de referință din `public/xelle/`. Referința de calitate e ceasul Cartier `public/webgl/models/watches/santos_desktop.glb`.

## Verdict pe parfum

Toate cele 4 parfumuri folosesc **aceeași sticlă** (confirmat pe fotografiile de campanie); diferă doar eticheta (numele) și nuanța lichidului. De aceea verdictul e comun:

| Parfum | Fișiere | Verdict model vechi | Model nou |
|---|---|---|---|
| Spiced Peach Negroni (`roadster`) | `public/xelle/models/roadster_{desktop,mobile}.glb` | **Reconstruit**: proporții, etichetă și emblemă greșite | acceptat |
| Pornstar Martini (`baignoire`) | `baignoire_*.glb` | idem | acceptat |
| Prosecco di Cherry (`crash`) | `crash_*.glb` | idem | acceptat |
| Maracuja Mojito (`santos`) | `santos_*.glb` | idem | acceptat |

Numele interne `roadster`, `baignoire`, `crash` și `santos` sunt sloturile motorului Cartier; legătura cu parfumurile e în `scripts/xelle-products.json`.

## Defectele modelului vechi (generat în Python)

Comparat cu packshot-ul `maracuja-mojito-packshot.png` (4096 px) și cu fotografiile de campanie:

| Element | Produs real | Model vechi |
|---|---|---|
| Proporții corp | înălțime / diametru ≈ 0,95 (mai scund decât lat) | 1,09 |
| Etichetă | ±0,94 rad pe cilindru, între 20% și 90% din înălțime, proporție 1,41 | ±0,86 rad, aproape tot corpul, proporție ~1 |
| Emblemă | simbol geometric negru cu contur și cârlige aurii, „X” alb în centru | alt fișier (nod celtic) |
| Text | „XELLÉ” auriu, nume, „Extrait de Parfum”, greutate normală | text îngroșat și **„50 ml” inventat** pe etichetă |
| Sticlă | pereți groși, bază de sticlă groasă (~15%), muchie de sus rotunjită | o singură suprafață subțire, fără grosime |
| Gât | capacul stă direct pe sticlă; inelul auriu din poze e parfumul văzut prin sticlă | guler auriu înalt (atomizor vizibil) |
| Tub interior | nevizibil în fotografii | prezent |
| Tehnic | 8 mesh-uri, 17k triunghiuri, profil grosier (12 puncte), fără compresie, 834 KB | |

Nu au existat erori de normale sau UV (verificate). Problema era de fidelitate, nu de geometrie stricată.

## Modelul nou (Blender)

- **Sursă:**
  - `scripts/blender_build_xelle_bottles.py` (parametric) și `blender/xelle_bottle.blend` (editabil);
  - dimensiunile vin din `scripts/xelle-products.json`, măsurate pe packshot: corp R 1,175 × H 2,37; perete 0,085; bază 0,34; partea de sus 0,09; muchii rotunjite 0,15 / 0,12; capac sferic R 0,73, tăiat plat și așezat pe sticlă (centrul la 0,50 deasupra ei).
- **Piese** (nume pe care le citește motorul):
  - `xelle_bottle_glass` (exterior);
  - `xelle_glass_inner` (peretele cavității, cu normalele spre interior, ca sticla să aibă grosime);
  - `xelle_fragrance_liquid`;
  - `xelle_spherical_black_cap`;
  - `xelle_front_label`.
- **Materiale (PBR):**
  - sticlă α 0,14 / 0,08 (Fresnel pe margini în shader);
  - lichid α 0,90, culoarea din `products[].liquidTransmit` (măsurată pe fotografii);
  - capac negru lucios, rugozitate 0,12;
  - etichetă cu textura generată (2048 × 1452 desktop, 1024 × 726 mobil).

| | Desktop | Mobil |
|---|---|---|
| Triunghiuri | 15.328 | 8.344 |
| Draw calls | 5 | 5 |
| Materiale | 5 | 5 |
| Texturi | 1 (etichetă, PNG 2048 × 1452, ~150 KB) | 1 (1024 × 726, ~70 KB) |
| Fișier | ~220–229 KB (Draco) | ~114–119 KB (Draco) |
| Atribute | POSITION, NORMAL, TEXCOORD_0/1, TANGENT | idem |

**Comparație cu ceasul Cartier** (santos desktop): 38.399 de triunghiuri, 7 mesh-uri, 4,9 MB, normal/roughness/AO maps, transmisie. Sticla Xellé e o formă simplă (cilindru, sferă), deci 16k triunghiuri o descriu complet. Diferența de „bogăție” față de un ceas vine din detaliile reale ale ceasului, nu dintr-o lipsă a modelului nostru.

## Etichetele

`scripts/build_xelle_labels.py` le reconstruiește din fotografia produsului:
- emblema e desfăcută de pe cilindru (rază 886 px, unghiul camerei 17°), apoi separată în câmp negru și folie aurie;
- layout-ul (chenar, emblemă 30% din lățime, wordmark, titlu, subtitlu) e măsurat;
- wordmark-ul vine din `public/xelle/intro/xelle-wordmark.png`;
- titlurile sunt în Montserrat Medium/Regular, calibrate pe lățimea titlului fotografiat.

Rezultă:
- `labels/<key>.png` (desktop) și `labels/<key>_mobile.png` — texturile 3D;
- `labels/<key>_print.png` — doar cerneala, pentru stratul clar.

**Necesită confirmare:** fontul real al titlurilor și culorile exacte de print. Înlocuirea cu fișierul oficial e descrisă în SCENE_WORKFLOW.md.

## Scenele (fundaluri)

| Fișier | Mărime | Mesh-uri / draw calls | Triunghiuri | Observații |
|---|---|---|---|---|
| `public/xelle/backdrops/mainScene.glb` | 14,6 MB | 225 | 227.262 | scena Cartier cu fotografiile Xellé (JPEG original, neatins) |
| `public/xelle/backdrops/mainSceneMobile.glb` | 8,5 MB (era 10,2) | 225 | 227.262 | fotografiile peste 1600 px sunt redimensionate la 1600 px (JPEG 90) |
| `public/webgl/models/mainScene*_characters.glb` | 8,8 / 7,8 MB | 124 | | personaje și mobilier Cartier; doar cele 16 piese ale scenei filmului se văd |
| `public/xelle/backdrops/mainScene*_characters.glb` (servite) | **2,0 / 1,8 MB** | 16 | | copie cu piesele filmului; nodurile, oasele și animațiile rămân identice |

Piesele din scenele 1–4 erau ascunse la rulare (`build_xelle.cjs`), dar se descărcau și se decodau la fiecare pornire. `build_xelle_backdrops.py` (`prune_characters`) le scoate din copia servită, după aceeași regulă de scenă pe care o folosește motorul. `check_xelle_static.py` verifică că au rămas exact piesele filmului.

**Recomandări** (neaplicate):
- texturile scenei în KTX2 (scad memoria GPU și timpul de urcare pe placă);
- comprimare brotli pe CDN.

## Flaconul HQ (Blender, după fotografia de studio)

- **Sursă:**
  - `scripts/blender_build_xelle_hq.py` (rulează `blender -b --factory-startup -P scripts/blender_build_xelle_hq.py -- --render`);
  - scena editabilă `blender/xelle_bottle_hq.blend`, cu camera fotografiei, studioul și Cycles;
  - randările în `blender/renders/<key>.png`, iar comparația cu fotografia în `blender/renders/comparatie-maracuja-mojito.jpg`.
- **Măsurători noi pe `maracuja-mojito-packshot.png`:**
  - camera fotografiei: 18,4° (din curbura liniei de chenar a etichetei) și ~24 unități distanță (din îngustarea corpului spre bază);
  - cu aceeași cameră, silueta randării s-a suprapus pe a fotografiei. Corecții aduse în `xelle-products.json`:
    - corp 2,23 → **2,37**;
    - capac: raza 0,73, centrul la 0,50 deasupra sticlei (`sink` 0,30), așezat pe sticlă, tăiat plat, **fără inel auriu**: inelul auriu din poze e parfumul văzut prin sticlă;
    - muchia de jos 0,05 → **0,12**.
  - **Eticheta**, diametrul capacului și baza se potriveau deja.
- **Lichid:** `products[].liquidTransmit` este culoarea pe care o păstrează lumina după ce traversează flaconul prin mijloc.
  - E calibrată pe packshot, apoi pe nuanța aurie măsurată în fotografia fiecărui produs.
  - Toate patru sunt aurii: Prosecco di Cherry puțin mai ambrat, Pornstar Martini mai pal.
- **Geometrie:**
  - sticlă plină cu cavitate închisă, lichidul în cavitate, capac și etichetă (tipar în față, hârtie simplă în spate);
  - 256 de segmente, ~110.000 de triunghiuri, ~420 KB pe parfum (Draco 16/14 biți).
- **GLB (`blender/hq/<key>.glb`, în afara site-ului publicat):**
  - lichidul are `KHR_materials_transmission`, `ior` și `volume`;
  - sticla e exportată ca sticlă clară semitransparentă: randatoarele în timp real (three.js, gltf-viewer) nu arată un obiect cu refracție prin altul. În Blender, sticla rămâne cu refracție reală.
- **Vizualizare:** `archive/vizualizare/flacoane.html` (three.js, rezoluția ecranului, antialiasing). Scoasă din site la curățenia de lansare; ca s-o folosești local, copiaz-o în `public/xelle/` și modelele din `blender/hq/` în `public/xelle/models/hq/`.
- **Site-ul folosește aceeași sticlă:** `build_xelle_models.py` generează modelele motorului din aceleași dimensiuni și culori (sticla și lichidul sunt desenate de shaderele motorului, deci lumina vine din fiecare scenă).

## Model de test: „Perfume Bottle” (Sketchfab)

- **Sursa:** fișierul primit de la tine (`perfume_bottle.glb`), de Michaela Blanchfield, licență **CC-BY-4.0**. La orice folosire publică trebuie menționată autoarea.
- **Original:**
  - 13 MB, 23.646 de triunghiuri, 5 piese: sticlă cu nervuri, lichid, capac, tub, etichetă plată „ROSE / EAU DE PARFUM”;
  - materiale `KHR_materials_pbrSpecularGlossiness`, extensie pe care motorul nu o citește;
  - 10 seturi UV; UV-urile etichetei sunt în afara intervalului 0–1.
- **Convertit** cu `blender_import_test_bottle.py` (acum în `archive/sticla-test/scripts/`):
  - aceeași înălțime ca flaconul Xellé, piciorul la y = −2,1;
  - numele pieselor și materialele motorului, cu lichidul în culoarea fiecărui parfum și capac metalic;
  - eticheta proprie a modelului păstrată, cu UV-urile mutate în 0–1;
  - Draco; ~480 KB pe parfum.
- **Stare:** scos din site la curățenia de lansare (comutatorul `?flacon=test` nu mai există). Modelele convertite sunt în `archive/sticla-test/public/xelle/models/test/`.
- **Limită:** stratul de etichetă clară se aplică doar etichetei Xellé (`xelle_front_label`). Eticheta modelului de test rămâne textura 3D.

## Fișiere nefolosite

- `public/xelle/models/Untitled.glb` (160 KB): un export vechi al sticlei, nereferit nicăieri. Șters cu acordul tău (20.10.2026), mutat în Coșul de reciclare.
- `public/xelle/models/mainScene*.glb`: scenele de bază din care se generează fundalurile. Sunt folosite de pipeline, nu de site.

## Standard de export GLB (pentru modele noi)

1. GLB 2.0, Y în sus, fața etichetei spre +Z, piciorul sticlei la y = −2,1 (dimensiunile din `xelle-products.json`).
2. Numele nodurilor ca mai sus; atributele `extras`:
   - `xelleBottle: true` pe fiecare piesă;
   - `isTransparent: true` și `xelleOpacity: <α>` pe piesele transparente.
3. Materiale PBR simple (culoare, rugozitate, metalicitate, α); fără extensii `KHR_materials_*` (motorul nu le folosește).
4. UV: `TEXCOORD_0` și `TEXCOORD_1`; tangente exportate; eticheta cu UV (0,0) în colțul stânga-sus al imaginii.
5. Normale netede, cu muchii ascuțite doar unde forma e ascuțită (Smooth by Angle, 50°).
6. Draco: nivel 6, poziții 14 biți, normale 12 biți, UV 12 biți. Nu mai agresiv: normalele grosiere fac trepte în reflexiile sticlei.
7. Textura etichetei: PNG, 2048 px pe desktop și 1024 px pe mobil; filtrare mipmap liniară (anizotropia se setează la runtime).
8. Fără camere, lumini sau obiecte ajutătoare în fișier.
