import { log, flip, img1x1 } from '/_v1_jsm/utils.js'

import { loadGLTF } from '/_v1_jsm/GLTFLoader.js'

import { loadAssets } from '/_v1_jsm/network.js'

import { CUSTOM, renderShadTex } from '/_v1_jsm/custom.js'

import * as THREE from '/_v1_jsm/three.module.js'

import { Tween } from '/_v1_jsm/tween.js'

import { dist, LerpOrbit, QLerp } from '/_v1_jsm/geometry.js'

import { calcBox, rgbaToRgb, qGet, posGet, enableTracking } from '/_v1_jsm/utils_three.js'

import { glMix, glClamp, hslRgb, rgbHsl } from '/_v1_jsm/glsl_ported.js'

import { default as MatSetToon } from '/_v1_js/materials.js'

import { default as MatSetReal } from '/_v1_js/test_materials.js'

const shaders = {
	list: new Set(['texBounce', 'greyPS', 'hslRgb']), // homeScene
	global: null,
	// built_in:
};

const tween = new Tween();

const texldr = new THREE.TextureLoader();

const cust = await new CUSTOM();

function IndexScenes(_renderer, _assets, _HUB) {
	this.renderer = _renderer;
	this.HUB = _HUB;
	_HUB.tween = tween;

	this.cust_shad = false;
	this.phase = 'start';
	this.anim = {};
	this.G = {}; // tweens
	
	const self = this;

	// checkpoints
	this.check = {
		// zoom in
		main: {
			_cnt: 1,
			set cnt(v) {
				this._cnt--;
				if (this._cnt == 0) {
					_HUB.index('chk_main');
					log('chk_main');
				}
			},
		},
		// flip
		flip: {
			_cnt: 2,
			set cnt(v) {
				this._cnt--;
				if (this._cnt == 0) { 
					setTimeout(() => {
						self.phase = 'flip';
						self.anim[self.phase] = self.anim[self.phase + '_init'];
						self.HUB.index('p');
					}, 1200);
				}
			},
		},
		ready: nm => { this.check[nm].cnt-- },
	};

	const gltf = {};
	for (let fname in _assets.gltf) {
		const imp = _assets.gltf[fname]?.scene?.children;
		gltf[fname] = {};
		for (const mesh of imp) gltf[fname][mesh.name] = mesh;
	}

	this.land = gltf.land;
	this.home = gltf.home;
	this.tex = _assets.tex;
	this.models = {};
	this.reset = {};

	this.G.orbit = {
		flip: {
			get pb() { return posGet(self.camera) },
			pe: [0.1605, 0.51266, 0.73911],
			qe: [0.9515, -0.29033, 0.09984, -0.019087],
			tar: [-0.02422, 0.008603, -0.0063698],
			ext: {},
		},
		// start: { p, q, tar }
		rh: {
			p: [0.14773, 0.15953, 0.145249],
			q: [0.9398, -0.22262, 0.258695, 0.01699],
			tar: [0.03191, 0.05616, -0.040338],
			ext: {},
		},
		init(nm, duration, ease, cb, _beg, _end) {
			const dat = this[nm];
			dat.ql = dat.ql || new THREE.Quaternion();
			if (nm[0] == 'r') { 
				const [beg, end] = flip(this.start, dat, self.anim.dir > 0);
				dat.olerp = new LerpOrbit(beg.p, end.p, end.tar);
				dat.qlerp = new QLerp(beg.q, end.q);
			} else {
				dat.olerp = new LerpOrbit(dat.pb, dat.pe, dat.tar);
				dat.qlerp = new QLerp(qGet(self.camera), dat.qe);
			}
			const obj = {
				beg: { t: 0 },
				end: { t: 1 },
				duration,
				ease,
				ext: dat.ext,
				cb,
			};
			if (_beg) {
				obj.beg = { ...obj.beg, ..._beg };
				obj.end = { ...obj.end, ..._end };
			}
			tween.add(obj);
		},
		lerp(nm, t, wise = 1) {
			const dat = this[nm];
			const [_, pos] = dat.olerp.set(t);
			self.camera.position.set(...pos);

			const q = dat.qlerp.set(t, wise);
			dat.ql.set(q[1], q[2], q[3], q[0]);
			self.camera.setRotationFromQuaternion(dat.ql);
		},
	};

	this.InitAnim();
}

