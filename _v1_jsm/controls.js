import { vectLength, norm, cross, quaternRotate as rotate } from '/_v1_jsm/geometry.js'

const mult = (w1, x1, y1, z1, w2, x2, y2, z2) => { // rotation addition
    return [
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        x2 * w1 + x1 * w2 + y1 * z2 - z1 * y2,
        y2 * w1 + y1 * w2 + z1 * x2 - x1 * z2,
        z2 * w1 + z1 * w2 + x1 * y2 - y1 * x2
    ];
}

const types = {
    "OrthographicCamera": 0,
    "PerspectiveCamera": 1,
    "DirectionalLight": 2,
    "PointLight": 3,
}

let ok, ctype;
let cont, contmu, obj, hlp, type, tar, notifyCaller, r;

let x0, y0, x1, y1;
let dragging, panning, rolling, inverse;

let _MBDown, _MMove, _MBUp, _MBMenu, _MWHL;

const orbitObject0 = (pit, yaw) => {

    const cq = obj.quaternion;
    const qt = [cq.w, cq.x, cq.y, cq.z];
    const [cx, cy, cz] = [rotate(1, 0, 0, ...qt), rotate(0, 1, 0, ...qt), rotate(0, 0, -1, ...qt)];
    const rot = [cx[0] * pit + cy[0] * yaw, cx[1] * pit + cy[1] * yaw, cx[2] * pit + cy[2] * yaw];
    const rotm = vectLength(rot);
    const th = 0.5 * Math.asin(rotm / (rotm * rotm + 1));
    const sin = Math.sin(th);
    const q3 = cross(...rot, ...cz);
    const q = norm([Math.cos(th), ...q3.map(x => x * sin)]); // input rotation quaternion

    const qn = mult(...q, ...qt);
    const czn = rotate(0, 0, -1, ...qn);

    obj.setRotationFromQuaternion({ x: qn[1], y: qn[2], z: qn[3], w: qn[0] });
    obj.position.set(tar[0] - czn[0] * r, tar[1] - czn[1] * r, tar[2] - czn[2] * r);
    if (hlp) hlp.position.copy(obj.position);
}

const orbitObject1 = (fi, th) => {

    fi *= 0.1;
    th *= -0.1;

    const cq = obj.quaternion;
    const qt = [cq.w, cq.x, cq.y, cq.z];

    const qfi = [Math.cos(fi), 0, Math.sin(fi), 0];

    const qn = mult(...qfi, ...qt);
    const qth3 = rotate(1, 0, 0, ...qn);

    const sin = Math.sin(th);
    const qth = norm([Math.cos(th), ...qth3.map(x => x * sin)]);

    const qn2 = mult(...qth, ...qn);
    const czn2 = rotate(0, 0, -1, ...qn2);

    obj.setRotationFromQuaternion({ x: qn2[1], y: qn2[2], z: qn2[3], w: qn2[0] });
    obj.position.set(tar[0] - czn2[0] * r, tar[1] - czn2[1] * r, tar[2] - czn2[2] * r);
    if (hlp) hlp.position.copy(obj.position);
}

const panObject0 = (hor, ver) => {

    const cq = obj.quaternion;
    const qt = [cq.w, cq.x, cq.y, cq.z];
    const [cx, cy, cz] = [rotate(1, 0, 0, ...qt), rotate(0, 1, 0, ...qt), rotate(0, 0, -1, ...qt)];
    const pan = [cx[0] * hor + cy[0] * ver, cx[1] * hor + cy[1] * ver, cx[2] * hor + cy[2] * ver];

    for (let i = 0; i < 3; i++) tar[i] += pan[i];

    obj.position.set(tar[0] - cz[0] * r, tar[1] - cz[1] * r, tar[2] - cz[2] * r);
    if (hlp) hlp.position.copy(obj.position);
}

const panObject1 = panObject0;

const zoomObject0 = () => {
    const cq = obj.quaternion;
    const qt = [cq.w, cq.x, cq.y, cq.z];
    const cz = rotate(0, 0, -1, ...qt);
    obj.position.set(tar[0] - cz[0] * r, tar[1] - cz[1] * r, tar[2] - cz[2] * r);
    if (hlp) hlp.position.copy(obj.position);
}

const zoomObject1 = zoomObject0;

