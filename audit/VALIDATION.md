# Verificare locală — 14 septembrie 2026

## Fișiere

Raport automat: `integrity-report.json`. 799 fișiere din inventarul aplicației și 15 baze de date GPU sunt prezente. Nicio resursă necesară lipsă, nicio eroare de semnătură/conținut detectată. Toate cele 12 GLB au antet, lungime, structură JSON și buffere valide; niciunul nu are dependențe externe. Cele 91 de nume de fotografii fără rezoluție sunt intrări în resolverul original; variantele lor concrete sunt descărcate.

Sunt incluse cele 5 clipuri verticale generate de resolverul original, pe lângă cele 6 clipuri cu nume explicite din bundle.

## Browser

Verificat în browserul Chromium integrat, cu cererile HTTPS externe blocate temporar pe fila de test:

- Scena 3D originală de introducere și navigarea spre Roadster.
- Pagina Roadster, deschiderea galeriei și trecerea 1/5 → 2/5, cu fotografia afișată.
- Clipul Roadster local: `readyState=4`, redare activă și timp avansat la peste 25 secunde.
- Conținutul paginii Baignoire și Myst de Cartier, imagini fără erori de încărcare și clip local de 30 secunde încărcat.
- Deschiderea directă a paginii Crash și afișarea modelului 3D corespunzător.
- Scena mobilă Roadster la 393×852; imagine salvată în `mobile-roadster.png`.
- Filmul principal vertical din `movieVertical.mp4`: `readyState=4`, redare activă, timp avansat la peste 15 secunde, durată 136,96 secunde.
- Controlul Sound și închiderea ferestrei video.

Mesajul despre `@theatre/studio` și anumite avertismente Three.js sunt prezente și în site-ul original. Codul compilat a fost păstrat. Inițializarea originală pregătește scena GPU prin cadre de animație; într-o filă în fundal, încărcarea poate dura mai mult, inclusiv la indicatorul 100%.

Nu au fost parcurse individual toate imaginile, toate cele 13 podcasturi și fiecare interacțiune de pe fiecare pagină. Integritatea fișierelor și funcționarea interacțiunilor reprezentative au fost verificate separat.

## Server și pornire

- Pornire, oprire și repornire; o a doua pornire recunoaște serverul existent.
- Răspunsuri HTTP, tipuri MIME pentru JS/WASM/GLB și suport HEAD.
- Cereri Range pentru MP4/MP3, inclusiv secțiuni din mijloc/sfârșit, validate față de octeții de pe disc.
- Răspuns 416 pentru intervale invalide și refuzarea căilor în afara folderului public.

Serviciile comerciale și paginile externe Cartier rămân în afara copiei locale.
