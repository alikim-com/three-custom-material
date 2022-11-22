import * as THREE from '/_v1_jsm/three.module.js'

import GMRNG from '/_v1_jsm/rng.js'

import { hsvRgb, hslRgb, rgbHsl } from '/_v1_jsm/glsl_ported.js'

import { norm, norm2, dot, cross, sphereToCart, quaternRotate, quaternRotateMult, quaternAdd, quaternFromVects, quaternFromETh, twistGeom, profileGeom, noiseGeom } from '/_v1_jsm/geometry.js'

import { multVec16CM } from '/_v1_jsm/matrices.js'

import { get, log, safeToStr, deepCopy } from '/_v1_jsm/utils.js'

import { computeProfileNormals, computeTwistNormals } from '/_v1_jsm/utils_three.js'

import { LeafGeom, PetalGeom, LatheGeom } from '/_lush/tree/js/lpf.js'

import { Tween } from '/_v1_jsm/tween.js'

import { GLTFLoader } from '/_v1_jsm/GLTFLoader.js'

// GLOBAL

const reg_numarr = /([+-]?[0-9.]+).*?/g;
const deg_to_rad = Math.PI / 180;
const half_PI = Math.PI / 2;
const int = ['num', 'tot', 'seg'];
const getUI = (pr, v) => int.includes(pr) ? parseInt(v) : parseFloat(v);

const texldr = new THREE.TextureLoader();
const tween = new Tween();
const gltfldr = new GLTFLoader();

const elog = arg => { if(arg) console.log(arg) };
const elogErr = arg => { console.log(arg) };

// RNG

const rng = new GMRNG();
const rngInit = () => {
	const seed = Math.round(1000 * Math.random());
	for (let i = 0; i < seed; i++) rng.f01();
};
rngInit();

const rand = () => rng.f01()
let rngSeed = () => {};
const rngSet = (nm, seeds) => { const obj = seeds[nm]; if (obj) rng.set(obj) };

// TREE HELPERS
	
const updateColors = (rgb, max_lev, pref, html, seeds) => {
	rngSeed('rgb', seeds);
	const off = 1 / (max_lev + 1);
	const hue = rand();
	for (let i = 0; i <= max_lev; i++) {
		const clr = html[pref[i] + 'rgb'].value;
		rgb[i] = clr ? clr.match(reg_numarr).map(v => parseFloat(v)) :
			hsvRgb([hue + off * i, 1, 1]);
	}
};

const makeGeo = vert => {
	const geo = new THREE.BufferGeometry();
	const vertices = new Float32Array(vert);
	return geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
};

const disposeMesh = (nm, par) => {
	const m = par.getObjectByName(nm);
	if (m) {
		par.remove(m);
		m.geometry.dispose();
		m.material.dispose();
	}
};

const makeMesh = (nm, vert, mat, rgb) => {
	const geo = makeGeo(vert);
	const trans = {};
	if (rgb.length == 4) {
		trans.transparent = true;
		trans.opacity = rgb.pop();
	}
	if (mat == 'line') {
		const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(...rgb), linewidth: 1, ...trans });
		const mesh = new THREE.Line(geo, mat);
		mesh.name = nm;
		mesh.frustumCulled = false;
		return mesh;
	}
};

const genPoly = (pr, html) => {
	const [w, h, num] = ['w', 'h', 'num'].map(nm => getUI(nm, html[pr + nm].value));
	const vert = [0, 0, 0];
	
	const y = [];
	for (let i = 0; i < num; i++) y[i] = h * rand();
	y.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
	
	const w2 = w * 2;
	const min_dist = html[pr + 'min'].value;
	const md2 = min_dist * min_dist;
	for (let i = 0; i < num; i++) {
		const x = w2 * (rand() - 0.5);
		const z = w2 * (rand() - 0.5);
		const off = vert.length - 3;
		const [dx, dy, dz] = [x - vert[off], y[i] - vert[off + 1], z - vert[off + 2]];
		if (dx * dx + dy * dy + dz * dz < md2) continue;
		vert.push(x, y[i], z);
	}
	if (vert.length == 3) vert.push(0, h, 0); // at least 2 points
	return vert;
};

