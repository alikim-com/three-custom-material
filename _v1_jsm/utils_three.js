import { slog, log } from '/_v1_jsm/utils.js'

import * as THREE from '/_v1_jsm/three.module.js'

import { sphereToCart, quaternRotateMult } from '/_v1_jsm/geometry.js'

let max_tex_size = 0;
const gl = document.createElement('canvas')?.getContext('webgl');
if (gl) max_tex_size = gl.getParameter(gl.MAX_TEXTURE_SIZE);

const traverseTree = function (src, callback) {
	const recurse = obj3D => {
		const children = obj3D.children;
		for (let i = 0; i < children.length; i++) {
			const ch = children[i];
			callback(ch);
			recurse(ch);
		}
	};
	recurse(src);
};

const makeRT = function (w, h, _opt) {
	const OPT = {
		magFilter: THREE.NearestFilter,
		minFilter: THREE.NearestFilter,
		generateMipmaps: false,
	};
	const opt = _opt ? { ...OPT, ..._opt } : OPT;
	return new THREE.WebGLRenderTarget(w, h, opt);
};

const renderRT = (rend, scene, camera, outputRT, clear = true) => {
	const bool = !clear && rend.autoClear;
	if (bool) rend.autoClear = false;
	rend.setRenderTarget(outputRT);
	rend.render(scene, camera);
	rend.setRenderTarget(null);
	if(bool) rend.autoClear = true;
};

const renderRTVP = (rend, scene, camera, outputRT, vp, clear = true) => {
	const bool = !clear && rend.autoClear;
	if (bool) rend.autoClear = false;
	const vp_old = new THREE.Vector4();
	rend.getCurrentViewport(vp_old);
	rend.setRenderTarget(outputRT);
	rend.setViewport(vp);
	rend.render(scene, camera);
	rend.setViewport(vp_old);
	rend.setRenderTarget(null);
	if(bool) rend.autoClear = true;
};

const renderTexQuad = (rend, tex, w, h, clr) => {
	const mat = new THREE.MeshBasicMaterial({ map: tex });
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
	const tsc = new THREE.Scene();
	if(clr) tsc.background = clr;
	tsc.add(mesh);
	const canv = rend.domElement;
	const [cw, ch] = [canv.clientWidth, canv.clientHeight];
	const tcm = new THREE.OrthographicCamera(-cw / 2, cw / 2, ch / 2, -ch / 2, 0, 1);
	rend.render(tsc, tcm);
};

const renderTexQuadCust = (rend, tex, w, h, uvs, clr) => {
	const mat = new THREE.ShaderMaterial();
	mat.vertexShader = `
	varying vec2 vuv;
	void main() {
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		vuv = uv;
	}
	`;
	mat.fragmentShader = `
	varying vec2 vuv;
	uniform sampler2D tex;
	uniform vec4 uvs;
	void main() {
		vec4 r2d2 = texture2D(tex, uvs.xy + vuv * uvs.zw);
		float dist = (r2d2.a * 256.0 + r2d2.b) * 255.0 / 65535.0;
		// float id = 1.0 * (r2d2.g * 256.0 + r2d2.r);
		gl_FragColor = vec4(10.0 * r2d2.r, 1.0 * r2d2.g, 0.0, 1.0);//vec4(1.0 - dist, 0.0, id, 1.0);
	}
	`;
	mat.uniforms = {
		tex: { value: tex },
		uvs: { value: uvs }, // [u0,v0,uw,vh]
	};
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
	const tsc = new THREE.Scene();
	if(clr) tsc.background = clr;
	tsc.add(mesh);
	const canv = rend.domElement;
	const [cw, ch] = [canv.clientWidth, canv.clientHeight];
	const tcm = new THREE.OrthographicCamera(-cw / 2, cw / 2, ch / 2, -ch / 2, 0, 1);
	rend.render(tsc, tcm);
};

