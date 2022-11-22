import { cross, norm } from '/_v1_jsm/geometry.js'

const vLen2 = v => {
	let len = 0;
	for (let i = 0; i < v.length; i++) len += v[i] * v[i];
	return [Math.sqrt(len), len];
};

// --- MANDELBOX --- //

function MandelBox(m, max, sz, num, thick, _u) {
	const [fpos, fbr] = [[], []];
	const step = 2 * sz / (num - 1);
	const c = [0, 0, 0];
	for (let i = 0; i < num; i++) {
		c[0] = -sz + i * step;
		for (let j = 0; j < num; j++) {
			c[1] = -sz + j * step;
			for (let k = 0; k < thick; k++) {
				c[2] = -sz + k * step;
				const unit = this.checkBox(m, c, max);
				if (unit >= _u[0] && unit <= _u[1]) {
					const br = 1 - unit;
					fpos.push([...c], [c[0], c[1], -c[2]]);
					fbr.push(br, br);
					if (i > thick - 1 && i < num - thick) {
						fpos.push([c[2], c[1], -c[0]], [-c[2], c[1], -c[0]]);
						fbr.push(br, br);
					}
				}
			}
		}
	}
	this.fpos = fpos;
	this.fbr = fbr;
}

MandelBox.prototype.fBox = function (v) {
	const len = v.length;
	for (let i = 0; i < len; i++) {
		const vi = v[i];
		v[i] = vi < -1 ? -2 - vi : vi > 1 ? 2 - vi : vi;
	}
}

MandelBox.prototype.fBall = function (v) {
	const len = v.length;
	const [amp, ampsq] = vLen2(v);
	if (amp < 0.5)
		for (let i = 0; i < len; i++) {
			const vi = v[i];
			v[i] = 4 * vi;
		}
	else if (0.5 <= amp < 1) {
		const ampsqr = 1 / ampsq;
		for (let i = 0; i < len; i++) {
			const vi = v[i];
			v[i] = ampsqr * vi;
		}
	}
}

MandelBox.prototype.next = function (v, m, c) {
	this.fBox(v);
	this.fBall(v);
	const len = v.length;
	for (let i = 0; i < len; i++) {
		const vi = v[i];
		v[i] = m * vi + c[i];
	}
}

MandelBox.prototype.checkBox = function (m, c, _max) {

	const boundCond = (m, v) => {
		const len = v.length;
		let min = v[0];
		let max = min;
		for (let i = 0; i < len; i++) {
			const vi = v[i];
			if (vi > max) max = vi;
			else if (vi < min) min = vi;
		}
		const cond = Math.max(-min, max);
		return m > 0 ? cond > 2 * (m + 1) / (m - 1) : cond > 2;
	};

	const v = [0, 0, 0];
	let i;
	for (i = 0; i < _max; i++) {
		this.next(v, m, c);
		if (boundCond(m, v)) return i / _max; // escaped
	}
	if (i < _max) return i // never?
	else return 1; // prisoner
};

// --- KOCH3D --- //

function Koch3D(side, maxlev) {
	this.side = side;
	this.maxlev = maxlev;
	this.init();
	this.makeVert();
	this.out = [];
	this.recurGeo(this.shape, 0);
}

Koch3D.prototype.init = function () {
	const r = this.side / Math.sqrt(3);
	const pi = Math.PI;
	const fi = [0, 2 * pi / 3, 4 * pi / 3];
	const eq = new Array(3);
	for (let i = 0; i < 3; i++) eq[i] = [r * Math.sin(fi[i]), 0, r * Math.cos(fi[i])];
	const h = this.side / 3;
	const npole = [0, h, 0];
	const spole = [0, -h, 0];
	this.shape = { eqs: eq,	npole, spole };
}

Koch3D.prototype.splitter = function (shape, lev) {
	const splits = 3;
	const [eqs, npole, spole] = [shape.eqs, shape.npole, shape.spole];
	const ret = new Array(splits);
	for (let i = 0; i < splits; i++) {
		const eq = eqs[i];
		const [p0, p1, p2] = [spole, eq, npole];
		const v1 = [p0[0] - p1[0], p0[1] - p1[1], p0[2] - p1[2]];
		const v2 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
		const mid = [
			(p0[0] + p1[0] + p2[0]) / 3,
			(p0[1] + p1[1] + p2[1]) / 3,
			(p0[2] + p1[2] + p2[2]) / 3,
		];
		const axis = norm(cross(...v1, ...v2));
		const H = this.side / 3;
		const h = H * Math.pow(2 / 3, (lev + 1));
		const off = axis.map(u => u * h);
		const np = [mid[0] + off[0], mid[1] + off[1], mid[2] + off[2]];
		const sp = [mid[0] - off[0], mid[1] - off[1], mid[2] - off[2]];

		ret[i] = { eqs: [spole, eq, npole], npole: np, spole: sp, mid, axis };
	}
	return ret;
}

Koch3D.prototype.recurGeo = function (shape, lev) {
	const shapes = this.splitter(shape, lev);
	if (lev == this.maxlev) {
		this.out.push(...shapes);
		return;
	}
	lev++;
	for (const sh of shapes) this.recurGeo(sh, lev);
}

Koch3D.prototype.makeVert = function () {
	const sh = this.shape;
	const [eq, npole, spole] = [sh.eqs, sh.npole, sh.spole];
	const ver = [
		...eq[0], ...eq[1], ...npole,
		...eq[1], ...eq[2], ...npole,
		...eq[2], ...eq[0], ...npole,
		...eq[0], ...eq[2], ...spole,
		...eq[2], ...eq[1], ...spole,
		...eq[1], ...eq[0], ...spole,
	];
	this.ver = ver;
};

export {	MandelBox, Koch3D }