const calcFinalPos = (v, q, ox, oy, oz) => {
	const len = v.length;
	const arr = quaternRotateMult(v, ...q);
	const _v = new Array(len);
	for (let i = 0; i < len; i += 3)
		[_v[i], _v[i + 1], _v[i + 2]] = [arr[i] + ox, arr[i + 1] + oy, arr[i + 2] + oz];
	return _v;
};

const followXZProj = (proj, add = 0) => { // follow zx rotation
	const xz_fi = (Math.atan2(proj[0], proj[1]) + add) / 2;
	return [Math.cos(xz_fi), 0, Math.sin(xz_fi), 0];
};

const twist = (geo, axis, totang) => {
	const pos = geo.attributes.position;
	twistGeom(pos.array, axis, totang);
	pos.needsUpdate = true;
	computeTwistNormals(geo);
};

const profile = (geo, axis, func) => {
	const pos = geo.attributes.position;
	profileGeom(pos.array, axis, func);
	pos.needsUpdate = true;
	computeProfileNormals(geo, func);
};

const seamCond = geo => {
	const [t, p] = [geo.type, geo.parameters];
	if (t == 'TorusGeometry')
		return (data, i) => Math.abs(data[i + 2]) / p.tube;
	if (t == 'SphereGeometry')
		return (data, i) => Math.abs(data[i + 2]) / p.radius;
	if (t == 'CylinderGeometry') {
		const rad = (p.radiusTop + p.radiusBottom) / 2;
		return (data, i) => Math.abs(data[i + 2]) / rad;
	}
	if (t == 'LatheGeometry')
		return (data, i) => Math.abs(data[i]);
	return (data, i) => 1;
};

const noisePos = (geo, amp) => {
	const pos = geo.attributes.position;
	noiseGeom(pos.array, amp, seamCond(geo));
	pos.needsUpdate = true;
};

const noiseNor = (geo, amp) => {
	const nrm = geo.attributes.normal;
	noiseGeom(nrm.array, amp, seamCond(geo));
	nrm.needsUpdate = true;
};

const applyGravity = (_vj, grv) => {
	for (let i = 0; i < _vj.length - 3; i += 3) {
		const n = i + 3;
		const p0 = [_vj[i], _vj[i + 1], _vj[i + 2]];
		const p1 = [_vj[n], _vj[n + 1], _vj[n + 2]];
		const e = norm(cross(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2], 0, -1, 0));
		const thi = grv / 2;
		const [sin, cos] = [Math.sin(thi), Math.cos(thi)];
		const q = [cos, sin * e[0], sin * e[1], sin * e[2]];
		// rotate all subseq points
		const mod = [];
		for (let ii = n; ii < _vj.length; ii += 3) {
			for (let k = 0; k < 3; k++) _vj[ii + k] -= p0[k];
		}
		const arr = quaternRotateMult(_vj.slice(n), ...q);
		for (let ii = n; ii < _vj.length; ii += 3) {
			const ind = ii - n;
			for (let k = 0; k < 3; k++) _vj[ii + k] = arr[ind + k] + p0[k];
		}
	}
};

// TREE
	
function TREE(obj) {

	['max_lev', 'GLTF', 'html', 'seeds', 'autoplay'].forEach(nm => { this[nm] = obj[nm] });

	this.pref = ['trunk_'];
   for(let i = 0; i < this.max_lev; i++) this.pref[i + 1] = 'br_' + i;
	
	this.rgb = [];
	this.trunk = {};
	this.branches = [];
	this.code = {};
	this.animate = {};
	['path', 'solid', 'main'].forEach(nm => { 
		this[nm] = new THREE.Object3D(); 
		this[nm].name = nm;
	});
	this.main.add(this.path).add(this.solid);
	updateColors(this.rgb, this.max_lev, this.pref, this.html, this.seeds);
	this.updateTrunk();
}
	
