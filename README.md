# three-custom-material
The main idea behind this ShaderMaterial wrapper is to have lights attached to the material, so it’s possible to illuminate any object with any light(s), also to have more control over properties of lights and to experiment with different ways to create shadows.

The lighting for this material is based on per-pixel Lambertian diffusion plus specular highlights.

The material currently supports texture map, bump map, translucency, gamma and any number of ambient, direct and point lights and 3 shadow modes.

Point lights have attenuation over distance, light shadows have 4 levels of blur and strength.

Textures can be used to convert point lights into spot lights and have an artictic cnotrol over the cross-section light intensity.

Lights can expand on built-in THREE light objects or to be stand-alone JavaScript objects.

All code is written in vanilla JavaScript and only requires THREE.js to run.

Examples: 

* complex illumination with multiple material/lights [https://alikim.com/test/custom_imesh.html](https://alikim.com/test/custom_imesh.html)

* texturized point light [https://alikim.com/test/custom_imesh.html](https://alikim.com/test/custom_texlight.html)

* extensive setup of the material lights and shadows [https://alikim.com/test/custom_imesh.html](https://alikim.com/test/custom_box.html)