const cameraLookAt = (cam, lookAt) => {
	cam.lookAt(...lookAt);
	cam.userData.lookAt = [...lookAt];
};

IndexScenes.prototype.dustScene = 

IndexScenes.prototype.homeScene = function (scene, camera) {
	const loc = this.rings.h.center;

	const home_dist = () => {
		const d = dist(posGet(camera), loc);
		return d / camera.far;
	};
	let hd0; // max home_dist
	// Y = kX + c; Y == 0 @ X e[0,a]; Y == 1 @ X e[b,1]; X = home_dist() / hd0 e[0,1];
	// k = 1 / (b - a); c = - a / (b - a);
	const hd_unit = () => {
		const [a, b] = [0.25, 0.75];
		const k = 1 / (b - a);
		const c = -a / (b - a);
		const x = home_dist() / hd0;
		return glClamp(k * x + c, 0, 1);
	};
	
	const greyPS = sRGB => {
      // photoshop desaturate
		const bw = 0.5 * (
			Math.min(sRGB[0], Math.min(sRGB[1], sRGB[2])) +
			Math.max(sRGB[0], Math.max(sRGB[1], sRGB[2]))
		);
      return bw;
	};

	const water = { rgb: [0, 0.5, 0.68] };
	water.grey = hslRgb([0.69657, 0.3, Math.min(0.5, greyPS(water.rgb))]);

	let monod = 0;
	const monochr = {
		value: {
			hsl: [0.69657, 0.3, 1],
			get dist() { return monod },
		}
	};

	const onCamChange = () => {
		monod = hd_unit();
		// update water
		const wmatrgb = water?.mat?.color;
		if (wmatrgb) {
			const mix = glMix(water.rgb, water.grey, monod);
			const chan = 'rgb';
			for(const ch in chan) wmatrgb[chan[ch]] = mix[ch];
		}
	};

	this.reset.home = () => {
		hd0 = home_dist();
		onCamChange();
		this.HUB.subs.push(onCamChange);
	};

	const [mat, amb, dir] = MatSetReal(shaders, loc, monochr);

	const base_map = texldr.load(
		'/_v1_composites/uv_materials.png',
		() => { this.check.ready('flip') },
		undefined,
		err => { console.log('base texture load err:', err)}
	);
	base_map.flipY = false;

	// create shader materials
	const shmat = {};
	for (const nm in mat) {
		mat[nm].id = nm;
		shmat[nm] = cust.material('lamb', mat[nm]);
		cust.addTexture('map', shmat[nm], base_map);
	}

	const home = new THREE.Object3D();
	home.name = 'home';

	const convertRange = (r, flip = true) => {
		if (flip) {
			r.v[0] = 1 - r.v[0];
			r.v[1] = 1 - r.v[1];
		}
		for (const uv of ['u', 'v']) {
			const arr = r[uv];
			arr[2] = Math.abs(arr[1] - arr[0]);
			arr[3] = 1 / arr[2];
		}
	};

	const setColor = (r, rr, g, gr, b, br) => (
		{
			value: [
				r + rr * Math.random(),
				g + gr * Math.random(),
				b + br * Math.random()
			]
		}
	);

	const log_texfact = { x: 1, y: 2.5 };
	// uni for texBounce
	const log_range = { u: [0.1, 0.99, 0, 0], v: [0.885, 0.99, 0, 0] };
	// log_range comes from non-flipped image measurements -> flip here to match tex .flipY
	convertRange(log_range);

	const door_range = {
		u: [346, 660, 0, 0], v: [147, 224, 0, 0],
		off: [0, 0,   1, 0], fact: [2, 2,   1, 0] // [2],[3] cond of bounce
	};
	['u', 'v'].forEach(nm => { door_range[nm] = door_range[nm].map(e => e/1024) });
	convertRange(door_range, false);

	const roof_range = { u: [0, 1, 0, 0], v: [0.28125, 0.41015625, 0, 0] };
	convertRange(roof_range, false);

	const floor_range = [576, 289, 0, 143, 96, 0, 0, 0, 0].map(e => e / 1024);
	floor_range[6] = 3; // tiling
	floor_range[7] = 8.17;

	const fire_range = { bot: [304, 291, 0, 243, 150, 0, 0, 0, 0].map(e => e / 1024) };
	fire_range.mid = [...fire_range.bot];
	fire_range.top = [...fire_range.bot];
	const ftile = { bot: [4, 3], mid: [3, 12], top: [4, 1] };
	for (const sub in fire_range) {
		fire_range[sub][6] = ftile[sub][0];
		fire_range[sub][7] = ftile[sub][1];
	}
	const fcolor = { bot: [1, 1, 1], mid: [1, 1, 0.8], top: [0.9, 0.9, 0.8] };
	
	const yard_range = [3, 456, 0, 193, 69, 0, 0, 0, 0].map(e => e / 1024);
	yard_range[6] = 9;
	yard_range[7] = 9;
	
	for (const nm in this.home) {
		const mesh = this.home[nm];
		home.add(mesh);
		const [coll, sub, mid] = nm.split('_');
		if (coll == 'base' || coll == 'stubs') {
			mesh.material = cust.shallowCopyMat(shmat.bounce_uv_cond);
			const box = calcBox(mesh.geometry, true);
			const sc = mesh.scale;
			const size = Math.max(box.xsize * sc.x, box.ysize * sc.y, box.zsize * sc.z);
			mesh.material.uniforms.color = setColor(0.85, 0.1, 0.98, 0.02, 0.98, 0.02);
			mesh.material.uniforms.uvmap = {
				value: [
					...log_range.u,
					...log_range.v,
					0.88 * Math.random(), 0.05 * Math.random(), 0, 0.092,
					log_texfact.x * size, log_texfact.y, 0.12, 0
				]
			};
		} else if (mesh.name == 'yard_land') {
			mesh.material = cust.shallowCopyMat(shmat.tile_uv);
			mesh.material.uniforms.uvmap = { value: yard_range };
			mesh.geometry.attributes.color =
				new THREE.BufferAttribute(rgbaToRgb(mesh.geometry.attributes.color.array), 3);
			mesh.material.vertexColors = true;

		} else if (coll == 'door') {
			mesh.material = cust.shallowCopyMat(shmat.bounce_uv_cond);
			const fact = [...door_range.fact];
			if (sub == 'small') {
				fact[0] = 4;
				fact[1] = 6;
			}
			mesh.material.uniforms.uvmap = {
				value: [
					...door_range.u,
					...door_range.v,
					...door_range.off,
					...fact,
				]
			};
			mesh.material.uniforms.color = {
				value: sub == 'big' ?
					[0.3, 0.1, 0.1] : [0.5, 0.33, 0.25]
			};
			cust.addDefine(mesh.material, 'fragment', 'MAPMIX');
			mesh.material.uniforms.mapmix = { value: sub == 'big' ? 0.33 : 0.3 };
			
		} else if (['triwall', 'window', 'porch', 'rock'].includes(coll)) {
			mesh.material = cust.shallowCopyMat(shmat.def);
			if (coll == 'porch') {
				mesh.material.uniforms.color = setColor(0.7, 0.05, 0.6, 0.05, 0.6, 0.05);

			} else if (coll == 'window') {
				cust.addDefine(mesh.material, 'fragment', 'MAPMIX');
				mesh.material.uniforms.mapmix = { value: 0.25 };

			} else if (coll == 'rock') {
				let mx = 0.33;
				if (mid < 5) {
					const i = parseInt(mid);
					mesh.material.uniforms.color = setColor(
						0.03 + 0.18 * i, 0, 0.02 + 0.18 * i, 0, 0.05 + 0.15 * i, 0
					);

				} else { // sub == 'big'
					mx = 0.66;
					mesh.material.uniforms.color = setColor(0.55, 0.1, 0.5, 0.1, 0.1, 0.1);
				}
				cust.addDefine(mesh.material, 'fragment', 'MAPMIX');
				mesh.material.uniforms.mapmix = { value: mx };
			}

		} else if (coll == 'roof') {
			mesh.material = cust.shallowCopyMat(shmat.bounce_v);
			mesh.material.uniforms.color = {
				value: [
					0.8 + 0.05 * Math.random(),
					0.8 + 0.05 * Math.random(),
					0.75 + 0.05 * Math.random()
				]
			};
			mesh.material.uniforms.uvmap = {
				value: [
					...roof_range.u,
					...roof_range.v,
					0, Math.random() * roof_range.v[2], 0, 0,
					1, 1, 0, 0
				]
			};

		} else if (coll == 'floor' || coll == 'fireplace') {
			mesh.material = cust.shallowCopyMat(shmat.tile_uv);
			mesh.material.uniforms.uvmap = {
				value: coll == 'floor' ? floor_range : fire_range[sub],
			};
			if (coll == 'fireplace') mesh.material.uniforms.color = { value: fcolor[sub] };

		} else if(coll == 'water') {
			water.mat = mesh.material = new THREE.MeshBasicMaterial({
				color: new THREE.Color(...water.rgb),
				transparent: true,
				opacity: 0.3,
			});
		
		} else {
			mesh.material = shmat.def;
			//mesh.visible = false;
		}
	}
	home.scale.set(0.014, 0.014, 0.014);
	home.rotation.y = -0.5940707;
	home.position.set(0.079, 0.09643, 0.04876);

	this.models.home = home;

	//cust.makeShadowTree(scene);

	return [];
}

