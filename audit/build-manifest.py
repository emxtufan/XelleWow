import pathlib,re,json,collections
root=pathlib.Path(r'F:\Cartier')
audit=root/'audit'
all_literals=json.loads((audit/'parsed-assets.json').read_text(encoding='utf-8'))
data=json.loads((audit/'en_fr-data.json').read_text(encoding='utf-8'))
css=(root/'original/app.css').read_text(encoding='utf-8')
inventory=json.loads((root/'original/browser-inventory.json').read_text(encoding='utf-8'))
base='https://websitefactory.cartier.com/akamai-storage/videos/ww26/'
sources=collections.defaultdict(set)
def add(path,source):
 path=path.removeprefix(base).lstrip('/')
 if path and not path.endswith('/') and '${' not in path:sources[path].add(source)
for path in all_literals:
 if re.match(r'^/(?:audio|images|videos|webgl)/',path):add(path,'literal in app.js')
 # VideoBlock and VideoPopupBlock call sRe/uTt for portrait orientation.
 # The fixed movie preview texture is not passed through that resolver.
 if path.startswith('/videos/') and path.endswith('.mp4') and not path.endswith('/movie_preview.mp4'):
  add(path[:-4]+'Vertical.mp4','portrait video suffix resolver uTt/sRe')
for path in re.findall(r'url\(\./([^\)]+)\)',css):add('assets/'+path,'app.css font')
for kind,names in [('draco',['draco_decoder.js','draco_decoder.wasm','draco_wasm_wrapper.js']),('basis',['basis_transcoder.js','basis_transcoder.wasm'])]:
 for name in names:add('webgl/libs/'+kind+'/'+name,'loader concatenation')
for podcast in data['global']['podcasts']:
 for size in ['LD','HD']:add('images/podcasts/thumbnails/'+size+'/'+podcast['image']['name']+'.webp','podcast thumbnail concatenation')
 add('images/podcasts/masks/'+podcast['mask']['url'],'podcast mask concatenation')
sizes=['0.05','0.1','0.2','0.4','0.6','0.8','1.0']
for path in all_literals:
 m=re.match(r'^/images/productPages/([^/]+)/([^/]+)\.webp$',path,re.I)
 if m:
  group,name=m.groups();group=group.lower();group={'roadster':'roaster'}.get(group,group)
  for size in sizes:add(f'images/productPages/{group}/{size}/{name}.webp','responsive product image concatenation')
for asset in inventory['assets']:
 if asset['url'].startswith(base):add(asset['url'],'observed browser request')
for path in ['assets/app.js','assets/app.css']:add(path,'entrypoint')
paths=sorted(sources)
(audit/'asset-paths.json').write_text(json.dumps(paths,indent=2),encoding='utf-8')
(audit/'asset-path-sources.json').write_text(json.dumps({p:sorted(sources[p]) for p in paths},indent=2),encoding='utf-8')
enfr_literals=set(re.findall(r'/(?:audio|images|videos|webgl)/[^"\s]+\.(?:webp|png|jpg|mp3|mp4)',json.dumps(data)))
all_locale_paths=set(path for path in all_literals if path.startswith('/images/productPages/'))
extras=all_locale_paths-enfr_literals
(audit/'other-locale-literals.json').write_text(json.dumps(sorted(extras),indent=2),encoding='utf-8')
print(json.dumps({'totalPaths':len(paths),'byDirectory':dict(collections.Counter(p.split('/')[0] for p in paths)),'otherLocaleOnly':sorted(extras)},indent=2))
