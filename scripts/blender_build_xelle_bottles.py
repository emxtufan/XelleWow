"""Xellé flacon, built in Blender from the measured product dimensions.

Run (Blender 4.2+):
  blender -b -P scripts/blender_build_xelle_bottles.py

Reads scripts/xelle-products.json and the label textures written by
scripts/build_xelle_labels.py. For every product it exports
public/xelle/models/<key>_desktop.glb and <key>_mobile.glb, and saves the
editable scene to blender/xelle_bottle.blend.

The engine relies on these node names (scripts/xelle-bottle-material.js and
scripts/xelle-label-print.js); a hand-made replacement model must keep them:
  xelle_bottle_glass        outer glass surface (transparent)
  xelle_glass_inner         inner cavity surface, normals into the cavity (transparent)
  xelle_fragrance_liquid    perfume (transparent)
  xelle_spherical_black_cap the cap, a sphere cut flat where it sits on the glass
  xelle_front_label         label strip; UV (0,0) top-left of the label image
Node extras: xelleBottle, and isTransparent + xelleOpacity on transparent parts.
Front of the flacon is +Z in glTF (-Y in Blender), the foot sits at y = -2.1.
The photographed flacon has no metal collar: the gold ring under the cap is
the perfume seen through the glass (bottle.collar only places the cap).
"""
import json
import math
import struct
import sys
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "scripts" / "xelle-products.json").read_text(encoding="utf-8"))
B, LABEL = CONFIG["bottle"], CONFIG["label"]
MODELS = ROOT / "public" / "xelle" / "models"
LABELS = ROOT / "public" / "xelle" / "labels"
SOURCE = ROOT / "blender"

FOOT = B["foot"]
TOP = FOOT + B["height"]
R = B["radius"]
INNER_R = R - B["wall"]
CAVITY_BOTTOM = FOOT + B["base"]
CAVITY_TOP = TOP - B["topThickness"]
LIQUID_TOP = CAVITY_TOP - B["liquidGap"]
COLLAR_TOP = TOP + B["collar"]["height"]
CAP_CENTER = COLLAR_TOP + B["cap"]["radius"] - B["cap"]["sink"]

LIQUID_TINT_POWER = 1.0

# Materials as the engine reads them (pbr values are written into the GLB after export).
MATERIALS = {
    "XELLE_clear_glass": {"color": [0.94, 0.97, 1.0], "alpha": 0.14, "roughness": 0.04, "metallic": 0.0},
    "XELLE_glass_inner": {"color": [0.94, 0.97, 1.0], "alpha": 0.08, "roughness": 0.04, "metallic": 0.0},
    "XELLE_perfume": {"color": None, "alpha": 0.9, "roughness": 0.08, "metallic": 0.0},
    "XELLE_polished_black_cap": {"color": [0.004, 0.004, 0.005], "alpha": 1.0, "roughness": 0.12, "metallic": 0.04},
    "XELLE_printed_ivory_label": {"color": [1.0, 1.0, 1.0], "alpha": 1.0, "roughness": 0.72, "metallic": 0.0},
}
NODES = {
    "xelle_glass_inner": "XELLE_glass_inner",
    "xelle_fragrance_liquid": "XELLE_perfume",
    "xelle_bottle_glass": "XELLE_clear_glass",
    "xelle_spherical_black_cap": "XELLE_polished_black_cap",
    "xelle_front_label": "XELLE_printed_ivory_label",
}


def blender_point(x, y, z):
    """glTF (Y up, front +Z) to Blender (Z up, front -Y); the exporter converts back."""
    return (x, -z, y)


def fillet(points, radii, steps=10):
    """Polyline through `points` (r, y) with each corner rounded by its radius."""
    out = [points[0]]
    for i in range(1, len(points) - 1):
        (ax, ay), (px, py), (cx, cy) = points[i - 1], points[i], points[i + 1]
        radius = radii[i]
        if radius <= 0:
            out.append(points[i])
            continue
        u1 = (ax - px, ay - py); u2 = (cx - px, cy - py)
        l1, l2 = math.hypot(*u1), math.hypot(*u2)
        u1 = (u1[0] / l1, u1[1] / l1); u2 = (u2[0] / l2, u2[1] / l2)
        angle = math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        d = min(radius / math.tan(angle / 2), 0.49 * l1, 0.49 * l2)
        radius = d * math.tan(angle / 2)
        t1 = (px + u1[0] * d, py + u1[1] * d); t2 = (px + u2[0] * d, py + u2[1] * d)
        bis = (u1[0] + u2[0], u1[1] + u2[1]); bl = math.hypot(*bis)
        centre = (px + bis[0] / bl * radius / math.sin(angle / 2), py + bis[1] / bl * radius / math.sin(angle / 2))
        a1 = math.atan2(t1[1] - centre[1], t1[0] - centre[0]); a2 = math.atan2(t2[1] - centre[1], t2[0] - centre[0])
        while a2 - a1 > math.pi: a2 -= 2 * math.pi
        while a1 - a2 > math.pi: a2 += 2 * math.pi
        for s in range(steps + 1):
            a = a1 + (a2 - a1) * s / steps
            out.append((centre[0] + radius * math.cos(a), centre[1] + radius * math.sin(a)))
    out.append(points[-1])
    return out


