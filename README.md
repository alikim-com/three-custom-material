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

* texturized point light [https://alikim.com/test/custom_textlight.html](https://alikim.com/test/custom_texlight.html)

* extensive setup of the material lights and shadows [https://alikim.com/test/custom_box.html](https://alikim.com/test/custom_box.html)

Simple usage example:

```
import { CUSTOM, renderShadTex } from '/_v1_jsm/custom.js'

const cust = await new CUSTOM();

const amb = new THREE.AmbientLight(0xffffff, 0.005);

const dir = new THREE.DirectionalLight(0xa0ffa0, 0.4);
const dir_lookat = [0, 0, mid];

const pnt0 = new THREE.PointLight(0xffa0a0, 1);

const mat_main = cust.material('lamb', {
	uni: {
		color: { value: [1, 1, 1] },
		amb: {
			get color() { return [amb.color.r, amb.color.g, amb.color.b] },
			get intensity() { return amb.intensity },
		},
		dir: {
			get color() { return [dir.color.r, dir.color.g, dir.color.b] },
			get intensity() { return dir.intensity },
			position: [dir.position.x, dir.position.y, dir.position.z],
			lookat: dir_lookat,
		},
		pnt: {
			get color() { return [pnt0.color.r, pnt0.color.g, pnt0.color.b] },
			intensity: 100,
			position: [pnt0.position.x, pnt0.position.y, pnt0.position.z],
			decay: 2,
			shadow: {
				blur: 5,
				strength: 1,
		      		tex: { w: 1050, h: 875 },
		      		cam: new THREE.PerspectiveCamera(55, 1, 30, 300),
		      		lookat: [0, 0, -100],
	      		},
		},
		specular: {
			get position() {
				const pos = camera.position;
				return [pos.x, pos.y, pos.z];
			},
			strength: 0.5,
			falloff: 6,
		},
		map: ['/_v1_jsm/textures/uv.png', () => { callback('r') }, ],
    	}
 });
 
 ...
 
 const m = new THREE.Mesh(geo, cust.shallowCopyMat(mat_main));
 
 cust.makeShadowTree(scene);
 
 const render = () => {
 	renderShadTex(renderer, scene, cust);
 	renderer.render(scene, camera);
 };
```