TREE.prototype.updateTrunk = function () {
	const pref = this.pref[0];
	const html = this.html;
	rngSeed('poly_' + pref, this.seeds);
	this.trunk.vert = genPoly(pref, html);
	// quaternion from trunk bias
	const h = html.trunk_h.value;
	const xb = html.trunk_xbias.value;
	const zb = html.trunk_zbias.value;
	const bias = norm([xb, h, zb]);
	const q = this.trunk.q = quaternFromVects([0, 1, 0], bias);

	// to attach nex gen branches
	this.trunk._v = calcFinalPos(this.trunk.vert, this.trunk.q, 0, 0, 0);

	// gravity
	const grv = deg_to_rad * getUI('grv', html.trunk_grv.value);
	if(grv) applyGravity(this.trunk._v, grv);

	if(html.trunk_rend_path.checked) {
		disposeMesh('trunk', this.path);
		const rgb = html.trunk_rgb.value.match(reg_numarr)?.map(v => parseFloat(v));
		if(rgb) this.rgb[0] = rgb;
		const mesh = this.trunk.mesh = makeMesh('trunk', this.trunk._v, 'line', this.rgb[0]);
		mesh.visible = html.trunk_rend_path.checked;
		this.path.add(mesh);
	}

	if (html.trunk_rend_solid.checked)
		this.solidify(pref, this.trunk, this.trunk.solid ? false : true);

	if(this.max_lev) this.updateBranches(0, [q], [this.trunk._v], this.branches[0] ? false : true);
}
	
TREE.prototype.updateBranches = function (lev, _brq, _brv, gen = true) { 
	
	const prf = this.pref[lev + 1];
	const html = this.html;
	const tip = html[prf + 'tip'].checked;
	
	// parents
	const brq = tip ? [this.trunk.q] : _brq[0].length ? _brq : [_brq];
	const brv = tip ? [this.trunk._v.slice(-6)] : _brv[0].length ? _brv : [_brv];

	// att points offsets
	const segm = [];
	const [sf, sl] = tip ? [1,0] : html[this.pref[lev] + 'seg'].value.match(reg_numarr).map(v => parseInt(v));
	const [ssf, ssl] = [1/sf > 0, 1/sl > 0];

	// flatten branches arrays
	let [cnt, scnt] = [0, 0];
	const qoff = [0];
	const _v = [];
	for(let j = 0; j < brv.length; j++) {
		const vj = brv[j];
		const len = vj.length;
		const qj = qoff[j];
		const qj1 = qoff[j + 1] = qj + len / 3;

		if(ssf && ssl)
			for(let i = qj + sf; i < qj1 - sl; i++) segm[scnt++] = i;
		else { 
			for(let i = qj; i <= qj - sf; i++) segm[scnt++] = i;
			for(let i = qj1 + sl; i < qj1; i++) segm[scnt++] = i;
		}   
		for(let i = 0; i < len; i++) _v[cnt++] = vj[i]; 
	}

	const findQ = ind => {
		const len = brq.length;
		const lm1 = len - 1;
		if(ind >= qoff[lm1]) return [brq[lm1], lm1];
		for(let i = 1; i < len; i++)
			if(qoff[i] > ind)	return [brq[i - 1], i - 1];
		return [brq[0], 0];
	};

	const branch = this.branches[lev] = this.branches[lev] || {};
	const tot = gen ? parseInt(html[prf + 'tot'].value) : branch.q.length;
	branch.q = new Array(tot);
	branch._v = new Array(tot);

	if(gen) {
		branch.vert = new Array(tot);
		branch.bsq = new Array(tot);

		rngSeed(`${prf}_gen`, this.seeds);
		const astr = html[prf + 'fi'].value.match(reg_numarr);
		const afi = astr.map(v => deg_to_rad * getUI('fi', v));
		const ybstr = html[prf + 'ybias'].value.match(reg_numarr);
		const [ybmn, ybmx] = ybstr.map(v => deg_to_rad * getUI('ybias', v));
		const ydif = ybmx - ybmn;
		for(let j = 0; j < tot; j++) {
			const [fimn, fimx] = rand() < 0.5 ? [afi[0], afi[1]] : [afi[2], afi[3]];
			const fdif = fimx - fimn;
			const fib = fdif ? fdif * rand() + fimn : fimn;
			const thb = ydif ? ydif * rand() + ybmn : ybmn;
			const [z, x, y] = sphereToCart(1, fib, thb); // spread bias
			branch.bsq[j] = quaternFromVects([0, 1, 0], [x, y, z]);
			branch.vert[j] = genPoly(prf, html); 
		}
	}

	const mesh = branch.mesh;
	if(mesh) for(let i = 0; i < mesh.length; i++) disposeMesh(mesh[i]?.name, this.path);
	branch.mesh = new Array(tot);

	rngSeed(`${prf}_upd`, this.seeds); 
	const seglen = segm.length;
	for(let j = 0; j < tot; j++) {
		const pnt = segm[Math.floor(seglen * rand())]; // rand parent branch xyz triplet
		const ind = pnt * 3;
		const [parq, parn] = findQ(pnt);
		const [ox, oy, oz] = [_v[ind], _v[ind + 1], _v[ind + 2]]; // triplet pos
		
		let q1 = branch.bsq[j];

		if(html[prf + 'rel_fi'].checked) {
			// follow branch zx rotation
			const v = brv[parn];
			const vlen = v.length;
			const par_proj = [v[vlen - 3] - v[0], v[vlen - 1] - v[2]];
			const qrel = followXZProj(par_proj, -half_PI);
			q1 = quaternAdd(...qrel, ...q1);
		}

		const q = quaternAdd(...parq, ...q1);

		// self quat
		const _vj = branch._v[j] = calcFinalPos(branch.vert[j], q, ox, oy, oz);
		const len = _vj.length;
		const bias = norm([_vj[len - 3] - _vj[0], _vj[len - 2] - _vj[1], _vj[len - 1] - _vj[2]]); 
		branch.q[j] = quaternFromVects([0, 1, 0], bias);

		// gravity
		const grv = deg_to_rad * getUI('grv', html[prf + 'grv'].value);
		if(grv) applyGravity(_vj, grv);

		if(html[prf + 'rend_path'].checked) {
			const rgb = html[`${prf}rgb`].value.match(reg_numarr)?.map(v => parseFloat(v));
			if(rgb) this.rgb[lev + 1] = rgb;
			branch.mesh[j] = makeMesh(`${prf}_${j}`, _vj, 'line', this.rgb[lev + 1]);
			this.path.add(branch.mesh[j]);
			branch.mesh[j].visible = html[`${prf}rend_path`].checked;
		}
	}

	if(html[prf + 'rend_solid'].checked) {
		this.solidify(prf, branch, branch.solid ? false : true);
	}

	if(lev < this.max_lev - 1) {
		const nxt = lev + 1;
		this.updateBranches(nxt, branch.q, branch._v, this.branches[nxt] ? false : true);
	}
}
	
