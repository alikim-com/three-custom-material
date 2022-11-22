<script type="x-shader/x-vertex" id="vs_pos">
	varying vec2 vuv;
	void main() {
		gl_Position = vec4(position, 1.0);
		vuv = uv;
	}
</script>
<script type="x-shader/x-vertex" id="vs_mvpos">
	varying vec2 vuv;
	void main() {
		gl_Position = modelViewMatrix * vec4(position, 1.0);
		vuv = uv;
	}
</script>
<script type="x-shader/x-vertex" id="vs">
	varying vec2 vuv;
	void main() {
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		vuv = uv;
	}
</script>
<script type="x-shader/x-fragment" id="fs_rgb">
	uniform vec3 color;
	void main() {
		gl_FragColor = vec4(color, 1.0);
	}
</script>
<script type="x-shader/x-fragment" id="fs_u">
	varying vec2 vuv;
	void main() {
		gl_FragColor = vec4(vuv.x, 0.0, 0.0, 1.0);
	}
</script>
<script type="x-shader/x-fragment" id="fs_v">
	varying vec2 vuv;
	void main() {
		gl_FragColor = vec4(0.0, 0.0, vuv.y, 1.0);
	}
</script>
<script type="x-shader/x-fragment" id="fs_uv">
	varying vec2 vuv;
	void main() {
		gl_FragColor = vec4(vuv.x, 0.0, vuv.y, 1.0);
	}
</script>
<script type="x-shader/x-fragment" id="fs_bi">
	varying float bi;
	void main() {
		gl_FragColor = vec4(bi, 0.0, -bi, 1.0);
	}
</script>
<script type="x-shader/x-fragment" id="fs_tex">
	varying vec2 vuv;
	uniform sampler2D map;
	uniform float fact;
	void main() {
		vec4 pix = fact * texture2D(map, vuv);
		gl_FragColor = pix;
	}
</script>
<script type="x-shader/x-fragment" id="fs_float_to_quad">
	// util shader to show float textures
	#include 'vec4_to_float'
	varying vec2 vuv;
	uniform sampler2D map;
	uniform float fact;
	void main() {
		float pix = fact * vec4_to_float(texture2D(map, vuv));
		gl_FragColor = vec4(pix, 0.0, -pix, 1.0);
	}
</script>
<script type="x-shader/x-vertex" id="vs_depth">
	varying float mvz;
	void main() {
		vec4 mvpos = modelViewMatrix * vec4(position, 1.0);
		gl_Position = projectionMatrix * mvpos;
		mvz = mvpos.z;
	}
</script>
<script type="x-shader/x-fragment" id="fs_depth">
	// custom 32 bit position.z-buffer
	#include 'float_to_vec4'
	varying float mvz;
	void main() {
		gl_FragColor = float_to_vec4(mvz);
	}
</script>
<script type="x-shader/x-fragment" id="fs_precision">
    // req for glsl 1.0 frag shader
    #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
    #else
        precision mediump float;
    #endif
</script>

<!-- functions -->

<script type="x-shader/x-function" id="rotateVec2">
    vec2 rotateVec2(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        mat2 m = mat2(c, s, -s, c);
        return m * v;
    }
</script>
<script type="x-shader/x-function" id="box_muller">
  vec2 box_muller(vec2 xy, float sigma) {
    float r = sigma * sqrt(-2.0 * log(xy.x));
    float fi = 2.0 * 3.1415926 * xy.y;
    return vec2(r * cos(fi), r * sin(fi));
  }
</script>
<script type="x-shader/x-function" id="hsvRgb">
    vec3 hsvRgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
</script>
<script type="x-shader/x-function" id="hslRgb">
   vec3 hslRgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
   }
</script>
<script type="x-shader/x-function" id="rgbHsl">
   vec3 rgbHsl(vec3 c) {
      float mx = max(max(c.x, c.y), c.z);
      float mn = min(min(c.x, c.y), c.z);
      float l = 0.5 * (mx + mn);
      float h = 0.0;
      float chr = mx - mn;
      if(chr != 0.0) {
         float k = 1.0 / 6.0;
         float cr = 1.0 / chr;
         if(c.r == mx) h = cr * (c.g - c.b);
         else if(c.g == mx) h = cr * (c.b - c.r) + 2.0;
         else h = cr * (c.r - c.g) + 4.0;
         h = fract(k * h);
      }
      float s = (l == 0.0 || l == 1.0) ? 0.0 : (mx - l) / min(l, 1.0 - l);
      return vec3(h, s, l);
   }
</script>
<script type="x-shader/x-function" id="SRGBLinear">
   vec3 SRGBLinear(vec3 sRgb) {
      bvec3 lin = greaterThan(sRgb, vec3(0.04045));
      vec3 lRgb;
      float k1 = 1.0 / 1.055;
      float k2 = 1.0 / 12.92;
      for(int i = 0; i < 3; i++)
         lRgb[i] = lin[i] ? pow(k1 * (sRgb[i] + 0.055), 2.4) : k2 * sRgb[i];
      return lRgb;
   }
