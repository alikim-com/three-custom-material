const dot = (arr1, arr2) => {
	if (arr1.length != arr2.length) {
		console.error('dot: dimensions mismatch');
		return 0;
	}
	let d = 0;
	for (let i = 0; i < arr1.length; i++) d += arr1[i] * arr2[i];
	return d;
};

const cross = (a1, a2, a3, b1, b2, b3) => [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1];

const norm = arr => {
	let mod2 = 0;
	const len = arr.length;
	for (let i = 0; i < len; i++) {
		const ai = arr[i];
		mod2 += ai * ai;
	}
	if (mod2 == 0) return arr;
	const modr = 1 / Math.sqrt(mod2);
	const ret = new Array(len);
	for (let i = 0; i < len; i++) ret[i] = arr[i] * modr;
	return ret;
};

const vs = `
attribute vec3 clr;
varying vec3 vclr;

attribute vec3 clr2;
varying vec3 vclr2;

varying vec2 vuv;

void main() {
 
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  
  gl_Position = projectionMatrix * mvPosition;
  
  vclr = clr;
  vclr2 = clr2;
  vuv = uv;
}
`; 

const fs = `
varying vec3 vclr;
varying vec3 vclr2;

varying vec2 vuv;

uniform vec2 fact;
uniform bool alpha;
uniform bool invert;
uniform int mode;
uniform float wave;
uniform float exp;

float falloff(float exp, float arg) {
	return exp > 1.0 ? pow(exp, -arg) : smoothstep(1.0, 0.0, arg);
}

void main() {   

	float pi = 3.1415926535;
	float wp = wave * pi;
	vec3 _vclr = wave > 0.0 ? 0.5 * (cos(wp * (1.0 - vclr)) + 1.0) : vclr;
	vec3 _vclr2 = wave > 0.0 ? 0.5 * (cos(wp * (1.0 - vclr2)) + 1.0) : vclr2;

	vec4 clr;

	vec4 _fg = vec4(0.5, 0.0, 0.5, 1.0);
	vec4 _bg = vec4(0.0, 0.0, 0.0, alpha);
	vec4 bg = invert ? _fg : _bg;
	vec4 fg = invert ? _bg : _fg;

	if(mode == 0) {

		bvec3 down = lessThan(_vclr, vec3(fact.x));
		bvec3 up = lessThan(_vclr2, vec3(fact.x));
		clr = any(down) || any(up) ? fg : bg;

	} else if(mode == 1) {
	 
		float vdown = min(min(_vclr.r, _vclr.g), _vclr.b);
		float vup = min(min(_vclr2.r, _vclr2.g), _vclr2.b);
			
		float sdown = falloff(exp, fact.y * vdown);
		float sup = falloff(exp, fact.y * vup);

		float s = max(sup, sdown);
		float a = alpha ? 1.0 : s;
		clr = vec4(mix(bg, fg, s));

	} else if(mode == 2) {
	 
		int ind = _vclr[0] < _vclr[1] ? 0 : 1;
		ind = _vclr[2] < _vclr[ind] ? 2 : ind;

		float sdown = falloff(exp, fact.y * _vclr[ind]);
		float sup = falloff(exp, fact.y * _vclr2[ind]);

		float s = max(sup, sdown);
		float a = alpha ? 1.0 : s;
		vec3 s3 = vec3(0.0);
		s3[ind] = s;
		clr = vec4(s3, a);

	}

	gl_FragColor = clr;
}
`;

const getNonIndGeomSegm = geo => {
	const segm = { pos: [], off: [] };
	const pos = geo.attributes.position.array;
	const _off = [0, 1, 2, 0];
	for(let i = 0; i < pos.length; i+=9) {
		for(const k of _off) {
			const off = i + 3 * k;
			segm.pos.push(...pos.slice(off, off + 3));
			segm.off.push(off);
		}
	}
	return segm;
};

const edgeFinder = (_segm, derr, perr) => {

	const checkUnique = (p0p1, data, err) => {
		for (let i = 0; i < data.length; i++) {
			const _p0p1 = data[i].segm;
			for (let k = 0; k < 2; k++) {
				let match = true;
				for (let j = 0; j < 6; j++)
					if (Math.abs(p0p1[j] - _p0p1[j]) > err) { match = false; break; }
				if (match) return i;
				[p0p1[0], p0p1[3]] = [p0p1[3], p0p1[0]];
				[p0p1[1], p0p1[4]] = [p0p1[4], p0p1[1]];
				[p0p1[2], p0p1[5]] = [p0p1[5], p0p1[2]];
			}
		}
		return -1;
	};

	const data = [];

	let cnt = 0, sep = 1;
	const [pos, off] = [_segm.pos, _segm.off];
	const imax = pos.length - 3;
	for (let i = 0; i < imax; i += 3) {
		if (sep++ % 4 == 0) continue;
		const p0p1 = pos.slice(i, i + 6);
		const ip2 = sep % 4 ? i + 6 : i - 3;
		const p2 = pos.slice(ip2, ip2 + 3);
		const match = checkUnique(p0p1, data, perr);
		const i3 = i / 3;
		if (match != -1) {
			const di = data[match];
			di.tnum++;
			di.tri.push(...p2);
			di.off.push(off[i3], off[i3 + 1], off[ip2 / 3]);
			continue;
		}
		data[cnt++] = {
			off: [i3, i3 + 1, ip2 / 3].map(e => off[e]),
			segm: [...p0p1],
			tri: [...p2],
			tnum: 1,
			edge: 0,
		};
	}

	const sub = (p1, p0) => [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];

	const mismatchVec3 = (vec, data, err) => {
		for (let i = 0; i < data.length; i += 3) {
			const d = Math.abs(dot(vec, data.slice(i, i + 3)));
			if (d < 1 - err) return i;
		}
		return -1;
	};

	for (const obj of data) {
		const nrm = [];
		const cnt = obj.tnum;
		if (cnt == 1) {
			obj.edge = 1;
			continue;
		}
		const [p0, p1] = [obj.segm.slice(0, 3), obj.segm.slice(3, 6)];
		const p1p0 = sub(p1, p0);
		for (let i = 0; i < cnt; i++) {
			const off = 3 * i;
			const p2 = obj.tri.slice(off, off + 3);
			const p2p0 = sub(p2, p0);
			const crs = norm(cross(...p1p0, ...p2p0));
			if (mismatchVec3(crs, nrm, derr) == -1) {
				nrm.push(...crs);
				continue;
			}
			obj.edge = 1;
			break;
		}
	}

	return data;
};

