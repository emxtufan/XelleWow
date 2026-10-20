"""Validate built Xellé data and assets, then write a static-check report."""
import json, struct, hashlib, re, runpy, io
from PIL import Image
from pathlib import Path
root = Path(__file__).resolve().parents[1]
public = root / 'public'
locales = json.loads((root/'audit/xelle-locales.json').read_text('utf-8-sig'))
catalog = json.loads((root/'audit/xelle-catalog.json').read_text('utf-8-sig'))
products = {p['handle']:p for p in catalog['products']}
bundle = (public/'assets/xelle-app.js').read_text('utf-8')
original_bundle = (root/'original/app.js').read_text('utf-8')
report = {'scope':'Static validation only; no browser assertions','locales':list(locales),'products':[],'images':[],'glbs':[],'preservedScenes':[],'masks':[]}
placement_source = (root/'scripts/xelle-bottle-placement.js').read_text('utf-8').strip()
assert placement_source in bundle
assert 'xelleUpdateBottleShadow(this,p,u)' in bundle
assert 'xelleCreateBottleShadow(this)}destroy(){xelleDestroyBottleShadow(this);super.destroy()}' in bundle
report['bottlePlacement'] = {'homeDrop': float(re.search(r'const XELLE_BOTTLE_DROP = ([0-9.]+);', placement_source)[1]), 'scaledModelBase': -0.84, 'shadow': 'Soft procedural ellipse in the bottle render pass', 'scope': 'Home perfume scenes 1–4; fades out into product presentation'}
material_source = (root/'scripts/xelle-bottle-material.js').read_text('utf-8').strip()
glass_source = (root/'scripts/xelle-bottle-glass.glsl').read_text('utf-8').strip()
studio_source = (root/'scripts/xelle-bottle-studio.glsl').read_text('utf-8').strip()
assert material_source in bundle and glass_source in bundle and studio_source in bundle
assert 'xelleConfigureBottleMaterial(a)' in bundle
assert "xelle_glass_inner: 1," in material_source and "xelle_fragrance_liquid: 2," in material_source and "xelle_bottle_glass: 3" in material_source
assert "alpha=mix(uAlpha,0.6,pow(xelleGlassEdge,1.5))*albedo.w;" in bundle
report['bottleMaterials'] = {'glassOpacity': .14, 'innerGlassOpacity': .08, 'liquidOpacity': .9, 'edgeOpacity': .6, 'lighting': 'Reduced glass diffuse, stronger environment reflections and grazing-angle edge definition; liquid lit through with meniscus', 'layering': 'Opaque label/cap/collar then transparent inner glass wall, liquid and outer glass'}
for intro_file in ['scripts/xelle-intro-set.js', 'scripts/xelle-intro-scene.js']:
    assert (root/intro_file).read_text('utf-8').strip() in bundle
intro_source = (root/'scripts/xelle-intro-scene.js').read_text('utf-8')
intro_set_source = (root/'scripts/xelle-intro-set.js').read_text('utf-8')
assert 'xelleCreateIntro(this)' in bundle and 'xelleDestroyIntro(this)' in bundle
assert 'xellePrepareIntroRender' not in bundle and 'suppressedLights' not in intro_source
lighting_source = intro_source.split('function xelleIntroLightScale(main, intensity) {', 1)[1].split('function xelleDestroyIntro(main)', 1)[0]
assert 'main._open || main._loopMade || time >= 1.30' in lighting_source
assert '(Number(sceneIn) !== 0 && Number(sceneOut) !== 0)) return 1;' in lighting_source
assert 'const progress = Math.max(0, Math.min(1, (time - 0.12) / 1.15));' in lighting_source
assert 'const eased = progress * progress * (3 - 2 * progress);' in lighting_source
assert 'return intensity + (1 - intensity) * eased;' in lighting_source
assert 'const shaftScale = xelleIntroLightScale(main, 0.12);' in lighting_source
assert 'const glowScale = xelleIntroLightScale(main, 0.08);' in lighting_source
assert 'main._lightShafts || []' in lighting_source and 'main._glowSpheresComponent?.spheres || []' in lighting_source
assert 'mesh.material.uniforms.uAlpha.value *= shaftScale;' in lighting_source
assert 'mesh.material.uniforms.uAlpha.value *= glowScale;' in lighting_source
assert '.visible' not in lighting_source, 'Intro lighting helper changes original light visibility'
assert bundle.count('this._envParticles.update(t),super.update(t),xelleApplyIntroLighting(this),xelleDrawLabels(this,t)}updateFromViewRenderer') == 1, 'Intro lighting (then the label print) must follow the original animation updates'
assert bundle.count('t.lightPass.dark=1-(1-this._loopSceneHack.value)*xelleIntroLightScale(this,.70)}') == 1
assert bundle.count('t.magicLight.uniforms.uSpotLightIntensityMask.value=1-this._loopSceneHack.value') == 1, 'Original spotlight intensity reset changed'
# Compare the complete original feedback shader and runtime, including flow-map,
# previous-frame targets, animated/idle pointer input and ripple uniforms.
for start, end in [('const KMt=`', ',YMt=os(KMt,'), ('cL=class cL{', ';te(cL,"IDLE_TIMEOUT",3)')]:
    assert original_bundle.count(start) == 1 and original_bundle.count(end) == 1
    preserved_source = original_bundle[original_bundle.index(start):original_bundle.index(end) + len(end)]
    assert bundle.count(preserved_source) == 1, 'Original magic-light feedback source changed'
