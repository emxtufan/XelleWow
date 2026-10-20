# Xellé — eliminarea mobilierului de atelier

14 septembrie 2026. Actualizează rezultatul din `XELLE-CHARACTERS-VALIDATION.md`: scenele parfumurilor nu mai păstrează mesele, scaunele sau obiectele de lucru.

Implementare:

- Mesh-urile din modelul separat de personaje/mobilier sunt ascunse în scenele 1–4, înainte de relocarea grupurilor în scena principală. Sunt incluse mesele fără metadate de tip, lămpile, uneltele, scaunele, accesoriile și reflexiile.
- Cele 12 perechi de decaluri pentru umbrele acestor grupuri sunt ascunse separat. Umbrele și mobilierul scenei 5 sunt păstrate.
- Marcajul `xelleHidden` este respectat la fiecare cadru și la calcularea reflexiilor, astfel încât obiectele nu reapar la navigare.
- Flacoanele, fotografiile, arhitectura și galeria nu sunt modificate. Modelele originale GLB rămân intacte.

Verificări:

- Build reușit, 59 patch-uri verificate; sintaxa JavaScript și auditul static trec.
- Ambele variante desktop/mobil: 108 mesh-uri ascunse din modelul de personaje/mobilier, repartizate 27/16/29/36 în scenele 1–4; toate cele 16 mesh-uri din film sunt păstrate.
- Ambele variante de decor: 24 mesh-uri de umbre ascunse și 4 mesh-uri de umbre păstrate la film.
- Browser 1280×800: inspectate vizual toate cele patru scene, fără mese, scaune, obiecte sau umbrele lor. Filmul păstrează personajele și mobilierul.
- Consola a afișat mesajul original de inițializare Theatre.js și un `AbortError` video de tip play/pause în timpul încărcării; filmul era ulterior vizibil în redare. Nu au fost observate erori de randare a scenelor.

Modelele mobile au fost verificate static, fără test pe un telefon fizic.
