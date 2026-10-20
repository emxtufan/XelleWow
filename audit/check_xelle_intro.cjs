/* Focused intro runtime regression checks. Run after rebuilding:
 *   node audit/check_xelle_intro.cjs
 *
 * Uses the built bundle's render-pass and raycast methods with small scene
 * doubles. Exercises visibility/lifecycle integration; does not render pixels
 * or verify preserved GLB bytes (audit/check_xelle_static.py covers assets).
 */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert'),path=require('node:path');
const root=path.resolve(__dirname,'..')+path.sep;
class V{constructor(){this.x=0;this.y=0;this.z=0} set(x,y,z){Object.assign(this,{x,y,z})} setScalar(n){this.set(n,n,n)} fromArray(a){this.set(...a)} toArray(){return [this.x,this.y,this.z]}}
class Mesh{constructor(name){this.name=name;this.visible=true;this.position=new V;this.scale=new V;this.scale.setScalar(1);this.userData={xelleIntroSet:true,no_watch:true,xelleOriginalPosition:[1,2,3]};this.geometry={count:0,dispose(){this.count++}};this.material={count:0,uniforms:{uNarrow:{value:0},uAlpha:{value:1}},dispose(){this.count++}}}}
const source=fs.readFileSync(root+'public/assets/xelle-app.js','utf8');const intro=fs.readFileSync(root+'scripts/xelle-intro-scene.js','utf8');
const introSet=fs.readFileSync(root+'scripts/xelle-intro-set.js','utf8');
assert(source.includes(intro.trim()),'rebuild public/assets/xelle-app.js after changing the intro helper');
assert(source.includes(introSet.trim()),'rebuild public/assets/xelle-app.js after changing the intro set');
assert(intro.includes('main._sceneWrapper.add(set.group)'),'intro must share the original reflected scene wrapper');
assert(/mesh\.userData\.no_mirror\s*=\s*false/.test(intro),'bottle copies are excluded from the original mirror pass');
assert(/no_mirror:\s*false/.test(introSet),'procedural accents are excluded from the original mirror pass');
assert(/uMirrored:\s*\{value:\s*0\}/.test(introSet),'procedural mirror uniform is missing');
assert(/if\s*\(uMirrored\s*>\s*0\.5\s*&&\s*vWorld\.y\s*>\s*0\.0\)\s*discard/.test(introSet),'reflected accents must clip above the floor during exit');
assert(!introSet.includes('Xelle_intro_amber_backdrop')&&!introSet.includes('Xelle_intro_stone_floor'),'custom surfaces must not cover the original room/floor');
for(const removed of ['peelGeometry','scentArc','smokeMaterial','addSmoke','xelleBackdropWave','xelleOuterWave','smokeTime','motionQuery']){
  assert(!introSet.includes(removed)&&!intro.includes(removed),'removed intro ribbon/smoke behavior remains: '+removed);
}
for(const removedMesh of ['Xelle_intro_bg_wave_','Xelle_intro_citrus_peel_','Xelle_intro_scent_arc_']){
  assert(!source.includes(removedMesh),'removed ribbon or smoke construction remains in the runtime');
}
assert(!source.includes('xellePrepareIntroRender')&&!intro.includes('suppressedLights'),'original intro lights must not be suppressed');
assert(!source.includes('g.name==="outside_box_SC00"'),'original SC00 room must not be hidden');
const introTransparencyBranch='#ifdef XELLE_INTRO_TRANSPARENT\nFragColor[1]=vec4(0.0);\n#endif';
assert(source.includes(introTransparencyBranch),'transparent intro surfaces must preserve the original light-effect mask');
assert(/if\s*\(mesh\.userData\.xelleOpacity\s*<\s*1\)\s*mesh\.material\.defines\.XELLE_INTRO_TRANSPARENT\s*=\s*1/.test(intro),'light-mask preservation must apply only to transparent intro copies');
assert.strictEqual((source.match(/\.defines\.XELLE_INTRO_TRANSPARENT/g)||[]).length,1,'intro transparency define escaped into another material path');
assert(intro.indexOf('mesh.material = new z2t')<intro.indexOf('.defines.XELLE_INTRO_TRANSPARENT'),'intro flag must be set on the new material, not its source');
assert(source.includes('this._envParticles.update(t),super.update(t),xelleApplyIntroLighting(this),xelleDrawLabels(this,t)}updateFromViewRenderer'),'intro lighting (then the label print) must be applied after the final original mesh/material updates');
assert.strictEqual((source.match(/xelleApplyIntroLighting\(this\)/g)||[]).length,1,'intro attenuation must run once after each original update');
assert(source.includes('t.lightPass.dark=1-(1-this._loopSceneHack.value)*xelleIntroLightScale(this,.70)}'),'intro backlight must retain the original loop dark value outside its scope');
assert(source.includes('t.magicLight.uniforms.uSpotLightIntensityMask.value=1-this._loopSceneHack.value'),'original spotlight feedback mask has changed');
assert(!intro.includes('uSpotLightIntensityMask'),'intro tuning must not attenuate the feedback mask');
const originalSource=fs.readFileSync(root+'original/app.js','utf8');
const feedbackStart=originalSource.indexOf('KMt=`'),feedbackEnd=originalSource.indexOf('`,YMt=os(KMt,',feedbackStart);
assert(feedbackStart>=0&&feedbackEnd>feedbackStart);
assert(source.includes(originalSource.slice(feedbackStart,feedbackEnd+1)),'original moving-light feedback shader has changed');
const start=source.indexOf('setWatchRender(t=!1,a=1){'),end=source.indexOf('togglePodcastDark(t)',start);
assert(start>=0&&end>start);const pass=source.slice(start,end).replace('setWatchRender(t=!1,a=1){','function setWatchRender(t=!1,a=1){');
assert(!pass.includes('xellePrepareIntroRender'),'watch-pass switching must not suppress the original lights');
const rayStart=source.indexOf('_addToRaycast(t,a,i=this._raycaster){'),rayEnd=source.indexOf('_onIntersectFluidPlanes(t,a)',rayStart);
assert(rayStart>=0&&rayEnd>rayStart);const raycast=source.slice(rayStart,rayEnd).replace('_addToRaycast(t,a,i=this._raycaster){','function _addToRaycast(t,a,i=this._raycaster){');
assert(raycast.includes('if(!t||t.userData?.xelleHidden)return;'),'compiled bundle lacks hidden raycast guard');
const viewStart=source.indexOf('updateFromViewRenderer(t,a){this._updateDecals(t)'),viewEnd=source.indexOf('_updateDecals(t){',viewStart);
assert(viewStart>=0&&viewEnd>viewStart);
const viewUpdate=source.slice(viewStart,viewEnd).replace('updateFromViewRenderer(t,a){','function updateFromViewRenderer(t,a){');
// Helpers from other Xellé modules the intro calls each frame; their own behaviour is checked elsewhere.
const c={Sa:Mesh,Na:(type,props,children)=>({type,props,children}),wi:{innerWidth:1440,innerHeight:900},Yr:{config:{currentScene:{in:0,out:-1},magicLight:{revealLightPhase:.17}}},Set,Map,Math,Number,
  xelleSyncSectionLink(){},xelleRegisterLabels(){},oo:{device:{mobile:false}},no:()=>({mainLoader:{progressComplete:false}}),performance,document:{querySelector:()=>null,hidden:false}};vm.createContext(c);vm.runInContext(intro+'\n'+pass+'\n'+raycast+'\n'+viewUpdate,c);
