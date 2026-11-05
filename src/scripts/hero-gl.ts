// The hero's peeling print, in raw WebGL 2 (≈7 KB). Only the background is drawn here — the
// wordmark, the cutout, its shadow and the cut line are DOM/SVG layers above the canvas, so the
// depth effect (subject in front of the word, word in front of the background) is exact.
//
// World units: the photo frame is 1 high and AR wide, centred at the origin, y up.
//   ground  the transparency grid inside the frame's rounded rectangle, with a contact shadow
//           along the fold while the print comes off
//   sheet   the photo, with a hole where CutOut's matte says the subject is; its bottom-right
//           corner curls back like a print peeled off its backing (white paper underside), then
//           the whole sheet slides away and fades
// Every frame is a pure function of (lift, peel), so scrolling back plays it in reverse.

type Mat4 = Float32Array;
export interface PrintState {
  lift: number;
  peel: number;
}

const CURL_R = 0.05;
const GRID = 96;
const LIGHT = (() => {
  const v = [-0.45, 0.6, 1.0];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / l);
})();

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeIn = (t: number) => t * t * t;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

const RRECT = /* glsl */ `
float rrect(vec2 p, vec2 half_, float r) {
  vec2 q = abs(p) - (half_ - vec2(r));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}`;

const GROUND_VS = /* glsl */ `#version 300 es
in vec2 a_pos;
uniform mat4 u_mvp;
uniform vec2 u_half;
out vec2 v_p;
void main() {
  v_p = a_pos * u_half;
  gl_Position = u_mvp * vec4(v_p, -0.0005, 1.0);
}`;

