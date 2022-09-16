
import { loadAssets } from '/_v1_jsm/network.js'

import * as THREE from '/_v1_jsm/three.module.js'

import * as MTX from '/_v1_jsm/matrices.js'

import { dot, cross, norm, vectsEqual } from '/_v1_jsm/geometry.js'

import { get, img1x1, deepCopy, deepCopyFull, log, slog } from '/_v1_jsm/utils.js'

import { traverseTree, makeRT, genAtlas, renderRTVP, renderTexQuadCust } from '/_v1_jsm/utils_three.js'

const texldr = new THREE.TextureLoader();

const texRequest = (url, ind = '') => {
	return new Promise(function (resolve, reject) {
		texldr.load(
			url,
			(tex) => {
				resolve({
					data: tex,
					ind
				})
			},
			undefined,
			(err) => {
				reject({
					data: null,
					ind,
					src: `texRequest(${url}, ${ind})`,
					err
				})
			});
	});
};

// IMPORT

const toload = {
	mr: [
		['/_v1_jsm/shaders/custom.glsl', 'g_shaders'],
	],
	pr: [
		texRequest('/_v1_jsm/textures/uv.png', 't_tex_uv'),
	],
};

let shaders, textures, _res, _rej;

const async_prom = {
	resolve: assets => {
		shaders = assets.shaders;
		textures = assets.tex;
		_res?.();
	},
	reject: obj => { _rej?.(); log(obj) },
};
loadAssets(async_prom, toload);

const dummy = () => ({
	float: 0,
	vec2: new Array(2),
	vec3: new Array(3),
	vec4: new Array(4),
	mat3: new Array(9),
	mat4: new Array(16),
	sampler2D: texldr.load(img1x1),
});

// async constructor

function CUSTOM() { // usage: const cust = await new CUSTOM(...);
	
	if(!shaders && !textures) 
	return (async () => {

		await new Promise((res, rej) => { _res = res; _rej = rej; })
		.catch( err => { log('async CUSTOM err:', err) });
		  
		this.dummy = dummy();
  
		return this;
	})();
	
	this.dummy = dummy();
};

/*
cam	.fov, .near, .far, .asp, ...  
					|	|			|
		.uData(fmax,fact)		|	makeShadTree()	 lgt.shadow.tex(1/w,1/h)
					|				|		|					|
lgt	.cam_fact	.cam_near	.atl				.uvpx


										  			  cam.fov,near   cam.uData.fact
scene.uData.r2d2													|
					.cam					.pers,near,fact <- renderShadTex()
					.red.uniforms	<-	|
		
*/

/*
scene.userData - bg <- redState()
					- atl_P [W,H, P0[x0,y0,w,h], P1[...]]
					- atlasP RT(W,H) *
					- r2d2: cam(pos), fact, near, persp, red(CustMat)
					- shadow_tree: P0: atl(u0,v0,uw,uh)
											 cam(THREE.Cam)
											 obj[THREE.Mesh, ...] mat incl P0
											 tex(w,h)
											 vp(x0,y0,w,h)
										P1, D0, ...

light [{ cam_fact, cam_near, atl, uvpx
			shadow - cam - userData: fmax, fact
					 - userData: iViewMatrix, projViewMatrix
			userData: iViewMatrix*, projViewMatrix*
}, {}]

ShaderMaterial - userData - custMat: true

SM Mesh - userData - (mat, vis, red) <- redState()
*/

CUSTOM.prototype.makeTexture = function(arg) {
	if (typeof arg == 'string')
		return texldr.load(arg);
	else if (arg.constructor == Array)
		return texldr.load(arg[0], arg[1], undefined, arg[2]);
	else // THREE texture
		return arg;
};

// post creation mat edit
CUSTOM.prototype.addDefine = function (meshmat, shader, nm) {
	const prf = '\n\t#define ';
	const def = prf + (Array.isArray(nm) ? nm.join(prf) : nm) + '\n';
	const shr = Array.isArray(shader) ? shader : [shader];
	shr.forEach(nm => {
		const pr = nm + 'Shader';
		meshmat[pr] = def + meshmat[pr];
	});
};

