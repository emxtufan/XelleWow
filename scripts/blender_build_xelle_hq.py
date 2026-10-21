"""Xellé flacon, high-quality model for physically based viewers.

Run (Blender 4.2+):
  blender -b --factory-startup -P scripts/blender_build_xelle_hq.py [-- --render] [--only=<key>]

Solid glass (outer wall, thick base, rounded top) around a closed cavity, the
perfume filling the cavity, the black spherical cap seated on the glass on
its flat-cut base, and the label as printed paper (print outside, plain paper
behind). Dimensions come from scripts/xelle-products.json, measured on
public/xelle/maracuja-mojito-packshot.png (camera there: 18.4° above the label,
about 24 units away). The photographed bottle shows no metal collar: the gold
ring under the cap is the perfume seen through the top glass.

Materials are real glass and liquid (transmission, IOR, volume absorption),
exported as KHR_materials_transmission / ior / volume for the perfume and as
clear blended glass for the bottle (real-time renderers cannot show one
transmissive surface through another). Writes
blender/hq/<key>.glb for every product and saves the editable
scene, with the packshot camera and a white studio, to blender/xelle_bottle_hq.blend.
--render also renders that camera with Cycles to blender/renders/<key>.png.
"""
import json
import math
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_build_xelle_bottles as base

B, LABEL = base.B, base.LABEL
OUTPUT = base.SOURCE / "hq"
RENDERS = base.SOURCE / "renders"
SEGMENTS = 256
TOP, FOOT, R = base.TOP, base.FOOT, base.R
CAVITY_TOP, CAVITY_BOTTOM, INNER_R = base.CAVITY_TOP, base.CAVITY_BOTTOM, base.INNER_R
CAP_R, CAP_CENTER = B["cap"]["radius"], base.CAP_CENTER
RENDER = "--render" in sys.argv
# Path through the middle of the perfume, where products[].liquidTransmit applies.
LIQUID_PATH = 2 * INNER_R
VOLUMES = {}
# Opacity of the glass in the GLB (the engine models use the same).
GLASS_ALPHA = 0.14
VIEWER_THICKNESS = 0.3
ONLY = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")), None)


def principled(name, **inputs):
    material = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        material.use_nodes = True
    node = material.node_tree.nodes["Principled BSDF"]
    for key, value in inputs.items():
        node.inputs[key].default_value = value
    return material


def gltf_volume(material, thickness, color=None, distance=None):
    """Volume for Cycles (absorption); patch_volume() writes the same into the
    GLB, which the exporter leaves out. Without it a viewer treats the glass as
    a thin film and the perfume as colourless."""
    VOLUMES[material.name] = {"thicknessFactor": thickness}
    if color is not None:
        # Real-time transmission bends the picture behind by the thickness, and
        # the picture includes the label in front: a short path keeps the print
        # out of the perfume while the attenuation keeps its colour.
        VOLUMES[material.name] = {"thicknessFactor": VIEWER_THICKNESS, "attenuationColor": list(color),
                                  "attenuationDistance": VIEWER_THICKNESS}
        # White light keeps `color` after `distance` units (as glTF's attenuation).
        tree = material.node_tree
        absorb = tree.nodes.new("ShaderNodeVolumeAbsorption")
        absorb.inputs["Color"].default_value = (*[1 + math.log(c) / distance for c in color], 1)
        absorb.inputs["Density"].default_value = 1.0
        tree.links.new(absorb.outputs["Volume"], tree.nodes["Material Output"].inputs["Volume"])


def materials(product):
    glass = principled("XELLE_glass", **{"Base Color": (1, 1, 1, 1), "Roughness": 0.0, "IOR": 1.5,
                                         "Transmission Weight": 1.0})
    gltf_volume(glass, 0.1)
    liquid = principled("XELLE_liquid", **{"Base Color": (1, 1, 1, 1), "Roughness": 0.0, "IOR": 1.36,
                                            "Transmission Weight": 1.0})
    gltf_volume(liquid, 2.0, product["liquidTransmit"], LIQUID_PATH)
    cap = principled("XELLE_black_cap", **{"Base Color": (0.004, 0.004, 0.005, 1), "Roughness": 0.05,
                                           "Coat Weight": 1.0, "Coat Roughness": 0.02})
    paper = principled("XELLE_label_back", **{"Base Color": (0.93, 0.91, 0.87, 1), "Roughness": 0.65})
    return glass, liquid, cap, paper


def lathe(name, points, radii, material, steps=24, flip=False):
    obj = base.lathe(name, base.fillet(points, radii, steps=steps), SEGMENTS, flip=flip)
    obj.data.materials.append(material)
    return obj


