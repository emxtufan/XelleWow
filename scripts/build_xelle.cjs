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
  // ?flacon=test swaps in the converted test model (scripts/blender_import_test_bottle.py).
  for (const device of ['desktop','mobile']) once(`"/webgl/models/watches/${model}_${device}.glb"`,`(location.search.includes("flacon=test")?"/xelle/models/test/${model}_${device}.glb":"/xelle/models/${model}_${device}.glb")`,`${model} ${device} bottle`);
  once(`/webgl/textures/masks/shape-${model}_msdf.png`,`/xelle/masks/shape-${model}_msdf.png`,`${model} bottle silhouette`);
}
once('g=u||h?.6:.9;super','g=0;super','Neutral bottle color');
once('pos.xy*=mix(4.0,0.0,uTransition);','pos.xy*=mix(6.0,0.0,uTransition);','Cover portrait corners during bottle mask transition');
const shaderAst=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
const shader=shaderAst.body.filter(s=>s.type==='VariableDeclaration').flatMap(s=>s.declarations).find(d=>d.id.name==='OLt').init;
const shaderText=source.slice(shader.start,shader.end);
let fixedShader=shaderText.replace('#ifdef USE_COLOR\nalbedo.xyz=uColor;\n#endif','#ifdef USE_COLOR\nalbedo.xyz=uColor;\n#ifdef XELLE_BOTTLE\nalbedo.a=1.0;\n#endif\n#endif');
if(shaderText===fixedShader) throw new Error('Glass shader alpha patch missing');
function glassShaderOnce(before, after) {
  if (fixedShader.indexOf(before) < 0 || fixedShader.indexOf(before) !== fixedShader.lastIndexOf(before)) throw new Error('Glass lighting shader seam changed');
  fixedShader = fixedShader.replace(before, after);
}
glassShaderOnce('col=(kD*col*diffuse)+specular;', '\n'+read('scripts/xelle-bottle-glass.glsl').trim()+'\n');
glassShaderOnce('alpha*=uAlpha;', 'alpha*=uAlpha;\n#ifdef XELLE_GLASS\nalpha=mix(uAlpha,0.6,pow(xelleGlassEdge,1.5))*albedo.w;\n#endif\n');
glassShaderOnce('diffuse*=iblIntensity;', 'diffuse*=iblIntensity;\n'+read('scripts/xelle-bottle-studio.glsl').trim()+'\n');
glassShaderOnce('FragColor[1]=vec4(n*0.5+0.5,float(flags)/255.0);', 'FragColor[1]=vec4(n*0.5+0.5,float(flags)/255.0);\n#ifdef XELLE_INTRO_TRANSPARENT\nFragColor[1]=vec4(0.0);\n#endif\n');
source=source.slice(0,shader.start)+fixedShader+source.slice(shader.end); patches.push('Untextured glass alpha');
patches.push('Clear bottle glass lighting and edge thickness');
patches.push('Preserve the original backlight through transparent intro bottles');
once('/webgl/models/mainScene.glb','/xelle/backdrops/mainScene.glb','Xellé photo walls desktop');
once('/webgl/models/mainSceneMobile.glb','/xelle/backdrops/mainSceneMobile.glb','Xellé photo walls mobile');
once('/webgl/models/mainScene_characters.glb','/xelle/backdrops/mainScene_characters.glb','Film-only people and props desktop');
once('/webgl/models/mainSceneMobile_characters.glb','/xelle/backdrops/mainSceneMobile_characters.glb','Film-only people and props mobile');
once('const uW=class uW extends ILt', read('scripts/xelle-wall-material.js')+'\nconst uW=class uW extends ILt','Photo wall material');
once('const uW=class uW extends ILt', read('scripts/xelle-label-print.js')+'\n'+read('scripts/xelle-scroll.js')+'\n'+read('scripts/xelle-intro-set.js')+'\n'+read('scripts/xelle-intro-scene.js')+'\n'+read('scripts/xelle-sections.js')+'\n'+read('scripts/xelle-shop-queries.js')+'\n'+read('scripts/xelle-shop.js')+'\nconst uW=class uW extends ILt','Xellé olfactory bar intro');
once('super({materialsConfig:[{match:"floor",Class:SPe}',
  'super({materialsConfig:[{match:(m,objects)=>objects.some(o=>!!o.userData.xellePhoto),Class:XelleWallPhotoMaterial},{match:"floor",Class:SPe}','Select photo wall material');