const updateDefine = (nm, meshmat, add, js_set) => {
	const defnm = nm.toUpperCase();
	if (js_set) {
		js_set.fs_defines.add(defnm);
	} else {
		const fs_defines = meshmat.userData.fs_defines;
		if (!fs_defines.has(defnm)) {
			fs_defines.add(defnm);
			add(meshmat, 'fragment', defnm);
		}
	}
};

CUSTOM.prototype.addTexture = function (nm, obj, map, js_set) {
	const tex = this.makeTexture(map);
	obj.uniforms[nm] = { value: tex };
	updateDefine(nm, obj, this.addDefine, js_set);
	return tex;
};

CUSTOM.prototype.addTexCtrl = function (nm, obj, mtx, js_set) {
	/* [ sX * Math.cos(skY), -sY * Math.sin(skX), tX,
		  sX * Math.sin(skY),  sY * Math.cos(skX), tY, ] */
	const unm = nm + 'ctrl';
	obj.uniforms[unm] = {
		get value() {
			const degToRad = Math.PI / 180;
			const [sX, sY, skX, skY, tX, tY] = [
				1 / mtx.scaleX || 1, 1 / mtx.scaleY || 1, degToRad * mtx.skewX || 0,
				degToRad * mtx.skewY || 0, mtx.offU || 0, mtx.offV || 0
			];
			return [
			 sX * Math.cos(skY), sX * Math.sin(skY), 0,
			-sY * Math.sin(skX), sY * Math.cos(skX), 0,
			 tX, tY, 0 ];
		}
	};
	updateDefine(unm, obj, this.addDefine, js_set);
};

