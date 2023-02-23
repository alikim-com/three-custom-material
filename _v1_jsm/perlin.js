import * as THREE from '/_v1_jsm/three.module.js'

const shaders = {
	built_in: {
		vs: `
uniform float size;
attribute mat3 grad;

varying mat3 vgrad;

void main() {
	gl_PointSize = size;
	gl_Position = vec4(position, 1.0);
	vgrad = grad;
}
`,

		fs: `
varying mat3 vgrad;

float bilinear(vec4 v, vec2 off) {
	vec2 soff = smoothstep(vec2(0.0), vec2(1.0), off);
	float top = mix(v.x, v.y, soff.x);
	float bot = mix(v.z, v.w, soff.x);
	return mix(bot, top, soff.y);
}

void main() {
	vec2 pc = gl_PointCoord;
	vec4 dots = vec4(
		dot(pc + vec2( 0.0, -1.0), vec2(vgrad[0][0], vgrad[0][1])),
		dot(pc + vec2(-1.0, -1.0), vec2(vgrad[0][2], vgrad[1][0])),
		dot(pc,                    vec2(vgrad[1][1], vgrad[1][2])),
		dot(pc + vec2(-1.0,  0.0), vec2(vgrad[2][0], vgrad[2][1]))
	);

	float avr = bilinear(dots, gl_PointCoord);
   
   #ifdef GREY
   float br = 0.5 * (avr + 1.0);
	gl_FragColor = vec4(br, br, br, 1.0);
   #else 
   gl_FragColor = vec4(avr, 0.0, -avr, 1.0);
   #endif
}
`
	}
};

const makeGrid = grid => {
	const [nx, ny] = grid;
	const [rnx, rny] = [1 / nx, 1 / ny];
	const [xd, yd] = [2 * rnx, 2 * rny];
	const [xpos, ypos] = [new Array(nx), new Array(ny)];
	for (let i = 0; i < nx; i++) xpos[i] = -1 + xd * i + rnx;
	for (let j = 0; j < ny; j++) ypos[j] = -1 + yd * j + rny;
	const pos = new Array(nx * ny);
	let cnt = 0;
	for (let j = 0; j < ny; j++) {
		const y = ypos[j];
		for (let i = 0; i < nx; i++) {
			pos[cnt++] = xpos[i];
			pos[cnt++] = y;
			pos[cnt++] = 0;
		}
	}
	return pos;
};

function PerlinPoints(psize, grid, wrap, rend, mode) {

	const makeGrad = () => {
		const [nx, ny] = [grid[0] + 1, grid[1] + 1];
		const len = nx * ny;
		const grad = new Array(len);
		const pi2 = 2 * Math.PI;
		let cnt = 0;
		for (let j = 0; j < ny; j++) {
			if (j == ny - 1 && wrap[1]) {
				for (let i = 0; i < nx; i++) grad[cnt++] = grad[i];
				continue;
			}
			for (let i = 0; i < nx; i++) {
				if (i != nx - 1 || !wrap[0]) {
					const ang = pi2 * Math.random();
					grad[cnt++] = [Math.cos(ang), Math.sin(ang)];
				} else {
					grad[cnt] = grad[cnt - grid[0]];
					cnt++;
				}
			}
		}
		return grad;
	};

	const geo = new THREE.BufferGeometry();

	const pos = makeGrid(grid);
	geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));

	const grad = makeGrad();
	const quads = new Array(9 * pos.length / 3);

	const addGrad = (ind, cnt) => {
		const [x, y] = grad[ind];
		quads[cnt++] = x;
		quads[cnt++] = y;
		return cnt;
	};
	let cnt = 0;
	const [nx, ny] = grid;
	const nx1 = nx + 1;
	for (let r = 0; r < ny; r++)
		for (let c = 0; c < nx; c++) {
			const lb = c + r * nx1; // left bottom index
			cnt = addGrad(lb, cnt);
			const rb = lb + 1;
			cnt = addGrad(rb, cnt);
			const lt = c + (r + 1) * nx1; // left top index
			cnt = addGrad(lt, cnt);
			const rt = lt + 1;
			cnt = addGrad(rt, cnt);
			quads[cnt++] = 0;
		}
   geo.setAttribute('grad', new THREE.BufferAttribute(new Float32Array(quads), 9));
   
   const mat = new THREE.ShaderMaterial({
      vertexShader: shaders.built_in.vs,
      fragmentShader: shaders.built_in.fs,
      uniforms: {
         size: {
            value: psize
         },
      },
   });
   if (mode == 'GREY') mat.defines = { GREY: '' };

   const mesh = new THREE.Points(geo, mat);
   
	mesh.frustumCulled = false;
	if (!rend)
		return [mesh, null];

	const [w, h] = [grid[0] * psize, grid[1] * psize].map(e => Math.round(e));
   const [w2, h2] = [w / 2, h / 2];
   const opt = { depthBuffer: false };
   if (wrap[0]) opt.wrapS = THREE.RepeatWrapping;
   if (wrap[1]) opt.wrapT = THREE.RepeatWrapping; 
   const rt = new THREE.WebGLRenderTarget(w, h, opt);
	const [near, far] = [0, 1];
	const cam = new THREE.OrthographicCamera(-w2, w2, h2, -h2, near, far);
	const scn = new THREE.Scene();
	scn.add(mesh);
	rend.setRenderTarget(rt);
	rend.render(scn, cam);
	rend.setRenderTarget(null);
	return [mesh, rt.texture];
};

export { PerlinPoints }