# Audit Xellé 3D: referința Cartier, probleme, cauze, remedieri

Data: 20 octombrie 2026. Mediu de test: laptop Windows 11, i9-13980HX, Intel UHD (integrată) și NVIDIA RTX 4070 Laptop, ecran 3200×2000 (DPR 2), Chrome 140. Testele automate rulează Chrome headless prin DevTools Protocol, cu placa aleasă explicit (`--gpu=intel|nvidia`). Toate cifrele de mai jos sunt măsurate; unde o măsurătoare lipsește, se spune de ce.

## 1. Pe scurt

- **Proiectul rulează chiar motorul Cartier.** Bundle-ul live de pe cartier.com conține aceleași funcții interne ca `original/app.js` (verificat în browser: `_forcedRenderScale`, `W2t=.4`, `homeToProduct`, `detect-gpu`). Diferențele de calitate nu vin din motor, ci din conținut: modele, texturi, scene.
- **Cartier nu e fluid pe același laptop.** Pe placa Intel, site-ul lor măsoară 9 fps la intrare și 3 fps în prima scenă (canvas 2400×1246, adică 1,5×). Pe acest hardware, „ca Cartier” nu înseamnă 60 fps.
- **Probleme confirmate și reparate** (detalii în secțiunea 4):
  - o scurgere de memorie;
  - scroll care sărea peste o scenă pe telefon și se bloca între Film și Galerie pe desktop;
  - butonul Înapoi care ieșea de pe site din magazin;
  - două erori în consolă;
  - matricele scenei recalculate de 3 ori pe cadru;
  - un model de sticlă care nu corespundea produsului real;
  - etichete greu lizibile;
  - tabloul din hero, ascuns în spatele sticlei pe tabletă.
- **Teste:** 16/16 scenarii end-to-end trec fără nicio eroare în consolă. Verificările statice existente (`check_xelle_static.py`, `check_xelle_intro.cjs`) trec.
- **Rămân deschise:**
  - testul pe telefoane reale;
  - fișierul oficial de print al etichetei;
  - performanța pe plăci integrate la rezoluție desktop;
  - drepturile asupra materialelor Cartier (secțiunea 6).

## 2. Etapa 1: ce face site-ul Cartier (observat în browser real)

Am deschis https://www.cartier.com/en-fr/watchesandwonders#/ în Chrome-ul utilizatorului. `curl` primește 403 de la protecția anti-bot, așa că am folosit browserul real.

| Observație | Valoare |
|---|---|
| Motor | WebGL 2 (three.js personalizat), un singur canvas, `antialias:false` + SMAA în post-procesare |
| Rezoluție de randare | fixă la 1,5× pixelii CSS pe desktop (1,25× pe mobil), indiferent de DPR: canvas 2400×1246 pentru 1600×831 CSS pe ecran 2× |
| Fluiditate pe Intel UHD | 9 fps la intrare (p95 200 ms), 3 fps în scena 1 |
| Animații | timeline Theatre.js legat de scroll virtual, plus GSAP pentru tranziții; scenele se „lipesc” la oprirea scroll-ului |
| Resurse 3D | ceasuri GLB de 2,3–7 MB (Draco, PBR cu normal/roughness/AO, `KHR_materials_transmission`), scene de 10–16 MB, 13 hărți de mediu EXR (13 MB), lightmap-uri WebP |
| Claritatea produsului | cadranul ceasului se citește datorită modelului (38–40k triunghiuri, texturi dedicate cadranului și normal maps), nu unui truc de rezoluție |

Concluzie tehnică: claritatea Cartier vine din asset-uri foarte detaliate, nu dintr-o randare mai fină. Aceeași abordare am aplicat-o aici: model și etichetă reconstruite după produsul real (secțiunea 4.6).

## 3. Etapa 2: harta arhitecturii

