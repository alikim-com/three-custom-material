
// George Marsaglia RNG

function GM_RNG() {

   this.z = new Uint32Array([362436069]);
   this.w = new Uint32Array([521288629]);
       
}

const p = GM_RNG.prototype;

p.znew = function () { return new Uint32Array([((this.z[0] = 36969 * (this.z[0] & 65535) + (this.z[0] >> 16)) << 16)]) };

p.wnew = function () { return new Uint32Array([((this.w[0] = 18000 * (this.w[0] & 65535) + (this.w[0] >> 16)) & 65535)]) };

p.u32 = function () { return this.znew()[0] + this.wnew()[0] }; // random 32-bit integer

p.f01 = function () { return (this.znew()[0] + this.wnew()[0]) * 2.328306e-10 }; // random real in [0,1)

p.get = function () { return { z: this.z[0], w: this.w[0] } };

p.set = function (obj) { this.z = new Uint32Array([obj.z]); this.w = new Uint32Array([obj.w]) };

export default GM_RNG;