IndexScenes.prototype.mainScene = function (w, h) {

	const group = new THREE.Object3D();
	group.name = 'mainScene : group';
	const scene = new THREE.Scene();
	scene.name = 'mainScene';
	scene.add(group);

	const [near, far] = [0.01, 100];
	const mid = -0.5 * (near + far);
	const camera = new THREE.PerspectiveCamera(45, w / h, near, far);
	camera.position.set(0, -50, 0);
	cameraLookAt(camera, [0, 0, 0]);

	const [mat, lgts, spec, clr_off, rdata] = MatSetToon(camera, () => { this.check.ready('main') });
	this.lgts = lgts;
	this.spec = spec;
	this.clr_off = clr_off; // land clr + tex -> clr_off

	const ui = {
		//spec: spec_test,
		//lgts: {pnt: lgts.pnt_ring.h },
	};

	const base_map = this.tex.uvbigland;
	base_map.flipY = false;

	// create shader materials
	const shmat = {};
	for (const nm in mat) {
		mat[nm].id = nm;
		shmat[nm] = cust.material('lamb', mat[nm]);
		if (nm == 'land') cust.addTexture('map', shmat[nm], base_map);
	}
	
	// rings setup
	this.rings = rdata;
	['home', 'tree', 'sky', 'fract', 'qcode', 'art', 'misc'].forEach(nm => { 
		const robj = this.rings[nm[0]];
		robj.ring = [];
		robj.floor = [];
	});
	
	for (const nm in this.land) {
		const mesh = this.land[nm];
		const [coll, sub, _mid] = nm.split('_');
		if (coll[0] == 'r' || sub == 'ring' || sub == 'floor') {
			mesh.material = shmat.gentop;
			const mid = parseInt(_mid);
			this.rings[coll[1]][sub][mid] = mesh;
			group.add(mesh);
		} else if(coll == 'bigland') {
			mesh.material = shmat.land;
			group.add(mesh);
		} else {
			mesh.material = new THREE.MeshBasicMaterial();
			group.add(mesh);
		}
	}

	//const hlp = new THREE.AxesHelper(1);
	//hlp.material.depthTest = false;
	//scene.add(hlp);

	//cust.makeShadowTree(scene);

	scene.userData.selectable = true;
	scene.userData.hints = {
		left:
			`This is a texturized wall. Don't look at it for too long.`,
	};

	this.scene = scene;
	this.camera = camera;
	this.shmat = shmat;
	this.mid = mid;

	return [scene, camera];//, ui];
}

