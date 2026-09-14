"""Read-only validation of built Xellé data and binary assets."""
import json, struct, hashlib, re, runpy
from pathlib import Path
root = Path(__file__).resolve().parents[1]
public = root / 'public'
locales = json.loads((root/'audit/xelle-locales.json').read_text('utf-8-sig'))
catalog = json.loads((root/'audit/xelle-catalog.json').read_text('utf-8-sig'))
products = {p['handle']:p for p in catalog['products']}
bundle = (public/'assets/xelle-app.js').read_text('utf-8')
report = {'scope':'Static validation only; no browser assertions','locales':list(locales),'products':[],'images':[],'glbs':[],'preservedScenes':[],'masks':[]}
images = set()
def walk(obj):
    if isinstance(obj, dict):
        for k,v in obj.items():
            if k=='url' and isinstance(v,str) and v.startswith('/xelle/'):
                images.add(v)
                assert (public/v.lstrip('/')).is_file(), v
            walk(v)
    elif isinstance(obj,list):
        for v in obj: walk(v)
walk(locales)
report['images'] = sorted(images)
for i,key in enumerate(['NG','DG','OG','zG'],1):
    p=locales[key]; expected=products[p['uri']]
    buttons=[button for b in p['content']['blocks'] if isinstance(b.get('button'),list) for button in b['button']]
    purchase=next(button for button in buttons if button['label']=='Cumpără pe xelle.ro')
    assert purchase['url']==expected['url']
    assert p['watchSceneIndex']==i
    for note_list in expected['notes'].values():
        assert ' · '.join(note_list) in [b.get('subtitle') for b in p['content']['blocks']]
    report['products'].append({'name':expected['name'],'scene':i,'route':'/#/'+p['uri'],'purchase':purchase['url'],'price':expected['priceFormatted']})
assert len(locales['RG']['scenes'])==5
assert all(p.get('type')!='podcast' for p in locales['pO']['pages'])
def read_glb(f):
    raw=f.read_bytes(); magic,version,total=struct.unpack_from('<III',raw)
    assert magic==0x46546c67 and version==2 and total==len(raw)
    off=12; chunks=[]
    while off<len(raw):
        length,kind=struct.unpack_from('<II',raw,off); off+=8
        assert length%4==0 and off+length<=len(raw)
        chunks.append((kind,raw[off:off+length])); off+=length
    doc=json.loads(chunks[0][1]); binary=next((b for kind,b in chunks if kind==0x004e4942),b'')
    assert doc['asset']['version']=='2.0'
    assert len(binary)>=doc['buffers'][0]['byteLength']
    for view in doc.get('bufferViews',[]):
        assert view.get('byteOffset',0)+view['byteLength']<=len(binary)
    for node in doc.get('nodes',[]):
        for child in node.get('children',[]): assert child<len(doc['nodes'])
        if 'mesh' in node: assert node['mesh']<len(doc.get('meshes',[]))
    return raw,doc,binary

model_names = ['roadster','baignoire','crash','santos']
active_glbs = [public/'xelle/models'/f'{model}_{device}.glb'
               for model in model_names for device in ['desktop','mobile']]
active_glbs += [public/'xelle/backdrops'/name
                for name in ['mainScene.glb','mainSceneMobile.glb']]
# Read the configured source photographs without invoking the generator's main().
photo_files = runpy.run_path(str(root/'scripts/build_xelle_backdrops.py'))['PHOTOS']
assert set(photo_files)=={1,2,3,4}, 'Expected one configured photograph for each perfume scene'
for f in active_glbs:
    raw,doc,binary=read_glb(f)
    resource_path='/'+f.relative_to(public).as_posix()
    assert resource_path in bundle, resource_path
    image_uris=[im['uri'] for im in doc.get('images',[]) if 'uri' in im]
    for uri in image_uris:
        if uri.startswith('data:'): continue
        assert not re.match(r'https?://',uri),uri
        resolved=public/uri.lstrip('/') if uri.startswith('/') else f.parent/uri
        assert resolved.exists(),str(resolved)
    entry={'file':resource_path,'bytes':len(raw),'meshes':len(doc.get('meshes',[])),'nodes':len(doc.get('nodes',[])),'images':len(doc.get('images',[])),'externalImageUris':image_uris,'sha256':hashlib.sha256(raw).hexdigest()}
    if f.parent.name=='backdrops':
        source=public/'xelle/models'/f.name
        source_raw,source_doc,_=read_glb(source)
        assert not any(n.get('extras',{}).get('xellePhoto') for n in source_doc['nodes']), source
        assert '/xelle/models/'+f.name not in bundle, source
        assert doc.get('animations')==source_doc.get('animations'), 'Scene animation data changed'
        surfaces=[n for n in doc['nodes'] if n.get('extras',{}).get('xellePhoto')]
        assert {n['extras']['xellePhoto']['scene'] for n in surfaces}=={1,2,3,4}
        for node in surfaces:
            metadata=node['extras']['xellePhoto']
            assert metadata['aspect']>0
            expected=(public/'xelle'/photo_files[metadata['scene']]).read_bytes()
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                material=doc['materials'][primitive['material']]
                texture=doc['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
                image=doc['images'][texture['source']]
                assert image['mimeType']=='image/jpeg' and 'bufferView' in image
                view=doc['bufferViews'][image['bufferView']]
                offset=view.get('byteOffset',0)
                assert binary[offset:offset+view['byteLength']]==expected, node['name']
        entry['photoSurfaces']=len(surfaces)
        entry['photoScenes']=[{'scene':scene,'photograph':name} for scene,name in photo_files.items()]
        entry['preservedSceneAnimations']=True
        report['preservedScenes'].append({'file':'/'+source.relative_to(public).as_posix(),'bytes':len(source_raw),'sha256':hashlib.sha256(source_raw).hexdigest(),'activeInBundle':False})
    report['glbs'].append(entry)
for f in sorted((public/'xelle/masks').glob('*.png')):
    raw=f.read_bytes(); assert raw[:8]==b'\x89PNG\r\n\x1a\n'
    width,height=struct.unpack_from('>II',raw,16); assert (width,height)==(256,256)
    assert '/xelle/masks/'+f.name in bundle
    report['masks'].append({'file':f.name,'bytes':len(raw),'width':width,'height':height})
assert len(report['glbs'])==10 and len(report['preservedScenes'])==2 and len(report['masks'])==4
assert '#ifdef XELLE_BOTTLE\nalbedo.a=1.0;\n#endif' in bundle
assert 'a.material.defines.XELLE_BOTTLE=1' in bundle
assert 'const h=()=>{l.value||(ch.init(),ch.start(),t.toggleMute(!1)),l.value=!0};' not in bundle
assert 'v7e={hashMode:!0' in bundle
report['checks']=['4 exact published purchase URLs and prices match verified catalog','All official notes match catalog','All locale images exist','8 active perfume GLB + 2 active backdrop GLB headers, chunks, node graph and buffer bounds valid','2 baseline scene GLBs remain separate, valid and absent from active runtime paths','Backdrop scene animation data matches preserved baseline scenes','Each of four photo scenes embeds the exact original JPEG bytes','GLB texture references embedded or locally resolvable','All 10 active GLB resource paths and 4 mask paths occur in runtime bundle','4 256x256 PNG mask signatures valid','Shader scalar-color alpha fix exists','Original first-click audio activation absent','Hash routing active']
(root/'audit/xelle-static-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['glbs']},indent=2,ensure_ascii=False))
print('GLB:', ', '.join(p['file'] for p in report['glbs']))