const genAtlas = (wh, tile) => {
	const fn = 'genAtlas():';

	let area = 0;
	let wmax = 0;
	wh.forEach(a => {
		const w = a[0];
		area += w * a[1];
		if (w > wmax) wmax = w;
	 });

	const sz = Math.max(Math.sqrt(area), wmax);
	const tiles = Math.ceil(sz/tile);
  
	const atl = {};
	let ch = tiles * tile;
	let cw = ch;
	if (cw > max_tex_size) {
		log(`${fn} MAX_TEXTURE_SIZE ${max_tex_size} exceeded ${cs}`);
		return;
	}

	wh.sort((a, b) => a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0);
  
	const fill = () => {
  
		let [px, py, hmax, bot] = [0, 0, 0, wh[0][1]];
  
		for(let i = 0; i < wh.length; i++) {
			const [w, h, id] = wh[i];
			if(px + w > cw) { // new shelf
				px = 0;
				py += hmax;
				bot = py + h;
				if(bot > ch) return 0;
				hmax = h;
			}
			atl[id] = [px, py, w, h];
			px += w;
			hmax = h > hmax ? h : hmax;
		}
  
		return bot;
	};

	let up_h = true;
	const umax = 100;
	for(let i = 0; i < umax; i++) { 
		const ret = fill();
		if(!ret) {
			if(i < umax - 1) {
				//log(`${fn} didn't fit, upgrade ${i} of height ${up_h}`);
				if (up_h) ch += tile; else cw += tile;
				up_h = !up_h;
				if (cw > max_tex_size || ch > max_tex_size) {
					log(`${fn} MAX_TEXTURE_SIZE ${max_tex_size} exceeded ${cw} x ${ch}`);
					return [0, 0, atl];
				}
			}
		  	else {
				log(`${fn} too many upgrades`);
				return [0, 0, atl];
			}
		} else {
			// clip
			while(ch >= ret + tile) {
				ch -= tile;
				//slog(`${fn} clipping height ${ch}, ${ret}`);
			}
		}
	}
  
	return [cw, ch, atl];
};
  
const trackCanvas = function (canvas, mode) {
	this.cnv_off = {};
	const onMouseOver = evt => {
		[this.cnv_off.on, this.cnv_off.x, this.cnv_off.y] = [true, evt.offsetX, evt.offsetY]
	};
	const onMouseOut = evt => {
		this.cnv_off.on = false
	};
	const onMouseMove = evt => {
		[this.cnv_off.x, this.cnv_off.y] = [evt.offsetX, evt.offsetY]
	};
	if (mode) {
		canvas.addEventListener('mouseover', onMouseOver);
		canvas.addEventListener('mouseout', onMouseOut);
		canvas.addEventListener('mousemove', onMouseMove);
		this.selectRT = this.makeRT(1, 1);
	} else {
		canvas.removeEventListener('mouseover', onMouseOver);
		canvas.removeEventListener('mouseout', onMouseOut);
		canvas.removeEventListener('mousemove', onMouseMove);
		if (this.selectRT) this.selectRT.dispose();
	}
};

const selectRender = function (w, h, scene, camera) {
	if (!this.cnv_off.on) return 0;
	camera.setViewOffset(w, h, this.cnv_off.x, this.cnv_off.y, 1, 1);
	this.renderRT(scene, camera, this.selectRT);
	camera.clearViewOffset();
	const buff = new Uint8Array(4);
	renderer.readRenderTargetPixels(this.selectRT, 0, 0, 1, 1, buff);
	return buff[0];
};

const selectFullRender = function (outputRT, h, scene, camera) {
	if (!this.cnv_off.on) return 0;
	this.renderRT(scene, camera, outputRT);
	const buff = new Uint8Array(4);
	renderer.readRenderTargetPixels(outputRT, this.cnv_off.x, h - this.cnv_off.y, 1, 1, buff);
	return buff[0];
};

