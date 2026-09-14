"""Audit the captured Cartier files without modifying them.

Run: python scripts/verify_assets.py [--in-progress]
The JSON report separates active en_fr resources from unsized image inputs and
other-locale resources. No requests are sent to the original website.
"""

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import struct
from urllib.parse import unquote, urlsplit


PROJECT = Path(__file__).resolve().parents[1]
CDN = "https://websitefactory.cartier.com/akamai-storage/videos/ww26/"
UNSIZED = re.compile(r"^images/productPages/([^/]+)/([^/]+)\.webp$", re.I)
SIZED = re.compile(r"^images/productPages/([^/]+)/(?:0\.05|0\.1|0\.2|0\.4|0\.6|0\.8|1\.0)/([^/]+)\.webp$", re.I)


def classify(path, other_locale):
    """Unsized WebP names are responsive resolver inputs, not fetched URLs."""
    if UNSIZED.match(path):
        return "unsized_product_input"
    match = SIZED.match(path)
    if match:
        group, name = match.groups()
        group = "roadster" if group == "roaster" else group
        if f"images/productPages/{group}/{name}.webp" in other_locale:
            return "other_locale"
    if path in other_locale:
        return "other_locale"
    return "required"


def resolve_uri(uri, source, public):
    if uri.startswith("data:"):
        return None
    if uri.startswith(CDN):
        candidate = public / unquote(urlsplit(uri[len(CDN):]).path).lstrip("/")
    else:
        parsed = urlsplit(uri)
        if parsed.scheme or parsed.netloc:
            return {"uri": uri, "status": "external_origin"}
        name = unquote(parsed.path)
        candidate = public / name.lstrip("/") if name.startswith("/") else source.parent / name
    candidate = candidate.resolve()
    try:
        relative = candidate.relative_to(public.resolve()).as_posix()
    except ValueError:
        return {"uri": uri, "status": "outside_public_root"}
    return {"uri": uri, "localPath": relative,
            "status": "present" if candidate.is_file() else "missing"}


def inspect_glb(file, public):
    result = {"path": file.relative_to(public).as_posix(), "bytes": file.stat().st_size,
              "errors": [], "externalDependencies": []}
    errors = result["errors"]
    size = result["bytes"]
    if size < 12:
        errors.append("GLB header is shorter than 12 bytes")
        return result
    with file.open("rb") as handle:
        magic, version, declared = struct.unpack("<4sII", handle.read(12))
        result.update(version=version, declaredBytes=declared)
        if magic != b"glTF":
            errors.append("Invalid GLB magic")
            return result
        if version != 2:
            errors.append(f"Expected GLB version 2, got {version}")
        if declared != size:
            errors.append(f"Declared length {declared} differs from file length {size}")
        if size % 4:
            errors.append("GLB file length is not aligned to four bytes")
        offset, chunks, gltf, binary_bytes = 12, [], None, 0
        while offset < size:
            if size - offset < 8:
                errors.append(f"Incomplete chunk header at byte {offset}")
                break
            handle.seek(offset)
            chunk_length, chunk_type = struct.unpack("<I4s", handle.read(8))
            if chunk_length % 4:
                errors.append(f"Chunk at byte {offset} has non-aligned length {chunk_length}")
            if offset + 8 + chunk_length > size:
                errors.append(f"Chunk at byte {offset} extends beyond the file")
                break
            chunks.append({"type": chunk_type.decode("ascii", "replace"), "bytes": chunk_length})
            if len(chunks) == 1 and chunk_type != b"JSON":
                errors.append("First chunk is not JSON")
            if chunk_type == b"JSON":
                if gltf is not None:
                    errors.append("Multiple JSON chunks")
                try:
                    gltf = json.loads(handle.read(chunk_length).decode("utf-8").rstrip(" \t\r\n\x00"))
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    errors.append(f"Invalid JSON chunk: {error}")
            elif chunk_type == b"BIN\x00":
                binary_bytes += chunk_length
            offset += 8 + chunk_length
        result["chunks"] = chunks
        if gltf is None:
            errors.append("No readable JSON chunk")
            return result
        if gltf.get("asset", {}).get("version") != "2.0":
            errors.append("JSON asset.version is not 2.0")
        result["extensionsRequired"] = gltf.get("extensionsRequired", [])
        result["counts"] = {key: len(gltf.get(key, [])) for key in
                            ("scenes", "nodes", "meshes", "materials", "textures", "images", "animations")}
        buffers = gltf.get("buffers", [])
        for index, buffer in enumerate(buffers):
            if "uri" not in buffer and buffer.get("byteLength", 0) > binary_bytes:
                errors.append(f"buffers[{index}] declares more bytes than the BIN chunks")
        for index, view in enumerate(gltf.get("bufferViews", [])):
            buffer_index = view.get("buffer", 0)
            if not isinstance(buffer_index, int) or not 0 <= buffer_index < len(buffers):
                errors.append(f"bufferViews[{index}] has invalid buffer index")
            elif view.get("byteOffset", 0) + view.get("byteLength", 0) > buffers[buffer_index].get("byteLength", 0):
                errors.append(f"bufferViews[{index}] extends beyond its declared buffer")
        for collection in ("buffers", "images"):
            for index, entry in enumerate(gltf.get(collection, [])):
                uri = entry.get("uri")
                if isinstance(uri, str):
                    dependency = resolve_uri(uri, file, public)
                    if dependency:
                        dependency["source"] = f"{collection}[{index}]"
                        result["externalDependencies"].append(dependency)
    return result