const createEdges = (ni_geo, derr, perr) => {

	const segm = getNonIndGeomSegm(ni_geo);
	const data = edgeFinder(segm, derr, perr);

	const pos = ni_geo.attributes.position.array;
	const len = pos.length;
	const clr = new Array(len).fill(-1);
	for (const obj of data) {
		const e = obj.edge;
		const [v, x] = [e ^ 1, e];
		const tnum = obj.tnum;
		for (let i = 0; i < tnum; i++) {
			const idx = i * 3;
			const [ip, rgb] = [new Array(3), new Array(3)];
			for (let j = 0; j < 3; j++) {
				const t = ip[j] = obj.off[idx + j];
				rgb[j] = clr.slice(t, t + 3);
			}
			for (let ch = 0; ch < 3; ch++) {
				const [v0, v1, v2] = rgb.map(e => e[ch]);
				if (!v2) continue;
				if (v0 != x && v1 != x) {
					clr[ip[2] + ch] = 1;
					clr[ip[0] + ch] = clr[ip[1] + ch] = v;
					break;
				}
			}
		}
	}
	for (let i = 0; i < len; i++) clr[i] = Math.abs(clr[i]);

	ni_geo.setAttribute('clr', new THREE.Float32BufferAttribute(clr, 3));

	return data;
};

const fixNotches = (ni_geo, data) => {

	const findGrad = (clr0, clr1) => {
		for (let i = 0; i < 3; i++) {
			const [ci0, ci1] = [clr0[i], clr1[i]];
			if (ci0 == ci1) continue;
			if (ci0 > ci1) return [i, 0];
			return [i, 1];
		}
		return [-1, -1];
	};

	const clr = ni_geo.attributes.clr.array;
	const len = clr.length;
	const clr2 = new Array(len).fill(-1);
	for (const obj of data) {
		const tnum = obj.tnum;
		const grad = new Array(tnum);
		let all_grad = true;
		for (let i = 0; i < tnum; i++) {
			const idx = i * 3;
			const [off0, off1] = [obj.off[idx], obj.off[idx + 1]];
			const gi = grad[i] = findGrad(clr.slice(off0, off0 + 3), clr.slice(off1, off1 + 3));
			if (gi[0] == -1) {
				all_grad = false;
				break;
			}
		}
		if (all_grad) {
			for (let i = 0; i < tnum; i++) {
				const idx = i * 3;
				const [ch, n] = grad[i];
				clr2[obj.off[idx + n] + ch] = 0;
			}
		}
	}
	for (let i = 0; i < len; i++) clr2[i] = Math.abs(clr2[i]);

	ni_geo.setAttribute('clr2', new THREE.Float32BufferAttribute(clr2, 3));
};

const THREE = {};
const uni_def = {
	width: 0.2, 
	alpha: true,
	invert: false, 
	mode: 0,
	wave: 0,
	exp: 1,
};

const init = (_geo, Mesh, ShaderMaterial, Float32BufferAttribute, config, derr = 0.001, perr = 0.001) => { 
	THREE.Mesh = Mesh;
	THREE.ShaderMaterial = ShaderMaterial;
	THREE.Float32BufferAttribute = Float32BufferAttribute;

	for (const nm of Object.keys(uni_def))
		config[nm] = config[nm] ?? uni_def[nm];
	
	const uni = {};
	for(const nm of Object.keys(config))
		uni[nm] = { get value() { return config[nm] } };
	
	uni._fact = { value: [0, 0] };
	Object.defineProperty(uni, 'fact', {
		get: function () {
			const w = config.width;
			const val = this._fact.value;
			if (val[0] != w) {
				val[0] = w;
				val[1] = 1 / w;
			}
			return this._fact;
		},
		enumerable: true,
		configurable: true,
	});

	const geo = _geo.index ? _geo.toNonIndexed() : _geo;

	const data = createEdges(geo, derr, perr);
	fixNotches(geo, data);

	const mesh = new THREE.Mesh(
		geo,
		new THREE.ShaderMaterial({
			vertexShader: vs,
			fragmentShader: fs,
			uniforms: uni,
			transparent: true,
		})
	);

	return mesh;
};

export { init }