IndexScenes.prototype.InitAnim = function () {
	
	// fade in
	this.anim.start_init = () => {
		this.camera.position.set(0, -50, 0);
		cameraLookAt(this.camera, [0, 0, 0]);
		this.G.start = {};
		const obj = {
			beg: { y: -50, dec: 10 },
			end: { y: -1.5, dec: 16 },
			duration: 3000,
			ease: 1,
			ext: this.G.start,
			cb: this.anim[this.phase + '_dispose'],
		}
		tween.add(obj);
		this.anim[this.phase] = this.anim[this.phase + '_main'];
	};
	this.anim.start_main = () => {
		tween.tick();
		this.camera.position.y = this.G.start.y;
		this.lgts.pnt_bot.userData.decay = this.G.start.dec;
	};
	this.anim.start_dispose = () => {
		this.HUB.index('c');
		this.HUB.index('s');
		const setPower = val => {
			this.lgts.pnt_bot.userData.power = val;
			this.HUB.index('u');
		};
		const int = 120;
		setTimeout(() => { setPower(0.07) }, int);
		setTimeout(() => { setPower(0.15) }, int * 2);
		setTimeout(() => { setPower(0.05) }, int * 3);
		setTimeout(() => { setPower(0.20) }, int * 4);
		this.check.ready('flip');
	};

	// flip to the top
	this.anim.flip_init = () => {
		this.G.orbit.init('flip', 1000, 1, this.anim[this.phase + '_dispose']);
		this.anim[this.phase] = this.anim[this.phase + '_main'];
	};
	this.anim.flip_main = () => {
		tween.tick();	
		const t = this.G.orbit.flip.ext.t;

		this.G.orbit.lerp('flip', t);

		this.lgts.amb.userData.power = 0.15 + (0.5 - 0.15) * t;
		this.spec.strength = 1 - t;
	};
	this.anim.flip_dispose = () => {
		this.HUB.index('s');
		this.HUB.index('x', this.G.orbit.flip.tar);
		setTimeout(() => {
			this.phase = 'glow';
			this.anim[this.phase] = this.anim[this.phase + '_init'];
			this.HUB.index('p');
		}, 250);
	};
	
	// rings glow
	this.anim.glow_init = () => {

		const nm = 'h';
		const prf = `r${nm}_`;
		const ring = this.rings[nm];
		const prud = ring.pnt.userData;
		const pow0 = prud.power;
		prud.power = 0;

		for (const sub of ['ring', 'floor']) {
			const robj = ring[sub];
			const mat_nm = prf + sub;
			for (let mid = 0; mid < 8; mid++) {
				const mesh = robj[mid];
				if (sub == 'ring') {
					const mat = mesh.material = cust.shallowCopyMat(this.shmat[mat_nm]);
					mat.uniforms.color = { value: this.clr_off };
				} else if (sub == 'floor') {
					mesh.material = this.shmat[mat_nm];
				}
			}
		}

		this.G.glow = {};
		const obj0 = {
			beg: { d: 0, t: 0, p: 0 },
			end: { d: 1, t: 1, p: pow0 },
			duration: 250,
			ease: 0,
			ext: this.G.glow,
			cb: () => { tween.add(obj1) },
		};
		const obj1 = {
			beg: { d: 1, t: 1, p: pow0 },
			end: { d: 1.3, t: 0.1, p: 0.1 },
			duration: 1000,
			ease: 1,
			ext: this.G.glow,
			cb: this.anim[this.phase + '_dispose'],
		};
		tween.add(obj0);
		
		this.dustScene();
		this.dustAdd('h');

		this.reset.home();
		this.scene.add(this.models.home);

		this.anim[this.phase] = this.anim[this.phase + '_main'];
	};
	this.anim.glow_main = () => {
		tween.tick();

		const nm = 'h';
		const ring = this.rings[nm];
		ring.pnt.userData.power = this.G.glow.p;
		const clr_on = ring.clr;
		ring.ring.forEach(mesh => { 
			mesh.material.uniforms.color.value = glMix(this.clr_off, clr_on, this.G.glow.t);
		});

		this.dustSet('h', this.G.glow.d);
	};
	this.anim.glow_dispose = () => {
		this.dustRem('h');
		// start state ring color
		const ring = this.rings.h;
		ring.start_clr = ring.ring[0].material.uniforms.color.value;
		// mark all rings orbits start state
		const self = this;
		this.G.orbit.start = {
			p: posGet(self.camera),
			q: qGet(self.camera),
			tar: [...self.G.orbit.flip.tar],
		};
		setTimeout(() => {
			this.HUB.index('s');
			// ring sections anim
			this.HUB.ringOn = this.HUB.ringOn || (nm => {
				log('ringon', nm);
				const ring = this.rings[nm];
				const clr_on = ring.clr;
				const [fmesh, rmesh] = [ring.floor, ring.ring];
				const floor_on = 'r' + nm + '_floor_on';
				for (let mid = 0; mid < 8; mid++) {
					// ring sections on
					setTimeout(() => {
						rmesh[mid].material.uniforms.color.value = clr_on;
						fmesh[mid].material = this.shmat[floor_on];
						ring.pnt.userData.power += 0.012;
						this.HUB.index('u');
					}, mid * 120);
					// zoom in 
					setTimeout(() => {
						this.anim.dir = 1;
						const ph = this.phase = 'r' + nm;
						this.anim[ph] = this.anim[ph + '_init'];
						this.HUB.index('p');
					}, 8 * 120 + 100);
				}
			});

			this.HUB.raycast = true; // select rings
		}, 50);
	};

	// rings orbit anim
	this.anim.rh_init = () => {
		const model = this.models.home;
		const anim = this.anim;
		const ring = this.rings.h;
		const zoom = anim.dir > 0;
		anim.rh_beg = anim.rh_beg || {
			posx: model.position.x,
			posz: model.position.z,
			roty: model.rotation.y,
		};
		anim.rh_beg.pow = zoom ? ring.pnt.userData.power : 0.1;
		anim.rh_beg.pow_mult = zoom ? 10 : 2;
		anim.rh_beg.clr = zoom ? ring.clr : ring.start_clr;
		anim.rh_end = anim.rh_end || {
			posx: 0.088,
			posz: 0.04476,
			roty: 3.104513,
			pow: 0.02,
			pow_mult: 2,
			clr: ring.start_clr,
		};
		const [beg, end] = flip(anim.rh_beg, anim.rh_end, zoom);
		const ph = this.phase;
		this.G.orbit.init('rh', 1500, 1, anim[ph + '_dispose'], beg, end);
		anim[ph] = anim[ph + '_main'];
	};
	this.anim.rh_main = () => {
		tween.tick();
		const ext = this.G.orbit.rh.ext;

		this.G.orbit.lerp('rh', ext.t, -this.anim.dir);
		const model = this.models.home;
		model.position.x = ext.posx;
		model.position.z = ext.posz;
		model.rotation.y = ext.roty;

		const ring = this.rings.h;
		const rpud = ring.pnt.userData;
		rpud.power = ext.pow;
		rpud.pow_mult = ext.pow_mult;
		ring.ring.forEach(mesh => { mesh.material.uniforms.color.value = ext.clr });
	};
	this.anim.rh_dispose = () => {
		this.HUB.index('s');
		this.HUB.index('x', this.G.orbit.rh.tar);
		if (this.anim.dir > 0)
			this.HUB.setZoomOutClick('h');
		else
			this.HUB.raycast = true;
	};

	this.anim.start = this.anim.start_init;
}

IndexScenes.prototype.render = function (anim, lid) { 
	if(this.cust_shad) renderShadTex(this.renderer, this.scene, cust, lid);
	if(!lid) this.renderer.render(this.scene, this.camera);
	if(anim) this.anim[this.phase]();
}

export { shaders, IndexScenes }