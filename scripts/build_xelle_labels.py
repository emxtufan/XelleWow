"""Xellé labels, rebuilt from the real product.

The printed label is reconstructed from the studio packshot
(public/xelle/maracuja-mojito-packshot.png): its emblem is unwrapped from the
bottle's curve and separated into its black field and gold foil; layout
and colours are the measured ones in scripts/xelle-products.json. The XELLÉ
wordmark is the brand file public/xelle/intro/xelle-wordmark.png. Titles use
Montserrat, the closest installed match to the printed typeface; the official
print file should replace this reconstruction when available.

Writes, per product key:
  public/xelle/labels/<key>.png         3D label texture (desktop size)
  public/xelle/labels/<key>_mobile.png  3D label texture (mobile size)
  public/xelle/labels/<key>_print.png   ink only on transparent paper, for the
                                        sharp on-screen print (xelle-label-print.js)
and public/xelle/labels/emblem.png (the cleaned emblem, RGBA).
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "scripts" / "xelle-products.json").read_text(encoding="utf-8"))
ASSETS = ROOT / "public" / "xelle"
LABELS = ASSETS / "labels"
FONTS = Path("C:/Windows/Fonts")

# Packshot geometry, measured on the 4096 px image: bottle axis x, outer radius
# in pixels, and the camera's elevation (sine) that bends horizontal lines.
PACKSHOT = {"file": ASSETS / "maracuja-mojito-packshot.png", "cx": 2041.0, "radius": 886.0, "elevation": 0.29,
            "rows": (1700, 3250), "emblem": (560, 400, 1130, 920)}


def unwrap(image):
    """Flatten the label from the cylinder: x -> arc length, rows corrected for elevation."""
    src = np.asarray(image.convert("RGB")).astype(np.float32)
    cx, r, se = PACKSHOT["cx"], PACKSHOT["radius"], PACKSHOT["elevation"]
    half = r * 0.95
    width = int(2 * half)
    y0, y1 = PACKSHOT["rows"]
    arc = np.arange(width) - half
    xs = np.clip(cx + r * np.sin(arc / r), 0, src.shape[1] - 2)
    lift = r * se * (np.cos(arc / r) - 1)
    out = np.zeros((y1 - y0, width, 3), np.float32)
    x0 = np.floor(xs).astype(int)
    fx = (xs - x0)[:, None]
    for j, row in enumerate(range(y0, y1)):
        ys = np.clip(row + lift, 0, src.shape[0] - 2)
        yy = np.floor(ys).astype(int)
        fy = (ys - yy)[:, None]
        out[j] = (src[yy, x0] * (1 - fx) * (1 - fy) + src[yy, x0 + 1] * fx * (1 - fy)
                  + src[yy + 1, x0] * (1 - fx) * fy + src[yy + 1, x0 + 1] * fx * fy)
    return out


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def close_along(mask, axis, reach):
    """Morphological closing along one axis (dilate then erode by `reach` px)."""
    def shifted(m, op):
        out = m.copy()
        for d in range(1, reach + 1):
            for sign in (1, -1):
                out = op(out, np.roll(m, sign * d, axis))
        return out
    return shifted(shifted(mask, np.maximum), np.minimum)


def extract_emblem(size):
    """Black field and gold lines of the emblem as two crisp masks of `size` px."""
    flat = unwrap(Image.open(PACKSHOT["file"]))
    left, top, right, bottom = PACKSHOT["emblem"]
    crop = flat[top:bottom, left:right]
    # Rows were foreshortened by the camera elevation; restore true proportions.
    scale = 1 / math.cos(math.asin(PACKSHOT["elevation"]))
    crop_img = Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8))
    crop_img = crop_img.resize((crop_img.width, round(crop_img.height * scale)), Image.Resampling.LANCZOS)
    rgb = np.asarray(crop_img).astype(np.float32)
    lum = rgb.mean(2)
    chroma = rgb[:, :, 0] - rgb[:, :, 2]
    # Gold foil reads as warm chroma; its bright highlight runs down the middle
    # of each line, so a small closing fills the line without bridging the
    # wider paper bands between the black fields.
    # Paper is warm too (chroma up to ~25 where the liquid shows through it);
    # foil sits well above that.
    gold = smoothstep(34, 58, chroma) * smoothstep(70, 110, lum)
    gold_img = Image.fromarray((gold * 255).astype(np.uint8))
    gold_img = gold_img.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    gold = np.maximum(gold, np.asarray(gold_img).astype(np.float32) / 255)
    # Wider highlights on the straight hook lines: close along each axis only,
    # which cannot bridge the diagonal paper bands.
    gold = np.maximum(gold, np.maximum(close_along(gold, 0, 6), close_along(gold, 1, 6)))
    black = smoothstep(150, 85, lum) * (1 - gold)
    # Square around the dark field, centred on its bounding box.
    ys, xs = np.where(black > 0.5)
    cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
    half = int(max(xs.max() - xs.min(), ys.max() - ys.min()) / 2) + 14

    def square(mask):
        pad = np.pad(mask, half + 4)
        y, x = int(round(cy)) + half + 4, int(round(cx)) + half + 4
        return pad[y - half:y + half, x - half:x + half]

    black, gold = square(black), square(gold)

    def crisp(mask):
        big = Image.fromarray(np.clip(mask * 255, 0, 255).astype(np.uint8)).resize((size, size), Image.Resampling.LANCZOS)
        m = np.asarray(big).astype(np.float32) / 255
        # Re-threshold after the upscale: sharp but antialiased edges.
        edge = 0.5 / max(1.0, size / mask.shape[0])
        return smoothstep(0.5 - 0.12 - edge, 0.5 + 0.12 + edge, m)

    return crisp(black), crisp(gold)


def tinted(mask, color):
    layer = np.zeros(mask.shape + (4,), np.uint8)
    layer[..., :3] = color
    layer[..., 3] = np.clip(mask * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(layer, "RGBA")


def text_layer(width, height, text, font, color, cap_top, size):
    """Centred text of the given font size, its capitals starting at cap_top."""
    face = ImageFont.truetype(str(FONTS / font), round(size))
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    top = face.getbbox("H")[1]
    x = (width - face.getlength(text)) / 2
    draw.text((x, cap_top * height - top), text, font=face, fill=tuple(color) + (255,))
    return layer


def size_for_width(font, text, target):
    """Font size at which `text` is `target` pixels wide."""
    probe = ImageFont.truetype(str(FONTS / font), 200)
    return 200 * target / probe.getlength(text)


def compose(title, width, height, emblem_masks, wordmark, ink_only):
    layout, colors = CONFIG["label"]["layout"], CONFIG["label"]["colors"]
    canvas = Image.new("RGBA", (width, height), tuple(colors["paper"]) + (0 if ink_only else 255,))
    if ink_only:
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    border = layout["border"]
    line = max(1, round(border["line"] * width))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((round(border["insetX"] * width), round(border["insetTop"] * height),
                    round(width - border["insetX"] * width), round(height - border["insetBottom"] * height)),
                   outline=tuple(colors["ink"]) + (255,), width=line)
    # Emblem: black field, then gold lines over it.
    black, gold = emblem_masks
    size = round(layout["emblem"]["width"] * width)
    pos = (round((width - size) / 2), round(layout["emblem"]["centerY"] * height - size / 2))
    for mask, color in ((black, colors["ink"]), (gold, colors["gold"])):
        layer = tinted(np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((size, size), Image.Resampling.LANCZOS)) / 255, color)
        canvas.alpha_composite(layer, pos)
    # Wordmark in gold.
    mark_w = round(layout["wordmark"]["width"] * width)
    mark_h = round(wordmark.height * mark_w / wordmark.width)
    alpha = wordmark.getchannel("A").resize((mark_w, mark_h), Image.Resampling.LANCZOS)
    mark = Image.new("RGBA", (mark_w, mark_h), tuple(colors["gold"]) + (255,))
    mark.putalpha(alpha)
    canvas.alpha_composite(mark, (round((width - mark_w) / 2), round(layout["wordmark"]["centerY"] * height - mark_h / 2)))
    fonts = CONFIG["label"]["fonts"]
    t = layout["title"]
    # One type size for every title, calibrated on the photographed label;
    # only a title wider than maxWidth is set smaller.
    size = size_for_width(fonts["title"], t["calibration"]["text"], t["calibration"]["width"] * width)
    size = min(size, size_for_width(fonts["title"], title, t["maxWidth"] * width))
    canvas.alpha_composite(text_layer(width, height, title, fonts["title"], colors["ink"], t["capTop"], size))
    s = layout["subtitle"]
    size = size_for_width(fonts["subtitle"], s["text"], s["width"] * width)
    canvas.alpha_composite(text_layer(width, height, s["text"], fonts["subtitle"], colors["ink"], s["capTop"], size))
    return canvas


def main():
    LABELS.mkdir(parents=True, exist_ok=True)
    black, gold = extract_emblem(1024)
    emblem = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    emblem.alpha_composite(tinted(black, CONFIG["label"]["colors"]["ink"]))
    emblem.alpha_composite(tinted(gold, CONFIG["label"]["colors"]["gold"]))
    emblem.save(LABELS / "emblem.png", optimize=True)
    wordmark = Image.open(ASSETS / "intro" / "xelle-wordmark.png").convert("RGBA")
    sizes = CONFIG["label"]["pixels"]
    for product in CONFIG["products"]:
        key, title = product["key"], product["title"]
        for name, (w, h) in (("", sizes["desktop"]), ("_mobile", sizes["mobile"])):
            compose(title, w, h, (black, gold), wordmark, False).convert("RGB").save(LABELS / f"{key}{name}.png", optimize=True)
        compose(title, *sizes["desktop"], (black, gold), wordmark, True).save(LABELS / f"{key}_print.png", optimize=True)
        print(f"{key}: {title}")


if __name__ == "__main__":
    main()
