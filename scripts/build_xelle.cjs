/* Reproducible customization of the preserved compiled experience. */
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('internal/deps/acorn/acorn/dist/acorn');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
let source = read('original/app.js');
const ast = acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
const locales = JSON.parse(read('audit/xelle-locales.json'));
const replacements = [];
for (const statement of ast.body) {
  if (statement.type !== 'VariableDeclaration') continue;
  for (const declaration of statement.declarations) {
    const value = locales[declaration.id.name];
    if (value) replacements.push({start:declaration.init.start,end:declaration.init.end,value:`({en_fr:()=>(${JSON.stringify(value)})})`});
  }
}
if (replacements.length !== 7) throw new Error('Expected all seven content tables');
for (const edit of replacements.sort((a,b)=>b.start-a.start)) source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
const patches=[];
function once(before,after,label) {
  if (!source.includes(before) || source.indexOf(before)!==source.lastIndexOf(before)) throw new Error('Patch is not unique: '+label);
  source=source.replace(before,after); patches.push(label);
}
once('https://unpkg.com/detect-gpu@5.0.70/dist/benchmarks','/benchmarks','Local GPU database');
for (const model of ['roadster','baignoire','crash','santos']) {
  for (const device of ['desktop','mobile']) once(`/webgl/models/watches/${model}_${device}.glb`,`/xelle/models/${model}_${device}.glb`,`${model} ${device} bottle`);
  once(`/webgl/textures/masks/shape-${model}_msdf.png`,`/xelle/masks/shape-${model}_msdf.png`,`${model} bottle silhouette`);
}
once('g=u||h?.6:.9;super','g=0;super','Neutral bottle color');
once('pos.xy*=mix(4.0,0.0,uTransition);','pos.xy*=mix(6.0,0.0,uTransition);','Cover portrait corners during bottle mask transition');
const shaderAst=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
const shader=shaderAst.body.filter(s=>s.type==='VariableDeclaration').flatMap(s=>s.declarations).find(d=>d.id.name==='OLt').init;
const shaderText=source.slice(shader.start,shader.end);
const fixedShader=shaderText.replace('#ifdef USE_COLOR\nalbedo.xyz=uColor;\n#endif','#ifdef USE_COLOR\nalbedo.xyz=uColor;\n#ifdef XELLE_BOTTLE\nalbedo.a=1.0;\n#endif\n#endif');
if(shaderText===fixedShader) throw new Error('Glass shader alpha patch missing');
source=source.slice(0,shader.start)+fixedShader+source.slice(shader.end); patches.push('Untextured glass alpha');
once('/webgl/models/mainScene.glb','/xelle/backdrops/mainScene.glb','Xellé photo walls desktop');
once('/webgl/models/mainSceneMobile.glb','/xelle/backdrops/mainSceneMobile.glb','Xellé photo walls mobile');
once('const uW=class uW extends ILt', read('scripts/xelle-wall-material.js')+'\nconst uW=class uW extends ILt','Photo wall material');
once('super({materialsConfig:[{match:"floor",Class:SPe}',
  'super({materialsConfig:[{match:(m,objects)=>objects.some(o=>!!o.userData.xellePhoto),Class:XelleWallPhotoMaterial},{match:"floor",Class:SPe}','Select photo wall material');
once('objectsHandlers:[{match:/MT_cloud/i,callback:',
  'objectsHandlers:[{match:o=>!!o.userData.xelleHidden,callback:o=>{o.visible=!1}},{match:/MT_cloud/i,callback:','Hide replaced landscape geometry');
once('this._meshes.forEach(v=>{var _,I,z,B;if(!!!((_=v.userData)!=null&&_.stencil_by))return;',
  'this._meshes.forEach(v=>{var _,I,z,B;if(v.userData?.xelleHidden){v.visible=false;return;}if(!!!((_=v.userData)!=null&&_.stencil_by))return;','Keep replaced scenery hidden during animation');
once('this._lettersLines[i].push(s)})}show(){const t=ja.timeline();',
  'this._lettersLines[i].push(s)}),this.resize()}resize(){const f=wi.innerWidth<768?Math.min(1,(wi.innerWidth/wi.innerHeight)/(.75*(oo.device.mobile?.6:1))):1;this._wrapper.scale.setScalar(f);this._wrapper.position.y=3.35*(1-f)}show(){const t=ja.timeline();','Responsive 3D wordmark');
once('a.material=new z2t(this._config.model,{material:o,object:a,isTransparent:l,lut:s}),a.userData.watch_mode=2',
  'a.material=new z2t(this._config.model,{material:o,object:a,isTransparent:l,lut:s,opacity:o.opacity}),a.material.defines.XELLE_BOTTLE=1,a.userData.xelleOpacity!=null&&(a.material.alpha=a.userData.xelleOpacity,a.material.depthWrite=false),a.userData.watch_mode=2','Glass transparency');