CUSTOM.prototype.material = function (name, _obj = {}) {

	const getShader = id => {
		let src = shaders[id];
		if (!src) console.error(`shader '${id}' not found`);
		src = src.replace(/#include '([^']+)'/g,
			function () {
				const $1 = arguments[1];
				const elem = get($1)?.textContent || shaders[$1];
				if (!elem) console.error(`include shader '${$1}' not found`);
				return elem;
			});
		src = src.replace(/<val ([^>]+)>/g, // <val js.xxx>
			function () {
				return eval(arguments[1]);
			});
		return src;
	};

	const maybeShadow = (lgts, nm) => {

		const updatePVM = (iViewMatrix, data, cam) => {
			let match = true;
			for (let i = 0; i < iViewMatrix.length; i++)
			if (data.iViewMatrix[i] != iViewMatrix[i]) {
				match = false;
				break;
			}
			if (match) return;
			data.iViewMatrix = [...iViewMatrix];
			const iViewMtx = MTX.to2D(iViewMatrix, 4, 4);
			const projMtx = MTX.to2D(cam.projectionMatrix.elements, 4, 4);
  			data.projViewMatrix = MTX.to1D(MTX.mult(projMtx, iViewMtx));
		};

		if (!lgts.find(({ shadow }) => shadow)) return;
		// enable shadows for all lights of the type, dummies if not present
		// to keep one loop in fs
		fs_defines.add(nm);
		lgts.forEach(obj => {
			const osh = obj.shadow;
			if (osh) {
				obj.shad_prox = osh.prox || 0.2; // [0,257]
				Object.defineProperty(obj, 'shad_str', {
					configurable: true,
					enumerable: true,
					get: () => osh.strength,
				});
				Object.defineProperty(obj, 'shad_blur', {
					configurable: true,
					enumerable: true,
					get: () => osh.blur,
				});
				const cam = osh.cam;
				if (cam.aspect) {
					cam.aspect = osh.tex.w / osh.tex.h;
					cam.updateProjectionMatrix();
				}
				const data = osh.userData = {};
				data.iViewMatrix = this.dummy.mat4;
				data.projViewMatrix = this.dummy.mat4;
				data.campos = new THREE.Vector3();
				Object.defineProperty(obj, 'iViewMatrix', {
					configurable: true,
					enumerable: true,
					get: () => cam.matrixWorldInverse.elements,
				});
				Object.defineProperty(obj, 'projViewMatrix', {
					configurable: true,
					enumerable: true,
					get: () => {
						updatePVM(obj.iViewMatrix, data, cam);
						return data.projViewMatrix;
					}
				});
				Object.defineProperty(cam, 'position', {
					configurable: true,
					enumerable: true,
					get: function () {
						const [cp, lp] = [data.campos, obj.position];
						if (cp.x == lp[0] && cp.y == lp[1] && cp.z == lp[2])
							return data.campos;
						data.campos.set(lp[0], lp[1], lp[2]);
						cam.lookAt(...osh.lookat);
						return data.campos;
					}
				});

				// r2d2 depth
				const cud = cam.userData;
				const [fov, far] = [cam.fov, cam.far];
				if (fov) {
					const tf = far * Math.tan(fov * Math.PI / 360); 
					const rf = tf * cam.aspect;
					cud.fmax = Math.sqrt(rf * rf + tf * tf + far * far);
				} else {
					cud.fmax = far;
				}
				const rep = 1 / (cud.fmax - cam.near);
				// enc in r2d2
				// [near, fmax] -> [0,65535] -> g[0,255] r[0,255]
				cud.fact = 65535 * rep;
				// dec in main shader, no need to *255.0
				// [near, fmax] <- [0,257] = 256*[0,1] + [0,1]
				obj.cam_fact =  257 * rep;
				obj.cam_near = cam.near;

				obj.atl = [0, 0, 0, 0];
				obj.uvpx = [1 / osh.tex.w, 1 / osh.tex.h];

				// overrite dummy to block shadow casting behind the camera
				if(nm == 'PSHADOW') obj.lookat = osh.lookat;

			} else {
				obj.atl = this.dummy.vec4;
				obj.uvpx = this.dummy.vec2;
				const z = ['shad_prox', 'shad_str', 'shad_blur', 'cam_fact', 'cam_near'];
				for (const nm of z) obj[nm] = 0;
				obj.iViewMatrix = this.dummy.mat4;
				obj.projViewMatrix = this.dummy.mat4;
			}
		});
	};

	const maybeTexlight = (lgts, nm) => {  
		if (!lgts.find(({ texture }) => texture)) return [null, null];
		let mapctrl = false;
		if (lgts.find(({ texture }) => texture.mapctrl)) {
			mapctrl = true;
			fs_defines.add('TLMAPCTRL');
		}
		// enable texlights for all lights of the type, dummies if not present
		// to keep one loop in fs
		fs_defines.add(nm);
		const texLight = []; // array of struct
		const tlMap = []; //  array of textures 
		lgts.forEach(lgt => {
			const obj = lgt.texture ||
			{
				s: this.dummy.float,
				fov: this.dummy.float,
				near: this.dummy.float,
				lookat: this.dummy.vec3,
				texcs: this.dummy.mat3,
			};
			if (!obj.s) Object.defineProperty(obj, 's', {
				configurable: true,
				enumerable: true,
				get: function () {
					const hdtr = Math.PI / 360;
					const fov = obj.fov * hdtr;
					return 1 / (obj.near * Math.tan(fov));
				}
			});
			// auto update texture cs (x, y, z, ori)
			if(!obj.texcs) Object.defineProperty(obj, 'texcs', {
				configurable: true,
				enumerable: true,
				get: function () {
					const up = norm(obj.up);
					const [look, pos] = [obj.lookat, lgt.position];
					const frwd = norm([look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]]);
					if (obj.tlz && vectsEqual(frwd, obj.tlz) &&
						obj.up && vectsEqual(up, obj.up)) return obj._texcs;
					obj.up = up;
					obj.tlz = frwd;
					const tlx = norm(cross(...obj.up, ...frwd));
					const tly = norm(cross(...obj.tlz, ...tlx));		
					const ori = [0, 0];
					const n = obj.near;
					// ori = prime cs origin in the world frame
					for (let i = 0; i < 3; i++) ori[i] = frwd[i] * n + pos[i];
					// ori in double prime i.e. prime w/o translation
					const tu = dot(ori, tlx);
					const tv = dot(ori, tly);
					obj._texcs = [...tlx, ...tly, tu, tv, 0];

					return obj._texcs;
				}
			});
			if (mapctrl && !obj.mapctrl) obj.mapctrl = this.dummy.mat3;
			texLight.push(obj);
			tlMap.push(obj.map ? this.makeTexture(obj.map) : this.dummy.sampler2D);
		});
		return [
			texLight.length > 1 ? texLight : texLight[0],
			tlMap.length > 1 ? tlMap : tlMap[0]
		];
	};

	const maybeLoop = (nm, len) => {
		return len > 1 ? {
			len: `[${len}]`,
			for_beg: `for(int i = 0; i < ${len}; i++) {`,
			i: `${nm}[i]`,
			for_end: '}',
		} : {
			len: '',
			for_beg: '',
			i: nm,
			for_end: ''
		};
	};

	const [vs, fs, uni] = [_obj.vs, _obj.fs, _obj.uni || {}];
	const obj = {
		uniforms: {}
	};
	const objuni = obj.uniforms;

	const [vs_defines, fs_defines] = [new Set(), new Set()];

	const js = { // <val js.xxx> -> js.xxx in getShader()
		vs_defines: '',
		fs_defines: ''
	};

	// lights

	const [a, d, p] = [ uni.amb, uni.dir, uni.pnt];
	const [alen, dlen, plen] = [a?.length, d?.length, p?.length];

	js.amb = maybeLoop('amb_light', alen);
	js.dir = maybeLoop('dir_light', dlen);
	js.pnt = maybeLoop('pnt_light', plen);

	js.ptl = maybeLoop('tex_light', plen);
	js.tlm = maybeLoop('tlmap', plen);

	if (a) {
		fs_defines.add('AMBIENT');
		objuni.amb_light = { value: a };
	}

	if (d || p) {

		vs_defines.add('VPN');
		fs_defines.add('VPN');

		if(uni.specular) {
			fs_defines.add('SPECULAR');
			objuni.spec = { value: uni.specular };
		}
		if (uni.translucent) {
			fs_defines.add('TRANSLUCENT');
			objuni.tlucy = uni.translucent;
		}
		if (d) {
			fs_defines.add('DIRECT');
			const darr = dlen ? d : [d];
			for (const lgt of darr) lgt.decay = this.dummy.float;
			maybeShadow(darr, 'DSHADOW');
			objuni.dir_light = { value: d };
		}
		if(p) {
			fs_defines.add('POINT');
			const parr = plen ? p : [p];
			for (const lgt of parr) lgt.lookat = this.dummy.vec3;
			maybeShadow(parr, 'PSHADOW');
			objuni.pnt_light = { value: p };
			const [tex_light, tlmap] = maybeTexlight(parr, 'TEXLIGHT');
			objuni.tex_light = { value: tex_light };
			objuni.tlmap = { value: tlmap };
		}

		if (fs_defines.has('DSHADOW') || fs_defines.has('PSHADOW')) {
			//obj.uniforms.castShadow = { value: uni.castShadow || true };
			objuni.receiveShadow = { value: uni.receiveShadow || true };
			// for shadow blur
			objuni.rc_bl = {
				value: [
					0, 0, 0, 0, 0, 18, 0, 60,
					2, 0, 0, 18, 0, 42, 0, 74
				]
			};
			objuni.rc_off = {
				value: [
					// blur == 0 || 3
					0,0, -1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1,
					// 5
					0,0, -1, -2, 0, -2, 1, -2, -2, -1, -1, -1, 0, -1, 1, -1, 2, -1, -2, 0, -1, 0, 1, 0, 2, 0, -2, 1, -1, 1, 0, 1, 1, 1, 2, 1, -1, 2, 0, 2, 1, 2,
					// 7
					0,0, -1, -3, 0, -3, 1, -3, -2, -2, -1, -2, 0, -2, 1, -2, 2, -2, -3, -1, -2, -1, -1, -1, 0, -1, 1, -1, 2, -1, 3, -1, -3, 0, -2, 0, -1, 0, 1, 0, 2, 0, 3, 0, -3, 1, -2, 1, -1, 1, 0, 1, 1, 1, 2, 1, 3, 1, -2, 2, -1, 2, 0, 2, 1, 2, 2, 2, -1, 3, 0, 3, 1, 3
				]
			};
			objuni.rc_tot = {	value: [	1, 0, 0, 2 / 18, 0, 2 / 42, 0, 2 / 74 ] };
		}

	}

	// material specific

	if (uni.map)
		this.addTexture('map', obj, uni.map, { fs_defines, vs_defines });
	if (uni.mapctrl)
		this.addTexCtrl('map', obj, uni.mapctrl, { fs_defines, vs_defines });
	
	if (uni.bmap) {
		this.addTexture('bmap', obj, uni.bmap, { fs_defines });
		objuni.bmfact = uni.bmfact || { value: 1 };
	}

	if (['uv', 'rgb', 'tex'].includes(name)) {
		obj.vertexShader = shaders[vs] || shaders.vs;
		obj.fragmentShader = shaders[fs] || shaders['fs_' + name];
	}
	if (['rgb', 'lamb'].includes(name)) {
		objuni.color = uni.color || {
			value: [1, 1, 1]
		};
	}
	if (['tex', 'float_to_quad'].includes(name)) {
		objuni.fact = uni.fact || {
			value: 1
		};
		objuni.map = objuni.map || {
			value: textures.uv
		};
	}
	if (name == 'r2d2') {
		for (const p in uni) objuni[p] = uni[p];
	}
	if (['lamb', 'r2d2'].includes(name)) {
		vs_defines.forEach(v => {
			js.vs_defines += `#define ${v}\n\t`;
		});
		fs_defines.forEach(v => {
			js.fs_defines += `#define ${v}\n\t`;
		});
	}
	if (['lamb', 'depth', 'r2d2'].includes(name)) {
		obj.vertexShader = shaders[vs] || getShader('vs_' + name);
		obj.fragmentShader = shaders[fs] || getShader('fs_' + name);
	}

	obj.vertexShader = obj.vertexShader || getShader(vs);
	obj.fragmentShader = obj.fragmentShader || getShader(fs);

	if (!obj.vertexShader || !obj.fragmentShader) console.error(`missing shaders for CUSTOM.material '${name}'`);
	
	obj.userData = { custMat: true, fs_defines };
	if (_obj.imesh_self_shadow)
		obj.userData.imesh_self_shadow = _obj.imesh_self_shadow;

		objuni.gamma = uni.gamma || { value: 2.2 };
		objuni.shad_mode = uni.shad_mode || { value: 0 };

	return new THREE.ShaderMaterial(obj);
};

