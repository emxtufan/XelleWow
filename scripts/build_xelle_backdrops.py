"""Add campaign photographs to copies of the preserved Xelle scene GLBs.

Photographs are embedded as WebP (EXT_texture_webp, already required by the
scenes), longer edges resized to DESKTOP_PHOTO_EDGE or MOBILE_PHOTO_EDGE: a wall
is shown at well under that size, and each scene download shrinks by megabytes. Existing scene
nodes, geometry, camera tracks and animations remain intact. SC01/SC02 stencil
screens become photo walls; the old portal landscapes are marked xelleHidden.
SC03 gains a copy of SC01's curved screen behind its wooden structure. SC04's
three front panels each gain their own photograph.

The entrance room SC00 keeps its own framed panels: the two leaves of the
central door and the two side panels each carry an editorial photograph, so the
hero opens on four pictures instead of blank paper.

The browser's XelleWallPhotoMaterial reads xellePhoto metadata and material.map.
It must derive UVs from bounds for the former stencil screens (their original
UVs are constant), from a measured planar basis for the oblique entrance
panels, and respect xelleHidden even in visibility update loops.
"""
from pathlib import Path
import copy
import io
import json
import re
import struct

from PIL import Image

DESKTOP_PHOTO_EDGE, DESKTOP_PHOTO_QUALITY = 2400, 85
MOBILE_PHOTO_EDGE, MOBILE_PHOTO_QUALITY = 1600, 82


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "xelle"
OUTPUT = ASSETS / "backdrops"
# Paths are relative to public/xelle/. SC04 lists one photograph per front
# panel, in panel order: panel_01 (centre), panel_02, panel_03. None hides
# that panel entirely; the centre one stood behind the staircase.
PHOTOS = {
    1: "backgrounds-noi/scena01.jpg",
    2: "backgrounds-noi/scena02.jpg",
    3: "backgrounds-noi/scena03.jpg",
    4: [None,
        "backgrounds-noi/scena04-2.jpg",
        "backgrounds-noi/scena04-3.jpg"],
}

# Framed panels of the entrance room. Swap "photo" for any other JPEG in
# public/xelle/ to change a picture; nothing else here depends on the choice.
# DSC5430.jpg is the remaining unused campaign photograph.
#
# "u" and "v" are the panel's own in-plane axes, as vec4(axis.xyz, offset).
# The shader reads dot(position, axis) - offset, so each panel spans 0..1 with
# v growing downwards. The two centre entries share one gridded surface and
# clip to their own half of it. The axes were measured from the decoded
# geometry of public/xelle/models/mainScene.glb; POSITION_BOUNDS below fails
# the build if that geometry ever stops matching what was measured.
PAINTINGS = [
    # The centre door is one unframed picture across its whole surface.
    {"id": "center", "node": "GEO_doorCenter_paper", "photo": "DSC5193.jpg",
     "aspect": 1.115932, "duplicate": False,
     "u": [-0.000718611617265, 0.0, 0.0, -0.5],
     "v": [0.0, 0.0, 0.000801921789395, -0.99998922973]},
    {"id": "left", "node": "GEO_doorLeft_paper", "photo": "DSC5265.jpg",
     "aspect": 0.669015, "duplicate": False,
     "u": [-0.00147782362605, 0.00101955173396, 8.06257742143e-05, -0.532619034291],
     "v": [4.43987033843e-05, -3.06311008979e-05, 0.00120114747181, -0.9859582241]},
    {"id": "right", "node": "GEO_doorRight_paper", "photo": "DSC5497.jpg",
     "aspect": 0.669055, "duplicate": False,
     "u": [-0.000584817266643, -0.000606664685755, 3.66148505548e-05, -0.53262498662],
     "v": [0.000119391936004, -8.21764119572e-05, 0.000545378124836, -0.985956794979]},
]
POSITION_BOUNDS = {
    "GEO_doorCenter_paper": ([-695.79, 0.0, -1246.99], [695.79, 0.0, 0.01]),
    "GEO_doorLeft_paper": ([-214.28, -147.82, -809.16], [214.28, 147.82, 0.0]),
    "GEO_doorRight_paper": ([-700.21, -394.93, -1667.89], [389.42, 701.42, 0.0]),
}

