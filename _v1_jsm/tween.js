import { log } from '/_v1_jsm/utils.js'

function Tween(verbose = false) {
	this.verbose = verbose;
   this.tweens = [];
   this.frozen = 0;
   this.delay = 0;
}

Tween.prototype.pause = function (mode) {
   if (mode) {
      this.frozen = performance.now();
   } else {
      this.delay += performance.now() - this.frozen;
      this.frozen = 0;
   }
}

Tween.prototype.add = function (obj) {
   // ext = object to store current value in beg/end format
   // beg & end = { m:[], color, tint, opac, ... }
   // start [-num, 0, num] = [delay after have called, now, delay from now]
   // next tween [null, num] = [none, tw.uid]

   obj.ease = obj.ease || 0;
   obj.start = obj.start || 0;

   const [ext, beg, end, duration, ease, start, next, uid, cb] =
      ['ext', 'beg', 'end', 'duration', 'ease', 'start', 'next', 'uid', 'cb'].map(nm => obj[nm]);

	const [kval, karr] = [[], []];
	for (const k in beg) {
		if (beg[k].length) {
			karr.push(k);
			ext[k] = [];
		} else
			kval.push(k);
	}
	this.tweens.push({ uid,	kval,	karr,	ext, beg, end,	idur: 1 / duration, ease, start, next, cb});
}

// TODO PAUSE/PLAY

Tween.prototype.tick = function (now = performance.now() - this.delay) {
   if (this.frozen) return;
   for (let i = 0; i < this.tweens.length; i++) {
      if (this.verbose) log(`tweens[${i}]`);
		const tw = this.tweens[i];
		if (tw.start < 0) continue;
		if (!tw.t0) tw.t0 = now;
		const dif = now - tw.t0 - tw.start;
		if (dif >= 0) {
			// quadratic filter
			const s = dif ? Math.min(1, dif * tw.idur) : 0;
			const f = dif ? Math.min(1, -tw.ease * s * s + (1 + tw.ease) * s) : 0;
			//
			for (let j = 0; j < tw.kval.length; j++) {
				const k = tw.kval[j];
				const [bk, ek, x] = [tw.beg[k], tw.end[k], tw.ext];
				x[k] = f == 0 ? bk : f == 1 ? ek : bk + (ek - bk) * f;
			}
			for (let j = 0; j < tw.karr.length; j++) {
				const k = tw.karr[j]; // 'm'
				const [bk, ek, xk] = [tw.beg[k], tw.end[k], tw.ext[k]];
				for (let e = 0; e < bk.length; e++)
					xk[e] = f == 0 ? bk[e] : f == 1 ? ek[e] : bk[e] + (ek[e] - bk[e]) * f;
			}
			if (f == 1) {
				this.tweenEnd(i, tw);
				i--;
         }
         if (this.verbose) log(`tweens[${i}], dif: ${dif}, s: ${s}, f: ${f}`);
      }
      if (this.verbose) log('ext:', tw.ext);
   }
}

Tween.prototype.tweenEnd = function (i, tw) {
	if (tw.next != null)
		for (let j = 0; j < this.tweens.length; j++) {
			const twi = this.tweens[i];
			if (twi.uid == tw.next) {
				twi.start *= -1;
				if (this.verbose) console.log(`tween[${j}] started`);
				break;
			}
		}
	if (tw.cb) tw.cb(tw.uid);
	this.tweens.splice(i, 1);
	if (this.verbose) console.log(`tween[${i}] ended`);
}

Tween.prototype.clear = function () {
   this.tweens = [];
   this.frozen = 0;
   this.delay = 0;
}

export { Tween }