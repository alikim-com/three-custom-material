import { log, formatNumber2 } from '/_v1_jsm/utils.js'

import { glClamp } from '/_v1_jsm/glsl_ported.js'

let _cont = null;

const setCont = cont => {
  _cont = cont;
}

const get = id => document.getElementById(id);

const createElem = (name, w, h, id, stl) => {
  const elem = document.createElementNS('http://www.w3.org/1999/xhtml', name);
  if (!elem) return null;
  elem.setAttribute('id', id);
  if (w) elem.setAttribute('width', w);
  if (h) elem.setAttribute('height', h);
  if (stl) elem.style = stl;
  return elem;
};

const strToElement = str => {
  const template = document.createElement('template');
  template.innerHTML = str;
  return template.content;
};

const addUI = (str, cont = _cont, ref = null) => {
  if (!cont) {
	 log(`addUI() err: no container`);
	 return;
  }
  const elem = strToElement(str);
  cont.insertBefore(elem, ref);
};

const def = {
	L: 'noselect nowrap',
	S: 'cscroll',
	B: 'mini nowrap',
};

const uic = (nm, cls) => {
	const dc = def[nm] || '';
	if (cls == undefined) return dc ? ` class="${dc}"` : '';
	cls = cls.replace('def', dc);
	if (cls == '') return '';
	return ` class="${cls}"`;
};

const uiv = v => v ? ' ' + v : '';

const uip = (nm, v) => v ? ` ${nm}="${v}"` : '';

const uipa = (nm, v) => {
	let ret = '';
	for (let i = 0; i < nm.length; i++) ret += v[i] != undefined ? ` ${nm[i]}="${v[i]}"` : '';
	return ret;
};

const uiLabel = obj => `<label${uip('id', obj.id)}${uic('L', obj.cls)}>${obj.txt}</label>`;

const uiButton = obj => `<button${uip('id', obj.id)}${uic('B', obj.cls)}>${obj.txt}</button>`;

const uiTextarea = obj => `<textarea spellcheck="false"${uip('id', obj.id)}${uic('T', obj.cls)}>${obj.txt}</textarea>`;

const uiInput = obj => 
	`<div${uip('id', obj.cont_id)}${uic('D', obj.cont_cls)}>` +
	(obj.txt ? uiLabel({ txt: obj.txt, cls: obj.lab_cls }) : '') +
	`<input type="text" spellcheck="false"${uipa(['id','value','placeholder'], [obj.id, obj.val, obj.hint])}${uic('I', obj.cls)}/></div>`;

const uiCheckbox = obj => 
`<label${uic('L', obj.cls)}>
	<input type="checkbox" id="${obj.id}" ${obj.chk ? "checked" : ''}/>
	<span${uic('SP', obj.cls_txt)}>${obj.txt}</span>
</label>`;

const uiSelect = obj => {
	const s0 = `<select${uip('id', obj.id)}${uic('S', obj.cls)}>`;
	let s = '';
	const opt = obj.opt;
	for (let i = 0; i < opt.length; i++) s += `<option value="${i}">${opt[i]}</option>`;
	return s0 + s + '</select>';
};

const uiMenu = obj =>
	`<div${uip('id', obj.cont_id)}${uic('D', obj.cont_cls)}>` +
		(obj.txt ? uiLabel({ txt: obj.txt, cls: obj.lab_cls }) : '') +
		uiSelect({ id: obj.id, cls: obj.cls, opt: obj.opt }) + '</div>';

const makeSwitchBtn = (elem, swtch, state) => {
	const dt = elem.swData = { swtch, state };
	dt.state ^= 1;
	dt.flip = () => {
		dt.state ^= 1;
		elem.textContent = dt.swtch[dt.state];
	};
	dt.align = st => { if (dt.state != st) dt.flip() };
	dt.flip();
};

const getContent = elem => elem.tagName == 'INPUT' ? elem.value : elem.textContent;

const setContent = (elem, v) => {
	if (elem.tagName == 'INPUT')
		elem.value = v;
	else
		elem.textContent = v;
};

const selText = elem => elem.options[elem.selectedIndex]?.text;

const selOpts = elem => [...elem.options].map(e => e.text);

const selVal = (elem, text) => {
	const coll = elem.options;
	for (let i = 0; i < coll.length; i++) if (coll[i].text == text) return i;
};

