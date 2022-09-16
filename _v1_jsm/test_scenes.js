import { hslRgb, rgbHsl, rotate } from '/_v1_jsm/glsl_ported.js'

import { CUSTOM, renderShadTex } from '/_v1_jsm/custom.js'

import * as THREE from '/_v1_jsm/three.module.js'
//import * as THREE from '/_v1_jsm/three141.showshader.js'

import { dot, quaternFromETh, quaternFromVects } from '/_v1_jsm/geometry.js'

import GMRNG from '/_v1_jsm/rng.js'

import { log, slog } from '/_v1_jsm/utils.js'

import { addHelper } from '/_v1_jsm/utils_three.js'

import { create as createTree } from '/_v1_jsm/tree.js'

const rng = new GMRNG();
for (let i = 0; i < 10; i++) rng.f01();

const rand = () => {
	 //return Math.random();
	 return rng.f01();
};

const rnd = v => Math.round(v * 2 * (Math.random() - 0.5));
const rnd1 = v => v * 2 * (Math.random() - 0.5);
const rnd2 = v => Math.round(v * Math.random());
const rnd3 = v => v * Math.random();

const cust = await new CUSTOM();

function TestScenes(_renderer) {
	this.renderer = _renderer;
}

/* tree test scene, M - mesh

root - 0(M) ----- 1 - 2 - 3
						|       |
14(M)             |       |
 |                4(M)    7(M)
13 - 12(M) - 11 - 5       |
		|           6       8 - 9 - 10
		15
		|
	  16(M)
		|
		17
*/

TestScenes.prototype.treeScene = function(w, h, callback) {

	const group = new THREE.Object3D();
	const scene = new THREE.Scene();
	scene.name = 'treeScene';
	//scene.background = new THREE.Color(0.01, 0.01, 0.15);
	scene.add(group);

	const [near, far] = [1, 300];
	const mid = -0.5 * (near + far);
	const camera = new THREE.PerspectiveCamera(45, w / h, near, far);
	//const camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, near, far);
	camera.position.set(0, 50, -100);
	const lookAt = [0, 0, mid];
	camera.lookAt(...lookAt);
	camera.userData = { lookAt, mid };

	group.position.set(0, 0, mid);

	const amb = new THREE.AmbientLight(0x06050d, 1.0);

	const dir = new THREE.DirectionalLight(0xffffff, 0.5);
	dir.position.set(0.5, 0.7, 1);
	
	const mat_main = cust.material('lamb', {
		uni: {
			amb: {
				color: [amb.color.r, amb.color.g, amb.color.b],
				get intensity() { return amb.intensity },//0.5 * (1 + Math.sin(amb.intensity * performance.now() * 0.001)) },
			},
			dir: {
				color: [dir.color.r, dir.color.g, dir.color.b],
				get intensity() { return dir.intensity },
				position: [dir.position.x, dir.position.y, dir.position.z],
			},/*
			pnt: [{
				color: [pnt.color.r, pnt.color.g, pnt.color.b],
				get intensity() { return pnt.intensity },
				position: [pnt.position.x, pnt.position.y, pnt.position.z],
				decay: 2,
			},{
				color: [pnt2.color.r, pnt2.color.g, pnt2.color.b],
				get intensity() { return pnt2.intensity },
				position: [pnt2.position.x, pnt2.position.y, pnt2.position.z],
				decay: 2,
			}],
			specular: {
				get position() {
					const pos = camera.position;
					return [pos.x, pos.y, pos.z];
				},
				strength: 1,
				falloff: 6,
			},*/
			//dside: true,
		}
	});

	const obj = [];

	for (let i = 0; i < 18; i++) {
		if ([0, 4, 7, 12, 14, 16].includes(i)) {
			obj[i] = new THREE.Mesh(
				i == 0 ? new THREE.SphereGeometry(1, 32, 16) : new THREE.BoxGeometry(1, 1, 1),
				/*new THREE.MeshBasicMaterial({
				color: `rgb(${32 + rnd2(128)},${32 + rnd2(128)},${32 + rnd2(128)})`,
				wireframe: true,
				})*/
				cust.shallowCopyMat(mat_main),
			);
			obj[i].material.uniforms.color = { value: [0.15 + rnd3(0.5), 0.15 + rnd3(0.5), 0.15 + rnd3(0.5)] }
		} else {
			obj[i] = new THREE.Object3D();
		}
		obj[i].name = 'obj' + i;
		obj[i].position.set(rnd1(5), rnd1(5), rnd1(5));
		obj[i].rotation.set(6 * Math.random(), 6 * Math.random(), 6 * Math.random());
		obj[i].scale.set(1 + rnd1(.5), 1 + rnd1(.5), 1 + rnd1(.5));
	}


	group.add(obj[0]).add(obj[1]).add(obj[2]).add(obj[3]);
	obj[1].add(obj[4]).add(obj[5]).add(obj[6]);
	obj[5].add(obj[11]).add(obj[12]).add(obj[13]);
	obj[13].add(obj[14]);
	obj[12].add(obj[15]).add(obj[16]).add(obj[17]);
	obj[3].add(obj[7]).add(obj[8]);
	obj[8].add(obj[9]).add(obj[10]);

	this.ts_obj = obj;

	this.ts_vel = [];
	for (let i = 0; i < 18; i++) this.ts_vel.push(.005 + rnd3(.010));

	return [scene, camera];
}

TestScenes.prototype.treeSceneAnimate = function() {
	 const ori = [0, 0, 0];
	 for (let i = 0; i < 18; i++) {
		  const sh = this.ts_obj[i];
		  sh.rotation.x += 0.013;
		  sh.rotation.y += 0.007;
		  const [dx, dz] = [sh.position.x - ori[0], sh.position.z - ori[2]];
		  [sh.position.x, sh.position.z] = rotate(dx, dz, this.ts_vel[i]);
		  sh.position.x += ori[0];
		  sh.position.z += ori[2];
	 }
};

