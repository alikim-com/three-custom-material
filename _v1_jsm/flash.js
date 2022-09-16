import * as THREE from '/_v1_jsm/three.module.js'

import { distLinePoint, polygonWinding, pointInPolygon } from '/_v1_jsm/geometry.js';

function ABP(quality) { // Adaptive Bezier points
	this.maxdist = quality || 0.33;
	this.maxpoints = 1000;
	this.data = [];
}

ABP.prototype.moveTo = function (x, y) {
	this.data.push([x, y]);
	return this;
}

ABP.prototype.lineTo = function (x, y) {
	this.data.push([x, y]);
	return this;
}

ABP.prototype.quadraticCurveTo = function (ax, ay, x, y) {
	const obj = this.data;
	const p0 = obj[obj.length - 1];

	// ~ line
	if (distLinePoint(p0, [x, y], ax, ay) <= this.maxdist) {
		obj.push([x, y]);
		return this;
	}

	const p01 = [p0[0] - ax, p0[1] - ay];
	const p21 = [x - ax, y - ay];

	const f = t => { // param quadratic bezier
		const m = (1 - t);
		const m2 = m * m;
		const t2 = t * t;
		return [ax + m2 * p01[0] + t2 * p21[0], ay + m2 * p01[1] + t2 * p21[1]];
	}

	const res = [p0, [x, y]];
	const trm1 = p21[1] + p01[1];
	const trm2 = p21[0] + p01[0];

	const checkDist = (beg, end) => {
		const [pt1, pt2] = [res[beg], res[end]];
		// max dist between the arc and the line with shared beg/end points
		// is where the arc's 1 derivative == the line slope k
		// B`(t) = 2(1-t)(p1-p0)+2t(p2-p1); B`(t)y = k * B`(t)x
		const [dx, dy] = [pt2[0] - pt1[0], pt2[1] - pt1[1]];
		const rot = Math.abs(dx) >= Math.abs(dy) ? false : true;
		let k, t, dist, pmid;
		if (!rot) {
			k = dy / dx;
			t = (p01[1] - k * p01[0]) / (trm1 - k * trm2);
			pmid = f(t);
			dist = distLinePoint(pt1, pt2, ...pmid);
		} else {
			// solve in rotated 90 ccw coord system to preserve precision
			// [x', y'] -> [y, -x]
			k = - dx / dy;
			t = (p01[0] + k * p01[1]) / (trm2 + k * trm1);
			pmid = f(t);
			dist = distLinePoint([pt1[1], -pt1[0]], [pt2[1], -pt2[0]], pmid[1], -pmid[0]);
		}
		return dist <= this.maxdist ? [true, pmid] : [false, pmid];
	};

	const maxpoints = this.maxpoints;
	(function recurse(beg = 0, end = 1) {
		if (end == maxpoints) {
			console.error('FLASH.ABP.quadraticCurveTo.recurse(): max points reached ', p0, [ax, ay], [x, y]);
			return end;
		}
		const [ok, pmid] = checkDist(beg, end);
		let ret = end;
		if (!ok) {
			res.splice(end, 0, pmid);
			const beg2 = recurse(beg, end);
			ret = recurse(beg2, beg2 + 1);
		}
		return ret;
	})();

	obj.push(...(res.slice(1)));

	return this;
}

const parseFXG = fxg => {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(fxg, "text/xml");
	const path_tags = xmlDoc.getElementsByTagName("Path");

	const paths = []; // each path tag is a visually separate shape

	for (let i = 0; i < path_tags.length; i++) {
		const pti = path_tags[i];  
		 
		const fill = pti.getElementsByTagName('fill');
		const stroke = pti.getElementsByTagName('stroke');
		let wireframe = stroke.length ? true : false;

		paths.push({
			data: pti.getAttribute('data'),
			wireframe,
			fill_raw: wireframe ? stroke[0]?.children[0] : fill[0]?.children[0],
			fill: null
		});
	}
	for (let i = 0, len = paths.length; i < len; i++) {
		let pi = paths[i];
		let g = pi.fill_raw;
		if (!g) continue;
		switch (g.nodeName) {
			case "SolidColor":
			case "SolidColorStroke":
				const alpha = g.getAttribute('alpha');
				// if color is not provided it's black
				pi.fill = {
					type: g.nodeName,
					color: parseInt((g.getAttribute('color') || '#0').slice(1), 16),
					weight: parseInt(g.getAttribute('weight') || 1),
					transparent: alpha ? true : false,
					alpha: parseFloat(alpha || '1.0'),
				};
				break;
			case "ContourGradient":
			case "LinearGradient":
			case "RadialGradient":
			case "LinearGradientStroke":
			case "RadialGradientStroke":
				pi.fill = { type: g.nodeName };
				// attr: x, y, weight, scale, rotation
				/* TODO
				 * <Path flm:isDrawingObject='false' data='M-33.85 72.05 -72.1 72.05 72.05 -72.05Z'>      <fill>        <LinearGradient>          <GradientEntry ratio='0' color='#9E6B4B'/>          <GradientEntry ratio='1' color='#9E6B4B' alpha='0'/>          <matrix>            <Matrix a='63.2' b='-108.6' c='93.2' d='86.75' tx='34.2' ty='16.3'/>          </matrix>        </LinearGradient>      </fill>    </Path>
				 */
				for (let n of g.attributes) pi.fill[n.nodeName] = Number(n.nodeValue);
				pi.fill.y *= -1;
				const elem = g.getElementsByTagName("GradientEntry");
				const [colors, steps, alphas] = [[], [], []];
				let transparent = false;
				for (let e of elem) {
					colors.push(parseInt((e.getAttribute('color') || '#0').slice(1), 16));
					steps.push(Number(e.getAttribute('ratio')));
					const a = e.getAttribute('alpha');
					if (!transparent && a) transparent = true;
					alphas.push(parseFloat(a || '1.0'));
				}
				pi.fill.colors = colors;
				pi.fill.steps = steps;
				pi.fill.alphas = alphas;
				pi.fill.transparent = transparent;
				pi.fill.rotation = pi.fill.rotation || 0;
				break;
			default:
				console.error(`FLASH.parseFXG(): unknown stroke/fill type ${g.nodeName}`);
				break;
		}
		delete pi.fill_raw;
	}
	return paths;
};

