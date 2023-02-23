function log() { console.log(...arguments) }

const distLinePoint = (p1, p2, x0, y0) => {
	const dx = p2[0] - p1[0];
	const dy = p2[1] - p1[1];
	const num = Math.abs(dx * (y0 - p1[1]) - dy * (x0 - p1[0])); // sqrt(cross[z]^2)
	const den = Math.sqrt(dy * dy + dx * dx);
	if (den == 0) console.error('distLinePoint(): division by zero');
	return num / den;
};

const distLinePoint3D = (p1, p2, a) => {
	// dot(d,v2) = cos * |v2|, cos = proj/|v2| -> dot(d,v2) = proj
	const [v1, v2] = [new Array(3), new Array(3)];
	for(let i = 0; i < 3; i++) {
	  v1[i] = p2[i] - p1[i];
	  v2[i] = a[i] - p1[i];
	}
	const d = norm(v1);
	const proj = dot(d, v2);
	const X0 = new Array(3);
	for(let i = 0; i < 3; i++) X0[i] = p1[i] + d[i] * proj - a[i];
	return vectLength(X0);
 };

const linesIntersect = (p1, p2, p3, p4) => {
	if (p2[0] == p3[0] && p2[1] == p3[1]) return p2;
	if (p1[0] == p4[0] && p1[1] == p4[1]) return p1;
	// Pt = P1 + (P2 - P1)t
	// Pv = P3 + (P4 - P3)v
	const [a, b, c, d, e, f, g, h] = [
		p1[0],
		p2[0] - p1[0],
		p3[0],
		p4[0] - p3[0],
		p1[1],
		p2[1] - p1[1],
		p3[1],
		p4[1] - p3[1],
	];
	const v = (b * (e - g) + f * (c - a)) / (h * b - f * d);
	if (isNaN(v)) console.error('linesIntersect() err v: ', p1, p2, p3, p4);
	const safe = Math.abs(b) >= Math.abs(f);
	const t = safe ? (c - a + d * v) / b : (g - e + h * v) / f;
	if (isNaN(t)) console.error('linesIntersect() err t: ', p1, p2, p3, p4);
	return [a + b * t, e + f * t];
};

const pointInPolygon = (pts, x, y) => {

	const pointSide = (p0, p1, x, y) =>
		(p1[0] - p0[0]) * (y - p0[1]) - (x - p0[0]) * (p1[1] - p0[1]); // >0 left, =0 on, <0 right

	let wn = 0; // winding number
	for (let i = 0; i < pts.length - 1; i++) {
		const [p, pn] = [pts[i], pts[i + 1]];
		const above = p[1] <= y;
		if (above && pn[1] > y && pointSide(p, pn, x, y) > 0) wn++;
		else if (!above && pn[1] <= y && pointSide(p, pn, x, y) < 0) wn--;
	}
	return wn == 0 ? false : true;
};

const polygonWinding = pts => {
	const len = pts.length;
	let [minx, miny, mi] = [pts[0][0], pts[0][1], 0];
	for (let i = 1; i < len; i++) {
		const [pix, piy] = [pts[i][0], pts[i][1]];
		if (pix < minx || pix == minx && piy < miny) [minx, miny, mi] = [pix, piy, i];
	}
	const [mp, mn] = [mi != 0 ? mi - 1 : len - 2, mi != len - 1 ? mi + 1 : 1];
	const [a, b, c] = [pts[mp], pts[mi], pts[mn]];
	const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
	return det < 0 ? 1 : -1; // cw : ccw
};

