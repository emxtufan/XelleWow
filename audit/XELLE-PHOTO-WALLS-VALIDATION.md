# Xellé — fotografii pe pereții scenelor

Verificare locală în Chromium, 14 septembrie 2026.

- Toate cele patru camere au fost deschise în browser, din pagina parfumului prin linkul „Xellé — acasă”. Fotografiile se văd pe geometria 3D și păstrează perspectiva camerei.
- Spiced Peach Negroni: fotografia cu mâinile înlocuiește muntele de pe peretele curbat; oamenii, mesele și volumele metalice rămân în față.
- Pornstar Martini: fotografia cu modelul apare pe ecranul din spate, între volumele de piatră din cameră.
- Prosecco di Cherry: un perete curbat nou afișează fotografia în spatele structurii animate din lemn.
- Maracuja Mojito: fotografia apare pe cele trei panouri din spatele scării. Integrarea cu animația originală a panourilor funcționează.
- Fotografiile sunt încadrate cu proporțiile păstrate și margini deschise, fără decuparea sau modificarea JPEG-urilor sursă.
- `node --check public/assets/xelle-app.js` și `python audit/check_xelle_static.py` au trecut. Verificarea statică compară JPEG-urile încorporate cu sursele și animațiile scenelor cu scenele de bază păstrate.
- Resursele active sunt `public/xelle/backdrops/mainScene.glb` și `mainSceneMobile.glb`. Scenele de bază și cele opt GLB-uri pentru flacoane nu au fost regenerate în această modificare.
- La 393 × 852, cu user-agent mobil emulat, prima scenă afișează fotografia corect în spatele flaconului. Încărcarea `mainSceneMobile.glb` a fost confirmată în resursele browserului. Acesta este un test de emulare Chromium, nu un test pe telefon fizic; celelalte trei camere au fost inspectate vizual pe desktop.

Capturi desktop: `xelle-photo-wall-scene1.png`, `xelle-photo-wall-scene2.png`, `xelle-photo-wall-scene3.png`, `xelle-photo-wall-scene4.png`.

Captură mobil: `xelle-photo-wall-mobile.png`.

Consola păstrează mesajul din aplicația originală despre importul `@theatre/studio` fără inițializarea editorului. În verificarea desktop nu au apărut erori de compilare ale shaderului fotografic.
