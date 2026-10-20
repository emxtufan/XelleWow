# Xellé — înlocuirea filmului

14 septembrie 2026. Filmul Cartier temporar este înlocuit cu videoclipul Xellé furnizat. Acest raport actualizează verificările video din `XELLE-MEDIA-VALIDATION.md`; verificările galeriei din acel raport rămân separate.

## Fișier și integrare

- Sursa existentă: `public/xelle/video_xelle.mp4`, 11.221.205 octeți; H.264, 960×720, AAC, durată 55,121315 s.
- SHA-256 sursă: `E84AA60E6192214ECF2F3C4029A62B90D9F30108DF042E969BDC0EB0D0F23F90`. Fișierul furnizat nu este modificat.
- Ecranul 3D și playerul folosesc aceeași sursă în ambele orientări. Nu se generează sau solicită o variantă `Vertical`.
- Shader-ul normalizează intervalul UV decupat al ecranului original și păstrează proporțiile sursei. Playerul folosește `object-fit: contain`.
- Titlu: „Filmul Xellé”; control de redare: „Redă filmul Xellé”. Galeria folosește în continuare materialele Cartier temporare.

## Verificări

- Generarea celor 7 tabele de conținut și a bundle-ului: reușită, 57 înlocuiri verificate.
- `node --check public/assets/xelle-app.js` și `python audit/check_xelle_static.py`: reușite.
- Browser Chromium, 1280×800: film vizibil pe ecranul 3D; click pe ecran deschide sursa Xellé. Playerul are `readyState=4`, `paused=false`, `muted=false`, `object-fit=contain`, durată 55,121315 s și timp în creștere până la peste 9 s.
- Browser Chromium, 393×852: controlul „Redă filmul Xellé” deschide aceeași sursă; `readyState=4`, `paused=false`, `muted=false`, `object-fit=contain`, timp peste 11 s.
- Escape ascunde playerul, pune filmul pe pauză și readuce scena video.
- Fără erori noi de compilare shader sau redare în sesiunile verificate. Mesajul Theatre.js despre inițializarea studioului provine din aplicația originală.

Formatul portret a fost testat într-un browser desktop redimensionat; nu pe un telefon fizic. În scena 3D, camera păstrează compoziția originală, astfel încât marginile ecranului pot ieși din fereastra îngustă; playerul deschis încadrează întregul film.