TREE.prototype.solidify = function (prf, par, gen = true) {
	
	const html = this.html;
	rngSeed(`${prf}_sld`, this.seeds); 

	const getGeoData = (geo, center = false, off = [0,0], usenorm = false, err = 0.001) => {
		const rnd = off[2] ? 0.01 * off[2] : 0;
		const [idx, vert, norm] = [[], [], []];
		const pos = geo.attributes.position.array;
		const nrm = geo.attributes.normal.array;
		let ind = 0;
		for(let i = 0; i < pos.length; i+=3) {
			const [px, py, pz] = [pos[i], pos[i + 1], pos[i + 2]];
			if(Math.abs(px) < err && Math.abs(pz) < err && !center) continue;
			let found = false;
			for(let j = 0; j < vert.length; j+=3) {
				if(Math.abs(vert[j] - px) < err && Math.abs(vert[j + 1] - py) < err && Math.abs(vert[j + 2] - pz) < err) { 
					found = true;
					break;
				}
			}
			if(found) continue;
			vert.push(px, py, pz);
			if(usenorm) norm.push(nrm[i], nrm[i + 1], nrm[i + 2]);
			idx[ind++] = i / 3;
		}
		const [s0, s1] = [off[0], off[1] ? -off[1] : Infinity];
		const [s03, s13] = [s0 * 3, s1 * 3];
		let [_idx, _vert, _norm] = [idx.slice(s0, s1), vert.slice(s03, s13), norm.slice(s03, s13)];
		if(rnd) 
		for(let i = 0; i < _idx.length; i++) { 
			if(rand() > rnd) {
				const k = i * 3;
				_vert.splice(k, 3);
				_norm.splice(k, 3);
				_idx.splice(i--, 1);
			}
		}
		return [_idx, _vert, _norm];
	};

	const shineThrough_141 = (mat, val = 0.5) => {
		mat.onBeforeCompile = function(shader) {
			shader.uniforms.shineThrough = { value: val };
			const repl = 'shineThrough * abs(dotNL) : abs(dotNL)';
			const new_vs = THREE.ShaderChunk.lights_lambert_vertex
			.replace(/saturate *\( *dotNL *\)/g, `(dotNL < 0.0 ? ${repl})`)
			.replace(/saturate *\( *- *dotNL *\)/g, `(dotNL > 0.0 ? ${repl})`);
			shader.vertexShader ='uniform float shineThrough;\n' + 
			shader.vertexShader.replace('#include <lights_lambert_vertex>', new_vs);
		}
   };
   
   const translucency_146 = (mat, val = 0.5) => {

      mat.onBeforeCompile = function(shader) {
        const regex = /float dotNL *= *saturate\( *dot\( *geometry.normal, *directLight.direction *\) *\)/;
        const repl = `
    float _dotNL = dot(geometry.normal, directLight.direction);
    if(_dotNL < 0.0) _dotNL = -${val} * _dotNL;
    float dotNL = saturate(_dotNL);
    `;
        const new_fs = THREE.ShaderChunk.lights_lambert_pars_fragment.replace(regex, repl);
        shader.fragmentShader =
        shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>', new_fs);
        //console.log(new_fs);
      }
   };

	const disposeIMesh = im => {
		this.solid.remove(im);
		im.geometry.dispose();
		im.material.dispose();
		im.dispose();
	};

	const newIMesh = (gen, im, geo, mat, size) => {
		if(!gen && im.userData.count >= size) {
			im.count = size;
			return im;
		}		
		if(im) disposeIMesh(im);
		const imesh = new THREE.InstancedMesh(geo, mat, size);
		imesh.userData.count = size;
		return imesh;
	};

	const flg = par._v[0].length; // branch
	const _bv = [];
	const endp = [par._v.length - 3]; // for attenuation
	if(flg) {
		// flatten arrays
		let cnt = 0;
		for(let j = 0; j < par._v.length; j++) {
			const vj = par._v[j];
			const len = vj.length;
			endp[j] = j ? endp[j - 1] + len : len - 3;
			for(let i = 0; i < len; i++) _bv[cnt++] = vj[i]; 
		}
	}

	const _v = flg ? _bv : par._v;
	const ts = par.solid = par.solid || {};

	const num = _v.length / 3;
	const imsz = num - (html[prf + 'tot']?.value || 1); // don't connect between branches

	if(gen) { 
		ts.color = new Array(imsz);

		this.updateCode(prf);
		try {
			const cfg = this.code[prf](ts.color);
			ts.geo?.dispose();
			ts.mat?.dispose(); 
			ts.petals?.geo?.dispose();
			ts.petals?.mat?.dispose();
			['height', 'shineThrough', 'petals'].forEach(nm => { delete ts[nm] });
			for(const pr in cfg.mesh) ts[pr] = cfg.mesh[pr];
			ts.petals = cfg.petals;
			ts.height = ts.height || ts.geo?.parameters?.height || 2 * ts.geo?.parameters?.radius || 1;
			ts.geo.translate(0, ts.height / 2, 0);
			if(ts.hasOwnProperty('shineThrough')) translucency_146(ts.mat, ts.shineThrough);

		} catch(e) { 
			elogErr(`solidifyGen(${prf}):\n${e}`) 
		};

	} else if(ts.color.length != imsz) { // update color if diff length
		ts.color = new Array(imsz);
		try { this.code[prf](ts.color) } catch(e) { elogErr(`solidifyUpd(${prf}):\n${e}`) };
	}

	ts.instmesh = newIMesh(gen, ts.instmesh, ts.geo, ts.mat, imsz);

	const imnew = ts.instmesh;

	const pdata = ts.pdata = ts.pdata || {};
	const pcfg = ts.petals;
	if(pcfg) {
		if(gen) {
			[pdata.idx, pdata.vert, pdata.norm] = getGeoData(ts.geo, pcfg.center, pcfg.offset, pcfg.usenormals);
			pdata.len = pdata.idx.length;
			if(pcfg.hasOwnProperty('shineThrough')) translucency_146(pcfg.mat, pcfg.shineThrough);
		}

		const sz = imsz * pdata.len;
		ts.ptlmesh = newIMesh(gen, ts.ptlmesh, pcfg.geo, pcfg.mat, sz);

		pdata.ybias = [deg_to_rad * pcfg.ybias[0], deg_to_rad * pcfg.ybias[1]];
		pdata.ybdif = pdata.ybias[1] - pdata.ybias[0];
		pdata.yb = pdata.ybias[1] || pdata.ybias[0];

		pdata.anim = [];
	
	} else if(ts.ptlmesh) disposeIMesh(ts.ptlmesh);

	const pmnew = ts.ptlmesh;

	// align mesh to path
	let ipos = 0;
	let s = 0;
	let attf = 1 / Math.max(endp[0] - 3 - s, 1);
	const q_mtx = new THREE.Matrix4();
	const sc_mtx = new THREE.Vector3();
	
	ts.anim = [];

	let q;
	for(let i = 0; i < _v.length - 3; i+=3) {
		const nxt = i + 3;
		if(i == endp[0]) { 
			s = endp.shift() + 3;
			attf = 1 / Math.max(endp[0] - 3 - s, 1);
			continue; // don't connect between branches
		}
		const [bs, by, bz, mod] = norm2([_v[nxt] - _v[i], _v[nxt + 1] - _v[i + 1], _v[nxt + 2] - _v[i + 2]]); 
		if(html[prf + 'follow'].checked) {
			const qxz = followXZProj([_v[nxt] - _v[i], _v[nxt + 2] - _v[i + 2]], -Math.PI);
			q = quaternAdd(...quaternFromVects([0, 1, 0], [bs, by, bz]), ...qxz);
		} else {
			q = quaternFromVects([0, 1, 0], [bs, by, bz]);
		}

		const att = 1 - ts.attenuation * (i - s) * attf;
		const sfact = mod / ts.height;
		const asf = att * sfact;
		if(ts.uniscale) sc_mtx.set(asf, sfact, asf);
		else sc_mtx.set(att, sfact, att);

		q_mtx.compose(
			new THREE.Vector3(_v[i], _v[i + 1], _v[i + 2]), 
			new THREE.Quaternion(q[1], q[2], q[3], q[0]),
			sc_mtx );

		ts.anim[ipos] = {
			pos: [_v[i], _v[i + 1], _v[i + 2]], 
			sc: ts.uniscale ? [asf, sfact, asf] : [att, sfact, att],
			q,  
		};

		// petals
		if(pcfg) {
			const mtx = new THREE.Matrix4();
			const pv = pdata.vert;
			const j0 = ipos * pdata.len;
			for(let j = j0; j < j0 + pdata.len; j++) {
				const k = j - j0;
				const vi = k * 3;
				let qyb, qt;
				if(pdata.yb) { // rotate around X first
					const ang = (pdata.ybdif * rand() + pdata.ybias[0]) / 2;
					qyb = [Math.cos(ang), Math.sin(ang), 0, 0]; 
				}
				let npn;
				if(pcfg.usenormals) {
					// to align petals with vertices' normals
					const pdn = pdata.norm;
					const pn = [pdn[vi] * sc_mtx.x, pdn[vi + 1] * sc_mtx.y, pdn[vi + 2] * sc_mtx.z];
					const qxz = followXZProj([pn[0], pn[2]]);
					npn = norm([pn[0], pn[1], pn[2]]);
					const qvn = quaternFromVects([0, 1, 0], npn);
					const qfn = quaternAdd(...qvn, ...qxz);

					const qn = qyb ? quaternAdd(...qfn, ...qyb) : qfn;
					qt = quaternAdd(...q, ...qn);
				} else {
					qt = qyb ? quaternAdd(...q, ...qyb) : q;
				}
				mtx.makeRotationFromQuaternion(new THREE.Quaternion(qt[1], qt[2], qt[3], qt[0]));
				const pos = multVec16CM(q_mtx.elements, [pv[vi], pv[vi + 1], pv[vi + 2], 1]); 
				mtx.setPosition(pos[0], pos[1], pos[2]);
				pmnew.setMatrixAt(j, mtx);
				const clr = pcfg.color;
				if(clr) pmnew.setColorAt(j, clr[j] || clr[k]);

				pdata.anim[j] = { segDir: [bs, by, bz], q: [...qt], sc: [1, 1, 1], pos: [...pos] };
				if(npn) pdata.anim[j].nrm = [...npn];
			}
		}

		imnew.setMatrixAt(ipos, q_mtx);
		imnew.setColorAt(ipos, ts.color[ipos++]);
	}

	if(ts.renderOrder) imnew.renderOrder = ts.renderOrder;

	imnew.instanceMatrix.needsUpdate = true;
	imnew.instanceColor.needsUpdate = true;
	this.solid.add(imnew);

	const vis = html[prf + 'rend_solid'].checked;

	if(pcfg) {
		if(pcfg.renderOrder) pmnew.renderOrder = pcfg.renderOrder;
		pmnew.instanceMatrix.needsUpdate = true;
		this.solid.add(pmnew);
		pmnew.visible = vis;
	}

	imnew.visible = vis;
}
	