CUSTOM.prototype.shallowCopyMat = function (material, full) {
	const data = material.userData;
	const obj = {
		vertexShader: material.vertexShader,
		fragmentShader: material.fragmentShader,
		uniforms: {},
		userData: {
			custMat: data.custMat,
			fs_defines: new Set(data.fs_defines),
		},
	};
	const uni = material.uniforms;
	if(!full) {
		for (const p in uni) obj.uniforms[p] = uni[p];
		return new THREE.ShaderMaterial(obj);
	}
	for (const p in uni) {
		const desc = Object.getOwnPropertyDescriptor(uni, p);
		if (desc.get || desc.set)
			Object.defineProperty(obj.uniforms, p, desc);
		else
			obj.uniforms[p] = uni[p];
	}
	return new THREE.ShaderMaterial(obj);
}

CUSTOM.prototype.deepCopyMat = function (material) {
	const obj = {
		vertexShader: material.vertexShader,
		fragmentShader: material.fragmentShader,
		uniforms: deepCopyFull(material.uniforms, { link: ['cam'] }),
		userData: deepCopy(material.userData),
	};
	return new THREE.ShaderMaterial(obj);
}

CUSTOM.prototype.makeShadowTree = scene => {
	const dat = scene.userData;
	const tree = dat.shadow_tree = {};
	
	const unq = { D: 0, P: 0, lgts: [] };
	traverseTree(scene,
		obj3D => {
			const mat = obj3D.material;
			if (!mat?.userData?.custMat) return;
			const lgts = {
				D: mat.uniforms?.dir_light,
				P: mat.uniforms?.pnt_light,
			}; 
			for (const t in lgts) {
				const list = lgts[t]?.value;
				if (!list) continue;
				const lgt = list.length ? list : [list];
				for (let i = 0; i < lgt.length; i++) {
					const li = lgt[i];
					
					if (!li.shadow) continue;
					
					const uli = unq.lgts.find(({ obj }) => obj == li);
					if (uli) {
						tree[uli.id].obj.push(obj3D);
						continue;
					}
					
					// new light
					const cam = li.shadow.cam;
					const tex = li.shadow.tex;
					if (!cam || !tex) {
						log(`cam/tex missing from ${obj3D} mat's light ${li}`);
						return;
					}
					const uid = t + (unq[t]++);
					unq.lgts.push({obj: li, id: uid});
					tree[uid] = { atl: li.atl, cam, tex, obj: [] };
					tree[uid].obj.push(obj3D);

					// pass uid to the initial light object for displaying atlases from UI
					li.shadow.lid = uid; 
				}
			}
	});
	
	// for redState
	const dso = dat.shad_obj = new Set();
	for (const p in tree) tree[p].obj.forEach(dso.add, dso);

	// atlases
	const wh = { P: [], D: [] };  
	for (const p in tree) {
		const tex = tree[p].tex;
		wh[p[0]].push([tex.w, tex.h, p]); // wh { P: [ [w,h,'P0'], [w,h,'P1'], ... ], D: ... }
	}

	const tile = 128; // W,H -> * tile
	const atlas = {};
	for (const t of ['P', 'D']) {
		if (wh[t].length) {
			const at = atlas[t] = {};
			[at.W, at.H, at.lids] = genAtlas(wh[t], tile); // [W,H, { P0: [x,y,w,h], P1: ...}]
			[at.Wr, at.Hr] = [1 / at.W, 1 / at.H];
			dat['atlas' + t] = makeRT(at.W, at.H);
		}
	}

	for (const lid in tree) {
		const atl = atlas[lid[0]];
		if (!atl) {
			log(`atlas ${lid[0]} doesn't have light ${lid}`);
			continue;
		}
		const [awr, ahr] = [atl.Wr, atl.Hr];
		const [x, y, w, h] = atl.lids[lid];
		tree[lid].vp = new THREE.Vector4(x, y, w, h);
		const dst = tree[lid].atl; // [0,0,0,0]
		dst[0] = x * awr;
		dst[1] = y * ahr;
		dst[2] = w * awr;
		dst[3] = h * ahr; // -> [u0,v0,uw,uh]
	}

	// assign atlas to all materials /w lights
	traverseTree(scene,
		obj3D => {
			const mat = obj3D.material;
			if (!mat?.userData?.custMat) return;
			const uni = mat.uniforms;
			if (uni?.pnt_light && dat.atlasP)
				uni.atlasP = { value: dat.atlasP.texture };
			if (uni?.dir_light && dat.atlasD)
				uni.atlasD = { value: dat.atlasD.texture };
		});
};