TestScenes.prototype.boxScene = function (w, h, callback) {

	const group = new THREE.Object3D();
	const scene = new THREE.Scene();
	scene.name = 'boxScene';
	//scene.background = new THREE.Color(0.01, 0.01, 0.15);
	scene.add(group);

	const [near, far] = [1, 700];
	const mid = -0.5 * (near + far);
	const camera = new THREE.PerspectiveCamera(45, w / h, near, far);
	//const camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, near, far);
	camera.position.set(0, 60, -90);
	const lookAt = [0, 0, mid];
	camera.lookAt(...lookAt);
	camera.userData = { lookAt, mid };

	group.position.set(0, 0, mid);

	// lights

	const amb = new THREE.AmbientLight(0xffffff, 0.005);

	const dir = new THREE.DirectionalLight(0xa0ffa0, 0.4);
	dir.position.set(-30, 70, -200);
	const dir_lookat = [0, 0, mid];

	const pnt0 = new THREE.PointLight(0xffa0a0, 1);
	pnt0.position.set(25, 75, -205);
	//pnt0.position.set(0-49, 1, mid+49);
	const pnt1 = new THREE.PointLight(0xa0a0ff, 1);
	pnt1.position.set(-100, 120, -380);

	amb.name = 'Ambient light';
	dir.name = 'Directional light';
	pnt0.name = 'Point light #0';
	pnt1.name = 'Point light #1';

	pnt0.userData.decay = 2;
	pnt1.userData.decay = 2;
	const getPos = obj => {
		const pos = obj.position;
		return [pos.x, pos.y, pos.z];
	}
	pnt0.userData.power = 0.7 * dot(getPos(group), getPos(pnt0)) / (4 * Math.PI);
	pnt1.userData.power = 0.66 * dot(getPos(group), getPos(pnt1)) / (4 * Math.PI);

	dir.userData.shadow = {
		blur: 5,
		strength: 0.9,
		tex: { w: 1000, h: 1000 },
		cam: new THREE.OrthographicCamera(-700/9, 700/9, 700/9, -700/9, 50, 300),
		lookat: dir_lookat,
	};
	pnt0.userData.shadow = {
		blur: 5,
		strength: 1,
		tex: { w: 1050, h: 875 },
		cam: new THREE.PerspectiveCamera(55, 1, 30, 300),
		lookat: lookAt,
	};
	pnt1.userData.shadow = {
		blur: 5,
		strength: 1,
		tex: { w: 1050, h: 750},
		cam: new THREE.PerspectiveCamera(57, 1, 1, 700),
		lookat: lookAt,
	};

	this.box_lgts = [dir, pnt0, pnt1];

	const mapctrl = { // to control left wall texture
		//scaleX: 0.5,
		//scaleY: 0.5,
		skewX: 10,
		skewY: 10,
		offU: 0.5,
		offV: 0.5,
	};

	const mapctrl2 = { // to control ball texture
		scaleX: 0.1,
		scaleY: 0.1,
		skewX: 0,
		skewY: 0,
		offU: 0,
		offV: 0,
	};

	this.box_map_ctrl = [mapctrl, mapctrl2];

	// extern ui controls
	const ui = {
		gamma: 2.2,
		spec: {
			str: 0.5,
			fo: 6,
		},
		lgts: { amb, dir, pnt0, pnt1 },
		shad_mode: 0,
	};

	const mat_main = cust.material('lamb', {
		uni: {
			gamma: { get value() { return ui.gamma } },
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
				shadow: dir.userData.shadow,
			},
			pnt: [{
				get color() { return [pnt0.color.r, pnt0.color.g, pnt0.color.b] },
				get intensity() { return pnt0.userData.power },
				position: [pnt0.position.x, pnt0.position.y, pnt0.position.z],
				get decay() { return pnt0.userData.decay },
				shadow: pnt0.userData.shadow,
			},{
				get color() { return [pnt1.color.r, pnt1.color.g, pnt1.color.b] },
				get intensity() { return pnt1.userData.power },
				position: [pnt1.position.x, pnt1.position.y, pnt1.position.z],
				get decay() { return pnt1.userData.decay },
				shadow: pnt1.userData.shadow,
			}],
			specular: {
				get position() {
					const pos = camera.position;
					return [pos.x, pos.y, pos.z];
				},
				get strength() { return ui.spec.str },
				get falloff() { return ui.spec.fo },
			},
			shad_mode: { get value() { return ui.shad_mode } },
			//map: ['/_v1_jsm/textures/uv.png', () => { callback('r') }, ],
			//mapctrl
		}
	});

	// light helpers

	addHelper(group, this.box_lgts);

	// box

	const size = 100;
	const geo = new THREE.PlaneGeometry(size, size);

	const PI2 = 0.5 * Math.PI;
	const sz2 = 0.5 * size;
	const pos = { bot: [0, 0, 0], left: [-sz2, 0, 0], right: [sz2, 0, 0], back: [0, 0, 0 - sz2] };
	const rot = { bot: [-PI2, 0, 0], left: [0, PI2, 0], right: [0, -PI2, 0], back: [0, 0, 0] };
	//const clr = { bot: hslRgb([0.5, 0.9, 0.7]) };
	//clr.left = clr.right = clr.back = clr.bot;
	['bot', 'left', 'right', 'back'].forEach(nm => {
		const m = new THREE.Mesh(geo, cust.shallowCopyMat(mat_main));
		m.name = nm;
		m.material.side = THREE.DoubleSide; // disable(GL_CULL_FACE)
		m.position.set(...pos[nm]);
		m.rotation.set(...rot[nm]);
		group.add(m);

		if (nm == 'left') {
			const tex = cust.addTexture('map', m.material, [
				'/_v1_jsm/textures/cube_map.png',
				() => { callback('r') },
				() => { callback('e') },
			]);
			tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
			cust.addTexCtrl('map', m.material, mapctrl);
			//log('left',m.material.fragmentShader.slice(0,200))
		}

		// selectable object
		m.userData.sel = true;
	});

	// shapes

	const geos = [
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.SphereGeometry(1, 32, 16),
		new THREE.TorusKnotGeometry(1, 0.3, 50, 8),
	];

	const sh_num = 10;
	const shp = new Array(sh_num);

	for (let i = 0; i < sh_num; i++) {
		shp[i] = new THREE.Mesh(geos[Math.floor(geos.length * rand())], cust.shallowCopyMat(mat_main));
		const m = shp[i];
		m.name = 'Mesh #' + i;
		m.material.uniforms.color = { value: hslRgb([rand(), 0.9, 0.5]) };
		const sz = 3 + 4 * rand();
		m.scale.set(sz, sz, sz);
		const x = 50 * 2 * (rand() - 0.5);
		const y = 0 + 30 * rand();
		const z = 2 * (rand() - 0.5);
		m.position.set(x, y, 0 * (1.0 - 0.3 * z));
		m.rotation.set(PI2 * rand(), PI2 * rand(), PI2 * rand());

		if (i == 4) { // trippy
			m.material.uniforms.color = { value: [1, 1, 0.8] };
			cust.addTexture('map', m.material, [
				'/_v1_jsm/textures/uv.png',
				() => { callback('r') },
				() => { callback('e') },
			]);
			cust.addTexCtrl('map', m.material, mapctrl2);
			m.userData.sel = true;
		}

		if (i == 2) { // pretzel
			m.userData.sel = true;
		}

		group.add(m);
	}

	// static shapes

	const mc = shp[sh_num] = new THREE.Mesh(geos[0], cust.shallowCopyMat(mat_main));
	mc.name = 'Static mesh';
	mc.scale.set(5, 5, 5);
	mc.position.set(0, 0.5 * mc.scale.y, 0);
	mc.rotation.set(0, 0, 0);
	
	group.add(mc);

	this.bs_obj = shp;

	this.bs_vel = [];
	for (let i = 0; i < sh_num; i++) this.bs_vel.push(.005 + rnd3(.010));

	cust.makeShadowTree(scene);

	scene.userData.selectable = true;
	scene.userData.hints = {
		'Mesh #2': 'There\'s always one more twist to the pretzel... shadow.',
		left:
			`This is a texturized wall. Don't look at it for too long.`,
		back:
			`Unlike the texturized wall, this wall is not texturized.
Repeat quickly three times.`,
		right: `This wall is opposite the left one, however, not entirely the opposite of it.`,
		bot: `This floor is very firm, nothing ever falls through it, NOTHING.`,
		'Mesh #4':
`Totally
Real
Indigenous
Ping
Pong
Yellow

ball
`
	};

	setTimeout(() => { callback('r') }, 100);

	return [scene, camera, ui];
}

