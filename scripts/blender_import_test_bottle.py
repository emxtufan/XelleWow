"""Test flacon: a downloaded bottle model converted to the Xellé engine format.

Run (Blender 4.2+):
  blender -b --factory-startup -P scripts/blender_import_test_bottle.py -- <model.glb>

Made for Sketchfab "Perfume Bottle" by Michaela Blanchfield (CC-BY-4.0: credit
the author wherever it is shown publicly). The model keeps its geometry and its
own label; it is scaled to the Xellé flacon's height with its foot at
y = -2.1, and its parts get the engine's node names and the materials of
blender_build_xelle_bottles.py (each product's liquid colour). Writes
public/xelle/models/test/<key>_<variant>.glb, shown with ?flacon=test.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_build_xelle_bottles as base

SOURCE = Path(sys.argv[sys.argv.index("--") + 1])
OUTPUT = base.MODELS / "test"
HEIGHT = base.CAP_CENTER + base.B["cap"]["radius"] - base.FOOT

base.MATERIALS.update({
    "XELLE_test_silver_cap": {"color": [0.92, 0.92, 0.94], "alpha": 1.0, "roughness": 0.12, "metallic": 1.0},
    "XELLE_test_dip_tube": {"color": [0.95, 0.96, 0.97], "alpha": 0.35, "roughness": 0.1, "metallic": 0.0},
})
# Source material -> engine node name and material. The label's own picture is
# kept; xelle_front_label_test stays out of the sharp print overlay, which
# knows only the Xellé flacon's label surface.
PARTS = {
    "Color_A01": ("xelle_bottle_glass", "XELLE_clear_glass"),
    "Color_A05_1": ("xelle_fragrance_liquid", "XELLE_perfume"),
    "Color_E04": ("xelle_spherical_black_cap", "XELLE_test_silver_cap"),
    "Color_D07": ("xelle_dip_tube", "XELLE_test_dip_tube"),
    "Color_A05": ("xelle_front_label_test", "XELLE_printed_ivory_label"),
}


def bounds(objects):
    points = [v.co for obj in objects for v in obj.data.vertices]
    return (Vector([min(p[i] for p in points) for i in range(3)]),
            Vector([max(p[i] for p in points) for i in range(3)]))


def base_color_image(material):
    socket = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"]
    while socket.links:
        node = socket.links[0].from_node
        if node.type == "TEX_IMAGE":
            return node.image
        socket = next(s for s in node.inputs if s.links)
    raise ValueError(f"{material.name} has no base colour image")


def clean(obj, name):
    """Engine name, plain smooth normals, two UV sets (TEXCOORD_0/1)."""
    obj.name = obj.data.name = name
    if obj.data.has_custom_normals:
        with bpy.context.temp_override(object=obj, active_object=obj, selected_editable_objects=[obj]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if hasattr(obj.data, "set_sharp_from_angle"):
        obj.data.set_sharp_from_angle(angle=math.radians(50))
    layers = obj.data.uv_layers
    while len(layers) > 1:
        layers.remove(layers[len(layers) - 1])
    layers[0].name = "UVMap"
    layers.new(name="UVMap.001")


def build(product, variant):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    base.make_materials()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    parts = []
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj)
            continue
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        parts.append((obj, *PARTS[obj.data.materials[0].name]))

    low, high = bounds([p[0] for p in parts])
    scale = HEIGHT / (high.z - low.z)
    place = (Matrix.Translation((0, 0, base.FOOT)) @ Matrix.Scale(scale, 4)
             @ Matrix.Translation((-(low.x + high.x) / 2, -(low.y + high.y) / 2, -low.z)))
    named = {}
    for obj, name, material in parts:
        obj.data.transform(place)
        source = obj.data.materials[0]
        if name == "xelle_front_label_test":
            image = base_color_image(source)
            label = bpy.data.materials[material]
            nodes = label.node_tree.nodes
            tex = nodes.new("ShaderNodeTexImage")
            tex.image = image
            label.node_tree.links.new(tex.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
        clean(obj, name)
        obj.data.materials.clear()
        obj.data.materials.append(bpy.data.materials[material])
        named[name] = obj

    # The label must face the front (-Y here, +Z in glTF): it is drawn single-sided.
    label = named["xelle_front_label_test"]
    if sum((p.normal for p in label.data.polygons), Vector()).y > 0:
        bm = bmesh.new()
        bm.from_mesh(label.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(label.data)
        bm.free()
    # Its UVs sit outside 0..1 (the source repeats the texture); the engine clamps.
    for layer in label.data.uv_layers:
        shift = [math.floor(min(d.uv[i] for d in layer.data)) for i in range(2)]
        for d in layer.data:
            d.uv = (d.uv[0] - shift[0], d.uv[1] - shift[1])
    # The liquid shader reads height from v (meniscus at the top).
    liquid = named["xelle_fragrance_liquid"]
    liquid_low, liquid_high = bounds([liquid])
    for layer in liquid.data.uv_layers:
        for loop in liquid.data.loops:
            co = liquid.data.vertices[loop.vertex_index].co
            layer.data[loop.index].uv = (math.atan2(co.x, -co.y) / (2 * math.pi) + 0.5,
                                         (co.z - liquid_low.z) / (liquid_high.z - liquid_low.z))

    root = bpy.data.objects.new(product["key"], None)
    bpy.context.scene.collection.objects.link(root)
    root["xelleProduct"] = product["title"]
    root["source"] = "Sketchfab 'Perfume Bottle' by Michaela Blanchfield, CC-BY-4.0"
    for obj in named.values():
        obj.parent = root
        obj["xelleBottle"] = True
        spec = base.MATERIALS[obj.data.materials[0].name]
        if spec["alpha"] < 1:
            obj["isTransparent"] = True
            obj["xelleOpacity"] = spec["alpha"]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / f"{product['key']}_{variant}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_tangents=True,
                              export_materials="EXPORT", export_extras=True, export_cameras=False, export_lights=False,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=14, export_draco_normal_quantization=12,
                              export_draco_texcoord_quantization=12, export_draco_generic_quantization=12)
    base.patch_glb(path, product)
    print("built", path, "scale", round(scale, 2), {n: len(o.data.polygons) for n, o in named.items()})


for product in base.CONFIG["products"]:
    for variant in ("desktop", "mobile"):
        build(product, variant)