TREE.prototype.updateCode = function (prf) {
	const def = `
	mesh.uniscale = mesh.uniscale || false;
	mesh.attenuation = mesh.attenuation ?? 0.66;
	`;
	let str = this.html[prf + 'code'].value + def;
	['mesh', 'petals'].forEach(nm => { str = str.replaceAll(nm, 'cfg.' + nm) });
	str = str.replaceAll('GLTF', 'this.GLTF');

	try { 
		elog('');
		this.code[prf] = eval(`(color => {\nconst cfg = {};\n${str}\nreturn cfg;\n})`);
	} 
	catch(e) { 
		elogErr(`updateCode(${prf}):\n${e}`);
	};
}
	
TREE.prototype.updateAnim = function (prf) {
	const str = this.html[prf + 'anim'].value;
	if(!str.length) {
		delete this.animate[prf];
		return 1;
	}

	const ch = prf[prf.length - 1];
	const flg = ch == '_';
	const sobj = flg ? 'this.trunk' : `this.branches[${ch}]`;
	const ich = parseInt(ch);
	const par = ich == 0 ? 'this.trunk' : `this.branches[${ich - 1}]`;
	const update = flg ? 'this.updateTrunk()' : `this.updateBranches(${ch}, ${par}.q, ${par}._v)`;
	const cfg = `
	const data_ = ${sobj};
	const solid = data_.solid;
	const imesh = solid?.instmesh;
	const petals = solid?.ptlmesh;
	const frame = state.frm;
	const G = this.animate.${prf}.global;
	`;
	
	const reg_spt = /(get|set)Petal\(([\w\W]+?)\)/g;

	const txt = str
	.replaceAll('updatePath()', update)
	.replaceAll('getBloomDirs()', 'getBloomDirs(solid)')
	.replace(reg_spt,
		function () {
			return `${arguments[1]}Petal(${arguments[2]}, solid)`;
		});

	this.animate[prf] = this.animate[prf] || { pl: 0, global: {} };
	try {
		elog('');
		this.animate[prf].code = eval(`(function anim() {${cfg}${txt}\n})`).bind(this);
	} catch(e) { 
		elogErr(`updateAnim(${prf}):\n${e}`);
		return 1;
	};
	return 0;
}