TestScenes.prototype.boxSceneAnimate = function () {
	const ori = [0, 0, 0];
	for (let i = 0; i < this.bs_obj.length - 1; i++) {
		const sh = this.bs_obj[i];
		sh.rotation.x += 0.013;
		sh.rotation.y += 0.007;
		const [dx, dz] = [sh.position.x - ori[0], sh.position.z - ori[2]];
		[sh.position.x, sh.position.z] = rotate(dx, dz, this.bs_vel[i]);
		sh.position.x += ori[0];
		sh.position.z += ori[2];
	}

	const fr = 1;
	const tm = fr * 0.001 * performance.now();
	const lgts = this.box_lgts;
	for (let i = 0; i < lgts.length; i++) {
		//const mult = 0.5 * (Math.sin(tm + i * Math.PI) + 1);
		/*
		const clr = pnts[i].color;
		[clr.r, clr.g, clr.b] = hsvRgb([glFract(tm), 1.0, 1.0]);
		pnts[i].intensity = 100 * mult;
		pnts[i].position.x = 30 * 3 * mult;
		*/
		for (const mtx of this.box_map_ctrl) {
			mtx.skewX += 0.05;
			mtx.skewY += 0.05;
		}
	}
}

TestScenes.prototype.iMeshScene = function (w, h, callback, rng) {

	const group = new THREE.Object3D();
	group.name = 'group';
	const scene = new THREE.Scene();
	scene.name = 'iMeshScene';
	//scene.background = new THREE.Color(0.01, 0.01, 0.15);
	scene.add(group);

	const [near, far] = [1, 500];
	const mid = this.mid = -0.5 * (near + far);
	const camera = new THREE.PerspectiveCamera(45, w / h, near, far);
	//const camera = new THREE.OrthographicCamera(-w/40, w/40, h/40, -h/40, near, far);
	camera.position.set(90, 120, mid + 90);
	const lookAt = [0, 0, mid];
	camera.lookAt(...lookAt);
	camera.userData = { lookAt, mid };

	group.position.set(0, 0, mid);

	// lights

	const amb = new THREE.AmbientLight(0xffffff, 0.2);

	const dir = new THREE.DirectionalLight(0xffffaa, 1.2);
	dir.position.set(10, 70, mid + 50);
	const dir_lookat = [0, 0, mid];

	const pnt0 = new THREE.PointLight(0xffa0a0, 1);
	const rot0 = pnt0.userData.rot = 0;
	const r0 = pnt0.userData.r = 25;
	pnt0.position.set(
		0 + r0 * Math.sin(rot0),
		0 + 25,
		mid + r0 * Math.sin(rot0),
	);
	const pnt0_lookat = [0 + 25, 0 + 30, mid - 25];
	
	const pnt1 = new THREE.PointLight(0xa0a0ff, 1);
	const rot1 = pnt1.userData.rot = 0;
	const r1 = pnt1.userData.r = 25;
	pnt1.position.set(
		0 - r1 * Math.sin(rot1),
		0 + 25,
		mid + r1 * Math.sin(rot1),
	);
	const pnt1_lookat = [0 - 25, 0 + 30, mid - 25];

	amb.name = 'Ambient light';
	dir.name = 'Directional light';
	pnt0.name = 'Point light #0';
	pnt1.name = 'Point light #1';

	pnt0.userData.decay = 2;
	pnt1.userData.decay = 2;
	const getPos = obj => {
		const pos = obj.position;
		return [pos.x, pos.y, pos.z];
	}
	pnt0.userData.power = 0.25 * dot(getPos(group), getPos(pnt0)) / (4 * Math.PI);
	pnt1.userData.power = 0.25 * dot(getPos(group), getPos(pnt1)) / (4 * Math.PI);

	dir.userData.shadow = {
		blur: 5,
		strength: 0.8,
		tex: { w: 1000, h: 1000 },
		cam: new THREE.OrthographicCamera(-700/9, 700/9, 700/9, -700/9, 0, 300),
		lookat: dir_lookat,
	};
	pnt0.userData.shadow = {
		blur: 5,
		strength: 1,
		tex: { w: 1000, h: 1000 },
		cam: new THREE.PerspectiveCamera(120, 1, 0.1, 100),
		lookat: pnt0_lookat,
	};
	pnt1.userData.shadow = {
		blur: 5,
		strength: 1,
		tex: { w: 1000, h: 1000},
		cam: new THREE.PerspectiveCamera(120, 1, 0.1, 100),
		lookat: pnt1_lookat,
	};

	this.box_lgts = [dir, pnt0, pnt1];

	// extern ui controls

	const ui = {
		gamma: 2.2,
		spec: {
			str: 2.5,
			fo: 12,
		},
		lgts: { amb, dir, pnt0, pnt1 },
		shad_mode: 0,
		tlucy: 0.8,
	};

	// light helpers

	addHelper(group, this.box_lgts, 0.5);

	// light struct

	const dir_light = {
		color: [dir.color.r, dir.color.g, dir.color.b],
		get intensity() { return dir.intensity },
		position: [dir.position.x, dir.position.y, dir.position.z],
		lookat: dir_lookat,
		shadow: dir.userData.shadow,
	};
	const pnt_light0 = {
		get color() { return [pnt0.color.r, pnt0.color.g, pnt0.color.b] },
		get intensity() { return pnt0.userData.power },
		get position() { return [pnt0.position.x, pnt0.position.y, pnt0.position.z] },
		decay: 2,
		shadow: pnt0.userData.shadow,
	};
	const pnt_light1 = {
		get color() { return [pnt1.color.r, pnt1.color.g, pnt1.color.b] },
		get intensity() { return pnt1.userData.power },
		get position() { return [pnt1.position.x, pnt1.position.y, pnt1.position.z] },
		decay: 2,
		shadow: pnt1.userData.shadow,
	};

	// uniform struct dir + pnt0 + pnt1

	const uni_main = {
		gamma: { get value() { return ui.gamma } },
		color: { value: [1, 1, 1] },
		amb: {
			color: [amb.color.r, amb.color.g, amb.color.b],
			get intensity() { return amb.intensity },
		},
		dir: dir_light,
		pnt: [ pnt_light0, pnt_light1 ],
		shad_mode: { get value() { return ui.shad_mode } },
	};
	const uni_apples = { ...uni_main };
	uni_apples.specular = {
		get position() {
			const pos = camera.position;
			return [pos.x, pos.y, pos.z];
		},
		get strength() { return ui.spec.str },
		get falloff() { return ui.spec.fo },
	};
	const uni_leaves = { ...uni_apples };
	uni_leaves.translucent = { get value() { return ui.tlucy } };
	
	// uniform struct dir + pnt0

	const uni_main1 = { ...uni_main };
	uni_main1.pnt = pnt_light0;
	const uni_apples1 = { ...uni_apples };
	uni_apples1.pnt = pnt_light0;
	const uni_leaves1 = { ...uni_leaves };
	uni_leaves1.pnt = pnt_light0;

	// uniform struct dir + pnt1

	const uni_main2 = { ...uni_main };
	uni_main2.pnt = pnt_light1;
	const uni_apples2 = { ...uni_apples };
	uni_apples2.pnt = pnt_light1;
	const uni_leaves2 = { ...uni_leaves };
	uni_leaves2.pnt = pnt_light1;

	// materials dir

	const mat_main = cust.material('lamb', {
		uni: uni_main,
		imesh_self_shadow: true,
	});
	const mat_apples = cust.material('lamb', {
		uni: uni_apples,
		imesh_self_shadow: true,
	});
	const mat_leaves = cust.material('lamb', {
		uni: uni_leaves,
		imesh_self_shadow: true,
	});
	mat_leaves.side = THREE.DoubleSide;

	// materials dir + pnt0

	const mat_main1 = cust.material('lamb', {
		uni: uni_main1,
		imesh_self_shadow: true,
	});
	const mat_apples1 = cust.material('lamb', {
		uni: uni_apples1,
		imesh_self_shadow: true,
	});
	const mat_leaves1 = cust.material('lamb', {
		uni: uni_leaves1,
		imesh_self_shadow: true,
	});
	mat_leaves1.side = THREE.DoubleSide;

	// materials dir + pnt0

	const mat_main2 = cust.material('lamb', {
		uni: uni_main2,
		imesh_self_shadow: true,
	});
	const mat_apples2 = cust.material('lamb', {
		uni: uni_apples2,
		imesh_self_shadow: true,
	});
	const mat_leaves2 = cust.material('lamb', {
		uni: uni_leaves2,
		imesh_self_shadow: true,
	});
	mat_leaves2.side = THREE.DoubleSide;

	// box

	const size = 100;
	const geo = new THREE.PlaneGeometry(size, size);

	const PI2 = 0.5 * Math.PI;
	const sz2 = 0.5 * size;
	const pos = { bot: [0, 0, 0], left: [-sz2, 0, 0], right: [sz2, 0, 0], back: [0, 0, 0 - sz2] };
	const rot = { bot: [-PI2, 0, 0], left: [0, PI2, 0], right: [0, -PI2, 0], back: [0, 0, 0] };
	const clr = { left: { value: [0.2, 0.3, 0.6] }, bot: { value: [0.28, 0.4, 0] } };
	clr.right = clr.back = clr.left;
	['bot', 'left', 'right', 'back'].forEach(nm => {
		const m = new THREE.Mesh(geo, cust.shallowCopyMat(mat_main));
		m.name = nm;
		m.material.side = THREE.DoubleSide; // disable(GL_CULL_FACE)
		m.position.set(...pos[nm]);
		m.rotation.set(...rot[nm]);
		m.material.uniforms.color = clr[nm];
		group.add(m);

		// selectable object
		// m.userData.sel = true;
	});

	// tree data

	const td0 = {grp:'common',name:'apple',max_lev:4,html:{trunk_w:{value:0.08},trunk_h:{value:8},trunk_min:{value:0.3},trunk_num:{value:25},trunk_xbias:{value:2},trunk_zbias:{value:2},trunk_seg:{value:'3,0'},trunk_grv:{value:0},trunk_rgb:{value:''},br_0w:{value:0.02},br_1w:{value:0.05},br_2w:{value:0.1},br_3w:{value:0.1},br_0h:{value:3.5},br_1h:{value:2.5},br_2h:{value:0.1},br_3h:{value:0.25},br_0min:{value:0.1},br_1min:{value:0.2},br_2min:{value:0.03},br_3min:{value:0.2},br_0num:{value:25},br_1num:{value:10},br_2num:{value:1},br_3num:{value:1},br_0fi:{value:'0,360,0,360'},br_1fi:{value:'190,220,320,350'},br_2fi:{value:'0,360,0,360'},br_3fi:{value:'0,360,0,360'},br_0ybias:{value:'65,65'},br_1ybias:{value:'70,70'},br_2ybias:{value:'70,70'},br_3ybias:{value:'80,80'},br_0tot:{value:15},br_1tot:{value:100},br_2tot:{value:3000},br_3tot:{value:10},br_0seg:{value:'1,0'},br_1seg:{value:'0,0'},br_2seg:{value:'1,0'},br_3seg:{value:'1,0'},br_0grv:{value:0},br_1grv:{value:0},br_2grv:{value:0},br_3grv:{value:0},br_0rgb:{value:''},br_1rgb:{value:''},br_2rgb:{value:''},br_3rgb:{value:''},trunk_rend_path:{checked:false},trunk_rend_solid:{checked:true},trunk_rel_fi:{checked:true},trunk_follow:{checked:false},trunk_tip:{checked:false},trunk_code:{value:'mesh = {_NL_  mat: CM.mat_main,_NL_  geo: new THREE.CylinderGeometry(0.16, 0.18, 1, 8),_NL_};_NL__NL_mesh.geo.scale(1, 1.1, 1);_NL__NL_for(let i = 0; i < color.length; i++) _NL_	color[i] = new THREE.Color(0.2 + 0.2 * i / color.length, 0.15, 0.1);_NL_'},trunk_anim:{value:''},br_0rend_path:{checked:false},br_0rend_solid:{checked:true},br_0rel_fi:{checked:true},br_0follow:{checked:false},br_0tip:{checked:false},br_0code:{value:'mesh = {_NL_  mat: CM.mat_main,_NL_  geo: new THREE.CylinderGeometry(0.07, 0.08, 1, 6),_NL_};_NL__NL_mesh.geo.scale(1, 1.1, 1);_NL__NL_for(let i = 0; i < color.length; i++) _NL_	color[i] = new THREE.Color(0.2 + 0.3 * i / color.length, 0.2, 0.1);_NL_'},br_0anim:{value:''},br_1rend_path:{checked:false},br_1rend_solid:{checked:true},br_1rel_fi:{checked:true},br_1follow:{checked:false},br_1tip:{checked:false},br_1code:{value:'mesh = {_NL_  mat: CM.mat_main,_NL_  geo: new THREE.CylinderGeometry(0.033, 0.035, 1, 6),_NL_};_NL_mesh.geo.scale(1, 1.03, 1);_NL__NL_for(let i = 0; i < color.length; i++) _NL_	color[i] = new THREE.Color(0.3 + 0.2 * i / color.length, 0.3, 0.15);'},br_1anim:{value:''},br_2rend_path:{checked:false},br_2rend_solid:{checked:true},br_2rel_fi:{checked:true},br_2follow:{checked:false},br_2tip:{checked:false},br_2code:{value:'const leaf = LeafGeom({_NL_  name:_SQ_apple_SQ_, _NL_  //bisecDist: 0.01,_NL_ makeZ: (x,y) => 0.002*x*x_NL_});_NL_const geo = leaf.geo;_NL_geo.scale(0.02, 0.02, 0.02);_NL_geo.translate(0, -2, 0);_NL__NL_mesh = {_NL_  height: 4,_NL_  uniscale: true,_NL_  shineThrough: 0.6,_NL_  mat: CM.mat_leaves,_NL_  geo,_NL_};_NL__NL_for(let i = 0; i < color.length; i++) _NL_	color[i] = new THREE.Color(0.273, 0.364 + 0.05 * i / color.length, 0.065);_NL_'},br_2anim:{value:''},br_3rend_path:{checked:false},br_3rend_solid:{checked:true},br_3rel_fi:{checked:true},br_3follow:{checked:false},br_3tip:{checked:false},br_3code:{value:'mesh = {_NL_  uniscale: true,_NL_  attenuation: 0,_NL_  height: 1,_NL_  mat: CM.mat_apples,_NL_  geo: new THREE.SphereGeometry(0.66, 16, 32),_NL_};_NL__NL_for(let i = 0; i < color.length; i++) {_NL_  const f = i / color.length;_NL_  color[i] = new THREE.Color(0.8 + 0.2 * f, 0.6 - 0.5 * f, 0.2);_NL_}_NL_'},br_3anim:{value:''}},sett:{bg:[0.01,0.01,0.15],gr:[0.137,0.2,0],ao:[0.8,0.8,0.8],co:[0.8,0.8,0.8]},seeds:{rgb:{z:1481791743,w:891476859},poly_trunk_:{z:844493727,w:558874225},br_0_gen:{z:419408901,w:655597869},br_0_upd:{z:350830959,w:171028991},br_1_gen:{z:1395352316,w:945821469},br_1_upd:{z:1717708661,w:877866065},br_2_upd:{z:2118609972,w:635790911},br_2_gen:{z:1841614979,w:1013130006},br_3_gen:{z:1381092953,w:1080052618},br_3_upd:{z:15530354,w:306943535},br_2_sld:{z:2071467856,w:341212379},br_3_sld:{z:2071467856,w:341212379}}};

	if(rng) delete td0.seeds;

	// dir + pnt0
	const td1 = { ...td0 };
	td1.html = { ...td0.html };
	['trunk_code', 'br_0code', 'br_1code', 'br_2code', 'br_3code'].forEach(nm => {
		td1.html[nm] = {
			value: td1.html[nm].value
				.replaceAll('mat_main', 'mat_main1')
				.replaceAll('mat_leaves', 'mat_leaves1')
				.replaceAll('mat_apples', 'mat_apples1')
		}
	});

	// dir + pnt1
	const td2 = { ...td0 };
	td2.html = { ...td0.html };
	['trunk_code', 'br_0code', 'br_1code', 'br_2code', 'br_3code'].forEach(nm => {
		td2.html[nm] = {
			value: td2.html[nm].value
				.replaceAll('mat_main', 'mat_main2')
				.replaceAll('mat_leaves', 'mat_leaves2')
				.replaceAll('mat_apples', 'mat_apples2')
		}
	});

	const data = [td2, td1, td0];

	const mats = {
		mat_main, mat_leaves, mat_apples,
		mat_main1, mat_leaves1, mat_apples1,
		mat_main2, mat_leaves2, mat_apples2,
	};

	const forest = [];
	const forest3D = new THREE.Object3D();
	forest3D.name = 'forest';
	group.add(forest3D);

	const shft = 25;
	const tpos = [[-shft, 0, -shft], [shft, 0, -shft], [0, 0, shft]];

	const proms = [];
	for (let i = 0; i < 3; i++) proms.push(createTree(i, data[i], mats));

	Promise.allSettled(proms).then(arr => {
		arr.forEach(a => {
			if (a.status == 'fulfilled') {
				const [id, tree] = a.value;
				forest.push(tree);
				forest3D.add(tree.main);
				tree.main.scale.set(5, 5, 5);
				tree.main.position.set(...tpos[id]);
			} else {
				log(`createTree error: ${a.value}`);
			}
		});
		cust.makeShadowTree(scene);
		callback('r');
	});
	
	return [scene, camera, ui];
}