const polygonOffset = (pts, width) => {

	let len = pts.length;
	const [pf, pl] = [pts[0], pts[len - 1]];
	const closed = pf[0] == pl[0] && pf[1] == pl[1] ? true : false;
	if (!closed) {
		pts.push(pf);
		len++;
	}

	// figure out if poly is cww or cw
	const cw = polygonWinding(pts);

	// calculate segments' normals; will point outwards if poly traversed cw
	const offset = cw * 0.5 * width;
	const [nou, nin] = [[], []];
	for (let i = 0; i < len - 1; i++) {
		const [pix, piy] = [pts[i][0], pts[i][1]];
		const [nx, ny] = [pts[i + 1][0] - pix, pts[i + 1][1] - piy];
		const amp = offset / Math.sqrt(nx * nx + ny * ny);
		const [tnx, tny] = [-ny * amp, nx * amp];
		nou[i] = [tnx, tny];
		nin[i] = [-tnx, -tny];
	}

	// new points in the dir of norms
	const offPoints = (nrm) => {

		let [ni, ni1] = [nrm[0], nrm[len - 2]];
		let [p1, p2, p3, p4] = [
			[pts[0][0] + ni[0], pts[0][1] + ni[1]],
			[pts[1][0] + ni[0], pts[1][1] + ni[1]],
			[pts[len - 2][0] + ni1[0], pts[len - 2][1] + ni1[1]],
			[pts[len - 1][0] + ni1[0], pts[len - 1][1] + ni1[1]],
		];

		const res = [];

		// fix beg points for open curves, so they are not new intersec but just tip offsets
		res[0] = res[len - 1] = closed ? linesIntersect(p1, p2, p3, p4) : p1;

		for (let i = 0; i < len - 2; i++) {
			ni1 = nrm[i + 1];
			[p3, p4] = [
				[pts[i + 1][0] + ni1[0], pts[i + 1][1] + ni1[1]],
				[pts[i + 2][0] + ni1[0], pts[i + 2][1] + ni1[1]]
			];
			res[i + 1] = linesIntersect(p1, p2, p3, p4);
			[p1, p2] = [p3, p4];
		}

		// same fix for end
		if (!closed) {
			const i = len - 2;
			res[i] = [pts[i][0] + nrm[i - 1][0], pts[i][1] + nrm[i - 1][1]];
		}

		return res;
	};

	const outline = offPoints(nou);
	const inline = offPoints(nin);
	
	if (closed) return [outline, inline];

	pts.pop();
	outline.pop();
	inline.pop();
	return [[...outline, ...(inline.reverse()), outline[0]], []];
};

const dist = (a1, a2) => {
	const len = a1.length;
	if (len != a2.length) {
		log(`dist(): dimentions mismatch ${len} <> ${a2.length}`);
		return;
	}
	let dst = 0;
	for (let i = 0; i < len; i++) {
		const dif = a1[i] - a2[i];
		dst += dif * dif;
	}
	return Math.sqrt(dst);
};

const vectLength = v => {
	let len = 0;
	for (let i = 0; i < v.length; i++) len += v[i] * v[i];
	return Math.sqrt(len);
};

const vectsEqual = (v1, v2) => {
	const [len1, len2] = [v1.length, v2.length];
	if (len1 != len2) return false;
	for (let i = 0; i < len1; i++) if (v1[i] != v2[i]) return false;
	return true;
};

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

const areaTriangle = (p1, p2, p3) => {
	const v23 = [p3[0] - p2[0], p3[1] - p2[1]];
	const v21 = [p1[0] - p2[0], p1[1] - p2[1]];
	return (v23[0] * v21[1] - v23[1] * v21[0]) / 2;
};

const mirror = (n, a) => {
	const amp = 2 * dot(n, a);
	return n.map((e, i) => amp * e - a[i]);
};

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

const norm2 = arr => {
	let mod2 = 0;
	const len = arr.length;
	for (let i = 0; i < len; i++) {
		const ai = arr[i];
		mod2 += ai * ai;
	}
	if (mod2 == 0) return [...arr, 0];
	const mod = Math.sqrt(mod2);
	const modr = 1 / mod;
	const ret = new Array(len);
	for (let i = 0; i < len; i++) ret[i] = arr[i] * modr;
	return [...ret, mod];
};

const cartToSphere = (x, y, z) => { 
	const fi = Math.atan2(y, x);
	const xy = x * x + y * y;
	const rxy = Math.sqrt(xy);
	const th = Math.atan2(rxy, z);
	const r = Math.sqrt(xy+ z * z);
	return [r, fi, th];
};

const sphereToCart = (r, fi, th) => {
	const rsinth = r * Math.sin(th);
	const x = rsinth * Math.cos(fi);
	const y = rsinth * Math.sin(fi);
	const z = r * Math.cos(th);
	return [x, y, z];
};

const quaternFromVects = (v1, v2, err = 0.0001) => {
	const costh = dot(v1, v2);
	if (costh > -1 + err) {
		// add zero rot(1, 0,0,0) and double rot quats then norm
		const q = [costh + 1, ...cross(...v1, ...v2)];
		return norm(q);
	} else {
		const aux = [0, 0, 0];
		const va = v1.map(Math.abs);
		let [min, ind] = [va[0], 0];
		if (va[1] < min) { min = va[1]; ind = 1; }
		if (va[2] < min) ind = 2;
		aux[ind] = 1;
		const orth = norm(cross(...v1, ...aux));
		return [0, ...orth];
	}
};

