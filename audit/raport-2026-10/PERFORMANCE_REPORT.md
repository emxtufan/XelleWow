# Raport de performanță Xellé 3D

**Cum s-a măsurat:**
- `audit/perf-run.mjs` lansează Chrome headless cu profil nou, parcurge cele 7 scene prin input real (rotiță sau swipe) și măsoară 3 s pe fiecare scenă oprită.
- `audit/gpu-passes.mjs` măsoară timpul GPU pe fiecare etapă de randare, cu `EXT_disjoint_timer_query_webgl2`.
- `audit/load-bytes.mjs` măsoară octeții descărcați până la pornire.
- `audit/e2e.mjs` rulează scenariile end-to-end.
- Rezultatele brute (JSON) sunt în `audit/perf/`.

**„Înainte”** e starea de la începutul acestui audit (20.10.2026), cu modificările sesiunilor anterioare. **„După”** e starea finală. Hardware: i9-13980HX; Intel UHD (integrată) sau RTX 4070 Laptop, aleasă explicit.

**Limitele măsurătorii:**
- Headless Chrome nu are vsync, deci fps-ul poate depăși 60 (120 e plafonul ticker-ului motorului).
- Mobilul e **emulat**: dimensiune, densitate, UA și touch de iPhone, dar GPU-ul e cel al laptopului. Nu înlocuiește un test pe telefon real.

## Tabel principal

| Indicator | Înainte | După |
|---|---|---|
| FPS desktop 1920×1080, RTX 4070 (pe scene) | 120 / 120 / 108 / 87 / 82 / 84; Galeria inaccesibilă la scroll | **120 în toate cele 7 scene** |
| FPS desktop 1920×1080, Intel UHD (scena la 0,75×) | 33 / 36 / 37 / 39 / 37 / 38; Galeria inaccesibilă | 30 / 32 / 32 / 34 / 32 / 33 / 36 (toate scenele) |
| FPS mobil 390×844@3 emulat, RTX | 89 / 89 / 83 / *sărită* / 81 / 82 / 84 | **120 în toate scenele, nicio scenă sărită** |
| FPS mobil 390×844@3 emulat, Intel | 46–55 (primă măsurătoare cu sticla nouă, prag 40) | **58–71** (scenă 1,75×, prag 50) |
| Timp GPU pe cadru, Intel, intrare (1440×810) | 24,0 ms | 25,5 ms (+1,5 ms: două straturi de sticlă transparentă × 4 sticle) |
| Timp GPU pe cadru, Intel, mobil, intrare (780×1688) | n/m | 15,1 ms la 2× (de aici coborârea la 1,75×) |
| Draw calls / cadru (desktop) | intrare 128, scene 45–57 | intrare 115, scene 43–63 (Galeria inclusă) |
| Triunghiuri / cadru (desktop) | intrare 118k, scene 21–84k | intrare 124k, scene 17–84k |
| Recalculări de matrice ale scenei pe cadru | 3 | **1** |
| CPU (JS) / cadru, RTX desktop | 3,0–4,3 ms (prima măsurătoare cu această coloană, după reparația de scroll) | 3,1–4,7 ms |
| CPU încetinit 4× (telefon mediu), mobil emulat | n/m | 118 fps, 7,1 ms JS / cadru |
| Memorie JS după o parcurgere | 42 MB (Intel) / 77 MB (RTX) | 44 MB (Intel) / 62 MB (RTX) |
| Memorie după 3 tururi complete (scurgere) | 30,6 → 36,4 → 41,0 MB; noduri 784 → 1410; listeners 254 → 402 | **27,1 → 26,9 → 27,1 MB; noduri 385 → 385; listeners 141 → 141** |
| GLB sticlă (desktop / mobil) | 834 KB / 412 KB, 17k / 6,7k triunghiuri, fără compresie | **233 KB / 122 KB**, 16,4k / 9k triunghiuri, Draco |
| Scena de pereți (mobil) | 10,2 MB | 8,5 MB (desktop identic, 14,6 MB) |
| Descărcat până la pornire, mobil / desktop | 41,7 MB / 56,4 MB | 38,2 MB / 51,6 MB; **32,1 MB / 44,7 MB** după reducerea modelului cu personaje (doar piesele filmului) |
| FPS desktop 1920×1080, Intel UHD, după reducerea personajelor și cu eticheta clară desenată la fiecare cadru | | 36 / 39 / 40 / 42 / 41 / 42 / 45 (`audit/perf/intel-1920-labels-live.json`; un task de 102 ms la prima tranziție) |
| Timp până la pornire, server local (desktop / mobil) | 6,7–7,6 s / 3,9–5,4 s | 5,5–6,4 s / 3,9–5,4 s (variază mult între rulări; pe mobil nu se poate afirma o îmbunătățire) |
| Timp până la pornire, 9 Mbit/s, 150 ms, telefon | 40,2 s | 38,2 s; **31,8 s** după reducerea personajelor |
| Cache gol / cald (desktop) | n/m | 5,8 s / 4,6 s |
| Durata tranziției între scene | desktop 2,8–3,9 s (inegal); mobil 1,5–1,7 s, cu salturi peste scene | desktop ~2,8 s uniform; mobil 2,3–2,5 s, fără salturi; reduced-motion ~1,2 s |
| Task-uri > 50 ms în tranziții | 0 desktop; 52–78 ms pe mobil (2 tranziții) | 0 desktop; 1 × 53 ms pe mobil |
| Erori în consolă | 2 la fiecare încărcare | **0** |
| Teste end-to-end | 13/15 (scurgere, scroll invers) | **16/16** (inclusiv `reduced-motion`, adăugat) |

