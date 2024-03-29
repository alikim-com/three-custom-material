function log() {
	console.log(...arguments);
}

let slog = obj => log(objToString(obj));

const get = id => document.getElementById(id);

const img1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';

const getHTML = () => {
	const html = {};
	document.querySelectorAll('*[id]').forEach(e => html[e.id] = e);
	return html;
};

const parseGET = () => {
	const getp = window.location.search.slice(1).split('&');
	const GET = {};
	getp.forEach(p => {
		const [nm, v] = p.split('=');
		if(nm?.length && v?.length) GET[nm] = v;
	});
	return GET;
}
 
const printArr = (arr, num = 4) => {
	let str = '';
	arr.forEach((a, i) => { str += `${a}, `; if (!((i + 1) % num)) str += '\n'; });
	log(str);
};

const formatString = (str, n) => {
	return str.length > n ? str.slice(0, n) : str.padStart(n, ' ');
};

const formatNumber = (n, prec = 3, sign) => {
	const w = !sign || n < 0 ? '' : sign;
	const str = String(n);
	const strlen = str.length;
	const arr = str.split('.');
	const len = arr.length;
	if (len == 2) {
		if (arr[1].length > prec)
			return `${w}${arr[0]}.${arr[1].slice(0, prec)}`;
		const toadd = prec - arr[1].length;
		return w + str.padEnd(strlen + toadd, '0');
	} else if (len == 1) {
		return w + `${str}.`.padEnd(strlen + prec + 1, '0');
	}
};

const formatNumber2 = (n, fmt) => {
	const s = fmt[0] == ' ' && n > 0 ? '\xa0' : '';
	fmt = fmt[0] == ' ' ? fmt.slice(1) : fmt;
	const [t, prec] = fmt.split('.');
	const ret = {};
	const str = prec ? formatNumber(n, parseInt(prec)) : String(n);
	const float = parseFloat(str);
	if (t[0] == 'f') {
		ret.float = float;
		ret.string = s + str;
	} else if (t[0] == 'i') {
		ret.int = Math.round(float);
		ret.string = s + ret.int;
	} else if (t[0] == 'u') {
		ret.int = Math.max(0, Math.round(float));
		ret.string = s + ret.int;
	}
	return ret;
};