const renderShadTex = (rend, scene, cust, lid) => {
	
	const atlas = { P: scene.userData?.atlasP, D: scene.userData?.atlasD };
	if (!atlas.P && !atlas.D) {
		//log('renderShadTex(): no atlases found for \n', scene);
		return;
	}

	redState(cust, scene, true, false);

	const r2d2 = scene.userData.r2d2;
	const clear = { P: true, D: true };
	const tree = scene.userData.shadow_tree;
	for (const lid in tree) {
		const t = lid[0];
		const rt = atlas[t];
		if (!rt) continue;

		const lgt = tree[lid];
		// update linked fs_r2d2 shader uniforms
		const cam = lgt.cam;
		r2d2.persp = cam.fov ? true : false;
		r2d2.near = cam.near;
		r2d2.fact = cam.userData.fact;
		for (const obj3D of lgt.obj) obj3D.visible = true;
		renderRTVP(rend, scene, cam, rt, lgt.vp, clear[t]);
		for (const obj3D of lgt.obj) obj3D.visible = false;
		clear[t] = false;
	}

	redState(cust, scene, false);

	if (lid) { // show atlas
		const rt = atlas[lid[0]];
		const vp = tree[lid].vp; // patch in px, tree[lid].atl - in uvs
		const bg = new THREE.Color(0.1, 0, 0.1);
		renderTexQuadCust(rend, rt.texture, vp.z, vp.w, tree[lid].atl, bg);
	}
};