const makeAdaptivePoints = (paths, open_path = true) => {
	const [shapes, pis] = [[], []];

	for (let p of paths) {
		let subpts = [];
		const subs = p.data.match(/M[^M]+/g);
		for (let i = 0; i < subs.length; i++) { // each sub is either an outline or a hole
			let beg, end; 
			subpts[i] = new ABP(p.quality);
			const obj = subpts[i];
			let subsi = subs[i];
			const closed = subsi.slice(-1) == "Z";
			if (closed) subsi = subsi.slice(0, -1);
			const comm = subsi.match(/([MQL][0-9\.\- ]*)/g);
			for (let c of comm) {
				let t = c.slice(0, 1);
				let args = c.slice(1).split(' ').map(e => Number(e));
				if (!beg) beg = [args[0], args[1]];
				end = args.slice(-2);
				switch (t) {
					case 'M':
						obj.moveTo(args[0], args[1]);
						args.splice(0, 2);
						// if there are more points - it's lines
					case 'L':
						for (let i = 0; i < args.length; i += 2) obj.lineTo(...args.slice(i, i + 2));
						break;
					case 'Q':
						for (let i = 0; i < args.length; i += 4) obj.quadraticCurveTo(...args.slice(i, i + 4));
						break;
					default:
						console.error(`FLASH.makeAdaptivePoints(): unknown path type ${t} in '${p}'`);
						break;
				}
			}
			if (closed) {
				const open = beg.some((xy, i) => xy != end[i]);
				if (open && !open_path) obj.data.push(obj.data[0]);
				else if (!open && open_path) obj.data.pop();
			}
		}
		const pi = [];
		// strokes
		if (p.wireframe) {
			for (let i = 0; i < subpts.length; i++) {
				pi.push({ wireframe: p.wireframe, fill: p.fill });
				shapes.push([subpts[i]]);
			}
			pis.push(...pi);
			continue;
		}
		// shapes - sort out multiple outlines/holes
		const len = subpts.length;
		const [outlines, holes] = [[], []];
		if (len == 1) {
			outlines.push([subpts[0]]);
			pi.push({ wireframe: p.wireframe, fill: p.fill });
		}
		else
			for (let i = 0; i < subpts.length; i++)
				if (polygonWinding(subpts[i].data) == -1) {
					outlines.push([subpts[i]]);
					pi.push({ wireframe: p.wireframe, fill: p.fill });
				}
				else holes.push(subpts[i]);
			
		// which hole belongs to which outline
		for (let i = 0; i < holes.length; i++) {
			const h = holes[i];
			const pf = h.data[0];
			for (let j = 0; j < outlines.length; j++)
				if (pointInPolygon(outlines[j][0].data, pf[0], pf[1])) {
					outlines[j].push(h);
					break;
				}
		}
		shapes.push(...outlines);
		pis.push(...pi);
	}
	return [shapes, pis];
};

const makeShapeFromFXG = (src, quality) => {
	
	// each path is a collection of outlines (exterior and holes) making a visual shape
	const paths = parseFXG(src);

	for (let p of paths) p.quality = p.quality || quality;
 
	// array of outline collections 
	const [shapes,] = makeAdaptivePoints(paths);

	// work with one visual shape here
	const sh0 = shapes[0];
	// the first outline is the exterior, the rest are holes
	const shape = new THREE.Shape().setFromPoints(
		sh0[0].data.map(v => new THREE.Vector2(v[0], v[1]))
	);
	for (let i = 1; i < sh0.length; i++)
		shape.holes.push(new THREE.Path().setFromPoints(
			sh0[i].data.map((v) => new THREE.Vector2(v[0], v[1]))
		));
 
	return shape;
};