- `original/app.js`: bundle-ul compilat (Nuxt/Vue 3 + three.js personalizat + Theatre.js + GSAP + virtual-scroll). Nu e sursă editabilă.
- `scripts/build_xelle.cjs`: aplică 92 de modificări „gardate” (fiecare înlocuire trebuie să existe exact o dată) și injectează modulele Xellé. Rezultatul este `public/assets/xelle-app.js`.
- Module Xellé injectate:
  - intro: `xelle-intro-set.js`, `xelle-intro-scene.js`;
  - scroll și secțiuni: `xelle-scroll.js`, `xelle-sections.js`;
  - sticlă: `xelle-bottle-material.js`, `xelle-label-print.js`, shaderele `xelle-bottle-glass.glsl` și `xelle-bottle-studio.glsl`;
  - magazin: `xelle-shop*.js`;
  - meniu, sunet, galerie.
- Configurația produselor: `scripts/xelle-products.json`. E sursa unică pentru dimensiunile sticlei, eticheta și cele 4 parfumuri.
- Randare pe cadru:
  - un singur canvas WebGL;
  - scena principală se desenează de 3 ori (scena + 2 treceri pentru sticle, care doar comută vizibilitatea), apoi post-procesare: lumină, bloom, SMAA, compoziție;
  - peste canvas există un canvas 2D transparent, `xelle-label-print`, pentru etichetele clare.
- Bucle `requestAnimationFrame`: 12–13 apeluri pe cadru, toate din motorul original (manager rAF ×3, mouse, cache, 4 componente de cursor, Theatre). Fiecare e o funcție mică. Costul JS total măsurat e de 3–5 ms pe cadru pe i9.
- Scroll: un singur sistem (virtual-scroll → țintă de scroll a camerei → timeline Theatre). Nu există Lenis/ScrollTrigger concurente pe scenă; clasa `lenis` din DOM aparține paginilor de text ale motorului.

## 4. Probleme confirmate: dovezi, cauză, remediere

### 4.1 P0: erori în consolă
- **Dovadă:** la fiecare încărcare apăreau `You seem to have imported '@theatre/studio' but haven't initialized it` (`console.error`) și `AbortError: The play() request was interrupted`.
- **Cauze:**
  - Bundle-ul de producție Cartier include editorul Theatre (nefolosit), care raportează la 100 ms după pornire.
  - Textura video a filmului apelează `video.play()` fără să trateze promisiunea respinsă la o pauză imediată.
- **Remediere:** mesajul Theatre a fost eliminat (comportamentul rămâne neschimbat), iar `play()` e acum tratat. Patch-uri în `build_xelle.cjs`.
- **Rezultat:** 0 erori în toate cele 16 teste.

### 4.2 P1: scurgere de memorie la navigare
- **Dovadă:** la fiecare tur complet prin scene apăreau +5 MB heap, +74 event listeners și +314 noduri DOM reținute. Nodurile reținute erau titlurile scenelor, butoanele, navigarea laterală și containerele video.
- **Cauză:** lanțul de reținere din heap snapshot duce la stiva internă de blocuri a Vue (`blockStack`). Modificarea noastră din intro înlocuise `createElementBlock` cu un vnode simplu, dar lăsase deschiderea de bloc `sa()` în fața lui. Blocul rămânea deschis și strângea toate vnode-urile randate după el.
- **Remediere:** patch-ul înlocuiește acum și `sa()` (`build_xelle.cjs`). Am verificat că toate cele 167 de `sa()` din bundle sunt pereche cu `Qa`/`si`.
- **Rezultat:** după 3 tururi, nodurile rămân 385 → 385, listenerii 141 → 141, heap-ul 27,1 → 27,1 MB.

### 4.3 P1: scroll desincronizat
- **Dovezi:**
  - Pe telefon, un singur swipe trecea de la Pornstar Martini direct la Maracuja Mojito.
  - Pe desktop, 4 notch-uri de rotiță nu treceau de la Film la Galerie (camera rămânea între scene, la 120.752 din intervalul 116.771–138.358).
  - Durata tranzițiilor varia între 2,8 și 3,9 s.
