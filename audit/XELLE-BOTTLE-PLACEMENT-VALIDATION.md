# Xellé — flacoane coborâte și umbră discretă

14 septembrie 2026.

Actualizare la cererea utilizatorului: `XELLE_BOTTLE_DROP` este acum **0,90**, față de 0,35 la prima verificare de mai jos. Flaconul 3D și umbra sunt coborâte împreună cu încă 0,55 unități locale (aproximativ 80 px pe desktop). Verificare vizuală nouă: Spiced Peach Negroni la 1280×800 și Prosecco di Cherry la 393×852; flaconul este vizibil mai jos, cu spațiu până la butonul de descoperire. Build-ul, sintaxa JavaScript și auditul static trec. Parametrul se aplică tuturor celor patru scene prin componenta comună.

Verificarea inițială, înaintea acestei coborâri suplimentare:

- În cele patru scene principale, flacoanele sunt coborâte cu 0,35 unități locale față de poziția anterioară (aproximativ 50 px la dimensiunea desktop testată).
- O elipsă procedurală moale urmărește baza flaconului, calculată din limita inferioară a modelelor: -2,1 × 0,4 = -0,84. Nu este necesară o textură nouă.
- Umbra folosește aceeași cameră și același pasaj de randare ca flaconul. Se orientează spre cameră și rămâne discretă la înclinarea flaconului; este o umbră stilizată, nu calculul fizic al unei surse de lumină.
- Coborârea și opacitatea umbrei se retrag în timpul trecerii spre prezentarea produsului. Umbra este limitată la scenele parfumurilor și nu apare la film sau în galerie.
- Geometria și materialul umbrei sunt eliberate la distrugerea componentei. Orientarea evită descompunerea matricelor cu scară zero din introducere.

Verificări:

- Build reușit: 62 patch-uri verificate; sintaxa JavaScript validă.
- Auditul static trece, inclusiv concordanța bazei umbrei cu toate cele opt modele desktop/mobil și includerea helperului în bundle.
- Browser 1280×800: inspectate vizual cele patru parfumuri, cu poziția coborâtă și umbra moale la bază.
- Maracuja Mojito: pagina produsului se deschide corect, flaconul revine la prezentarea originală fără umbra din scenă; revenirea la colecție funcționează.
- Browser 393×852: Prosecco di Cherry este încadrat corect, cu umbră vizibilă și controlul de descoperire accesibil.
- Verificarea în format portret folosește un browser desktop redimensionat, nu un telefon fizic.

Fișierele GLB, fotografia de fundal, conținutul și videoclipul rămân neschimbate. Reglajele sunt în `scripts/xelle-bottle-placement.js`.
