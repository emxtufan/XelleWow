# Xellé — verificarea secțiunilor media

14 septembrie 2026. Materiale Cartier temporare, activate la cererea utilizatorului.

## Modificări

- După cele patru parfumuri sunt accesibile filmul și galeria audio; traseul se oprește după galerie.
- Galeria primește cele 13 înregistrări originale în ordinea suprafețelor 3D și folosește fișierele existente din `audio/podcasts/`.
- Sunetul se activează explicit prin redare sau controlul Sunet. Clickurile pe controalele HTML nu selectează fotografii din fundal.
- Punctele de navigare sunt butoane etichetate pentru acces direct la parfumuri, film și galerie.
- Titlurile și scurtăturile podcast Cartier nu sunt asociate scenelor parfumurilor Xellé.
- Datele Xellé, flacoanele, fotografiile de pe pereți, modelele GLB și copia originală Cartier sunt păstrate.

## Verificări efectuate

- Generarea datelor și a bundle-ului reușită; sintaxa JavaScript validă.
- Verificatorul static a trecut: 7 scene, 13 prezentări, fișiere audio, fotografii HD/LD, măști, film/previzualizare/variantă verticală, cele 10 GLB active și scenele de bază.
- Cereri HTTP Range pentru filmul lat, cel vertical și două fișiere MP3: răspuns 206 și 1024 octeți.
- Browser Chromium, 1280×800: acces direct la scenele media, filmul local în redare cu sunet (`readyState=4`, `paused=false`, durată 136,96 s, timp peste 5 s); închidere prin Escape.
- Galeria desktop: fotografii afișate, selectarea Santos de Cartier, progres audio în creștere, textul prezentării afișat; Sunet comută fără a închide prezentarea.
- Browser la 393×852: scena video și butonul de redare afișate; `movieVertical.mp4` în redare cu sunet, timp peste 9 s; închidere și revenire la galerie.
- Sesiune nouă, fără film sau Sunet activate înainte: selectarea fotografiei Santos-Dumont pornește audio; progresul a avansat de la aproximativ 7% la 18%. Reapăsarea fotografiei oprește prezentarea și readuce navigarea.

Dimensiunea portret a fost testată în browser desktop, fără emularea sistemului de operare al unui telefon. Distribuirea galeriei în două pagini pe telefoane păstrează logica originală; nu a fost verificată pe un telefon fizic. Toate cele 13 fișiere audio sunt validate static, nu ascultate integral.

Avertismentele originale despre Theatre.js și anumite ținte de animație Three.js continuă să apară; nu au blocat interacțiunile verificate.