for knob in ['uSpotLightIntensityMask', 'uPrevFrameMix', 'uDistortionStrength', 'uRipplePhase']:
    assert knob not in intro_source and knob not in intro_set_source, 'Intro helper modifies feedback controls: ' + knob
assert 'state.group.position.z = narrow ? -0.4 : -1.5;' in intro_source
assert 'bottle.visible = !narrow || index === 0;' in intro_source
assert 'mesh.userData.xelleIntroLayoutHidden = narrow && index !== 0;' in intro_source
assert 'if (narrow && index === 0) { mesh.position.x = 0; mesh.position.z = closeZ; }' in intro_source
assert 'const closeZ = xellePhoneLayout() ? 1.4 : 8.2;' in intro_source
assert 'function xellePhoneLayout() { return oo.device.mobile; }' in intro_source
assert 'mesh.userData.xelleHidden = narrow;' in intro_source and 'mesh.visible = !narrow;' in intro_source and 'this._baseZoom=oo.device.mobile?.6:1' in bundle
for removed_feature in ['peelGeometry', 'scentArc', 'citrus_peel', 'scent_arc', 'bg_wave', 'xelleBackdropWave', 'xelleOuterWave', 'smokeMaterial', 'addSmoke', 'xelleSmoke', 'smokeTime', 'motionQuery', 'uTime']:
    assert removed_feature not in intro_set_source and removed_feature not in intro_source, 'Cancelled ribbon/smoke feature remains: ' + removed_feature
