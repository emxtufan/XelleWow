#if defined(XELLE_CAP) || defined(XELLE_GLASS)
// The inherited watch environment has a ring of small lights that resembles
// petals on a spherical cap. Use a broad key and narrow fill, like a product
// photography setup, with the reflected surface normal retaining its curvature.
vec3 xelleReferenceUp = abs(v.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
vec3 xelleRight = normalize(cross(xelleReferenceUp, v));
vec3 xelleUp = cross(v, xelleRight);
vec3 xelleReflection = vec3(dot(r, xelleRight), dot(r, xelleUp), dot(r, v));
float xelleFrontLight = smoothstep(0.1, 0.4, xelleReflection.z);
#ifdef XELLE_CAP
float xelleKey = exp(-pow(abs((xelleReflection.x + 0.42) / 0.20), 4.0)
                    -pow(abs((xelleReflection.y - 0.50) / 0.31), 4.0));
float xelleFill = exp(-pow(abs((xelleReflection.x - 0.70) / 0.08), 4.0)
                     -pow(abs((xelleReflection.y - 0.05) / 0.65), 4.0));
float xelleRim = pow(clamp(1.0 - NdV, 0.0, 1.0), 3.0);
specular = vec3((xelleKey * 0.85 + xelleFill * 0.14) * xelleFrontLight + xelleRim * 0.055);
diffuse *= 0.35;
#else
// Tall softboxes give the curved glass its characteristic fine vertical glints.
float xelleGlassKey = exp(-pow(abs((xelleReflection.x + 0.50) / 0.10), 4.0)
                         -pow(abs(xelleReflection.y / 0.95), 4.0));
float xelleGlassFill = exp(-pow(abs((xelleReflection.x - 0.73) / 0.05), 4.0)
                          -pow(abs(xelleReflection.y / 0.95), 4.0));
specular = specular * 0.55 + vec3((xelleGlassKey * 0.50 + xelleGlassFill * 0.18) * xelleFrontLight);
#endif
#endif
