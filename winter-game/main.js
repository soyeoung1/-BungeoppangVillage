import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCharacterFactory } from './characters.js';
import { buildVillage } from './village.js';
import { buildDecor } from './decor.js';

// ---------- 기본 세팅 (푸른 저녁 밤 분위기) ----------
const scene = new THREE.Scene();
const FOG_COLOR = 0x6b8ac2;                       // 하늘 지평선 색과 맞춰서 땅 끝이 하늘과 자연스럽게 이어짐
scene.fog = new THREE.Fog(FOG_COLOR, 45, 300);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 700);
camera.position.set(0, 6, 36);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const USE_BLOOM = !location.search.includes('nobloom');   // 느린 PC용: 주소 뒤에 ?nobloom
// 후처리: 블룸(불빛 번짐). MSAA를 켜서 가장자리가 계단져 보이지 않게 함
const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4;
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.55, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.HemisphereLight(0x8aa8f0, 0x7a6cae, 0.85));     // 푸른 밤하늘빛
const sun = new THREE.DirectionalLight(0xb4c8ff, 0.65);              // 달빛
sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
sun.position.set(-14, 24, 10); sun.castShadow = true;
sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
const warm = new THREE.PointLight(0xffaa55, 0, 14, 2); // 노점 불빛
warm.position.set(0, 2.4, -5.0); scene.add(warm);

const $ = id => document.getElementById(id);
// 카툰 느낌의 3단계 음영
const toonGrad = new THREE.DataTexture(new Uint8Array([140, 200, 255]), 3, 1, THREE.RedFormat);
toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter; toonGrad.needsUpdate = true;
const mat = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad, ...o });

// 굵은 외곽선 (뒤집은 껍데기 방식)
const OUTLINE_COLOR = 0x2a2438;
const outlineCache = {};
function outlineMat(kind, t) {
  const key = kind + t;
  if (outlineCache[key]) return outlineCache[key];
  outlineCache[key] = kind === 'box'
    ? new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide })
    : new THREE.ShaderMaterial({
        side: THREE.BackSide, uniforms: { t: { value: t }, c: { value: new THREE.Color(OUTLINE_COLOR) } },
        vertexShader: 'uniform float t; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position+normalize(normal)*t,1.0); }',
        fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c,1.0); }'
      });
  return outlineCache[key];
}
function addOutlines(root, t = 0.022) {
  const list = [];
  root.traverse(o => {
    if (o.isMesh && !o.userData.outlined && !o.userData.isOutline && !o.userData.noOutline &&
        o.material && !o.material.isMeshBasicMaterial && o.material.visible !== false) list.push(o);
  });
  for (const m of list) {
    m.userData.outlined = true;
    const g = m.geometry; let o;
    if (g.type === 'BoxGeometry') {
      const p = g.parameters;
      o = new THREE.Mesh(g, outlineMat('box', 0));
      o.scale.set(1 + 2 * t / p.width, 1 + 2 * t / p.height, 1 + 2 * t / p.depth);
    } else o = new THREE.Mesh(g, outlineMat('hull', t));
    o.userData.isOutline = true; m.add(o);
  }
}
function box(w, h, d, c, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}


// ---------- 월드: 하늘 · 산 · 돌바닥 · 오두막 ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(20261127);
const R = (a, b) => a + rng() * (b - a);
const PLAZA = new THREE.Vector3(0, 0, 1), PLAZA_R = 9.6;     // 마을배치도: 광장 중심(0,1) 반지름 9