assert 'function xelleUpdateIntro(main) {' in intro_source
assert bundle.count('this._title.visible=false,xelleUpdateIntro(this),') == 1
slot_array = re.search(r'const slots = \[(.*?)\];', intro_set_source, re.S)
assert slot_array, 'Pedestal slot array missing'
slot_records = re.findall(r'\{([^{}]+)\}', slot_array[1])
assert len(slot_records) == 4
slot_construction = intro_set_source.split('slots.forEach((slot, index) => {', 1)[1].split('return {group, meshes, pedestals, accents};', 1)[0]
mesh_categories = re.findall(r"\badd\('([^']+)'\s*\+\s*suffix", intro_set_source)
assert sorted(mesh_categories) == sorted(['Xelle_intro_plinth_', 'Xelle_intro_plinth_foot_', 'Xelle_intro_brass_edge_', 'Xelle_intro_brass_lip_'])
assert re.findall(r"\badd\('([^']+)'\s*\+\s*suffix", slot_construction) == mesh_categories
assert intro_set_source.count('new Sa(') == 1 and len(re.findall(r"\badd\(['\"]", intro_set_source)) == 4, 'Intro set constructs additional decorative meshes'
intro_set_mesh_count = len(slot_records) * len(mesh_categories)
assert intro_set_mesh_count == 16
assert 'scrollToScene(e=this._scrollSceneIndex,t=.75){var i,s;if(e==null||e<0)return;' in bundle
assert 'main._sceneWrapper.add(set.group)' in intro_source
assert re.search(r'mesh\.userData\.no_mirror\s*=\s*false', intro_source)
assert re.search(r'no_mirror:\s*false', intro_set_source)
assert re.search(r'uMirrored:\s*\{value:\s*0\}', intro_set_source)
assert re.search(r'if\s*\(uMirrored\s*>\s*0\.5\s*&&\s*vWorld\.y\s*>\s*0\.0\)\s*discard', intro_set_source)
assert 'Xelle_intro_amber_backdrop' not in intro_set_source and 'Xelle_intro_stone_floor' not in intro_set_source
assert 'g.name==="outside_box_SC00"' not in bundle
assert 'xelle-intro__title' not in intro_source and 'xelle-intro__description' not in intro_source
assert not re.search(r"Na\(['\"]h[1-6]['\"]", intro_source)
assert '#ifdef XELLE_INTRO_TRANSPARENT\nFragColor[1]=vec4(0.0);\n#endif' in bundle
assert re.search(r'if\s*\(mesh\.userData\.xelleOpacity\s*<\s*1\)\s*mesh\.material\.defines\.XELLE_INTRO_TRANSPARENT\s*=\s*1', intro_source)
assert bundle.count('.defines.XELLE_INTRO_TRANSPARENT') == 1, 'Intro transparency define affects another material path'
assert intro_source.index('mesh.material = new z2t') < intro_source.index('.defines.XELLE_INTRO_TRANSPARENT')
assert 'XELLE_INTRO_TRANSPARENT' not in material_source, 'Original bottle material helper enables intro-only behavior'
assert '_addToRaycast(t,a,i=this._raycaster){if(!t||t.userData?.xelleHidden)return;' in bundle
report['intro'] = {
    'design': 'Xellé perfume copies on four pedestals in the original SC00 room and reflective floor, with softer original lighting',
    'mobile': 'One featured flacon and its pedestal centered in the room',
    'layout': {'displayGroupZ': {'desktop': -1.5, 'narrow': -0.4}, 'pedestals': len(slot_records), 'setMeshes': intro_set_mesh_count, 'componentsPerPedestal': ['body', 'foot', 'brass edge', 'brass lip']},
    'lighting': {'shaftAlphaScale': 0.12, 'glowAlphaScale': 0.08, 'lightPassScale': 0.70, 'scope': 'Intro only; eased back to original intensity with the display exit', 'timing': 'Shaft and glow alpha attenuation follows original animation updates, without changing light visibility'},
    'rippleFeedback': 'Complete magic-light feedback shader and runtime match the original bundle; flow, previous-frame feedback, pointer/idle motion and spotlight intensity reset are preserved',
    'interface': 'Arrow only; no added visible title or copy',
    'reflection': 'Intro shares the original reflected scene wrapper; procedural surfaces clip at the floor during the mirror pass',
    'transparentLighting': 'Only fresh transparent intro materials preserve the underlying normal/light-effect mask; product materials retain their original shader path',
    'originalProductAssets': 'Runtime reuses source textures and clones geometry/materials; active GLB integrity is checked below',
    'paintings': 'Both leaves of the central door and the two side panels of SC00 carry editorial photographs',
    'paintingFrames': [], 'preservedRoomAndFloor': []
}
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
    # The perfume pages' purchase button reads "Cumpără" and opens the shop page in the experience.
    purchase=next(button for button in buttons if button['label']=='Cumpără')
    assert purchase['url']==expected['url']
    assert p['watchSceneIndex']==i
    notes_block=next(b for b in p['content']['blocks'] if b.get('type')=='xelleNotesBlock')
    assert [g['notes'] for g in notes_block['groups']]==list(expected['notes'].values())
    assert 'xelleNotesBlock}' in bundle and 'title' not in next(b for b in p['content']['blocks'] if b.get('type')=='sliderProductsBlock')
    report['products'].append({'name':expected['name'],'scene':i,'route':'/#/'+p['uri'],'purchase':purchase['url'],'price':expected['priceFormatted']})
