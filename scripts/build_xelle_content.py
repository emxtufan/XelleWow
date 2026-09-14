"""Build Romanian Xellé copy in the original application's locale schemas.

Reads the preserved original schema and the verified public storefront catalog.
Writes data only; the application bundle is updated by the parent build script.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


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

    global_content = {
        "market": "România",
        "title": "Xellé — Extrait de parfum",
        "loader": "Descoperă patru parfumuri unisex inspirate de universul cocktailurilor.",
        "baseline": "Patru cocktailuri. Patru parfumuri.",
        "buttons": {"allPicturesButton": {"label": "Fotografie"}},
        "ctas": {
            "scroll": "Derulează",
            "soundBttn": "Sunet",
            "soundOn": "Activează sunetul",
            "explore": "Descoperă parfumul",
            "close": "Închide",
        },
    }

    home = copy.deepcopy(original["pages"][0])
    home.update({"market": "România", "title": "Xellé — Extrait de parfum"})
    home["ctas"] = {"explore": "Descoperă parfumul"}
    home["scenes"] = [{"type": "intro", "title": "Xellé\nExtrait de parfum"}]
    for _, handle, title in SCENES:
        home["scenes"].append({
            "type": "scene", "exploreUrl": f"/{handle}", "title": title,
        })

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
        for key, label in [("Vârf", "Note de vârf"), ("Mijloc", "Note de inimă"), ("Bază", "Note de bază")]:
            blocks.append({
                "type": "textBlock", "text": label, "textSize": "m",
                "subtitle": " · ".join(product["notes"][key]),
            })
        blocks.append({
            "type": "textBlock",
            "text": product["priceFormatted"],
            "textSize": "m",
            "subtitle": f"{product['name']} · Extrait de parfum · {product['volumeMl']} ml",
            "button": [{"url": product["url"], "label": "Cumpără pe xelle.ro"}],
        })
        blocks.append({
            "type": "sliderProductsBlock",
            "title": "Colecția Xellé",
            "cards": [{
                "title": f"{products[other]['name']} · {products[other]['priceFormatted']}",
                "url": f"/{other}",
                "media": {
                    "ariaLabel": f"Xellé {products[other]['name']}, extrait de parfum, 50 ml",
                    "url": products[other]["images"][0]["localPath"],
                },
            } for _, other, _ in SCENES],
            "cta": {"url": catalog["collectionUrl"], "label": "Colecția pe xelle.ro"},
        })
        blocks.append({
            "type": "pushPageBlock",
            "title": "Continuă descoperirea",
            "button": {"url": "/", "label": "Înapoi la colecție"},
        })
        page["content"] = {"blocks": blocks}
        pages.append(page)

    # pO is the original legacy root-data factory. Ga reads its podcast list;
    # an empty list means no obsolete podcast content reaches the application.
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
        "pages": [copy.deepcopy(home), *copy.deepcopy(pages)],
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
        for notes in product["notes"].values():
            assert " · ".join(notes) in [block.get("subtitle") for block in blocks]
        for block in blocks:
            for media in block.get("medias", []):
                assert (ROOT / "public" / media["url"].lstrip("/")).is_file()
    serialized = json.dumps(locales, ensure_ascii=False, indent=2)
    assert not any(word in serialized.lower() for word in ["cartier", "podcast", "newsletter", "watchmovie", "watchmaking", "roadster", "baignoire"])
    OUTPUT.write_text(serialized + "\n", encoding="utf-8")
    return locales


if __name__ == "__main__":
    result = build()
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    for variable, handle, _ in SCENES:
        print(f"{variable}: /{handle}, scene {result[variable]['watchSceneIndex']}")