const computeTwistNormals = geo => {
	if(geo.type == 'CylinderGeometry' || geo.type == 'SphereGeometry') {
	  const pos = geo.attributes.position.array;
	  const nrm = geo.attributes.normal.array;
	  for(let i = 0; i < pos.length; i+=3) {
		 // top & bot
		 if(Math.abs(nrm[i + 1]) == 1) continue;
		 const fi = Math.atan2(pos[i], pos[i + 2]);
		 const th = Math.acos(nrm[i + 1]);
		 [nrm[i + 2], nrm[i], nrm[i + 1]] = [...sphereToCart(1, fi, th)];
	  }
	}
 };

 const computeProfileNormals = (geo, func) => {
	const par = geo.parameters;
	const types = ['CylinderGeometry', 'SphereGeometry'];
	const type = types.findIndex(e => e == geo.type);
 
	const pnt = [];
	let th1, ths, h, hstep;
	const segm = par.heightSegments;
 
	if(type == 0) {
		const [rt, rb] = [par.radiusTop, par.radiusBottom];
		const vstep = (rt - rb) / segm;
		h = par.height;
		hstep = h / segm;
		// build profile
		for(let i = 0; i <= segm; i++) {
			const u = i / segm;
			const fact = func(u);
			pnt.push([i * hstep, fact * (rb + i * vstep)]);
		}
	} else if(type == 1) {
		const [th0, thlen] = [par.thetaStart, par.thetaLength];
		th1 = th0 + thlen;
		ths = thlen / segm;
		const r = par.radius;
		const [mx, mn] = [r * Math.cos(th0), r * Math.cos(th1)];
		const lenr = 1 / (mx - mn);
		for(let i = 0; i <= segm; i++) {
			const th = th1 - ths * i;
			const [x, y] = [r * Math.cos(th), r * Math.sin(th)];
			const u = 1 - (mx - x) * lenr;
			const fact = func(u);
			pnt.push([x, fact * y]);
		}
	} else return;
	
	const plen = pnt.length;
	const th = new Array(plen);
	for(let i = 1; i < plen - 1; i++) {
	  const [prv, cur, nxt] = [pnt[i - 1], pnt[i], pnt[i + 1]];
	  const vp = [cur[0] - prv[0], cur[1] - prv[1]];
	  const np = [nxt[0] - cur[0], nxt[1] - cur[1]];
	  th[i] = Math.atan2(vp[0] + np[0], -vp[1] - np[1]); // rot 90 ccw 
	  if(i == 1) th[0] = Math.atan2(vp[0], -vp[1]);
	  if(i == plen - 2) th[plen - 1] = Math.atan2(np[0], -np[1]);
	}
 
	// aply normals

	const findClosest = (pnt, v) => {
		let [ind, err] = [0, Infinity];
		for(let i = 0; i < pnt.length; i++) {
			const e = Math.abs(pnt[i][0] - v);
			if(e < err) {
				err = e;
				ind = i;
			}
		}
		return ind;
	};

	const h2 = h / 2;
	const pos = geo.attributes.position.array; 

	const nrm = geo.attributes.normal.array;
	for(let i = 0; i < pos.length; i+=3) {
		// top & bot
		if(Math.abs(nrm[i + 1]) == 1) continue;
		const py = pos[i + 1];
		const fi = Math.atan2(nrm[i], nrm[i + 2]);
		const ind = type == 0 ? Math.round((py + h2) / hstep) : type == 1 ? findClosest(pnt, py) : 0;
		[nrm[i + 2], nrm[i], nrm[i + 1]] = [...sphereToCart(1, fi, th[ind])];
	}
};
 
const bisecTriangle = (ver, ind, ii, jmx, ti, mp) => {
	// add new point
	const vlen = ver.length;
	const _ver = new Float32Array(vlen + 3);
	for(let i = 0; i < vlen; i++) _ver[i] = ver[i];
	_ver[vlen] = mp[0];
	_ver[vlen + 1] = mp[1];
	_ver[vlen + 2] = 0;
	// add indexes
	const _ind = new Uint16Array(ind.length + 3);
	for(let i = 0; i < ii; i++) _ind[i] = ind[i];

	const opp = jmx ? jmx - 1 : 2; // opposite vertex
	const _vlen = _ver.length / 3;
	const split = [
		ti[opp], ti[jmx], _vlen - 1,
		ti[opp], _vlen - 1, ti[jmx == 2 ? 0 : jmx + 1],
	];
	for(let i = 0; i < 6; i++) _ind[ii + i] = split[i];
	for(let i = ii + 3; i < ind.length; i++) _ind[i + 3] = ind[i];

	return {_ver, _ind};
};

