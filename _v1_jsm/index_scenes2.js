import * as THREE from '/_v1_jsm/three.module.js'

import { CUSTOM } from '/_v1_jsm/custom.js'

import { log, Counter } from '/_v1_jsm/utils.js'

import { default as MatSetToon } from '/_v1_js/materials.js'

import { dustScene } from '/_v1_js/scene_dust.js'
import { fractScene } from '/_v1_js/scene_fract.js'

import { Tween } from '/_v1_jsm/tween.js'

import { AnimObj, camOrbitInit, camOrbitLerp } from '/_v1_jsm/animation.js'

import { glMix, glClamp } from '/_v1_jsm/glsl_ported.js'

import { posGet, qGet } from '/_v1_jsm/utils_three.js'

const shaders = {
	list: new Set(['texBounce', 'greyPS', 'hslRgb']), // homeScene
	global: null,
	// built_in:
};

const cameraLookAt = (cam, lookAt) => {
	cam.lookAt(...lookAt);
	cam.userData.lookAt = [...lookAt];
};

const tween = new Tween();
const aniobj = new AnimObj();

//const texldr = new THREE.TextureLoader();

const cust = await new CUSTOM();

function IndexScenes(renderer, assets, HUB) {
	this.renderer = renderer;
	this.HUB = HUB;
	this.assets = assets;

	HUB.tween = tween;

	const setPhase = aniobj.setPhase.bind(aniobj);

	const gltf = {};
	for (let fname in assets.gltf) {
		const imp = assets.gltf[fname]?.scene?.children;
		const obj = gltf[fname] = {};
		for (const mesh of imp) obj[mesh.name] = mesh;
	}

	this.land = gltf.land;
	this.home = gltf.home;
	this.tex = assets.tex;
	
	// checkpoints
	this.check = {
		// land fly in
		main: new Counter(1, () => {
			HUB.cmd('chk_main');
			log('chk_main');
		}),
		// top flip
		flip: new Counter(3, () => {
			setPhase('flip');
			HUB.cmd('p');
		}),
	};

	this.names = ['home', 'tree', 'sky', 'fract', 'qcode', 'art', 'misc'];

	this.subs = { 
		h: null,
		t: null,
		s: null,
		f: null,
		q: null,
		a: fractScene,
		m: null,
	};

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
	camera.position.set(0, -60, 0);
	cameraLookAt(camera, [0, 0, 0]);

	const [mat, lgts, spec, clr_off, rdata] = MatSetToon(camera);
	this.lgts = lgts;
	this.spec = spec;
	this.clr_off = clr_off; // land clr + tex -> clr_off

	const ui = {
		//spec: spec_test,
		//lgts: {pnt: lgts.pnt_ring.h },
	};

	const base_map = this.tex.uvbigland;
	base_map.flipY = false;

	const ringlight = this.tex.ringlight;
	ringlight.generateMipmaps = false;

	// create shader materials
	const shmat = {};
	for (const nm in mat) {
		mat[nm].id = nm;
		shmat[nm] = cust.material('lamb', mat[nm]);
		if (nm == 'land')
			cust.addTexture('map', shmat[nm], base_map);
		else if (['ring', 'floor'].includes(nm.split('_')[1]))
			shmat[nm].uniforms.tlmap.value = ringlight; // replace dummy
	}
	
	// rings setup
	this.rdata = rdata; // {rad, clr, pnt, center}
	for(const nm in rdata) { 
		const robj = this.rdata[nm];
		robj.ring = [];
		robj.floor = [];
	}

	for (const nm in this.land) {
		const mesh = this.land[nm];
		const [coll, sub, _mid] = nm.split('_');
		if (coll[0] == 'r' || sub == 'ring' || sub == 'floor') {
			mesh.material = shmat.gentop;
			const mid = parseInt(_mid);
			this.rdata[coll[1]][sub][mid] = mesh;
			group.add(mesh);
		} else if(coll == 'bigland') {
			mesh.material = shmat.land;
			group.add(mesh);
		} else {
			mesh.material = new THREE.MeshBasicMaterial();
			group.add(mesh);
		}
	}

	//const hlp = new THREE.AxesHelper(100);
	//hlp.material.depthTest = false;
	//scene.add(hlp);

	this.scene = scene;
	this.camera = camera;
	this.shmat = shmat;
	this.mid = mid;

	this.check.main.tick(); // ready

	return [scene, camera];//, ui];
}

