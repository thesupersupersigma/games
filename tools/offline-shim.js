/* Runs first in every game of the offline download (see tools/offline.mjs).
 *
 * Opened from disk (file://), browsers refuse fetch/XHR, refuse workers built from
 * files, and "taint" canvases that draw disk images. The game's files are embedded
 * as base64 in offline.js instead, and this hands them out (as bytes or data: URLs,
 * which have none of those limits) wherever the game asks for a URL in its folder.
 *
 * files: { "path/in/game": base64 }
 * root:  the game folder's URL, with a trailing slash
 * dir:   folder (relative to root) that relative URLs resolve against */
(function boot(files, root, dir) {
  var g = self;
  var MIME = {
    js: 'text/javascript', wasm: 'application/wasm', json: 'application/json', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    ico: 'image/x-icon', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', woff: 'font/woff',
    woff2: 'font/woff2', glb: 'model/gltf-binary', swf: 'application/x-shockwave-flash',
  };
  var mime = function (k) { return MIME[k.split('.').pop().toLowerCase()] || 'application/octet-stream'; };

  // URL -> "path/in/game" if it is one of the embedded files, else null.
  function key(u) {
    try {
      var href = new URL(typeof u === 'object' && u.url ? u.url : String(u), root + dir).href.split(/[?#]/)[0];
      var k = href.indexOf(root) === 0 ? decodeURIComponent(href.slice(root.length)) : null;
      return k !== null && Object.prototype.hasOwnProperty.call(files, k) ? k : null;
    } catch (e) {
      return null;
    }
  }
  function dataURL(u) {
    var k = key(u);
    return k === null ? null : 'data:' + mime(k) + ';base64,' + files[k];
  }
  function bytes(k) {
    var bin = atob(files[k]), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var realFetch = g.fetch;
  g.fetch = function (input, init) {
    var k = key(input);
    if (k === null) return realFetch.apply(this, arguments);
    var method = (init && init.method) || (typeof input === 'object' && input.method) || 'GET';
    var body = method.toUpperCase() === 'HEAD' ? null : new Blob([bytes(k)], { type: mime(k) });
    var res = new Response(body, { status: 200, headers: { 'Content-Type': mime(k) } });
    // Some players (Ruffle) read the file's own URL back from the response.
    Object.defineProperty(res, 'url', { value: root + encodeURI(k) });
    return Promise.resolve(res);
  };

  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, u) {
    arguments[1] = dataURL(u) || u;
    return open.apply(this, arguments);
  };

  if (g.importScripts) {
    var importScripts = g.importScripts;
    g.importScripts = function () {
      for (var i = 0; i < arguments.length; i++) {
        var k = key(arguments[i]);
        // Global eval behaves like importScripts, and a worker can't load data: or blob: scripts from file://.
        if (k === null) importScripts(arguments[i]);
        else (0, eval)(new TextDecoder().decode(bytes(k)) + '\n//# sourceURL=' + root + k);
      }
    };
  }

  if (!g.document) return; // the rest only exists in a page

  // Elements fed a URL by script (img.src = ..., script.src = ...). Markup in index.html
  // still loads from disk, which is fine for display.
  [g.HTMLImageElement, g.HTMLMediaElement, g.HTMLScriptElement, g.HTMLSourceElement].forEach(function (El) {
    var d = El && Object.getOwnPropertyDescriptor(El.prototype, 'src');
    if (!d) return;
    Object.defineProperty(El.prototype, 'src', {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set: function (v) {
        d.set.call(this, dataURL(v) || v);
      },
    });
  });

  var RealAudio = g.Audio;
  g.Audio = function Audio(u) {
    return u === undefined ? new RealAudio() : new RealAudio(dataURL(u) || u);
  };
  g.Audio.prototype = RealAudio.prototype;

  // A worker made from an embedded script runs this same shim first, then the script.
  var RealWorker = g.Worker;
  g.Worker = function Worker(u, options) {
    var k = key(u);
    if (k === null) return new RealWorker(u, options);
    var src =
      '(' + boot + ')(' + JSON.stringify(files) + ',' + JSON.stringify(root) + ',' +
      JSON.stringify(k.replace(/[^/]*$/, '')) + ');\n' + new TextDecoder().decode(bytes(k));
    return new RealWorker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), options);
  };
  g.Worker.prototype = RealWorker.prototype;
})
