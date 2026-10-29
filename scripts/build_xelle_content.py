"""Build Romanian Xellé copy in the original application's locale schemas.

Reads the preserved original schema and the verified public storefront catalog.
The audio gallery comes from public/xelle/galerie/ through build_xelle_gallery,
which also refreshes its thumbnails. The application bundle is updated by the
parent build script.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import build_xelle_gallery


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "audit" / "en_fr-data.json"
CATALOG = ROOT / "audit" / "xelle-catalog.json"
OUTPUT = ROOT / "audit" / "xelle-locales.json"

# Preserve scene numbering: each product inherits the matching original camera.
SCENES = [
    ("NG", "spiced-peach-negroni", "Spiced Peach\nNegroni"),
    ("DG", "pornstar-martini-50-ml", "Pornstar\nMartini"),
    ("OG", "prosecco-di-cherry-50-ml", "Prosecco\ndi Cherry"),
    ("zG", "maracuja-mojito-50-ml", "Maracuja\nMojito"),
]

DESCRIPTIONS = {
    "spiced-peach-negroni": [
        "Piersică, citrice și accente licoroase. Ghimbirul și scorțișoara întâlnesc irisul, iasomia și trandafirul în inima acestui parfum unisex fructat-lemnos.",
        "Baza reunește patchouli, rășină de benzoin, vanilie, ambră și mosc. O compoziție inspirată de cocktailul Spiced Peach Negroni.",
    ],
    "pornstar-martini-50-ml": [
        "Litchi, șampanie și fructe de pădure deschid compoziția. Trandafirul, florile albe și acordul pudrat formează inima acestui parfum unisex fructat-floral.",
        "Mosc, lemn de santal, ambră și vanilie alcătuiesc baza caldă. O interpretare olfactivă inspirată de cocktailul Pornstar Martini.",
    ],
    "prosecco-di-cherry-50-ml": [
        "Cireșe și șampanie cu cireșe, urmate de iasomie, tuberoză și flori albe. Un parfum unisex fructat-ambrat, inspirat de un cocktail cu prosecco și cireșe.",
        "Baza de mosc, vanilie, ambră și patchouli completează acordurile fructate și florale ale compoziției.",
    ],
    "maracuja-mojito-50-ml": [
        "Bergamota și fructul pasiunii deschid acest parfum unisex fructat-ambrat. În inimă se întâlnesc iasomia, lăcrămioarele și irisul.",
        "Lemnul de santal, ambra, moscul și vanilia formează baza. O compoziție inspirată de un cocktail tropical cu fructul pasiunii.",
    ],
}


def build() -> dict:
    original = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8-sig"))
    products = {product["handle"]: product for product in catalog["products"]}
    # The gallery's 3D surfaces use podcast array indices, including the
    # second page of the mobile gallery, so galerie.json order is kept as is.
    podcasts, hidden_gallery, _ = build_xelle_gallery.build()

    global_content = {
        "market": "România",
        "title": "Xellé — Extrait de parfum",
        "loader": "Descoperă colecția Xellé.",
        "baseline": "Patru cocktailuri. Patru parfumuri.",
        "buttons": {"allPicturesButton": {"label": "Fotografie"}},
        "ctas": {
            "scroll": "Derulează",
            "soundBttn": "Sunet",
            "soundOn": "Activează sunetul",
            "explore": "Descoperă parfumul",
            "watchMovie": "Redă filmul Xellé",
            "listen": "Ascultă prezentările produselor",
            "podcastText": "Textul prezentării",
            "close": "Închide",
        },
    }

    home = copy.deepcopy(original["pages"][0])
    home.update({"market": "România", "title": "Xellé — Extrait de parfum"})
    home["ctas"] = {
        "explore": "Descoperă parfumul",
        "podcastText": "Textul prezentării",
        "close": "Închide",
    }
    home["scenes"] = [{"type": "intro", "title": "Xellé\nExtrait de parfum"}]
    for _, handle, title in SCENES:
        home["scenes"].append({
            "type": "scene", "exploreUrl": f"/{handle}", "title": title,
        })
    home["scenes"].extend([
        {"type": "movie", "title": "Filmul\nXellé"},
        {
            "type": "scene", "title": "Galeria\nXellé",
            "podcastTitle": "Galerie audio Xellé",
        },
    ])

    pages = []
    for index, (_, handle, _) in enumerate(SCENES, start=1):
        product = products[handle]
        photo = product["images"][0]
        page = {
            "market": "România",
            "title": product["name"],
            "uri": handle,
            "slug": handle,
            "type": "product",
            "loaded": 1,
            "watchSceneIndex": index,
        }
        blocks = [
            {
                "type": "heroBlock",
                "title": f"Extrait de parfum · {product['volumeMl']} ml · {product['priceFormatted']}",
                "subtitle": product["name"],
            },
            {
                "type": "scrollMediasBlock",
                "text": product["summary"],
                "medias": [{
                    "url": photo["localPath"],
                    "ariaLabel": f"Xellé {product['name']} — {photo['description']}",
                    "subtitle": "Extrait de parfum · 50 ml",
                }],
            },
            {"type": "scrollWatchBlock", "texts": DESCRIPTIONS[handle]},
        ]
        blocks.append({
            "type": "xelleNotesBlock",
            "groups": [{"title": label, "notes": list(product["notes"][key])}
                       for key, label in [("Vârf", "Note de vârf"), ("Mijloc", "Note de inimă"), ("Bază", "Note de bază")]],
        })
        blocks.append({
            "type": "textBlock",
            "text": product["priceFormatted"],
            "textSize": "m",
            "subtitle": f"{product['name']} · Extrait de parfum · {product['volumeMl']} ml",
            "button": [{"url": product["url"], "label": "Cumpără"}],
        })
        blocks.append({
            "type": "sliderProductsBlock",
            "cards": [{
                "title": f"{products[other]['name']} · {products[other]['priceFormatted']}",
                "url": f"/{other}",
                "media": {
                    "ariaLabel": f"Xellé {products[other]['name']}, extrait de parfum, 50 ml",
                    "url": products[other]["images"][0]["localPath"],
                },
            } for _, other, _ in SCENES],
            "cta": {"url": catalog["collectionUrl"], "label": "Vezi colecția"},
        })
        blocks.append({
            "type": "pushPageBlock",
            "title": "Continuă descoperirea",
            "button": {"url": "/", "label": "Înapoi la colecție"},
        })
        page["content"] = {"blocks": blocks}
        pages.append(page)

    # Ga reads podcasts from pO.pages, not IG. The gallery entries populate
    # only the audio gallery; the four perfume scenes keep their own pages.
    root_data = {
        "market": "România",
        "global": {
            "header": {"audio": "Sunet"},
            "menu": {"sections": [
                {"title": "Colecția Xellé", "items": [
                    {"title": products[handle]["name"], "url": f"/{handle}"}
                    for _, handle, _ in SCENES
                ]},
                {"title": "Xellé", "items": [
                    {"title": "Magazinul oficial", "url": catalog["collectionUrl"]},
                ]},
            ]},
        },
        "pages": [copy.deepcopy(home), *copy.deepcopy(pages), *podcasts],
    }
    locales = {"IG": global_content, "pO": root_data, "RG": home}
    locales.update({entry[0]: page for entry, page in zip(SCENES, pages)})

    # Meaningful invariants: source product links, complete note lists, one
    # campaign image per editorial gallery, and route/camera correspondence.
    for index, (variable, handle, _) in enumerate(SCENES, start=1):
        product = products[handle]
        page = locales[variable]
        assert page["watchSceneIndex"] == index and page["uri"] == handle
        blocks = page["content"]["blocks"]
        assert len(next(block for block in blocks if block["type"] == "scrollMediasBlock")["medias"]) == 1
        assert any(button["url"] == product["url"] for block in blocks for button in block.get("button", []) if isinstance(button, dict))
        notes_block = next(block for block in blocks if block["type"] == "xelleNotesBlock")
        assert [group["notes"] for group in notes_block["groups"]] == list(product["notes"].values())
        for block in blocks:
            for media in block.get("medias", []):
                assert (ROOT / "public" / media["url"].lstrip("/")).is_file()
    assert len(home["scenes"]) == 7 and home["scenes"][5]["type"] == "movie"
    assert all("podcastTitle" not in scene for scene in home["scenes"][1:5])
    assert 0 < len(podcasts) <= build_xelle_gallery.FRAMES
    assert all(podcast["type"] == "podcast" for podcast in podcasts)
    for podcast in podcasts:
        assert (ROOT / "public" / podcast["audio"].lstrip("/")).is_file(), podcast["audio"]
        for quality in ["HD", "LD"]:
            assert (ROOT / "public" / "images" / "podcasts" / "thumbnails" / quality / f"{podcast['image']['name']}.webp").is_file()
        assert (ROOT / "public" / "images" / "podcasts" / "masks" / podcast["mask"]["url"]).is_file()
    gallery_copy = json.dumps(podcasts, ensure_ascii=False).lower()
    assert not any(word in gallery_copy for word in ["cartier", "santos", "roadster", "baignoire"])
    for movie in ["video_xelle.mp4"]:
        assert (ROOT / "public" / "xelle" / movie).is_file(), movie
    product_copy = json.dumps(pages, ensure_ascii=False).lower()
    assert not any(word in product_copy for word in ["cartier", "podcast", "newsletter", "watchmaking", "roadster", "baignoire"])
    serialized = json.dumps(locales, ensure_ascii=False, indent=2)
    OUTPUT.write_text(serialized + "\n", encoding="utf-8", newline="\n")
    print(f"Galerie: {len(podcasts)} produse afișate")
    if hidden_gallery:
        print(f"Neafișate (galeria are {build_xelle_gallery.FRAMES} rame): {', '.join(hidden_gallery)}")
    return locales


if __name__ == "__main__":
    result = build()
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    for variable, handle, _ in SCENES:
        print(f"{variable}: /{handle}, scene {result[variable]['watchSceneIndex']}")