- **Cauze:**
  - Multiplicatorul de swipe dublat într-o sesiune anterioară permitea depășirea unei scene întregi înainte de „lipire”.
  - Timeline-ul Theatre nu are marcaje de scenă pe segmentul Film → Galerie, deci motorul nu lipește camera acolo.
- **Remediere** (`scripts/xelle-scroll.js`):
  - un gest (input fără pauză de 220 ms) avansează cel mult o scenă;
  - fiecare segment cere aceeași cantitate de input;
  - la 450 ms după un gest fără lipire, camera e dusă la scena următoare dacă gestul a acoperit peste 12% din drum, altfel înapoi.
- **Rezultat:** testele de scroll lent, rapid (30 de notch-uri în 0,3 s = o singură scenă), invers, cu schimbare de direcție, de swipe pe telefon și de navigare completă trec toate. Tranzițiile durează uniform ~2,8 s pe desktop și ~2,3–2,5 s pe telefon.

### 4.4 P1: Înapoi/Înainte în magazin
- **Dovadă:** paginile de magazin foloseau `replaceState`, deci Înapoi de pe o pagină de produs ieșea de pe site.
- **Remediere:** paginile de magazin sunt intrări în istoric (`pushState`), iar `popstate` deschide sau închide pagina corespunzătoare (`xelle-shop.js`). Linkul direct inițial folosește `replace`.
- **Rezultat:** testul `back-forward` trece: produs → Înapoi la lista de produse → Înapoi la scena Pornstar Martini → Înainte la produse, cu scena desenând din nou.

### 4.5 P1: cost pe cadru
- **Matrice:** motorul recalcula matricele întregii scene (1025 de obiecte) la fiecare dintre cele 3 desenări pe cadru. Acum le calculează o singură dată pe cadru pentru scena principală. Am verificat că între treceri se schimbă doar vizibilitatea, nu pozițiile (`setWatchRender`).
- **JS pe procesor lent:** cu procesorul încetinit de 4 ori, ca pe un telefon mediu, scena rămâne la 118 fps (7 ms JS pe cadru). Procesorul nu e limita pentru 60 fps pe telefoane medii.
- **GPU:** pe Intel, scena de intrare costă 24–25,5 ms GPU pe cadru (tabelul pe etape e în PERFORMANCE_REPORT.md). Costul e distribuit pe ~18 etape de post-procesare ale motorului, cele mai mari fiind scena cu reflexie (~8 ms) și SMAA (~3,6 ms). Pe Intel la 1920×1080, limita reală e de ~33 fps.
- **Rezoluție adaptivă:**
  - scena pornește la densitatea reală a ecranului (maximum 2×);
  - decizia se ia în timpul întrebării despre sunet, cu scena estompată, ca schimbarea să nu se vadă;
  - pragul e acum 50 fps (ținta după reducere: 55), pentru că etichetele rămân clare oricum (4.7);
  - pe Intel cu ecran de telefon: 46–55 fps → 58–71 fps.

### 4.6 P2: sticla nu era produsul real
- **Dovezi** (comparație cu `public/xelle/maracuja-mojito-packshot.png`, 4096 px, și cu fotografiile de campanie):
  - Corpul real e mai scund decât lat (înălțime/diametru ≈ 0,95); modelul avea 1,09.
  - Eticheta reală acoperă ±0,94 rad (±54°), între 20% și 90% din înălțime, cu proporția 1,41. Cea din model acoperea ±0,86 rad aproape pe toată înălțimea, cu proporția ~1.
  - Emblema reală e un simbol geometric negru cu contur și cârlige aurii. Modelul folosea alt fișier (nod celtic).
  - Pe etichetă nu scrie „50 ml”; modelul îl adăuga. Textul real e în greutate normală, iar modelul îl îngroșase.
  - Sticla reală are bază groasă de sticlă transparentă (~15%), pereți groși, partea de sus rotunjită, iar capacul sferic stă direct pe sticlă; inelul auriu de sub capac din poze e parfumul văzut prin sticlă (măsurat ulterior, vezi GLB_AUDIT.md). Modelul avea perete simplu și un guler auriu înalt.
