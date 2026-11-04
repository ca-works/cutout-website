// The signature scene, in raw WebGL 2 (≈10 KB; see docs/ARCHITECTURE.md for why not Three.js).
//
// World: the photo is a 1 × 1 sheet in the plane z = 0, y up, viewed by a perspective camera.
//   ground   the transparent canvas — a checkerboard — with the subject's shadow and the print's
//            own drop shadow around it
//   sheet    the photo with a subject-shaped hole (alpha = 1 − CutOut's matte); its corner curls
//            like a sticker backing (icon motif: violet underside), then the sheet slides away
//   subject  CutOut's actual cutout, lifted above the sheet
//   line     the cut: marching ants along the subject's traced outline
//
// Every frame is a pure function of SceneState, so scrolling back plays the story in reverse.

import contour from '../assets/generated/hero/contour.json';
import { choreograph, clamp, span, type Choreography } from './hero-timeline';

type Mat4 = Float32Array;

const LIFT_Z = 0.1; // subject height in sheet units at lift = 1
const CURL_R = 0.042; // curl radius; 2R stays below LIFT_Z so the flap passes under the subject
const DIAG = Math.SQRT1_2;
const N = [DIAG, -DIAG]; // peel direction: towards the bottom-right corner, as in the icon
const LIGHT = normalize3([-0.45, 0.55, 1.0]);
const GRID = 112;

function normalize3(v: number[]) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / l);
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeIn = (t: number) => t * t * t;

// ------------------------------------------------------------------------- matrices
function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

function model(pitch: number, yaw: number, distance: number): Mat4 {
  const cx = Math.cos(pitch), sx = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  // T(0,0,-d) · Rx(pitch) · Ry(yaw), column-major
  return new Float32Array([cy, sx * sy, -cx * sy, 0, 0, cx, sx, 0, sy, -sx * cy, cx * cy, 0, 0, 0, -distance, 1]);
}