once('getSceneScrollTarget(e){if(!this._theatreProject)', 'getSceneScrollTarget(e){e=Og(e,0,4);if(!this._theatreProject)','Four perfume destinations');
const methodStart=source.indexOf('tweenToSceneShortest(e,t=2.6){');
const methodEnd=source.indexOf('show(){this._showDebug()}',methodStart);
if(methodStart<0||methodEnd<0) throw new Error('Camera navigation method missing');
source=source.slice(0,methodStart)+'tweenToSceneShortest(e,t=2.6){return this.scrollToScene(Og(e,0,4),t)}'+source.slice(methodEnd);
once('update({delta:e}){var b,v,P,S,E,_;if(!this._action||!this._mixer)return;',
  'update({delta:e}){var b,v,P,S,E,_;if(!this._action||!this._mixer)return;const xelleEnd=this.getSceneScrollTarget(4);if(xelleEnd>0){this._canLoop=false;this._scrollTarget=Og(this._scrollTarget,0,xelleEnd);this._scrollY=Og(this._scrollY,0,xelleEnd)}','End journey after fourth perfume');
once('b=this._scenesPosition[p]||b),this._loopIndex>0&&p===0||p===7',
  'b=this._scenesPosition[p]||b),p=Math.min(p,4),b=this._scenesPosition[p]||b,this._loopIndex>0&&p===0||p===7','Clamp scene snap');
once('"aria-label":"Cartier — accueil"','"aria-label":"Xellé — acasă"','Accessible brand name');
once('this._uiStore.isFirstRoute&&this.scrollCamera.snapScrollToScene()', '(this.scrollCamera.enable(),this.scrollCamera.snapScrollToScene(t))','Synchronize product camera on every route');
once('S.visible=this._currentScene===E+1','S.visible=(this._webglStore.currentWatch.id??this._currentScene)===E+1','Synchronize bottle on product crosslinks');
once('async _onClick(t){var p,b;if(!this.over)return;','async _onClick(t){var p,b;if(!this.over||t.defaultPrevented||Ps().currentWatch.id!=null||t.target instanceof Element&&t.target.closest("a,button"))return;','Limit scene click navigation to home');
once('const h=()=>{l.value||(ch.init(),ch.start(),t.toggleMute(!1)),l.value=!0};','const h=()=>{l.value=!0};','Remove original audio activation');
once('GCt=ui({__name:"CartierIcon",props:{size:{default:"m"}},setup(r){return(e,t)=>(sa(),Qa("svg",{class:zr(["cartierIcon",`cartierIcon--${e.size}`]),viewBox:"0 0 110 31",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",focusable:"false"},VCt,2))}})',
  'GCt=ui({__name:"XelleIcon",props:{size:{default:"m"}},setup(r){return(e,t)=>(sa(),Qa("img",{class:zr(["cartierIcon",`cartierIcon--${e.size}`,"xelleIcon"]),src:"/xelle/xelle-wordmark.png",alt:"Xellé",draggable:"false"},null,2))}})','Original Xellé wordmark');
once('v=[{name:"tank",src:a+"/images/shapes/shape-tank.png"},{name:"santos",src:a+"/images/shapes/shape-santos.png"},{name:"roadster",src:a+"/images/shapes/shape-roadster.png"},{name:"myst",src:a+"/images/shapes/shape-myst.png"},{name:"crash",src:a+"/images/shapes/shape-crash.png"},{name:"baignoire",src:a+"/images/shapes/shape-baignoire.png"}]',
  'v=[{name:"xelle",src:a+"/xelle/xelle-wordmark.png"}]','Xellé loader');
once('u=fa(()=>{var b;return((b=t.ctas)==null?void 0:b.soundBttn)||"Sound"})','u=fa(()=>"")','Disable sound button');
once('function Lt(){zl(),l.setPodcastMode(!l.podcastMode.active)}','function Lt(){}','Disable podcast shortcut');
once('function R(Q){var me;const ue=(me=Q.url)==null?void 0:me.trim();if(ue)return TJ(ue,{external:a(ue),open:{target:"_blank",windowFeatures:{noopener:!0,noreferrer:!0}}})}',
  'function R(Q){var me;const ue=(me=Q.url)==null?void 0:me.trim();if(ue)return a(ue)?TJ(ue,{external:!0,open:{target:"_blank",windowFeatures:{noopener:!0,noreferrer:!0}}}):TJ(ue)}','Local collection navigation');
once('ariaLabel:{default:"Scroll to first section"}','ariaLabel:{default:"Descoperă primul parfum"}','Romanian scroll label');
fs.writeFileSync(path.join(root,'public/assets/xelle-app.js'),source);
fs.writeFileSync(path.join(root,'audit/xelle-build.json'),JSON.stringify({builtAt:new Date().toISOString(),source:'original/app.js',contentTables:replacements.length,patches},null,2));
console.log(`Xellé bundle ready: ${patches.length} guarded runtime patches and ${replacements.length} content tables.`);
