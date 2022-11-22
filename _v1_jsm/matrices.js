const to2D = (A, row, col) => {
	const len = A.length;
	if (len != row * col) {
		console.error('to2D: dimensions mismatch');
		return [];
	}
	const B = [];
	for (let i = 0; i < len; i++) {
		const r = i % row;
		const c = Math.floor(i / col);
		B[r] = B[r] || [];
		B[r][c] = A[i];
	}
	return B;
};

const to1D = A => {
	const B = [];
	const [Ar, Ac] = [A.length, A[0].length];
	let k = 0;
	for (let ac = 0; ac < Ac; ac++) {
		for (let ar = 0; ar < Ar; ar++) {
			B[k] = A[ar][ac];
			k++;
		}
	}
	return B;
};

const makeIdentity = n => {
	const A = [];
	for (let r = 0; r < n; r++) {
		A[r] = [];
		for (let c = 0; c < n; c++) A[r][c] = (r == c) * 1;
	}
	return A;
};

const makeMove = (x, y, z) => [
	[1, 0, 0, x],
	[0, 1, 0, y],
	[0, 0, 1, z],
	[0, 0, 0, 1]
];

const makeScale = (sx, sy, sz) => [
	[sx, 0, 0, 0],
	[0, sy, 0, 0],
	[0, 0, sz, 0],
	[0, 0,  0, 1]
];

const makeRotX = ang => {
	const sin = Math.sin(ang);
	const cos = Math.cos(ang);
	return [
		[1, 0, 0, 0],
		[0, cos, -sin, 0],
		[0, sin, cos, 0],
		[0, 0, 0, 1]
	];
};

const makeRotY = ang => {
	const sin = Math.sin(ang);
	const cos = Math.cos(ang);
	return [
		[cos, 0, sin, 0],
		[0, 1, 0, 0],
		[-sin, 0, cos, 0],
		[0, 0, 0, 1]
	];
};

const makeRotZ = ang => {
	const sin = Math.sin(ang);
	const cos = Math.cos(ang);
	return [
		[cos, -sin, 0, 0],
		[sin, cos, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 1]
	];
};

const transpose = A => {
	const B = [];
	const [Ar, Ac] = [A.length, A[0].length];
	for (let ac = 0; ac < Ac; ac++) {
		B[ac] = [];
		for (let ar = 0; ar < Ar; ar++) B[ac][ar] = A[ar][ac];
	}
	return B;
};

const multVec = (A, V) => {
	const C = [];
	const [Ar, Ac] = [A.length, A[0].length];
	const Vr = V.length;
	if (Ac != Vr) {
		console.error('multVec: dimentions mismatch');
		return C;
	}
	for (let ar = 0; ar < Ar; ar++) {
		C[ar] = 0;
		for (let ac = 0; ac < Ac; ac++) {
			C[ar] += A[ar][ac] * V[ac];
		}
	}
	return C;
};

const multVec16CM = (A, V) => {
   const Alen = A.length;
   const Vr = V.length;
	if (Alen != Vr * Vr) {
		console.error('multVec16CM: dimentions mismatch');
		return [];
   }
   const C = new Array(Vr);
   for (let i = 0; i < Vr; i++) C[i] = 0;
   for (let i = 0; i < Alen; i++) {
      const r = i % Vr; 
      const c = Math.floor(i / Vr);
      C[r] += A[i] * V[c];
   }
   return C;
};

const multCM = (A, B, Ac, Ar, Bc, Br) => {
   const Alen = Ac * Ar;
	if (Ac != Br) {
		console.error(`multCM: dimentions mismatch A: ${Ac}x${Ar}, B: ${Bc}x${Br}`);
		return [];
   }
   
   const Clen = Ar * Bc;
   const C = new Array(Clen);
   for (let i = 0; i < Clen; i++) C[i] = 0;
   for (let off = 0; off < Bc; off++) {
      const offB = Br * off;
      const offC = Ar * off;
      for (let i = 0; i < Alen; i++) {
         const r = i % Ar;
         const c = Math.floor(i / Ar);
         C[offC + r] += A[i] * B[offB + c];
      }
   }
   return C;
};