once('objectsHandlers:[{match:/MT_cloud/i,callback:',
  'objectsHandlers:[{match:o=>!!o.userData.xelleHidden,callback:o=>{o.visible=!1}},{match:/MT_cloud/i,callback:','Hide replaced landscape geometry');
once('this._meshes.forEach(v=>{var _,I,z,B;if(!!!((_=v.userData)!=null&&_.stencil_by))return;',
  'this._meshes.forEach(v=>{var _,I,z,B;if(v.userData?.xelleHidden){v.visible=false;return;}if(!!!((_=v.userData)!=null&&_.stencil_by))return;','Keep replaced scenery hidden during animation');
// The second GLB contains people, worktables and props. Hide its meshes outside film,
// before their groups are moved into the main scene; leave architecture and bottles intact.
once('super.parse(t,!1),this._objectsTraverse=this._all.filter(g=>!(g instanceof sU)&&!g.name.match(/Bone/))',
  'super.parse(t,!1),this._glbs[1].scene.traverse(g=>{if(g.isMesh&&g.userData.sceneIndex!==5){g.userData.xelleHidden=true;g.userData.no_mirror=true;g.visible=false}}),this._meshes.forEach(g=>{if(/^sc0[1-4]_decal[0-9]+_(?:box|plane)$/i.test(g.name)){g.userData.xelleHidden=true;g.userData.no_mirror=true;g.visible=false}}),this._objectsTraverse=this._all.filter(g=>!g.userData.xelleHidden&&!(g instanceof sU)&&!g.name.match(/Bone/))','Keep people, worktables and props only in the film scene, including shadows and reflections');
once('this.add(this.glb.scene),this._charactersManager=new RLt(', 'this.add(this.glb.scene),xelleCreateIntro(this),this._charactersManager=new RLt(', 'Create intro after the product models are ready');
once('this._title.visible=a===0&&!this._loopMade,', 'this._title.visible=false,xelleUpdateIntro(this),', 'Replace old lettering and animate the intro exit');
once('this._envParticles.update(t),super.update(t)}updateFromViewRenderer', 'this._envParticles.update(t),super.update(t),xelleApplyIntroLighting(this),xelleDrawLabels(this,t)}updateFromViewRenderer', 'Soften intro shafts and glow after their animation updates');
once('t.lightPass.dark=this._loopSceneHack.value}', 't.lightPass.dark=1-(1-this._loopSceneHack.value)*xelleIntroLightScale(this,.70)}', 'Reduce intro backlight while retaining the original light ripple feedback');
once('this._vs=new _Mt({el:document.body,mouseMultiplier:1,touchMultiplier:30,firefoxMultiplier:15,', 'this._vs=new _Mt({el:document.body,mouseMultiplier:3,touchMultiplier:60,firefoxMultiplier:45,', 'Fewer wheel notches and swipes per stage');
once('z=Math.max(1.5,Math.min(6,z))', 'z=xelleMoveDuration(Math.max(.8,Math.min(3,z)))', 'Shorter snap between stages, so scrolling answers sooner (shortest with reduced motion)');
once('this._dragWrapper.rotation.x=this._dragRotation.x+this._tiltRotation.x*(1-u),this._dragWrapper.rotation.y=this._dragRotation.y+this._tiltRotation.y*(1-u)',
  'this._dragWrapper.rotation.x=this._dragRotation.x+this._tiltRotation.x*(1-u)*(xelleReducedMotion()?0:1),this._dragWrapper.rotation.y=this._dragRotation.y+this._tiltRotation.y*(1-u)*(xelleReducedMotion()?0:1)', 'No cursor tilt with reduced motion');
