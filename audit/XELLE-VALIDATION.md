# Xellé: verificare statică

Data: 14 septembrie 2026. Verificarea de mai jos privește fișierele construite, datele și logica patch-urilor. **Nu reprezintă o verificare în browser** și nu certifică aspectul, fluiditatea, transparența sau interacțiunile finale. Testarea vizuală și a navigării se consemnează separat.

## Rezultat

Toate verificările statice executate au trecut. Nu s-au găsit resurse Xellé lipsă în referințele bundle-ului curent.

- `node --check public/assets/xelle-app.js`: cod 0.
- `node --check scripts/build_xelle.cjs`: cod 0.
- `node --check scripts/start.mjs`: cod 0.
- `node --check server.mjs`: cod 0.
- `node --check public/assets/app.js`: cod 0; aplicația originală rămâne prezentă separat.
- `python audit/check_xelle_static.py`: trecut; rezultate detaliate și hash-uri GLB în `audit/xelle-static-results.json`.

## Conținut și resurse

Cele șapte obiecte de localizare `IG`, `pO`, `RG`, `NG`, `DG`, `OG`, `zG` sunt prezente. Home conține exact introducerea și patru parfumuri; datele de podcast nu mai sunt incluse. Fiecare produs păstrează camera sa, fotografia originală și toate cele trei niveluri de note din catalogul verificat.

| Scenă | Produs | Preț din catalog | Destinație cumpărare |
| --- | --- | --- | --- |
| 1 | Spiced Peach Negroni | 339 lei | https://xelle.ro/products/spiced-peach-negroni |
| 2 | Pornstar Martini | 349 lei | https://xelle.ro/products/pornstar-martini-50-ml |
| 3 | Prosecco di Cherry | 309 lei | https://xelle.ro/products/prosecco-di-cherry-50-ml |
| 4 | Maracuja Mojito | 359 lei | https://xelle.ro/products/maracuja-mojito-50-ml |

Prețurile și URL-urile au fost comparate cu `audit/xelle-catalog.json`, instantaneul public al magazinului; verificarea de față nu a retrimis cereri către magazin și nu a efectuat comenzi.

Toate cele 19 referințe `/xelle/` la fișiere din bundle se rezolvă local: patru fotografii JPG, opt modele de flacoane GLB pentru desktop/mobil, două scene principale GLB, patru măști PNG și wordmark-ul original PNG.

Pentru toate cele zece GLB au fost verificate magic/version/length, alinierea și limitele chunk-urilor, existența JSON-ului glTF 2.0, dimensiunile bufferelor, limitele bufferView, indicii de noduri și mesh-uri. Referințele imaginilor sunt încorporate sau se rezolvă local; nu există texturi externe lipsă. Aceste verificări nu înlocuiesc validarea GPU a shaderelor și materialelor.

Cele patru măști au semnătură PNG validă, dimensiuni 256 × 256 și sunt referite de bundle. Scenele originale rămân la `public/webgl/models/mainScene.glb` și `mainSceneMobile.glb`; cele adaptate sunt fișiere separate în `public/xelle/models/`.

## Logică inspectată

- Shaderul `OLt` setează `albedo.a=1.0` pentru materiale fără textură numai sub condiția `XELLE_BOTTLE`. Materialele decorului rămân neafectate. `opacity:o.opacity`, uniforma `alpha` și `depthWrite=false` rămân aplicate materialelor transparente ale flaconului. Verificarea vizuală este consemnată separat.
- Camera limitează destinațiile și scroll-ul la scena 4, dezactivează bucla și limitează snap-ul la cele patru parfumuri. Nu s-a observat o eroare sintactică în expresia cu virgulă din snap. Limitele, revenirea înapoi și primul/ultimul cadru necesită testare interactivă.
- Cardurile colecției folosesc `TJ(ue)` pentru rute locale; adresele HTTPS continuă să deschidă o filă externă. Cele patru `uri` corespund rutelor produselor și routerul folosește hash mode.
- Handlerul care pornea înregistrările audio originale la primul click a fost eliminat. Butonul de sunet nu mai este randat, iar shortcut-ul podcast este inert. Stilurile Xellé ascund elementele de podcast și film.
- `public/index.html` folosește `lang="ro"`, titlu Xellé, `xelle-app.js` și CSS-ul Xellé. `LANG='en_fr'` este cheia internă păstrată pentru obiectele cu text românesc.
- `public/cartier.html` folosește în continuare bundle-ul și CSS-ul original. `Porneste Xelle.cmd` deschide `/#/`; `Porneste Cartier.cmd` transmite `--original` și deschide `/cartier.html#/`. Pornirea serverului folosește `windowsHide:true`.

## Observații de documentație transmise integratorului

README a fost actualizat cu `python scripts/build_xelle_intro.py` și dependențele Pillow și NumPy.

## Limite ale verificării

Nu s-au executat click-uri, scroll, navigare, verificări de randare mobil/desktop, cumpărări sau teste de rețea prin acest subtask. Selectorul tehnic `?lang=` și celelalte locale ale aplicației originale nu sunt o funcție expusă de adaptare; versiunea construită furnizează conținut doar pentru cheia internă `en_fr`.