*n/m = nemăsurat în starea „înainte” (testul a fost adăugat ulterior).*

## Referința Cartier pe același laptop (Intel UHD, browser real)

| | Cartier | Xellé (după) |
|---|---|---|
| Intrare | 9 fps (p95 200 ms) | 30 fps (p95 42 ms) la 1920×1080; 58 fps pe ecran de telefon |
| Prima scenă | 3 fps | 32 fps |
| Rezoluție de randare | 1,5× fix (2400×1246 pentru 1600×831 CSS) | densitatea ecranului (max 2×), adaptivă |

## Unde se duce timpul GPU (Intel, intrare, 1440×810, după)

| ms / cadru | Etapă |
|---|---|
| 4,98 + 3,93 | scena (podea cu reflexie, cameră, sticle), cu trecerile alternate ale oglinzii |
| 3,54 | SMAA (antialiasing), etapa de amestec |
| 1,90 | lumina de tip spot / „magic light” (feedback de la cadrul anterior) |
| 1,89 | copieri între texturi (×2,5) |
| 1,59 | trecerea de lumină |
| 1,42 | strălucirea / halo-urile (11 draw-uri) |
| 1,35 | spectrul de lumină și blue noise |
| 1,32 | normale și adâncime |
| restul | ~0,1–0,8 fiecare (SMAA margini, bloom, compoziție, pereții foto) |
| **25,5** | **total** |

Concluzie: costul e distribuit pe post-procesarea motorului original, nu pe obiectele noastre. Pe o placă integrată, 60 fps la rezoluție desktop ar cere renunțarea vizibilă la efecte (SMAA mai ieftin, reflexie la rezoluție redusă). Nu am aplicat asta fără acordul tău.

## Comenzi de reproducere

```powershell
node audit/perf-run.mjs --gpu=intel --size=1920x1080 --dpr=1 --out=audit/perf/x.json
node audit/perf-run.mjs --gpu=nvidia --size=390x844 --dpr=3 --mobile
node audit/gpu-passes.mjs --gpu=intel --size=1920x1080 [--section=prosecco-di-cherry]
node audit/cpu-profile.mjs --mobile --cpu=4 --section=pornstar-martini
node audit/load-bytes.mjs [--mobile]
node audit/e2e.mjs --gpu=nvidia --out=audit/perf/e2e.json
node audit/responsive.mjs
```

Serverul local trebuie să ruleze pe 127.0.0.1:4173 (`node server.mjs`).