once('i1t={class:"headerBlock__slot headerBlock__slot--right"},s1t={', 'i1t={class:"headerBlock__slot headerBlock__slot--right"},xelleMenu='+read('scripts/xelle-menu.js').trim()+',xelleCartButton='+read('scripts/xelle-cart-button.js').trim()+',s1t={', 'Section menu and cart button components');
once('Na("div",i1t,[', 'Na("div",i1t,[rr(xelleCartButton,{hidden:g.value||h.value},null,8,["hidden"]),rr(xelleMenu,{hidden:g.value||h.value},null,8,["hidden"]),', 'Cart button and section menu in the header, hidden with the product close button');
once('_addToRaycast(t,a,i=this._raycaster){if(!t)return;', '_addToRaycast(t,a,i=this._raycaster){if(!t||t.userData?.xelleHidden)return;', 'Remove hidden scenery from pointer hit targets');
once('_destroyGlb(){var t,a,i,s,o,l,u,h,g,p;super._destroyGlb()', '_destroyGlb(){var t,a,i,s,o,l,u,h,g,p;xelleDestroyIntro(this);super._destroyGlb()', 'Dispose intro copies without touching product textures');
// The replaced element block opened a Vue block (sa()) that createElementBlock closed;
// the intro is a plain vnode, so the opener goes too or the block stack keeps
// every later vnode (and its DOM) alive.
once('sa(),Qa("div",tSt,[Na("div",{class:"homePage__baseline",innerHTML:Dt(Ae).baseline},null,8,aSt),rr(zxt,{onClick:mt})])', 'xelleIntroInterface()', 'Perfume-led intro copy and collection controls');
once('this._characters=this._meshes.filter(g=>g instanceof uPe),this._charactersRaycasts=this._meshes.filter(g=>g.name.match(/sc0[0-9]_raycast/i))',
  'this._characters=this._meshes.filter(g=>g instanceof uPe&&g.userData.sceneIndex===5),this._charactersRaycasts=this._meshes.filter(g=>g.userData.sceneIndex===5&&g.name.match(/sc0[0-9]_raycast/i))','Limit character animations and hover to the film scene');
once('this._lettersLines[i].push(s)})}show(){const t=ja.timeline();',
  'this._lettersLines[i].push(s)}),this.resize()}resize(){const f=wi.innerWidth<768?Math.min(1,(wi.innerWidth/wi.innerHeight)/(.75*(oo.device.mobile?.6:1))):1;this._wrapper.scale.setScalar(f);this._wrapper.position.y=3.35*(1-f)}show(){const t=ja.timeline();','Responsive 3D wordmark');
once('a.material=new z2t(this._config.model,{material:o,object:a,isTransparent:l,lut:s}),a.userData.watch_mode=2',
  'a.material=new z2t(this._config.model,{material:o,object:a,isTransparent:l,lut:s,opacity:o.opacity}),xelleConfigureBottleMaterial(a),a.userData.watch_mode=2','Glass transparency');
