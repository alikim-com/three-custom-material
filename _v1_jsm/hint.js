import { get, addUI } from '/_v1_jsm/ui.js'

let hint, hints;

const styleToInt = str => parseInt(str.slice(0, -2));

const updateHint = (id, cont, mode) => {
   hint.classList.toggle('none', !mode);
  // if (!cont.style) cont.style = 'cursor:auto;';
   cont.style.cursor = mode ? 'pointer' : 'auto';
	if(mode) hint.textContent = hints[id];
};

const addHint = (cont, _hints, elems = []) => {

   hints = _hints;

   addUI('<div id="hint" class="mono s12 noselect none"> </div>', cont);

   hint = get('hint');
   const hstl = getComputedStyle(hint);
   const mh = styleToInt(hstl.marginLeft) + styleToInt(hstl.marginRight);
   const mv = styleToInt(hstl.marginTop) + styleToInt(hstl.marginBottom);

   cont.addEventListener('mousemove', evt => {
      const [cw, ch] = [cont.clientWidth, cont.clientHeight];
      const [w, h] = [hint.clientWidth + mh, hint.clientHeight + mv];
      const [left, top] = [evt.clientX, evt.clientY];
      const [right, bot] = [left + w, top + h];
      if (right < cw) hint.style.left = left + 'px';
      if (bot < ch) hint.style.top = top + 'px';
   });

   for (const elem of elems) {
      elem.addEventListener('mouseover', evt => { updateHint(evt.target.id, cont, true) });
      elem.addEventListener('mouseout', evt => { updateHint(evt.target.id, cont, false) });
   }

};

export { addHint, updateHint }