const quaternFromVectsFull = (v1, v2, err = 0.0001) => {
	const costh = dot(v1, v2);
	if (costh > -1 + err) {
		// add zero rot(1, 0,0,0) and double rot quats then norm
		const crs = cross(...v1, ...v2);
		const q = [costh + 1, ...crs];
		return [norm(q), costh, crs];
	} else {
		const aux = [0, 0, 0];
		let [min, ind] = [v1[0], 0];
		if (v1[1] < min) { min = v1[1]; ind = 1; }
		if (v1[2] < min) { min = v1[2]; ind = 2; }
		aux[ind] = 1;
		const orth = norm(cross(...v1, ...aux));
		return [[0, ...orth], -1, [0,0,0]];
	}
};

const quaternFromETh = (e, th) => {
	th = th / 2;
	const sin = Math.sin(th);
	return [Math.cos(th), e[0] * sin, e[1] * sin, e[2] * sin];
};

const quaternAdd = (w1, x1, y1, z1, w2, x2, y2, z2) => { // rotation addition
	return [
		w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
		x2 * w1 + x1 * w2 + y1 * z2 - z1 * y2,
		y2 * w1 + y1 * w2 + z1 * x2 - x1 * z2,
		z2 * w1 + z1 * w2 + x1 * y2 - y1 * x2
	];
};

const quaternRotate = (x, y, z, q0, q1, q2, q3) => { // q0 = w
	const temp = cross(q1, q2, q3, x, y, z);
	for (let i = 0; i < 3; i++) temp[i] *= 2; 
	const t2 = cross(q1, q2, q3, ...temp);
	const rot = [x, y, z];
	for(let i = 0; i < 3; i++) rot[i] += q0 * temp[i] + t2[i];
	return rot;
 };

const quaternRotateMult = (arr, q0, q1, q2, q3) => { // q0 = w
	const [q02, q12, q22, q32] = [q0 * q0, q1 * q1, q2 * q2, q3 * q3];
	const [q0q1, q0q2, q0q3, q1q2, q1q3, q2q3] = [q0 * q1, q0 * q2, q0 * q3, q1 * q2, q1 * q3, q2 * q3];

	const m00 = q02 + q12 - q22 - q32;
	const m11 = q02 - q12 + q22 - q32;
	const m22 = q02 - q12 - q22 + q32;
	const m01 = 2 * (q1q2 - q0q3);
	const m02 = 2 * (q0q2 + q1q3);
	const m10 = 2 * (q0q3 + q1q2);
	const m12 = 2 * (q2q3 - q0q1);
	const m20 = 2 * (q1q3 - q0q2);
	const m21 = 2 * (q0q1 + q2q3);

	const len = arr.length;
	const ret = new Array(len);
	for (let i = 0; i < len; i+=3) {
		const [x, y, z] = [arr[i], arr[i + 1], arr[i + 2]];
		ret[i + 0] = x * m00 + y * m01 + z * m02;
		ret[i + 1] = x * m10 + y * m11 + z * m12;
		ret[i + 2] = x * m20 + y * m21 + z * m22;
	}
	return ret;
};

const quaternRotateMultInplace = (arr, q0, q1, q2, q3) => { // q0 = w
	const [q02, q12, q22, q32] = [q0 * q0, q1 * q1, q2 * q2, q3 * q3];
	const [q0q1, q0q2, q0q3, q1q2, q1q3, q2q3] = [q0 * q1, q0 * q2, q0 * q3, q1 * q2, q1 * q3, q2 * q3];

	const m00 = q02 + q12 - q22 - q32;
	const m11 = q02 - q12 + q22 - q32;
	const m22 = q02 - q12 - q22 + q32;
	const m01 = 2 * (q1q2 - q0q3);
	const m02 = 2 * (q0q2 + q1q3);
	const m10 = 2 * (q0q3 + q1q2);
	const m12 = 2 * (q2q3 - q0q1);
	const m20 = 2 * (q1q3 - q0q2);
	const m21 = 2 * (q0q1 + q2q3);

	const len = arr.length;
	for (let i = 0; i < len; i+=3) {
		const [x, y, z] = [arr[i], arr[i + 1], arr[i + 2]];
		arr[i + 0] = x * m00 + y * m01 + z * m02;
		arr[i + 1] = x * m10 + y * m11 + z * m12;
		arr[i + 2] = x * m20 + y * m21 + z * m22;
	}
};

const twistGeom = (pos, axis = 1, totang = 1) => {
	let mn = Infinity, mx = -Infinity;
	for(let i = 0; i < pos.length; i+=3) {
		const p = pos[i + axis];
		if(p < mn) mn = p;
		if(p > mx) mx = p;
	}
	const lenr = 1 / (mx - mn);
	for(let i = 0; i < pos.length; i+=3) {
		const [xo, yo] = axis == 0 ? [1, 2] : axis == 1 ? [2, 0] : [0, 1];
		const [px, py, pz] = [pos[i + xo], pos[i + yo], pos[i + axis]];
		const r = Math.sqrt(px * px + py * py);
		const u = 1 - (mx - pz) * lenr;
		const fi = Math.atan2(py, px) + totang * u;
		[pos[i + xo], pos[i + yo]] = [r * Math.cos(fi), r * Math.sin(fi)];
	}
};
 