once('class U2t extends CRe', 'const XELLE_FLACON='+JSON.stringify((({bottle,label})=>({bottle,label:{radius:label.radius,angle:label.angle,top:label.top,bottom:label.bottom}}))(JSON.parse(read('scripts/xelle-products.json'))))+';\n'+read('scripts/xelle-bottle-material.js')+'\nclass U2t extends CRe','Bottle materials and transparent surface ordering');
once('getSceneScrollTarget(e){if(!this._theatreProject)', 'getSceneScrollTarget(e){e=Og(e,0,6);if(!this._theatreProject)','Four perfumes, film and audio gallery');
once('scrollToScene(e=this._scrollSceneIndex,t=.75){var i,s;if(!e)return;', 'scrollToScene(e=this._scrollSceneIndex,t=.75){var i,s;if(e==null||e<0)return;', 'Allow returning to the Xellé intro at scene zero');
const methodStart=source.indexOf('tweenToSceneShortest(e,t=2.6){');
const methodEnd=source.indexOf('show(){this._showDebug()}',methodStart);
if(methodStart<0||methodEnd<0) throw new Error('Camera navigation method missing');
source=source.slice(0,methodStart)+'tweenToSceneShortest(e,t=2.6){return this.scrollToScene(Og(e,0,6),t)}'+source.slice(methodEnd);
once('update({delta:e}){var b,v,P,S,E,_;if(!this._action||!this._mixer)return;',
  'update({delta:e}){var b,v,P,S,E,_;if(!this._action||!this._mixer)return;const xelleEnd=this.getSceneScrollTarget(6);if(xelleEnd>0){this._canLoop=false;this._scrollTarget=Og(this._scrollTarget,0,xelleEnd);this._scrollY=Og(this._scrollY,0,xelleEnd)}','End journey after audio gallery');
once('b=this._scenesPosition[p]||b),this._loopIndex>0&&p===0||p===7',
  'b=this._scenesPosition[p]||b),p=Math.min(p,6),b=this._scenesPosition[p]||b,this._loopIndex>0&&p===0||p===7','Clamp scene snap');
once('"aria-label":"Cartier — accueil"','"aria-label":"Xellé — acasă"','Accessible brand name');
once('this._uiStore.isFirstRoute&&this.scrollCamera.snapScrollToScene()', '(this.scrollCamera.enable(),this.scrollCamera.snapScrollToScene(t))','Synchronize product camera on every route');
once('S.visible=this._currentScene===E+1','S.visible=(this._webglStore.currentWatch.id??this._currentScene)===E+1','Synchronize bottle on product crosslinks');
once('class kPe extends CRe',read('scripts/xelle-bottle-placement.js')+'\nclass kPe extends CRe','Xellé bottle placement and soft shadow');
once('this._homeToProductTl.progress(1)}get hoverBox(){',
  'this._homeToProductTl.progress(1),xelleCreateBottleShadow(this)}destroy(){xelleDestroyBottleShadow(this);super.destroy()}get hoverBox(){','Create and dispose the bottle shadow');
once('p*=h,this._animWrapper.scale.setScalar(p);const b=u;',
  'p*=h,this._animWrapper.scale.setScalar(p);xelleUpdateBottleShadow(this,p,u);const b=u;','Lower home bottles slightly and synchronize their shadow');
once('async _onClick(t){var p,b;if(!this.over)return;','async _onClick(t){var p,b;if(!this.over||t.defaultPrevented||Ps().currentWatch.id!=null||t.target instanceof Element&&t.target.closest("a,button"))return;','Limit scene click navigation to home');
once('const h=()=>{l.value||(ch.init(),ch.start(),t.toggleMute(!1)),l.value=!0};','const h=()=>{l.value=!0};','Remove original audio activation');
once('fRt={__name:"default",setup(r){','xelleAudioPrompt='+read('scripts/xelle-audio-prompt.js').trim()+',fRt={__name:"default",setup(r){','Audio permission prompt component');
once('rr(sEt,{visible:!Dt(l),label:Dt(s),onSuppressDefaultPointer:p[0]||(p[0]=b=>u.value=b)},null,8,["visible","label"]),rr(xRe)',
  'rr(sEt,{visible:!Dt(l),label:Dt(s),onSuppressDefaultPointer:p[0]||(p[0]=b=>u.value=b)},null,8,["visible","label"]),rr(xelleAudioPrompt),rr(xRe)','Ask for audio permission after loading');