TestScenes.prototype.iMeshSceneAnimate = function () { 
	const fr = 1;
	const tm = fr * 0.001 * performance.now();
	const [dir, pnt0, pnt1] = this.box_lgts;

	const dat0 = pnt0.userData;
	const rot0 = dat0.rot += 0.01;
	const p = dat0.r * Math.sin(rot0);
	pnt0.position.x = p;
	pnt0.position.z = this.mid + p;

	const dat1 = pnt1.userData;
	const rot1 = dat1.rot += 0.01;
	const p1 = dat1.r * Math.sin(rot1);
	pnt1.position.x = -p1;
	pnt1.position.z = this.mid + p1;
}

TestScenes.prototype.bumpScene = function (w, h, callback) {

	const group = new THREE.Object3D();
	const scene = new THREE.Scene();
	scene.name = 'bumpScene';
	scene.background = new THREE.Color(0.01, 0.01, 0.15);
	scene.add(group);
	
	const texldr = new THREE.TextureLoader();
	const bumpMap = texldr.load(
		'/_v1_jsm/textures/bump.png',
		() => { callback('r') },
		undefined,
		err => { console.log('texture load err:', err)}
	);
	const bumpMap2 = texldr.load(
		'/_v1_jsm/textures/bump_world.jpg',
		() => { callback('r') },
		undefined,
		err => { console.log('texture load err:', err)}
	);
	bumpMap.magFilter = THREE.NearestFilter;
	bumpMap2.magFilter = THREE.NearestFilter;

	const [near, far] = [1, 1000];
	const mid = -0.5 * (near + far);
	const camera = new THREE.PerspectiveCamera(45, w / h, near, far);
	//const camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, near, far);
	camera.position.set(-150, 0, -250);
	const lookAt = [-110, -110, mid];//[0, 0, mid];
	camera.lookAt(...lookAt);
	camera.userData.lookAt = lookAt;

	group.position.set(0, 0, mid);
	
	// lights

	const pnt0 = new THREE.PointLight(0xffffff, 1);
	pnt0.position.set(0, 0, 0);
	const pnt1 = new THREE.PointLight(0x0000ff, 1);
	pnt1.position.set(-30, 70, -400);

	const amb = new THREE.AmbientLight(0xff0000, 0.2);
	const dir = new THREE.DirectionalLight(0xffffff, 1);
	dir.position.set(0, 0, 100);
	const dir_lookat = [0, 0, mid];
	
	scene.add(pnt0);

	const mat_main = cust.material('lamb', {
		uni: {
			color: { value: [1, 1, 1] },
			/*amb: {
				color: [amb.color.r, amb.color.g, amb.color.b],
				get intensity() { return amb.intensity },
			},
			dir: {
				color: [dir.color.r, dir.color.g, dir.color.b],
				get intensity() { return dir.intensity },
				position: [dir.position.x, dir.position.y, dir.position.z],
				lookat: dir_lookat,
			},*/
			pnt: {
				get color() { return [pnt0.color.r, pnt0.color.g, pnt0.color.b] },
				get intensity() { return pnt0.intensity },
				position: [pnt0.position.x, pnt0.position.y, pnt0.position.z],
				decay: 0,
			},
		   bmap: bumpMap,
		   bmfact: { value: 1 },
		}
	});
	
   //mat_main.uniforms.bmap.value.magFilter = THREE.NearestFilter;

	const geo = new THREE.PlaneGeometry(200, 200);
	const mat = cust.shallowCopyMat(mat_main);
	const mesh = new THREE.Mesh(geo, mat);
	mesh.position.set(110, -110, 0);

	const sgeo = new THREE.SphereGeometry(100, 32, 32);

	const mats = cust.shallowCopyMat(mat_main);
	cust.addTexture('bmap', mats, bumpMap2);
	const meshs = new THREE.Mesh(sgeo, mats);
	meshs.position.set(-110, -110, 0);

	const mat2 = new THREE.MeshStandardMaterial({bumpMap});
	const mesh2 = new THREE.Mesh(geo, mat2);
	mesh2.position.set(110, 110, 0);

	const mat2s = new THREE.MeshStandardMaterial({bumpMap: bumpMap2});
	const mesh2s = new THREE.Mesh(sgeo, mat2s);
	mesh2s.position.set(-110, 110, 0);

	const axhlp = new THREE.AxesHelper(50);

	group.add(mesh).add(meshs).add(axhlp).add(mesh2).add(mesh2s);

	//cust.makeShadowTree(scene);

	setTimeout(() => { callback('r') }, 100);

	return [scene, camera];
}