- **Remediere:**
  - Model nou în Blender, parametric, din dimensiunile măsurate (`scripts/blender_build_xelle_bottles.py`, sursa editabilă `blender/xelle_bottle.blend`).
  - Etichete reconstruite din packshot (`scripts/build_xelle_labels.py`): emblema e desfăcută de pe cilindru și separată în negru/auriu, wordmark-ul XELLÉ vine din fișierul de brand, titlurile sunt în Montserrat (cel mai apropiat font instalat; trebuie confirmat cu fișierul oficial).
  - Lichid randat ca lichid străbătut de lumină (adâncime de culoare, menisc) și sticlă limpede cu reflexii Fresnel.
- Detalii în GLB_AUDIT.md.

### 4.7 P2: etichete greu lizibile
- **Cauză:** eticheta e o textură pe un cilindru 3D, deci e reeșantionată de cameră (micșorare, curbură, rezoluția scenei). Pe Intel scena se desenează sub densitatea ecranului, iar textul devenea gri și moale.
- **Remediere** (`scripts/xelle-label-print.js`):
  - Cât timp scena stă pe loc, cerneala etichetei (text, emblemă, chenar; hârtia rămâne transparentă) e desenată ca imagine la densitatea reală a ecranului, într-un canvas 2D peste scenă.
  - Imaginea e mapată fâșie cu fâșie pe curbura proiectată a etichetei, folosind matricele exacte ale trecerii care desenează sticla.
  - Hârtia rămâne în 3D, deci primește lumina scenei. În tranziții se vede eticheta 3D.
  - Stratul se redesenează doar când ceva se mișcă.
- **Cost măsurat:** 0 fps (33 cu și fără strat, pe Intel).
- Nu e blur și nu e sharpening. E aceeași imagine, afișată la rezoluția nativă.

### 4.8 P2: regresie prinsă în timpul lucrului: colțuri albe în hero
- Cu silueta nouă, mai scundă, apăreau dreptunghiuri albe în colțurile de sus.
- **Cauză:** în repaus, motorul desenează masca de tranziție de 6× mai mare, iar zona din jurul originii modelului trebuie să fie în interiorul siluetei.
- **Remediere:** silueta include gâtul ascuns de capac (`build_xelle_models.py`).

### 4.9 P2: hero pe tabletă
- Pe ecrane în portret (iPad se raportează ca desktop), tabloul ușii rămânea în spatele unicei sticle.
- **Remediere:** tabloul se ascunde pe orice ecran îngust și revine la trecerea în peisaj (verificat prin rotire).

### 4.10 Accesibilitate: `prefers-reduced-motion`
- Tranzițiile automate ale camerei se scurtează la cel mult 0,6 s, iar înclinarea sticlei după cursor e oprită. Scroll-ul rămâne la utilizator.
- **Test:** navigarea completă trece, iar fiecare scenă se așază în ~1,2 s (față de ~2,8 s).

### 4.11 Încărcare
- **Pe mobil:** fotografiile de pe pereți erau încorporate la până la 3000 px. Acum sunt la latura de 1600 px (JPEG 90, 4:4:4). Desktopul rămâne byte cu byte identic. Scena pe mobil: 10,2 → 8,5 MB.
- **Sticlele:** compresie Draco (cuantizare fină) și tesselare adaptată: 834 → 233 KB pe desktop, 412 → 122 KB pe mobil.
- **Download total până la pornire:** mobil 41,7 → 38,2 MB; desktop 56,4 → 51,6 MB.