once('this.scale.setScalar(W2t),this.add(t.scene)}', 'this.scale.setScalar(W2t*xelleBottleScale()),t.scene.position.y+=2.1*(1-1/xelleBottleScale()),this.add(t.scene),xelleRegisterLabels(t.scene,this._config.model,false)}', 'Larger flacons in the product scenes, with sharp label print');
once('!this._snapping&&(this._scrollTarget+=-i,', '!this._snapping&&(this._scrollTarget=xelleScrollTarget(this,-i,o),', 'One stage per gesture, same input for every stage');
// The production bundle carries Theatre's studio (editor) unused; it only logs an error.
once('this._initializeFnCalled||(console.error(uUe),this._didWarnAboutNotInitializing=!0)', 'this._initializeFnCalled||(this._didWarnAboutNotInitializing=!0)', 'Silence the unused Theatre studio notice');
// A video texture paused right after play() rejects the play promise; that is expected.
once('this._isRendering?this._video.play():this._video.pause()', 'this._isRendering?Promise.resolve(this._video.play()).catch(()=>{}):this._video.pause()', 'Handle interrupted video texture playback');
once('Ce.matrixWorldAutoUpdate===!0&&Ce.updateMatrixWorld(),', 'Ce.matrixWorldAutoUpdate===!0&&xelleUpdateSceneMatrices(Ce),', 'World matrices once per frame for the main scene');
once('this._renderer._forcedRenderScale=oo.device.desktop?1.5:1.25,', 'this._renderer._forcedRenderScale=xelleStartRenderScale(oo.device.desktop?1.5:1.25),', 'Render at the real screen pixel density, up to 2x');
once('_tick(t,a){var i,s,o;this._isActive&&(', '_tick(t,a){var i,s,o;this._isActive&&!xelleShopCoversScene()&&(', 'Rest the 3D render loop while the shop pages cover it');
once('xelleAudioPrompt=', 'xelleShopLayer='+read('scripts/xelle-shop-layer.js').trim()+',xelleAudioPrompt=', 'Shop pages and cart drawer component');
once('rr(xelleAudioPrompt),', 'rr(xelleAudioPrompt),rr(xelleShopLayer),', 'Shop pages and cart drawer over the experience');
once('GCt=ui({__name:"CartierIcon",props:{size:{default:"m"}},setup(r){return(e,t)=>(sa(),Qa("svg",{class:zr(["cartierIcon",`cartierIcon--${e.size}`]),viewBox:"0 0 110 31",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",focusable:"false"},VCt,2))}})',
  'GCt=ui({__name:"XelleIcon",props:{size:{default:"m"}},setup(r){return(e,t)=>(sa(),Qa("img",{class:zr(["cartierIcon",`cartierIcon--${e.size}`,"xelleIcon"]),src:"/xelle/xelle-wordmark.png",alt:"Xellé",draggable:"false"},null,2))}})','Original Xellé wordmark');
once('v=[{name:"tank",src:a+"/images/shapes/shape-tank.png"},{name:"santos",src:a+"/images/shapes/shape-santos.png"},{name:"roadster",src:a+"/images/shapes/shape-roadster.png"},{name:"myst",src:a+"/images/shapes/shape-myst.png"},{name:"crash",src:a+"/images/shapes/shape-crash.png"},{name:"baignoire",src:a+"/images/shapes/shape-baignoire.png"}]',
  'v=[{name:"xelle",src:a+"/xelle/xelle-wordmark.png"}]','Xellé loader');
once('Wt.replace("audio/podcasts/","audio/podcasts_xp/")','Wt','Use available local gallery audio');
const galleryTexture=name=>`{type:"texture",name:"podcast_${name}",path:"/images/podcasts/thumbnails/LD/${name}.webp"}`;
once(['baignoire-1','baignoire-2','cartier-prive','myst-de-cartier','roadster-1','roadster-2','santos-de-cartier-1','santos-de-cartier-2','santos-dumont-1','santos-dumont-2','tank-americaine-1','tank-americaine-2','tortue'].map(galleryTexture).join(','),
  locales.pO.pages.filter(page=>page.type==='podcast').map(page=>galleryTexture(page.image.name)).join(','),'Preload Xellé gallery photographs');