const rollObject0 = (th) => {
    const cq = obj.quaternion;
    const qt = [cq.w, cq.x, cq.y, cq.z];
    const cz = rotate(0, 0, -1, ...qt);
    th /= 2;
    const sin = Math.sin(th);
    const qn = mult(Math.cos(th), ...cz.map(x => x * sin), ...qt);
    obj.setRotationFromQuaternion({ x: qn[1], y: qn[2], z: qn[3], w: qn[0] });
}

const rollObject1 = () => { };

function _orbitObject() {
   const func = ctype ? orbitObject1 : orbitObject0;
   func(...arguments);
}
function _panObject() {
   const func = ctype ? panObject1 : panObject0;
   func(...arguments);
}
function _zoomObject() {
   const func = ctype ? zoomObject1 : zoomObject0;
   func(...arguments);
}
function _rollObject() {
   const func = ctype ? rollObject1 : rollObject0;
   func(...arguments);
}

function Translate() { ctype = 2; init.call(this, ...arguments) }
Translate.prototype.getObj = function () { return [obj, tar] }
Translate.prototype.setActive = function (flag) { setActive.call(this, flag) }

function Orbital() { ctype = 1; init.call(this, ...arguments) }
Orbital.prototype.getObj = function () { return [obj, tar] }
Orbital.prototype.setActive = function (flag) { setActive.call(this, flag) }

function Trackball() { ctype = 0; init.call(this, ...arguments) }
Trackball.prototype.getObj = function () { return [obj, tar] } 
Trackball.prototype.setActive = function(flag) { setActive.call(this, flag) }

function init(container, _obj, lookAt, callback, scene, helper, usepage = true) {

   [x0, y0] = [0, 0];
   [x1, y1] = [0, 0];
   [dragging, panning, rolling] = [false, false, false];

   ok = true;
   type = types[_obj.type];
   if (type == undefined) {
      ok = false;
      console.error(`CONTROLS.init: unsupported type '${_obj.type}'`);
      return {};
   }

   cont = container;
   obj = _obj;
   hlp = helper;
   tar = lookAt ? lookAt : (tar || [0, 0, 0]); // preserve panning when switching
   notifyCaller = callback || function () { };
   contmu = usepage ? document.body : cont; // container for mouse up & move events

   obj.lookAt(...tar);

   inverse = type < 2 ? 1 : -1; // inverse input for cameras

   if (hlp) {
      hlp.position.copy(obj.position);
      scene.add(hlp);
   }

   /*if (type == 2) { // dir light
      obj.target = target;
      scene.add(target);
   }*/

   [this.sensX, this.sensY, this.sensZ, this.sensP, this.sensR] = [0.02, 0.01, 1.1, 12.0, 0.8];
}

function setActive(flag) {
    if (!ok) return;
    if (flag) {
        const cpos = obj.position;
        r = vectLength([cpos.x - tar[0], cpos.y - tar[1], cpos.z - tar[2]]);

        _MBDown = MBDown.bind(this);
        _MMove = MMove.bind(this);
        _MBUp = MBUp.bind(this);
        _MBMenu = MBMenu.bind(this);
        _MWHL = MWHL.bind(this);

        cont.addEventListener('mousedown', _MBDown);
        contmu.addEventListener('mousemove', _MMove);
        contmu.addEventListener('mouseup', _MBUp);
        cont.addEventListener('contextmenu', _MBMenu);
        cont.addEventListener('wheel', _MWHL);
    }
    else {
        cont.removeEventListener('mousedown', _MBDown);
        contmu.removeEventListener('mousemove', _MMove);
        contmu.removeEventListener('mouseup', _MBUp);
        cont.removeEventListener('contextmenu', _MBMenu);
        cont.removeEventListener('wheel', _MWHL);
    }
}

function MBDown(evt) {
    [x0, y0] = [-evt.clientX, -evt.clientY];
    [x1, y1] = [x0, y0];
    if (evt.button == 0 && !evt.ctrlKey && !panning && !rolling)
        dragging = true;
    else if (evt.button == 2 && !dragging && !rolling)
        panning = true;
    else if (evt.button == 0 && evt.ctrlKey && !panning && !dragging)
        rolling = true;
}  

function MMove(evt) {
    if (dragging || panning || rolling) {

        [x1, y1] = [-evt.clientX, -evt.clientY];
        const hor = inverse * (x1 - x0) * this.sensX;
        const ver = inverse * (y0 - y1) * this.sensY;

        if (hor || ver) {
            if (dragging)
                _orbitObject(hor, ver);
            else if (panning)
                _panObject(hor * this.sensP, ver * this.sensP);
            else if (rolling)
                _rollObject(hor * this.sensR);

            notifyCaller();
        }

        [x0, y0] = [x1, y1];
    }
}