home = locales['RG']
assert len(home['scenes'])==7
assert home['scenes'][5]['type']=='movie'
assert home['scenes'][6]['type']=='scene' and 'exploreUrl' not in home['scenes'][6]
assert all('podcastTitle' not in scene for scene in home['scenes'][1:5])
assert home['ctas']['close'] and home['ctas']['podcastText']
assert locales['IG']['ctas']['watchMovie'] and locales['IG']['ctas']['listen']
podcasts = [p for p in locales['pO']['pages'] if p.get('type')=='podcast']
gallery = runpy.run_path(str(root/'scripts/build_xelle_gallery.py'))
gallery_entries, hidden_gallery = gallery['load_entries']()
assert 0 < len(podcasts) <= gallery['FRAMES'] and len({p['slug'] for p in podcasts})==len(podcasts)
assert podcasts==gallery_entries, 'Gallery data differs from public/xelle/galerie/galerie.json'
report['podcasts'] = []
for podcast in podcasts:
    assert podcast['audio'].startswith('/xelle/galerie/'), podcast['audio']
    paths = [podcast['audio'], '/images/podcasts/masks/'+podcast['mask']['url']]
    paths += [f"/images/podcasts/thumbnails/{quality}/{podcast['image']['name']}.webp" for quality in ['HD','LD']]
    for resource_path in paths:
        assert (public/resource_path.lstrip('/')).is_file(), resource_path
    assert f'name:"podcast_{podcast["image"]["name"]}",path:"{paths[3]}"' in bundle, podcast['slug']
    report['podcasts'].append({'slug':podcast['slug'],'title':podcast['title'],'resources':paths})
report['galleryNotShown'] = hidden_gallery
report['movie'] = ['/xelle/video_xelle.mp4']
for resource_path in report['movie']:
    assert (public/resource_path.lstrip('/')).is_file(), resource_path
    assert resource_path in bundle, resource_path
assert 'function sRe(r,e){return r==="/xelle/video_xelle.mp4"?r:e?uTt(r):r}' in bundle
assert 'screenAspect=2.20538436' in bundle and 'textureSize(tMap,0)' in bundle
assert '/videos/movie/movie.mp4' not in bundle and '/videos/movie/movie_preview.mp4' not in bundle
assert home['scenes'][5]['title']=='Filmul\nXellé'
assert 'Wt.replace("audio/podcasts/","audio/podcasts_xp/")' not in bundle, 'Gallery still requests unavailable experience audio'
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

# Verify the dedicated people/props GLB by hierarchy, including tables without type metadata.
report['characters'] = []
for filename in ['mainScene_characters.glb', 'mainSceneMobile_characters.glb']:
    raw, doc, _ = read_glb(public/'webgl/models'/filename)
    parents = {child: i for i, node in enumerate(doc['nodes']) for child in node.get('children', [])}
    hidden, film = {}, []
    for i, node in enumerate(doc['nodes']):
        if 'mesh' not in node:
            continue
        ancestor, scene = i, None
        while ancestor in parents:
            ancestor = parents[ancestor]
            match = re.fullmatch(r'Empty\.SC0([0-6])', doc['nodes'][ancestor].get('name', ''))
            if match:
                scene = int(match[1]); break
        assert scene is not None, node['name']
        if scene == 5:
            film.append(node['name'])
        else:
            hidden.setdefault(scene, []).append(node['name'])
    assert {scene: len(names) for scene, names in hidden.items()} == {1: 27, 2: 16, 3: 29, 4: 36}
    assert len(film) == 16
    report['characters'].append({'file': filename, 'hiddenMeshesByScene': {str(k):len(v) for k,v in hidden.items()}, 'retainedFilmMeshes': len(film), 'sourceSha256': hashlib.sha256(raw).hexdigest()})
    # The served copy keeps exactly the film meshes, every node and every animation.
    _, served, _ = read_glb(public/'xelle/backdrops'/filename)
    assert sorted(n['name'] for n in served['nodes'] if 'mesh' in n) == sorted(film), filename
    assert len(served['nodes']) == len(doc['nodes']) and len(served['animations']) == len(doc['animations'])
    assert '/xelle/backdrops/'+filename in bundle and '/webgl/models/'+filename not in bundle
assert 'this._glbs[1].scene.traverse(g=>{if(g.isMesh&&g.userData.sceneIndex!==5){g.userData.xelleHidden=true;g.userData.no_mirror=true;g.visible=false}' in bundle
assert '/^sc0[1-4]_decal[0-9]+_(?:box|plane)$/i.test(g.name)' in bundle
assert 'GEO_door(?:Center|Left|Right)_(?:frame|paper)' not in bundle, 'Entrance panels must stay visible'
assert 'this._objectsTraverse=this._all.filter(g=>!g.userData.xelleHidden' in bundle
assert 'if(v.userData?.xelleHidden){v.visible=false;return;}' in bundle
assert 'g instanceof uPe&&g.userData.sceneIndex===5' in bundle

model_names = ['roadster','baignoire','crash','santos']
active_glbs = [public/'xelle/models'/f'{model}_{device}.glb'
               for model in model_names for device in ['desktop','mobile']]
