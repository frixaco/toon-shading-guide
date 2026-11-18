// The 3D playground: one custom shader that reproduces, in the browser, the math each guide
// state builds in Blender. Numbers (camera, lights, material values) come from the same
// Python that built the .blend files, via generated/scene.json.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import S from './generated/scene.json';

export type Mode = 'ambient' | 'black' | 'lambert' | 'measure' | 'toon2' | 'dot' | 'remap' | 'toon3' | 'toon';
/** Debug views of one intermediate value of the toon tree (white sun, or the spots from step 8). */
export type Show = 'cel' | 'shade' | 'vis' | 'matcap' | 'falloff' | 'rim' | 'weights';
export type Knob = 'hard' | 'matcap' | 'outline' | 'power' | 'rim';
export interface ViewState {
  mode: Mode;
  label: string;
  tex?: boolean; // lambert: multiply by the texture
  stage?: 'ramp' | 'tint' | 'final'; // toon2 / toon3: how far down the node chain
  /** toon: how far through the guide the tree is, e.g. 42 = end of step 4, 91 = step 9 "brightest wins".
   *  40 soft edge · 51 cast shadows · 61 matcap · 70 outline · 80 spotlights · 81 Color Power · 90 cap
   *  91 max · 92 saturation · 100 normal map + rim · 110 Unity camera · 111 fog · 121 vignette · 122 grade · 123 ACES */
  lv?: number;
  show?: Show;
  knob?: Knob; // which slider the section offers
  cam?: 'guide' | 'shot';
  pink?: boolean; // section wants the pink sun on (undefined = no pink sun in this step yet)
  ref?: string; // Blender reference render (white sun only)
  refPink?: string; // Blender reference render with the pink sun
}

const MODES: Mode[] = ['ambient', 'black', 'lambert', 'measure', 'toon2', 'dot', 'remap', 'toon3', 'toon'];
const SHOWS: Show[] = ['cel', 'shade', 'vis', 'matcap', 'falloff', 'rim', 'weights'];
const KNOBS: Record<Knob, { label: string; min: number; max: number; step: number; def: number }> = {
  hard: { label: 'Hardness', min: 0, max: 0.98, step: 0.01, def: 0.688 },
  matcap: { label: 'Matcap strength', min: 0, max: 1, step: 0.01, def: S.matcapInt },
  outline: { label: 'Outline width (cm)', min: 0, max: 1, step: 0.01, def: S.outlineWidth },
  power: { label: 'Color Power', min: 0.02, max: 1, step: 0.01, def: S.colorPower },
  rim: { label: 'Rim threshold', min: 0, max: 1, step: 0.01, def: S.rim.threshold },
};
const SM = 4096, SSM = 2048;
const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
const DEF_DIR = v3(S.lights[0].dir).normalize();
const DEF = {
  az: THREE.MathUtils.radToDeg(Math.atan2(DEF_DIR.x, DEF_DIR.z)),
  el: THREE.MathUtils.radToDeg(Math.asin(DEF_DIR.y)),
  grey: S.shadowGrey,
  th2: S.rampS2,
  th3: S.rampS3,
};
// step 0: Blender's default grey world through AgX; flat colours sampled from s0_dark.png
const AMBIENT_CHAR = 48 / 255;
const AMBIENT_BG = 29 / 255;
const m3 = (r: number[][]) => new THREE.Matrix3().set(...(r.flat() as [number, number, number, number, number, number, number, number, number]));

