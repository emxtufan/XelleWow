"""Add campaign photographs to copies of the preserved Xelle scene GLBs.

The original JPEG bytes are embedded without raster editing. Existing scene
nodes, geometry, camera tracks and animations remain intact. SC01/SC02 stencil
screens become photo walls; the old portal landscapes are marked xelleHidden.
SC03 gains a copy of SC01's curved screen behind its wooden structure. SC04's
three front panels gain the Maracuja campaign photograph.

The browser's XelleWallPhotoMaterial reads xellePhoto metadata and material.map.
It must derive UVs from bounds for the former stencil screens (their original
UVs are constant), and respect xelleHidden even in visibility update loops.
"""
from pathlib import Path
import copy
import json
import struct


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "xelle"
OUTPUT = ASSETS / "backdrops"
PHOTOS = {
    1: "spiced-peach-negroni.jpg",
    2: "pornstar-martini-50-ml.jpg",
    3: "prosecco-di-cherry-50-ml.jpg",
    4: "maracuja-mojito-50-ml.jpg",
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

    def photo_material(scene):
        if scene in materials:
            return materials[scene]
        photograph = (ASSETS / PHOTOS[scene]).read_bytes()
        assert photograph[:2] == b"\xff\xd8", PHOTOS[scene]
        while len(binary) % 4:
            binary.append(0)
        view = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(photograph)})
        binary.extend(photograph)
        image = len(doc["images"])
        doc["images"].append({"name": PHOTOS[scene], "mimeType": "image/jpeg", "bufferView": view})
        sampler = len(doc.setdefault("samplers", []))
        doc["samplers"].append({"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071})
        texture = len(doc["textures"])
        doc["textures"].append({"source": image, "sampler": sampler})
        material = len(doc["materials"])
        doc["materials"].append({
            "name": f"XELLE_PHOTO_SC{scene:02}",
            "pbrMetallicRoughness": {"baseColorTexture": {"index": texture},
                                     "baseColorFactor": [1, 1, 1, 1],
                                     "metallicFactor": 0, "roughnessFactor": 1},
            "doubleSided": True,
            "extras": {"xellePhotoScene": scene, "originalPhotograph": PHOTOS[scene]},
        })
        materials[scene] = material
        return material

    def assign_photo(index, scene, bounds=False):
        node = nodes[index]
        material = photo_material(scene)
        # Each target gets a mesh record of its own, preserving every original
        # primitive/accessor and compressed geometry buffer in the source GLB.
        mesh = copy.deepcopy(doc["meshes"][node["mesh"]])
        mesh["name"] = "XellePhoto_" + node["name"]
        for primitive in mesh["primitives"]:
            primitive["material"] = material
        node["mesh"] = len(doc["meshes"])
        doc["meshes"].append(mesh)
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
        node.setdefault("extras", {}).update({"xellePhoto": metadata, "xellePhotoScene": scene})
        node["extras"].pop("stencil_id", None)
        node["extras"].pop("stencil_by", None)
        changes.append({"node": node["name"], "scene": scene, "photo": PHOTOS[scene], **metadata})

    for scene, names in [(1, ["Screen.001", "MIRROR_Screen"]),
                         (2, ["Screen.002", "MIRROR_Screen.001"])]:
        for name in names:
            assign_photo(by_name[name], scene, bounds=True)

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
    assign_photo(wall_index, 3, bounds=True)

    for prefix in ["", "MIRROR_"]:
        for panel in range(1, 4):
            assign_photo(by_name[f"{prefix}panel_{panel:02}_Front"], 4)

    hidden = []
    def hide_portal(index):
        node = nodes[index]
        if "mesh" in node:
            node.setdefault("extras", {})["xelleHidden"] = True
            hidden.append(node["name"])
        for child in node.get("children", []):
            hide_portal(child)
    for name in ["Empty.PortalSC01", "Empty.PortalSC02"]:
        hide_portal(by_name[name])

    assert doc.get("animations") == original_animations
    assert len(nodes) == original_count + 1
    output = OUTPUT / filename
    write_glb(output, doc, binary)
    # Reparse the actual output rather than trusting only the in-memory document.
    actual, _ = read_glb(output)
    assert actual.get("animations") == original_animations
    assert len(actual["nodes"]) == original_count + 1
    return {"file": str(output.relative_to(ROOT)), "bytes": output.stat().st_size,
            "source": str(source.relative_to(ROOT)), "photoSurfaces": changes,
            "hiddenPortalMeshes": hidden, "originalAnimationPreserved": True}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    result = [build(name) for name in ["mainScene.glb", "mainSceneMobile.glb"]]
    (OUTPUT / "manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for entry in result:
        print(json.dumps({k: v for k, v in entry.items() if k not in ["photoSurfaces", "hiddenPortalMeshes"]}))


if __name__ == "__main__":
    main()