TREE.prototype.animateTree = function () {
	for (const prf in this.animate) {
		const anim = this.animate[prf];
		if (anim.pl) anim.code();
	}
}

// DATA HELPERS

const dummy = {
	q: new THREE.Quaternion(),
	m4: new THREE.Matrix4(),
	sc: new THREE.Vector3(),
	pos: new THREE.Vector3(),
	rgb: new THREE.Color(),
};

const getImesh = (i, solid) => {
	const anim = solid.anim[i];
	const [pos, sc] = [anim.pos, anim.sc];
	return {
		sc: { _x: pos[0], _y: pos[1], _z: pos[2] },
		pos: { _x: sc[0], _y: sc[1], _z: sc[2] },
		q: anim.q,
	};
};

const setImesh = (i, obj, solid) => {
	const anim = solid.anim[i];
	const imesh = solid.instmesh;

	for (const nm of ['sc', 'pos']) {
		const anm = anim[nm];
		const atr = { x: anm[0], y: anm[1], z: anm[2] };
		const otr = obj[nm];
		for (const s in otr) {
			const d = s[1] || s[0];
			atr[d] = s[0] == '_' ? otr[s] : otr[s] + atr[d];
		}
		dummy[nm].set(atr.x, atr.y, atr.z);
	}

	const qt = obj.q ? quaternAdd(...obj.q, ...anim[i].q) : obj._q ? obj._q : anim[i].q;
	dummy.q.set(qt[1], qt[2], qt[3], qt[0]);

	dummy.m4.compose(dummy.pos, dummy.q, dummy.sc);
	imesh.setMatrixAt(i, dummy.m4);

	if (obj.rgb) imesh.setColorAt(i, dummy.rgb.set(obj.rgb));
};