const profileGeom = (pos, axis = 1, func) => {
	let mn = Infinity, mx = -Infinity;
	for(let i = 0; i < pos.length; i+=3) {
		const p = pos[i + axis];
		if(p < mn) mn = p;
		if(p > mx) mx = p;
	}
	const lenr = 1 / (mx - mn);
	for(let i = 0; i < pos.length; i+=3) {
		const [xo, yo] = axis == 0 ? [1, 2] : axis == 1 ? [2, 0] : [0, 1];
		const pz = pos[i + axis];
		const u = 1 - (mx - pz) * lenr;
		const fact = func(u);
		pos[i + xo] *= fact;
		pos[i + yo] *= fact;
	}
};
 
const noiseGeom = (data, amp, fact) => {
	const dim = amp.length;
	for (let i = 0; i < data.length; i += dim) {
		for (let c = 0; c < dim; c++)
			data[i + c] += fact(data, i) * amp[c] * Math.random();
	}
};

const clamp = (x, min, max) => Math.min(Math.max(x, min), max);

const quaternCsCs = (cs1, cs2, sec = [1, 2]) => {
	const [fib, nib] = [sec[0] * 3, sec[1] * 3];
	const [fie, nie] = [fib + 3, nib + 3];
	// main (forward) vects
	const [f1, f2] = [cs1.slice(fib, fie), cs2.slice(fib, fie)];
	// tangent vects
	const [n1, n2] = [cs1.slice(nib, nie), cs2.slice(nib, nie)];
	const qf = quaternFromVects(f1, f2);
	const n11 = quaternRotate(...n1, ...qf);
	const qt = quaternFromVects(n11, n2);
	return quaternAdd(...qt, ...qf);
};

function LerpOrbit(_pos1, _pos2, ori) {
	const pos1 = [..._pos1];
	const pos2 = [..._pos2];
	if(ori) {
		for(let i = 0; i < 3; i++) { 
			pos1[i] -= ori[i]; 
			pos2[i] -= ori[i]; 
		}
	}
	this.ori = ori || [0, 0, 0];
	const [np1, np2] = [norm2(pos1), norm2(pos2)];
	const [mp1, mp2] = [np1.pop(), np2.pop()];
	this.e = norm(cross(...np1, ...np2));
	this.th = Math.acos(clamp(dot(np1, np2), -1, 1)); 
	this.fact = mp2 / mp1;
	this.pos = pos1;
}
 
LerpOrbit.prototype.set = function (t) {
	const q = quaternFromETh(this.e, this.th * t);
	const newpos = quaternRotate(...this.pos, ...q);
	const fact = 1 + t * (this.fact - 1);
	for (let i = 0; i < 3; i++) newpos[i] = fact * newpos[i] + this.ori[i]; 
	return [q, newpos];
}

function QLerp(q1, q2) {
	const cam_def = [-1,0,0, 0,1,0, 0,0,-1];
	// rotated cam coord sys
	const cs1 = quaternRotateMult(cam_def, ...q1);
	const cs2 = quaternRotateMult(cam_def, ...q2);
	// forward vects
	const [f1, f2] = [cs1.slice(6), cs2.slice(6)];
	// rotate to final pos to match frwd vects and find xy rot
	const [qf, _dot, _cross] = quaternFromVectsFull(f1, f2);
	const cs11x = quaternRotate(cs1[0], cs1[1], cs1[2], ...qf);
	// for partial lerp
	this.qf = { e: norm(_cross), th: Math.acos(clamp(_dot, -1, 1)) };
	// local xy rotation
	const [x1, x2] = [cs11x, cs2.slice(0,3)];
	this.thxy = Math.acos(clamp(dot(x1, x2), -1, 1));

	this.q1 = q1;
	this.cs1 = cs1;
}

QLerp.prototype.set = function(t, wise = 1) {
	const qf = quaternFromETh(this.qf.e, this.qf.th * t);// log(t, this.qf)
	const cs11 = quaternRotateMult(this.cs1, ...qf);
	const qxy = quaternFromETh(cs11.slice(6), wise * this.thxy * t);
	return quaternAdd(...qxy, ...quaternAdd(...qf, ...this.q1));
}

