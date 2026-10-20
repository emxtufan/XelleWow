// GLB audit: meshes, triangles, draw calls (primitives), materials, textures,
// vertex attributes and simple geometry checks. No dependencies.
// Usage: node audit/glb-inspect.mjs <file.glb> [...] [--json]
import fs from 'node:fs';
import path from 'node:path';

const COMPONENTS = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4};
const TYPES = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};

function readGlb(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + file);
  let offset = 12, json = null, bin = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    offset += 8 + length;
  }
  return {json, bin, size: buffer.length};
}

function imageSize(data, mime) {
  if (mime === 'image/png' || (data[0] === 0x89 && data[1] === 0x50)) return [data.readUInt32BE(16), data.readUInt32BE(20)];
  if (data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i < data.length) {
      const marker = data[i + 1], length = data.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)];
      i += 2 + length;
    }
  }
  if (data.subarray(0, 4).toString() === 'RIFF') return ['webp', ''];
  if (data.subarray(1, 4).toString() === 'KTX') return ['ktx2', ''];
  return ['?', '?'];
}

function accessorData(gltf, bin, index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const size = COMPONENTS[accessor.componentType], count = TYPES[accessor.type];
  const stride = view.byteStride || size * count;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const read = {5126: 'readFloatLE', 5125: 'readUInt32LE', 5123: 'readUInt16LE', 5121: 'readUInt8'}[accessor.componentType];
  const out = [];
  for (let i = 0; i < accessor.count; i++) {
    const row = [];
    for (let c = 0; c < count; c++) row.push(bin[read](start + i * stride + c * size));
    out.push(row);
  }
  return out;
}

function inspect(file) {
  const {json: gltf, bin, size} = readGlb(file);
  const report = {file: path.relative(process.cwd(), file), sizeKB: Math.round(size / 1024), meshes: [], materials: [], textures: [],
    totals: {meshes: 0, primitives: 0, triangles: 0, vertices: 0}, extensions: gltf.extensionsUsed || [], issues: []};
  for (const material of gltf.materials || []) {
    const pbr = material.pbrMetallicRoughness || {};
    report.materials.push({name: material.name, alphaMode: material.alphaMode || 'OPAQUE',
      baseColor: pbr.baseColorFactor && pbr.baseColorFactor.map(v => +v.toFixed(3)),
      metallic: pbr.metallicFactor, roughness: pbr.roughnessFactor,
      maps: ['baseColorTexture', 'metallicRoughnessTexture'].filter(k => pbr[k]).concat(['normalTexture', 'occlusionTexture', 'emissiveTexture'].filter(k => material[k])),
      extensions: Object.keys(material.extensions || {})});
  }
  for (const [index, image] of (gltf.images || []).entries()) {
    let dims = ['ext', ''];
    if (image.bufferView != null && bin) {
      const view = gltf.bufferViews[image.bufferView];
      dims = imageSize(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength), image.mimeType);
      report.textures.push({index, mime: image.mimeType, size: dims.join('x'), KB: Math.round(view.byteLength / 1024)});
    } else report.textures.push({index, uri: image.uri});
  }
  for (const mesh of gltf.meshes || []) {
    const entry = {name: mesh.name, primitives: mesh.primitives.length, triangles: 0, vertices: 0, attributes: [], materials: []};
    for (const primitive of mesh.primitives) {
      const position = gltf.accessors[primitive.attributes.POSITION];
      entry.vertices += position.count;
      const triangles = primitive.indices != null ? gltf.accessors[primitive.indices].count / 3 : position.count / 3;
      entry.triangles += (primitive.mode == null || primitive.mode === 4) ? triangles : 0;
      entry.attributes = [...new Set([...entry.attributes, ...Object.keys(primitive.attributes)])];
      if (primitive.material != null) entry.materials.push(gltf.materials[primitive.material].name);
      if (primitive.extensions) entry.compression = Object.keys(primitive.extensions);
      // Geometry checks only on uncompressed data.
      if (!primitive.extensions && bin && primitive.attributes.NORMAL != null) {
        const normals = accessorData(gltf, bin, primitive.attributes.NORMAL);
        const bad = normals.filter(n => Math.abs(Math.hypot(...n) - 1) > 0.02).length;
        if (bad) report.issues.push(`${mesh.name}: ${bad} non-unit normals`);
      }
      if (!primitive.attributes.NORMAL) report.issues.push(`${mesh.name}: no normals`);
      if (!primitive.attributes.TEXCOORD_0) entry.noUV = true;
    }
    entry.triangles = Math.round(entry.triangles);
    report.meshes.push(entry);
    report.totals.meshes++;
    report.totals.primitives += entry.primitives;
    report.totals.triangles += entry.triangles;
    report.totals.vertices += entry.vertices;
  }
  return report;
}

const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const reports = files.map(inspect);
if (process.argv.includes('--json')) console.log(JSON.stringify(reports, null, 1));
else for (const r of reports) {
  console.log(`\n== ${r.file}  ${r.sizeKB} KB  meshes ${r.totals.meshes}  draw calls ${r.totals.primitives}  triangles ${r.totals.triangles}  vertices ${r.totals.vertices}  ext [${r.extensions}]`);
  console.log('  textures:', r.textures.map(t => t.size ? `${t.size} ${t.mime || ''} ${t.KB}KB` : t.uri).join(' | ') || 'none');
  for (const m of r.meshes.slice(0, 40)) console.log(`  - ${m.name}: ${m.triangles} tris, ${m.vertices} verts, [${m.attributes}]${m.compression ? ' comp ' + m.compression : ''} -> ${[...new Set(m.materials)]}`);
  if (r.meshes.length > 40) console.log(`  ... ${r.meshes.length - 40} more meshes`);
  console.log('  materials:', r.materials.map(m => `${m.name}(${m.alphaMode}${m.maps.length ? ' ' + m.maps : ''}${m.extensions.length ? ' ' + m.extensions : ''})`).join(', '));
  if (r.issues.length) console.log('  issues:', r.issues.slice(0, 10).join('; '));
}