const getBloomDirs = solid => {
	const anim = solid.pdata.anim;
	const len = solid.ptlmesh.count;
	const arr = new Array(len);
	for (let i = 0; i < len; i++) {
		const ai = anim[i];
		const petDir = quaternRotate(0, 1, 0, ...ai.q);
		arr[i] = norm(cross(...ai.segDir, ...petDir));
	}
	return arr;
};

const getPetal = (i, solid) => {
	const anim = solid.pdata.anim[i];
	anim.nrm = anim.nrm || [0, 0, 0];
	let cnt;
	const obj = {};
	for (const pr of ['sc', 'pos', 'nrm']) {
		cnt = 0;
		obj[pr] = {};
		for (const nm of ['_x', '_y', '_z']) obj[pr][nm] = anim[pr][cnt++];
	}
	obj.q = anim.q;
	obj.segDir = anim.segDir;
	return obj;
};

const setPetal = (i, obj, solid) => {
	const anim = solid.pdata.anim[i];
	const petals = solid.ptlmesh;

	for (const nm of ['sc', 'pos']) {
		const anm = anim[nm];
		const atr = { x: anm[0], y: anm[1], z: anm[2] };
		const otr = obj[nm];
		for (const s in otr) {
			const d = s[1] || s[0];
			atr[d] = s[0] == '_' ? otr[s] : otr[s] + atr[d];
		}
		dummy[nm].set(atr.x, atr.y, atr.z);
	}

	const qt = obj.q ? quaternAdd(...obj.q, ...anim.q) : obj._q ? obj._q : anim.q;
	dummy.q.set(qt[1], qt[2], qt[3], qt[0]);

	dummy.m4.compose(dummy.pos, dummy.q, dummy.sc);
	petals.setMatrixAt(i, dummy.m4);

	if (obj.rgb) petals.setColorAt(i, dummy.rgb.set(obj.rgb));
};