const strToSafe = (str) => {
	return str
		.replace(/"/g, '_DQ_')
		.replace(/'/g, '_SQ_')
		.replace(/`/g, '_BT_')
		.replace(/\r\n|\r|\n/g, '_NL_')
		.replace(/\u200b/g, '')
};

const safeToStr = (str) => {
	return str
		.replace(/_DQ_/g, '"')
		.replace(/_SQ_/g, "'")
		.replace(/_BT_/g, "`")
		.replace(/_NL_/g, '\n')
};

const objToString = obj => {
	if (obj === '')
		return "''";
	else if (!obj) // undefined, null, 0, false, '', ""
		return obj;
	else if (obj.constructor == Array) {
		let reta = '';
		for (let i = 0; i < obj.length; i++) reta += objToString(obj[i]) + ',';
		return '[' + reta.slice(0, -1) + ']';
	}
	else if (obj.constructor == Set) {
		let rets = '';
		for (let item of obj) rets += objToString(item) + ',';
		return 'new Set([' + rets.slice(0, -1) + '])';
	}
	else if (obj.constructor == Object || obj instanceof Object) {
		let reto = '';
		for (let p in obj)
			if (obj.hasOwnProperty(p)) {
				
				const desc = Object.getOwnPropertyDescriptor(obj, p);
				if (desc.get || desc.set) {
					reto += (desc.get ? desc.get : desc.set) + ',';
				} else {
					
					const char = p[0].charCodeAt(0);
					const esc = p.indexOf("'") != -1;
					const quo = p.indexOf(' ') != -1 || esc || char > 47 && char < 58;
					const ep = esc ? p.replaceAll("'", "\\'") : p;
					const strp = quo ? `'${ep}'` : ep;
					reto += `${strp}:${objToString(obj[p])},`;
				}
			}
		return '{' + reto.slice(0, -1) + '}';
	}
	else if (obj.constructor == String) {
		const mult = /\r|\n/.exec(obj) ? '`' : "'";
		return `${mult}${obj.replaceAll("'", "\\'")}${mult}`;
	}
	else
		return obj;
};

const deepCopy = obj => {
	if (!obj) // undefined, null, 0, false, '', ""
		return obj;
	else if (obj instanceof HTMLElement) {
		return obj.cloneNode(true);
	}
	else if (obj.constructor == Array) {
		let reta = [];
		for (let i = 0; i < obj.length; i++)
			reta[i] = deepCopy(obj[i]);
		return reta;
	}
	else if (obj.constructor == Set) {
		let rets = new Set();
		for (let s of obj)
			rets.add(deepCopy(s));
		return rets;
	}
	else if (obj.constructor == Object || obj instanceof Object) {
		let reto = {};
		for (let p in obj)
			if (obj.hasOwnProperty(p)) {
				reto[p] = deepCopy(obj[p]);
			}
		return reto;

	} else // primitives
		return obj;
};

const deepCopyFull = (obj, opt) => {
	if (!obj) // undefined, null, 0, false, '', ""
		return obj;
	else if (obj instanceof HTMLElement) {
		return obj.cloneNode(true);
	}
	else if (obj.constructor == Array) {
		let reta = [];
		for (let i = 0; i < obj.length; i++)
			reta[i] = deepCopyFull(obj[i], opt);
		return reta;
	}
	else if (obj.constructor == Set) {
		let rets = new Set();
		for (let s of obj)
			rets.add(deepCopyFull(s, opt));
		return rets;
	}
	else if (obj.constructor == Object || obj instanceof Object) {
		let reto = {};
		for (let p in obj) {
			if (opt?.skip?.includes(p)) continue;
			if (opt?.link?.includes(p)) {
				reto[p] = obj[p];
				continue;
			}
			if (obj.hasOwnProperty(p)) {
				const desc = Object.getOwnPropertyDescriptor(obj, p);
				if (desc.get || desc.set) { 
					Object.defineProperty(reto, p, desc);
				} else 
					reto[p] = deepCopyFull(obj[p], opt);
			}
		}
		return reto;

	} else // primitives
		return obj;
};

const saveAs = (cont, text, type, name) => {
	const a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
	const blob = new Blob([text], { type: type });
	const objURL = URL.createObjectURL(blob);
	a.href = objURL;
	a.download = name;
	cont.appendChild(a);
	a.click();
	cont.removeChild(a);
	URL.revokeObjectURL(objURL);
}

const clipCopy = (txt, cb) => {
	if (navigator.clipboard) {
		navigator.clipboard.writeText(txt).then(function () {
			cb(true, '');
		}, function () {
			cb(false, `clipCopy(): 'writeText' failed`);
		});
	} else if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
		const ta = document.createElement('textarea');
		ta.value = txt;
		ta.style.position = 'fixed';
		document.body.appendChild(ta);
		ta.select();
		try {
			const res = document.execCommand('copy');
			const msg = res ? '' : `clipCopy(): 'execCommand' unsupported or disabled`;
			cb(res, msg);
		}
		catch (ex) {
			cb(false, `clipCopy(): 'execCommand' exception: ${ex}`);
		}
		finally {
			document.body.removeChild(ta);
		}
	}
};

const bouncer = (a, b, v, err = 0.0001) => {
	const [ab, va, vb] = [Math.abs(a - b), Math.abs(v - a), Math.abs(v - b)];
	if(Math.abs(ab - va - vb) < err) return v;
	const [adj, opp, ext] = va < vb ? [a, b, va] : [b, a, vb];
	const ato = adj < opp ? 1.0 : -1.0;
	const folds = ext / ab;
	const ff = Math.floor(folds);
	const tail = ext - ff * ab;
	return ff % 2 == 0.0 ? adj + ato * tail : opp - ato * tail;
};

function Counter(cnt, cb) { 
	this._cnt = cnt;
	this.tick = () => { if (--this._cnt == 0) cb() };
};

const flip = (a, b, f) => f ? [a, b] : [b, a];

function FindRange() {
	this.reset();
}
FindRange.prototype.update = function (v) {
	this.min = v >= this.min ? this.min : v;
	this.max = v <= this.max ? this.max : v;
}
FindRange.prototype.reset = function () {
	this.min = Infinity;
	this.max = -Infinity;
}
FindRange.prototype.log = function () {
	console.log(`min: ${this.min}, max: ${this.max}`);
}

const getUniqueAttr = (arr, size = 3, err = 0.001) => {
	const res = [];
	for (let i = 0; i < arr.length; i+=size) {
		let match = false;
		for (let j = 0; j < res.length; j+=size) {

			let cont = false;
			for(let s = 0; s < size; s++) 
				if(Math.abs(res[j + s] - arr[i + s]) > err) { cont = true; break; }
			if(cont) continue;

			match = true;
			break;
		}
		if(!match) res.push(arr[i], arr[i + 1], arr[i + 2]);
	}
	return res;
};

export { get, img1x1, getHTML, parseGET, printArr, log, slog, formatString, formatNumber, formatNumber2, strToSafe, safeToStr, objToString, deepCopy, deepCopyFull, saveAs, clipCopy, bouncer, flip, Counter, FindRange, getUniqueAttr }