const selReset = (elem, opt) => {
	while (elem.length) elem.remove(elem.length - 1);
	opt.forEach((v, i) => { 
	  const op = document.createElement('option');
	  op.text = v;
	  op.value = i;
	  elem.add(op);
	});
};

const getElemCenter = elem => {
	const rect = elem.getBoundingClientRect();
	return { x: (rect.right + rect.left) / 2, y: (rect.bottom + rect.top) / 2 };
};

const getElemSize = elem => {
	const style = getComputedStyle(elem);
	elem.style.display = 'block';
	const obj = {
	  h: elem.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight),
	  v: elem.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom),
	};
	elem.style.display = '';
	return obj;
};
 
const vpOff = (elem, m) => {
	const pr = gp('lt', m);
	const stl = elem.style[pr];
	elem.style[pr] = '0px';
	const off = elem.getBoundingClientRect()[gp('xy', m)];
	elem.style[pr] = stl;
	return off - elem.style[pr('mlt', m)];
};

const vpToLoc = (elem, val, m) => {
	const off = vpOff(elem, m);
	elem.style[gp('lt', m)] = (val - off) + 'px';
};

const locToVp = (elem, val, m) => {
	const off = vpOff(elem, m);
	elem.style[gp('lt', m)] = (val + off) + 'px';
};
	
const makeDraggable = obj => {

	const mode = obj.mode;
	const sensor = obj.sensor;
	const cont = obj.cont;
	const drag_area = obj.drag_area || document.documentElement;
	const event_area = obj.event_area || document.documentElement;
	const callback = obj.callback;
	const disable = obj.disable || [];
	const notches = obj.notches;

	const gp = (nm, m) => {
		const p = {
			lt: { h: 'left', v: 'top' },
			rb: { h: 'right', v: 'bottom' },
			xy: { h: 'x', v: 'y' },
			wh: { h: 'width', v: 'height' },
			cwh: { h: 'clientWidth', v: 'clientHeight' },
			cxy: { h: 'clientX', v: 'clientY' },
			mlt: { h: 'marginLeft', v: 'marginTop' },
		};
		return p[nm][m];
	};

	const move = (evt, m) => {
		// set left/top only to avoid fighting right/bot
		const dif = evt[gp('cxy', m)] - md[gp('xy', m)];
		const neg = dif < 0;
		const pr = gp('lt', m);
		const now = parseFloat(stl[pr]);
		const range = _p[m + 'max'];
		const divran = div? range * div : 0;
		const _nxt = neg ? Math.max(0, now + dif) : Math.min(range, now + dif);
      const nxt = !div ? _nxt : divran * Math.round(_nxt / divran);
		stl[pr] = nxt + 'px';
		return nxt - now;
	};

	function onMouseDown(evt) {
		evt.preventDefault();
		[md.x, md.y] = [evt.clientX ?? evt.detail.clientX, evt.clientY ?? evt.detail.clientY];
		event_area.addEventListener('mouseup', onMouseUp, { once: true });
		event_area.addEventListener('mousemove', onMouseMove);
		disable.forEach(ifr => ifr.classList.toggle('mouse_off', true));
		callback?.('d');
	}

	function onMouseMove(_evt) {
		const evt = {
			//target: _evt.target,
			//currentTarget: _evt.currentTarget,
			clientX: _evt.clientX ?? _evt.detail.clientX,
			clientY: _evt.clientY ?? _evt.detail.clientY,
		};
		mode.forEach(m => {
			const shft = move(evt, m);
			md[gp('xy', m)] += shft;
		});	
		callback?.('m');
	}

	function onMouseUp(evt) {
		mode.forEach(m => { move(evt, m) });
		event_area.removeEventListener('mousemove', onMouseMove);
		disable.forEach(ifr => ifr.classList.toggle('mouse_off', false));
		callback?.('u');
	}

	const div = notches > 1 ? 1 / (notches - 1) : 0;
	const md = { x: 0, y: 0 };

	const stl = cont.style;
	const style = getComputedStyle(cont);
	['left', 'top'].forEach(nm => { stl[nm] = style[nm] });
	const csize = m => getElemSize(cont)[m];

	const _p = {
		get h() { return parseFloat(stl.left) },
		get v() { return parseFloat(stl.top) },
		get hmax() { return drag_area[gp('cwh', 'h')] - csize('h') },
		get vmax() { return drag_area[gp('cwh', 'v')] - csize('v') },
	};

	sensor.addEventListener('mousedown', onMouseDown);

	return _p;
};