// LOADERS

const loadGLTF = (GLTF, str, res) => {
	let toLoad = {};
	try {
		elog('');
		toLoad = eval(`(${str})`);
	} catch (e) {
		elogErr(`loadGLTF(${str}):\n${e}`);
		return;
	};
	let tot = 0;
	for (const p in toLoad) {
		tot++;
		gltfldr.load(
			toLoad[p],
			gltf => {
				GLTF[p] = gltf;
				if (--tot == 0) res?.();
				elog(`${tot} loaded GLTF.${p}\n`, true);
			},
			undefined,
			err => {
				if (--tot == 0) res?.();
				log('error loading gltf:', err);
			}
		);
	}
};

const load = async (def, imp_data) => {
	
	const rngGet = rngSeed;

	const GET = {
		group: imp_data.grp,
		name: imp_data.name,
	};

	const [grp, nm] = [decodeURI(GET.group), decodeURI(GET.name)];
	if (!def && grp && nm) {
		const pobj = imp_data;
		for (const p in pobj.html) {
			const pfx = p.slice(-4);
			if (pfx == 'code' || pfx == 'anim') {
				const prp = pobj.html[p];
				prp.value = safeToStr(prp.value);
			}
		}
		// one time use rng
		if (pobj.seeds) rngSeed = rngSet;
	}

	// load gltf
	const GLTF = {};
	const gltf = imp_data.gltf;	
	if (gltf) {
		const str = safeToStr(gltf);
		await new Promise((res, rej) => { loadGLTF(GLTF, str, res) }).then(() => { }).catch(() => { });
	}

	const html = imp_data.html;
	const max_lev = imp_data.max_lev;
	const seeds = imp_data.seeds ? deepCopy(imp_data.seeds) : {};
	const autoplay = imp_data.auto;
	
	const tree = new TREE({ max_lev, GLTF, html, seeds, autoplay });
	
	for (const prf of tree.pref) tree.updateAnim(prf); // create .code
	
	// restore rng
	rngSeed = rngGet;

	return tree;
};

// INIT

const CM = {};
const create = async (id, data, mats) => {
	for (const p in mats) if (!CM.hasOwnProperty(p)) CM[p] = mats[p];
	let tree;
	await load(false, data)
		.then(t => { 
			if (t.autoplay) for (const prf in t.animate) t.animate[prf].pl = true;
			tree = t;
		})
		.catch(err => { log(`tree loader error: ${err}`) });
	
	return [id, tree];
};

export { create }