TestScenes.prototype.bumpSceneAnimate = function () {

}

TestScenes.prototype.texlightScene = function (w, h, callback) {

	const group = new THREE.Object3D();
	const scene = new THREE.Scene();
	scene.name = 'texlightScene';
	//scene.background = new THREE.Color(0.01, 0.01, 0.15);
	scene.add(group);

	const [near, far] = [1, 700];
	const mid = -0.5 * (near + far);
	const camera = new THREE.PerspectiveCamera(45, w / h, near, far);
	//const camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, near, far);
	camera.position.set(0, 60, -90);
	const lookAt = [0, 0, mid];
	camera.lookAt(...lookAt);
	camera.userData = { lookAt, mid };

	group.position.set(0, 0, mid);

	// lights

	const amb = new THREE.AmbientLight(0xffffff, 0.005);

	const dir = new THREE.DirectionalLight(0xa0ffa0, 0.002);
	dir.position.set(-30, 70, -200);
	const dir_lookat = [0, 0, mid];

	const pnt0 = new THREE.PointLight(0xffa0a0, 1);
	pnt0.position.set(0, 75, -205);
   //pnt0.position.set(25, 75, -205);
   
	const pnt1 = new THREE.PointLight(0xa0a0ff, 1);
	pnt1.position.set(-100, 120, -380);

	amb.name = 'Ambient light';
	dir.name = 'Directional light';
	pnt0.name = 'Point light #0';
	pnt1.name = 'Point light #1';

	pnt0.userData.decay = 2;
	pnt1.userData.decay = 2;
	const getPos = obj => {
		const pos = obj.position;
		return [pos.x, pos.y, pos.z];
	}
	pnt0.userData.power = 0.7 * dot(getPos(group), getPos(pnt0)) / (4 * Math.PI);
	pnt1.userData.power = 0.66 * dot(getPos(group), getPos(pnt1)) / (4 * Math.PI);

	dir.userData.shadow = {
		blur: 5,
		strength: 0.5,
		tex: { w: 1000, h: 1000 },
		cam: new THREE.OrthographicCamera(-700/9, 700/9, 700/9, -700/9, 50, 300),
		lookat: dir_lookat,
	};
	pnt0.userData.shadow = {
		blur: 5,
		strength: 1,
		tex: { w: 1050, h: 875 },
		cam: new THREE.PerspectiveCamera(55, 1, 30, 300),
		lookat: lookAt,
	};
	pnt1.userData.shadow = {
		blur: 5,
		strength: 1,
		tex: { w: 1050, h: 750},
		cam: new THREE.PerspectiveCamera(57, 1, 1, 700),
		lookat: lookAt,
   };
   
   pnt0.userData.texlight = {
      fov: 45,
      near: 175,
      up: [0, 1, 0],
      lookat: [0, 0, mid - 50],
      map: ['/_v1_jsm/textures/spot.png', tex => {
         tex.magFilter = THREE.NearestFilter;
         callback('r');
      },],
		//mapctrl
   };

	this.box_lgts = [pnt0];

	const mapctrl = { // to control left wall texture
		//scaleX: 0.5,
		//scaleY: 0.5,
		skewX: 10,
		skewY: 10,
		offU: 0.5,
		offV: 0.5,
	};

	const mapctrl2 = { // to control ball texture
		scaleX: 0.1,
		scaleY: 0.1,
		skewX: 0,
		skewY: 0,
		offU: 0,
		offV: 0,
	};

	this.box_map_ctrl = [mapctrl, mapctrl2];

	// extern ui controls
	const ui = {
		gamma: 2.2,
		spec: {
			str: 0.5,
			fo: 6,
		},
		lgts: { dir, pnt0 },
		shad_mode: 0,
	};

	const mat_main = cust.material('lamb', {
		uni: {
			gamma: { get value() { return ui.gamma } },
			color: { value: [1, 1, 1] },
			/*amb: {
				get color() { return [amb.color.r, amb.color.g, amb.color.b] },
				get intensity() { return amb.intensity },
			},*/
			dir: {
				get color() { return [dir.color.r, dir.color.g, dir.color.b] },
				get intensity() { return dir.intensity },
				position: [dir.position.x, dir.position.y, dir.position.z],
				lookat: dir_lookat,
				shadow: dir.userData.shadow,
			},
			pnt: {
				get color() { return [pnt0.color.r, pnt0.color.g, pnt0.color.b] },
				get intensity() { return pnt0.userData.power },
				position: [pnt0.position.x, pnt0.position.y, pnt0.position.z],
				get decay() { return pnt0.userData.decay },
            shadow: pnt0.userData.shadow,
            texture: pnt0.userData.texlight,
			},/*{
				get color() { return [pnt1.color.r, pnt1.color.g, pnt1.color.b] },
				get intensity() { return pnt1.userData.power },
				position: [pnt1.position.x, pnt1.position.y, pnt1.position.z],
				get decay() { return pnt1.userData.decay },
				shadow: pnt1.userData.shadow,
			},*/
			specular: {
				get position() {
					const pos = camera.position;
					return [pos.x, pos.y, pos.z];
				},
				get strength() { return ui.spec.str },
				get falloff() { return ui.spec.fo },
			},
			shad_mode: { get value() { return ui.shad_mode } },
			//map: ['/_v1_jsm/textures/uv.png', () => { callback('r') }, ],
			//mapctrl
		}
	});

	// light helpers

	addHelper(group, this.box_lgts);

	// box

	const size = 100;
	const geo = new THREE.PlaneGeometry(size, size);

	const PI2 = 0.5 * Math.PI;
	const sz2 = 0.5 * size;
	const pos = { bot: [0, 0, 0], left: [-sz2, 0, 0], right: [sz2, 0, 0], back: [0, 0, 0 - sz2] };
	const rot = { bot: [-PI2, 0, 0], left: [0, PI2, 0], right: [0, -PI2, 0], back: [0, 0, 0] };
	//const clr = { bot: hslRgb([0.5, 0.9, 0.7]) };
	//clr.left = clr.right = clr.back = clr.bot;
	['bot', 'left', 'right', 'back'].forEach(nm => {
		const m = new THREE.Mesh(geo, cust.shallowCopyMat(mat_main));
		m.name = nm;
		m.material.side = THREE.DoubleSide; // disable(GL_CULL_FACE)
		m.position.set(...pos[nm]);
		m.rotation.set(...rot[nm]);
		group.add(m);

		if (nm == 'left') {
			const tex = cust.addTexture('map', m.material, [
				'/_v1_jsm/textures/cube_map.png',
				() => { callback('r') },
				() => { callback('e') },
			]);
			tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
			cust.addTexCtrl('map', m.material, mapctrl);
			//log('left',m.material.fragmentShader.slice(0,200))
		}

		// selectable object
		m.userData.sel = true;
	});

	// shapes

	const geos = [
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.SphereGeometry(1, 32, 16),
		new THREE.TorusKnotGeometry(1, 0.3, 50, 8),
	];

	const sh_num = 10;
	const shp = new Array(sh_num);

	for (let i = 0; i < sh_num; i++) {
		shp[i] = new THREE.Mesh(geos[Math.floor(geos.length * rand())], cust.shallowCopyMat(mat_main));
		const m = shp[i];
		m.name = 'Mesh #' + i;
		m.material.uniforms.color = { value: hslRgb([rand(), 0.9, 0.5]) };
		const sz = 3 + 4 * rand();
		m.scale.set(sz, sz, sz);
		const x = 50 * 2 * (rand() - 0.5);
		const y = 0 + 30 * rand();
		const z = 2 * (rand() - 0.5);
		m.position.set(x, y, 0 * (1.0 - 0.3 * z));
		m.rotation.set(PI2 * rand(), PI2 * rand(), PI2 * rand());

		if (i == 4) { // trippy
			m.material.uniforms.color = { value: [1, 1, 0.8] };
			cust.addTexture('map', m.material, [
				'/_v1_jsm/textures/uv.png',
				() => { callback('r') },
				() => { callback('e') },
			]);
			cust.addTexCtrl('map', m.material, mapctrl2);
			m.userData.sel = true;
		}

		if (i == 2) { // pretzel
			m.userData.sel = true;
		}

		group.add(m);
	}

	// static shapes

	const mc = shp[sh_num] = new THREE.Mesh(geos[0], cust.shallowCopyMat(mat_main));
	mc.name = 'Static mesh';
	mc.scale.set(5, 5, 5);
	mc.position.set(0, 0.5 * mc.scale.y, 0);
	mc.rotation.set(0, 0, 0);
	
	group.add(mc);

	this.bs_obj = shp;

	this.bs_vel = [];
	for (let i = 0; i < sh_num; i++) this.bs_vel.push(.005 + rnd3(.010));

   this.mid = mid;

	cust.makeShadowTree(scene);

	setTimeout(() => { callback('r') }, 100);

	return [scene, camera, ui];
}