const gridCircle = (width, box) => {

	if (width == 1) return [0, 0, 0, 0];

	const b2 = box / 2;
	const r = box * (width - 1) / 2;
 
	const num = Math.ceil(width / 2) + 1;
	const pos = {x:[], y:[]};
	const d2 = [];
 
	const off = width % 2 ? b2 : 0;
	for(let i = 0; i < num; i++) {
		// grid
		const x = i * box - off;
		pos.x[i] = pos.y[i] = x; 
	}

	const r2 = r * r;
	const ibeg = Math.floor(r / box);
	const jbeg = ibeg;
 
	const checkBox = (i, j, pos, d2, r2) => {
		const checkDist = (i, j) => {
			const [x, y] = [pos.x[i], pos.y[j]];
			d2[i] = d2[i] || [];
			const _d2 = d2[i][j];
			if(_d2) return _d2 < r2;
			const d2_ = d2[i][j] = x * x + y * y;
			return d2_ < r2;
		};
		let incl = 0;
		for(let cy = 0; cy < 2; cy++)
		for(let cx = 0; cx < 2; cx++) {
			const [indx, indy] = [i + cx, j + cy];
			const f = checkDist(indx, indy);
			if(f) incl++;
		}
		return incl;
	};
 
	const pix = [];

	const checkRow = (_i, _j) => {
 
		const setPixel = (i, j) => {
			pix.push(i, j, pos.x[i] + b2, pos.y[j] + b2);
		};
 
		let imin = Infinity;
		let i = _i;
		let cond = true;
		while (cond) {
			const incl = checkBox(i, _j, pos, d2, r2);
			cond = incl > 0;
			if(cond && incl < 4) {
				if(i < imin) imin = i;
				setPixel(i, _j);
			}
			i++;
		}
		i = _i - 1;
		cond = true;
		while (cond && i >= 0) {
			const incl = checkBox(i, _j, pos, d2, r2);
			cond = incl < 4;
			if(incl > 0 && cond) {
				if(i < imin) imin = i;
				setPixel(i, _j);
			}
			i--;
		}
		return imin;
	};
	
	let imin = ibeg;
	for(let j = 0; j <= jbeg; j++) 
		imin = checkRow(imin, j);
	
	return pix;
};

const gridOctant = (width, box) => {
	const b4 = box / 4;
	const pos = [];
	const rad = gridCircle(width, box);
	const odd = rad[rad.length - 2] < b4;
	for(let i = 0; i < rad.length; i+=4) {
		const w = odd ? 2 * rad[i] + 1 : 2 * (rad[i] + 1);
		const z = rad[i + 3];
		const pix = gridCircle(w, box);
		for(let j = 0; j < pix.length; j+=4)
			pos.push(pix[j + 2], pix[j + 3], z);
	}
	return pos;
};

const gridSphere = (width, box) => {
	const b4 = box / 4;
	const oct = gridOctant(width, box);
	const _pos = [];
	for (let i = 0; i < oct.length; i+=3) {
		const [x, y, z] = oct.slice(i, i + 3);
		const pos = [];
		pos.push(x, y, z);
		if (x > b4) pos.push(-x, y, z);
		if (y > b4) {
			const len = pos.length;
			for (let i = 0; i < len; i += 3) {
				const [x, y, z] = pos.slice(i, i + 3);
				pos.push(x, -y, z);
			}
		}
		if (z > b4) {
			const len = pos.length;
			for (let i = 0; i < len; i += 3) {
				const [x, y, z] = pos.slice(i, i + 3);
				pos.push(x, y, -z);
			}
		}
		_pos.push(...pos);
	}
	return _pos;
};

const hexagon = (R, ori) => {
	const r = R * Math.sqrt(3) / 2;
	const R2 = R / 2;
	const pnt = [
	  [ r,  R2], [0,  R], [-r,  R2],
	  [-r, -R2], [0, -R], [ r, -R2],
	];
	if(ori)
	for(const p of pnt) {
	  p[0] += ori[0];
	  p[1] += ori[1];
	}
	return pnt;
 };

export { areaTriangle, profileGeom, twistGeom, noiseGeom, distLinePoint, distLinePoint3D, linesIntersect, pointInPolygon, polygonWinding, polygonOffset, dist, vectLength, vectsEqual, dot, cross, mirror, norm, norm2, cartToSphere, sphereToCart, quaternFromVects, quaternFromVectsFull, quaternFromETh, quaternAdd, quaternRotate, quaternRotateMult, quaternRotateMultInplace, LerpOrbit, QLerp, clamp, quaternCsCs, gridCircle, gridOctant, gridSphere, hexagon }