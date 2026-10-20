#ifdef XELLE_GLASS
// Clear dielectric glass reflects light instead of scattering it like white
// paint. Grazing angles show its thickness and keep the silhouette readable.
float xelleGlassEdge = pow(clamp(1.0 - NdV, 0.0, 1.0), 2.4);
col = kD * col * diffuse * mix(0.085, 0.025, xelleGlassEdge) + specular * 1.45;
#elif defined(XELLE_LIQUID)
// Perfume reads as liquid lit through: light from behind crosses the fluid
// and takes its tint, a little deeper towards the bottom. Towards the walls the
// curved liquid bends the backlight into a saturated glow, as in product
// photographs, and the free surface keeps a bright meniscus line.
float xelleHeight = 1.0 - vUv.y;
float xelleSide = 1.0 - abs(n.y);
float xelleLiquidEdge = pow(clamp(1.0 - NdV, 0.0, 1.0), 1.4);
vec3 xelleTint = clamp(col, vec3(0.001), vec3(1.0));
vec3 xelleTransmit = pow(xelleTint, vec3(2.2 + (1.0 - xelleHeight) * 0.6));
vec3 xelleRich = pow(xelleTint, vec3(3.4));
vec3 xelleBackDir = -v * rotateX(_uEnvRotationY);
xelleBackDir *= rotateY(_uEnvRotationX);
vec3 xelleBacklight = evaluateSH(xelleBackDir, SHConstants);
col = kD * (xelleTransmit * (diffuse * 0.22 + xelleBacklight * 0.42) + xelleRich * xelleBacklight * xelleLiquidEdge * 0.9);
float xelleMeniscus = smoothstep(0.93, 0.972, xelleHeight) * (1.0 - smoothstep(0.972, 0.99, xelleHeight)) * xelleSide;
col += mix(xelleTint, vec3(1.0), 0.45) * xelleMeniscus * 0.55;
col += specular * 0.9;
#else
col=(kD*col*diffuse)+specular;
#endif