def inspect_payload(file):
    size = file.stat().st_size
    if not size:
        return "Empty file"
    with file.open("rb") as handle:
        head = handle.read(4096)
    normalized = head.lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    if normalized.startswith((b"<!doctype html", b"<html")) or b"<title>access denied" in normalized:
        return "HTML error/page payload saved as an asset"
    ext = file.suffix.lower()
    signatures = {
        ".png": lambda: head.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": lambda: head.startswith(b"\xff\xd8\xff"),
        ".jpeg": lambda: head.startswith(b"\xff\xd8\xff"),
        ".webp": lambda: head[:4] == b"RIFF" and head[8:12] == b"WEBP",
        ".exr": lambda: head.startswith(b"\x76\x2f\x31\x01"),
        ".wasm": lambda: head.startswith(b"\x00asm\x01\x00\x00\x00"),
        ".woff": lambda: head.startswith(b"wOFF"),
        ".woff2": lambda: head.startswith(b"wOF2"),
        ".mp4": lambda: head[4:8] in (b"ftyp", b"moov", b"mdat", b"free", b"wide"),
        ".mp3": lambda: head.startswith(b"ID3") or (len(head) > 1 and head[0] == 255 and head[1] & 224 == 224),
        ".ogg": lambda: head.startswith(b"OggS"),
        ".wav": lambda: head[:4] == b"RIFF" and head[8:12] == b"WAVE",
        ".ktx2": lambda: head.startswith(b"\xabKTX 20\xbb\r\n\x1a\n"),
        ".glb": lambda: head.startswith(b"glTF"),
    }
    if ext in signatures and not signatures[ext]():
        return f"Unexpected {ext} file signature"
    if ext == ".webp" and len(head) >= 12:
        declared = struct.unpack("<I", head[4:8])[0] + 8
        if declared != size:
            return f"WebP RIFF length {declared} differs from file length {size}"
    if ext == ".json":
        try:
            json.loads(file.read_text(encoding="utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            return f"Invalid JSON: {error}"
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", type=Path, default=PROJECT / "public")
    parser.add_argument("--manifest", type=Path, default=PROJECT / "audit/asset-paths.json")
    parser.add_argument("--report", type=Path, default=PROJECT / "audit/integrity-report.json")
    parser.add_argument("--in-progress", action="store_true", help="Do not treat currently missing/incomplete downloads as final failures")
    args = parser.parse_args()
    public = args.public.resolve()
    paths = sorted(set(json.loads(args.manifest.read_text(encoding="utf-8-sig"))))
    other_file = PROJECT / "audit/other-locale-literals.json"
    other_locale = {p.lstrip("/") for p in json.loads(other_file.read_text(encoding="utf-8-sig"))} if other_file.is_file() else set()
    missing = {"required": [], "unsized_product_input": [], "other_locale": []}
    classifications = Counter()
    checked, payload_errors = [], []
    for relative in paths:
        classification = classify(relative, other_locale)
        classifications[classification] += 1
        file = public / relative
        if not file.is_file():
            missing[classification].append(relative)
            continue
        checked.append(relative)
        error = inspect_payload(file)
        if error:
            payload_errors.append({"path": relative, "classification": classification, "error": error})
    supplemental = []
    known_paths = set(paths)
    media_extensions = {".png", ".jpg", ".jpeg", ".webp", ".exr", ".wasm", ".woff", ".woff2",
                        ".mp4", ".mp3", ".ogg", ".wav", ".ktx2", ".glb", ".json", ".js", ".css", ".svg", ".3dl", ".bin"}
    for file in sorted(public.rglob("*")):
        if not file.is_file() or file.suffix.lower() not in media_extensions:
            continue
        relative = file.relative_to(public).as_posix()
        if relative in known_paths:
            continue
        supplemental.append(relative)
        error = inspect_payload(file)
        if error:
            payload_errors.append({"path": relative, "classification": "required_supplemental", "error": error})
    glbs = [inspect_glb(file, public) for file in sorted(public.rglob("*.glb"))]
    dependencies = [{"glb": result["path"], **dependency} for result in glbs for dependency in result["externalDependencies"]]
    for dependency in dependencies:
        if dependency["status"] == "present":
            file = public / dependency["localPath"]
            error = inspect_payload(file)
            if error and dependency["localPath"] not in {item["path"] for item in payload_errors}:
                payload_errors.append({"path": dependency["localPath"], "classification": "required_glb_dependency", "error": error})
    required_payload_errors = sum(item["classification"].startswith("required") for item in payload_errors)
    invalid_glbs = sum(bool(item["errors"]) for item in glbs)
    unresolved = sum(item["status"] != "present" for item in dependencies)
    complete = not (missing["required"] or required_payload_errors or invalid_glbs or unresolved)
    summary = {"manifestPaths": len(paths), "existingManifestFiles": len(checked), "supplementalFilesChecked": len(supplemental),
               "missingRequired": len(missing["required"]),
               "missingUnsizedProductInputs": len(missing["unsized_product_input"]),
               "missingOtherLocale": len(missing["other_locale"]),
               "payloadErrors": len(payload_errors), "requiredPayloadErrors": required_payload_errors,
               "glbsChecked": len(glbs), "invalidGlbs": invalid_glbs,
               "externalGlbDependencies": len(dependencies), "unresolvedGlbDependencies": unresolved,
               "assetIntegrityComplete": complete}
    report = {"generatedAt": datetime.now(timezone.utc).isoformat(), "downloadsInProgress": args.in_progress,
              "publicRoot": str(public), "summary": summary, "classificationCounts": dict(classifications),
              "missing": missing, "payloadErrors": payload_errors, "glbs": glbs,
              "glbDependencies": dependencies,
              "notes": ["Unsized product WebP paths are original responsive URL inputs; seven sized variants are checked as actual resources.",
                        "Other-locale-only product variants are not required by the configured en_fr experience.",
                        "Header and container checks do not replace full image/media decoding or browser scene validation.",
                        "While downloadsInProgress is true, files can change during this audit; rerun after downloads complete."]}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"report": str(args.report), **summary}, indent=2))
    return 0 if complete or args.in_progress else 1


if __name__ == "__main__":
    raise SystemExit(main())
