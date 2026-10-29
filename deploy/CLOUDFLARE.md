# Xellé pe Cloudflare: trafic mare fără blocaje

Ce trebuie setat în Cloudflare (și pe server) ca site-ul să meargă la fel de repede
când intră deodată 500 de oameni.

## De ce e nevoie

Un vizitator nou descarcă aproximativ:

| Dispozitiv | Date la prima vizită |
|---|---|
| Telefon | ~15,6 MB |
| Desktop | ~34 MB |

500 de vizitatori simultani înseamnă **~10 GB** în același minut. Dacă toate fișierele
pleacă din VPS (legătură de 300 Mbps – 1 Gbps), fiecare vizitator primește doar
~1–2 Mbps și încărcarea durează minute. Serverul nu cade, dar e foarte lent.

Soluția: **Cloudflare păstrează fișierele în cache**. VPS-ul trimite fiecare fișier o
singură dată către Cloudflare, iar vizitatorii îl primesc de la Cloudflare, de aproape
de ei. Pe planul gratuit traficul nu se plătește.

Implicit Cloudflare **nu** face asta pentru site-ul nostru:

- serverul trimite `Cache-Control: no-cache` (ca browserele să vadă imediat orice deploy);
- Cloudflare nu păstrează implicit fișierele `.glb`, `.exr`, `.json`, `.wasm`, adică exact
  cele mari (scenele 3D, hărțile de reflexie, decodorul Draco).

## 1. Verificări de bază

Cloudflare → site-ul **xelle.ro**:

1. **DNS → Records**: înregistrările `xelle.ro` și `www` (tip A către IP-ul VPS-ului)
   au norul **portocaliu** (Proxied). Cu norul gri, Cloudflare nu ajută deloc.
2. **SSL/TLS → Overview**: modul **Full (strict)**. Pe server există certificatul
   Cloudflare Origin (`/etc/ssl/xelle/origin.pem`, vezi `deploy/nginx-xelle.conf`).
3. **Speed → Optimization**:
   - **Rocket Loader: OFF**. Strică scriptul principal al site-ului.
   - Brotli și HTTP/3 pot rămâne pornite (sunt implicit).

## 2. Regula de cache (cea mai importantă)

**Caching → Cache Rules → Create rule**

- **Rule name:** `Xelle fisiere statice`
- **If incoming requests match… → Custom filter expression → Edit expression**, lipește:

```
(http.host in {"xelle.ro" "www.xelle.ro"} and (
  starts_with(http.request.uri.path, "/assets/") or
  starts_with(http.request.uri.path, "/webgl/") or
  starts_with(http.request.uri.path, "/xelle/") or
  starts_with(http.request.uri.path, "/images/") or
  starts_with(http.request.uri.path, "/audio/") or
  starts_with(http.request.uri.path, "/benchmarks/")
))
```

- **Then…**
  - **Cache eligibility:** `Eligible for cache`
  - **Edge TTL:** `Ignore cache-control header and use this TTL` → **1 day**
  - **Browser TTL:** `Respect origin TTL`. Browserele întreabă la fiecare vizită dacă
    fișierul s-a schimbat; răspunsul (304, câțiva bytes) vine direct de la Cloudflare.
- **Deploy**

Ce **nu** intră în regulă, intenționat:

- `/` și `index.html`: au 4 KB și trebuie să fie mereu cele noi după un deploy;
- `/__deploy`: webhook-ul GitHub, nu se pune niciodată în cache.

## 3. Tiered Cache

**Caching → Tiered Cache → Smart Tiered Caching Topology: ON**

Centrele Cloudflare își iau fișierele unele de la altele, nu fiecare direct de la VPS.
La un val de vizitatori din mai multe orașe, VPS-ul trimite și mai puțin.

## 4. Golirea cache-ului după fiecare deploy

Cu regula de mai sus, Cloudflare ține fișierele până la o zi. După un deploy cu
fișiere schimbate (scene, imagini, CSS, catalog), cache-ul trebuie golit, altfel unii
vizitatori văd varianta veche până la 24 de ore.

