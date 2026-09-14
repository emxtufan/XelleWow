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
- Navigare între scene, flacoane 3D și pagini cu fotografiile originale, descrieri și note olfactive publicate pe Xellé.
- Logo și fotografii originale descărcate de pe magazinul Xellé.
- Fotografii de campanie pe suprafețele 3D din spatele parfumurilor, cu proporțiile păstrate. Spiced Peach Negroni și Pornstar Martini folosesc pereții existenți, Prosecco di Cherry are un perete curbat adăugat, iar Maracuja Mojito apare pe cele trei panouri ale scenei sale.

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
- `public/` — resursele ambelor versiuni; descărcarea Cartier originală ocupă aproximativ 397 MB, la care se adaugă fișierele Xellé.
- `original/` — codul și stilurile originale, înaintea ajustării pentru serverul local.
- `server.mjs` — server static cu suport pentru redarea și derularea fișierelor media.
- `scripts/localize.mjs` — ajustarea copiei Cartier originale pentru citirea locală a bazei de date de detectare GPU.
- `scripts/build_xelle_models.py` — reconstruirea flacoanelor, etichetelor și măștilor Xellé.
- `scripts/build_xelle_intro.py` — generarea scenelor de bază cu identitatea Xellé.
- `scripts/build_xelle_backdrops.py` — generarea unor copii ale scenelor de bază cu fotografii pe pereți și panouri; JPEG-urile sunt încorporate fără modificarea pixelilor.
- `scripts/xelle-wall-material.js` — materialul care afișează fotografiile pe suprafețele 3D, fără deformarea proporțiilor.
- `scripts/build_xelle_content.py` — generarea textelor Xellé în structura de date a aplicației originale.
- `scripts/build_xelle.cjs` — generarea bundle-ului Xellé pornind din `original/app.js`, prin înlocuiri verificate.
- `audit/xelle-catalog.json` — datele verificate ale produselor și sursele lor publice.
- `audit/xelle-build.json` — raportul construirii bundle-ului Xellé.
- `audit/asset-paths.json` — inventarul extras din codul original.
- `audit/integrity-report.json` — verificarea integrității modelelor și a resurselor.
- `scripts/download_assets.py` — redescărcarea resurselor publice; necesită Python și `curl_cffi`, doar pentru refacerea descărcării.
- `scripts/verify_assets.py` — verificarea locală a fișierelor.

## Reconstruirea adaptării Xellé

Acești pași sunt necesari numai după modificarea scripturilor sau datelor sursă. Python trebuie să aibă bibliotecile Pillow și NumPy disponibile; scriptul pentru modele folosește fonturile locale ale sistemului.

```powershell
python scripts/build_xelle_models.py
python scripts/build_xelle_intro.py
python scripts/build_xelle_backdrops.py
python scripts/build_xelle_content.py
node.exe --expose-internals scripts/build_xelle.cjs
python audit/check_xelle_static.py
```

Opțiunea `--expose-internals` permite scriptului de construire să folosească parserul Acorn inclus în Node.js. Nu este necesară pentru pornirea serverului.

Aplicația de bază rămâne JavaScript compilat; nu este un proiect sursă Nuxt decompilat. Scripturile Xellé creează resurse și un bundle separat, păstrând fișierele originale pentru comparație și revenire.

## Schimbarea fotografiilor de pe pereți

Asocierea dintre scenă și fotografie este în dicționarul `PHOTOS` din `scripts/build_xelle_backdrops.py`. Acesta folosește cele patru fotografii de produs din `public/xelle/`. Pentru o altă fotografie, adaugă un JPEG în acel folder și schimbă numele din `PHOTOS` pentru scena dorită.

După schimbarea fotografiilor sau a materialului de afișare, sunt suficiente comenzile:

```powershell
python scripts/build_xelle_backdrops.py
node.exe --expose-internals scripts/build_xelle.cjs
python audit/check_xelle_static.py
```

Reîncarcă apoi pagina din browser. Scriptul pentru fundaluri folosește numai biblioteca standard Python și citește scenele din `public/xelle/models/`; scrie rezultatele în `public/xelle/backdrops/`. Nu reconstruiește flacoanele și nu suprascrie scenele de bază. Dacă ai îmbunătățit flacoanele în Blender, nu relansa `build_xelle_models.py` decât dacă dorești să le înlocuiești cu variantele generate.

Fotografiile sunt încadrate integral pe suprafețe, cu margini deschise acolo unde proporțiile imaginii și ale peretelui diferă. Poziționarea și raportul suprafeței se transmit prin metadatele `xellePhoto` ale nodurilor GLB; încadrarea și culoarea marginilor sunt controlate de `scripts/xelle-wall-material.js`. Verificarea statică produce `audit/xelle-static-results.json`; aspectul, mișcarea și încadrarea finală se verifică separat în browser.