</script>
<script type="x-shader/x-function" id="linearSRGB">
   vec3 linearSRGB(vec3 lRgb) {
      bvec3 lin = greaterThan(lRgb, vec3(0.04045));
      vec3 sRgb;
      float k1 = 1.055;
      float k2 = 12.92;
      for(int i = 0; i < 3; i++)
         sRgb[i] = lin[i] ? k1 * pow(lRgb[i], 1.0 / 2.4) - 0.055 : k2 * lRgb[i];
      return sRgb;
   }
</script>
<script type="x-shader/x-function" id="linearRGB601">
   vec3 linearRGB601(vec3 rgb) { // Rec.601
      bvec3 lin = greaterThanEqual(rgb, vec3(0.018));
      vec3 lRgb;
      for(int i = 0; i < 3; i++)
         lRgb[i] = lin[i] ? 1.099 * pow(rgb[i], 0.45) - 0.099 : 4.5 * rgb[i];
      return lRgb;
   }
</script>
<script type="x-shader/x-function" id="greyR601">
   float greyR601(vec3 sRGB) {
      vec3 lRGB = pow(sRGB, vec3(2.2));
      vec3 rgb601 = linearRGB601(lRGB);
      vec3 luma = vec3(0.299, 0.587, 0.114);
     return dot(luma, rgb601);
   }
</script>
<script type="x-shader/x-function" id="greyR601S">
   float greyR601S(vec3 sRGB) {
      vec3 lRGB = SRGBLinear(sRGB);
      vec3 rgb601 = linearRGB601(lRGB);
      vec3 luma = vec3(0.299, 0.587, 0.114);
     return dot(luma, rgb601);
   }
</script>
<script type="x-shader/x-function" id="grey">
   float grey(vec3 sRGB) {
      vec3 lRGB = pow(sRGB, vec3(2.2));
      vec3 lumi = vec3(0.2126, 0.7152, 0.0722);
      float y = dot(lumi, lRGB);
      return pow(y, 1.0 / 2.2);
   }
</script>
<script type="x-shader/x-function" id="greyPS">
   float greyPS(vec3 sRGB) {
      // photoshop desaturate
      float bw = (min(sRGB.r, min(sRGB.g, sRGB.b)) + max(sRGB.r, max(sRGB.g, sRGB.b))) * 0.5;
      return bw;
   }
</script>
<script type="x-shader/x-function" id="stepGradient">
    float stepGradient(float hues[32], float steps[32], int size, float pos) {
    float hue = hues[0];
    for(int i = 1; i < 32; i++) {
        if(i == size) break;
        hue = mix(hue, hues[i], smoothstep(steps[i - 1], steps[i] + 0.001, pos));
    }
    return hue;
    }
</script>
<script type="x-shader/x-function" id="stepGradient4">
    vec4 stepGradient4(vec4 colors[32], float steps[32], int size, float pos) {
    vec4 color = colors[0];
    for(int i = 1; i < 32; i++) {
        if(i == size) break;
        color = mix(color, colors[i], smoothstep(steps[i - 1], steps[i] + 0.001, pos));
    }
    return color;
    }
</script>
<script type="x-shader/x-function" id="interpolation">
    // v(lt, rt, lb, rb)
    // all these functions return unclamped signed values

    float average(vec4 v) {
        return 0.25 * (v.x + v.y + v.z + v.w);
    }
    float bilinear(vec4 v, vec2 off) {
        float top = mix(v.x, v.y, off.x);
        float bot = mix(v.z, v.w, off.x);
        return mix(bot, top, off.y);
    }
    float smoothBilinear(vec4 v, vec2 off) {
        vec2 xy = smoothstep(0.0, 1.0, off);
        float top = mix(v.x, v.y, xy.x);
        float bot = mix(v.z, v.w, xy.x);
        return mix(bot, top, xy.y);
    }
    float interpolate(vec4 v, vec2 off) {
        if(interp == 0) return smoothBilinear(v, off);
        else if(interp == 1) return bilinear(v, off);
        else if(interp == 2) return average(v);
    }
</script>
<script type="x-shader/x-function" id="shapeTexture">
    float shapeTexture(int type, float att, vec2 vuv) {
    float len = length(vec2(0.5) - vuv);
    if(type == 1) { // circle
        return smoothstep(0.0, 1.0, 0.5 - len);
    }
    else if(type == 2) { // 4-ray star; y = k(1 - a)/x, a = [1..0] @k=4
        float x = vuv.x - 0.5;
        float y = vuv.y - 0.5;
        float a = clamp(1.0 - att * abs(x * y), 0.0, 1.0);
        return a * mix(0.0, 1.0, 1.0 - 2.0 * len);
    }
    return 1.0;
    }