once('const e=["roadster","baignoire","cartier-prive","santos-dumont"],t={url:"/videos/movie/movie.mp4"}',
  'const e=[],t={url:"/xelle/video_xelle.mp4"}','Xellé film and separate gallery narration');
once('get videoSrc(){return{preview:Pr.basePath+"/videos/movie/movie_preview.mp4",full:"/videos/movie/movie.mp4"}}',
  'get videoSrc(){return{preview:Pr.basePath+"/xelle/video_xelle.mp4",full:"/xelle/video_xelle.mp4"}}','Xellé film on the 3D screen');
once('vec2 mapUv=vUv;vec4 color=texture(tMap,mapUv);',
  read('scripts/xelle-movie-fit.glsl').trim()+'\n','Preserve complete film proportions on the 3D screen');
once('function sRe(r,e){return e?uTt(r):r}',
  'function sRe(r,e){return r==="/xelle/video_xelle.mp4"?r:e?uTt(r):r}','Use supplied Xellé film in both orientations');
once('function HTt(r){',read('scripts/xelle-media-audio.js')+'\nfunction HTt(r){','Explicit media audio activation');
once('i=new cRe,i.addEventListener("play",l)',
  'i=new cRe,xelleHomePodcastAudio=i,i.addEventListener("play",l)','Track home gallery player');
once('i.stop(),i.destroy(),i=null,e.setAudioActualIsPlaying(!1)',
  'i.stop(),i.destroy(),xelleHomePodcastAudio===i&&(xelleHomePodcastAudio=null),i=null,e.setAudioActualIsPlaying(!1)','Release home gallery player');
once('a&&this.current===a&&(a=!1),a?setTimeout',
  'a&&this.current===a&&(a=!1),a&&xelleEnableAudio(),a?setTimeout','Unlock gallery audio on selected photograph');
once('_onClick(t){if(!this.material.isRendering||Number(Yr.config.currentScene.in)!==6)',
  '_onClick(t){if(t.defaultPrevented||t.target instanceof Element&&t.target.closest("a,button,input,select,textarea"))return;if(!this.material.isRendering||Number(Yr.config.currentScene.in)!==6)','Prevent media controls from selecting gallery photographs');
once('function Et(){zl(),i.videoSetActiveMedia(t),',
  'function Et(){xelleEnableAudio(),zl(),i.videoSetActiveMedia(t),','Enable sound on explicit film playback');
once('_onClick(){this._over&&(this._uiStore.videoSetActiveMedia({url:this.material.videoSrc.full}),this._uiStore.videoOpenPopup())}',
  '_onClick(e){if(e.defaultPrevented||e.target instanceof Element&&e.target.closest("a,button,input,select,textarea"))return;this._over&&(xelleEnableAudio(),this._uiStore.videoSetActiveMedia({url:this.material.videoSrc.full}),this._uiStore.videoOpenPopup())}','Enable sound on film screen click');
once('function h(){zl(),a.toggleMute(!a.audio.isMuted),ch.mute(a.audio.isMuted),i.toggleAudioMuted()}',
  'function h(){if(!ch.isInit){xelleEnableAudio();ch.start();return}zl(),a.toggleMute(!a.audio.isMuted),ch.mute(a.audio.isMuted),i.toggleAudioMuted(a.audio.isMuted)}','Synchronize sound control with gallery mute');
once('"aria-label":"Sound",onClick:h','"aria-label":"Sunet",onClick:h','Romanian sound control');
once('class:"homePage__inlineVideoButton","play-visual-only":""',
  'class:"homePage__inlineVideoButton","aria-label":"Redă filmul Xellé","play-visual-only":""','Label film play control');