const GROUND_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_p;
uniform vec2 u_half;
uniform float u_radius;
uniform float u_cell;
uniform float u_axis;
uniform vec2 u_n;
uniform float u_fold;
out vec4 o;
${RRECT}
void main() {
  float d = rrect(v_p, u_half, u_radius);
  // fwidth can be exactly 0 on the rectangle's diagonal (its distance field's ridge); smoothstep
  // with equal edges is undefined, so keep the antialiasing width above zero.
  float fw = max(fwidth(d), 1e-4);
  float inside = 1.0 - smoothstep(-fw, fw, d);
  if (inside <= 0.0) discard;
  vec2 cell = floor((v_p * vec2(1.0, -1.0) + u_half) / u_cell);
  float c = mod(cell.x + cell.y, 2.0);
  vec3 col = mix(vec3(0.090, 0.090, 0.114), vec3(0.059, 0.059, 0.075), c);
  float s = dot(v_p, u_n) - u_axis;
  col *= 1.0 - 0.45 * u_fold * exp(-abs(s) / 0.05);
  // Hairline edge.
  col += vec3(0.06) * (1.0 - smoothstep(0.0, 0.004, abs(d + 0.002)));
  o = vec4(col * inside, inside);
}`;

const SHEET_VS = /* glsl */ `#version 300 es
in vec2 a_uv;
uniform mat4 u_mvp;
uniform float u_ar;
uniform float u_axis;
uniform vec2 u_n;
uniform float u_r;
uniform vec2 u_slide;
out vec2 v_uv;
out vec3 v_nrm;
out vec3 v_pos;
out float v_s;
out float v_theta;
void main() {
  vec2 p = vec2((a_uv.x - 0.5) * u_ar, 0.5 - a_uv.y);
  float s = dot(p, u_n) - u_axis;
  vec3 pos = vec3(p, 0.0);
  vec3 nrm = vec3(0.0, 0.0, 1.0);
  float theta = 0.0;
  if (s > 0.0) {
    vec2 base = p - u_n * s;
    theta = s / u_r;
    if (theta < 3.14159265) {
      pos.xy = base + u_n * (u_r * sin(theta));
      pos.z = u_r * (1.0 - cos(theta));
      nrm = vec3(-u_n * sin(theta), cos(theta));
    } else {
      pos.xy = base - u_n * (s - 3.14159265 * u_r);
      pos.z = 2.0 * u_r;
      nrm = vec3(0.0, 0.0, -1.0);
    }
  }
  pos.xy += u_slide;
  v_uv = a_uv;
  v_nrm = nrm;
  v_pos = pos;
  v_s = s;
  v_theta = theta;
  gl_Position = u_mvp * vec4(pos, 1.0);
}`;

const SHEET_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_nrm;
in vec3 v_pos;
in float v_s;
in float v_theta;
uniform sampler2D u_photo;
uniform sampler2D u_subject;
uniform vec4 u_crop;      // uv scale (xy) and offset (zw) for cover-fit cropping
uniform vec3 u_eye;
uniform vec3 u_light;
uniform float u_ar;
uniform float u_hole;
uniform float u_alpha;
uniform float u_radius;
uniform float u_fold;
out vec4 o;
${RRECT}
void main() {
  vec2 p = vec2((v_uv.x - 0.5) * u_ar, 0.5 - v_uv.y);
  float d = rrect(p, vec2(u_ar * 0.5, 0.5), u_radius);
  float fw = max(fwidth(d), 1e-4); // see GROUND_FS
  float edge = 1.0 - smoothstep(-fw, fw, d);
  vec2 tuv = v_uv * u_crop.xy + u_crop.zw;
  float matte = texture(u_subject, tuv).a;
  float a = edge * (1.0 - u_hole * matte) * u_alpha;
  if (a < 0.002) discard;
  vec3 view = normalize(u_eye - v_pos);
  bool front = dot(v_nrm, view) >= 0.0;
  vec3 n = front ? v_nrm : -v_nrm;
  float lambert = max(dot(n, u_light), 0.0) / u_light.z;
  float spec = pow(max(dot(reflect(-u_light, n), view), 0.0), 30.0) * step(0.001, v_theta);
  vec3 col;
  if (front) {
    col = texture(u_photo, tuv).rgb * clamp(0.6 + 0.4 * lambert, 0.5, 1.05);
    float flat_ = 1.0 - step(0.001, v_theta);
    col *= 1.0 - flat_ * 0.25 * u_fold * exp(-abs(v_s) / 0.04);
    col += spec * 0.15;
  } else {
    // The back of a photographic print: white paper.
    col = vec3(0.95, 0.95, 0.96) * (0.55 + 0.5 * lambert) + spec * 0.35;
  }
  o = vec4(col * a, a);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    p,
    a: (n: string) => gl.getAttribLocation(p, n),
    u: (n: string) => {
      if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n));
      return cache.get(n)!;
    },
  };
}

function loadImage(src: string) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
}

function texture(gl: WebGL2RenderingContext, img: HTMLImageElement) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export async function createPrint(canvas: HTMLCanvasElement, poster: HTMLImageElement, frame: HTMLElement) {
  const ctx = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false });
  if (!ctx) throw new Error('WebGL 2 unavailable');
  const gl: WebGL2RenderingContext = ctx;

  // The photo texture is exactly the poster's chosen file (cached); the matte comes from the
  // matching cutout file.
  const photoUrl = poster.currentSrc || poster.src;
  const size = /photo-(\d+)/.exec(photoUrl)?.[1] ?? '1400';
  const format = /\.avif(\?|$)/.test(photoUrl) ? 'avif' : 'webp';
  const [photoImg, subjectImg] = await Promise.all([
    loadImage(photoUrl),
    loadImage(canvas.getAttribute(`data-subject-${size}-${format}`) ?? canvas.getAttribute(`data-subject-1400-webp`)!),
  ]);
  const imgAR = photoImg.naturalWidth / photoImg.naturalHeight;
  await nextFrame();

  const ground = compile(gl, GROUND_VS, GROUND_FS);
  const sheet = compile(gl, SHEET_VS, SHEET_FS);
  await nextFrame();
  const photoTex = texture(gl, photoImg);
  await nextFrame();
  const subjectTex = texture(gl, subjectImg);
  await nextFrame();

  const groundVao = gl.createVertexArray()!;
  gl.bindVertexArray(groundVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(ground.a('a_pos'));
  gl.vertexAttribPointer(ground.a('a_pos'), 2, gl.FLOAT, false, 0, 0);

  const sheetVao = gl.createVertexArray()!;
  gl.bindVertexArray(sheetVao);
  const uv = new Float32Array((GRID + 1) * (GRID + 1) * 2);
  for (let y = 0, i = 0; y <= GRID; y++) for (let x = 0; x <= GRID; x++) (uv[i++] = x / GRID), (uv[i++] = y / GRID);
  const idx = new Uint16Array(GRID * GRID * 6);
  for (let y = 0, i = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const a = y * (GRID + 1) + x, b = a + 1, c = a + GRID + 1, d = c + 1;
      idx.set([a, c, b, b, c, d], i);
      i += 6;
    }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(sheet.a('a_uv'));
  gl.vertexAttribPointer(sheet.a('a_uv'), 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  let last: PrintState | null = null;
  let lastKey = '';

  // Geometry follows the DOM: the canvas covers the viewport; the photo frame sits inside it.
  let ar = 1, halfW = 0.6, halfH = 0.6, framePx = 600, offX = 0, offY = 0, dirty = true;
  const resize = () => {
    const c = canvas.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    if (!f.height) return;
    ar = f.width / f.height;
    framePx = f.height;
    halfW = c.width / f.height / 2;
    halfH = c.height / f.height / 2;
    // Frame centre relative to the canvas centre, in frame heights (y up).
    offX = (f.left + f.width / 2 - (c.left + c.width / 2)) / f.height;
    offY = -(f.top + f.height / 2 - (c.top + c.height / 2)) / f.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const w = Math.round(c.width * dpr), h = Math.round(c.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    dirty = true;
    if (last) draw(last);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let lostCb: (() => void) | null = null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lostCb?.();
  });

  function draw(s: PrintState) {
    last = s;
    const key = `${s.lift.toFixed(4)}|${s.peel.toFixed(4)}|${canvas.width}x${canvas.height}`;
    if (key === lastKey && !dirty) return;
    lastKey = key;
    dirty = false;

    const D = 3.2;
    const proj = perspective(2 * Math.atan(halfH / D), halfW / halfH, 1.5, 6);
    // Camera straight on the frame, so the sheet's hole stays aligned with the DOM cutout.
    // model = translate(offX, offY, -D); camera straight on, so the sheet's hole stays aligned
    // with the DOM cutout.
    const mvp = new Float32Array(proj);
    mvp[12] = proj[0] * offX;
    mvp[13] = proj[5] * offY;
    mvp[14] = proj[10] * -D + proj[14];
    mvp[15] = proj[11] * -D + proj[15];
    const eye = [-offX, -offY, D];

    // Peel direction: towards the frame's bottom-right corner.
    const cx = ar / 2, cy = -0.5, cl = Math.hypot(cx, cy);
    const n = [cx / cl, cy / cl];
    // The corner curls back, then the print is pulled away along the same diagonal — right off
    // the screen — while it keeps curling.
    const curl = easeInOut(span(s.peel, 0, 0.7));
    const axis = cl + 0.02 - curl * cl * 1.05;
    const away = easeIn(span(s.peel, 0.3, 1));
    const reach = Math.hypot(halfW + Math.abs(offX), halfH + Math.abs(offY)) * 2.2;
    const slide = [n[0] * away * reach, n[1] * away * reach];
    const alpha = 1 - span(s.peel, 0.92, 1);
    const fold = s.peel > 0 ? span(s.peel, 0, 0.08) * (1 - span(s.peel, 0.3, 0.6)) : 0;
    const hole = clamp(s.lift * 6);
    const radius = 22 / framePx;
    // Cover-fit crop of the photo into the frame.
    const crop = ar < imgAR ? [ar / imgAR, 1, (1 - ar / imgAR) / 2, 0] : [1, imgAR / ar, 0, (1 - imgAR / ar) / 2];

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(ground.p);
    gl.bindVertexArray(groundVao);
    gl.uniformMatrix4fv(ground.u('u_mvp'), false, mvp);
    gl.uniform2f(ground.u('u_half'), ar / 2, 0.5);
    gl.uniform1f(ground.u('u_radius'), radius);
    gl.uniform1f(ground.u('u_cell'), 32 / framePx);
    gl.uniform1f(ground.u('u_axis'), axis + slide[0] * n[0] + slide[1] * n[1]);
    gl.uniform2f(ground.u('u_n'), n[0], n[1]);
    gl.uniform1f(ground.u('u_fold'), fold);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (alpha > 0.001) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(sheet.p);
      gl.bindVertexArray(sheetVao);
      gl.uniformMatrix4fv(sheet.u('u_mvp'), false, mvp);
      gl.uniform1f(sheet.u('u_ar'), ar);
      gl.uniform1f(sheet.u('u_axis'), axis);
      gl.uniform2f(sheet.u('u_n'), n[0], n[1]);
      gl.uniform1f(sheet.u('u_r'), CURL_R);
      gl.uniform2f(sheet.u('u_slide'), slide[0], slide[1]);
      gl.uniform4f(sheet.u('u_crop'), crop[0], crop[1], crop[2], crop[3]);
      gl.uniform3f(sheet.u('u_eye'), eye[0], eye[1], eye[2]);
      gl.uniform3f(sheet.u('u_light'), LIGHT[0], LIGHT[1], LIGHT[2]);
      gl.uniform1f(sheet.u('u_hole'), hole);
      gl.uniform1f(sheet.u('u_alpha'), alpha);
      gl.uniform1f(sheet.u('u_radius'), radius);
      gl.uniform1f(sheet.u('u_fold'), fold);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, photoTex);
      gl.uniform1i(sheet.u('u_photo'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, subjectTex);
      gl.uniform1i(sheet.u('u_subject'), 1);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  return {
    draw,
    onLost(cb: () => void) {
      lostCb = cb;
    },
    destroy() {
      ro.disconnect();
    },
  };
}
