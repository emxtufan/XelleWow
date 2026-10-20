# Xellé — experiență locală de parfumuri

Acest folder conține adaptarea în română pentru [colecția de parfumuri Xellé](https://xelle.ro/collections/parfum), construită pe experiența interactivă Cartier salvată local. Pagina principală este Xellé; copia originală Cartier rămâne disponibilă separat.

## Pornire

1. Dublu clic pe **Porneste Xelle.cmd**.
2. Se deschide **http://localhost:4173/#/** în browser.
3. Pentru oprire, dublu clic pe **Opreste Xelle.cmd**.

Pentru experiența Cartier originală, folosește **Porneste Cartier.cmd**, care deschide **http://localhost:4173/cartier.html#/**. Cele două versiuni folosesc același server. Oricare dintre comenzile de oprire închide serverul comun.

Este necesar Node.js 18 sau mai nou. Pentru rularea fișierelor deja construite nu trebuie instalate pachete npm. Resursele experienței sunt locale; folosește serverul, deoarece deschiderea directă a `public/index.html` prin `file://` nu funcționează pentru modulele și resursele 3D.

Alternativ, din PowerShell, în acest folder:

```powershell
node.exe scripts/start.mjs

# Originalul Cartier
node.exe scripts/start.mjs --original

# Pornește sau reutilizează serverul, fără să deschidă browserul
node.exe scripts/start.mjs --no-open
```

`npm.cmd start` rămâne disponibil pentru pornirea serverului în terminal. Serverul ascultă numai pe calculatorul local, pe portul 4173.

## Conținut Xellé

- Patru parfumuri: Spiced Peach Negroni, Pornstar Martini, Prosecco di Cherry și Maracuja Mojito.
- Intrarea prezintă cele patru flacoane Xellé mai aproape de cameră, pe socluri, în încăperea originală cu podea reflectantă. Lumina din spate și haloul sunt atenuate numai la intrare, pentru claritatea sticlei; efectele dinamice de lumină și umbră sunt păstrate. Elementele ondulate și fumul sunt eliminate din scena de intrare. Cele patru tablouri ale încăperii — ambele canaturi ale ușii centrale și cele două panouri laterale — poartă fotografii editoriale Xellé; textele suplimentare rămân ascunse. Pe ecrane înguste, primul flacon apare în prim-plan; săgeata discretă de jos deschide colecția, iar săgeata din navigarea laterală revine la intrare.
- Navigare între scene, flacoane 3D și pagini cu fotografiile originale, descrieri și note olfactive publicate pe Xellé.
- Sticla este reconstruită în Blender după fotografia de studio a produsului (proporții, bază și pereți groși, inel auriu, etichetă reală), cu lichid străbătut de lumină și reflexii de studio. Dimensiunile, eticheta și produsele sunt în `scripts/xelle-products.json`; modelul se generează cu `scripts/blender_build_xelle_bottles.py`, etichetele cu `scripts/build_xelle_labels.py`, iar integrarea de randare e în `scripts/xelle-bottle-material.js`, `scripts/xelle-label-print.js` (eticheta clară la rezoluția ecranului) și cele două fișiere GLSL.
- În scenele principale, flacoanele sunt coborâte discret și au o umbră moale dedesubt. Reglajul și umbra se retrag la deschiderea prezentării produsului; valorile se ajustează în `scripts/xelle-bottle-placement.js`.
- Personajele 3D, mesele, scaunele și obiectele de lucru sunt păstrate numai în secțiunea filmului. Scenele parfumurilor păstrează flacoanele, fotografiile și decorul arhitectural, fără mobilierul de atelier sau reflexiile lui.
- Logo și fotografii originale descărcate de pe magazinul Xellé.
- Fotografii de campanie pe suprafețele 3D din spatele parfumurilor, cu proporțiile păstrate. Spiced Peach Negroni și Pornstar Martini folosesc pereții existenți, Prosecco di Cherry are un perete curbat adăugat, iar Maracuja Mojito apare pe cele trei panouri ale scenei sale.
- Patru tablouri în încăperea de intrare, pe ramele originale: cele două canaturi ale ușii centrale și panourile din stânga și din dreapta. Fotografiile sunt încadrate integral, cu margini deschise sus și jos, iar podeaua reflectantă le preia ca pe restul încăperii.
- După cele patru parfumuri, derulează mai departe pentru **Filmul Xellé**, apoi **Galerie Cartier — Temporară**. Filmul folosește videoclipul Xellé furnizat; galeria păstrează temporar materialele Cartier. Punctele laterale sunt și butoane: poți selecta direct oricare parfum, filmul sau galeria, inclusiv din tastatură.

Filmul și previzualizarea sa sunt locale și sunt disponibile în experiența pentru desktop și mobil. Apasă controlul de redare pentru a deschide filmul. Galeria reunește **13 prezentări Cartier**, cu fotografii, înregistrări audio și texte originale în engleză. Selectează o fotografie pentru a asculta prezentarea; pe mobil, fotografiile sunt împărțite în două pagini, iar controlul circular permite schimbarea paginii sau oprirea înregistrării active.

Sunetul se activează printr-o acțiune explicită: redarea filmului, selectarea unei fotografii din galerie sau butonul **Sunet**. Încărcarea paginii și derularea nu pornesc singure sunetul. Butonul **Sunet** permite apoi oprirea sau reactivarea lui. Prezentările despre ceasurile Cartier apar în galeria dedicată și nu sunt asociate celor patru parfumuri Xellé.

Flacoanele 3D sunt reconstruite după fotografiile publice ale produselor; nu sunt modele CAD originale furnizate de producător. Forma, proporțiile, etichetele și materialele sunt o interpretare realizată pentru această experiență locală.

Conținutul și prețurile reprezintă un instantaneu al paginilor publice Xellé din **14 septembrie 2026**. Datele nu se sincronizează automat. Butoanele către magazin deschid paginile oficiale pe **xelle.ro**, unde au loc cumpărarea și checkout-ul și unde se confirmă prețurile și disponibilitatea actuale. Aceste pagini externe necesită internet; copia locală nu include un backend de comenzi, plăți sau conturi.

## Copia Cartier originală

Experiența originală de la [Cartier Watches & Wonders](https://www.cartier.com/en-fr/watchesandwonders#/) este păstrată în acest folder, cu codul, stilurile, modelele 3D, texturile, fonturile, imaginile, clipurile și înregistrările audio originale. Intrarea este `public/cartier.html`.

- Scene 3D și sunet, în limba engleză a adresei furnizate.
- Roadster, Baignoire și Myst de Cartier, Crash și Tortue Monopusher, Santos-Dumont și Tortue.
- Galerii, filmul principal, clipurile de produs și cele 13 podcasturi.
- Resurse originale pentru desktop și mobil.

Linkurile către magazinul Cartier, Instagram, contact și alte pagini externe rămân linkuri externe și necesită internet. Serviciile comerciale ale Cartier (cont, coș, comandă, newsletter) nu sunt servere incluse în această copie. Acesta este exportul aplicației Watches & Wonders, nu întregul magazin cartier.com.

## Fișiere

- `public/index.html` — intrarea pentru Xellé.
- `public/cartier.html` — intrarea pentru Cartier original.
- `public/assets/xelle-app.js` și `public/xelle/xelle.css` — aplicația și stilurile adaptării.
- `public/xelle/` — fotografii, logo, catalog, flacoane 3D și etichete Xellé.
- `public/xelle/models/` — cele opt flacoane GLB pentru desktop/mobil și cele două scene Xellé de bază, păstrate înaintea adăugării fotografiilor.
- `public/xelle/backdrops/` — cele două scene GLB active, cu fotografiile încorporate; `manifest.json` descrie imaginile și suprafețele pe care sunt aplicate.
- `public/xelle/video_xelle.mp4` — filmul Xellé furnizat, aproximativ 55 de secunde, folosit cu sunet în ambele orientări și afișat integral, cu proporțiile păstrate.
- `scripts/xelle-movie-fit.glsl` — încadrarea completă a filmului pe ecranul 3D, cu proporțiile păstrate. Ecranul folosește același fișier video, redat fără sunet înainte de deschiderea playerului.
- `public/videos/movie/` — fișierele Cartier păstrate pentru copia originală.
- `public/audio/podcasts/` și `public/images/podcasts/` — cele 13 înregistrări originale, fotografiile HD/LD și măștile galeriei Cartier.
- `public/` — resursele ambelor versiuni; descărcarea Cartier originală ocupă aproximativ 397 MB, la care se adaugă fișierele Xellé.
- `original/` — codul și stilurile originale, înaintea ajustării pentru serverul local.
- `server.mjs` — server static cu suport pentru redarea și derularea fișierelor media.
- `scripts/localize.mjs` — ajustarea copiei Cartier originale pentru citirea locală a bazei de date de detectare GPU.
- `scripts/build_xelle_models.py` — construiește, în ordine, etichetele, măștile de tranziție, flacoanele (prin Blender) și manifestul; datele vin din `scripts/xelle-products.json`. Sursa editabilă a flaconului: `blender/xelle_bottle.blend`.
- `scripts/build_xelle_intro.py` — generarea scenelor de bază cu identitatea Xellé.
- `scripts/build_xelle_backdrops.py` — generarea unor copii ale scenelor de bază cu fotografii pe pereți, panouri și pe tablourile încăperii de intrare; pe desktop JPEG-urile sunt încorporate fără modificarea pixelilor, pe mobil cele mai mari de 1600 px sunt redimensionate la 1600 px.
- `scripts/xelle-wall-material.js` — materialul care afișează fotografiile pe suprafețele 3D, fără deformarea proporțiilor. Pentru tablourile înclinate ale intrării folosește un sistem de axe măsurat chiar pe suprafața lor, iar cele două canaturi ale ușii centrale își decupează fiecare jumătatea proprie din aceeași grilă.
- `scripts/xelle-media-audio.js` — activarea explicită a sunetului și deblocarea playerului galeriei la interacțiunea utilizatorului; este inclus în bundle de scriptul de construire.
- `scripts/xelle-scene-navigation.js` — navigarea directă între cele șase scene de după introducere.
- `scripts/build_xelle_content.py` — generarea textelor Xellé în structura de date a aplicației originale.
- `scripts/build_xelle.cjs` — generarea bundle-ului Xellé pornind din `original/app.js`, prin înlocuiri verificate.
- `scripts/build_xelle_shop.mjs` — salvează catalogul Shopify (produse, colecții, texte, poze) în `public/xelle/shop/catalog.json`, de unde magazinul pornește instant; stocul și prețurile se citesc mereu live. Rulează-l după ce modifici produse în Shopify: `node scripts/build_xelle_shop.mjs`.
- `audit/xelle-catalog.json` — datele verificate ale produselor și sursele lor publice.
- `audit/xelle-build.json` — raportul construirii bundle-ului Xellé.
- `audit/asset-paths.json` — inventarul extras din codul original.
- `audit/integrity-report.json` — verificarea integrității modelelor și a resurselor.
- `scripts/download_assets.py` — redescărcarea resurselor publice; necesită Python și `curl_cffi`, doar pentru refacerea descărcării.
- `scripts/verify_assets.py` — verificarea locală a fișierelor.

## Reconstruirea adaptării Xellé

Acești pași sunt necesari numai după modificarea scripturilor sau datelor sursă. Python trebuie să aibă bibliotecile Pillow și NumPy disponibile; scriptul pentru modele folosește fonturile locale ale sistemului (Montserrat, Arial, Georgia) și Blender 4.2+ (cea mai nouă instalare din `C:/Program Files/Blender Foundation` sau calea din variabila `BLENDER`).

```powershell
python scripts/build_xelle_models.py
python scripts/build_xelle_intro.py
python scripts/build_xelle_backdrops.py
python scripts/build_xelle_content.py
node.exe --expose-internals scripts/build_xelle.cjs
python audit/check_xelle_static.py
```

Opțiunea `--expose-internals` permite scriptului de construire să folosească parserul Acorn inclus în Node.js. Nu este necesară pentru pornirea serverului.

## Audit, teste și performanță

Raportul din octombrie 2026 (referința Cartier, probleme găsite, măsurători înainte/după, auditul modelelor și workflow-ul pentru modele noi) este în `audit/raport-2026-10/`: `AUDIT.md`, `PERFORMANCE_REPORT.md`, `GLB_AUDIT.md`, `SCENE_WORKFLOW.md`. Cu serverul pornit, `node audit/e2e.mjs` rulează 16 scenarii în Chrome (scroll, resize, înapoi/înainte, memorie, pierderea contextului WebGL, reduced motion, telefon), iar `node audit/perf-run.mjs` măsoară fiecare scenă; ambele folosesc numai Chrome și Node, fără dependențe.

Aplicația de bază rămâne JavaScript compilat; nu este un proiect sursă Nuxt decompilat. Scripturile Xellé creează resurse și un bundle separat, păstrând fișierele originale pentru comparație și revenire.

## Schimbarea fotografiilor de pe pereți

Asocierea dintre scenă și fotografie este în dicționarul `PHOTOS` din `scripts/build_xelle_backdrops.py`. Acesta folosește fotografiile din `public/xelle/backgrounds-noi/` (`scena01`–`scena03` și câte una pentru fiecare dintre cele trei panouri ale scenei 4). Pentru o altă fotografie, înlocuiește JPEG-ul cu același nume sau schimbă numele din `PHOTOS` pentru scena dorită.

Tablourile din încăperea de intrare sunt configurate separat, în lista `PAINTINGS` din același fișier. Fiecare intrare are un `photo` care se poate înlocui cu orice JPEG din `public/xelle/`; restul câmpurilor descriu rama măsurată a panoului și nu depind de imaginea aleasă. Ordinea intrărilor este canatul stâng al ușii centrale, canatul drept, panoul din stânga și panoul din dreapta. `DSC5430.jpg` este fotografia de campanie rămasă nefolosită.

După schimbarea fotografiilor sau a materialului de afișare, sunt suficiente comenzile:

```powershell
python scripts/build_xelle_backdrops.py
node.exe --expose-internals scripts/build_xelle.cjs
python audit/check_xelle_static.py
```

Reîncarcă apoi pagina din browser. Scriptul pentru fundaluri folosește biblioteca standard Python și Pillow și citește scenele din `public/xelle/models/`; scrie rezultatele în `public/xelle/backdrops/`. Nu reconstruiește flacoanele și nu suprascrie scenele de bază. Dacă ai îmbunătățit flacoanele în Blender, nu relansa `build_xelle_models.py` decât dacă dorești să le înlocuiești cu variantele generate.

Fotografiile sunt încadrate integral pe suprafețe, cu margini deschise acolo unde proporțiile imaginii și ale peretelui diferă. Poziționarea și raportul suprafeței se transmit prin metadatele `xellePhoto` ale nodurilor GLB; încadrarea și culoarea marginilor sunt controlate de `scripts/xelle-wall-material.js`. Verificarea statică produce `audit/xelle-static-results.json`; aspectul, mișcarea și încadrarea finală se verifică separat în browser.

## Înlocuirea materialelor Cartier temporare

Pentru o înlocuire viitoare, păstrează fișierele Cartier originale și adaugă filmul, previzualizarea, fotografiile și înregistrările Xellé în `public/xelle/`. Adresele filmului și ale previzualizării se adaptează prin `scripts/build_xelle.cjs`; titlurile secțiunilor și datele prezentărilor sunt generate de `scripts/build_xelle_content.py`. Galeria audio se construiește din `public/xelle/galerie/` (`galerie.json`, o fotografie și un fișier audio pentru fiecare produs; vezi `CITESTE-MA.txt` din acel folder): `scripts/build_xelle_gallery.py` generează miniaturile și măștile, iar înregistrările sunt introduse în `pO.pages`, de unde aplicația citește galeria. Fișierele audio sunt momentan placeholder.

Pentru filmul Xellé, ecranul 3D și playerul folosesc același `video_xelle.mp4` pe desktop și în orientare portret. Nu este necesar un fișier `video_xelleVertical.mp4`. După înlocuirea videoclipului, reîncarcă pagina; proporțiile imaginii sunt citite din video. Fișierul sursă nu este modificat.

Galeria 3D folosește ordinea din `galerie.json` pentru asocierea fotografiilor cu suprafețele, inclusiv pe cele două pagini de mobil. Pe desktop are 16 rame (13 originale plus trei adăugate de `build_xelle_backdrops.py`, configurate în `GALLERY_FRAMES`); pe telefon rămân cele două pagini de câte 7, deci acolo se văd primele 14 produse. Cele patru fotografii de campanie de pe pereții parfumurilor se configurează separat, prin `PHOTOS`, după pașii de mai sus.

După modificarea textelor sau a logicii media, reconstruiește datele și bundle-ul, apoi verifică fișierele și redarea în browser:

```powershell
python scripts/build_xelle_content.py
node.exe --expose-internals scripts/build_xelle.cjs
python audit/check_xelle_static.py
```

Pentru aceste schimbări nu este necesară regenerarea flacoanelor sau a scenelor GLB. `original/` și intrarea `public/cartier.html` păstrează copia Cartier pentru comparație.