function Selector3D (renderer, scene, camera, w, h) {
	const nm = ['renderer', 'scene', 'camera', 'w', 'h'];
	Array.from(arguments).forEach((v, i) => { this[nm[i]] = v });
	const opt = {
		magFilter: THREE.NearestFilter,
		minFilter: THREE.NearestFilter,
	};
	this.outputRT = new THREE.WebGLRenderTarget(1, 1, opt);
	this.scene_bg = new THREE.Color(0xffffff);
	this.scanScene();
}

Selector3D.prototype.scanScene = function () {
	this.chaff = [];
	this.list = [];
	let id = 0;
	traverseTree(this.scene,
		obj3D => {
			if (!obj3D.material) return; // exclude non-renderable objects/groups
			if (!obj3D.userData.sel) {
				this.chaff.push({ obj3D, vis: false });
				return;
			}
			this.list.push(obj3D);
			obj3D.userData.sel3D = {
				red: new THREE.MeshBasicMaterial({ color: id++, side: obj3D.material.side }),
				mat: obj3D.material,
			};
	});
}

Selector3D.prototype.render = function (x, y) {
	const bg = this.scene.background;
	this.scene.background = this.scene_bg; // max id
	
	for (let i = 0; i < this.chaff.length; i++) {
		const obj = this.chaff[i];
		obj.vis = obj.obj3D.visible;
		obj.obj3D.visible = false;
	}

	for (const obj3D of this.list)
		if (obj3D.visible) obj3D.material = obj3D.userData.sel3D.red;

	this.camera.setViewOffset(this.w, this.h, x, y, 1, 1);

	this.renderer.setRenderTarget(this.outputRT);
	this.renderer.render(this.scene, this.camera);
	this.renderer.setRenderTarget(null);

	this.camera.clearViewOffset();

	for (const obj3D of this.list)
		if (obj3D.visible) obj3D.material = obj3D.userData.sel3D.mat;
	
	for (let i = 0; i < this.chaff.length; i++) {
		const obj = this.chaff[i];
		obj.obj3D.visible = obj.vis;
	}

	this.scene.background = bg;
}

Selector3D.prototype.getID = function () {
	const buff = new Uint8Array(4);
	this.renderer.readRenderTargetPixels(this.outputRT, 0, 0, 1, 1, buff);
	return buff; 
}

Selector3D.prototype.getObj = function(x, y) {
	this.render(x, y);
	const [r, g, b,] = this.getID();
	const id = b + (g << 8) + (r << 16);
	return this.list[id];
}

const texldr = new THREE.TextureLoader();
const texLoader = (url, ind = '') => {
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
					data: err,
					ind,
					src: `texRequest(${url}, ${ind})`,
					err
				})
			});
	});
};

const addHelper = (scene, objarr, size = 1, type = 'sphere') => {
	const arr = objarr.length ? objarr : [objarr];
	const cont = scene.getObjectByName('helpers') || (() => {
		const obj = new THREE.Object3D();
		obj.name = 'helpers';
		scene.add(obj);
		return obj;
	})();
	arr.forEach(obj => {
		if (!obj.position) {
			log('addHelper() err: no position for', obj);
			return;
		}
		if (type == 'sphere') {
			const hlp = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 4), new THREE.MeshBasicMaterial());
			hlp.name = obj.name;
			if (obj.color) Object.defineProperty(hlp.material, 'color', {
				enumerable: true,
				configurable: true,
				get: function () { return obj.color }
			});
			if (obj.position) Object.defineProperty(hlp, 'position', {
				enumerable: true,
				configurable: true,
				get: function () {
					const [wo, ws] = [new THREE.Vector3(), new THREE.Vector3()];
					obj.getWorldPosition(wo);
					scene.getWorldPosition(ws);
					return new THREE.Vector3().subVectors(wo, ws);
				}
			});
			cont.add(hlp);
		}
	});
};