// 하늘: 카메라를 따라다니는 돔 + 별 + 달 (그래서 맵 끝이 보이지 않음)
const skyGroup = new THREE.Group(); scene.add(skyGroup);
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vp; void main(){ vp=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vp; void main(){
      float h = normalize(vp).y;
      vec3 top = vec3(0.03,0.06,0.18), mid = vec3(0.10,0.21,0.44), hor = vec3(0.42,0.54,0.76), warm = vec3(0.85,0.62,0.58);
      vec3 c = mix(hor, mid, smoothstep(0.0,0.32,h));
      c = mix(c, top, smoothstep(0.28,0.85,h));
      float band = exp(-pow((h-0.05)/0.05, 2.0)) * smoothstep(0.0,0.03,h);
      c = mix(c, warm, band*0.45);
      gl_FragColor = vec4(pow(c, vec3(2.2)),1.0); }`
  }));
  sky.userData.noOutline = true; sky.renderOrder = -10; skyGroup.add(sky);
  const N = 380, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rng() * Math.PI * 2, y = 0.12 + rng() * 0.88, r = Math.sqrt(1 - y * y);
    sp[i * 3] = Math.cos(a) * r * 380; sp[i * 3 + 1] = y * 380; sp[i * 3 + 2] = Math.sin(a) * r * 380;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  skyGroup.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false })));
  // 달
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.28, 'rgba(255,248,215,1)'); g.addColorStop(0.32, 'rgba(255,245,210,0.35)'); g.addColorStop(1, 'rgba(255,245,210,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true }));
  moon.position.set(-170, 190, -260); moon.scale.set(90, 90, 1); skyGroup.add(moon);
}

// 눈 덮인 땅 (아주 넓게 → 안개와 섞여 끝이 안 보임)
const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), mat(0xeef3ff));
ground.userData.noOutline = true;
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// 산: 겹겹이 3겹 + 아랫쪽은 어두운 숲, 윗쪽은 눈 덮인 봉우리
function noise3(x, y, z) { return Math.sin(x * 1.7 + y * 0.9) * Math.cos(z * 1.3 - y * 0.7) * 0.5 + Math.sin(x * 3.1 + z * 2.7) * 0.25 + Math.sin(y * 2.3 + x * 0.6) * 0.25; }
function mountain(x, z, r, h, sn) {
  const g = new THREE.ConeGeometry(r, h, 8, 10, true);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const snow = new THREE.Color(0xf2f6ff), rock = new THREE.Color(0x5b6a8c), forest = new THREE.Color(0x2a3d52), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const t = (py + h / 2) / h, n = noise3(px * 0.06 + sn, py * 0.05, pz * 0.06 + sn);
    const k = 1 + n * 0.28 * (1 - t); pos.setXYZ(i, px * k, py + n * h * 0.07 * t, pz * k);
    const line = 0.4 + n * 0.14;
    tmp.copy(forest).lerp(rock, THREE.MathUtils.smoothstep(t, 0.12, 0.3)).lerp(snow, THREE.MathUtils.smoothstep(t, line - 0.05, line + 0.07));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(0xffffff, { vertexColors: true }));
  m.position.set(x, h / 2 - 5, z); m.rotation.y = rng() * 6; m.userData.noOutline = true; scene.add(m);
}
[[95, 16, 24, 34, 24, 40], [138, 16, 34, 48, 48, 80], [190, 14, 48, 68, 85, 125]].forEach(([Rr, n, r0, r1, h0, h1], ri) => {
  for (let i = 0; i < n; i++) {
    const a = (i + R(-0.3, 0.3)) / n * Math.PI * 2, d = Rr + R(-8, 8);
    mountain(Math.cos(a) * d, Math.sin(a) * d, R(r0, r1), R(h0, h1), ri * 10 + i);
  }
});

// 돌바닥 텍스처
function makeCobbleTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#464b63'; x.fillRect(0, 0, S, S);
  const rows = 8, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let px = -(r % 2) * 26 - rng() * 14;
    while (px < S) {
      const w = 46 + rng() * 34, sh = 112 + rng() * 55 | 0, warmT = rng() * 16 | 0;
      for (const off of [0, -S]) {
        x.fillStyle = `rgb(${sh + warmT},${sh},${sh + 16 - warmT})`;
        x.beginPath(); x.roundRect(px + off + 3, r * rh + 3, w - 6, rh - 6, 14); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.roundRect(px + off + 7, r * rh + 5, w - 16, (rh - 6) * 0.34, 8); x.fill();
      }
      px += w;
    }
  }
  for (let i = 0; i < 46; i++) {
    x.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.3})`; x.beginPath();
    x.ellipse(rng() * S, rng() * S, 6 + rng() * 14, 3 + rng() * 6, rng() * 3, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const cobbleBase = makeCobbleTexture();
function cobbleMat(wd, len, y = 0) {
  const t = cobbleBase.clone(); t.needsUpdate = true; t.repeat.set(wd / 2.6, len / 2.6);
  return new THREE.MeshToonMaterial({ map: t, gradientMap: toonGrad, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}
const snowBedMat = mat(0xffffff);
const ROADPTS = [], PATHS = [];
function flat(geo, material, y, x = 0, z = 0) {
  const m = new THREE.Mesh(geo, material); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.receiveShadow = true; m.userData.noOutline = true; scene.add(m); return m;
}
// 광장 (0,1) r=9
flat(new THREE.CircleGeometry(PLAZA_R, 56), cobbleMat(PLAZA_R * 2, PLAZA_R * 2), 0.045, PLAZA.x, PLAZA.z);
// 길: 마을배치도의 구불구불한 길 (Catmull-Rom 곡선 → 띠 메시)
function catmull(pts, n = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * ((2 * b[j]) + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3))); }
  }
  out.push(pts[pts.length - 1]); return out;
}
function ribbonGeo(sm, wd, tile = 2.6) {
  const pos = [], uv = [], idx = []; let len = 0;
  for (let i = 0; i < sm.length; i++) {
    const p = sm[i], a = sm[Math.max(0, i - 1)], b = sm[Math.min(sm.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    if (i) len += Math.hypot(p[0] - sm[i - 1][0], p[1] - sm[i - 1][1]);
    pos.push(p[0] - tz * wd / 2, 0, p[1] + tx * wd / 2, p[0] + tz * wd / 2, 0, p[1] - tx * wd / 2);
    uv.push(0, len / tile, wd / tile, len / tile);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }   // 위쪽(+y)을 보도록 감는 방향
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const cobbleStrip = cobbleMat(2.6, 2.6);
function pathRibbon(pts, wd = 1.8) {
  const sm = catmull(pts, 12); PATHS.push({ pts: sm, wd }); sm.forEach(p => ROADPTS.push(p));
  const m = new THREE.Mesh(ribbonGeo(sm, wd), cobbleStrip); m.position.y = 0.03; m.receiveShadow = true; m.userData.noOutline = true; scene.add(m);
}

// 빛 번짐(글로우)
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,214,120,1)'); g.addColorStop(0.35, 'rgba(255,190,90,0.45)'); g.addColorStop(1, 'rgba(255,170,70,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
function glow(parent, x, y, z, size = 2.2, op = 0.85) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.position.set(x, y, z); s.scale.set(size, size, 1); parent.add(s); return s;
}

// ===== 따뜻한 겨울 마을 목조 집 (하프팀버 + 아치문 + 두꺼운 눈지붕) =====
const HOUSES = [], COLLIDERS = [], SMOKES = [];
// ---- Canvas 텍스처: 나뭇결 / 돌 / 회벽 / 간판 (외부 이미지 없이 코드로 그림) ----
function canvasTex(W, H, draw) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function woodTexture(rgb, { planks = 0, rot = false } = {}) {
  const t = canvasTex(128, 256, (x, W, H) => {
    x.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 48; i++) {                                           // 나뭇결
      const x0 = rng() * W, amp = 1 + rng() * 3, f = 0.02 + rng() * 0.03, ph = rng() * 6;
      x.strokeStyle = rng() < 0.65 ? `rgba(0,0,0,${0.08 + rng() * 0.2})` : `rgba(255,235,200,${0.05 + rng() * 0.1})`;
      x.lineWidth = 1 + rng() * 2.5; x.beginPath();
      for (let y = 0; y <= H; y += 8) { const xx = x0 + Math.sin(y * f + ph) * amp; y ? x.lineTo(xx, y) : x.moveTo(xx, y); }
      x.stroke();
    }
    for (let i = 0; i < 2; i++) {                                            // 옹이
      const kx = rng() * W, ky = rng() * H;
      for (let k = 4; k > 0; k--) { x.strokeStyle = `rgba(0,0,0,${0.12 + k * 0.04})`; x.lineWidth = 2; x.beginPath(); x.ellipse(kx, ky, 3 + k * 3, 6 + k * 6, 0, 0, 7); x.stroke(); }
    }
    for (let p = 1; p < planks; p++) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(p * W / planks - 1.5, 0, 3, H); }
  });
  if (rot) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
  return t;
}
const stoneTex = canvasTex(256, 128, (x, W, H) => {
  x.fillStyle = '#5a5668'; x.fillRect(0, 0, W, H);
  for (let r = 0; r < 2; r++) {
    let px = -(r % 2) * 26 - rng() * 12;
    while (px < W) {
      const w = 42 + rng() * 30, sh = 118 + rng() * 48 | 0;
      for (const off of [0, -W]) {
        x.fillStyle = `rgb(${sh},${sh - 4},${sh + 14})`; x.beginPath(); x.roundRect(px + off + 2, r * 64 + 2, w - 4, 60, 10); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.roundRect(px + off + 5, r * 64 + 4, w - 12, 18, 8); x.fill();
      }
      px += w;
    }
  }
  for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.3})`; x.beginPath(); x.ellipse(rng() * W, rng() * H, 5 + rng() * 9, 2 + rng() * 3, 0, 0, 7); x.fill(); }
});
function stoneMat(rx, ry) { const t = stoneTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return mat(0xffffff, { map: t }); }
const stuccoTex = canvasTex(128, 128, (x, W, H) => {
  x.fillStyle = '#f4f0e8'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) { x.fillStyle = rng() < 0.5 ? `rgba(120,90,50,${0.03 + rng() * 0.07})` : `rgba(255,255,255,${0.1 + rng() * 0.2})`; x.beginPath(); x.arc(rng() * W, rng() * H, 0.6 + rng() * 1.8, 0, 7); x.fill(); }
});
const ringTex = canvasTex(64, 64, (x, W) => {
  x.fillStyle = '#d9b27a'; x.fillRect(0, 0, W, W);
  for (let r = 30; r > 2; r -= 4) { x.strokeStyle = `rgba(110,70,30,${0.25 + (30 - r) / 70})`; x.lineWidth = 1.5; x.beginPath(); x.arc(32, 32, r, 0, 7); x.stroke(); }
});
function signTexture(text) {
  return canvasTex(256, 128, (x, W, H) => {
    x.fillStyle = '#9a6a38'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 24; i++) { x.strokeStyle = `rgba(0,0,0,${0.06 + rng() * 0.12})`; x.lineWidth = 1 + rng() * 2; x.beginPath(); x.moveTo(0, rng() * H); x.lineTo(W, rng() * H); x.stroke(); }
    x.strokeStyle = '#4a2c18'; x.lineWidth = 8; x.strokeRect(4, 4, W - 8, H - 8);
    x.fillStyle = '#3a2112'; x.font = 'bold 58px "Malgun Gothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, W / 2, H / 2 + 4);
  });
}
const wt = (rgb, o) => mat(0xffffff, { map: woodTexture(rgb, o) });
const MATS = {
  timber: wt([74, 44, 24]), timberH: wt([74, 44, 24], { rot: true }),
  timberLight: wt([128, 80, 40]), timberLightH: wt([128, 80, 40], { rot: true }),
  roof: wt([92, 60, 42], { planks: 5 }), roofH: wt([92, 60, 42], { planks: 5, rot: true }),
  stone: stoneMat(4, 1), stoneStep: stoneMat(1.4, 1), stoneChim: stoneMat(1, 2.6),
  snow: mat(0xe6eeff), log: wt([140, 92, 50]), logEnd: mat(0xffffff, { map: ringTex }),
  glass: new THREE.MeshBasicMaterial({ color: 0xffcf6a }), glassWarm: new THREE.MeshBasicMaterial({ color: 0xffb347 }),
};
MATS.glass.color.multiplyScalar(2.0); MATS.glassWarm.color.multiplyScalar(2.2);   // 1보다 밝게 → 블룸으로 번짐
const HOR = new Map([[MATS.timber, MATS.timberH], [MATS.timberLight, MATS.timberLightH], [MATS.roof, MATS.roofH]]);
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(235,240,255,0.5)'); g.addColorStop(1, 'rgba(235,240,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
function part(w, h, d, m, x, y, z, parent, o = {}) {
  if (HOR.has(m) && w > h * 1.4 && w >= d) m = HOR.get(m);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.isMaterial ? m : mat(m));
  mesh.position.set(x, y, z); mesh.castShadow = !!o.shadow; mesh.receiveShadow = true;
  if (!o.out) mesh.userData.noOutline = true; parent.add(mesh); return mesh;
}
function blob(parent, sx, sy, sz, x, y, z, m = MATS.snow) {      // 둥근 눈덩이
  const b = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9), m); b.scale.set(sx, sy, sz); b.position.set(x, y, z);
  b.receiveShadow = true; b.userData.noOutline = true; parent.add(b); return b;
}
function archShape(rad, straightH) {
  const sh = new THREE.Shape(); sh.moveTo(-rad, 0); sh.lineTo(rad, 0); sh.lineTo(rad, straightH);
  sh.absarc(0, straightH, rad, 0, Math.PI, false); sh.lineTo(-rad, 0); return sh;
}
function archMesh(parent, rad, sh, depth, m, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(rad, sh), { depth, bevelEnabled: false, curveSegments: 18 }), m);
  mesh.position.set(x, y, z); mesh.userData.noOutline = true; parent.add(mesh); return mesh;
}
function addSmoke(g, lx, ly, lz) {
  g.updateMatrixWorld(true); const p = g.localToWorld(new THREE.Vector3(lx, ly, lz)), puffs = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd5ddf0, transparent: true, depthWrite: false, opacity: 0 }));
    scene.add(s); puffs.push({ s, t: i / 6 * 4 });
  }
  SMOKES.push({ p, puffs });
}
function updateSmoke(dt, time) {
  for (const sm of SMOKES) for (const q of sm.puffs) {
    q.t += dt; if (q.t > 4) q.t -= 4; const u = q.t / 4;
    q.s.position.set(sm.p.x + Math.sin(time * 0.6 + u * 5) * 0.3 * u + u * 1.2, sm.p.y + 0.3 + u * 4.2, sm.p.z + Math.cos(time * 0.5 + u * 4) * 0.2 * u);
    const sc = 0.8 + u * 2.4; q.s.scale.set(sc, sc, 1); q.s.material.opacity = Math.sin(Math.PI * u) * 0.55;
  }
}

// 격자창 (면 좌표계: x 가로, y 높이, z 바깥쪽)
function latticeWindow(face, cx, cy, ww, hh, shutter) {
  part(ww + 0.26, hh + 0.26, 0.14, MATS.timber, cx, cy, 0.05, face);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.1), MATS.glass); gl.position.set(cx, cy, 0.1); face.add(gl);
  for (const k of [-1, 1]) part(0.05, hh, 0.06, MATS.timber, cx + k * ww / 6, cy, 0.17, face);
  for (const k of [-1, 1]) part(ww, 0.05, 0.06, MATS.timber, cx, cy + k * hh / 6, 0.17, face);
  part(0.07, hh, 0.07, MATS.timber, cx, cy, 0.18, face);
  part(ww + 0.5, 0.09, 0.34, MATS.timberLight, cx, cy - hh / 2 - 0.17, 0.16, face);                 // 창턱
  blob(face, (ww + 0.45) / 2, 0.1, 0.2, cx, cy - hh / 2 - 0.08, 0.16);                               // 창턱 위 눈
  blob(face, (ww + 0.3) / 2, 0.09, 0.14, cx, cy + hh / 2 + 0.16, 0.1);                               // 창틀 위 눈
  if (shutter !== undefined) for (const s of [-1, 1]) part(0.3, hh + 0.2, 0.08, shutter, cx + s * (ww / 2 + 0.3), cy, 0.05, face);
  glow(face, cx, cy, 0.7, ww * 2.8, 0.5);
}

function house(x, z, color = 0xdcb878, ry, o = {}) {
  const { w = 6.4, d = 5, h = 2.9, roofH = 2.6, light = true, shutter = 0x7a3a2a, sign = null } = o;
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const phi = ry === undefined ? Math.atan2(PLAZA.x - x, PLAZA.z - z) : ry; g.rotation.y = phi; scene.add(g);
  const plaster = mat(color, { map: stuccoTex }), base = 0.55, topY = base + h, mid = base + h * 0.5;

  // 돌 기단 + 벽
  part(w + 0.4, base, d + 0.4, MATS.stone, 0, base / 2, 0, g, { out: true, shadow: true });
  part(w, h, d, plaster, 0, base + h / 2, 0, g, { out: true, shadow: true });

  // 하프팀버 면 4개 (앞/뒤/좌/우)
  const faces = [[0, d / 2, 0, w, true], [0, -d / 2, Math.PI, w, false], [w / 2, 0, Math.PI / 2, d, false], [-w / 2, 0, -Math.PI / 2, d, false]];
  let frontFace = null;
  for (const [fx, fz, fr, fw, front] of faces) {
    const face = new THREE.Group(); face.position.set(fx, 0, fz); face.rotation.y = fr; g.add(face);
    if (front) frontFace = face;
    const posts = front ? [-fw / 2, -0.95, 0.95, fw / 2] : Array.from({ length: Math.round(fw / 2.3) + 1 }, (_, i, n = Math.round(fw / 2.3)) => -fw / 2 + i * fw / n);
    for (const px of posts) part(0.22, h, 0.16, MATS.timber, px, base + h / 2, 0.06, face);              // 세로 기둥
    part(fw + 0.22, 0.24, 0.18, MATS.timber, 0, topY - 0.05, 0.07, face);                                  // 위 가로보
    part(fw + 0.22, 0.2, 0.18, MATS.timber, 0, base + 0.1, 0.07, face);                                    // 아래 가로보
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1], pw = b - a, cx = (a + b) / 2, isDoor = front && i === 1;
      if (isDoor) { part(pw + 0.2, 0.2, 0.18, MATS.timber, cx, base + 2.6, 0.07, face); }                 // 문 위 상인방
      else {
        part(pw, 0.18, 0.16, MATS.timber, cx, mid, 0.06, face);                                           // 중간 가로보
        const ph = topY - mid - 0.12, len = Math.hypot(pw, ph), ang = Math.atan2(ph, pw) * (i % 2 ? -1 : 1);
        const br = part(0.14, len - 0.1, 0.12, MATS.timber, cx, mid + ph / 2 + 0.04, 0.05, face); br.rotation.z = (i % 2 ? 1 : -1) * Math.atan2(pw, ph);  // 대각 보강재
        latticeWindow(face, cx, base + (mid - base) * 0.62, Math.min(1.15, pw - 0.6), 1.0, shutter);
      }
    }
  }

  // 아치형 큰 나무문 (안쪽에서 빛남)
  const df = frontFace;
  archMesh(df, 0.9, 1.6, 0.14, MATS.timber, 0, base, 0.04);
  archMesh(df, 0.74, 1.6, 0.06, MATS.glassWarm, 0, base, 0.13);
  for (const k of [-1, 1]) part(0.07, 1.9, 0.07, MATS.timber, k * 0.25, base + 1.0, 0.2, df);
  for (const yy of [0.5, 1.25]) part(1.48, 0.08, 0.07, MATS.timber, 0, base + yy, 0.2, df);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), MATS.timberLight); knob.position.set(0.5, base + 0.95, 0.24); knob.userData.noOutline = true; df.add(knob);
  glow(df, 0, base + 1.2, 0.8, 3.6, 0.75);

  // 돌계단 3칸 + 눈 덮인 나무 난간
  const sh = base / 3;
  for (let k = 0; k < 3; k++) {
    const hh = (k + 1) * sh, zc = d / 2 + 0.2 + (2 - k) * 0.5 + 0.25;
    part(2.3, hh, 0.5, MATS.stoneStep, 0, hh / 2, zc, g, { out: true, shadow: true });
    blob(g, 1.08, 0.05, 0.22, 0, hh + 0.01, zc);
  }
  for (const sx of [-1, 1]) {
    const zt = d / 2 + 0.42, zb = d / 2 + 1.55, yt = base + 0.95, yb = sh + 0.95;
    for (const [zz, yy] of [[zt, yt], [zb, yb]]) { part(0.12, 1.0, 0.12, MATS.timberLight, sx * 1.4, yy - 0.5, zz, g); blob(g, 0.13, 0.1, 0.13, sx * 1.4, yy + 0.04, zz); }
    const L = Math.hypot(zb - zt, yt - yb), rail = part(0.1, 0.1, L, MATS.timberLight, sx * 1.4, (yt + yb) / 2 - 0.1, (zt + zb) / 2, g);
    rail.rotation.x = Math.atan2(yt - yb, zb - zt);
    const rs = blob(g, 0.1, 0.07, L / 2, sx * 1.4, (yt + yb) / 2 - 0.03, (zt + zb) / 2); rs.rotation.x = rail.rotation.x;
  }

  // 박공 벽(삼각) + 팀버 + 다락 둥근창
  const gs = new THREE.Shape(); gs.moveTo(-w / 2, 0); gs.lineTo(w / 2, 0); gs.lineTo(0, roofH); gs.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: d, bevelEnabled: false }), plaster);
  gable.position.set(0, topY, -d / 2); gable.castShadow = true; gable.userData.noOutline = true; g.add(gable);
  const a = Math.atan2(roofH, w / 2), ov = 0.8;
  for (const zs of [1, -1]) {
    const zf = zs * (d / 2 + 0.06);
    part(0.2, roofH * 0.86, 0.14, MATS.timber, 0, topY + roofH * 0.43, zf, g);
    for (const s of [-1, 1]) { const b = part(Math.hypot(w / 2, roofH) * 0.86, 0.16, 0.14, MATS.timber, s * (w / 4 - 0.12), topY + roofH / 2 - 0.2, zf, g); b.rotation.z = -s * a; }
  }
  const ac = new THREE.Vector3(0, topY + roofH * 0.42, d / 2 + 0.05);
  const att = new THREE.Mesh(new THREE.CircleGeometry(0.34, 22), MATS.glass); att.position.copy(ac); g.add(att);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.07, 8, 24), MATS.timber); ring.position.copy(ac); ring.userData.noOutline = true; g.add(ring);
  part(0.05, 0.7, 0.05, MATS.timber, ac.x, ac.y, ac.z + 0.04, g); part(0.7, 0.05, 0.05, MATS.timber, ac.x, ac.y, ac.z + 0.04, g);
  glow(g, ac.x, ac.y, ac.z + 0.5, 2.2, 0.55);

  // 지붕: 목재 + 두껍고 둥근 눈 + 처마 끝 늘어진 눈
  const ex = w / 2 + ov, ey = topY - ov * Math.tan(a), ay = topY + roofH + 0.05;
  const L = Math.hypot(ex, ay - ey), cx = ex / 2, cy = (ay + ey) / 2, RD = d + 1.5;
  for (const s of [-1, 1]) {
    const r = part(L, 0.2, d + 1.2, MATS.roof, s * cx, cy, 0, g, { out: true, shadow: true }); r.rotation.z = -s * a;
    const nx = s * Math.sin(a), ny = Math.cos(a);
    const sn = part(L * 0.97, 0.42, RD, MATS.snow, s * cx + nx * 0.3, cy + ny * 0.3, 0, g, { shadow: true }); sn.rotation.z = -s * a;
    const bulge = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, RD, 14), MATS.snow);       // 처마 끝 둥근 눈
    bulge.rotation.x = Math.PI / 2; bulge.scale.set(1, 1, 0.85); bulge.position.set(s * (ex - 0.08), ey + 0.32, 0); bulge.userData.noOutline = true; g.add(bulge);
    for (let i = 0; i < 9; i++) {                                                                  // 늘어진 눈
      const rr = 0.1 + rng() * 0.1;
      blob(g, rr, rr * (1.3 + rng() * 0.8), rr, s * (ex - 0.1), ey + 0.1 - rr * 0.6, -RD / 2 + 0.2 + i * (RD - 0.4) / 8 + (rng() - 0.5) * 0.15);
    }
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, RD, 14), MATS.snow);
  ridge.rotation.x = Math.PI / 2; ridge.position.set(0, ay + 0.2, 0); ridge.userData.noOutline = true; g.add(ridge);
  for (const zs of [-1, 1]) blob(g, 0.38, 0.38, 0.38, 0, ay + 0.2, zs * RD / 2);

  // 굴뚝 + 눈 + 연기
  const chx = w * 0.24, chy = topY + roofH * 0.52 + 0.75;
  part(0.85, 2.1, 0.85, MATS.stoneChim, chx, chy, -d * 0.15, g, { out: true, shadow: true });
  blob(g, 0.62, 0.22, 0.62, chx, chy + 1.1, -d * 0.15);
  addSmoke(g, chx, chy + 1.2, -d * 0.15);

  // 랜턴(문 옆) + 작은 나무 간판(앞마당)
  const lx = 0.9;
  part(0.5, 0.06, 0.06, MATS.timber, lx + 0.1, base + 1.95, 0.25, df);
  const lant = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(2.0) })); lant.position.set(lx + 0.3, base + 1.75, 0.3); df.add(lant);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 4), MATS.timber); cap.rotation.y = Math.PI / 4; cap.position.set(lx + 0.3, base + 1.99, 0.3); cap.userData.noOutline = true; df.add(cap);
  glow(df, lx + 0.3, base + 1.75, 0.5, 2.0, 0.9);
  if (sign) {   // 표지판은 상점에만
    part(0.12, 1.1, 0.12, MATS.timberLight, -2.4, 0.55, d / 2 + 1.7, g);
    const board = part(1.0, 0.5, 0.08, MATS.timberLight, -2.4, 1.05, d / 2 + 1.78, g, { out: true, shadow: true }); board.material = mat(0xffffff, { map: signTexture(sign) });
    blob(g, 0.55, 0.08, 0.14, -2.4, 1.33, d / 2 + 1.78);
  }

  // 장작더미 (오른쪽 벽 옆)
  const wp = new THREE.Group(); wp.position.set(w / 2 + 0.55, 0, -d * 0.12); g.add(wp);
  [[5, 0.13], [4, 0.37], [3, 0.61]].forEach(([n, yy], row) => {
    for (let i = 0; i < n; i++) {
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 1.2, 9), [MATS.log, MATS.logEnd, MATS.logEnd]);
      lg.rotation.x = Math.PI / 2; lg.position.set((i - (n - 1) / 2) * 0.255, yy, 0); lg.castShadow = true; lg.userData.noOutline = true; wp.add(lg);
    }
  });
  blob(wp, 0.78, 0.1, 0.66, 0, 0.78, 0);

  // 집 둘레 눈더미 (문 앞쪽은 비움)
  for (let i = 0; i < 9; i++) {
    const th = (0.8 + (i / 8) * (Math.PI * 2 - 1.6)) * (i % 2 ? 1 : 1), r = 0.55 + rng() * 0.75;
    blob(g, r, r * (0.45 + rng() * 0.15), r * (0.8 + rng() * 0.3), Math.sin(th) * (w / 2 + 0.9 + rng() * 0.6), 0, Math.cos(th) * (d / 2 + 0.9 + rng() * 0.6));
  }

  // 집 앞 주황빛
  if (light) { const pl = new THREE.PointLight(0xff9a3c, 9, 11, 2); pl.position.set(0, 2.1, d / 2 + 2.2); g.add(pl); }

  const dist = d / 2 + 2.1, fxw = x + Math.sin(phi) * dist, fzw = z + Math.cos(phi) * dist;
  HOUSES.push({ x, z, phi, w, d, base, h }); COLLIDERS.push({ x, z, r: Math.max(w, d) * 0.64 });
  g.userData.front = [fxw, fzw];
  return g;
}
// 마을배치도 기준 건물 6채: 집A(-16,4) 집B(-12,-14) 집C(12,-14) 집D(16,2) 상점(14,-6) 찻집(-14,-6)
const hA = house(-16, 4, 0xd6a96a, 1.4, { w: 5.8, d: 4.6, shutter: 0x2f5a7a });
const hB = house(-12, -14, 0xdcb878, 0.2, { shutter: 0x3f6b4a });
const hC = house(12, -14, 0xe3c796, -0.2, { shutter: 0x8a3a2a });
const hD = house(16, 2, 0xe0bf8a, -1.4, { w: 6, d: 4.6, shutter: 0x8a3f5a });
const hShop = house(14, -6, 0xd9b27a, -1.57, { w: 6.2, d: 4.8, sign: '상점', shutter: 0xb5483d });
const hTea = house(-14, -6, 0xdcb878, 1.57, { w: 5.8, d: 4.8, shutter: 0x2f5a7a });
// 길 (광장 → 각 집 문 앞)
pathRibbon([[0, 30], [0, 25], [1.2, 18], [0, 10]], 3.2);
pathRibbon([[-9, 2], [-13, 5], hA.userData.front], 2.6);
pathRibbon([[9, 1], [13, 3.5], hD.userData.front], 2.6);
pathRibbon([[-6, -8], [-9, -11], hB.userData.front], 2.6);
pathRibbon([[6, -8], [9, -11], hC.userData.front], 2.6);
pathRibbon([[8.5, -3], [9.2, -4.6], hShop.userData.front], 2.6);
pathRibbon([[-8.5, -3], [-9.2, -4.6], hTea.userData.front], 2.6);
pathRibbon([[0, -9], [-2, -14], [1, -19], [0, -23]], 1.8);
pathRibbon(Array.from({ length: 49 }, (_, i) => { const a = i / 48 * Math.PI * 2; return [Math.cos(a) * 11.9, Math.sin(a) * 11.9 + 1]; }), 3);

// 얼어붙은 개울 (마을배치도: 남쪽, 다리 아래)
const STREAMPTS = catmull([[-37, 26], [-20, 22], [0, 24], [20, 21], [37, 25]], 12);
{
  const bed = new THREE.Mesh(ribbonGeo(STREAMPTS, 5.4, 4), snowBedMat); bed.position.y = 0.02; bed.userData.noOutline = true; scene.add(bed);
  const ice = new THREE.Mesh(ribbonGeo(STREAMPTS, 3.4, 3), new THREE.MeshToonMaterial({ color: 0xb9dcf2, gradientMap: toonGrad, emissive: 0x2c4a6a, emissiveIntensity: 0.5 }));
  ice.position.y = 0.035; ice.receiveShadow = true; ice.userData.noOutline = true; scene.add(ice);
  const ice2 = new THREE.Mesh(ribbonGeo(STREAMPTS, 1.6, 3), new THREE.MeshToonMaterial({ color: 0xe0f3ff, gradientMap: toonGrad, emissive: 0x4a6a8a, emissiveIntensity: 0.4 }));
  ice2.position.y = 0.04; ice2.userData.noOutline = true; scene.add(ice2);
}

// 소품/나무/눈사람/가로등/눈더미: Kenney Holiday Kit (village.js, decor.js)
const village = await buildVillage({ THREE, scene, mat, toonGrad, rng, R, PLAZA, HOUSES, COLLIDERS, ROADPTS, PATHS, STREAMPTS, catmull, ribbonGeo, glow, glowTex, addOutlines, box, skyGroup, HOUSE_FRONTS: [hA, hB, hC, hD, hShop, hTea].map(h => h.userData.front),
  extra: (v, c) => buildDecor(v, c) });

// ---------- 붕어빵 노점 ----------
const STALL = new THREE.Vector3(0, 0, -6);
box(5, 1, 1.8, 0x9b6a3c, STALL.x, 0.5, STALL.z);          // 카운터
box(5.2, 0.1, 2, 0x6b4526, STALL.x, 1.03, STALL.z);        // 상판
[-2.4, 2.4].forEach(x => box(0.12, 3, 0.12, 0x6b4526, x, 2.4, STALL.z - 0.8));
[-2.4, 2.4].forEach(x => box(0.12, 3, 0.12, 0x6b4526, x, 2.4, STALL.z + 0.8));
const awning = box(5.6, 0.2, 2.6, 0xd9453d, STALL.x, 3.9, STALL.z);
awning.rotation.x = 0.12;
for (let i = -2; i <= 2; i++) box(0.5, 0.21, 2.62, 0xffffff, i * 1.1, 3.9, STALL.z).rotation.x = 0.12;
const sign = box(2.6, 0.7, 0.1, 0xfff1c9, 0, 3.3, STALL.z + 1.0);
{
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#fff1c9'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#b5483d'; x.font = 'bold 70px "Malgun Gothic"'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('🐟 붕어빵', 256, 68);
  sign.material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) });
}

// ---------- 붕어빵 틀 ----------
const MOLD_Y = 1.1;
const mold = new THREE.Group(); mold.position.set(STALL.x, MOLD_Y, STALL.z); scene.add(mold);
box(2.2, 0.16, 1.1, 0x2b2b30, 0, 0.08, 0, mold);
const slots = [];
const cols = [-0.7, 0, 0.7], rows = [-0.25, 0.25];
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
for (const rz of rows) for (const cx of cols) {
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.34), mat(0x111114));
  hole.userData.noOutline = true;
  hole.position.set(cx, 0.17, rz); mold.add(hole);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), hitMat);
  hit.position.set(cx, 0.3, rz); mold.add(hit);
  const slot = { x: cx, z: rz, state: 'empty', d: [0, 0], down: 0, flip: 0, flipT: 1, group: null, hit, batter: null };
  hit.userData.slot = slot; slots.push(slot);
}

function cookColor(d) {
  const stops = [[0, [0.96, 0.9, 0.62]], [0.5, [0.9, 0.7, 0.35]], [1.0, [0.78, 0.48, 0.14]], [1.3, [0.42, 0.22, 0.09]], [1.6, [0.07, 0.05, 0.04]]];
  d = Math.max(0, d);
  for (let i = 1; i < stops.length; i++) if (d <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const t = (d - a) / (b - a);
    return new THREE.Color(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
  }
  return new THREE.Color(0.05, 0.04, 0.03);
}

function makeFish() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 16, 10);
  const top = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf5e6a0 }));
  const bot = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf5e6a0 }));
  top.scale.set(0.27, 0.07, 0.15); top.position.y = 0.045;
  bot.scale.set(0.27, 0.07, 0.15); bot.position.y = -0.045;
  const tailGeo = new THREE.ConeGeometry(0.11, 0.18, 3);
  const tail = new THREE.Mesh(tailGeo, bot.material); tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.5); tail.position.x = -0.32;
  const tail2 = new THREE.Mesh(tailGeo, top.material); tail2.rotation.z = Math.PI / 2; tail2.scale.set(1, 1, 0.5); tail2.position.set(-0.32, 0.06, 0);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mat(0x222222)); eye.position.set(0.17, 0.11, 0.07);
  const eye2 = eye.clone(); eye2.position.z = -0.07;
  g.add(top, bot, tail, tail2, eye, eye2);
  g.userData = { top, bot, tail, tail2 };
  [top, bot].forEach(m => m.castShadow = true);
  return g;
}

function setSlotState(s, st) {
  s.state = st;
  if (s.group) { mold.remove(s.group); s.group = null; }
  if (st === 'batter' || st === 'bean') {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), mat(0xf4e3a1));
    b.scale.set(1.15, 1, 0.65); g.add(b);
    if (st === 'bean') {
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0x6b1f2a));
      bean.scale.set(1.4, 0.5, 0.9); bean.position.y = 0.04; g.add(bean);
    }
    g.position.set(s.x, 0.21, s.z); mold.add(g); s.group = g;
  } else if (st === 'cooking') {
    const f = makeFish(); f.position.set(s.x, 0.3, s.z); mold.add(f);
    s.group = f; s.d = [0, 0]; s.down = 1; s.flip = 0; s.flipT = 1;
  }
}

// ---------- 플레이어 / 손님 ----------
// 2등신 겨울 캐릭터 (characters.js: 옵션 조합식)
const { chubby, PRESETS, setOutfit } = createCharacterFactory({ THREE, mat, addOutlines, scene });
const player = chubby(PRESETS.player);
player.position.set(0, 0, 28.5);   // 마을배치도: 다리 건너편 스폰 (0,29)
const customer = chubby(PRESETS.kid);
const CUST_POS = new THREE.Vector3(3.8, 0, -3.4);
customer.position.copy(CUST_POS); customer.rotation.y = Math.PI;

window.__dbg = window.__dbg || {}; window.__dbg.player = player; window.__dbg.chubby = chubby; window.__dbg.PRESETS = PRESETS; window.__dbg.setOutfit = setOutfit;   // 개발용
// 마을 주민 5명 (손님 자리의 꼬마 포함 총 6명 + 플레이어): 집 앞/광장에 배치, 각자 다른 대기 모션
const NPC_LIST = [customer];
const NPC_SPOTS = { grandma: [-10.5, -9.2], postman: [12.2, 4.2], cafe: [-12.6, 2.4], prankster: [-4.6, 6.4] };
for (const [id, [x, z]] of Object.entries(NPC_SPOTS)) {
  const n = chubby(PRESETS[id]); n.position.set(x, 0, z);
  n.rotation.y = Math.atan2(PLAZA.x - x, PLAZA.z - z); n.userData.id = id; NPC_LIST.push(n);
}
window.__dbg.npcs = NPC_LIST;   // 개발용

addOutlines(scene);

// ---------- 눈 ----------
const SN = 1500;
const snowGeo = new THREE.BufferGeometry();
const sp = new Float32Array(SN * 3), sv = new Float32Array(SN);
for (let i = 0; i < SN; i++) { sp[i * 3] = (Math.random() - .5) * 60; sp[i * 3 + 1] = Math.random() * 25; sp[i * 3 + 2] = (Math.random() - .5) * 60; sv[i] = 1 + Math.random() * 1.5; }
snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
// 동그랗고 가장자리가 흐릿한 눈송이 텍스처
const flakeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: flakeTex, color: 0xdfe8ff, size: 0.28, transparent: true, opacity: 0.95, depthWrite: false }));
snow.frustumCulled = false; scene.add(snow);

// ---------- 게임 상태 ----------
let mode = 'third';           // 'third' | 'first'
let money = 0;
let tray = [];                // 구운 붕어빵 품질(0~1) 목록
let order = null;             // {n}
let orderTimer = 0;
const keys = {};
let yaw = 0, pitch = 0.45, camDist = 7, camDistTarget = 7;   // 휠로 camDistTarget을 바꾸면 camDist가 부드럽게 따라감 (3.5~16)
window.__dbg = Object.assign(window.__dbg || {}, { tp: (x, z, y = yaw, d = camDist, p = pitch) => { player.position.set(x, 0, z); yaw = y; camDist = camDistTarget = d; pitch = p; } });  // 개발용: 위치/시점 이동
let dragging = false;
let hoverSlot = null;
const mouse = new THREE.Vector2();
const ray = new THREE.Raycaster();

function newOrder() {
  order = { n: 1 + Math.floor(Math.random() * 3) };
  customer.visible = true;
  const cols = [0x7bbf6a, 0xbf7bb6, 0xbfa24a, 0x6aa6bf];
  updateHUD();
}
function updateHUD() {
  $('money').textContent = `💰 ${money}원`;
  $('inv').textContent = `🐟 쟁반: ${tray.length}개`;
  const o = $('order');
  if (order) { o.style.display = 'block'; o.innerHTML = `🧑 손님 주문<br><b>붕어빵 ${order.n}개</b> 주세요!`; }
  else o.style.display = 'none';
}
let msgT = 0;
function say(t, sec = 2) { const m = $('msg'); m.textContent = t; m.style.display = 'block'; msgT = sec; }
function setHelp() {
  $('help').textContent = mode === 'third'
    ? 'WASD / 방향키: 이동   마우스 드래그: 카메라   휠: 확대/축소   노점 앞에서 E: 붕어빵 굽기   손님 앞에서 E: 판매'
    : '🖱 좌클릭: 반죽 붓기 → 팥 넣기 → 뒤집기\n🖱 우클릭(또는 X): 꺼내기   ESC: 돌아가기\n앞뒤 모두 황금색일 때 꺼내면 최고!';
}

function enterFirst() {
  mode = 'first'; player.visible = false; warm.intensity = 26; setHelp(); $('msg').style.display = 'none';
}
function exitFirst() {
  mode = 'third'; player.visible = true; warm.intensity = 14; hoverSlot = null; setHelp();
}

// ---------- 입력 ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (mode === 'third' && k === 'e') interact();
  if (mode === 'first') {
    if (k === 'escape') exitFirst();
    if (k === 'x' && hoverSlot) takeOut(hoverSlot);
    if (k === ' ' && hoverSlot) clickSlot(hoverSlot);
  }
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
renderer.domElement.addEventListener('mousedown', e => {
  if (mode === 'third') { dragging = true; return; }
  if (!hoverSlot) return;
  if (e.button === 0) clickSlot(hoverSlot);
  else if (e.button === 2) takeOut(hoverSlot);
});
addEventListener('mouseup', () => dragging = false);
addEventListener('contextmenu', e => e.preventDefault());
// 휠/터치패드 핀치(ctrl+휠로 들어옴): 3인칭에서만 확대·축소
addEventListener('wheel', e => {
  e.preventDefault();
  if (mode === 'first') return;
  camDistTarget = THREE.MathUtils.clamp(camDistTarget + e.deltaY * (e.ctrlKey ? 0.03 : 0.006), 3.5, 16);
}, { passive: false });
addEventListener('mousemove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (mode === 'third' && dragging) { yaw -= e.movementX * 0.005; pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.004, 0.15, 1.2); }
});

function nearStall() { return player.position.distanceTo(new THREE.Vector3(0, 0, -4.3)) < 2.4; }
function nearCustomer() { return customer.visible && player.position.distanceTo(CUST_POS) < 2.2; }
function interact() {
  if (nearCustomer() && order) {
    if (tray.length < order.n) { say(`붕어빵이 부족해요! (${tray.length}/${order.n})`); return; }
    const used = tray.splice(0, order.n);
    const avg = used.reduce((a, b) => a + b, 0) / used.length;
    const pay = Math.round((300 + avg * 700) * used.length / 10) * 10;
    money += pay;
    const word = avg > 0.85 ? '완벽해요! 🌟' : avg > 0.55 ? '맛있네요 😊' : avg > 0.25 ? '음… 조금 아쉬워요' : '이건 숯인데요… 😢';
    say(`${word}  +${pay}원`, 3);
    order = null; customer.visible = false; orderTimer = 2.5; updateHUD();
  } else if (nearStall()) enterFirst();
}

function clickSlot(s) {
  if (s.state === 'empty') setSlotState(s, 'batter');
  else if (s.state === 'batter') setSlotState(s, 'bean');
  else if (s.state === 'bean') setSlotState(s, 'cooking');
  else if (s.state === 'cooking' && s.flipT >= 1) { s.flip = 1 - s.flip; s.down = 1 - s.down; s.flipT = 0; }
}
function quality(d) { return Math.max(0, 1 - Math.abs(d - 1.0) / 0.7); }
function takeOut(s) {
  if (s.state !== 'cooking') return;
  const q = (quality(s.d[0]) + quality(s.d[1])) / 2;
  tray.push(q);
  setSlotState(s, 'empty');
  const word = q > 0.85 ? '👍 완벽!' : q > 0.55 ? '괜찮아요' : q > 0.25 ? '설익었거나 탔어요' : '숯덩이…';
  say(`붕어빵 꺼냄 — ${word}`, 1.5); updateHUD();
}

// ---------- 루프 ----------
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
const FP_POS = new THREE.Vector3(0, 2.15, -4.7), FP_LOOK = new THREE.Vector3(0, 1.15, -6.0);
const desired = new THREE.Vector3();

setHelp(); newOrder();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  let moving = false;

  skyGroup.position.copy(camera.position);
  updateSmoke(dt, clock.elapsedTime);
  // 눈
  const p = snowGeo.attributes.position;
  for (let i = 0; i < SN; i++) {
    p.array[i * 3 + 1] -= sv[i] * dt;
    p.array[i * 3] += Math.sin(clock.elapsedTime + i) * 0.15 * dt;
    if (p.array[i * 3 + 1] < 0) p.array[i * 3 + 1] = 25;
  }
  p.needsUpdate = true;

  if (mode === 'third') {
    let mx = 0, mz = 0;
    if (keys['w'] || keys['arrowup']) mz -= 1; if (keys['s'] || keys['arrowdown']) mz += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1; if (keys['d'] || keys['arrowright']) mx += 1;
    if (mx || mz) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const vx = mx * cos + mz * sin, vz = -mx * sin + mz * cos;
      player.position.x += vx * 5 * dt; player.position.z += vz * 5 * dt;
      player.rotation.y = Math.atan2(vx, vz);
      moving = true;
    }
    // 충돌(카운터, 맵 경계)
    const pp = player.position;
    if (Math.abs(pp.x) < 2.9 && pp.z < -4.8 && pp.z > -7.4) pp.z = pp.z > -6 ? -4.8 : -7.4;
    const r = Math.hypot(pp.x, pp.z); if (r > 34) { pp.x *= 34 / r; pp.z *= 34 / r; }
    for (const c of COLLIDERS) { const dx = pp.x - c.x, dz = pp.z - c.z, dd = Math.hypot(dx, dz); if (dd < c.r) { pp.x = c.x + dx / dd * c.r; pp.z = c.z + dz / dd * c.r; } }
    // 카메라 (줌: camDist가 목표값을 부드럽게 따라가고, 멀리 볼수록 안개도 늘려서 먼 곳이 하얗게 안 날아감)
    camDist += (camDistTarget - camDist) * (1 - Math.pow(0.002, dt));
    scene.fog.near = 45 + Math.max(0, camDist - 7) * 8; scene.fog.far = 300 + Math.max(0, camDist - 7) * 40;
    desired.set(pp.x + Math.sin(yaw) * Math.cos(pitch) * camDist, pp.y + 1 + Math.sin(pitch) * camDist, pp.z + Math.cos(yaw) * Math.cos(pitch) * camDist);
    camera.position.lerp(desired, 1 - Math.pow(0.0005, dt));
    camTarget.set(pp.x, 1.2, pp.z); camera.lookAt(camTarget);
    if (!msgT) {
      if (nearCustomer() && order) say('E: 손님에게 붕어빵 건네기', 0.1);
      else if (nearStall()) say('E: 붕어빵 굽기 시작!', 0.1);
    }
    if (msgT === 0) $('msg').style.display = 'none';
  } else {
    camera.position.lerp(FP_POS, 1 - Math.pow(0.001, dt));
    camera.lookAt(FP_LOOK);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(slots.map(s => s.hit), false);
    hoverSlot = hits.length ? hits[0].object.userData.slot : null;
  }

  // 굽기
  for (const s of slots) {
    if (s.state === 'cooking') {
      s.d[s.down] += dt / 6;
      if (s.flipT < 1) s.flipT = Math.min(1, s.flipT + dt * 3);
      const f = s.group, ud = f.userData;
      const e = s.flipT, ang = (s.flip - (1 - e) * (s.flip ? 1 : -1)) * Math.PI;
      f.rotation.x = s.flip === 1 ? Math.PI * (s.flipT < 1 ? s.flipT : 1) : Math.PI * (1 - (s.flipT < 1 ? s.flipT : 1));
      f.position.y = 0.3 + Math.sin(Math.min(1, s.flipT) * Math.PI) * 0.35;
      // 위쪽 면(top)은 flip=0일 때 d[0], 아래(bot)는 d[1]
      ud.top.material.color.copy(cookColor(s.d[0]));
      ud.tail2.material.color.copy(cookColor(s.d[0]));
      ud.bot.material.color.copy(cookColor(s.d[1]));
      ud.tail.material.color.copy(cookColor(s.d[1]));
      if ((s.d[0] > 1.1 || s.d[1] > 1.1) && Math.random() < dt * 3) { /* 연기 효과 자리 */ }
    }
    if (s.group && s.state !== 'cooking') s.group.scale.setScalar(s === hoverSlot ? 1.1 : 1);
    else if (s.group) { /* 호버 강조 */ }
  }
  // 호버 하이라이트(틀 구멍)
  slots.forEach(s => s.hit.parent.children.forEach(() => { }));
  renderer.domElement.style.cursor = mode === 'first' && hoverSlot ? 'pointer' : 'default';

  // 텍스트/주문
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) { msgT = 0; $('msg').style.display = 'none'; } }
  if (!order) { orderTimer -= dt; if (orderTimer <= 0) newOrder(); }
  if (mode === 'third') warm.intensity = 14;

  village.update(dt, clock.elapsedTime, player, moving);
  player.userData.update(dt, clock.elapsedTime, moving); for (const n of NPC_LIST) n.userData.update(dt, clock.elapsedTime, false);
  if (USE_BLOOM) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
