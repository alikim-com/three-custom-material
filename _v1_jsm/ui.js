function log() {
  console.log(...arguments);
}

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

export { configFileLoader, createFileUpload, makeDraggable, addSlider, addSliderWidget, selReset, selText, selOpts, selVal, get, strToElement, addUI, setCont, createElem, uiLabel, uiInput, uiTextarea, uiSelect, uiMenu, uiCheckbox, uiButton, makeSwitchBtn, getElemCenter, getElemSize }