const mult = (A, B) => {
	const C = [];
	const [Ar, Ac] = [A.length, A[0].length];
	const [Br, Bc] = [B.length, B[0].length];
	if (Ac != Br) {
		console.error('mult: dimentions mismatch');
		return C;
	}
	for (let ar = 0; ar < Ar; ar++) {
		C[ar] = [];
		for (let bc = 0; bc < Bc; bc++) {
			C[ar][bc] = 0;
			for (let ac = 0; ac < Ac; ac++) C[ar][bc] += A[ar][ac] * B[ac][bc]
		}
	}
	return C;
};

const mult2x2 = (A, B) => {
	const [Al, Bl] = [A.length, B.length];
	if (Al != 4 || Bl != 4) {
		console.warn(`mult2x2 size mismatch A(${Al}), B(${Bl})`);
		return [0, 0, 0, 0];
	}
	const [a0, a1, a2, a3] = A;
	const [b0, b1, b2, b3] = B;
	return [
	  a0 * b0 + a1 * b2,
	  a0 * b1 + a1 * b3,
	  a2 * b0 + a3 * b2,
	  a2 * b1 + a3 * b3,
	];
};

const makeOrtho = (l, r, t, b, n, f) => {
   n = Math.abs(n);
	f = Math.abs(f);
	if (f == n || r == l || t == b) {
		console.error('makeOrtho(): division by zero');
		return [];
	}
	const [rl, tb, fn] = [1 / (r - l), 1 / (t - b), 1 / (f - n)];
	return [
		[2 * rl, 0, 0,  -(r + l) * rl],
		[0, 2 * tb, 0,  -(t + b) * tb],
		[0, 0, -2 * fn, -(f + n) * fn],
		[0, 0, 0, 1]
	];
};

const makeOrthoSym = (r, t, n, f) => {
   n = Math.abs(n);
	f = Math.abs(f);
	if (r == 0 || t == 0 || f == n) {
		console.error('makeOrthoSym(): division by zero');
		return [];
	}
	const fn = 1 / (f - n);
	return [
		[1 / r, 0, 0, 0],
		[0, 1 / t, 0, 0],
		[0, 0, -2 * fn, -(f + n) * fn],
		[0, 0, 0, 1]
	];
};

const makePersp = (fov, asp, n, f) => {
   n = Math.abs(n);
   f = Math.abs(f);
   const tan = Math.tan(Math.PI * fov / 360);
   if (n == 0 || f == n || tan == 0) {
		console.error('makePersp(): division by zero');
		return [];
   }
   const tanr = 1 / tan;
	return [
		[tanr / asp, 0, 0, 0],
		[0, tanr, 0, 0],
		[0, 0, -(f + n) / (f - n), -2 * f * n / (f - n)],
		[0, 0, -1, 0]
	];
};

const makeView = (qt, Spr) => {
	const rotate = (x, y, z, q0, q1, q2, q3) => { // quaternion rotation
		const [x2, y2, z2] = [x * 2, y * 2, z * 2];
		const [q02, q12, q22, q32] = [q0 * q0, q1 * q1, q2 * q2, q3 * q3];
		const [q0q1, q0q2, q0q3, q1q2, q1q3, q2q3] = [q0 * q1, q0 * q2, q0 * q3, q1 * q2, q1 * q3, q2 * q3];

		return [
			x * (q02 + q12 - q22 - q32) + y2 * (q1q2 - q0q3) + z2 * (q0q2 + q1q3),
			x2 * (q0q3 + q1q2) + y * (q02 - q12 + q22 - q32) + z2 * (q2q3 - q0q1),
			x2 * (q1q3 - q0q2) + y2 * (q0q1 + q2q3) + z * (q02 - q12 - q22 + q32)
		];
	};
	const [w, x, y, z] = [qt.w, qt.x, qt.y, qt.z];
	const [Xpr, Ypr, Zpr] = [rotate(1, 0, 0, w, x, y, z), rotate(0, 1, 0, w, x, y, z), rotate(0, 0, 1, w, x, y, z)];
	return [
		[Xpr[0], Ypr[0], Zpr[0], Spr.x],
		[Xpr[1], Ypr[1], Zpr[1], Spr.y],
		[Xpr[2], Ypr[2], Zpr[2], Spr.z],
		[0, 0, 0, 1],
	];
};