const vert = /* glsl */ `
attribute vec3 _ut; attribute vec3 _ub;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vT; varying vec3 vB;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  // the exporter writes custom attributes in Blender's Z-up axes; three.js is Y-up
  vT = mat3(modelMatrix) * vec3(_ut.x, _ut.z, -_ut.y);
  vB = mat3(modelMatrix) * vec3(_ub.x, _ub.z, -_ub.y);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform int uMode; uniform int uStage; uniform int uLv; uniform int uShow;
uniform bool uIsFloor; uniform bool uIsSweater; uniform bool uUseTex; uniform sampler2D uTex;
uniform vec3 uL0; uniform vec3 uL1; uniform vec3 uC0; uniform vec3 uC1; uniform float uOn1;
uniform sampler2D uSM0; uniform sampler2D uSM1; uniform mat4 uSMat0; uniform mat4 uSMat1;
uniform sampler2D uSS0; uniform sampler2D uSS1; uniform sampler2D uSS2; uniform mat4 uSSM0; uniform mat4 uSSM1; uniform mat4 uSSM2;
uniform vec3 uSpP[3]; uniform vec3 uSpF[3]; uniform vec3 uSpHd[3]; uniform float uAS; uniform float uAO; uniform float uRS;
uniform float uGrey; uniform float uTh2; uniform float uTh3; uniform float uFloorGrey; uniform vec3 uFloorEmit;
uniform float uHard; uniform float uMcap; uniform float uPower; uniform float uRimTh; uniform float uSat;
uniform sampler2D uMatcapTex; uniform sampler2D uNrmTex;
uniform vec3 uFlat; uniform vec3 uFlatFloor; uniform vec2 uRes;
uniform mat3 uS2AP0; uniform mat3 uAP0AP1; uniform mat3 uAP1S;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vT; varying vec3 vB;

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float pcf(sampler2D sm, mat4 M, vec3 p, float size, float bias) {
  vec4 c = M * vec4(p, 1.0);
  if (c.w <= 0.0) return 1.0;
  vec3 q = c.xyz / c.w * 0.5 + 0.5;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
  float s = 0.0; vec2 t = vec2(1.0 / size);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++)
    s += step(q.z - bias, textureLod(sm, q.xy + vec2(x, y) * t, 0.0).r);
  return s / 9.0;
}
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); } // Blender colour -> number
float ramp(float fac, float pos) { return fac >= pos ? 1.0 : uGrey; }  // Color Ramp, Constant

// ---- the toon tree from step 4 on
float celLo() { return mix(0.3, 1.0, uHard) / 1.51; }
float cel(vec3 N, vec3 L) { return smoothstep(celLo(), 1.0 / 1.51, dot(N, L) * 0.5 + 0.5); }
float spotAtt(int i, vec3 P, out vec3 L) {             // the "HDRP Spot Falloff" group
  vec3 d = uSpP[i] - P; float dist = length(d); L = d / dist;
  float inv = min(1.0 / dist, 100.0);
  float win = clamp(1.0 - pow(dist * dist * uRS, 2.0), 0.0, 1.0);
  float ang = clamp(-dot(L, uSpF[i]) * uAS + uAO, 0.0, 1.0);
  float a = inv * win * ang;
  return a * a;
}
float spotVis(int i, vec3 P) {
  if (i == 0) return pcf(uSS0, uSSM0, P, ${SSM}.0, 0.0006);
  if (i == 1) return pcf(uSS1, uSSM1, P, ${SSM}.0, 0.0006);
  return pcf(uSS2, uSSM2, P, ${SSM}.0, 0.0006);
}
vec3 acesFit(vec3 c) {                                 // Stephen Hill's fit of ACES RRT + sRGB ODT
  const mat3 IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = IN * c;
  v = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
  return OUT * v;
}
vec3 post(vec3 col) {                                  // compositor + view transform, steps 11-12
  if (uLv >= 111) {                                    // HDRP height fog: attenuate by transmittance
    vec3 ray = vW - cameraPosition; float t = length(ray);
    float Hs = 50.0 * 0.144765, tc = min(t, 70.0);
    float k = max(tc * (ray.y / max(t, 1e-6)) / Hs, 1e-4);
    float od = tc * (1.0 - exp(-k)) / k * (1.0 / 80.0) * exp(-cameraPosition.y / Hs);
    col *= exp(-od);
  }
  if (uLv >= 121) {                                    // HDRP vignette
    vec2 d = pow(clamp(abs(gl_FragCoord.xy / uRes - 0.5) * 1.5, 0.0, 1.0), vec2(4.75));
    col *= pow(clamp(1.0 - dot(d, d), 0.0, 1.0), 5.0);
  }
  if (uLv >= 122) {                                    // HDRP colour adjustments (ACES grading space)
    vec3 x = uS2AP0 * (col * pow(2.0, 0.3));
    x = pow(max(x, 0.0) / 0.18, vec3(0.9)) * 0.18;
    x = uAP0AP1 * x;
    float l = dot(x, vec3(0.2722287, 0.6740818, 0.0536895));
    col = uAP1S * mix(vec3(l), x, 1.03);
  }
  if (uLv >= 123) col = acesFit(max(col, 0.0));
  return col;
}

vec3 toonSun(vec3 N, vec3 albedo, float vis0, float vis1) {  // steps 4-7: two suns, summed
  float c0 = cel(N, uL0), c1 = cel(N, uL1);
  if (uLv >= 51) { c0 *= smoothstep(0.0, 1.0, vis0); c1 *= smoothstep(0.0, 1.0, vis1); }
  float s0 = c0 * 0.942 + 0.058, s1 = c1 * 0.942 + 0.058;
  if (uShow == 0) return vec3(c0);
  if (uShow == 1) return vec3(s0);
  if (uShow == 2) return vec3(smoothstep(0.0, 1.0, vis0));
  vec3 l = mix(uGrey, 1.0, s0) * uC0 + uOn1 * mix(uGrey, 1.0, s1) * uC1;
  return l * albedo;
}

vec3 toonSpots(vec3 N, vec3 P, vec3 V, vec3 albedo) {    // step 8 on: three HDRP spots
  vec3 acc = vec3(0.0); vec3 dbg = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 L; float att = spotAtt(i, P, L);
    float fall = smoothstep(0.0, 1.0, min(att, 1.0));
    float c = cel(N, L) * smoothstep(0.0, 1.0, spotVis(i, P));
    float shade = c * 0.942 + 0.058;
    vec3 lc = uSpHd[i] * 0.67;
    float peak = max(lc.r, max(lc.g, lc.b));
    float cap = uLv >= 90 ? min(7.0 / peak, 1.0) : 1.0;
    float w = mix(uGrey, cap, shade) * fall;
    vec3 li = albedo * lc * w;
    float rimW = 0.0;
    if (uLv >= 100 && uIsSweater) {
      float r = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 1.26);
      r = smoothstep(uRimTh - 0.421, uRimTh + 0.421, r);
      rimW = r * shade * fall;
      vec3 rc = vec3(0.188088492, 0.164204225, 0.193396091) * 0.692;
      li += (0.65 * rc + 0.35 * rc * lc) * rimW;
    }
    if (uShow == 4) dbg[i] = fall;
    if (uShow == 5) dbg[i] = rimW;
    if (uShow == 6) dbg[i] = w * 0.67;
    acc = (uLv >= 91 && i > 0) ? max(acc, li) : acc + li;
  }
  if (uShow >= 4) return dbg;
  if (uLv >= 92) acc = mix(vec3(dot(acc, vec3(0.2126729, 0.7151522, 0.0721750))), acc, uSat);
  return acc;
}

vec3 floorSpots(vec3 N, vec3 P, vec3 V) {               // HDRP/Lit backdrop: Disney diffuse + glow
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 L; float att = spotAtt(i, P, L);
    float nl = max(dot(N, L), 0.0), nv = max(dot(N, V), 0.0), f = dot(L, V) + 1.5;
    float dis = (1.0 + (f - 1.0) * pow(1.0 - nl, 5.0)) * (1.0 + (f - 1.0) * pow(1.0 - nv, 5.0)) / (1.03571 * 3.14159265);
    acc += uSpHd[i] * dis * nl * att * spotVis(i, P);
  }
  return acc * uFloorGrey + uFloorEmit;
}

void main() {
  vec3 N = normalize(vN);
  vec3 P = vW + N * 0.008; // tiny push off the surface so it does not shadow itself
  vec3 V = normalize(cameraPosition - vW);
  if (uMode == 0) { gl_FragColor = vec4(uIsFloor ? uFlatFloor : uFlat, 1.0); return; }
  if (uMode == 1) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  bool spots = uMode == 8 && uLv >= 80;
  float vis0 = spots ? 1.0 : pcf(uSM0, uSMat0, P, ${SM}.0, 0.0004);
  float vis1 = spots ? 1.0 : pcf(uSM1, uSMat1, P, ${SM}.0, 0.0004);
  float d0 = dot(N, uL0), d1 = dot(N, uL1);
  // what a Diffuse BSDF receives from the suns (strength pi => white facing the sun = 1.0)
  vec3 lambert = uC0 * max(d0, 0.0) * vis0 + uOn1 * uC1 * max(d1, 0.0) * vis1;
  vec3 tex = uUseTex ? texture(uTex, vUv).rgb : vec3(0.8); // 0.8 = Diffuse BSDF's default colour
  vec3 col;
  if (uIsFloor) {
    col = spots ? floorSpots(N, vW, V) : uFloorGrey * lambert;
    gl_FragColor = vec4(toSRGB(uMode == 8 ? post(col) : col), 1.0);
    return;
  }
  if (uMode == 2) col = tex * lambert;
  else if (uMode == 3) col = lambert;                       // Shader to RGB of a white Diffuse BSDF
  else if (uMode == 4) {
    float r = ramp(lum(lambert), uTh2);
    col = vec3(r) * (uStage == 2 ? tex : vec3(1.0));
  } else if (uMode == 5) {                                  // raw dot product, negatives painted blue
    col = d0 >= 0.0 ? vec3(d0) : vec3(0.15, 0.35, 1.0) * -d0;
  } else if (uMode == 6) col = vec3(d0 * 0.5 + 0.5);
  else if (uMode == 7) {                                    // per-light toon, summed (no cast shadows)
    float r0 = ramp(d0 * 0.5 + 0.5, uTh3), r1 = ramp(d1 * 0.5 + 0.5, uTh3);
    if (uStage == 0) col = vec3(r0);
    else {
      col = r0 * uC0 + uOn1 * r1 * uC1;
      if (uStage == 2) col *= tex;
    }
  } else {                                                  // the toon tree, steps 4-12
    if (uIsSweater && uLv >= 100) {                         // Unity Normal Map group
      vec2 xy = texture(uNrmTex, vUv).rg * 2.0 - 1.0;
      float z = sqrt(clamp(1.0 - dot(xy, xy), 0.0, 1.0));
      N = normalize(vT * xy.x + vB * xy.y + N * z);
    }
    vec3 vn = (viewMatrix * vec4(N, 0.0)).xyz;
    vec3 mc = texture(uMatcapTex, vn.xy * 0.5 + 0.5).rgb;
    vec3 albedo = uLv >= 61 ? tex * mix(vec3(1.0), mc, uMcap) : tex;
    if (uShow == 3) { gl_FragColor = vec4(toSRGB(mix(vec3(1.0), mc, uMcap)), 1.0); return; }
    if (spots) {
      if (uLv >= 81) albedo *= uPower;
      col = toonSpots(N, P, V, albedo);
      if (uShow < 4) col = post(col);
    } else col = toonSun(N, albedo, vis0, vis1);
  }
  gl_FragColor = vec4(toSRGB(col), 1.0);
}`;