IndexScenes.prototype.InitAnim = function () {

	const HUB = this.HUB;
	const anim = aniobj.anim;
	const G = aniobj.G;
	const setPhase = aniobj.setPhase.bind(aniobj); 
	const setStep = aniobj.setStep.bind(aniobj);
	
	this.orbits = {
		_: {
			pe: [0.0, 0.0, 0.0],
			qe: [0.0, 0.0, 0.0, 0.0],
			tar: [0.0, 0.0, 0.0],
			ext: {},
			ql: new THREE.Quaternion(),
		},
		h: {
			pe: [0.131972,  0.192059,  0.191049],
			qe: [0.946355, -0.297879,  0.122727, -0.024847],
			tar: [0.059634, 0.028787, -0.040936],
			ext: {},
			ql: new THREE.Quaternion(),
		},
		t: {
			pe: [0.245701,   0.164964,  0.335136],
			qe: [0.924103,  -0.343275, -0.165881, -0.026046],
			tar: [0.369447, -0.110680,  0.031113],
			ext: {},
			ql: new THREE.Quaternion(),
		},
		s: {
			pe: [0.313619,  0.171298,   0.017205],
			qe: [0.909416, -0.385624,   0.155617, -0.006178],
			tar: [0.243984, 0.002064,  -0.141066],
			ext: {},
			ql: new THREE.Quaternion(),
		},
		f: {
			pe: [-0.003309,  0.186422,  -0.070654],
			qe: [0.925574,  -0.328943,   0.170494, 0.077709],
			tar: [-0.039431, 0.099640,  -0.169732],
			ext: {},
			ql: new THREE.Quaternion(),
			wise: -1,
		},
		q: {
			pe: [-0.363623,  0.177682,  0.262134],
			qe: [0.929039,  -0.357629,  0.090912, 0.026877],
			tar: [-0.363626, 0.177668,  0.262119],
			ext: {},
			ql: new THREE.Quaternion(),
		},
		a: {
			pe: [-0.110820, 0.165538, 0.106997],
			qe: [0.929210, -0.241351, 0.279700, 0.009173],
			tar: [-0.261781, 0.032652, -0.105962],
			ext: {},
			ql: new THREE.Quaternion(),
			wise: -1,
		},
		m: {
			pe: [-0.216492, 0.223787, 0.015146],
			qe: [0.715874, -0.242129, 0.606136, 0.247982],
			tar: [-0.216523, 0.223760, 0.015140],
			ext: {},
			ql: new THREE.Quaternion(),
			wise: -1,
		},
	};

	// main fade in
	anim.start_init = () => {
		this.camera.position.set(0, -60, 0);
		cameraLookAt(this.camera, [0, 0, 0]);
		G.start = {};
		const obj = {
			beg: { y: -60, dec: 10 },
			end: { y: -1.5, dec: 16 },
			duration: 3000,
			ease: 1,
			ext: G.start,
			cb: anim.start_dispose,
		}
		tween.add(obj);
		setStep('main');
	};
	anim.start_main = () => {
		tween.tick();
		this.camera.position.y = G.start.y;
		this.lgts.pnt_bot.userData.decay = G.start.dec;
	};
	anim.start_dispose = () => {
		HUB.cmd('c');
		HUB.cmd('s');
		const setPower = val => {
			this.lgts.pnt_bot.userData.power = val;
			HUB.cmd('u');
		};
		const int = 120;
		setTimeout(() => { setPower(0.07) }, int);
		setTimeout(() => { setPower(0.15) }, int * 2);
		setTimeout(() => { setPower(0.05) }, int * 3);
		setTimeout(() => { setPower(0.20) }, int * 4);
		this.check.flip.tick();

		setTimeout(() => {
 			// will call check.flip.tick()
			dustScene.init.call(this, aniobj, tween);
			fractScene.init(this, aniobj, tween);
		}, int * 4 + 500); // 500 - min delay
	};

	// top flip
	anim.flip_init = () => {
		const dat = G.flip = {
			pe: [0.1605, 0.51266, 0.73911],
			qe: [0.9515, -0.29033, 0.09984, -0.019087],
			tar: [-0.02422, 0.008603, -0.0063698],
			ext: {},
			ql: new THREE.Quaternion(),
		};
		tween.add(camOrbitInit(this.camera, dat, 1000, 1, anim.flip_dispose));
    	setStep('main');
	};
	anim.flip_main = () => {
		tween.tick();
    	const dat = G.flip;
    	const t = dat.ext.t;
		camOrbitLerp(this.camera, dat, t, 1);

		this.lgts.amb.userData.power = 0.15 + (0.5 - 0.15) * t;
		this.spec.strength = 1 - t;
	};
	anim.flip_dispose = () => {
		HUB.cmd('s');
		HUB.cmd('x', G.flip.tar);
		setTimeout(() => {
			setPhase('glow');
			HUB.cmd('p');
		}, 50);
	};

	// glow
	anim.glow_init = () => {

		G.glow = {};
		const cnt = new Counter(this.names.length, () => { setStep('dispose') });

		let start = 0;
		for (const nm in this.rdata) {
			const robj = this.rdata[nm];

			// floor + rings : gentop -> pnt lgt mat
			const prf = `r${nm}_`;
			for (const sub of ['ring', 'floor']) {
				const rarr = robj[sub];
				const mat_nm = prf + sub;
				const shm = this.shmat[mat_nm];
				const shm_clr = shm.uniforms.color.value;
				for (let mid = 0; mid < 8; mid++) {
					const mesh = rarr[mid];
					if (sub == 'ring') {
						mesh.material = cust.shallowCopyMat(shm);
						mesh.material.uniforms.color = { value: [...shm_clr] }; // to change color per
					} else if (sub == 'floor') {
						const dat = mesh.userData;
						dat.mat = mesh.material = shm;
						dat.mat_on = this.shmat[mat_nm + '_on'];
					}
				}
			}

			const prud = robj.pnt.userData;
			const pow0 = prud.power;
			prud.power = 0;
			
			// rings elevations
			const ele = { 
				h: 0.0003,
				t: 0.0002,
				s: 0.0001,
				f: 0.0002,
				q: 0.0001,
				a: 0.0002,
				m: 0.0001,
			};

			const glow = G.glow[nm] = new Array(4);
			glow[3] = false; // pop models
			glow[2] = {}; // shared ext
			glow[0] = {
				beg: { d: 0, t: 0, p: 0, e: 0 },
				end: { d: 1, t: 1, p: pow0, e: ele[nm] * 1.2 },
				duration: 250,
				ease: 0,
				ext: glow[2],
				cb: () => { tween.add(glow[1]) },
				start
			};
			glow[1] = {
				beg: { d: 1, t: 1, p: pow0, e: 0 },
				end: { d: 1.3, t: 0.1, p: 0.03, e: 0 },
				duration: 1500,
				ease: 1,
				ext: glow[2],
				cb: () => { dustScene.glow_dispose(nm); cnt.tick(); },
			};
			tween.add(glow[0]);
			dustScene.glow_init(nm);
			start += 150;
		}

		setStep('main');
	};
	anim.glow_main = () => {
		tween.tick();
		for (const nm in this.rdata) {
			const glow = G.glow[nm];
			const ext = glow[2];
			const robj = this.rdata[nm];
			robj.pnt.userData.power = ext.p;
			dustScene.glow_main(nm);

			const e = ext.e;
			const t = ext.t;
			if (t) {
				const clr_on = robj.clr;
				const mix = glMix(this.clr_off, clr_on, t);
				robj.ring.forEach(mesh => {
					mesh.material.uniforms.color.value = mix;
					if(e) mesh.position.y += e;
				});
				if (e) robj.floor.forEach(mesh => { mesh.position.y += e });
				if (!glow[3]) { // pop models
					glow[3] = true;
					this.subs[nm]?.show(nm);
				}
			}
		}
	};
	anim.glow_dispose = () => {
		for (const nm in this.rdata) {
			const robj = this.rdata[nm];
			robj.ring.forEach(mesh => {
				const clr = mesh.material.uniforms.color.value;
				robj.clr_mid = [...clr];
				robj.clr_high = glMix(clr, robj.clr, 0.33);
			});
		}
		HUB.cmd('s');
		HUB.cmd('et'); // enable cam tracking & raycast
	};

	// main orbits
	anim.orbit_init = (nm, dir) => {
		const _ = this.orbits._;
		if (dir) { // update starting point & set opp wise
			_.pe = posGet(this.camera);
			_.qe = qGet(this.camera);
			HUB.cmd('t', _.tar);
			_.wise = this.orbits[nm].wise || 1;
			_.wise *= -1;
		}
		const dat = dir ? this.orbits[nm] : _;
		G.orbit = { dat, dir, robj: this.rdata[nm], nm };
		dat.ext = {}; // reset t
		tween.add(camOrbitInit(this.camera, dat, 1000, 1, anim.orbit_dispose));
		setPhase('orbit');
    	setStep('main');
	};
	anim.orbit_main = () => {
		tween.tick();
		const g = G.orbit;
		const dir = g.dir;
		const dat = g.dat;
    	const t = dat.ext.t;
		camOrbitLerp(this.camera, dat, t, 1);
		if (dir) { 
			const robj = g.robj;
			const [clr_high, clr_mid] = [robj.clr_high, robj.clr_mid];
			const mix = glMix(clr_high, clr_mid, t);
			robj.ring.forEach(mesh => {
				mesh.material.uniforms.color.value = mix; // dim rings
			});
			// dim floor
			const lgt_ud = robj.pnt.userData;
			lgt_ud.power = 0.05 - 0.02 * t;
			lgt_ud.pow_mult = glMix(20, 2, t)[0];
		}
		// models zoom in/out effects
		this.subs[g.nm]?.orbit_main(dir, t);
	};
	anim.orbit_dispose = () => {
		const g = G.orbit;
		HUB.cmd('s');
		HUB.cmd('x', g.dat.tar);
		if (g.dir) {
			setTimeout(() => {
				const robj = g.robj;
				// reset floor
				robj.floor.forEach(mesh => { mesh.material = mesh.userData.mat });
				robj.pnt.userData.pow_mult = 20;
			}, 10); // delay as tick calls orbit_dispose before the last orbit_main 
			HUB.cmd('b'); // show exit button
			// models
			this.subs[g.nm]?.orbitIn(); // TODO remove ?
		}
		else HUB.cmd('o');
	};

	setPhase('start');
}