# Extra desktop frames for the audio gallery (the original SC06 room has 13).
# Each copies SC06_Image_1's plane with its own material, named so the
# runtime's /image_sc06/i match assigns the gallery photo material, and is
# placed in Empty.SC06 space in areas the original frames leave free, facing
# the camera like the original frame named in "rotation_of".
GALLERY_FRAMES = {
    14: {"translation": [-22.4, 15.9, -22.0], "rotation_of": "SC06_Image_12", "scale": [2.03, 2.38, 2.63]},
    15: {"translation": [15.8, 19.9, -30.0], "rotation_of": "SC06_Image_6", "scale": [3.0, 1.92, 2.35]},
    16: {"translation": [-19.0, 3.6, -18.0], "rotation_of": "SC06_Image_1", "scale": [2.55, 1.63, 2.0]},
}


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", raw)
    assert magic == 0x46546C67 and version == 2 and length == len(raw)
    json_size, json_type = struct.unpack_from("<II", raw, 12)
    assert json_type == 0x4E4F534A
    doc = json.loads(raw[20:20 + json_size])
    binary_size, binary_type = struct.unpack_from("<II", raw, 20 + json_size)
    assert binary_type == 0x004E4942
    return doc, bytearray(raw[28 + json_size:28 + json_size + binary_size])


def write_glb(path, doc, binary):
    while len(binary) % 4:
        binary.append(0)
    doc["buffers"][0]["byteLength"] = len(binary)
    content = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    content += b" " * ((-len(content)) % 4)
    raw = struct.pack("<III", 0x46546C67, 2, 28 + len(content) + len(binary))
    raw += struct.pack("<II", len(content), 0x4E4F534A) + content
    raw += struct.pack("<II", len(binary), 0x004E4942) + binary
    path.write_bytes(raw)