once('function q(){e.podcastMode.active||(a.value=(a.value+1)%i.value,s.value=0,e.setPodcastPageIndex(a.value))}',
  'function q(){if(e.podcastMode.active){e.setPodcastMode(!1);return}a.value=(a.value+1)%i.value,s.value=0,e.setPodcastPageIndex(a.value)}','Allow mobile audio stop');
once('class:"stepSwitcher",onClick:q','class:"stepSwitcher",onClick:ho(q,["stop"])','Keep mobile gallery controls out of scene raycasts');
once('key:"auto","is-playing":!0,label:Dt(h)',
  'key:"auto","aria-label":"Următoarele fotografii","is-playing":!0,label:Dt(h)','Label mobile gallery paging');
once('key:Dt(_),"is-playing":!0,"force-hide-play-icon":!0',
  'key:Dt(_),"aria-label":"Oprește înregistrarea audio","is-playing":!0,"force-hide-play-icon":!0','Label mobile audio stop');
once('function Lt(){zl(),l.setPodcastMode(!l.podcastMode.active)}','function Lt(){}','Disable podcast shortcut');
const sceneNavStart=source.indexOf('qxt=ui({__name:"SideNavIndicationElt"');
const sceneNavEnd=source.indexOf(',Kxt=ri(qxt,',sceneNavStart);
if(sceneNavStart<0||sceneNavEnd<0) throw new Error('Scene navigation component missing');
once(source.slice(sceneNavStart,sceneNavEnd),'qxt='+read('scripts/xelle-scene-navigation.js').trim(),'Direct navigation to perfumes and media');
once('function R(Q){var me;const ue=(me=Q.url)==null?void 0:me.trim();if(ue)return TJ(ue,{external:a(ue),open:{target:"_blank",windowFeatures:{noopener:!0,noreferrer:!0}}})}',
  'function R(Q){var me;const ue=(me=Q.url)==null?void 0:me.trim();if(ue)return a(ue)?TJ(ue,{external:!0,open:{target:"_blank",windowFeatures:{noopener:!0,noreferrer:!0}}}):TJ(ue)}','Local collection navigation');
once('ariaLabel:{default:"Scroll to first section"}','ariaLabel:{default:"Descoperă primul parfum"}','Romanian scroll label');
once('_Tt={heroBlock:U1t,scrollMediasBlock:zPt,scrollWatchBlock:UPt,videoBlock:ATt,productsBlock:gPt,sliderProductsBlock:iTt,textBlock:cTt,sliderBlock:YPt,pushPageBlock:APt}',
  'xelleNotesBlock='+read('scripts/xelle-notes-block.js').trim()+',_Tt={heroBlock:U1t,scrollMediasBlock:zPt,scrollWatchBlock:UPt,videoBlock:ATt,productsBlock:gPt,sliderProductsBlock:iTt,textBlock:cTt,sliderBlock:YPt,pushPageBlock:APt,xelleNotesBlock}','Olfactory notes block');
fs.writeFileSync(path.join(root,'public/assets/xelle-app.js'),source);
// The local server sends no validators, so browsers kept serving old copies:
// the page asks for each rebuilt file under a new address.
const stamp=file=>require('node:crypto').createHash('sha1').update(fs.readFileSync(path.join(root,'public',file))).digest('hex').slice(0,10);
const indexFile=path.join(root,'public/index.html');
fs.writeFileSync(indexFile,fs.readFileSync(indexFile,'utf8')
  .replace(/\/assets\/xelle-app\.js(\?v=\w+)?"/,`/assets/xelle-app.js?v=${stamp('assets/xelle-app.js')}"`)
  .replace(/\/xelle\/xelle\.css(\?v=\w+)?"/,`/xelle/xelle.css?v=${stamp('xelle/xelle.css')}"`));
fs.writeFileSync(path.join(root,'audit/xelle-build.json'),JSON.stringify({builtAt:new Date().toISOString(),source:'original/app.js',contentTables:replacements.length,patches},null,2));
console.log(`Xellé bundle ready: ${patches.length} guarded runtime patches and ${replacements.length} content tables.`);