> `xelle-app.js` și `xelle.css` au în adresă un cod de versiune (`?v=…`) care se
> schimbă la fiecare build, deci apar imediat oricum. Scenele, imaginile și catalogul
> nu au, de aceea golirea e necesară.

### Manual

**Caching → Configuration → Purge Everything → Purge Everything**.
Fă asta și după ce urci filmul din nou cu `scp`.

### Automat, din `deploy/deploy.sh`

`deploy/deploy.sh` golește cache-ul singur după fiecare deploy, dacă pe server există
fișierul `/etc/xelle/cloudflare-purge-token`. Fără fișier, deploy-ul merge ca până acum
și scrie doar „Cloudflare cache not purged”.

1. **Token doar pentru golire:** Cloudflare → **My Profile → API Tokens → Create Token →
   Create Custom Token**
   - Permissions: `Zone` · `Cache Purge` · `Purge`
   - Zone Resources: `Include` · `Specific zone` · `xelle.ro`
   - Create → copiază tokenul (se afișează o singură dată).
2. **Pe server**, o singură dată:

```sh
sudo mkdir -p /etc/xelle
sudo nano /etc/xelle/cloudflare-purge-token   # lipești tokenul, salvezi (Ctrl+O, Enter, Ctrl+X)
sudo chown "$(stat -c %U /var/www/xelle)" /etc/xelle/cloudflare-purge-token
sudo chmod 600 /etc/xelle/cloudflare-purge-token
```

   Fișierul trebuie să poată fi citit de utilizatorul care rulează pm2 (cel care deține
   `/var/www/xelle`). Tokenul nu intră niciodată în git.
3. **Test:** `bash /var/www/xelle/deploy/deploy.sh` trebuie să scrie la final
   `Cloudflare cache purged`.

Zone ID-ul lui xelle.ro e deja în script; altă zonă se dă prin variabila `CF_ZONE_ID`.

## 5. Verificare

După ce regula e activă, de pe orice calculator:

```sh
curl -sI https://xelle.ro/xelle/backdrops/mainSceneMobile.glb | grep -i cf-cache-status
```

- prima dată: `cf-cache-status: MISS` (Cloudflare l-a luat acum de la VPS);
- a doua oară: `cf-cache-status: HIT` (vine din Cloudflare; așa trebuie).

La fel pentru `/assets/xelle-app.js`, `/webgl/textures/cubemaps/mobile/SC00_oct.exr` și
`/xelle/video_xelle.mp4`. Dacă apare `DYNAMIC` sau `BYPASS`, regula nu se potrivește
(verifică hostul și căile din expresie).

Pagina principală `/` trebuie să rămână `DYNAMIC`.

## 6. Ce nu trebuie făcut

- **Under Attack Mode** doar la un atac real: afișează o pagină de verificare de câteva
  secunde fiecărui vizitator.
- **Cache Everything** pe tot site-ul (inclusiv `/`): după un deploy, vizitatorii ar primi
  `index.html` vechi, care cere fișiere vechi.
- Nu pune tokenul Cloudflare, `DEPLOY_SECRET` sau vreun token Shopify privat în git.

## 7. Restul

- **Shopify:** nu e nevoie de nimic. Storefront API e făcut pentru trafic de magazin, se
  apelează abia după ce s-au încărcat scenele, iar checkout-ul rulează pe Shopify.
- **VPS:** cu cache-ul activ, la 500 de vizitatori serverul trimite aproape doar
  `index.html` și răspunsurile de la `/__deploy`. Node, nginx și pm2 rămân cum sunt.
- **Filmul** (9,5 MB) e servit tot prin regula de cache (`/xelle/`). Cloudflare limitează
  pe planul gratuit site-urile care servesc în principal video; un film de prezentare
  într-un site 3D nu e cazul. Dacă vor fi multe filme mari, varianta potrivită e
  Cloudflare Stream.
