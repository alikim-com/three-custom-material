const glFract = val => val - Math.floor(val);
const glMix = (x, y, a) => {
   const [xlen, ylen] = [x.length, y.length];
   if (xlen != ylen) {
      console.error(`glMix: x.length(${xlen}) != y.length(${ylen})`);
      return [0];
   }
   if(!xlen) return [x + (y - x) * a];
   const mix = new Array(xlen);
   for (let i = 0; i < xlen; i++) mix[i] = x[i] + (y[i] - x[i]) * a;
   return mix;
};
const glClamp = (x, min, max) => Math.min(Math.max(x, min), max);
const glMod = (x, y) => x - y * Math.floor(x / y);

const hsvRgb = c => {
    const K = [1, 2 / 3, 1 / 3, 3];
    const p = [];
    const rgb = [];
    for (let i = 0; i < 3; i++) {
        p[i] = Math.abs(glFract(c[0] + K[i]) * 6 - K[3]);
        rgb[i] = c[2] * glMix(K[0], glClamp(p[i] - K[0], 0, 1), c[1]);
    }
    return rgb;
};

const hslRgb = c => {
    const K = [0, 4, 2];
    const rgb = [];
    for (let i = 0; i < 3; i++) {
        const tmp = glClamp(Math.abs(glMod(c[0] * 6 + K[i], 6) - 3) - 1, 0, 1);
        rgb[i] = c[2] + c[1] * (tmp - 0.5) * (1.0 - Math.abs(2 * c[2] - 1));
    }
    return rgb;
};

const rgbHsl = c => {
    const max = Math.max(...c);
    const min = Math.min(...c);
    const chr = max - min;
    const l = 0.5 * (max + min);
    const h = (function () {
        if (chr == 0) return 0;
        const rgbrg = [...c, c[0], c[1]];
        const k = 1 / 6;
        const cr = 1 / chr;
        for (let i = 0; i < 3; i++)
            if (rgbrg[i] == max) return glFract(k * (2 * i + (rgbrg[i + 1] - rgbrg[i + 2]) * cr));
    }());
    const s = (function () {
        if (l == 0 || l == 1) return 0;
        return (max - l) / Math.min(l, 1 - l);
    }());
    return [h, s, l];
};

const floatToVec4 = (f, digits = 6.0) => { // [8 bits exp] [sign + 23 fract bits]
    let sign = 0.0;
    if (f < 0.0) { sign = 128.0; f = -f; }
    const ln10 = Math.log(10.0);
    let exp = f > 0.0 ? Math.ceil(Math.log(f) / ln10) : 0.0;
    exp = digits - exp;
    let f24 = f * Math.pow(10.0, exp);
    f24 /= 256.0 * 256.0;
    const byte2 = Math.floor(f24);
    const b10 = (f24 - byte2) * 256.0;
    const byte1 = Math.floor(b10);
    const byte0 = (b10 - byte1) * 256.0;

    return [exp, byte2 + sign, byte1, byte0].map(e => e / 255.0);
};

const vec4ToFloat = rgba => {
    for (let i = 0; i < 4; i++) rgba[i] *= 255.0;
    const exp = rgba[0];
    const byte2 = rgba[1];
    const byte1 = rgba[2];
    const byte0 = rgba[3];
    const sign = 1.0;
    if (byte2 >= 128.0) {
        byte2 -= 128.0;
        sign = -1.0;
    } console.log(exp, byte2, byte1, byte0);
    const f = sign * (byte2 * 65536.0 + byte1 * 256.0 + byte0) * Math.pow(10.0, -exp);
    return f;
};

const rotate = (x, y, a) => {
    const s = Math.sin(a);
    const c = Math.cos(a);
    return [x * c - y * s, x * s + y * c];
};

export { glFract, glMix, glClamp, glMod, hsvRgb, hslRgb, rgbHsl, floatToVec4, vec4ToFloat, rotate };