const interfaceTree=c.xelleIntroInterface();
const interfaceNodes=[];const interfaceText=[];
function inspectInterface(node){if(typeof node==='string'){interfaceText.push(node);return}if(!node)return;if(Array.isArray(node)){node.forEach(inspectInterface);return}interfaceNodes.push(node);inspectInterface(node.children)}
inspectInterface(interfaceTree);
assert.deepStrictEqual(interfaceText,['↓'],'intro must display only its arrow, without added title or copy');
assert.strictEqual(interfaceNodes.filter(node=>node.type==='button').length,1);
assert(interfaceNodes.find(node=>node.type==='button').props['aria-label'],'arrow must retain an accessible label');
const displayMeshes=['plinth','plinth_foot','brass_edge','brass_lip'].flatMap(kind=>[1,2,3,4].map(index=>new Mesh('Xelle_intro_'+kind+'_0'+index)));
const meshes=[...displayMeshes];
const bottles=[0,1,2,3].map(i=>({visible:true,scale:new V,position:new V,rotation:new V,children:[new Mesh('bottle'+i)]}));
for(const bottle of bottles){bottle.children[0].userData={no_watch:true};meshes.push(bottle.children[0])}
const lights=['shaft visible','shaft hidden','glow visible','glow hidden'].map((n,i)=>{const m=new Mesh(n);m.userData={no_mirror:true};m.visible=i%2===0;return m});
const originalLights=lights.map(m=>m.visible);
const group={visible:true,position:new V,removed:false,removeFromParent(){this.removed=true}};
const state={group,meshes,bottles,width:0,height:0};const main={_xelleIntro:state,_open:false,_loopMade:false,_scrollCamera:{_action:{time:0}},_objectsTraverse:[...meshes,...lights],_envParticles:{visible:true},_lightShafts:lights.slice(0,2),_glowSpheresComponent:{spheres:lights.slice(2)},_loopSceneHack:{value:0},_updateDecals(){},_updateGlowSpheresFromViewRenderer(){}};
let passCycles=0;
function runPasses(){const lightsBefore=lights.map(m=>m.visible);c.setWatchRender.call(main,false);assert.deepStrictEqual(lights.map(m=>m.visible),lightsBefore,'main intro pass changed original lighting visibility');const before=meshes.map(m=>m.visible);c.setWatchRender.call(main,true,1);assert(meshes.every(m=>!m.visible),'intro leaked into watch pass 1');assert(lights.every(m=>!m.visible));c.setWatchRender.call(main,true,2);assert(meshes.every(m=>!m.visible),'intro leaked into watch pass 2');assert(lights.every(m=>!m.visible));c.setWatchRender.call(main,false);assert.deepStrictEqual(meshes.map(m=>m.visible),before);assert.deepStrictEqual(lights.map(m=>m.visible),lightsBefore,'watch passes did not preserve original light states');passCycles++}
function setState(w,h,time,sceneIn,sceneOut,open=false){Object.assign(c.wi,{innerWidth:w,innerHeight:h});Object.assign(c.Yr.config.currentScene,{in:sceneIn,out:sceneOut});main._scrollCamera._action.time=time;main._open=open;const lightsBefore=lights.map(m=>m.visible);c.xelleUpdateIntro(main);assert.deepStrictEqual(lights.map(m=>m.visible),lightsBefore,'intro update changed original light states');runPasses()}
setState(1440,900,0,0,-1);assert(group.visible);assert(bottles.every(b=>b.visible));assert.strictEqual(group.position.z,-1.5);assert(displayMeshes.every(m=>m.visible));
lights.forEach(light=>{light.visible=!light.visible});setState(1440,900,0,0,-1);assert.deepStrictEqual(lights.map(m=>m.visible),originalLights.map(visible=>!visible),'intro overrides lighting animation changes');lights.forEach((light,index)=>{light.visible=originalLights[index]});
setState(390,844,0,0,-1);assert.deepStrictEqual(bottles.map(b=>b.visible),[true,false,false,false]);assert(displayMeshes.every(mesh=>mesh.visible===mesh.name.endsWith('_01')),'mobile must show only the first pedestal and its trim');assert.strictEqual(group.position.z,-.4);
meshes[1].prevVisible=true;setState(390,844,0,0,-1);assert(!meshes[1].visible,'stale flag resurrects hidden mobile plinth');
setState(390,844,0.8,1,0);assert(group.visible);assert(group.position.y<0);
setState(390,844,1.31,1,0);assert(!group.visible);
setState(390,844,0.8,1,0);assert(group.visible);
setState(390,844,0,0,-1);assert(group.visible);assert.strictEqual(group.position.y,-0);
setState(1440,900,0,0,-1);assert(bottles.every(b=>b.visible));assert(meshes.every(m=>m.visible));assert.strictEqual(group.position.z,-1.5);
setState(1440,900,0,0,-1,true);assert(!group.visible);
setState(1440,900,0,0,-1,false);assert(group.visible);
// Each original animation update refreshes opacity before the intro hook.
// Repeated frames must retain their requested factor instead of accumulating it.
let lightingFrames=0;
const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-12,message+': '+actual+' != '+expected);
function freshLightingFrame(expectedShaft,expectedGlow,expectedPost,base=[1,.7,.8,.4]){
  const visibleBefore=lights.map(m=>m.visible);
  lights.forEach((mesh,index)=>{mesh.material.uniforms.uAlpha.value=base[index]});
  c.xelleApplyIntroLighting(main);
  lights.forEach((mesh,index)=>close(mesh.material.uniforms.uAlpha.value,base[index]*(index<2?expectedShaft:expectedGlow),'incorrect per-frame intro attenuation'));
  assert.deepStrictEqual(lights.map(m=>m.visible),visibleBefore,'attenuation must retain original light visibility');
  for(const loopDark of [0,.4,1]){
    main._loopSceneHack.value=loopDark;
    const renderer={magicLight:{uniforms:{uRevealLightPhase:{value:0},uSpotLightIntensityMask:{value:-1}}},lightPass:{dark:-1}};
    c.updateFromViewRenderer.call(main,renderer,{});
    close(renderer.lightPass.dark,1-(1-loopDark)*expectedPost,'incorrect intro light-pass mix');
    close(renderer.magicLight.uniforms.uSpotLightIntensityMask.value,1-loopDark,'intro changed the original feedback mask');
  }
  main._loopSceneHack.value=0;lightingFrames++;
}
freshLightingFrame(.12,.08,.70);
freshLightingFrame(.12,.08,.70,[.25,.9,.6,.1]);
freshLightingFrame(.12,.08,.70);
main._scrollCamera._action.time=.12+1.15/2;c.Yr.config.currentScene.in=1;c.Yr.config.currentScene.out=0;
freshLightingFrame(.56,.54,.85);
main._scrollCamera._action.time=1.27;freshLightingFrame(1,1,1);
main._scrollCamera._action.time=1.30;freshLightingFrame(1,1,1);
for(let scene=1;scene<=6;scene++){
  main._scrollCamera._action.time=scene*4;c.Yr.config.currentScene.in=scene;c.Yr.config.currentScene.out=scene;
  freshLightingFrame(1,1,1);
}
// Isolate the scene predicate from the time cutoff, including string config
// values and an outgoing intro while the next scene is already current.
main._scrollCamera._action.time=0;c.Yr.config.currentScene.in=1;c.Yr.config.currentScene.out=1;
freshLightingFrame(1,1,1);
c.Yr.config.currentScene.out='0';freshLightingFrame(.12,.08,.70);
c.Yr.config.currentScene.in='0';c.Yr.config.currentScene.out=-1;freshLightingFrame(.12,.08,.70);
main._scrollCamera._action.time=0;c.Yr.config.currentScene.in=0;c.Yr.config.currentScene.out=-1;
main._open=true;freshLightingFrame(1,1,1);main._open=false;
main._loopMade=true;freshLightingFrame(1,1,1);main._loopMade=false;
freshLightingFrame(.12,.08,.70);
const foreign=new Mesh('foreign');main._objectsTraverse.push(foreign);c.xelleDestroyIntro(main);assert.strictEqual(main._xelleIntro,null);assert(group.removed);assert.deepStrictEqual(main._objectsTraverse,[...lights,foreign]);assert(meshes.every(m=>m.geometry.count===1&&m.material.count===1));assert.strictEqual(foreign.geometry.count,0);assert(lights.every(m=>m.geometry.count===0&&m.material.count===0));assert.deepStrictEqual(lights.map(m=>m.visible),originalLights,'destroy changed shared effects');c.xelleDestroyIntro(main);
const registrations=[];main._raycaster={addComponent(m){registrations.push(m)}};const hidden=new Mesh('old hidden door');hidden.userData.xelleHidden=true;const ordinary=new Mesh('ordinary');const callback=()=>{};c._addToRaycast.call(main,null);c._addToRaycast.call(main,hidden);c._addToRaycast.call(main,ordinary,callback);assert.deepStrictEqual(registrations,[ordinary]);assert.strictEqual(ordinary.raycastObject,ordinary);assert.strictEqual(ordinary.setRaycastIntersection,callback);const override=[];c._addToRaycast.call(main,foreign,null,{addComponent(m){override.push(m)}});assert.deepStrictEqual(override,[foreign]);assert.deepStrictEqual(registrations,[ordinary]);
// Scene zero is a valid navigation destination. Reuse the compiled camera
// method to catch a falsy-value guard that silently rejects the intro button.
const scrollStart=source.indexOf('scrollToScene(e=this._scrollSceneIndex,t=.75){');
const scrollEnd=source.indexOf('scrollToSection(e,t=1.2)',scrollStart);
assert(scrollStart>=0&&scrollEnd>scrollStart);
const scrollMethod=source.slice(scrollStart,scrollEnd).replace('scrollToScene(e=this._scrollSceneIndex,t=.75){','function scrollToScene(e=this._scrollSceneIndex,t=.75){');
const tweens=[];
c.ja={to(target,config){const tween={target,config};tweens.push(tween);return tween}};
vm.runInContext(scrollMethod,c);
function navigationFixture(){
  return {_scrollSceneIndex:2,_scrollY:500,_scrollTarget:500,computed:0,targets:[],
    computeScenesPosition(){this.computed++},
    getSceneScrollTarget(index){this.targets.push(index);return [0,123,456][index]}};
}
const returnCamera=navigationFixture();
c.scrollToScene.call(returnCamera,0,1.5);
assert.strictEqual(tweens.length,1,'scene zero did not start the return tween');
assert.strictEqual(tweens[0].target,returnCamera);
assert.strictEqual(tweens[0].config._scrollY,0);
assert.strictEqual(tweens[0].config._scrollTarget,0);
assert.strictEqual(tweens[0].config.duration,1.5);
assert.deepStrictEqual(returnCamera.targets,[0]);
assert.strictEqual(returnCamera.scrollSceneIndex,0);
assert.strictEqual(returnCamera._programmaticScrollActive,true);
tweens[0].config.onComplete();
assert.strictEqual(returnCamera._programmaticScrollActive,false);
assert.strictEqual(returnCamera._scrollToTl,null);
for(const invalid of [null,-1]){
  const rejectedCamera=navigationFixture();
  c.scrollToScene.call(rejectedCamera,invalid,1.5);
  assert.strictEqual(tweens.length,1,'invalid scene started a tween');
  assert.strictEqual(rejectedCamera.computed,0);
  assert.strictEqual(rejectedCamera._scrollY,500);
  assert.strictEqual(rejectedCamera._scrollTarget,500);
}
const perfumeCamera=navigationFixture();
c.scrollToScene.call(perfumeCamera,1,1.5);
assert.strictEqual(tweens.length,2,'normal perfume navigation stopped working');
assert.strictEqual(tweens[1].config._scrollY,123);
assert.strictEqual(tweens[1].config._scrollTarget,123);
assert.deepStrictEqual(perfumeCamera.targets,[1]);
console.log(JSON.stringify({passed:true,passCycles,lightingFrames,source:'compiled public/assets/xelle-app.js',scenarios:['desktop intro','mobile intro','stale prevVisible','exit','reverse exit','return to time zero','mobile to desktop','product open/close','closer responsive display placement','sixteen pedestal and trim meshes with first-slot mobile visibility','ribbon and smoke construction absent','original light visibility and animation changes preserved','fresh per-frame shaft and glow attenuation','lighting fade matches intro exit','full original lighting in scenes 1–6 and outside intro scope','lighting update hook follows original resets','original magic-light feedback shader and mask preserved','reflection parent and clipping invariants','intro-only transparent light-mask preservation','original room/floor uncovered','arrow-only intro interface','owned resource disposal','hidden scenery raycast rejection','preserved raycast callback and override','scene zero return tween','null/negative navigation rejected','normal perfume navigation preserved']},null,2));