</script>
<script type="x-shader/x-function" id="floatToVec4">
    // include for writing a float on a pixel
    #ifdef GL_FRAGMENT_PRECISION_HIGH
        float digits = <var HIGH>;
    #else
        float digits = <var MED>;
    #endif

    vec4 floatToVec4(float f) { // [8 bits exp] [sign + 23 fract bits]
        float sign = 0.0;
        if(f < 0.0) { sign = 128.0; f = -f; }
        const float ln10 = log(10.0);
        float exp = f > 0.0 ? ceil(log(f) / ln10) : 0.0;
        exp = digits - exp;
        float f24 = f * pow(10.0, exp);
        f24 /= 256.0 * 256.0;
        float byte2 = floor(f24);
        float b10 = (f24 - byte2) * 256.0;
        float byte1 = floor(b10);
        float byte0 = (b10 - byte1) * 256.0;
        return vec4(exp, byte2 + sign, byte1, byte0) / 255.0;
    }
</script>
<script type="x-shader/x-function" id="vec4ToFloat">
    // include for reading a float from a pixel
    float vec4ToFloat(vec4 rgba) { // [8 bits exp] [sign + 23 fract bits]
        rgba *= 255.0;
        float exp = rgba.x;
        float byte2 = rgba.y;
        float byte1 = rgba.z;
        float byte0 = rgba.w;
        float sign = 1.0;
        if(byte2 >= 128.0) {
            byte2 -= 128.0;
            sign = -1.0;
        }
        float f = sign * (byte2 * 65536.0 + byte1 * 256.0 + byte0) * pow(10.0, -exp);
        return f;
    }
</script>
<script type="x-shader/x-function" id="texBounce">
   float texBounce(float v, vec4 r) { // a, b, ab, abr
      float err = 0.0001;
      float a = r.x;
      float b = r.y;
      float ab = r.z;
      float va = abs(v - a);
      float vb = abs(v - b);
      if(abs(ab - va - vb) < err) return v;
      vec3 aoe = va < vb ? vec3(a, b, va) : vec3(b, a, vb);
      float ato = aoe.x < aoe.y ? 1.0 : -1.0;
      float folds = aoe.z * r[3];
      float ff = floor(folds);
      float tail = aoe.z - ff * ab;
      return mod(ff, 2.0) == 0.0 ? aoe.x + ato * tail : aoe.y - ato * tail;
    }
</script>

<!-- non upgradable to WebGL2-float-texture versions -->

<script type="x-shader/x-fragment" id="float_to_vec4">
    // include for writing a float on a pixel
    #ifdef GL_FRAGMENT_PRECISION_HIGH
        float digits = <var HIGH>;
    #else
        float digits = <var MED>;
    #endif

    vec4 float_to_vec4(float f) { // [8 bits exp] [sign + 23 fract bits]
        float sign = 0.0;
        if(f < 0.0) { sign = 128.0; f = -f; }
        const float ln10 = log(10.0);
        float exp = f > 0.0 ? ceil(log(f) / ln10) : 0.0;
        exp = digits - exp;
        float f24 = f * pow(10.0, exp);
        f24 /= 256.0 * 256.0;
        float byte2 = floor(f24);
        float b10 = (f24 - byte2) * 256.0;
        float byte1 = floor(b10);
        float byte0 = (b10 - byte1) * 256.0;
        return vec4(exp, byte2 + sign, byte1, byte0) / 255.0;
    }
</script>
<script type="x-shader/x-function" id="vec4_to_float">
    // include for reading a float from a pixel
    float vec4_to_float(vec4 rgba) { // [8 bits exp] [sign + 23 fract bits]
        rgba *= 255.0;
        float exp = rgba.x;
        float byte2 = rgba.y;
        float byte1 = rgba.z;
        float byte0 = rgba.w;
        float sign = 1.0;
        if(byte2 >= 128.0) {
            byte2 -= 128.0;
            sign = -1.0;
        }
        float f = sign * (byte2 * 65536.0 + byte1 * 256.0 + byte0) * pow(10.0, -exp);
        return f;
    }
</script>
<script type="x-shader/x-function" id="getFloatsFromPointGrid">
    void getFloatsFromPointGrid(sampler2D tex, float vid, vec2 grid, vec2[4] pCoord, int len, out vec4 flts) {
        float row = floor((vid + 0.5) / grid.x);
        float col = vid - row * grid.x;
        vec2 colrow = vec2(col, row);
        vec2 rec_grid = 1.0 / grid;

        vec2 txl_coord = (colrow + pCoord[0]) * rec_grid;
        // reverse y-axis if GL_POINT_SPRITE_COORD_ORIGIN == GL_UPPER_LEFT
        txl_coord.y = 1.0 - txl_coord.y;
        flts[0] = vec4ToFloat(texture2D(tex, txl_coord));

        if(len > 1) {
            txl_coord = (colrow + pCoord[1]) * rec_grid;
            txl_coord.y = 1.0 - txl_coord.y;
            flts[1] = vec4ToFloat(texture2D(tex, txl_coord));
        }

        if(len > 2) {
            txl_coord = (colrow + pCoord[2]) * rec_grid;
            txl_coord.y = 1.0 - txl_coord.y;
            flts[2] = vec4ToFloat(texture2D(tex, txl_coord));
        }

        if(len > 3) {
            txl_coord = (colrow + pCoord[3]) * rec_grid;
            txl_coord.y = 1.0 - txl_coord.y;
            flts[3] = vec4ToFloat(texture2D(tex, txl_coord));
        }
    }
</script>


