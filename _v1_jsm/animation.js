import { LerpOrbit, QLerp } from '/_v1_jsm/geometry.js'

//import { Tween } from '/_v1_jsm/tween.js'
//const tween = new Tween();

const posGet = obj => {
	const pos = obj.position;
	return [pos.x, pos.y, pos.z];
};

const qGet = obj => {
	const q = obj.quaternion;
	return [q.w, q.x, q.y, q.z];
};

/*
dat: {
  (pb)
	pe: [0.1605, 0.51266, 0.73911],
	qe: [0.9515, -0.29033, 0.09984, -0.019087],
	tar: [-0.02422, 0.008603, -0.0063698],
	ext: {},
	ql: new THREE.Quaternion(),
},
*/

const camOrbitInit = (camera, dat, duration, ease, cb, _beg, _end) => {
	if (!dat.pb) {
		Object.defineProperty(dat, 'pb', {
			configurable: true,
			enumerable: true,
			get: () => posGet(camera),
		});
	}
	dat.olerp = new LerpOrbit(dat.pb, dat.pe, dat.tar);
	dat.qlerp = new QLerp(qGet(camera), dat.qe);
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
	return obj;
};

const camOrbitLerp = (camera, dat, t) => {
	const [_, pos] = dat.olerp.set(t);
	camera.position.set(...pos);
	const q = dat.qlerp.set(t, dat.wise || 1);
	dat.ql.set(q[1], q[2], q[3], q[0]);
	camera.setRotationFromQuaternion(dat.ql);
};

function Flicker(obj) { 
	['amp', 'xstepmin', 'xstepamp'].forEach(nm => { this[nm] = obj[nm] });
	['xb', 'xe', 'yb', 'k'].forEach(nm => { this[nm] = 0 });
	this.init(0, 0);
}

Flicker.prototype.init = function (x, _ye) {
	const getxe = () => this.xstepmin + this.xstepamp * Math.random();
	const getye = _ye => {
		if (_ye == 0)
			return this.amp * (2 * Math.random() - 1);
		const s = Math.sign(_ye);
		const rnd = Math.random();
		const ye = rnd < 0.5 ?
			_ye + s * (this.amp - Math.abs(_ye)) * 2 * rnd :
			_ye - s * (this.amp + Math.abs(_ye)) * 2 * (rnd - 0.5);
		return ye;
	};
	this.xb = x;
	this.xe = x + getxe();
	this.yb = _ye;
	const ye = getye(_ye); 
	this.k = (ye - this.yb) / (this.xe - this.xb);
}

Flicker.prototype.tick = function (x) {
  const y = this.yb + this.k * (x - this.xb);
  if(x >= this.xe) this.init(x, y);
  return y;
};

function AnimObj() {
	this.phase = '';
	this.anim = {};
	this.G = {}; // global
}

AnimObj.prototype.setPhase = function(nm) {
  this.phase = nm;
  this.anim[nm] = this.anim[nm + '_init'];
};

AnimObj.prototype.setStep = function(nm) {
  const [ph, anim] = [this.phase, this.anim];
  anim[ph] = anim[ph + '_' + nm];
};

export { camOrbitInit, camOrbitLerp, Flicker, AnimObj }