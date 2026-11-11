/* background.js: the animated backdrop on <canvas id="bg">.
 *
 * Preferred: one WebGL fragment shader drawing, per pixel:
 *   - "domain-warped" noise (noise fed into itself) for the slow flowing colour clouds
 *   - aurora ribbons (a sine wave bent by that noise)
 *   - a synthwave floor grid below a glowing horizon line
 *   - a soft glow that follows the cursor, a vignette, and a little dithering
 * Fallback (no WebGL): three drifting colour blobs on a tiny 2D canvas scaled up by CSS.
 *
 * Cost control: quality sets the render resolution and the number of noise octaves, low
 * quality draws every second frame, reduced motion draws ONE still frame, "off" hides the
 * canvas (the CSS gradient on <body> shows instead).
 */

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;   // canvas size in pixels
uniform float u_t;    // time in seconds
uniform vec2 u_m;     // mouse, 0..1
uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3;   // theme colours
uniform float u_oct;  // noise octaves (detail level)

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= u_oct) break;
    v += a * noise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;          // centred, aspect-correct
  vec2 m = (u_m - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float t = u_t * 0.05;
  float md = exp(-3.0 * length(p - m));                         // glow around the cursor

  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, -t * 1.3)));
  float n = fbm(p * 1.7 + 2.4 * q + md * 0.5 + vec2(t * 0.7, -t * 0.4));
  float rib = smoothstep(0.15, 1.0, sin((p.y + n * 0.9 + q.x * 0.6) * 5.5 + u_t * 0.12));

  vec3 col = vec3(0.012, 0.016, 0.04);
  col += u_c1 * n * n * 0.5;
  col += u_c2 * rib * (0.2 + 0.6 * q.y) * 0.45;
  col += u_c3 * pow(q.x, 3.0) * 0.8;
  col += u_c1 * md * 0.1;

  float d = -0.2 - p.y;                                          // distance below the horizon
  col += u_c3 * exp(-abs(d) * 22.0) * 0.2;                       // horizon glow
  if (d > 0.0) {
    float z = 0.22 / d;                                          // fake depth
    vec2 g = abs(fract(vec2(p.x * z * 2.2, z + u_t * 0.3)) - 0.5);
    float w = 0.008 * z + 0.004;                                 // thinner lines far away
    float line = smoothstep(0.5 - w, 0.5, max(g.x, g.y));
    col = mix(col, col * 0.3, smoothstep(0.0, 0.1, d));
    col += u_c2 * line * smoothstep(0.02, 0.2, d) * 0.38;
  }

  col *= 1.0 - 0.45 * dot(p, p);                                 // vignette
  col += (hash(gl_FragCoord.xy + fract(u_t)) - 0.5) / 128.0;     // dither to hide banding
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const SCALE = [0, 0.4, 0.6, 0.85]; // render resolution per quality level
const OCTAVES = [0, 3, 4, 5];

export function init(ctx) {
  let cv = document.getElementById('bg');
  let gl = null, c2d = null, uni = {}, lost = false;
  let colors = ctx.u.themeColors();
  let time = Math.random() * 40, dirty = true, skip = false, mx = 0.5, my = 0.5;

  function setupGL() {
    try {
      gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch { gl = null; }
    if (!gl) return false;
    try {
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'shader link failed');
      gl.useProgram(prog);
      // One big triangle that covers the whole screen (cheaper than two).
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const name of ['u_res', 'u_t', 'u_m', 'u_c1', 'u_c2', 'u_c3', 'u_oct']) uni[name] = gl.getUniformLocation(prog, name);
      return true;
    } catch (err) {
      console.warn('[games] background shader unavailable, using the 2D fallback', err);
      gl = null;
      // A canvas that already handed out a WebGL context can't give a 2D one: swap it.
      const fresh = cv.cloneNode(false);
      cv.replaceWith(fresh);
      cv = fresh;
      return false;
    }
  }

  function resize() {
    const s = SCALE[ctx.q()] || SCALE[1];
    const w = gl ? Math.max(2, Math.round(innerWidth * s)) : 96;
    const h = gl ? Math.max(2, Math.round(innerHeight * s)) : Math.max(2, Math.round((96 * innerHeight) / innerWidth));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
      if (gl) gl.viewport(0, 0, w, h);
    }
    dirty = true;
  }

  function draw() {
    if (gl) {
      gl.uniform2f(uni.u_res, cv.width, cv.height);
      gl.uniform1f(uni.u_t, time);
      gl.uniform2f(uni.u_m, mx, 1 - my);
      gl.uniform3fv(uni.u_c1, colors[0].map((v) => v / 255));
      gl.uniform3fv(uni.u_c2, colors[1].map((v) => v / 255));
      gl.uniform3fv(uni.u_c3, colors[2].map((v) => v / 255));
      gl.uniform1f(uni.u_oct, OCTAVES[ctx.q()] || 3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    const w = cv.width, h = cv.height;
    c2d.fillStyle = '#05060d';
    c2d.fillRect(0, 0, w, h);
    colors.forEach((c, i) => {
      const x = w * (0.5 + 0.38 * Math.sin(time * 0.11 + i * 2.1));
      const y = h * (0.45 + 0.3 * Math.cos(time * 0.09 + i * 1.7));
      const g = c2d.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.6);
      g.addColorStop(0, `rgba(${c.join(',')},.34)`);
      g.addColorStop(1, `rgba(${c.join(',')},0)`);
      c2d.fillStyle = g;
      c2d.fillRect(0, 0, w, h);
    });
  }

  if (!setupGL()) c2d = cv.getContext('2d');
  ctx.stats.renderer = gl ? 'webgl' : '2d fallback';

  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  cv.addEventListener('webglcontextrestored', () => { lost = false; uni = {}; if (setupGL()) resize(); });
  addEventListener('resize', resize, { passive: true });
  ctx.on('quality', resize);
  ctx.on('settings', () => { colors = ctx.u.themeColors(); dirty = true; });
  resize();

  ctx.loop.add((dt) => {
    const q = ctx.q();
    if (q === 0 || lost) return;
    const still = ctx.reduced();
    if (still) {
      if (!dirty) return; // one frame is enough when motion is reduced
    } else {
      time += dt;
      const k = Math.min(1, dt * 2);
      mx += (ctx.pointer.x / innerWidth - mx) * k;
      my += (ctx.pointer.y / innerHeight - my) * k;
      if (q === 1 && (skip = !skip)) return; // low quality: 30 fps is plenty for clouds
    }
    draw();
    dirty = false;
  });
}
