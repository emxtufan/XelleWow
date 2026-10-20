# Discuție: Shopify ca magazin, site-ul 3D ca vitrină

15 septembrie 2026. Discuție de planificare, fără modificări în cod.

## Întrebarea de plecare

Putem folosi Shopify ca backend (vânzarea produselor), iar site-ul 3D Xellé să fie doar site de prezentare? Cum am putea face?

## Răspuns: da, în trei niveluri

Shopify rămâne „magazinul” (produse, stoc, coș, checkout, plăți, livrare, emailuri), site-ul 3D e vitrina. xelle.ro este deja pe Shopify, deci backend-ul există; întrebarea e cât de strâns legăm vitrina de el.

**1. Link-out (ce avem acum, îmbunătățit)**
Butoanele „Cumpără pe xelle.ro” trimit spre Shopify. Un pas mai bine: *cart permalinks* (`xelle.ro/cart/<id_varianta>:1`) duc direct în checkout cu produsul în coș. Zero backend nou, ~o oră. Dezavantaj: clientul iese din experiență ca să cumpere, fără coș cu mai multe produse în site-ul 3D.

**2. Storefront API + coș în site (recomandat)**
Shopify oferă un API public pentru vitrine externe (Storefront API, token public). Din site-ul 3D creăm coșul, adăugăm produse și trimitem clientul pe `checkoutUrl` (plata pe Shopify). Butonul devine „Adaugă în coș”, apare un sertar de coș în stilul site-ului. Prețurile și stocul pot fi citite live. Nu e nevoie de server propriu; site-ul rămâne static. Estimare: câteva zile, inclusiv design-ul coșului. Există și „Buy Button” de la Shopify (widget gata făcut), mai rapid, dar generic vizual.

**3. Headless complet (Hydrogen etc.)**
Refacerea întregului magazin pe API. Overkill pentru 4 linii de produse.

### Ce trebuie pregătit pentru varianta 2
- Shopify admin: canalul „Headless” (sau aplicație custom) → token Storefront API public. ID-urile variantelor se iau din `/products/<handle>.json` (le avem pentru toate 16 produsele).
- Hosting static pentru site-ul 3D (Cloudflare Pages / Netlify / Vercel); GLB-urile de 16 MB și filmul merg, rutarea cu `#/` nu cere configurări.
- Domenii: site-ul 3D pe `experience.xelle.ro` (magazinul rămâne pe xelle.ro) sau invers (3D pe rădăcină, magazin pe `shop.xelle.ro`).
- Paginile legale (termeni, GDPR, ANPC) rămân pe Shopify, doar le linkăm.
- Detaliu tehnic: site-ul 3D e un bundle compilat modificat prin patch-uri (`build_xelle.cjs`); coșul ar fi o componentă injectată, ca navigația scenelor. Fezabil, dar o etapă separată: întâi permalink-urile, apoi coșul.

## Factura și restul fluxului de comandă

Toate trei variantele se comportă identic după click-ul de cumpărare, pentru că plata se face pe checkout-ul Shopify: plată, livrare, TVA, coduri de reducere, email de confirmare, notificări de expediere, comanda în admin, stoc.

Shopify trimite singur *confirmarea comenzii*, nu factura fiscală; dacă azi facturile pleacă automat, e o aplicație de facturare (SmartBill, Oblio, FGO etc.) declanșată de comanda creată în Shopify — merge la fel în orice variantă.

Nu se transferă în site-ul 3D aplicațiile din tema magazinului: pop-up-uri, recenzii pe pagina de produs, upsell în coș, chat. Cele de checkout (plăți, livrare, reduceri) și de comandă (facturare, expediere, emailuri) rămân.

## „Acasă” din Shopify → site-ul 3D, colecțiile rămân pe Shopify

**1. Meniul.** Shopify admin → Online Store → Navigation → Main menu → elementul „Acasă” primește linkul extern `https://experience.xelle.ro`. Colecțiile (`/collections/parfum`, `/collections/gel-de-dus` …) rămân neatinse.

**2. Logo-ul și pagina xelle.ro/.** Temele leagă logo-ul de pagina principală a magazinului. Opțiuni:
- xelle.ro/ rămâne pagină Shopify simplă („Descoperă experiența” + buton), sau
- xelle.ro/ sare automat la experiență: Shopify nu permite redirect pe pagina principală din URL Redirects, deci se face din tema magazinului (`theme.liquid`, doar pe template-ul `index`), atent să nu prindă colecțiile. Logo-ul se schimbă în secțiunea de header a temei.

În checkout, logo-ul și „Înapoi la magazin” duc mereu la Shopify (irelevant, clientul e deja la plată).

**Pasul zero:** `experience.xelle.ro` trebuie să existe — site-ul rulează acum doar local. Publicare pe host static + CNAME `experience` în DNS. Ordinea: publicăm experiența → schimbăm „Acasă” → decidem ce facem cu xelle.ro/.

