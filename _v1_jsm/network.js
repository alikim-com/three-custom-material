const makeRequest = (url, ind = '', method = 'GET', delay = 0, headers = null, data = '') => {
	return new Promise(function (resolve, reject) {
		const xhr = new XMLHttpRequest();
		xhr.open(method, url);
		if (headers) for (let h in headers) xhr.setRequestHeader(h, headers[h]);
		if (method == 'POST') xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

		xhr.onload = function () {
			if (this.status >= 200 && this.status < 300) {
				resolve({
					data: xhr.response,
					ind
				});
			} else {
				reject({
					url: url,
					status: this.status,
					statusText: xhr.statusText,
					data: xhr.response,
					ind
				});
			}
		};
		xhr.onerror = function () {
			reject({
				url: url,
				status: this.status,
				statusText: xhr.statusText,
				data: xhr.response,
				ind
			});
		};
		const delayedSend = () => {
			xhr.send(data)
		}
		if (delay > 0) setTimeout(delayedSend, delay);
		else xhr.send(data);
	});
};

const loadAssets = (async_prom, toload) => {
	const assets = {};
	const promises = [];

   const assetsLoaded = res => {
		for(let i = 0; i < res.length; i++) {
			const obj = res[i];
			if (obj.status == 'rejected') {
				const err = obj.reason;
				async_prom.reject?.({
					src: 'assetsLoaded()', 
					err: `loadAssets() error: <${err.url}> status: ${err.status}, "${err.statusText}"`,
					data: err.data });
				return;
			}
			else if (obj.status == 'fulfilled') {
				const val = obj.value;
				const [type, grp, name] = val.ind.split('_');
				assets[grp] = assets[grp] || {};

				if (type == 'g') { // glsl
					const reg = /<script[\w\W]+?id="([^"]+)">([\w\W]+?)<\/script>/g;
					const str = val.data;
					let marr;
               while ((marr = reg.exec(str)) != null) {
                  const id = marr[1];
                  assets[grp][id] = `// ID: ${id} ->\n${marr[2]}\n // <- ID: ${id}\n`;
               }

				} else if (type == 't') { // textures
					assets[grp][name] = val.data;
				
				} else if (type == 's') { // template
					assets[grp][name] = val.data;

				} else if (type == 'm') { // manifest
					assets[grp][name] = val.data;
				
            } else if (type == 'o') { // data object
					assets[grp][name] = eval(`(${val.data})`);
            
            } else if (type == 'e') { // ext promise
               assets[grp] = val.data;
            }
			}
		}

		async_prom.resolve?.(assets);
	};

	toload?.mr?.forEach(arr => { promises.push(makeRequest(...arr)) }); // url, type, ...
   toload?.pr?.forEach(p => { promises.push(p) }); // ext promises

   Promise.allSettled(promises)
      .then(assetsLoaded)
      .catch(err => { async_prom.reject?.({ src: 'loadAssets()', err }) });
};

export { makeRequest, loadAssets }