// inverted hull: push each vertex out along its normal, draw only the back faces, in black
const outlineVert = /* glsl */ `
uniform float uOutW; uniform sampler2D uMask;
void main() {
  float m = textureLod(uMask, uv, 0.0).r;
  vec3 p = position + normalize(normal) * uOutW * 0.01 * m;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`;
const outlineFrag = /* glsl */ `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private scene = new THREE.Scene();
  private U: Record<string, THREE.IUniform> = {};
  private shadows: { rt: THREE.WebGLRenderTarget; cam: THREE.Camera }[] = [];
  private spotShadows: { rt: THREE.WebGLRenderTarget; cam: THREE.PerspectiveCamera }[] = [];
  private casters: THREE.Object3D[] = [];
  private outlines: THREE.Mesh[] = [];
  private helpers: THREE.Object3D[] = []; // never cast shadows
  private sphere = new THREE.Sphere(new THREE.Vector3(0, 0.85, 0), 1);
  private arrows: THREE.Group[] = [];
  private spotMarks = new THREE.Group();
  private dirty = true;
  private camKey = 'guide';
  private state: ViewState = { mode: 'ambient', label: '' };
  private p = {
    az: DEF.az, el: DEF.el, grey: DEF.grey, th2: DEF.th2, th3: DEF.th3, pink: false, compare: false, wipe: 50,
    knobs: Object.fromEntries(Object.entries(KNOBS).map(([k, v]) => [k, v.def])) as Record<Knob, number>,
  };
  private ui: Record<string, HTMLElement> = {};
  private stage: HTMLElement;
  private shadowsReady = false;

  constructor(root: HTMLElement) {
    root.innerHTML = '';
    this.stage = el('div', 'stage');
    const label = el('div', 'stage-label');
    const ref = el('img', 'ref') as HTMLImageElement;
    const wipeLine = el('div', 'wipe-line');
    const loading = el('div', 'loading', 'Loading model…');
    const hint = el('div', 'stage-hint', 'drag: orbit · right-drag: pan · wheel: zoom');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.stage.append(this.renderer.domElement, ref, wipeLine, label, hint, loading);
    const controls = el('div', 'vc');
    controls.innerHTML = `
      <div class="row">
        <button data-k="resetView">Reset view</button>
        <label class="tog" data-k="pinkRow"><input type="checkbox" data-k="pink"> Pink sun</label>
        <label class="tog" data-k="compareRow"><input type="checkbox" data-k="compare"> Compare with Blender render</label>
      </div>
      <div class="row" data-k="wipeRow"><span>Blender ◀</span><input type="range" min="0" max="100" value="50" data-k="wipe"><span>▶ this viewer</span></div>
      <div class="row" data-k="sunRow">
        <span class="lbl">Sun</span>
        <label>turn <input type="range" min="-180" max="180" step="1" data-k="az"></label>
        <label>height <input type="range" min="-10" max="89" step="1" data-k="el"></label>
        <button data-k="resetSun">reset</button>
      </div>
      <div class="row" data-k="thRow"><span class="lbl">Ramp stop</span><input type="range" min="0" max="1" step="0.005" data-k="th"><output data-k="thOut"></output></div>
      <div class="row" data-k="knobRow"><span class="lbl" data-k="knobLbl"></span><input type="range" data-k="knob"><output data-k="knobOut"></output></div>
      <div class="row" data-k="greyRow"><span class="lbl">Shadow tone</span><input type="range" min="0" max="1" step="0.005" data-k="grey"><output data-k="greyOut"></output></div>
      <div class="note" data-k="note"></div>`;
    root.append(this.stage, controls);
    for (const e of root.querySelectorAll<HTMLElement>('[data-k]')) this.ui[e.dataset.k!] = e;
    Object.assign(this.ui, { label, ref, wipeLine, loading });

    this.camera = new THREE.PerspectiveCamera(S.camera.fovY, S.camera.width / S.camera.height, 0.05, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = true;
    this.resetView();

    const L1 = v3(S.lights[1].dir).normalize();
    this.U = {
      uMode: { value: 0 }, uStage: { value: 2 }, uLv: { value: 0 }, uShow: { value: -1 },
      uL0: { value: DEF_DIR.clone() }, uL1: { value: L1 },
      uC0: { value: v3(S.lights[0].color) }, uC1: { value: v3(S.lights[1].color) }, uOn1: { value: 0 },
      uSM0: { value: null }, uSM1: { value: null }, uSMat0: { value: new THREE.Matrix4() }, uSMat1: { value: new THREE.Matrix4() },
      uSS0: { value: null }, uSS1: { value: null }, uSS2: { value: null },
      uSSM0: { value: new THREE.Matrix4() }, uSSM1: { value: new THREE.Matrix4() }, uSSM2: { value: new THREE.Matrix4() },
      uSpP: { value: S.spots.map((s) => v3(s.pos)) }, uSpF: { value: S.spots.map((s) => v3(s.fwd).normalize()) },
      uSpHd: { value: S.spots.map((s) => v3(s.hd)) },
      uAS: { value: S.spots[0].angleScale }, uAO: { value: S.spots[0].angleOffset }, uRS: { value: S.spots[0].rangeScale },
      uGrey: { value: DEF.grey }, uTh2: { value: DEF.th2 }, uTh3: { value: DEF.th3 }, uFloorGrey: { value: S.floorGrey },
      uFloorEmit: { value: v3(S.floorEmit) },
      uHard: { value: KNOBS.hard.def }, uMcap: { value: KNOBS.matcap.def }, uPower: { value: KNOBS.power.def }, uRimTh: { value: KNOBS.rim.def },
      uMatcapTex: { value: null }, uNrmTex: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uS2AP0: { value: m3(S.mS2AP0) }, uAP0AP1: { value: m3(S.mAP0AP1) }, uAP1S: { value: m3(S.mAP1S) },
      uFlat: { value: new THREE.Vector3().setScalar(AMBIENT_CHAR) }, uFlatFloor: { value: new THREE.Vector3().setScalar(AMBIENT_BG) },
      uOutW: { value: KNOBS.outline.def }, uMask: { value: null },
    };
    for (let i = 0; i < 2; i++) {
      const rt = this.depthTarget(SM);
      this.shadows.push({ rt, cam: new THREE.OrthographicCamera() });
      this.U[`uSM${i}`].value = rt.depthTexture;
    }
    S.spots.forEach((s, i) => {
      const rt = this.depthTarget(SSM);
      // a cone of 90°: a square frustum of 110° comfortably contains it
      const cam = new THREE.PerspectiveCamera(110, 1, 0.05, 8);
      cam.position.copy(v3(s.pos));
      cam.lookAt(v3(s.pos).add(v3(s.fwd)));
      cam.updateMatrixWorld();
      this.spotShadows.push({ rt, cam });
      this.U[`uSS${i}`].value = rt.depthTexture;
      (this.U[`uSSM${i}`].value as THREE.Matrix4).multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const hd = v3(s.hd), peak = Math.max(hd.x, hd.y, hd.z);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hd.x / peak, hd.y / peak, hd.z / peak) });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), mat);
      bulb.position.copy(v3(s.pos));
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35), mat);
      beam.position.copy(v3(s.pos)).addScaledVector(v3(s.fwd).normalize(), 0.175);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(s.fwd).normalize());
      this.spotMarks.add(bulb, beam);
    });
    this.scene.add(this.spotMarks);
    this.helpers.push(this.spotMarks);
    for (const [i, col] of [[0, 0xffd54a], [1, 0xff5aa8]] as const) {
      const g = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: col });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55), m);
      shaft.position.y = 0.275;
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), m);
      sun.position.y = 0.6;
      g.add(shaft, sun);
      this.arrows[i] = g;
      this.scene.add(g);
      this.helpers.push(g);
    }
    this.load();
    this.bindUI();
    new ResizeObserver(() => this.resize()).observe(this.stage);
    const loop = () => {
      if (this.controls.update() || this.dirty) this.render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  private depthTarget(n: number) {
    const rt = new THREE.WebGLRenderTarget(n, n);
    rt.depthTexture = new THREE.DepthTexture(n, n);
    rt.depthTexture.type = THREE.UnsignedIntType;
    return rt;
  }

  private async load() {
    const tl = new THREE.TextureLoader();
    const tex = async (url: string, color = true, flipY = false) => {
      const t = await tl.loadAsync(url);
      t.flipY = flipY;
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      return t;
    };
    const [gltf, body, sweater, matcap, nrm, mask] = await Promise.all([
      new GLTFLoader().loadAsync('/assets/character.glb'), tex('/assets/body_color.png'), tex('/assets/sweater_color.jpg'),
      // the matcap is looked up with a computed UV in Blender's convention (v up), so it keeps flipY
      tex('/assets/matcap.png', true, true), tex('/assets/sweater_normal.jpg', false), tex('/assets/outline_mask.png', false),
    ]);
    this.U.uMatcapTex.value = matcap;
    this.U.uNrmTex.value = nrm;
    this.U.uMask.value = mask;
    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
    for (const m of meshes) {
      const isFloor = /floor/i.test(m.name), isSweater = /sweater/i.test(m.name);
      m.material = new THREE.ShaderMaterial({
        vertexShader: vert, fragmentShader: frag,
        uniforms: {
          ...this.U, uTex: { value: isSweater ? sweater : body }, uIsFloor: { value: isFloor },
          uIsSweater: { value: isSweater }, uUseTex: { value: true }, uSat: { value: isSweater ? S.sat.Sweater : S.sat.Skin },
        },
      });
      if (isFloor) {
        this.helpers.push(m);
        continue;
      }
      this.casters.push(m);
      box.expandByObject(m);
      const hull = new THREE.Mesh(m.geometry, new THREE.ShaderMaterial({
        vertexShader: outlineVert, fragmentShader: outlineFrag, side: THREE.BackSide,
        uniforms: { uOutW: this.U.uOutW, uMask: this.U.uMask },
      }));
      m.add(hull);
      this.outlines.push(hull);
      this.helpers.push(hull);
    }
    box.getBoundingSphere(this.sphere);
    this.scene.add(gltf.scene);
    this.ui.loading.remove();
    this.applyState();
  }

  /** depth from a light's point of view; only the body and sweater cast shadows */
  private shadowPass(rt: THREE.WebGLRenderTarget, cam: THREE.Camera) {
    const was = this.helpers.map((o) => o.visible);
    this.helpers.forEach((o) => (o.visible = false));
    this.scene.overrideMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    this.renderer.setRenderTarget(rt);
    this.renderer.clear();
    this.renderer.render(this.scene, cam);
    this.renderer.setRenderTarget(null);
    this.scene.overrideMaterial = null;
    this.helpers.forEach((o, k) => (o.visible = was[k]));
  }

  private updateShadow(i: number) {
    const { rt, cam } = this.shadows[i];
    const oc = cam as THREE.OrthographicCamera;
    const L = (this.U[`uL${i}`].value as THREE.Vector3).clone().normalize();
    const r = this.sphere.radius * 1.02;
    Object.assign(oc, { left: -r, right: r, top: r, bottom: -r, near: 0.01, far: 2 * r + 12 });
    oc.position.copy(this.sphere.center).addScaledVector(L, r + 0.5);
    oc.up.set(0, Math.abs(L.y) > 0.99 ? 0 : 1, Math.abs(L.y) > 0.99 ? 1 : 0);
    oc.lookAt(this.sphere.center);
    oc.updateProjectionMatrix();
    oc.updateMatrixWorld();
    this.shadowPass(rt, oc);
    (this.U[`uSMat${i}`].value as THREE.Matrix4).multiplyMatrices(oc.projectionMatrix, oc.matrixWorldInverse);
  }

  private render() {
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.stage;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.getDrawingBufferSize(this.U.uRes.value as THREE.Vector2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private resetView() {
    const c = this.camKey === 'shot' ? S.shot : S.camera;
    this.camera.fov = c.fovY;
    this.camera.up.copy(this.camKey === 'shot' ? v3(S.shot.up) : new THREE.Vector3(0, 1, 0));
    this.camera.position.copy(v3(c.pos));
    this.controls.target.copy(v3(c.target));
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.dirty = true;
  }

  private bindUI() {
    const inp = (k: string) => this.ui[k] as HTMLInputElement;
    this.ui.resetView.onclick = () => this.resetView();
    this.ui.resetSun.onclick = () => { Object.assign(this.p, { az: DEF.az, el: DEF.el }); this.sync(); };
    inp('pink').onchange = () => { this.p.pink = inp('pink').checked; this.sync(); };
    inp('compare').onchange = () => {
      this.p.compare = inp('compare').checked;
      if (this.p.compare) {
        Object.assign(this.p, { az: DEF.az, el: DEF.el, grey: DEF.grey, th2: DEF.th2, th3: DEF.th3 });
        for (const k of Object.keys(KNOBS) as Knob[]) this.p.knobs[k] = KNOBS[k].def;
        this.resetView();
      }
      this.sync();
    };
    inp('wipe').oninput = () => { this.p.wipe = +inp('wipe').value; this.sync(); };
    inp('az').oninput = () => { this.p.az = +inp('az').value; this.sync(); };
    inp('el').oninput = () => { this.p.el = +inp('el').value; this.sync(); };
    inp('grey').oninput = () => { this.p.grey = +inp('grey').value; this.sync(); };
    inp('th').oninput = () => {
      if (this.state.mode === 'toon3') this.p.th3 = +inp('th').value; else this.p.th2 = +inp('th').value;
      this.sync();
    };
    inp('knob').oninput = () => {
      if (this.state.knob) this.p.knobs[this.state.knob] = +inp('knob').value;
      this.sync();
    };
  }

  setState(s: ViewState) {
    this.state = s;
    this.p.pink = !!s.pink;
    const cam = s.cam ?? 'guide';
    if (cam !== this.camKey) {
      this.camKey = cam;
      const c = cam === 'shot' ? S.shot : S.camera;
      this.stage.style.setProperty('--ar', String(c.width / c.height));
      this.stage.parentElement?.style.setProperty('--ar', String(c.width / c.height));
      this.resetView();
    }
    this.applyState();
  }

  private applyState() {
    const s = this.state;
    this.U.uMode.value = MODES.indexOf(s.mode);
    this.U.uStage.value = s.stage === 'ramp' ? 0 : s.stage === 'tint' ? 1 : 2;
    this.U.uLv.value = s.lv ?? 0;
    this.U.uShow.value = s.show ? SHOWS.indexOf(s.show) : -1;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.uniforms?.uUseTex) m.uniforms.uUseTex.value = s.tex !== false;
    });
    this.ui.label.textContent = s.label;
    this.sync();
  }

  // push the panel values into uniforms + control visibility
  private sync() {
    const s = this.state, p = this.p, lv = s.mode === 'toon' ? s.lv ?? 0 : 0;
    const spots = lv >= 80;
    const lit = !['ambient', 'black'].includes(s.mode) && s.show !== 'matcap'; // the matcap ignores lights
    const ramped = s.mode === 'toon2' || s.mode === 'toon3';
    const hasRef = !!(p.pink ? s.refPink : s.ref);
    if (!hasRef) p.compare = false;
    const show = (k: string, on: boolean) => this.ui[k].classList.toggle('hidden', !on);
    show('pinkRow', s.pink !== undefined);
    show('compareRow', hasRef);
    show('wipeRow', p.compare);
    show('sunRow', lit && !spots && !p.compare);
    show('thRow', ramped && !p.compare);
    show('greyRow', (ramped && s.stage !== 'tint' || s.mode === 'toon' && !s.show) && !p.compare);
    show('knobRow', !!s.knob && !p.compare);
    const set = (k: string, v: number | boolean) => {
      const i = this.ui[k] as HTMLInputElement;
      if (typeof v === 'boolean') i.checked = v; else i.value = String(v);
    };
    const th = s.mode === 'toon3' ? p.th3 : p.th2;
    set('pink', p.pink); set('compare', p.compare); set('az', p.az); set('el', p.el);
    set('th', th); set('grey', p.grey); set('wipe', p.wipe);
    this.ui.thOut.textContent = th.toFixed(3);
    this.ui.greyOut.textContent = p.grey.toFixed(3);
    if (s.knob) {
      const k = KNOBS[s.knob], i = this.ui.knob as HTMLInputElement;
      Object.assign(i, { min: String(k.min), max: String(k.max), step: String(k.step) });
      i.value = String(p.knobs[s.knob]);
      this.ui.knobLbl.textContent = k.label;
      this.ui.knobOut.textContent = p.knobs[s.knob].toFixed(3);
    }
    this.U.uHard.value = p.knobs.hard;
    this.U.uMcap.value = p.knobs.matcap;
    this.U.uOutW.value = p.knobs.outline;
    this.U.uPower.value = p.knobs.power;
    this.U.uRimTh.value = p.knobs.rim;
    const notes: string[] = [];
    if (lv >= 112) notes.push('Not in this viewer: depth of field. Use Compare to see it.');
    if (lv >= 120) notes.push('Not in this viewer: ambient occlusion tint.');
    if (lv >= 123) notes.push('ACES here is a close fit, not the exact OCIO transform.');
    this.ui.note.textContent = notes.join(' ');
    show('note', notes.length > 0 && !p.compare);

    const az = THREE.MathUtils.degToRad(p.az), elv = THREE.MathUtils.degToRad(p.el);
    const L0 = new THREE.Vector3(Math.sin(az) * Math.cos(elv), Math.sin(elv), Math.cos(az) * Math.cos(elv));
    const L1 = this.U.uL1.value as THREE.Vector3;
    const moved = !L0.equals(this.U.uL0.value);
    this.U.uL0.value.copy(L0);
    this.U.uOn1.value = p.pink ? 1 : 0;
    this.U.uGrey.value = p.grey;
    this.U.uTh2.value = p.th2;
    this.U.uTh3.value = p.th3;
    if (this.casters.length && !this.shadowsReady) {
      this.updateShadow(0);
      this.updateShadow(1);
      this.spotShadows.forEach(({ rt, cam }) => this.shadowPass(rt, cam));
      this.shadowsReady = true;
    } else if (this.casters.length && moved) this.updateShadow(0);
    for (const [i, L, on] of [[0, L0, lit && !spots], [1, L1, lit && !spots && p.pink]] as const) {
      const a = this.arrows[i];
      a.visible = on && !p.compare;
      a.position.set(this.sphere.center.x, this.sphere.center.y + 0.2, this.sphere.center.z);
      a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), L.clone().normalize());
    }
    this.spotMarks.visible = spots && !p.compare && this.camKey !== 'shot'; // the lamps sit between the shot camera and the body
    this.outlines.forEach((o) => (o.visible = lv >= 70 && !s.show));
    this.controls.enabled = !p.compare;
    const ref = this.ui.ref as HTMLImageElement;
    ref.classList.toggle('hidden', !p.compare);
    this.ui.wipeLine.classList.toggle('hidden', !p.compare);
    if (p.compare) {
      const src = `/ref/${p.pink ? s.refPink : s.ref}.png`;
      if (!ref.src.endsWith(src)) ref.src = src;
      ref.style.clipPath = `inset(0 ${100 - p.wipe}% 0 0)`;
      this.ui.wipeLine.style.left = `${p.wipe}%`;
    }
    this.dirty = true;
  }
}