def lathe(name, profile, segments, flip=False):
    """Surface of revolution of a (radius, height) profile, poles closed by fans.
    UV: u around the axis, v by height (glTF v = 0 at the top)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    y0 = min(p[1] for p in profile); y1 = max(p[1] for p in profile)
    rings = []
    for r, y in profile:
        if r < 1e-6:
            rings.append([bm.verts.new(blender_point(0, y, 0))])
        else:
            rings.append([bm.verts.new(blender_point(r * math.sin(2 * math.pi * j / segments), y, r * math.cos(2 * math.pi * j / segments)))
                          for j in range(segments)])
    uv_layers = [bm.loops.layers.uv.new("UVMap"), bm.loops.layers.uv.new("UVMap.001")]
    def uv_of(ring_index, j):
        r, y = profile[ring_index]
        return (j / segments, (y - y0) / ((y1 - y0) or 1))
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(segments):
            jn = (j + 1) % segments
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                verts, uvs = [a[0], b[jn], b[j]], [uv_of(i, j + .5), uv_of(i + 1, j + 1), uv_of(i + 1, j)]
            elif len(b) == 1:
                verts, uvs = [a[j], a[jn], b[0]], [uv_of(i, j), uv_of(i, j + 1), uv_of(i + 1, j + .5)]
            else:
                verts, uvs = [a[j], a[jn], b[jn], b[j]], [uv_of(i, j), uv_of(i, j + 1), uv_of(i + 1, j + 1), uv_of(i + 1, j)]
            try:
                face = bm.faces.new(verts)
            except ValueError:
                continue
            for loop, uv in zip(face.loops, uvs):
                for layer in uv_layers:
                    loop[layer].uv = uv
    # Closed shells: normals outward, or into the cavity for the inner wall.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if flip:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return finish_object(name, mesh)


def finish_object(name, mesh):
    for poly in mesh.polygons:
        poly.use_smooth = True
    if hasattr(mesh, "set_sharp_from_angle"):
        mesh.set_sharp_from_angle(angle=math.radians(50))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["xelleBottle"] = True
    return obj


def outer_glass(segments):
    profile = fillet([(0, FOOT), (R, FOOT), (R, TOP), (0, TOP)],
                     [0, B["bottomEdgeRadius"], B["topEdgeRadius"], 0], steps=8)
    return lathe("xelle_bottle_glass", profile, segments)


def inner_glass(segments):
    # Cavity walls seen from inside: normals point into the cavity.
    profile = fillet([(0, CAVITY_BOTTOM), (INNER_R, CAVITY_BOTTOM), (INNER_R, CAVITY_TOP), (0, CAVITY_TOP)],
                     [0, 0.07, 0.07, 0], steps=6)
    return lathe("xelle_glass_inner", profile, segments, flip=True)


def liquid(segments):
    r = INNER_R - 0.004
    profile = fillet([(0, CAVITY_BOTTOM + 0.004), (r, CAVITY_BOTTOM + 0.004), (r, LIQUID_TOP), (0, LIQUID_TOP)],
                     [0, 0.066, 0.025, 0], steps=6)
    return lathe("xelle_fragrance_liquid", profile, segments)


def cap(segments, rings=None):
    """Sphere cut flat where it sits on the glass top."""
    rings = rings or segments // 2
    radius = B["cap"]["radius"]
    start = math.acos(min(1.0, (CAP_CENTER - TOP) / radius))
    sphere = [(radius * math.sin(a), CAP_CENTER - radius * math.cos(a))
              for a in (start + (math.pi - start) * k / rings for k in range(rings))]
    profile = [(0, TOP + 0.002), (sphere[0][0], sphere[0][1] + 0.002)] + sphere[1:] + [(0, CAP_CENTER + radius)]
    return lathe("xelle_spherical_black_cap", profile, segments)


def label(segments, image_path):
    mesh = bpy.data.meshes.new("xelle_front_label")
    bm = bmesh.new()
    cols = segments
    rows = [LABEL["top"], LABEL["bottom"]]
    verts = []
    for y in rows:
        verts.append([bm.verts.new(blender_point(LABEL["radius"] * math.sin(-LABEL["angle"] + 2 * LABEL["angle"] * j / cols), y,
                                                 LABEL["radius"] * math.cos(-LABEL["angle"] + 2 * LABEL["angle"] * j / cols)))
                      for j in range(cols + 1)])
    layers = [bm.loops.layers.uv.new("UVMap"), bm.loops.layers.uv.new("UVMap.001")]
    for j in range(cols):
        quad = [verts[1][j], verts[1][j + 1], verts[0][j + 1], verts[0][j]]
        # Blender UV origin is bottom-left; the exporter flips V so the image top is glTF v = 0.
        uvs = [(j / cols, 0), ((j + 1) / cols, 0), ((j + 1) / cols, 1), (j / cols, 1)]
        face = bm.faces.new(quad)
        for loop, uv in zip(face.loops, uvs):
            for layer in layers:
                loop[layer].uv = uv
    bm.normal_update()
    # The print faces outward, away from the axis.
    bm.faces.ensure_lookup_table()
    face = bm.faces[0]
    centre = face.calc_center_median()
    if face.normal.x * centre.x + face.normal.y * centre.y < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = finish_object("xelle_front_label", mesh)
    material = bpy.data.materials["XELLE_printed_ivory_label"]
    if bpy.app.version < (5, 0, 0):
        material.use_nodes = True
    nodes = material.node_tree.nodes
    tex = nodes.get("Label") or nodes.new("ShaderNodeTexImage")
    tex.name = "Label"
    tex.image = bpy.data.images.load(str(image_path), check_existing=False)
    material.node_tree.links.new(tex.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    return obj


def make_materials():
    for name in MATERIALS:
        if name not in bpy.data.materials:
            material = bpy.data.materials.new(name)
            if bpy.app.version < (5, 0, 0):
                material.use_nodes = True


def build(product, variant):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make_materials()
    segments = B["segments"][variant]
    root = bpy.data.objects.new(product["key"], None)
    bpy.context.scene.collection.objects.link(root)
    root["xelleProduct"] = product["title"]
    root["reconstruction"] = "Measured from the Xellé studio packshot; no manufacturer CAD"
    parts = [inner_glass(segments), liquid(segments), outer_glass(segments),
             cap(min(segments, 80)), label(segments // 2, LABELS / "paper.png")]
    for obj in parts:
        material = bpy.data.materials[NODES[obj.name]]
        obj.data.materials.append(material)
        obj.parent = root
        spec = MATERIALS[NODES[obj.name]]
        if spec["alpha"] < 1:
            obj["isTransparent"] = True
            obj["xelleOpacity"] = spec["alpha"]
    path = MODELS / f"{product['key']}_{variant}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_tangents=True,
                              export_materials="EXPORT", export_extras=True, export_cameras=False, export_lights=False,
                              # Draco, as the original watch models; fine quantisation keeps
                              # the glass reflections free of banding.
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=14, export_draco_normal_quantization=12,
                              export_draco_texcoord_quantization=12, export_draco_generic_quantization=12)
    patch_glb(path, product)
    if variant == "desktop" and product["key"] == CONFIG["products"][0]["key"]:
        SOURCE.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "xelle_bottle.blend"))
    return path


def patch_glb(path, product):
    """Write the engine's material values into the exported GLB."""
    data = path.read_bytes()
    json_len = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    rest = data[20 + json_len:]
    for material in doc.get("materials", []):
        spec = MATERIALS.get(material["name"])
        if not spec:
            continue
        # The engine's liquid shader raises its tint for the light crossing the
        # flacon, then adds lit surface and highlights that wash it out; this
        # power keeps the measured colour (liquidTransmit) as golden on screen
        # as in the photographs.
        color = [c ** (1 / LIQUID_TINT_POWER) for c in product["liquidTransmit"]] if spec["color"] is None else spec["color"]
        pbr = material.setdefault("pbrMetallicRoughness", {})
        pbr["baseColorFactor"] = [*color, spec["alpha"]]
        pbr["metallicFactor"] = spec["metallic"]
        pbr["roughnessFactor"] = spec["roughness"]
        pbr.pop("metallicRoughnessTexture", None)
        material.pop("emissiveFactor", None)
        material.pop("extensions", None)
        if spec["alpha"] < 1:
            material["alphaMode"] = "BLEND"
        else:
            material.pop("alphaMode", None)
        material["doubleSided"] = False
    for sampler in doc.get("samplers", []):
        sampler.update({"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071})
    doc["asset"]["generator"] = "Xellé flacon, scripts/blender_build_xelle_bottles.py"
    for key in ("extensionsUsed", "extensionsRequired"):
        used = [e for e in doc.get(key, []) if not e.startswith("KHR_materials")]
        if used:
            doc[key] = used
        else:
            doc.pop(key, None)
    encoded = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode()
    encoded += b" " * ((-len(encoded)) % 4)
    total = 12 + 8 + len(encoded) + len(rest)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + rest)


def main():
    MODELS.mkdir(parents=True, exist_ok=True)
    for product in CONFIG["products"]:
        for variant in ("desktop", "mobile"):
            print("built", build(product, variant))


if __name__ == "__main__":
    main()