## 5. Fișiere modificate în acest audit

- **Runtime:**
  - noi: `scripts/xelle-scroll.js`, `scripts/xelle-label-print.js`;
  - modificate: `scripts/xelle-sections.js`, `scripts/xelle-shop.js`, `scripts/xelle-shop-layer.js`, `scripts/xelle-intro-scene.js`, `scripts/xelle-bottle-material.js`, `scripts/xelle-bottle-glass.glsl`, `scripts/build_xelle.cjs`, `public/xelle/xelle.css`.
- **Asset-uri și pipeline:**
  - noi: `scripts/xelle-products.json`, `scripts/build_xelle_labels.py`, `scripts/blender_build_xelle_bottles.py`, `blender/xelle_bottle.blend`;
  - modificate: `scripts/build_xelle_models.py` (rescris ca orchestrator), `scripts/build_xelle_backdrops.py`.
- **Generate:**
  - `public/assets/xelle-app.js`, `public/index.html` (versiune);
  - `public/xelle/models/*`, `public/xelle/labels/*` (inclusiv `emblem.png`, `*_print.png`, `*_mobile.png`), `public/xelle/masks/*`;
  - `public/xelle/backdrops/mainSceneMobile.glb` și `manifest.json`.
- **Teste și instrumente:**
  - noi: `audit/perf-run.mjs`, `audit/e2e.mjs`, `audit/gpu-passes.mjs`, `audit/cpu-profile.mjs`, `audit/glb-inspect.mjs`, `audit/load-bytes.mjs`, `audit/responsive.mjs`;
  - actualizate: `audit/check_xelle_static.py`, `audit/check_xelle_intro.cjs`;
  - rezultate: `audit/perf/*`.
- **Copii de siguranță** pentru modelele, etichetele, măștile și scena mobil anterioare: în folderul temporar al sesiunii (`models-backup`, `models-before-blender`, `labels-before-rebuild`, `backdrops-before`). Toate se pot regenera și din git.

## 6. Ce rămâne deschis

1. **Telefoane reale.** Toate testele de mobil sunt emulate (Chrome cu dimensiunile, densitatea, UA-ul și touch-ul unui iPhone). GPU-ul unui telefon real e diferit; trebuie testat pe 2–3 telefoane (unul recent și unul mai vechi).
2. **Fișierul oficial al etichetei** (PDF/AI de la designer). Reconstrucția din fotografie e fidelă ca layout și emblemă, dar fontul titlurilor e o aproximare (Montserrat). Generatorul acceptă înlocuirea directă (SCENE_WORKFLOW.md).
3. **Plăci integrate la rezoluție desktop.** 30–36 fps pe Intel UHD la 1920×1080 este limita motorului pe acest hardware; Cartier măsoară 3–9 fps pe același laptop. Următorul pas posibil ar fi un nivel de calitate separat pentru plăcile slabe: SMAA mai ieftin și reflexia podelei la rezoluție redusă. Necesită acordul tău, pentru că se vede.
4. **Încărcarea pe rețea lentă:** 38 s pentru 38 MB la 9 Mbit/s. În producție:
   - comprimare brotli pe CDN (bundle-ul JS de 7,1 MB scade la ~1,5–2 MB);
   - încărcarea amânată a personajelor (7,8–8,8 MB, folosite doar în scena filmului), care cere o modificare în loader-ul motorului;
   - texturi KTX2.
5. **Drepturi.** Proiectul folosește codul compilat și asset-uri Cartier: scene, personaje, hărți de mediu, ceasurile din `public/webgl/`. Pentru o lansare publică, acestea trebuie licențiate sau înlocuite. Acest audit nu a copiat nimic nou de pe cartier.com; observațiile tehnice au fost doar citite în browser.
6. **`public/xelle/models/Untitled.glb`** (160 KB) nu e folosit nicăieri. Se poate șterge cu acordul tău.