const addSlider = (info, parent, event_area, cb, jump = false) => {

	const cls = info.cls;
	const id = { slider: info.id };
	['sensor', 'knob', 'track'].forEach(nm => { id[nm] = `${id.slider}_${nm}` });

	addUI(
`<div id="${id.slider}" class="${cls.slider}">
	<div id="${id.track}" class="${cls.track}"></div>
	<div id="${id.knob}" class="${cls.knob}">
		<div id="${id.sensor}"></div>
	</div>
</div>`, parent);

	const get = id => document.getElementById(id);

	const ui = {};
	['sensor', 'knob', 'track', 'slider'].forEach(nm => { ui[nm] = get(id[nm]) });

	const stl_n = ui.sensor.style;
	stl_n.width = '100%';
	stl_n.height = '100%';

	const _cb = t => { cb?.(t) };

	const _p = makeDraggable({
		// _p = { x(left), y(top), xmax(range_h), ymax(range_v) - cont getters in px }
		mode: info.mode, 
		sensor: ui.sensor, 
		cont: ui.knob, 
		drag_area: ui.slider, 
		event_area, 
		callback: _cb,
		notches: info.notches,
	});

	const sliderFakeMDown = evt => {
		if (evt.target == ui.sensor) return;
		const cen = getElemCenter(ui.sensor);
		ui.sensor.dispatchEvent(new CustomEvent('mousedown',
			{ detail: { clientX: cen.x, clientY: cen.y } }));
		event_area.dispatchEvent(new CustomEvent('mousemove',
			{ detail: { clientX: evt.clientX, clientY: evt.clientY } }));
	};

	if (jump) ui.slider.addEventListener('mousedown', sliderFakeMDown);    

	const setPos = (x, y) => {
		ui.knob.style.left = (x * _p.hmax) + 'px';
		ui.knob.style.top = (y * _p.vmax) + 'px';
	};

	setPos(info.pos.x, info.pos.y);

	return [_p, setPos];
};

const addSliderWidget = (html, nm, pid, cb, dat, x, sym, notches) => {
	const uid_wgt = `${pid}_${nm}`;
	addUI(`<div id="${uid_wgt}" class="ml10 vcenter"><label class="hcenter w20" title="${nm}">${sym || nm}</label></div>`, html[pid]);
	html[uid_wgt] = get(uid_wgt);

	const uid_sld = uid_wgt + '_sld';

	[dat._p, dat.setPos] = addSlider({
		id: uid_sld,
		mode: ['h'],
		cls: {slider: 'slider', track: 'track nomouse', knob: 'knob'},
		pos: {x, y: 0.5},
		notches,
	}, html[uid_wgt], document.documentElement, cb, true);

	const uid_lab = dat.uid_lab = uid_wgt + '_lab';
	addUI(`<label id="${uid_lab}" class="w50 s12">...</label>`, html[uid_wgt]);
	[uid_sld, uid_lab].forEach(nm => { html[uid_lab] = get(uid_lab) });
};

const addSliderWidget2 = (html, cont, dat, cb, cls) => {
	const uid_wgt = 'wgt_' + dat.uid;
	const uid_tit = dat.uid_tit = uid_wgt + '_tit';
	addUI(`<div id="${uid_wgt}" class="mt10 vcenter${uiv(cls.wgt)}"><label id="${uid_tit}" title="${dat.title}" class="shrink mono s13${uiv(cls.tit)}">${dat.sym || dat.uid}</label></div>`, cont);
	html[uid_wgt] = get(uid_wgt);

	const uid_sld = uid_wgt + '_sld';

	[dat._p, dat.setPos] = addSlider({
		id: uid_sld,
		mode: ['h'],
		cls: {slider: `slider2 ml5${uiv(cls.sld)}`, track: 'track nomouse', knob: 'knob'},
		pos: {x: dat.def, y: 0.5},
		notches: dat.notches,
	}, html[uid_wgt], document.documentElement, cb, true);

	if (dat.label) {
		const mode = dat.label;
		const uid_lab = dat.uid_lab = uid_wgt + '_lab';
		const str =
		mode == 'r' ?
		`<label id="${uid_lab}" class="ml5 shrink mono s13${uiv(cls.lab)}">...</label>` :
		mode == 'rw' ?
		`<input id="${uid_lab}" type="text" spellcheck="false" class="ml5 shrink mono s13${uiv(cls.lab)}"/>` : '';
		addUI(str, html[uid_wgt]);
		html[uid_lab] = get(uid_lab);
	}
	[uid_sld, uid_tit].forEach(nm => { html[nm] = get(nm) });
	html[uid_sld].setAttribute('title', dat.title);
};