def solid_glass(material):
    """Outer shell, and the closed cavity inside it with normals into the cavity."""
    outer = lathe("xelle_bottle_glass", [(0, FOOT), (R, FOOT), (R, TOP), (0, TOP)],
                  [0, B["bottomEdgeRadius"], B["topEdgeRadius"], 0], material)
    cavity = lathe("cavity", [(0, CAVITY_BOTTOM), (INNER_R, CAVITY_BOTTOM), (INNER_R, CAVITY_TOP), (0, CAVITY_TOP)],
                   [0, 0.07, 0.07, 0], material, flip=True)
    bm = bmesh.new()
    bm.from_mesh(outer.data)
    bm.from_mesh(cavity.data)
    bm.to_mesh(outer.data)
    bm.free()
    bpy.data.objects.remove(cavity)
    return outer


def cap_part(material):
    obj = base.cap(SEGMENTS, rings=64)
    obj.data.materials.append(material)
    return obj


def build(product):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    base.make_materials()
    glass, liquid, cap, paper = materials(product)
    root = bpy.data.objects.new(product["key"], None)
    bpy.context.scene.collection.objects.link(root)
    root["xelleProduct"] = product["title"]
    parts = [
        solid_glass(glass),
        # The perfume touches the glass: it overlaps the cavity walls by a hair,
        # so renderers see one glass-to-liquid boundary instead of an air film.
        lathe("xelle_fragrance_liquid",
              [(0, CAVITY_BOTTOM - 0.0015), (INNER_R + 0.0015, CAVITY_BOTTOM - 0.0015),
               (INNER_R + 0.0015, CAVITY_TOP - B["liquidGap"]), (0, CAVITY_TOP - B["liquidGap"])],
              [0, 0.07, 0.03, 0], liquid),
        cap_part(cap),
    ]
    front = base.label(SEGMENTS // 2, base.LABELS / f"{product['key']}.png")
    front.data.materials.append(bpy.data.materials["XELLE_printed_ivory_label"])
    bpy.data.materials["XELLE_printed_ivory_label"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.55
    back = front.copy()
    back.data = front.data.copy()
    back.name = back.data.name = "xelle_label_back"
    bpy.context.scene.collection.objects.link(back)
    scale = (LABEL["radius"] - 0.0015) / LABEL["radius"]
    for v in back.data.vertices:
        v.co.x *= scale
        v.co.y *= scale
    bm = bmesh.new()
    bm.from_mesh(back.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(back.data)
    bm.free()
    back.data.materials.clear()
    back.data.materials.append(paper)
    for obj in parts + [front, back]:
        obj.parent = root
    return root


def studio():
    """The packshot's camera and a white studio: white paper behind the flacon
    and under it, dark flags around, one large softbox above left."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
    scene.cycles.samples = 512
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 32
    scene.cycles.transmission_bounces = 24
    scene.cycles.glossy_bounces = 12
    scene.cycles.volume_bounces = 4
    scene.cycles.caustics_reflective = False
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = scene.render.resolution_y = 1200

    world = bpy.data.worlds.new("Studio")
    scene.world = world
    if bpy.app.version < (5, 0, 0):
        world.use_nodes = True
    tree = world.node_tree
    link = tree.links.new
    coords = tree.nodes.new("ShaderNodeTexCoord")
    sep = tree.nodes.new("ShaderNodeSeparateXYZ")
    link(coords.outputs["Generated"], sep.inputs[0])
    # Behind the flacon (+Y, away from the camera) and below it: white paper.
    behind = tree.nodes.new("ShaderNodeMapRange")
    behind.inputs["From Min"].default_value, behind.inputs["From Max"].default_value = -0.1, 0.35
    link(sep.outputs["Y"], behind.inputs["Value"])
    below = tree.nodes.new("ShaderNodeMapRange")
    below.inputs["From Min"].default_value, below.inputs["From Max"].default_value = 0.05, -0.2
    link(sep.outputs["Z"], below.inputs["Value"])
    paper = tree.nodes.new("ShaderNodeMath"); paper.operation = "MAXIMUM"
    link(behind.outputs["Result"], paper.inputs[0]); link(below.outputs["Result"], paper.inputs[1])
    level = tree.nodes.new("ShaderNodeMapRange")
    level.inputs["To Min"].default_value, level.inputs["To Max"].default_value = 0.04, 1.0
    link(paper.outputs[0], level.inputs["Value"])
    env = tree.nodes.new("ShaderNodeBackground")
    link(level.outputs["Result"], env.inputs["Strength"])
    white = tree.nodes.new("ShaderNodeBackground")
    path = tree.nodes.new("ShaderNodeLightPath")
    mix = tree.nodes.new("ShaderNodeMixShader")
    link(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    link(env.outputs[0], mix.inputs[1]); link(white.outputs[0], mix.inputs[2])
    link(mix.outputs[0], tree.nodes["World Output"].inputs["Surface"])

    floor = bpy.data.objects.new("studio_floor", bpy.data.meshes.new("studio_floor"))
    floor.data.from_pydata([(-60, -60, FOOT), (60, -60, FOOT), (60, 60, FOOT), (-60, 60, FOOT)], [], [(0, 1, 2, 3)])
    # The camera sees the paper as white as in the photograph; light bouncing
    # off it onto the flacon stays that of ordinary lit paper.
    paper_material = principled("studio_paper", **{"Base Color": (1, 1, 1, 1), "Roughness": 0.35})
    nodes, links = paper_material.node_tree.nodes, paper_material.node_tree.links
    camera_ray = nodes.new("ShaderNodeLightPath")
    glow = nodes.new("ShaderNodeEmission")
    either = nodes.new("ShaderNodeMixShader")
    links.new(camera_ray.outputs["Is Camera Ray"], either.inputs["Fac"])
    links.new(nodes["Principled BSDF"].outputs[0], either.inputs[1])
    links.new(glow.outputs[0], either.inputs[2])
    links.new(either.outputs[0], nodes["Material Output"].inputs["Surface"])
    floor.data.materials.append(paper_material)
    scene.collection.objects.link(floor)

    target = Vector((0, 0, (FOOT + CAP_CENTER + CAP_R) / 2))
    key = bpy.data.objects.new("softbox", bpy.data.lights.new("softbox", "AREA"))
    key.data.shape, key.data.size, key.data.size_y, key.data.energy = "RECTANGLE", 5, 7, 3000
    key.location = Vector((-7, -6, 9))
    key.rotation_euler = (key.location - target).to_track_quat("Z", "Y").to_euler()
    scene.collection.objects.link(key)

    elevation, distance = math.radians(18.4), 24.0
    camera = bpy.data.objects.new("packshot_camera", bpy.data.cameras.new("packshot_camera"))
    camera.data.lens, camera.data.sensor_width = 157, 36
    camera.location = target + Vector((0, -distance * math.cos(elevation), distance * math.sin(elevation)))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(camera)
    scene.camera = camera


def export(product):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / f"{product['key']}.glb"
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.name.startswith("xelle_") or obj.name == product["key"])
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_texcoords=True, export_normals=True, export_tangents=False,
                              export_materials="EXPORT", export_extras=True, export_cameras=False, export_lights=False,
                              # Nearly lossless: fine positions and normals keep the glass free of ripples.
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=16, export_draco_normal_quantization=14,
                              export_draco_texcoord_quantization=14)
    patch_volume(path)
    return path


def patch_volume(path):
    data = path.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + size])
    for material in doc["materials"]:
        if material["name"] in VOLUMES:
            material.setdefault("extensions", {})["KHR_materials_volume"] = VOLUMES[material["name"]]
        if material["name"] == "XELLE_glass":
            # Real-time viewers do not show one transmissive surface through
            # another: the glass is clear blended glass there, so the perfume
            # inside keeps its transmission and colour (Cycles keeps real glass).
            material.pop("extensions", None)
            material["pbrMetallicRoughness"]["baseColorFactor"] = [1, 1, 1, GLASS_ALPHA]
            material["alphaMode"] = "BLEND"
        if material["name"] in ("XELLE_printed_ivory_label", "XELLE_label_back"):
            material["doubleSided"] = False
    doc["extensionsUsed"] = sorted(set(doc.get("extensionsUsed", [])) | {"KHR_materials_volume"})
    encoded = json.dumps(doc, separators=(",", ":")).encode()
    encoded += b" " * ((-len(encoded)) % 4)
    rest = data[20 + size:]
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, 20 + len(encoded) + len(rest))
                     + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + rest)


def main():
    for product in base.CONFIG["products"]:
        if ONLY and product["key"] != ONLY:
            continue
        build(product)
        print("built", export(product))
        if product["key"] == "santos" or RENDER:
            studio()
            if product["key"] == "santos":
                base.SOURCE.mkdir(parents=True, exist_ok=True)
                bpy.ops.wm.save_as_mainfile(filepath=str(base.SOURCE / "xelle_bottle_hq.blend"))
            if RENDER:
                RENDERS.mkdir(parents=True, exist_ok=True)
                bpy.context.scene.render.filepath = str(RENDERS / f"{product['key']}.png")
                bpy.ops.render.render(write_still=True)
                print("rendered", bpy.context.scene.render.filepath)


main()
