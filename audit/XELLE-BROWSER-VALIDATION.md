# Xellé — browser verification

Verified locally in the Codex Chromium browser, 14 September 2026.

- Desktop 1280 × 800: original cinematic room loads with the actual Xellé wordmark in the header and the animated 3D intro. Original watch text is replaced.
- Portrait viewport 393 × 852: intro fits the screen after adapting the 3D lettering scale; product title, volume, price and close control are readable. This is a desktop Chromium viewport test, not a physical phone test.
- All four product pages were opened. Product names, prices, three levels of notes, original campaign photos and official purchase destinations match the catalog.
- Same-tab collection navigation was exercised from Spiced Peach Negroni to Pornstar Martini, then Prosecco di Cherry and Maracuja Mojito. The bottle labels and page copy change together.
- The campaign photo opens in the full-screen gallery; close returns to the product.
- Dragging Maracuja Mojito rotates its bottle. Transparent body, liquid, cap and label remain visible.
- Fixed the original global canvas click handler so it does not intercept product cards and header links.
- Corrected transparent scalar-color materials only for the new bottle meshes. The original scene materials remain unchanged.
- Corrected the bottle stencil's starting scale to cover portrait corners.
- Returning from Maracuja Mojito via the header selects its matching home scene. Further forward scroll keeps the camera at scene 4 (timeline 14.667 / 24.51 seconds), excluding the original film and podcast rooms.
- Browser error log was empty during the interaction checks. The original library warnings are documented in the earlier Cartier validation.

Screenshots: `xelle-desktop-intro.jpg`, `xelle-mobile-product.jpg`, `xelle-mobile-pornstar.jpg`, `xelle-mobile-prosecco.jpg`, `xelle-mobile-maracuja.jpg`, `xelle-mobile-final-scene.jpg`.

No purchases were made. The local experience links out to the official Xellé store; it does not implement a separate checkout. Bottles are reconstructed from photographs, not manufacturer-supplied CAD models.