function MBUp(evt) {

    if (dragging || panning || rolling) {

        [x1, y1] = [-evt.clientX, -evt.clientY];
        const hor = inverse * (x1 - x0) * this.sensX;
        const ver = inverse * (y0 - y1) * this.sensY;

        if (hor || ver) {
            if (evt.button == 0 && !evt.ctrlKey)
                _orbitObject(hor, ver);
            else if (evt.button == 0 && evt.ctrlKey)
                _rollObject(hor * this.sensR);
            else if (evt.button == 2) 
                _panObject(hor * this.sensP, ver * this.sensP);

            notifyCaller();
        }

        dragging = false;
        panning = false;
        rolling = false;
    }

    [x0, y0] = [0, 0];
    [x1, y1] = [0, 0];
}

function MBMenu(evt) {
    evt.preventDefault();
}

function MWHL(evt) {
    evt.preventDefault();
    const dir = Math.sign(evt.deltaY);
    if (dir > 0)
        r *= this.sensZ;
    else
        r /= this.sensZ;
    _zoomObject();
    notifyCaller();

}

// create controls

let controls;
const cam_ctrl = obj => {
  if (controls) {
    controls.setActive(false);
    obj.lookAt = null; // re-use internal tar
  }
  controls = eval(`new ${obj.type}(obj.cont, obj.cam, obj.lookAt, obj.callback)`);
  controls.sensX *= obj?.sens?.x || 3;
  controls.sensY *= obj?.sens?.y || 3;
  controls.sensP *= obj?.sens?.p || 0.05;
  controls.setActive(true);
};

// create canvas overlay

let sw_st;
const strToElement = str => {
   const template = document.createElement('template');
   template.innerHTML = str;
   return template.content;
};
const get = id => document.getElementById(id);
const makeOverlay = obj => {
   const wrap = '<div id="canv_wrap" class="noselect"></div>';
   const over = '<div id="ctrl_over"><span id="ctrl_tbm"></span><span id="ctrl_lab"></span><span id="ctrl_sw"></span></div>';
   const cont = obj.cont;
   cont.parentNode.insertBefore(strToElement(wrap), cont);
   const canv_wrap = get('canv_wrap');
   canv_wrap.appendChild(cont);
   canv_wrap.appendChild(strToElement(over));
   const ctrl_tbm = get('ctrl_tbm');
   const ctrl_sw = get('ctrl_sw');
   const ctrl_over = get('ctrl_over');

   const getPxValue = v => parseInt(v.slice(0, -2));
   const [stl_cnv, stl_ovr] = [getComputedStyle(cont), getComputedStyle(ctrl_over)];
   const [cnvmb, cnvmr] = [getPxValue(stl_cnv.marginBottom), getPxValue(stl_cnv.marginRight)];
   ctrl_over.style.bottom = getPxValue(stl_ovr.bottom) + cnvmb + 'px';
   ctrl_over.style.right = getPxValue(stl_ovr.right) + cnvmr + 'px';

   get('ctrl_lab').textContent = 'LMB: rotate, RMB: pan, WHL: zoom';
   const tbm = ['Ctrl+LMB: roll, ', ''];

   const sw_states = ['Trackball', 'Orbital'];
   ctrl_sw.textContent = `use ${sw_states[sw_st]} mode`;
   ctrl_sw.addEventListener('click', evt => {
      obj.type = sw_states[sw_st];
      cam_ctrl(obj); // Trackball, Orbital
      ctrl_tbm.textContent = tbm[sw_st];
      sw_st ^= 1;
      evt.target.textContent = `use ${sw_states[sw_st]} mode`;
   });
};

// external calls

const reset = (x, y, z) => {
   const cpos = obj?.position;
   if (cpos) {
      tar = [x, y, z];
      obj.lookAt(...tar);
      r = vectLength([cpos.x - tar[0], cpos.y - tar[1], cpos.z - tar[2]]);
   }
};

const create = obj => {
   cam_ctrl(obj);
   if (obj.overlay) {
      sw_st = obj.type == 'Trackball' ? 1 : 0;
      makeOverlay(obj);
   }
};

export { Trackball, Orbital, Translate, create, reset }
