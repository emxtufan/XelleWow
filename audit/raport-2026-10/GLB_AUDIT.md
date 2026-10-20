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
| Gât | inel auriu subțire sub capac | guler auriu înalt (atomizor vizibil) |
| Tub interior | nevizibil în fotografii | prezent |
| Tehnic | 8 mesh-uri, 17k triunghiuri, profil grosier (12 puncte), fără compresie, 834 KB | |

Nu au existat erori de normale sau UV (verificate). Problema era de fidelitate, nu de geometrie stricată.

## Modelul nou (Blender)

- **Sursă:**
  - `scripts/blender_build_xelle_bottles.py` (parametric) și `blender/xelle_bottle.blend` (editabil);
  - dimensiunile vin din `scripts/xelle-products.json`, măsurate pe packshot: corp R 1,175 × H 2,23; perete 0,085; bază 0,34; partea de sus 0,09; muchii rotunjite 0,15 / 0,05; inel 0,30 × 0,07; capac sferic R 0,734.
- **Piese** (nume pe care le citește motorul):
  - `xelle_bottle_glass` (exterior);
  - `xelle_glass_inner` (peretele cavității, cu normalele spre interior, ca sticla să aibă grosime);
  - `xelle_fragrance_liquid`;
  - `xelle_gold_collar` (3 caneluri);
  - `xelle_spherical_black_cap`;
  - `xelle_front_label`.
- **Materiale (PBR):**
  - sticlă α 0,14 / 0,08 (Fresnel pe margini în shader);
  - lichid α 0,90 cu culoarea fiecărui parfum;
  - aur metalic, rugozitate 0,22;
  - capac negru lucios, rugozitate 0,12;
  - etichetă cu textura generată (2048 × 1452 desktop, 1024 × 726 mobil).

| | Desktop | Mobil |
|---|---|---|
| Triunghiuri | 16.416 | 8.960 |
| Draw calls | 6 | 6 |
| Materiale | 6 | 6 |
| Texturi | 1 (etichetă, PNG 2048 × 1452, ~150 KB) | 1 (1024 × 726, ~70 KB) |
| Fișier | ~233 KB (Draco) | ~122 KB (Draco) |
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

## Model de test: „Perfume Bottle” (Sketchfab)

- **Sursa:** fișierul primit de la tine (`perfume_bottle.glb`), de Michaela Blanchfield, licență **CC-BY-4.0**. La orice folosire publică trebuie menționată autoarea.
- **Original:**
  - 13 MB, 23.646 de triunghiuri, 5 piese: sticlă cu nervuri, lichid, capac, tub, etichetă plată „ROSE / EAU DE PARFUM”;
  - materiale `KHR_materials_pbrSpecularGlossiness`, extensie pe care motorul nu o citește;
  - 10 seturi UV; UV-urile etichetei sunt în afara intervalului 0–1.
- **Convertit** cu `scripts/blender_import_test_bottle.py`:
  - aceeași înălțime ca flaconul Xellé, piciorul la y = −2,1;
  - numele pieselor și materialele motorului, cu lichidul în culoarea fiecărui parfum și capac metalic;
  - eticheta proprie a modelului păstrată, cu UV-urile mutate în 0–1;
  - Draco; ~480 KB pe parfum.
- **Unde se vede:** în `public/xelle/models/test/` și pe site cu `?flacon=test`. Fără parametru, site-ul folosește flaconul Xellé.
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