const bisecTriangle = (data, ind, ii, jmx, ti, mp) => {
	// add new point
	data.push([mp[0], mp[1]]);
	// add indexes
	const _ind = new Array(ind.length + 3);
	for(let i = 0; i < ii; i++) _ind[i] = ind[i];

	const opp = jmx ? jmx - 1 : 2; // opposite vertex
	const _vlen = data.length;
	const split = [
		ti[opp], ti[jmx], _vlen - 1,
		ti[opp], _vlen - 1, ti[jmx == 2 ? 0 : jmx + 1],
	];
	for(let i = 0; i < 6; i++) _ind[ii + i] = split[i];
	for(let i = ii + 3; i < ind.length; i++) _ind[i + 3] = ind[i];

	return _ind;
};

const bisecGeom = (data, ind, bisecDist) => {

	const [x, y] = [...data[0]];
	let [xmn, xmx, ymn, ymx] = [x, x, y, y];
	for(let i = 1; i < data.length; i++) {
		const [x, y] = [...data[i]];
		if(x < xmn) xmn = x; else if(x > xmx) xmx = x;
		if(y < ymn) ymn = y; else if(y > ymx) ymx = y;
	}
	
	const [dx, dy] = [xmx - xmn, ymx - ymn];
	const diag = dx * dx + dy * dy;
	const derr = bisecDist * diag;
	
	for(let i = 0; i < ind.length; i+=3) {
	
		const ti = [ind[i], ind[i + 1], ind[i + 2]];
		const p = new Array(4);
		for (let j = 0; j < 3; j++) p[j] = data[ti[j]];
		p[3] = p[0];
		let [jmx, dmx] = [0, 0];
		for(let j = 0; j < 3; j++) {
			const [dx, dy] = [p[j + 1][0] - p[j][0], p[j + 1][1] - p[j][1]];
			const d = dx * dx + dy * dy;
			if(d > dmx) {
				dmx = d;
				jmx = j;
			}
		}
		
		if(dmx < derr) continue;

		// mid point of the longest side
		const mp = [(p[jmx + 1][0] + p[jmx][0]) / 2, (p[jmx + 1][1] + p[jmx][1]) / 2];

		ind = bisecTriangle(data, ind, i, jmx, ti, mp);

		i -= 3; // recursive check
	}

	return ind;
};

const makeBuffGeomFromFXG = (src, quality, _makeZ, bisecDist) => {
	
	// each path is a collection of outlines (exterior and holes) making a visual shape
	const paths = parseFXG(src);

	for (let p of paths) p.quality = p.quality || quality;
 
	// array of outline collections 
	const [shapes,] = makeAdaptivePoints(paths);
  
	// for uv
	let [xmax, ymax] = [0, 0];

	// work with one visual shape here
	const sh = shapes[0];
	// the first outline is the exterior, the rest are holes
	let data = [...sh[0].data];
	const shapeVertices = sh[0].data.map(v => {
		const [x, y] = [v[0], v[1]];
		const [ax, ay] = [Math.abs(x), Math.abs(y)];
		if (ax > xmax) xmax = ax;
		if (ay > ymax) ymax = ay;
		return new THREE.Vector2(x, y);
	});

	const shapeHoles = [];
	for (let i = 1; i < sh.length; i++) {
		const shi = sh[i].data;
		data = [...data, ...shi];
		shapeHoles[i - 1] = shi.map(v => new THREE.Vector2(v[0], v[1]));
	}

	const faces = THREE.ShapeUtils.triangulateShape(shapeVertices, shapeHoles);
	
	let indices = [];
	for (let i = 0; i < faces.length; i++) {
		const [t1, t2, t3] = faces[i];
		indices.push(t1, t2, t3);
	}

	// bisection

	if (bisecDist) indices = bisecGeom(data, indices, bisecDist);

	const uvs = [];
	const [ufact, vfact] = [1 / (2 * xmax), 1 / ymax];

	// make z-profile for an otherwise flat shape
	const makeZ = _makeZ || (() => 0);
	
	const vert = [];
	for (let i = 0; i < data.length; i++) {
		const [x, y] = data[i];
		uvs.push(x * ufact + 0.5, y * vfact);
		vert.push(x, y, makeZ(x, y));
	}

	const geo = new THREE.BufferGeometry();
	const vertices = new Float32Array(vert);
	const uv = new Float32Array(uvs);
	geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
	geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return [geo, paths[0]?.fill?.color];

	/* for non-index
	const vert = [];
	for (let i = 0; i < faces.length; i++) {
		const [t1, t2, t3] = faces[i];
		const [p1x, p1y, p2x, p2y, p3x, p3y] = [...data[t1], ...data[t2], ...data[t3]];
		vert.push(
			p1x, p1y, makeZ(p1x, p1y), 
			p2x, p2y, makeZ(p2x, p2y), 
			p3x, p3y, makeZ(p3x, p3y));
	}*/
};

export { parseFXG, makeAdaptivePoints, makeShapeFromFXG, makeBuffGeomFromFXG, ABP }