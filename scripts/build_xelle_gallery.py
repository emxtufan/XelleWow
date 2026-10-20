"""Prepare the Xellé product gallery from public/xelle/galerie/.

galerie.json lists the products in display order. The 3D gallery has 16
frames on desktop (13 original plus three added by build_xelle_backdrops);
phones page through 7 + 7, so entries beyond 14 are desktop only. Entries
beyond 16 stay in the folder unused. Each entry names a photograph and
an audio file from the same folder. Photographs are converted into the
thumbnail formats the original gallery reads (HD/LD WebP on a 1.65:1 canvas,
plus a rounded square mask); audio files are used directly.
"""
from pathlib import Path
import html
import json

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "public" / "xelle" / "galerie"
THUMBNAILS = ROOT / "public" / "images" / "podcasts" / "thumbnails"
MASKS = ROOT / "public" / "images" / "podcasts" / "masks"
AUDIO_URL = "/xelle/galerie/"
FRAMES = 16
# The widest gallery frames are 1.65:1; portrait frames show the centre of
# the canvas, so a square photograph stays complete on both.
CANVAS = {"HD": (1690, 1024), "LD": (845, 512)}
MASK_SIZE = 780


def load_entries():
    products = json.loads((FOLDER / "galerie.json").read_text("utf-8-sig"))["products"]
    entries = []
    for index, product in enumerate(products[:FRAMES]):
        slug = product["slug"]
        for key in ["image", "audio"]:
            assert (FOLDER / product[key]).is_file(), f"{slug}: lipsește {product[key]} din {FOLDER}"
        paragraphs = product["text"] if isinstance(product["text"], list) else [product["text"]]
        entries.append({
            "type": "podcast", "uri": slug, "slug": slug, "order": f"{index:02}",
            "title": product["title"], "subtitle": product.get("subtitle", ""),
            "content": "<br><br>".join(html.escape(p) for p in paragraphs),
            "image": {"name": slug},
            "mask": {"url": f"{slug}_mask.png", "width": MASK_SIZE, "height": MASK_SIZE},
            "audio": AUDIO_URL + product["audio"],
            "loaded": 1,
        })
    assert len({entry["slug"] for entry in entries}) == len(entries), "slug duplicat în galerie.json"
    return entries, [product["slug"] for product in products[FRAMES:]]


def thumbnail(source, size):
    image = Image.open(source).convert("RGB")
    width, height = size
    fit = min(width / image.width, height / image.height)
    fitted = image.resize((round(image.width * fit), round(image.height * fit)), Image.LANCZOS)
    cover = max(width / image.width, height / image.height)
    background = image.resize((round(image.width * cover), round(image.height * cover)), Image.BILINEAR)
    left, top = (background.width - width) // 2, (background.height - height) // 2
    background = background.crop((left, top, left + width, top + height))
    background = background.filter(ImageFilter.GaussianBlur(width / 24))
    background.paste(fitted, ((width - fitted.width) // 2, (height - fitted.height) // 2))
    return background


def mask():
    size = MASK_SIZE * 4
    shape = Image.new("L", (size, size), 0)
    ImageDraw.Draw(shape).rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 16, fill=255)
    result = Image.new("RGBA", (MASK_SIZE, MASK_SIZE), (255, 255, 255, 0))
    result.putalpha(shape.resize((MASK_SIZE, MASK_SIZE), Image.LANCZOS))
    return result


def stale(output, source):
    return not output.is_file() or output.stat().st_mtime < source.stat().st_mtime


def build():
    entries, hidden = load_entries()
    products = {p["slug"]: p for p in json.loads((FOLDER / "galerie.json").read_text("utf-8-sig"))["products"]}
    for quality in CANVAS:
        (THUMBNAILS / quality).mkdir(parents=True, exist_ok=True)
    MASKS.mkdir(parents=True, exist_ok=True)
    written = []
    for entry in entries:
        slug = entry["slug"]
        source = FOLDER / products[slug]["image"]
        for quality, size in CANVAS.items():
            output = THUMBNAILS / quality / f"{slug}.webp"
            if stale(output, source):
                thumbnail(source, size).save(output, "WEBP", quality=85 if quality == "HD" else 80, method=6)
                written.append(output)
        output = MASKS / entry["mask"]["url"]
        if not output.is_file():
            mask().save(output, "PNG", optimize=True)
            written.append(output)
    return entries, hidden, written


if __name__ == "__main__":
    entries, hidden, written = build()
    print(f"Galerie: {len(entries)} produse afișate, {len(written)} fișiere generate")
    if hidden:
        print(f"Neafișate (galeria are {FRAMES} rame): {', '.join(hidden)}")