def build(filename):
    source = ASSETS / "models" / filename
    doc, binary = read_glb(source)
    original_animations = copy.deepcopy(doc.get("animations"))
    original_count = len(doc["nodes"])
    nodes = doc["nodes"]
    by_name = {n.get("name"): i for i, n in enumerate(nodes)}
    materials = {}
    changes = []
    paintings = []

    def photo_material(photograph, label):
        if photograph in materials:
            return materials[photograph]
        data = (ASSETS / photograph).read_bytes()
        assert data[:2] == b"\xff\xd8", photograph
        edge, quality = (MOBILE_PHOTO_EDGE, MOBILE_PHOTO_QUALITY) if "Mobile" in filename else (DESKTOP_PHOTO_EDGE, DESKTOP_PHOTO_QUALITY)
        picture = Image.open(io.BytesIO(data))
        picture.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        picture.convert("RGB").save(encoded, "WEBP", quality=quality, method=6)
        data = encoded.getvalue()
        while len(binary) % 4:
            binary.append(0)
        view = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
        binary.extend(data)
        image = len(doc["images"])
        doc["images"].append({"name": photograph, "mimeType": "image/webp", "bufferView": view})
        sampler = len(doc.setdefault("samplers", []))
        doc["samplers"].append({"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071})
        texture = len(doc["textures"])
        doc["textures"].append({"extensions": {"EXT_texture_webp": {"source": image}}, "sampler": sampler})
        material = len(doc["materials"])
        doc["materials"].append({
            "name": label,
            "pbrMetallicRoughness": {"baseColorTexture": {"index": texture},
                                     "baseColorFactor": [1, 1, 1, 1],
                                     "metallicFactor": 0, "roughnessFactor": 1},
            "doubleSided": True,
            "extras": {"originalPhotograph": photograph},
        })
        materials[photograph] = material
        return material

    def repoint(index, material, prefix):
        # Each target gets a mesh record of its own, preserving every original
        # primitive/accessor and compressed geometry buffer in the source GLB.
        node = nodes[index]
        mesh = copy.deepcopy(doc["meshes"][node["mesh"]])
        mesh["name"] = prefix + node["name"]
        for primitive in mesh["primitives"]:
            primitive["material"] = material
        node["mesh"] = len(doc["meshes"])
        doc["meshes"].append(mesh)
        return mesh

    def assign_photo(index, scene, photo, bounds=False, panel=None):
        node = nodes[index]
        label = f"XELLE_PHOTO_SC{scene:02}" + (f"_P{panel}" if panel else "")
        material = photo_material(photo, label)
        mesh = repoint(index, material, "XellePhoto_")
        a = doc["accessors"][mesh["primitives"][0]["attributes"]["POSITION"]]
        minimum, maximum = a["min"], a["max"]
        scale = node.get("scale", [1, 1, 1])
        if bounds:
            aspect = (maximum[0] - minimum[0]) * scale[0] / ((maximum[1] - minimum[1]) * scale[1])
            metadata = {"aspect": aspect, "center": 0.5,
                        "bounds": [minimum[0], minimum[1], maximum[0], maximum[1]]}
        else:
            # SC04 front panels have their surface in local YZ; existing UVs
            # correctly map the whole face and use v=0 at its top edge.
            aspect = (maximum[2] - minimum[2]) * scale[2] / ((maximum[1] - minimum[1]) * scale[1])
            metadata = {"aspect": aspect, "center": 0.5}
        metadata["scene"] = scene
        metadata["photograph"] = photo
        node.setdefault("extras", {}).update({"xellePhoto": metadata, "xellePhotoScene": scene})
        node["extras"].pop("stencil_id", None)
        node["extras"].pop("stencil_by", None)
        changes.append({"node": node["name"], "scene": scene, "photo": photo, **metadata})

    def assign_painting(index, entry):
        node = nodes[index]
        material = photo_material(entry["photo"], "XELLE_PAINTING_" + entry["id"])
        mesh = repoint(index, material, "XellePainting_")
        a = doc["accessors"][mesh["primitives"][0]["attributes"]["POSITION"]]
        expected = POSITION_BOUNDS[entry["node"]]
        actual = ([round(v, 2) for v in a["min"]], [round(v, 2) for v in a["max"]])
        assert actual == (list(expected[0]), list(expected[1])), \
            f"{entry['node']} geometry no longer matches the measured painting frame: {actual}"
        metadata = {"aspect": entry["aspect"], "center": 0.5, "scene": 0,
                    "photograph": entry["photo"], "clip": True,
                    "basis": {"u": entry["u"], "v": entry["v"]}}
        node.setdefault("extras", {}).update({"xellePhoto": metadata, "xellePhotoScene": 0})
        for key in ["lightmap", "SB_uv_used_for_bake"]:
            node["extras"].pop(key, None)
        paintings.append({"node": node["name"], "painting": entry["id"],
                          "photo": entry["photo"], "aspect": entry["aspect"]})

    for scene, names in [(1, ["Screen.001", "MIRROR_Screen"]),
                         (2, ["Screen.002", "MIRROR_Screen.001"])]:
        for name in names:
            assign_photo(by_name[name], scene, PHOTOS[scene], bounds=True)

    # Scene 3 has animated wooden slats instead of a portal. Keep those props
    # and place the curved photographic wall behind them, inside the room.
    backwall = copy.deepcopy(nodes[by_name["Screen.001"]])
    backwall["name"] = "Xelle_photo_wall_SC03"
    backwall["translation"] = [0, 0.3, -22.5]
    backwall["scale"] = [1.8, 1.8, 1.8]
    backwall.pop("rotation", None)
    backwall["extras"] = {}
    wall_index = len(nodes)
    nodes.append(backwall)
    nodes[by_name["Empty.SC03"]]["children"].append(wall_index)
    assign_photo(wall_index, 3, PHOTOS[3], bounds=True)

    hidden_panels = []
    for prefix in ["", "MIRROR_"]:
        for panel in range(1, 4):
            if PHOTOS[4][panel - 1] is None:
                hidden_panels += [f"{prefix}panel_{panel:02}_{side}" for side in ["Front", "Back"]
                                  if f"{prefix}panel_{panel:02}_{side}" in by_name]
                continue
            assign_photo(by_name[f"{prefix}panel_{panel:02}_Front"], 4,
                         PHOTOS[4][panel - 1], panel=panel)

    # Entrance paintings. The mirrored copies feed the reflective floor and
    # share their originals' geometry, so they take the same measured frame.
    entrance = by_name["Empty.SC00"]
    duplicates = 0
    for entry in PAINTINGS:
        for prefix in ["", "MIRROR_"]:
            index = by_name[prefix + entry["node"]]
            if entry["duplicate"]:
                copied = copy.deepcopy(nodes[index])
                copied["name"] = prefix + "Xelle_painting_" + entry["id"]
                index = len(nodes)
                nodes.append(copied)
                nodes[entrance]["children"].append(index)
                duplicates += 1
            assign_painting(index, entry)

    template = nodes[by_name["SC06_Image_1"]]
    template_mesh = doc["meshes"][template["mesh"]]
    template_material = doc["materials"][template_mesh["primitives"][0]["material"]]
    gallery = []
    for number, placement in GALLERY_FRAMES.items():
        material = copy.deepcopy(template_material)
        material["name"] = f"MT_Image_SC06.{number + 6:03}"
        doc["materials"].append(material)
        mesh = copy.deepcopy(template_mesh)
        mesh["name"] = f"Plane.SC06_Image_{number}"
        for primitive in mesh["primitives"]:
            primitive["material"] = len(doc["materials"]) - 1
        doc["meshes"].append(mesh)
        frame = {"name": f"SC06_Image_{number}", "mesh": len(doc["meshes"]) - 1,
                 "translation": placement["translation"], "scale": placement["scale"],
                 "rotation": nodes[by_name[placement["rotation_of"]]]["rotation"]}
        nodes[by_name["Empty.SC06"]]["children"].append(len(nodes))
        nodes.append(frame)
        gallery.append({"node": frame["name"], "material": material["name"], **placement})

    hidden = []
    def hide_portal(index):
        node = nodes[index]
        if "mesh" in node:
            node.setdefault("extras", {})["xelleHidden"] = True
            hidden.append(node["name"])
        for child in node.get("children", []):
            hide_portal(child)
    for name in ["Empty.PortalSC01", "Empty.PortalSC02"] + hidden_panels:
        hide_portal(by_name[name])

    added = 1 + duplicates + len(GALLERY_FRAMES)
    assert doc.get("animations") == original_animations
    assert len(nodes) == original_count + added
    output = OUTPUT / filename
    write_glb(output, doc, binary)
    # Reparse the actual output rather than trusting only the in-memory document.
    actual, _ = read_glb(output)
    assert actual.get("animations") == original_animations
    assert len(actual["nodes"]) == original_count + added
    return {"file": str(output.relative_to(ROOT)), "bytes": output.stat().st_size,
            "source": str(source.relative_to(ROOT)), "photoSurfaces": changes,
            "entrancePaintings": paintings, "galleryFrames": gallery,
            "hiddenPortalMeshes": hidden, "originalAnimationPreserved": True}


# Scene of a characters-GLB mesh, by the runtime's rule: the first pattern that
# matches one of its ten nearest ancestors' names.
SCENE_PATTERNS = [r"SC00", r"SC01|TAILORED_CRAFTS", r"SC02|THE_EYE", r"SC03|SHAPING_MOVEMENT",
                  r"SC04|MANUFACTURE", r"SC05|THE_MOVIE", r"SC06"]
FILM_SCENE = 5


def scene_index(nodes, parents, index):
    for scene, pattern in enumerate(SCENE_PATTERNS):
        node, depth = index, 0
        while node in parents and depth < 10:
            node, depth = parents[node], depth + 1
            if re.search(pattern, nodes[node].get("name", ""), re.I):
                return scene
    return None


def compact(items, used):
    order = sorted(used)
    return [items[i] for i in order], {old: new for new, old in enumerate(order)}


def texture_refs(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key.endswith("Texture") and isinstance(item, dict):
                yield item
            yield from texture_refs(item)
    elif isinstance(value, list):
        for item in value:
            yield from texture_refs(item)


def prune_characters(filename):
    """Copy the people/props GLB with only the film scene's meshes.

    build_xelle.cjs hides every characters mesh outside the film, but the
    browser still downloaded and decoded them. Nodes, bones and animations stay
    byte-identical; the other scenes' meshes, skins, materials, textures and
    buffers go, leaving their nodes empty.
    """
    source = ROOT / "public" / "webgl" / "models" / filename
    doc, binary = read_glb(source)
    nodes = doc["nodes"]
    parents = {child: i for i, node in enumerate(nodes) for child in node.get("children", [])}
    film = []
    for i, node in enumerate(nodes):
        if "mesh" not in node:
            continue
        if scene_index(nodes, parents, i) == FILM_SCENE:
            film.append(node["name"])
        else:
            node.pop("mesh")
            node.pop("skin", None)
    assert all("sparse" not in a for a in doc["accessors"])

    doc["meshes"], meshes = compact(doc["meshes"], {n["mesh"] for n in nodes if "mesh" in n})
    doc["skins"], skins = compact(doc.get("skins", []), {n["skin"] for n in nodes if "skin" in n})
    for node in nodes:
        if "mesh" in node:
            node["mesh"] = meshes[node["mesh"]]
        if "skin" in node:
            node["skin"] = skins[node["skin"]]
    primitives = [p for mesh in doc["meshes"] for p in mesh["primitives"]]
    doc["materials"], materials = compact(doc["materials"], {p["material"] for p in primitives if "material" in p})
    for p in primitives:
        if "material" in p:
            p["material"] = materials[p["material"]]
    refs = list(texture_refs(doc["materials"]))
    doc["textures"], textures = compact(doc["textures"], {ref["index"] for ref in refs})
    for ref in refs:
        ref["index"] = textures[ref["index"]]
    sources = [t["extensions"]["EXT_texture_webp"] if "EXT_texture_webp" in t.get("extensions", {}) else t
               for t in doc["textures"]]
    doc["images"], images = compact(doc["images"], {s["source"] for s in sources if "source" in s})
    for s in sources:
        if "source" in s:
            s["source"] = images[s["source"]]

    accessor_refs = []
    for p in primitives:
        accessor_refs += [(p["attributes"], k) for k in p["attributes"]]
        accessor_refs += [(target, k) for target in p.get("targets", []) for k in target]
        if "indices" in p:
            accessor_refs.append((p, "indices"))
    accessor_refs += [(skin, "inverseBindMatrices") for skin in doc["skins"] if "inverseBindMatrices" in skin]
    accessor_refs += [(s, k) for a in doc.get("animations", []) for s in a["samplers"] for k in ("input", "output")]
    doc["accessors"], accessors = compact(doc["accessors"], {owner[k] for owner, k in accessor_refs})
    for owner, k in accessor_refs:
        owner[k] = accessors[owner[k]]

    draco = [p["extensions"]["KHR_draco_mesh_compression"] for p in primitives
             if "KHR_draco_mesh_compression" in p.get("extensions", {})]
    view_refs = [o for o in doc["accessors"] + doc["images"] + draco if "bufferView" in o]
    views, view_map = compact(doc["bufferViews"], {o["bufferView"] for o in view_refs})
    for o in view_refs:
        o["bufferView"] = view_map[o["bufferView"]]
    packed = bytearray()
    for view in views:
        start = view.get("byteOffset", 0)
        packed += b"\0" * ((-len(packed)) % 4)
        chunk = binary[start:start + view["byteLength"]]
        view["byteOffset"] = len(packed)
        packed += chunk
    doc["bufferViews"] = views

    output = OUTPUT / filename
    write_glb(output, doc, packed)
    actual, _ = read_glb(output)
    actual_parents = {child: i for i, node in enumerate(actual["nodes"]) for child in node.get("children", [])}
    kept = [n["name"] for i, n in enumerate(actual["nodes"])
            if "mesh" in n and scene_index(actual["nodes"], actual_parents, i) == FILM_SCENE]
    assert kept == film and sum("mesh" in n for n in actual["nodes"]) == len(film)
    assert len(actual["nodes"]) == len(nodes) and len(actual["animations"]) == len(doc["animations"])
    return {"file": str(output.relative_to(ROOT)), "bytes": output.stat().st_size,
            "source": str(source.relative_to(ROOT)), "sourceBytes": source.stat().st_size,
            "filmMeshes": len(film)}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name in ["mainScene_characters.glb", "mainSceneMobile_characters.glb"]:
        print(json.dumps(prune_characters(name)))
    result = [build(name) for name in ["mainScene.glb", "mainSceneMobile.glb"]]
    (OUTPUT / "manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for entry in result:
        print(json.dumps({k: v for k, v in entry.items()
                          if k not in ["photoSurfaces", "hiddenPortalMeshes", "entrancePaintings", "galleryFrames"]}))


if __name__ == "__main__":
    main()