TestScenes.prototype.texlightSceneAnimate = function () {
	const ori = [0, 0, 0];
	for (let i = 0; i < this.bs_obj.length - 1; i++) {
		const sh = this.bs_obj[i];
		sh.rotation.x += 0.013;
		sh.rotation.y += 0.007;
		const [dx, dz] = [sh.position.x - ori[0], sh.position.z - ori[2]];
		[sh.position.x, sh.position.z] = rotate(dx, dz, this.bs_vel[i]);
		sh.position.x += ori[0];
		sh.position.z += ori[2];
	}

   const pnt0 = this.box_lgts[0];
   const tlobj = pnt0.userData.texlight;
   tlobj.ang = tlobj.ang || Math.PI;
   const r = 50;
   const off = [0, 0, this.mid];
   const z = r * Math.cos(tlobj.ang);
   const x = r * Math.sin(tlobj.ang);
   tlobj.lookat = [x + off[0], 0 + off[1], z + off[2]]; //log(tlobj.lookat)
   tlobj.ang += 0.01;
}

TestScenes.prototype.render = function (scene, camera, anim, lid) {
	renderShadTex(this.renderer, scene, cust, lid);
	if(!lid) this.renderer.render(scene, camera);
	if(anim) this[scene.name + 'Animate']();
}

export { TestScenes }