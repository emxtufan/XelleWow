// Undo the original screen's cropped UV range, shared by desktop and mobile.
vec2 mapUv=(vUv-vec2(0.0070468,0.09550196))/vec2(0.98731758,0.80890119);
vec2 sourceSize=max(vec2(textureSize(tMap,0)),vec2(1.0));
float videoAspect=sourceSize.x/sourceSize.y;
float screenAspect=2.20538436;
if(videoAspect<screenAspect) mapUv.x=(mapUv.x-0.5)*(screenAspect/videoAspect)+0.5;
else mapUv.y=(mapUv.y-0.5)*(videoAspect/screenAspect)+0.5;
vec4 color=texture(tMap,clamp(mapUv,vec2(0.0),vec2(1.0)));
if(any(lessThan(mapUv,vec2(0.0)))||any(greaterThan(mapUv,vec2(1.0)))) color=vec4(0.0,0.0,0.0,1.0);