const vAlphaLine = (pnts, vclr) => {
	// pnts = [x1,y1,z1, x2,y2,z2, ...]
	// vclr = [r1,g1,b1,a1, r2,g2,b2,a2, ...] E [0,1]
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position',
		new THREE.BufferAttribute(new Float32Array(pnts), 3));
	
	const material = new THREE.LineBasicMaterial({
		transparent: true, // #undef OPAQUE
		vertexColors: true, // #def USE_COLOR
	});
	material.onBeforeCompile = function(shader) {
		shader.defines = { USE_COLOR_ALPHA: '' }; // vColor = vec4();
	}
	geo.setAttribute('color',
		new THREE.BufferAttribute(new Float32Array(vclr), 4)
	);

	return new THREE.Line(geo, mat);
};

const alphaLine = (vclr, pnts, a) => {
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', 
		new THREE.BufferAttribute(new Float32Array(pnts), 3));
	
	const mat = a ?
		new THREE.LineBasicMaterial({
			vertexColors: true,
			opacity: a,
			transparent: true,
		}) :
		new THREE.LineBasicMaterial({
			vertexColors: true,
		});
	geo.setAttribute('color',
		new THREE.BufferAttribute(new Float32Array(vclr), 3));
	
	return new THREE.Line(geo, mat);
};

const camHelper = cam => {
	const dtr = Math.PI / 180;
	const grp = new THREE.Object3D();
	if(cam.type == 'PerspectiveCamera') {
		const asp = cam.aspect;
		const near = cam.near;
		const far = cam.far;
		const tan = Math.tan(cam.fov * dtr / 2);
		const ny = near * tan;
		const nx = ny * asp;
		const nz = -near;
		grp.pnear = [-nx, ny, nz, nx, ny, nz, nx, -ny, nz, -nx, -ny, nz, -nx, ny, nz];
		const fy = far * tan;
		const fx = fy * asp;
		const fz = -far;
		grp.pfar = [-fx, fy, fz, fx, fy, fz, fx, -fy, fz, -fx, -fy, fz, -fx, fy, fz];
		grp.ptop = [-fx, fy, fz, 0, 0, 0, fx, fy, fz];
		grp.pbot = [-fx, -fy, fz, 0, 0, 0, fx, -fy, fz];
		grp.peye = [0, 0, 0, 0, 0, fz];
		const lnear = alphaLine([1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0], [...grp.pnear]);
		const lfar = alphaLine([1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0], [...grp.pfar]);
		const ltop = alphaLine([1, 0, 0, .5, .5, .5, 1, 0, 0], [...grp.ptop]);
		const lbot = alphaLine([0, 0, 1, .5, .5, .5, 0, 0, 1], [...grp.pbot]);
		const leye = alphaLine([.5, .5, .5, 1, 0, 1], [...grp.peye]);
		lnear.name = 'near';
		lfar.name = 'far';
		ltop.name = 'top';
		lbot.name = 'bot';
		leye.name = 'eye';
		grp.add(lnear, lfar, ltop, lbot, leye);
	}
	
	Object.defineProperty(grp, 'position', {
		enumerable: true,
		configurable: true,
		get: function () {
			return new THREE.Vector3().copy(cam.position);
		}
	});

	grp.update = () => {
		const q = cam.quaternion;
		for (const me of grp.children) {
			const nm = me.name;
			me.geometry.attributes.position.array.set(
				quaternRotateMult(grp['p' + nm], q.w, q.x, q.y, q.z));
		}
	};

	grp.update();
	
	return grp;
};

const qGet = q => [q.w, q.x, q.y, q.z];
const qMake = q => new THREE.Quaternion(q[1], q[2], q[3], q[0]);

export { bisecTriangle, computeTwistNormals, computeProfileNormals, traverseTree, makeRT, renderRT, renderRTVP, renderTexQuad, renderTexQuadCust, addHelper, camHelper, genAtlas, Selector3D, texLoader, vAlphaLine, alphaLine, qGet, qMake }