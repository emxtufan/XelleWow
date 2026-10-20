"""Build every Xellé flacon asset, in order.

1. Labels from the real product (scripts/build_xelle_labels.py).
2. Silhouette masks for the scene transitions (below), from the same dimensions.
3. Flacon models in Blender (scripts/blender_build_xelle_bottles.py).
4. public/xelle/models/manifest.json.

Dimensions, label layout and products live in scripts/xelle-products.json.
The models are measured from the studio packshot, not manufacturer CAD.
Blender: set BLENDER to its executable, otherwise the newest install under
"C:/Program Files/Blender Foundation" is used.

Runtime integration: U2t forwards glTF material.opacity to z2t and sets
material.alpha = mesh.userData.xelleOpacity for transparent meshes, with
depthWrite=false (scripts/xelle-bottle-material.js).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "xelle"
MODELS = ASSETS / "models"
MASKS = ASSETS / "masks"
CONFIG = json.loads((ROOT / "scripts" / "xelle-products.json").read_text(encoding="utf-8"))


def make_transition_masks():
    """Single signed-distance channel replicated to RGB for median(r,g,b).

    A2t's shader subtracts .5 from the median, then smoothsteps using fwidth;
    positive values therefore mean inside. The silhouette is the flacon's body,
    collar and cap, so the scene transition reveals exactly the flacon shape.
    """
    b = CONFIG["bottle"]
    size = 256
    axis = (np.arange(size, dtype=float) + .5) / size * 5 - 2.5
    x, y = np.meshgrid(axis, -axis)

    def rounded_box(cx, cy, hx, hy, r):
        qx = np.abs(x - cx) - hx + r
        qy = np.abs(y - cy) - hy + r
        return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

    top = b["foot"] + b["height"]
    collar_top = top + b["collar"]["height"]
    cap_centre = collar_top + b["cap"]["radius"] - b["cap"]["sink"]
    body = rounded_box(0, b["foot"] + b["height"] / 2, b["radius"], b["height"] / 2, b["topEdgeRadius"])
    collar = rounded_box(0, (top + collar_top) / 2, b["collar"]["radius"], (collar_top - top) / 2 + 0.01, 0.01)
    cap = np.hypot(x, y - cap_centre) - b["cap"]["radius"]
    # At rest the engine draws this mask six times larger to cover the whole
    # screen, so the area around the model origin must lie inside the shape:
    # the neck between body and cap (hidden by the cap) closes the shoulders.
    neck = rounded_box(0, (top + cap_centre) / 2, 0.5, (cap_centre - top) / 2, 0.05)
    signed = -np.minimum(np.minimum(np.minimum(body, collar), cap), neck)
    # +/- 8 texels encode the edge range. Runtime fwidth supplies antialiasing.
    channel = np.clip(.5 + signed / (16 * 5 / size), 0, 1)
    rgb = np.repeat(np.rint(channel * 255).astype(np.uint8)[..., None], 3, axis=2)
    MASKS.mkdir(parents=True, exist_ok=True)
    for product in CONFIG["products"]:
        Image.fromarray(rgb).save(MASKS / f"shape-{product['key']}_msdf.png", optimize=True)


def blender_executable():
    if os.environ.get("BLENDER"):
        return os.environ["BLENDER"]
    installs = sorted(Path("C:/Program Files/Blender Foundation").glob("Blender */blender.exe"),
                      key=lambda p: [int(n) for n in p.parent.name.split()[-1].split(".")])
    if not installs:
        sys.exit("Blender not found: set BLENDER to blender.exe")
    return str(installs[-1])


def main():
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_xelle_labels.py")], check=True)
    make_transition_masks()
    subprocess.run([blender_executable(), "-b", "--factory-startup", "-P", str(ROOT / "scripts" / "blender_build_xelle_bottles.py")],
                   check=True, stdout=subprocess.DEVNULL)
    b = CONFIG["bottle"]
    height = b["height"] + b["collar"]["height"] + 2 * b["cap"]["radius"] - b["cap"]["sink"]
    models = []
    for product in CONFIG["products"]:
        for variant in ("desktop", "mobile"):
            path = MODELS / f"{product['key']}_{variant}.glb"
            models.append({"file": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size, "product": product["title"]})
    (MODELS / "manifest.json").write_text(json.dumps({
        "description": "Xellé flacon measured from the studio packshot, built in Blender (scripts/blender_build_xelle_bottles.py)",
        "dimensions": {"width": 2 * b["radius"], "height": round(height, 3), "depth": 2 * b["radius"]},
        "front": "+Z", "vertical": "+Y", "runtimeScale": .4,
        "materialIntegration": "Forward opacity, set alpha from xelleOpacity and disable depthWrite for transparent nodes",
        "models": models}, indent=2, ensure_ascii=False), encoding="utf8")
    print(f"{len(models)} flacon models, masks and labels built")


if __name__ == "__main__":
    main()
