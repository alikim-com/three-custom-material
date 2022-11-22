import {	get, addUI } from '/_v1_jsm/ui.js'

function PageLoader() { }

PageLoader.prototype.init = function (cfg) {
	this.cont = cfg.cont;
	return this;
}

PageLoader.prototype.attach = function(_cls) {
	const cls = _cls ? ` class="${_cls}"` : '';
	const str =
`<div id="preloader"${cls}>
	<div id="ld1" class="ld"></div>
	<div id="ld2" class="ld"></div>
	<div id="ld3" class="ld"></div>
	<div id="ld4" class="ld"></div>
	<label id="prelab"> </label>
</div>`;
	addUI(str, this.cont);
	['preloader', 'prelab'].forEach(nm => { this[nm] = get(nm) });
	return this;
}

PageLoader.prototype.detach = function() {
	const elem = this.preloader;
	if (elem) elem.parentNode.removeChild(elem);
	return this;
}

PageLoader.prototype.setlabel = function(str) {
	this.prelab.textContent = str;
	return this;
}

PageLoader.prototype.fadein = function() {
	this.preloader.classList.add('fadein');
	return this;
}

PageLoader.prototype.fadeout = function(det = false) {
	this.preloader.classList.add('fadeout');
	if (det) setTimeout(this.detach, 1050);
	return this;
}

PageLoader.prototype.hide = function() {
	this.preloader.classList.add('hide');
	return this;
}

PageLoader.prototype.show = function() {
	this.preloader.classList.remove('hide');
	return this;
}

export {	PageLoader }