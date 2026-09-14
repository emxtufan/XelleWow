"""Build self-contained Xelle concept GLBs for the original Cartier scene wrappers.

Uses the photographed Xelle bottle proportions and original emblem. Geometry is a
photo-informed reconstruction, not a manufacturer-supplied CAD asset. Existing
Cartier models remain untouched. Run with the bundled Python runtime (Pillow).

Runtime integration: U2t must forward glTF material.opacity to z2t and set
material.alpha = mesh.userData.xelleOpacity for transparent meshes. Set their
depthWrite=false. The original custom shader does not implement transmission.
"""
from __future__ import annotations

import io
import json
import math
from pathlib import Path
import struct
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "xelle"
MODELS = ASSETS / "models"
LABELS = ASSETS / "labels"
MASKS = ASSETS / "masks"

PRODUCTS = {
    "roadster": ("Spiced Peach Negroni", (0.86, 0.56, 0.22)),
    "baignoire": ("Pornstar Martini", (0.92, 0.81, 0.49)),
    "crash": ("Prosecco di Cherry", (0.82, 0.58, 0.36)),
    "santos": ("Maracuja Mojito", (0.87, 0.79, 0.45)),
}


def font(name: str, size: int):
    candidates = [Path("C:/Windows/Fonts") / name,
                  Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


def center(draw, text, y, ft, fill):
    width = draw.textlength(text, font=ft)
    draw.text(((1024 - width) / 2, y), text, font=ft, fill=fill)


def make_label(key, title):
    # Native label composition uses the downloaded original emblem unchanged.
    paper = (239, 237, 221)
    image = Image.new("RGB", (1024, 1040), paper)
    draw = ImageDraw.Draw(image)
    draw.rectangle((55, 55, 969, 985), outline=(37, 34, 28), width=3)
    emblem = Image.open(ASSETS / "xelle-emblem.png").convert("RGBA")
    emblem.thumbnail((392, 392), Image.Resampling.LANCZOS)
    # The supplied logo's white channels represent unprinted paper. Preserve all
    # dark emblem detail while mapping its backing to the same label stock.
    import PIL.ImageOps
    mask = (emblem.getchannel("A") if emblem.getchannel("A").getextrema()[0] < 255
            else PIL.ImageOps.invert(emblem.convert("L")))
    ink = Image.new("RGB", emblem.size, (8, 8, 7))
    image.paste(ink, ((1024-emblem.width)//2, 184), mask)
    draw = ImageDraw.Draw(image)
    center(draw, "X E L L É", 594, font("georgia.ttf", 62), (147, 119, 67))
    size = 48
    ft = font("arial.ttf", size)
    while draw.textlength(title, font=ft) > 824:
        size -= 1
        ft = font("arial.ttf", size)
    center(draw, title, 730, ft, (20, 20, 17))
    center(draw, "Extrait de Parfum", 821, font("arial.ttf", 35), (35, 34, 28))
    center(draw, "50 ml", 909, font("arial.ttf", 24), (70, 65, 55))
    image.save(LABELS / f"{key}.png", optimize=True)
    output = io.BytesIO()
    image.save(output, "PNG", optimize=True)
    return output.getvalue()


def make_transition_masks():
    """Single signed-distance channel replicated to RGB for median(r,g,b).

    A2t's shader subtracts .5 from the median, then smoothsteps using fwidth;
    positive values therefore mean inside. This matches the original shader
    without changing stencil or transition timing.
    """
    import numpy as np
    size = 256
    axis = (np.arange(size, dtype=float) + .5) / size * 5 - 2.5
    x, y = np.meshgrid(axis, -axis)

    def rounded_box(cx,cy,hx,hy,r):
        qx = np.abs(x-cx)-hx+r
        qy = np.abs(y-cy)-hy+r
        return np.hypot(np.maximum(qx,0),np.maximum(qy,0)) + np.minimum(np.maximum(qx,qy),0) - r

    body = rounded_box(0,-.8075,1.175,1.2925,.085)
    neck = rounded_box(0,.55,.26,.16,.015)
    cap = np.hypot(x,y-1.29)-.73
    signed = -np.minimum(np.minimum(body,neck),cap)
    # +/- 8 texels encode the edge range. Runtime fwidth supplies antialiasing.
    channel = np.clip(.5 + signed/(16*5/size),0,1)
    rgb = np.repeat(np.rint(channel*255).astype(np.uint8)[...,None],3,axis=2)
    for key in PRODUCTS:
        Image.fromarray(rgb).save(MASKS/f"shape-{key}_msdf.png",optimize=True)


class GLB:
    def __init__(self, key, title):
        self.binary = bytearray()
        self.doc = {
            "asset": {"version": "2.0", "generator": "Xelle photo-informed bottle reconstruction",
                      "copyright": "Xelle branding and product names belong to their respective owner"},
            "scene": 0,
            "scenes": [{"name": "Xelle_" + key, "nodes": [0]}],
            "nodes": [{"name": key, "children": [], "extras": {
                "xelleProduct": title, "reconstruction": "Photo-informed concept; no manufacturer CAD"}}],
            "meshes": [], "materials": [], "accessors": [], "bufferViews": [],
            "images": [], "textures": [],
            "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        }

    def view(self, data, target=None):
        while len(self.binary) % 4:
            self.binary.append(0)
        result = {"buffer": 0, "byteOffset": len(self.binary), "byteLength": len(data)}
        if target:
            result["target"] = target
        self.binary.extend(data)
        index = len(self.doc["bufferViews"])
        self.doc["bufferViews"].append(result)
        return index

    def accessor(self, values, size, indices=False):
        flattened = [v for item in values for v in item] if size > 1 else list(values)
        fmt = "I" if indices else "f"
        data = struct.pack("<" + fmt * len(flattened), *flattened)
        item = {"bufferView": self.view(data, 34963 if indices else 34962),
                "componentType": 5125 if indices else 5126, "count": len(values),
                "type": "SCALAR" if size == 1 else f"VEC{size}"}
        if not indices:
            item["min"] = [min(v[i] for v in values) for i in range(size)]
            item["max"] = [max(v[i] for v in values) for i in range(size)]
        index = len(self.doc["accessors"])
        self.doc["accessors"].append(item)
        return index

    def texture(self, data):
        index = len(self.doc["images"])
        self.doc["images"].append({"bufferView": self.view(data), "mimeType": "image/png"})
        self.doc["textures"].append({"sampler": 0, "source": index})
        return len(self.doc["textures"]) - 1

    def material(self, name, color, roughness=0.15, metalness=0, alpha=1, texture=None):
        pbr = {"baseColorFactor": [*color, alpha], "metallicFactor": metalness,
               "roughnessFactor": roughness}
        if texture is not None:
            pbr["baseColorTexture"] = {"index": texture}
        result = {"name": name, "pbrMetallicRoughness": pbr}
        if alpha < 1:
            result["alphaMode"] = "BLEND"
        self.doc["materials"].append(result)
        return len(self.doc["materials"]) - 1

    def mesh(self, name, positions, normals, tangents, uv, indices, material, alpha=1):
        attrs = {"POSITION": self.accessor(positions, 3), "NORMAL": self.accessor(normals, 3),
                 "TANGENT": self.accessor(tangents, 4), "TEXCOORD_0": self.accessor(uv, 2),
                 "TEXCOORD_1": self.accessor(uv, 2)}
        self.doc["meshes"].append({"name": name, "primitives": [{"attributes": attrs,
            "indices": self.accessor(indices, 1, True), "material": material, "mode": 4}]})
        node = {"name": name, "mesh": len(self.doc["meshes"])-1,
                "extras": {"xelleBottle": True}}
        if alpha < 1:
            node["extras"].update({"isTransparent": True, "xelleOpacity": alpha})
        self.doc["nodes"].append(node)
        self.doc["nodes"][0]["children"].append(len(self.doc["nodes"])-1)

    def finish(self, path):
        while len(self.binary) % 4:
            self.binary.append(0)
        self.doc["buffers"] = [{"byteLength": len(self.binary)}]
        encoded = json.dumps(self.doc, separators=(",", ":"), ensure_ascii=False).encode()
        encoded += b" " * ((-len(encoded)) % 4)
        total = 12 + 8 + len(encoded) + 8 + len(self.binary)
        path.write_bytes(struct.pack("<III", 0x46546C67, 2, total)
                         + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
                         + struct.pack("<II", len(self.binary), 0x004E4942) + self.binary)
        return {"file": str(path.relative_to(ROOT)), "bytes": total,
                "vertices": sum(a["count"] for a in self.doc["accessors"] if a["type"] == "VEC3")//2,
                "meshes": len(self.doc["meshes"])}


def lathe(glb, name, profile, material, segments=80, alpha=1):
    """Surface of revolution; profile is bottom-to-top (radius,y)."""
    positions, normals, tangents, uv, indices = [], [], [], [], []
    y0, y1 = min(p[1] for p in profile), max(p[1] for p in profile)
    for ring, (radius, y) in enumerate(profile):
        before, after = profile[max(0, ring-1)], profile[min(len(profile)-1, ring+1)]
        dr, dy = after[0]-before[0], after[1]-before[1]
        length = math.hypot(dr, dy) or 1
        for j in range(segments+1):
            angle = j / segments * math.tau
            sx, cz = math.sin(angle), math.cos(angle)
            positions.append((radius*sx, y, radius*cz))
            normals.append((dy/length*sx, -dr/length, dy/length*cz))
            tangents.append((cz, 0, -sx, 1))
            uv.append((j/segments, 1-(y-y0)/(y1-y0 or 1)))
    for ring in range(len(profile)-1):
        for j in range(segments):
            a = ring*(segments+1)+j
            b, c, d = a+1, a+segments+1, a+segments+2
            indices.extend((a,b,c,b,d,c))
    glb.mesh(name, positions, normals, tangents, uv, indices, material, alpha)


def cylinder(glb, name, radius, y0, y1, material, segments, alpha=1):
    bevel = min(.045, (y1-y0)*.2)
    profile = [(0,y0), (radius-.035,y0), (radius,y0+bevel), (radius,y1-bevel),
               (radius-.035,y1), (0,y1)]
    lathe(glb, name, profile, material, segments, alpha)


def label_surface(glb, material, segments):
    positions, normals, tangents, uv, indices = [], [], [], [], []
    for row, y in enumerate([-1.83, .15]):
        for j in range(segments+1):
            theta = -.86 + j/segments*1.72
            sx, cz = math.sin(theta), math.cos(theta)
            positions.append((1.181*sx, y, 1.181*cz))
            normals.append((sx,0,cz))
            tangents.append((cz,0,-sx,1))
            uv.append((j/segments, 1-row))
    for j in range(segments):
        a,b,c,d = j,j+1,j+segments+1,j+segments+2
        indices.extend((a,b,c,b,d,c))
    glb.mesh("xelle_front_label", positions,normals,tangents,uv,indices,material)


def build(key, title, liquid_color, mobile, label):
    segments = 48 if mobile else 96
    glb = GLB(key, title)
    glass = glb.material("XELLE_clear_glass", (.80,.89,.88), .075, .08, .22)
    baseglass = glb.material("XELLE_thick_glass_base", (.70,.82,.79), .1, .08, .42)
    liquid = glb.material("XELLE_perfume", liquid_color, .14, .02, .67)
    black = glb.material("XELLE_polished_black_cap", (.005,.005,.007), .075, .20)
    gold = glb.material("XELLE_gold_atomizer", (.75,.53,.19), .18, .87)
    stem = glb.material("XELLE_dip_tube", (.9,.9,.79), .3, 0, .45)
    paper = glb.material("XELLE_printed_ivory_label", (1,1,1), .86, 0, texture=glb.texture(label))

    # Thin glass outer shell with a gently rounded shoulder and thick foot.
    body = [(0,-2.1),(.98,-2.1),(1.095,-2.08),(1.16,-2.02),(1.175,-1.94),
            (1.175,.30),(1.17,.38),(1.145,.435),(1.08,.47),(.33,.485),(.29,.54),(0,.54)]
    lathe(glb,"xelle_bottle_glass",body,glass,segments,.22)
    cylinder(glb,"xelle_glass_foot",1.10,-2.075,-1.895,baseglass,segments,.42)
    cylinder(glb,"xelle_fragrance_liquid",1.073,-1.88,.205,liquid,segments,.67)
    cylinder(glb,"xelle_atomizer_neck",.255,.46,.66,gold,segments)
    cylinder(glb,"xelle_atomizer_internal",.15,.25,.49,gold,segments)
    cylinder(glb,"xelle_internal_dip_tube",.017,-1.85,.3,stem,24,.45)
    cap = []
    # Cap is glossy black and spherical, as in the original product photos.
    radius, cy = .73, 1.29
    rings = 36 if mobile else 56
    for j in range(rings+1):
        a = -math.pi/2 + j/rings*math.pi
        cap.append((max(0,radius*math.cos(a)),cy+radius*math.sin(a)))
    lathe(glb,"xelle_spherical_black_cap",cap,black,segments)
    label_surface(glb,paper,32 if mobile else 64)
    return glb.finish(MODELS/f"{key}_{'mobile' if mobile else 'desktop'}.glb")


def main():
    MODELS.mkdir(parents=True,exist_ok=True)
    LABELS.mkdir(parents=True,exist_ok=True)
    MASKS.mkdir(parents=True,exist_ok=True)
    make_transition_masks()
    results=[]
    for key,(title,color) in PRODUCTS.items():
        label = make_label(key,title)
        for mobile in (False,True):
            result=build(key,title,color,mobile,label)
            results.append(result)
            print(json.dumps(result))
    (MODELS/"manifest.json").write_text(json.dumps({
        "description":"Photo-informed Xelle bottle reconstruction preserving original scene wrappers",
        "dimensions":{"width":2.35,"height":4.12,"depth":2.35},
        "front":"+Z", "vertical":"+Y", "runtimeScale":.4,
        "materialIntegration":"Forward opacity, set alpha from xelleOpacity and disable depthWrite for transparent nodes",
        "models":results},indent=2),encoding="utf8")


if __name__ == "__main__":
    main()