const makeHSlider = (html, cont, uobj, cb, cls) => {
	// uobj - unique per slider object 
	uobj.min = uobj.min || 0;
	uobj.max = uobj.max || 1;
	uobj.def = uobj.def || 0.5;
	uobj.mm = uobj.max - uobj.min;
	const def_pos = (uobj.def - uobj.min) / uobj.mm;
	// makeDraggable callback onMouse evt t = ['u', 'd', 'm']
   const update = t => {
		const val = uobj.min + uobj.mm * uobj._p.h / uobj._p.hmax;
		const _v = uobj._v = formatNumber2(val, uobj.type);
		const elem = html[uobj.uid_lab];
		if(elem) setContent(elem, _v.string);
		cb?.(_v); // sync value, render if 3D
	};
	// creates html[wgt_uid] adds to cont, creates label html[uobj.uid_tit/lab]
	// adds uobj.setPos(), uobj._p {h(), v(), hmax, vmax}, uobj.uid_lab
	addSliderWidget2(html, cont, uobj, update, cls);
	//html[`wgt_${uobj.uid}_tit`].classList.add(cls.tit);
	// set after uid_lab is created to use updated slider width
	uobj.setPos(def_pos, 0.5);
	update(''); // initial sync
	// sync slider /w manual label input
	//if (uobj.label == 'rw') {
		html[`wgt_${uobj.uid}_lab`].val_ok = vt => {
			uobj._v = formatNumber2(vt, uobj.type);
			const pos = glClamp((vt - uobj.min) / uobj.mm, 0, 1);
			uobj.setPos(pos, 0.5);
		};
	//}
	return html['wgt_' + uobj.uid];
 };

const createFileUpload = obj => {
	const id = obj.id;
	let str = `<div class="none"><input type="file" id="${id}"></div>` +
		uiInput({ id: id + '_path', hint: 'DnD or type URL', cls: obj.cls }) +
		uiButton({ txt: 'browse', id: id + '_browse', cls: 'ml10 def' }) +
		uiButton({ txt: 'load url', id: id + '_url', cls: 'ml10 def' });
	return str;
};

const configFileLoader = (id, loaderCB) => {

	const e_inpf = get(id);
	const [e_path, e_bro, e_url] = ['_path', '_browse', '_url'].map(nm => get(id + nm));

	e_bro.addEventListener('click', () => { e_inpf.click() });

	e_inpf.addEventListener('change', evt => {
		const file = evt.target.files[0];
		e_path.value = file.name;
		loaderCB({ file });
	});

	e_path.addEventListener('dragover', evt => { evt.preventDefault() });

	e_path.addEventListener('drop', evt => {
		evt.preventDefault();
		const file = evt.dataTransfer.files[0];
		e_path.value = file.name;
		loaderCB({ file });
	});

	e_url.addEventListener('click', () => { loaderCB({ url: e_path.value}) });
};

const validInt = v => !isNaN(parseInt(v, 10));
const validFloat = v => !isNaN(parseFloat(v));
const validNumber = v => validInt(v) || validFloat(v);
const gtzInt = v => validInt(v) && parseInt(v, 10) > 0;
const gtzFloat = v => validFloat(v) && parseFloat(v) > 0;
const gtzNumber = v => gtzInt || gtzFloat;
const byteInt = v => {
	const int = parseInt(v, 10);
	return validInt(v) && int >= 0 && int < 256;
};
const normFloat = v => {
	const flt = parseFloat(v);
	return validFloat(v) && flt >= 0 && flt <= 1;
};