// ------------------------------------------------------------------------- shaders
const COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform mat4 u_mvp;
uniform mat4 u_model;
`;

const RRECT = /* glsl */ `
float rrect(vec2 p, float r) {           // signed distance to the rounded 1x1 rect
  vec2 q = abs(p) - vec2(0.5 - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
`;

const GROUND_VS = COMMON + /* glsl */ `
in vec2 a_pos;
out vec2 v_p;
void main() {
  v_p = a_pos;
  gl_Position = u_mvp * vec4(a_pos, -0.0005, 1.0);
}`;

const GROUND_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_p;
uniform sampler2D u_subject;
uniform float u_lift;
uniform float u_radius;
uniform float u_checks;
uniform vec2 u_shadowDir;
uniform float u_axis;
uniform float u_peel;
uniform vec2 u_n;
out vec4 o;
` + RRECT + /* glsl */ `
void main() {
  float d = rrect(v_p, u_radius);
  float aa = fwidth(d) * 0.75;
  // Drop shadow of the whole print on the page (outside the rect).
  vec2 sp = v_p - vec2(0.012, -0.03);
  float sd = rrect(sp * vec2(1.0, 1.0), u_radius);
  float drop = (1.0 - smoothstep(-0.02, 0.09, sd)) * 0.22 + (1.0 - smoothstep(-0.005, 0.02, rrect(v_p - vec2(0.0, -0.006), u_radius))) * 0.12;
  vec4 outside = vec4(vec3(0.05, 0.06, 0.12) * drop, drop);
  // Transparency grid.
  vec2 uv = vec2(v_p.x + 0.5, 0.5 - v_p.y);
  vec2 cell = floor(uv * u_checks);
  float c = mod(cell.x + cell.y, 2.0);
  vec3 col = mix(vec3(1.0), vec3(0.894, 0.898, 0.918), c);
  // The lifted subject's soft shadow (blurred via the texture's mip chain).
  float h = u_lift;
  float lod = 3.5 + 2.0 * h;
  float sh = textureLod(u_subject, uv - u_shadowDir * h, lod).a;
  col *= 1.0 - sh * 0.34 * h;
  // Contact shadow along the curl line while the sheet is being removed.
  float s = dot(v_p, u_n) - u_axis;
  col *= 1.0 - 0.16 * u_peel * exp(-abs(s) / 0.045);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  o = mix(outside, vec4(col, 1.0), inside);
}`;

const SHEET_VS = COMMON + /* glsl */ `
in vec2 a_uv;
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
  vec2 p = vec2(a_uv.x - 0.5, 0.5 - a_uv.y);
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
uniform vec3 u_eye;          // camera position in sheet space
uniform vec3 u_light;
uniform float u_hole;
uniform float u_alpha;
uniform float u_radius;
uniform float u_lift;
uniform float u_fold;
uniform vec2 u_shadowDir;
uniform vec2 u_n;
out vec4 o;
` + RRECT + /* glsl */ `
void main() {
  vec2 p = vec2(v_uv.x - 0.5, 0.5 - v_uv.y);
  float d = rrect(p, u_radius);
  float edge = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
  float matte = texture(u_subject, v_uv).a;
  float a = edge * (1.0 - u_hole * matte) * u_alpha;
  if (a < 0.002) discard;
  vec3 view = normalize(u_eye - v_pos);
  bool front = dot(v_nrm, view) >= 0.0;
  vec3 n = front ? v_nrm : -v_nrm;
  float lambert = max(dot(n, u_light), 0.0) / u_light.z;
  float spec = pow(max(dot(reflect(-u_light, n), view), 0.0), 28.0) * step(0.001, v_theta);
  vec3 col;
  if (front) {
    col = texture(u_photo, v_uv).rgb;
    col *= clamp(0.62 + 0.38 * lambert, 0.5, 1.06);
    // The lifted subject shades the sheet around its hole; the fold darkens what lies under it.
    float flat_ = 1.0 - step(0.001, v_theta);
    float sh = textureLod(u_subject, v_uv - vec2(u_shadowDir.x, -u_shadowDir.y) * u_lift, 3.5 + 2.0 * u_lift).a;
    col *= 1.0 - flat_ * sh * 0.3 * u_lift;
    col *= 1.0 - flat_ * 0.22 * u_fold * exp(-abs(v_s) / 0.035);
    col += spec * 0.18;
  } else {
    // Underside of the sticker backing: the icon's indigo → violet.
    float g = clamp(dot(p, u_n) * 0.8 + 0.5, 0.0, 1.0);
    col = mix(vec3(0.16, 0.15, 0.48), vec3(0.50, 0.40, 0.98), g);
    col *= 0.55 + 0.5 * lambert;
    col += spec * 0.45 * vec3(0.85, 0.82, 1.0);
  }
  o = vec4(col * a, a);
}`;

const SUBJECT_VS = COMMON + /* glsl */ `
in vec2 a_pos;
uniform float u_z;
out vec2 v_uv;
out vec2 v_p;
void main() {
  v_p = a_pos;
  v_uv = vec2(a_pos.x + 0.5, 0.5 - a_pos.y);
  gl_Position = u_mvp * vec4(a_pos, u_z, 1.0);
}`;

const SUBJECT_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_p;
uniform sampler2D u_subject;
uniform float u_radius;
uniform float u_lift;
out vec4 o;
` + RRECT + /* glsl */ `
void main() {
  float d = rrect(v_p, u_radius);
  float edge = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
  vec4 c = texture(u_subject, v_uv) * edge;   // premultiplied
  // A faint rim light on the lifted cutout's edge, from the same key light.
  float a1 = textureLod(u_subject, v_uv + vec2(-0.004, -0.005), 1.5).a;
  float rim = clamp(c.a - a1, 0.0, 1.0) * 0.35 * u_lift;
  c.rgb += rim * c.a;
  o = c;
}`;

const LINE_VS = COMMON + /* glsl */ `
in vec2 a_pos;
in vec2 a_nrm;
in float a_side;
in float a_u;
uniform float u_z;
uniform float u_width;
out float v_side;
out float v_u;
void main() {
  v_side = a_side;
  v_u = a_u;
  gl_Position = u_mvp * vec4(a_pos + a_nrm * a_side * u_width, u_z, 1.0);
}`;

const LINE_FS = /* glsl */ `#version 300 es
precision highp float;
in float v_side;
in float v_u;
uniform float u_head;     // arc length reached so far
uniform float u_time;
uniform float u_alpha;
out vec4 o;
void main() {
  if (v_u > u_head) discard;
  float w = abs(v_side);
  float headGlow = exp(-pow((u_head - v_u) / 0.025, 2.0));
  float core = 1.0 - smoothstep(0.30, 0.42 + 0.25 * headGlow, w);
  float halo = pow(1.0 - w, 2.0) * (0.22 + 0.6 * headGlow);
  float dash = step(0.5, fract((v_u + u_time * 0.018) / 0.016));
  vec3 violet = vec3(0.39, 0.32, 0.97);
  vec3 col = mix(violet, vec3(1.0), dash * (1.0 - headGlow * 0.4));
  float a = clamp(core + halo * (1.0 - core), 0.0, 1.0) * u_alpha;
  vec3 c = mix(violet * 1.1, col, core / max(core + halo * (1.0 - core), 0.001));
  o = vec4(c * a, a);
}`;

// ------------------------------------------------------------------------- helpers
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
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name));
    return uniforms.get(name)!;
  };
  return { p, u, a: (name: string) => gl.getAttribLocation(p, name) };
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function loadImage(src: string) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
}

function texture(gl: WebGL2RenderingContext, img: HTMLImageElement, aniso: EXT_texture_filter_anisotropic | null) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
  return t;
}

// ------------------------------------------------------------------------- scene
export async function createScene(canvas: HTMLCanvasElement, poster: HTMLImageElement, root: HTMLElement) {
  const ctx = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    powerPreference: 'default',
  });
  if (!ctx) throw new Error('WebGL 2 unavailable');
  const gl: WebGL2RenderingContext = ctx;
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  // The photo texture is exactly the poster's chosen file (already cached); the subject texture
  // matches its size and format.
  const photoUrl = poster.currentSrc || poster.src;
  const size = /photo-1536/.test(photoUrl) ? '1536' : '1024';
  const format = /\.avif(\?|$)/.test(photoUrl) ? 'avif' : 'webp';
  const [photoImg, subjectImg] = await Promise.all([
    loadImage(photoUrl),
    loadImage(canvas.getAttribute(`data-subject-${size}-${format}`)!),
  ]);
  await nextFrame();

  // Heavy GPU work is spread over several frames so no single task blocks input for long.
  const ground = compile(gl, GROUND_VS, GROUND_FS);
  const sheet = compile(gl, SHEET_VS, SHEET_FS);
  await nextFrame();
  const subject = compile(gl, SUBJECT_VS, SUBJECT_FS);
  const line = compile(gl, LINE_VS, LINE_FS);
  await nextFrame();
  const photoTex = texture(gl, photoImg, aniso);
  await nextFrame();
  const subjectTex = texture(gl, subjectImg, aniso);
  await nextFrame();

  // Ground and subject: a quad. The ground quad is larger so the print's shadow fits.
  const quad = (half: number) => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-half, -half, half, -half, -half, half, half, half]), gl.STATIC_DRAW);
    return { vao, b };
  };
  const groundQuad = quad(0.62);
  gl.enableVertexAttribArray(ground.a('a_pos'));
  gl.vertexAttribPointer(ground.a('a_pos'), 2, gl.FLOAT, false, 0, 0);
  const subjectQuad = quad(0.5);
  gl.enableVertexAttribArray(subject.a('a_pos'));
  gl.vertexAttribPointer(subject.a('a_pos'), 2, gl.FLOAT, false, 0, 0);

  // Sheet: a subdivided grid so the curl bends smoothly.
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

  // Cut line: a ribbon along the traced outline with arc length per vertex.
  const pts = contour.points;
  const count = pts.length / 2;
  const P = (i: number) => [pts[2 * i] - 0.5, 0.5 - pts[2 * i + 1]];
  const lineData = new Float32Array(count * 2 * 6);
  let arc = 0;
  for (let i = 0, o = 0; i < count; i++) {
    const p = P(i);
    const a = P(Math.max(0, i - 1)), b = P(Math.min(count - 1, i + 1));
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl, ny = tx / tl;
    if (i > 0) {
      const q = P(i - 1);
      arc += Math.hypot(p[0] - q[0], p[1] - q[1]);
    }
    for (const side of [-1, 1]) {
      lineData.set([p[0], p[1], nx, ny, side, arc], o);
      o += 6;
    }
  }
  const totalArc = arc;
  const lineVao = gl.createVertexArray()!;
  gl.bindVertexArray(lineVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.STATIC_DRAW);
  const stride = 6 * 4;
  const attr = (name: string, size: number, offset: number) => {
    const loc = line.a(name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
  };
  attr('a_pos', 2, 0);
  attr('a_nrm', 2, 2);
  attr('a_side', 1, 4);
  attr('a_u', 1, 5);
  gl.bindVertexArray(null);

  // ---- sizing: the canvas extends past the frame by `inset` on every side ----
  let halfView = 0.66;
  let dpr = 1;
  let frameCss = 600;
  const frameEl = canvas.parentElement!;
  const resize = () => {
    const c = canvas.getBoundingClientRect();
    const f = frameEl.getBoundingClientRect();
    if (!f.width) return;
    frameCss = f.width;
    halfView = c.width / f.width / 2;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(c.width * dpr), h = Math.round(c.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    dirty = true;
  };
  let dirty = true;
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---- pointer parallax (fine pointers only, gentle) ----
  let yawT = 0, pitchT = 0, yaw = 0, pitch = 0;
  if (matchMedia('(pointer: fine)').matches) {
    root.addEventListener(
      'pointermove',
      (e) => {
        const f = frameEl.getBoundingClientRect();
        yawT = clamp(((e.clientX - (f.left + f.width / 2)) / innerWidth) * 2, -1, 1) * 0.045;
        pitchT = clamp(((e.clientY - (f.top + f.height / 2)) / innerHeight) * 2, -1, 1) * 0.035;
      },
      { passive: true },
    );
    root.addEventListener('pointerleave', () => ((yawT = 0), (pitchT = 0)));
  }

  let lost: (() => void) | null = null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost?.();
  });

  let time = 0;
  let lastKey = '';

  function draw(s: Choreography) {
    const D = 3.4;
    const fovy = 2 * Math.atan(halfView / D);
    const proj = perspective(fovy, canvas.width / canvas.height, 1.5, 6);
    const pitchA = -s.tilt + pitch;
    const m = model(pitchA, yaw, D);
    const mvp = multiply(proj, m);
    // Eye position in sheet space: inverse of the rotation applied to (0,0,D).
    const cx = Math.cos(pitchA), sx = Math.sin(pitchA), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const eye = [-D * cx * sy, D * sx, D * cx * cy]; // R^T · (0,0,D)

    const radius = 18 / frameCss; // matches --r-media
    const lift = s.lift;
    const shadowDir = [(-LIGHT[0] / LIGHT[2]) * LIFT_Z, (-LIGHT[1] / LIGHT[2]) * LIFT_Z];
    // Peel: the corner curls back to ~45 % of the diagonal, then the sheet is drawn away.
    const curl = easeInOut(span(s.peel, 0, 0.62));
    const axis = DIAG + 0.02 - curl * 0.66;
    const away = easeIn(span(s.peel, 0.42, 1));
    const slide = [N[0] * away * 0.26, N[1] * away * 0.26];
    const sheetAlpha = 1 - span(s.peel, 0.55, 0.96);
    const hole = clamp(lift * 6);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Ground
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(ground.p);
    gl.bindVertexArray(groundQuad.vao);
    gl.uniformMatrix4fv(ground.u('u_mvp'), false, mvp);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, subjectTex);
    gl.uniform1i(ground.u('u_subject'), 1);
    gl.uniform1f(ground.u('u_lift'), lift);
    gl.uniform1f(ground.u('u_radius'), radius);
    gl.uniform1f(ground.u('u_checks'), Math.max(16, Math.round(frameCss / 14)));
    gl.uniform2f(ground.u('u_shadowDir'), shadowDir[0], -shadowDir[1]);
    gl.uniform1f(ground.u('u_axis'), axis + (slide[0] * N[0] + slide[1] * N[1]));
    gl.uniform1f(ground.u('u_peel'), s.peel > 0 ? sheetAlpha * span(s.peel, 0, 0.1) : 0);
    gl.uniform2f(ground.u('u_n'), N[0], N[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Sheet
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    if (sheetAlpha > 0.001) {
      gl.useProgram(sheet.p);
      gl.bindVertexArray(sheetVao);
      gl.uniformMatrix4fv(sheet.u('u_mvp'), false, mvp);
      gl.uniform1f(sheet.u('u_axis'), axis);
      gl.uniform2f(sheet.u('u_n'), N[0], N[1]);
      gl.uniform1f(sheet.u('u_r'), CURL_R);
      gl.uniform2f(sheet.u('u_slide'), slide[0], slide[1]);
      gl.uniform3f(sheet.u('u_eye'), eye[0], eye[1], eye[2]);
      gl.uniform3f(sheet.u('u_light'), LIGHT[0], LIGHT[1], LIGHT[2]);
      gl.uniform1f(sheet.u('u_hole'), hole);
      gl.uniform1f(sheet.u('u_alpha'), sheetAlpha);
      gl.uniform1f(sheet.u('u_radius'), radius);
      gl.uniform1f(sheet.u('u_lift'), lift);
      gl.uniform1f(sheet.u('u_fold'), span(s.peel, 0, 0.08));
      gl.uniform2f(sheet.u('u_shadowDir'), shadowDir[0], shadowDir[1]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, photoTex);
      gl.uniform1i(sheet.u('u_photo'), 0);
      gl.uniform1i(sheet.u('u_subject'), 1);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }

    // Subject
    gl.depthMask(false);
    gl.useProgram(subject.p);
    gl.bindVertexArray(subjectQuad.vao);
    gl.uniformMatrix4fv(subject.u('u_mvp'), false, mvp);
    gl.uniform1f(subject.u('u_z'), lift * LIFT_Z + 0.0006);
    gl.uniform1f(subject.u('u_radius'), radius);
    gl.uniform1f(subject.u('u_lift'), lift);
    gl.uniform1i(subject.u('u_subject'), 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cut line
    const lineAlpha = s.lineAlpha * Math.min(1, s.cut * 20);
    if (lineAlpha > 0.001) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(line.p);
      gl.bindVertexArray(lineVao);
      gl.uniformMatrix4fv(line.u('u_mvp'), false, mvp);
      gl.uniform1f(line.u('u_z'), lift * LIFT_Z + 0.001);
      gl.uniform1f(line.u('u_width'), Math.max(2.6, Math.min(4.2, frameCss / 160)) / frameCss);
      gl.uniform1f(line.u('u_head'), s.cut * totalArc + (s.cut >= 1 ? 1 : 0));
      gl.uniform1f(line.u('u_time'), time);
      gl.uniform1f(line.u('u_alpha'), lineAlpha);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, count * 2);
    }
    gl.bindVertexArray(null);
  }

  return {
    /** Draws the state for progress p; returns true while something is still moving. */
    frame(p: number, dt: number): boolean {
      const s = choreograph(p);
      const k = 1 - Math.exp(-dt / 0.14);
      yaw += (yawT - yaw) * k;
      pitch += (pitchT - pitch) * k;
      const marching = s.lineAlpha * s.cut > 0.001;
      if (marching) time += dt;
      const key = `${p.toFixed(4)}|${yaw.toFixed(4)}|${pitch.toFixed(4)}|${marching ? time.toFixed(3) : ''}|${canvas.width}`;
      if (key !== lastKey || dirty) {
        draw(s);
        lastKey = key;
        dirty = false;
      }
      return marching || Math.abs(yawT - yaw) > 0.0005 || Math.abs(pitchT - pitch) > 0.0005;
    },
    onLost(cb: () => void) {
      lost = cb;
    },
    destroy() {
      ro.disconnect();
    },
  };
}
