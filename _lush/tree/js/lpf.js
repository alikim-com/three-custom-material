import * as THREE from '/_v1_jsm/three.module.js'

import { makeBuffGeomFromFXG, parseFXG, makeAdaptivePoints } from '/_v1_jsm/flash.js'

import { loadAssets } from '/_v1_jsm/network.js'

import { log } from '/_v1_jsm/utils.js'

const texldr = new THREE.TextureLoader();

const toload = {mr: [
   ['/_lush/tree/data/leaves.txt', 'o_leaves_data'],
   ['/_lush/tree/data/petals.txt', 'o_petals_data'],
]};

let assets;
const resolve = ass => { assets = ass };
const reject = obj => { console.log(obj) };
const async_promise = { resolve, reject };

// wait for assets
await new Promise((resolve, reject) => { loadAssets({resolve, reject}, toload) })
   .then(_assets => { assets = _assets })
   .catch(obj => { log(obj) });

// wait inside Leaf, Petal constr
// loadAssets(async_promise, toload);

const LeafGeom = (obj, type = 'leaves') => {
   //['name', 'src', 'quality', 'makeZ']
 
   const src = obj.src || assets[type].data[obj.name];
   const [geo, rgb] = makeBuffGeomFromFXG(src, obj.quality, obj.makeZ, obj.bisecDist);
   return { geo, rgb, src };
};

const PetalGeom = obj => LeafGeom(obj, 'petals');

const sync_constr = (_this, obj, type) => {
   ['name', 'src', 'quality', 'makeZ', 'mat', 'map', 'texCB', 'texCE', 'meshname'].forEach(
      nm => { _this[nm] = obj[nm] }
   );

   _this.src = _this.src || assets[type].data[_this.name];

   const [ge, clr] = makeBuffGeomFromFXG(_this.src, _this.quality, _this.makeZ);
   const ma = new _this.mat({
      color: clr || 0xffffff,
      side: THREE.DoubleSide,
      map: texldr.load(
         _this.map,
         _this.texCB,
         undefined,
         _this.texCE)
   });
   _this.mesh = new THREE.Mesh( ge, ma );
   _this.mesh.name = _this.meshname;
};

function Leaf(obj) {

   const type = 'leaves';

   if(!assets)
   return (async () => {

      await new Promise((res, rej) => {
         async_promise.resolve = obj => { resolve(obj); res(); };
         async_promise.reject = obj => { reject(obj); rej(); };
      })
         .then(sync_constr(this, obj, type))
         .catch(() => {});

		return this;
	})();

   sync_constr(this, obj, type);
}

const LatheGeom = obj => {

   const paths = parseFXG(obj.src);
   for (let p of paths) p.quality = p.quality || obj.quality;
   const [shapes,] = makeAdaptivePoints(paths);

   return shapes;
}

export { LeafGeom, PetalGeom, LatheGeom }