const REGEXP = {
  int: [/^[+-]?[0-9]*$/, validInt],
  uint: [/^[0-9]*$/, validInt],
  gint: [/^[0-9]*$/, gtzInt],
  _int: [/^-[0-9]*$/, validInt],
  byte: [/^[0-9]*$/, byteInt],
  float: [/^[+-]?[0-9]*\.?[0-9]*$/, validFloat],
  ufloat: [/^[0-9]*\.?[0-9]*$/, validFloat],
  gfloat: [/^[0-9]*\.?[0-9]*$/, gtzFloat],
  _float: [/^-[0-9]*\.?[0-9]*$/, validFloat],
  norm: [/^[01]?\.?[0-9]*$/, normFloat],
  norm2f: [/^[01]?\.?[0-9]{0,2}$/, normFloat],
  number: [/^[+-]?[0-9]*\.?[0-9]*$/, validNumber],
  unumber: [/^[0-9]*\.?[0-9]*$/, validNumber],
  gnumber: [/^[0-9]*\.?[0-9]*$/, gtzNumber],
  _number: [/^-[0-9]*\.?[0-9]*$/, validNumber],
};

const elog = (out, str, add = false) => {
	if (out) out.value = add ? out.value + str : str;
};

const elog_ok = (out, str, add) => {
	out.classList.toggle('hide', false);
	out.classList.toggle('elog', false);
	out.classList.toggle('elog_ok', true);
	elog(out, str, add);
	setTimeout(() => {
		out.classList.toggle('hide', true);
		out.classList.toggle('elog', true);
		out.classList.toggle('elog_ok', false);
	}, 2000);
};

const val_fail = (elem, eobj, add = false) => {

	for(const nm of ['regex', 'valid', 'ext'])
		if(!eobj[nm]) {
			elog(elem.val_log, elem.val_err[nm]);
			break;
		}
	
	const tid = elem.val_tid;
	elem.val_log.classList.toggle('hide', false);
	clearTimeout(tid.html);
	tid.html = setTimeout(() => { elem.val_log.classList.toggle('hide', true) }, 2000);

	elem.classList.toggle('flash_red', false);
	clearTimeout(tid.css);
	tid.css = setTimeout(() => { elem.classList.toggle('flash_red', true) }, 10);
};

const validate = (elem, data) => {
	const val = getContent(elem);
	const [beg, end] = [elem.selectionStart, elem.selectionEnd];
	const v = val.slice(0, beg) + data + val.slice(end);
	const vt = v.trim();
	const regex = elem.val_obj[0].test(vt);
	const valid = elem.val_obj[1](vt);
	const ext = elem.val_ext?.(elem, data, vt) ?? true;
	if(regex && valid && ext) {
		elem.value = v;
		elem.selectionStart = elem.selectionEnd = beg + data.length;
		elem.val_ok?.(vt);
	} else {
		val_fail(elem, {regex, valid, ext});
	}
};

const addValidator = (elem, t, ext_cb, val_err, val_log) => {
	elem.val_obj = REGEXP[t];
	elem.val_ext = ext_cb;
	elem.val_err = val_err;
	elem.val_tid = { html: 0, css: 0 };
	elem.val_log = val_log;
	// TODO insert
	elem.addEventListener('keydown', evt => {
		const key = evt.key;
		if(key == 'Delete' || key == 'Backspace') {
			const nosel = elem.selectionStart == elem.selectionEnd;
			if(nosel)
				if(key == 'Delete') elem.selectionEnd++; 
				else elem.selectionStart--; 
			evt.preventDefault();
			validate(elem, '');
			return;
		}
		if(key.length == 1 && !evt.ctrlKey) {
			evt.preventDefault();
			validate(elem, evt.key);
		}
	});
	elem.addEventListener('drop', evt => { 
		evt.preventDefault();
		validate(elem, evt.dataTransfer.getData("text"));
	});
	elem.addEventListener('cut', evt => {
		evt.preventDefault();
		if(elem.selectionStart != elem.selectionEnd) 
		validate(elem, '');
	});
	elem.addEventListener('paste', evt => {
		evt.preventDefault();
		validate(elem, evt.clipboardData.getData("text"));
	});
	elem.addEventListener('blur', evt => {
		validate(elem, '');
	});
};

export { configFileLoader, createFileUpload, makeDraggable, addSlider, addSliderWidget, addSliderWidget2, makeHSlider, selReset, selText, selOpts, selVal, get, strToElement, addUI, setCont, createElem, uiLabel, uiInput, uiTextarea, uiSelect, uiMenu, uiCheckbox, uiButton, makeSwitchBtn, getElemCenter, getElemSize, addValidator, elog, elog_ok, getContent, setContent }