const invert2x2 = (a, b, c, d) => {
	const tmp = a * d - b * c;
	if (Math.abs(tmp) < 1e-8) {
		console.warn([a, b, c, d], 'determinant is too small', tmp);
		return;
	}
	const D = 1 / tmp;
	return [d, -b, -c, a].map(e => e * D);
};

const invert4x4 = M => {
	const A = [M[0][0], M[0][1], M[1][0], M[1][1]];
	const B = [M[0][2], M[0][3], M[1][2], M[1][3]];
	const C = [M[2][0], M[2][1], M[3][0], M[3][1]];
	const D = [M[2][2], M[2][3], M[3][2], M[3][3]];

	const Ai = invert2x2(...A);
	const AiB = mult2x2(Ai, B);
	const CAiB = mult2x2(C, AiB);
	const D_CAiB = D.map((e, i) => e - CAiB[i]);
	const D_CAiB_i = invert2x2(...D_CAiB);
	const CAi = mult2x2(C, Ai);
	const D_CAiB_iCAi = mult2x2(D_CAiB_i, CAi);
	const AiBD_CAiB_i = mult2x2(AiB, D_CAiB_i);
	const t00 = mult2x2(AiB, D_CAiB_iCAi);
	const Ia = Ai.map((e, i) => e + t00[i]);
	const Ib = AiBD_CAiB_i.map(e => -e);
	const Ic = D_CAiB_iCAi.map(e => -e);
	const Id = D_CAiB_i;

	return [
		[Ia[0], Ia[1], Ib[0], Ib[1]],
		[Ia[2], Ia[3], Ib[2], Ib[3]],
		[Ic[0], Ic[1], Id[0], Id[1]],
		[Ic[2], Ic[3], Id[2], Id[3]],
	];
};

const toPosSkewScale = m => {
	// from object3D matrix.elements column-major [ m0,m3,0,0, m1,m4,0,0, 0,0,1,0, m2,m5,z,1 ]
	// to scale, skew, rotation, row-major:
	// sX * Math.cos(skY), -sY * Math.sin(skX),  Tx,  |   m[0], m[4], m[12]
	// sX * Math.sin(skY),  sY * Math.cos(skX),  Ty,  |   m[1], m[5], m[13]
	const dec = {
		position: {x: m[12], y: m[13], z: m[14]},
	};
	const sx = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
	const sy = Math.sqrt(m[4] * m[4] + m[5] * m[5]);
	dec.scale = { x: sx, y: sy };
	dec.skew = { x: Math.atan2(-m[4], m[5]), y: Math.atan2(m[1], m[0]) };
	return dec;
};

const fromPosSkewScale = obj => {
	const sc = obj.scale;
	const sk = obj.skew;
	const pos = obj.position;
	const [sinx, cosx] = [Math.sin(sk.x), Math.cos(sk.x)];
	const [m1, m4] = [-sc.y * sinx, sc.y * cosx];
	const [siny, cosy] = sk.x == sk.y ? [sinx, cosx] : [Math.sin(sk.y), Math.cos(sk.y)];
	const [m0, m3] = [sc.x * cosy, sc.x * siny];
	return [m0, m3, 0, 0, m1, m4, 0, 0, 0, 0, 1, 0, pos.x, pos.y, pos.z, 1];
};

export { to2D, to1D, makeIdentity, makeMove, makeScale, makeRotX, makeRotY, makeRotZ, transpose, multVec, multVec16CM, multCM, mult, makeOrtho, makeOrthoSym, makePersp, makeView, invert2x2, invert4x4, toPosSkewScale, fromPosSkewScale }