let ruID = 1;
const redState = (cust, scene, on, vis) => {

	const scdat = scene.userData;

	if (on) {
		traverseTree(scene, obj3D => {
			if (obj3D.material) { // not a group / object3D container
				obj3D.userData.vis = obj3D.visible;
				obj3D.visible = vis;
			}
		});
		const sbg = scene.background;
		if (sbg) {
			scdat.bg = sbg;
			scene.background = null;
		}

	} else {
		traverseTree(scene, obj3D => {
			if (obj3D.material) {
				obj3D.material = obj3D.userData.mat || obj3D.material;
				obj3D.visible = obj3D.userData.vis ?? obj3D.visible;
			}
		});
		scene.background = scdat.bg || scene.background;
		return;
	}

	const id_val = 1 / 255;
	const rgID = () => ruID * id_val;
	const cID = () => {
		const bg = Math.floor(ruID / 256);
		const br = ruID - 256 * bg;
		ruID++;
		return [br * id_val, bg * id_val]; // [r, g]
	};

	scdat.r2d2 = scdat.r2d2 || {
		near: 0,
		fact: 0,
		red: cust.material('r2d2', {
			uni: {
				persp: { get value() { return scdat.r2d2.persp } },
				near: { get value() { return scdat.r2d2.near } },
				fact: { get value() { return scdat.r2d2.fact } },
			}
		}),
	};

	const red = scdat.r2d2.red;

	for (const obj3D of scdat.shad_obj) { // only objs /w shad
		const omud = obj3D.material.userData;
		const ogud = obj3D.geometry.userData;
		const imesh_self_shadow = omud.imesh_self_shadow && obj3D.isInstancedMesh;

		if (!omud.red) {
			omud.red = cust.shallowCopyMat(red, true);
			omud.red.side = obj3D.material.side;
			if (!imesh_self_shadow) {
				obj3D.material.uniforms.rgID = { value: rgID() }; // lamb
				omud.red.uniforms.rgID = { value: cID() }; // r2d2
			}
		}

		if (imesh_self_shadow && !ogud.im_id) {
			ogud.im_id = true;

			if (!omud.fs_defines.has('IMESH_SELF_SHADOW')) {
				omud.fs_defines.add('IMESH_SELF_SHADOW');
				cust.addDefine(obj3D.material, ['vertex', 'fragment'], 'IMESH_SELF_SHADOW');
				cust.addDefine(omud.red, ['vertex', 'fragment'], 'IMESH_SELF_SHADOW');
			}
				
			const instID = new Float32Array(obj3D.count * 3);
			// rgID() for lamb, ...cID() - for r2d2
			for (let i = 0; i < instID.length; i += 3) instID.set([rgID(), ...cID()], i);

			obj3D.geometry.setAttribute('instanceRGID', 
				new THREE.InstancedBufferAttribute(new Float32Array(instID), 3));
		}

		obj3D.userData.mat = obj3D.userData.mat || obj3D.material;
		obj3D.material = omud.red;
	}
};