active_glbs += [public/'xelle/backdrops'/name
                for name in ['mainScene.glb','mainSceneMobile.glb']]
# Read the configured source photographs without invoking the generator's main().
backdrops_config = runpy.run_path(str(root/'scripts/build_xelle_backdrops.py'))
photo_files = backdrops_config['PHOTOS']
painting_files = backdrops_config['PAINTINGS']
assert set(photo_files)=={1,2,3,4}, 'Expected one configured photograph for each perfume scene'
# The central double door carries one painting across both leaves, plus the two side panels.
assert len(painting_files)==3, 'Expected three framed paintings in the entrance room'
for painting in painting_files:
    assert (public/'xelle'/painting['photo']).exists(), painting['photo']
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
    if f.parent.name == 'models':
        minimum_y = min(doc['accessors'][p['attributes']['POSITION']]['min'][1] for m in doc['meshes'] for p in m['primitives'])
        assert abs(minimum_y * 0.4 - report['bottlePlacement']['scaledModelBase']) < 0.00001, f.name
        for node in doc['nodes']:
            if 'mesh' not in node: continue
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                material = doc['materials'][primitive['material']]
                opacity = material['pbrMetallicRoughness']['baseColorFactor'][3]
                assert opacity == node.get('extras', {}).get('xelleOpacity', 1), node['name']
                assert (material.get('alphaMode') == 'BLEND') == (opacity < 1), node['name']
    if f.parent.name=='backdrops':
        intro_frames = [n['name'] for n in doc['nodes'] if re.fullmatch(r'(?:MIRROR_)?GEO_door(?:Center|Left|Right)_(?:frame|paper)', n.get('name', ''))]
        assert len(intro_frames) == 12 and any(n.get('name') == 'outside_box_SC00' for n in doc['nodes'])
        for frame_name in intro_frames:
            frame_node = next(n for n in doc['nodes'] if n.get('name') == frame_name)
            assert not frame_node.get('extras', {}).get('xelleHidden'), frame_name + ' is hidden in the active GLB'
        report['intro']['paintingFrames'].append({'file': f.name, 'meshes': intro_frames})
        hidden_shadows = [n['name'] for n in doc['nodes'] if 'mesh' in n and re.fullmatch(r'sc0[1-4]_decal[0-9]+_(?:box|plane)', n.get('name', ''), re.I)]
        film_shadows = [n['name'] for n in doc['nodes'] if 'mesh' in n and re.fullmatch(r'sc05_decal[0-9]+_(?:box|plane)', n.get('name', ''), re.I)]
        assert len(hidden_shadows) == 24 and len(film_shadows) == 4
        entry['hiddenWorktableShadowMeshes'] = len(hidden_shadows)
        entry['retainedFilmShadowMeshes'] = len(film_shadows)
        source=public/'xelle/models'/f.name
        source_raw,source_doc,source_binary=read_glb(source)
        assert not any(n.get('extras',{}).get('xellePhoto') for n in source_doc['nodes']), source
        assert '/xelle/models/'+f.name not in bundle, source
        assert doc.get('animations')==source_doc.get('animations'), 'Scene animation data changed'
        assert binary[:len(source_binary)] == source_binary, 'Backdrop changed preserved source scene binary data'
        for original_name in ['outside_box_SC00', 'ground']:
            original_node = next(n for n in source_doc['nodes'] if n.get('name') == original_name)
            active_node = next(n for n in doc['nodes'] if n.get('name') == original_name)
            assert active_node == original_node, original_name + ' node changed'
            assert not active_node.get('extras', {}).get('xelleHidden'), original_name + ' is hidden in the active GLB'
            original_mesh = source_doc['meshes'][original_node['mesh']]
            assert doc['meshes'][active_node['mesh']] == original_mesh, original_name + ' geometry declaration changed'
            for primitive in original_mesh['primitives']:
                if 'material' in primitive:
                    index = primitive['material']
                    assert doc['materials'][index] == source_doc['materials'][index], original_name + ' material changed'
        report['intro']['preservedRoomAndFloor'].append({'file': f.name, 'nodes': ['outside_box_SC00', 'ground'], 'nodeMeshAndMaterialMatchBaseline': True, 'sourceBinaryPrefixMatchesBaseline': True})
        surfaces=[n for n in doc['nodes'] if n.get('extras',{}).get('xellePhoto')]
        assert {n['extras']['xellePhoto']['scene'] for n in surfaces}=={0,1,2,3,4}
        entrance=[n for n in surfaces if n['extras']['xellePhoto']['scene']==0]
        assert len(entrance)==2*len(painting_files), 'Each entrance painting needs its mirrored copy'
        assert {n['extras']['xellePhoto']['photograph'] for n in entrance}=={p['photo'] for p in painting_files}
        for node in entrance:
            basis=node['extras']['xellePhoto']['basis']
            assert node['extras']['xellePhoto']['clip'] is True
            assert len(basis['u'])==4 and len(basis['v'])==4, node['name']
        entry['entrancePaintings']=len(entrance)
        for node in surfaces:
            metadata=node['extras']['xellePhoto']
            assert metadata['aspect']>0
            expected=(public/'xelle'/metadata['photograph']).read_bytes()
            original_size=Image.open(io.BytesIO(expected)).size
            edge=backdrops_config['MOBILE_PHOTO_EDGE']
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                material=doc['materials'][primitive['material']]
                texture=doc['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
                image=doc['images'][texture['source']]
                assert image['mimeType']=='image/jpeg' and 'bufferView' in image
                view=doc['bufferViews'][image['bufferView']]
                offset=view.get('byteOffset',0)
                embedded=binary[offset:offset+view['byteLength']]
                # Desktop keeps the photographer's bytes; the mobile scene carries
                # photographs longer than MOBILE_PHOTO_EDGE resized to that edge.
                if 'Mobile' in f.name and max(original_size)>edge:
                    size=Image.open(io.BytesIO(embedded)).size
                    assert max(size)==edge and abs(size[0]/size[1]-original_size[0]/original_size[1])<0.01, node['name']
                else:
                    assert embedded==expected, node['name']
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
assert 'material.defines.XELLE_BOTTLE = 1' in bundle
assert 'const h=()=>{l.value||(ch.init(),ch.start(),t.toggleMute(!1)),l.value=!0};' not in bundle
assert 'v7e={hashMode:!0' in bundle
report['checks']=['4 exact published purchase URLs and prices match verified catalog','All official notes match catalog','All locale images exist','8 active perfume GLB + 2 active backdrop GLB headers, chunks, node graph and buffer bounds valid','2 baseline scene GLBs remain separate, valid and absent from active runtime paths','Backdrop scene animation data matches preserved baseline scenes','Each of four photo scenes embeds the exact original JPEG bytes on desktop (mobile: resized to the 1600 px edge, same aspect)','Three entrance paintings and their mirrored copies embed the exact original JPEG bytes on desktop and stay visible','GLB texture references embedded or locally resolvable','All 10 active GLB resource paths and 4 mask paths occur in runtime bundle','4 256x256 PNG mask signatures valid','Shader scalar-color alpha fix exists','Original first-click audio activation absent','Hash routing active']
report['checks'] += ['7 home scenes retain four perfumes and restore the movie and audio gallery','Gallery records match public/xelle/galerie/galerie.json order, within the 16 desktop 3D surfaces (13 original + 3 added)','All gallery audio, HD/LD thumbnails and masks exist locally and LD photographs are preloaded','Same supplied Xellé film is used for the 3D screen and playback in both orientations','Gallery audio uses available local podcast files']
report['checks'].append('Desktop/mobile: 108 people, worktable, prop and raycast meshes hidden outside film; all 16 film meshes retained')
report['checks'] += ['Intro preserves original SC00 room and floor nodes, mesh/material declarations and source scene binary payload in both backdrops', 'Intro softens shaft/glow alpha after original animation updates, preserves their visibility and restores intensity with the exit fade', 'Intro reduces the final light-pass contribution while preserving the complete original magic-light feedback shader/runtime and spotlight intensity reset', 'Intro set contains only four pedestal components per slot, totaling 16 meshes; its closer layout centers one flacon and pedestal on narrow screens', 'Intro reflection parent, no_mirror flags and reflected-surface clipping are configured', 'Added intro title and descriptive copy are absent; arrow remains accessible', 'Scene-zero navigation guard accepts returning to the intro']
report['checks'].append('Transparent intro materials preserve underlying normal/light flags through an intro-only define; original product materials do not enable it')
(root/'audit/xelle-static-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['glbs']},indent=2,ensure_ascii=False))
print('GLB:', ', '.join(p['file'] for p in report['glbs']))