IndexScenes.prototype.hightlight = function (data) {
	const [nm, dsq, rsq] = data;
	const robj = this.rdata[nm];
	const [clr_high, clr_mid] = [robj.clr_high, robj.clr_mid];
	
	const rarr = robj.ring;
	const farr = robj.floor;
	const [r0, r1] = [0.25 * rsq, 2 * rsq]; // min/max dist of lerp
	const k = -8 / (r1 - r0);
	const b = -k * r1;
	const raw = glClamp(k * dsq + b, 0, 8);
	const fact = Math.round(raw);
	for (let mid = 0; mid < fact; mid++) {
		const [rmesh, fmesh] = [rarr[mid], farr[mid]];
		rmesh.material.uniforms.color.value = clr_high;
		fmesh.material = fmesh.userData.mat_on; 
	}
	for (let mid = fact; mid < 8; mid++) {
		const [rmesh, fmesh] = [rarr[mid], farr[mid]];
		rmesh.material.uniforms.color.value = clr_mid;
		fmesh.material = fmesh.userData.mat;
	}
	robj.pnt.userData.power = 0.03 + 0.02 * (fact / 8);
	if (fact == 8) this.HUB.hot = nm;
	
	// models decor highlight
	this.subs[nm]?.highlight(raw);
}

IndexScenes.prototype.orbitInit = function (data) {
	const [nm, dir] = data;
	if (dir) {
		aniobj.anim.orbit_init(nm, dir);
		this.HUB.cmd('p');
	} else {
		const cb = () => { aniobj.anim.orbit_init(nm, dir) };
		const orb_out = this.subs[aniobj.G.orbit.nm]?.orbitOut;
		if (orb_out)
			orb_out(cb);
		else {
			cb();
			this.HUB.cmd('p');
		}
	}
}

IndexScenes.prototype.render = function (anim) {
	this.renderer.render(this.scene, this.camera);
	if(anim) aniobj.anim[aniobj.phase]?.();
}

export { shaders, IndexScenes }