const renderFloatToQuad = function (rend, inputRT) {
	const getQuadGeom = (w = 1, h = 1, x = 0, y = 0, z = 0) => {
		const uv = [
			[0, 0],
			[0, 1],
			[1, 1],
			[1, 0]
		];
		const corners = [
			[-0.5, -0.5],
			[-0.5, 0.5],
			[0.5, 0.5],
			[0.5, -0.5]
		];
		const vert = corners.map(xy => [xy[0] * w + x, xy[1] * h + y, z]);
		return {
			uv: [...uv[0], ...uv[3], ...uv[1], ...uv[1], ...uv[3], ...uv[2]],
			xyz: [...vert[0], ...vert[3], ...vert[1], ...vert[1], ...vert[3], ...vert[2]],
		};
	};
	const quad = getQuadGeom(2, 2);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('uv', new THREE.Float32BufferAttribute(quad.uv, 2));
	geo.setAttribute('position', new THREE.Float32BufferAttribute(quad.xyz, 3));

	const mat = this.material('float_to_quad', {
		vertexShader: 'vs_pos',
		fragmentShader: 'fs_float_to_quad',
		uni: {
			map: inputRT,
			fact: {
				value: 1
			},
		},
	});

	const mesh = new THREE.Mesh(geo, mat);
	const scene = new THREE.Scene();
	scene.add(mesh);
	const fake_cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

	rend.render(scene, fake_cam);
}

export {	CUSTOM, renderShadTex }