## Părerea mea: e ok arhitectura „site custom + magazin Shopify”?

Da, e modelul brandurilor de lux: Shopify duce partea comercială, site-ul custom e stratul de brand. Condiții:

1. **Magazinul Shopify trebuie să meargă perfect și singur.** Traficul plătit vine de pe telefon, adesea pe date mobile; experiența încarcă ~30 MB. Reclamele trimit direct pe produs/colecție în Shopify; experiența e „Descoperă universul Xellé”.
2. **Saltul vizual e cel mai mare risc.** Tema Shopify trebuie adusă la nivelul experienței (fonturi, culori, fotografii de campanie). Coșul prin Storefront API reduce ruptura.
3. **Datele să nu se desincronizeze.** Prețurile din site-ul 3D sunt „coapte” în build; schimbare de preț = rebuild, până citim live din Shopify.
4. **Măsoară.** Analytics cross-domain pe ambele site-uri; după 1–2 luni se vede dacă merită coșul integrat.
5. **Mentenanță realistă.** Conținutul (poze, audio, texte) se editează din foldere; funcțiile noi trec prin build-ul cu patch-uri.

Pe scurt: „vitrină + magazin”, nu „magazin în 3D”. Începem cu subdomeniul și linkurile de cumpărare, aducem tema Shopify la nivel, apoi coșul integrat dacă cifrele o cer.

## Merită convertită experiența într-o temă Liquid, să ruleze direct pe Shopify?

Nu.

- Liquid randează pagini separate pe server; experiența e o singură aplicație care rulează continuu în browser (camera călătorește între scene). „Conversia” ar însemna rescrierea interfeței de la zero, cu riscul de a pierde finisajul original, iar rezultatul ar fi tot o aplicație 3D încărcată într-o pagină Shopify.
- Singura cale realistă „pe Shopify” ar fi încorporarea bundle-ului compilat în template-ul paginii principale, cu resursele pe CDN-ul Shopify (1–2 săptămâni). Probleme: scripturile și stilurile injectate de Shopify și de aplicații se pot călca cu ale aplicației; limite de fișiere în temă; pipeline de build mai fragil; paginile de produs, colecțiile și checkout-ul ar rămâne oricum Liquid standard.
- Câștigurile Shopify-native se obțin fără conversie: prețuri/stoc live și coș prin Storefront API; hosting static gratuit; subdomeniul e diferență cosmetică.
- Ar avea sens doar dacă echipa de marketing ar edita scenele din editorul de temă sau dacă paginile de produs ar fi scene 3D cu date live, cu buget de reconstrucție completă.

Verdict: experiența rămâne aplicație de sine stătătoare pe `experience.xelle.ro`; Shopify rămâne Shopify; legătura prin linkuri acum, Storefront API mai târziu.

## Relația finală dorită

```
experience.xelle.ro (site 3D)  ──「Cumpără」/「Colecția」──▶  xelle.ro (Shopify: produse, coș, checkout)
        ▲                                                        │
        └──────────────「Acasă」/ logo ───────────────────────────┘
```

**Dinspre Shopify spre 3D** (setări în Shopify): „Acasă” din meniu → `https://experience.xelle.ro`; logo-ul → aceeași adresă (modificare mică în temă); `xelle.ro/` → redirect spre experiență (câteva linii în `theme.liquid`, doar pe `index`). Colecțiile, produsele, coșul, checkout-ul neatinse.

**Dinspre 3D spre Shopify** (există deja): „Cumpără pe xelle.ro” → pagina de produs; „Colecția pe xelle.ro” → colecție; „Magazinul oficial” în meniu. Opțional, permalink-uri direct în coș/checkout.

Parcursul clientului: xelle.ro → experiența 3D → „Cumpără” → produs Shopify → coș → plată → confirmare și factură de la Shopify → „Acasă” din magazin readuce în experiență.

**Alternativă** pentru „acasă” chiar pe rădăcina domeniului: `xelle.ro` = site 3D, `shop.xelle.ro` = Shopify. Cea mai curată structură, dar schimbă adresele produselor (Instagram, reclame, Google); se rezolvă cu redirecturi 301 pe hostul static (`/products/*`, `/collections/*`, `/cart` → `shop.xelle.ro`). Recomandare: începem cu `experience.xelle.ro`, fără să atingem ce funcționează azi; mutarea pe rădăcină se poate face ulterior, cu redirecturile pregătite.

## Pași următori propuși

1. Publicarea experienței pe un host static + CNAME `experience.xelle.ro`.
2. În Shopify: „Acasă” și logo spre experiență; decizie pentru `xelle.ro/`.
3. Tema Shopify adusă vizual la nivelul experienței.
4. Analytics cross-domain.
5. Ulterior, dacă cifrele o cer: coș integrat prin Storefront API (prețuri/stoc live, checkout direct din experiență).
