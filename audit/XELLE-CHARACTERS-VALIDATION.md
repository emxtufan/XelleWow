# Xellé — personaje numai la film

14 septembrie 2026.

Personajele din scenele parfumurilor sunt ascunse individual după construirea obiectelor 3D. Sunt ascunse și accesoriile separate (ochelari/lentilă) și reflexiile personajelor. Mesele, scaunele, uneltele și decorul rămân. Cele cinci persoane din scena filmului, reflexiile și animațiile lor sunt păstrate.

Filtrul folosește metadatele `type=character`, numele accesoriului `lens_character` și apartenența la scena 5. Obiectele ascunse sunt excluse din lista folosită de reflexiile podelei; verificarea de vizibilitate la fiecare cadru împiedică reapariția lor la navigare. Interacțiunile și animațiile personajelor sunt limitate la film. Fișierele GLB originale, ierarhiile și scheletele nu sunt modificate.

Verificări efectuate:

- Build reușit: 59 patch-uri verificate; sintaxa JavaScript și auditul static trec.
- Analiză independentă a ierarhiilor ambelor modele (desktop/mobil): 48 mesh-uri de personaje/accesorii ascunse în scenele 1–4 (12, 6, 14, 16); 10 mesh-uri păstrate la film (cinci persoane și reflexiile lor).
- Browser, 1280×800: toate cele patru scene de parfumuri afișează mesele și decorul fără personaje. Scena 4 nu păstrează accesorii plutitoare. Filmul și personajele sale sunt vizibile după traversarea scenelor.
- Nicio eroare nouă în consola sesiunii verificate; mesajul original Theatre.js despre inițializare rămâne.

Modelele pentru mobil sunt verificate static. Verificarea în browser nu reprezintă un test pe telefon fizic.
