import * as THREE from 'three';

// ---------- 기본 세팅 (푸른 저녁 밤 분위기) ----------
const scene = new THREE.Scene();
const FOG_COLOR = 0x8ca8db;                       // 하늘 지평선 색과 맞춰서 땅 끝이 하늘과 자연스럽게 이어짐
scene.fog = new THREE.Fog(FOG_COLOR, 45, 300);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 700);
camera.position.set(0, 6, 11);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.HemisphereLight(0x9bb8ff, 0x5a6890, 1.15));     // 푸른 밤하늘빛
const sun = new THREE.DirectionalLight(0xbcd2ff, 0.85);              // 달빛
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
function addOutlines(root, t = 0.035) {
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
const PLAZA = new THREE.Vector3(3, 0, -2), PLAZA_R = 11;

// 하늘: 카메라를 따라다니는 돔 + 별 + 달 (그래서 맵 끝이 보이지 않음)
const skyGroup = new THREE.Group(); scene.add(skyGroup);
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vp; void main(){ vp=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vp; void main(){
      float h = normalize(vp).y;
      vec3 top = vec3(0.04,0.09,0.25), mid = vec3(0.15,0.29,0.56), hor = vec3(0.549,0.659,0.859), warm = vec3(0.95,0.74,0.64);
      vec3 c = mix(hor, mid, smoothstep(0.0,0.32,h));
      c = mix(c, top, smoothstep(0.28,0.85,h));
      float band = exp(-pow((h-0.05)/0.05, 2.0)) * smoothstep(0.0,0.03,h);
      c = mix(c, warm, band*0.45);
      gl_FragColor = vec4(c,1.0); }`
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

// 멀리 보이는 숲 (인스턴싱으로 가볍게)
{
  const N = 260, cg = new THREE.ConeGeometry(1.5, 3.6, 7), sg = new THREE.ConeGeometry(1.05, 1.7, 7);
  const a = new THREE.InstancedMesh(cg, mat(0x1f4a44), N), b = new THREE.InstancedMesh(sg, mat(0xf5f8ff), N), d = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const ang = rng() * Math.PI * 2, rr = R(46, 105), s = R(1, 2.6);
    d.position.set(Math.cos(ang) * rr, 1.8 * s, Math.sin(ang) * rr); d.scale.setScalar(s); d.rotation.y = rng() * 6; d.updateMatrix(); a.setMatrixAt(i, d.matrix);
    d.position.y = 3.3 * s; d.updateMatrix(); b.setMatrixAt(i, d.matrix);
  }
  a.userData.noOutline = b.userData.noOutline = true; scene.add(a, b);
}

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
const ROADS = [];
function flat(geo, material, y, x = 0, z = 0) {
  const m = new THREE.Mesh(geo, material); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.receiveShadow = true; m.userData.noOutline = true; scene.add(m); return m;
}
// 광장
flat(new THREE.RingGeometry(PLAZA_R - 0.5, PLAZA_R + 1.3, 56), snowBedMat, 0.02, PLAZA.x, PLAZA.z);
flat(new THREE.CircleGeometry(PLAZA_R, 56), cobbleMat(PLAZA_R * 2, PLAZA_R * 2), 0.045, PLAZA.x, PLAZA.z);
// 길
function road(x1, z1, x2, z2, wd = 2.8) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const g = new THREE.Group(); g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); g.rotation.y = Math.atan2(dx, dz); scene.add(g);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(wd + 1.0, len + 0.8), snowBedMat); bed.rotation.x = -Math.PI / 2; bed.position.y = 0.02; bed.receiveShadow = true; bed.userData.noOutline = true; g.add(bed);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, len), cobbleMat(wd, len)); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.receiveShadow = true; m.userData.noOutline = true; g.add(m);
  ROADS.push([x1, z1, x2, z2]);
}
function distSeg(px, pz, [x1, z1, x2, z2]) {
  const dx = x2 - x1, dz = z2 - z1, t = THREE.MathUtils.clamp(((px - x1) * dx + (pz - z1) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
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

// 스위스풍 오두막
const HOUSES = [], COLLIDERS = [];
const GLASS = new THREE.MeshBasicMaterial({ color: 0xffcf6a });
function winFrame(parent, x, y, wd, ht, zf, shutter) {
  box(wd + 0.22, ht + 0.22, 0.1, 0x4a2f1c, x, y, zf + 0.03, parent);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(wd, ht, 0.1), GLASS); gl.position.set(x, y, zf + 0.07); parent.add(gl);
  box(0.06, ht, 0.06, 0x4a2f1c, x, y, zf + 0.13, parent); box(wd, 0.06, 0.06, 0x4a2f1c, x, y, zf + 0.13, parent);
  box(wd + 0.5, 0.1, 0.36, 0xffffff, x, y - ht / 2 - 0.16, zf + 0.15, parent);               // 창틀 위 눈
  if (shutter !== undefined) for (const s of [-1, 1]) box(0.3, ht + 0.22, 0.08, shutter, x + s * (wd / 2 + 0.3), y, zf + 0.04, parent);
  glow(parent, x, y, zf + 0.5, wd * 2.6, 0.55);
}
function chalet(x, z, o = {}) {
  const { w = 6, d = 4.6, h = 2.7, roofH = 2.3, wall = 0x8a5a34, plaster = 0xf0dcb4, shutter = 0x3f6b4a, light = false } = o;
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const phi = Math.atan2(PLAZA.x - x, PLAZA.z - z); g.rotation.y = phi; scene.add(g);
  const topY = 0.5 + h;
  box(w + 0.3, 0.5, d + 0.3, 0x8d8a99, 0, 0.25, 0, g);                                    // 돌 기단
  box(w, h * 0.45, d, plaster, 0, 0.5 + h * 0.225, 0, g);                                  // 아래층 회벽
  box(w, h * 0.55, d, wall, 0, 0.5 + h * 0.45 + h * 0.275, 0, g);                          // 위층 통나무
  for (let i = 0; i < 3; i++) box(w + 0.05, 0.07, d + 0.05, 0x5c3a20, 0, 0.5 + h * 0.45 + h * (0.14 + i * 0.19), 0, g);
  box(0.22, h + 0.5, 0.22, 0x5c3a20, -w / 2, (h + 0.5) / 2 + 0.25, d / 2, g); box(0.22, h + 0.5, 0.22, 0x5c3a20, w / 2, (h + 0.5) / 2 + 0.25, d / 2, g);
  // 박공 벽
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, roofH); sh.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }), mat(wall));
  gable.position.set(0, topY, -d / 2); gable.castShadow = true; gable.userData.noOutline = true; g.add(gable);
  const att = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), GLASS); att.position.set(0, topY + roofH * 0.38, d / 2 + 0.03); g.add(att);
  glow(g, 0, topY + roofH * 0.38, d / 2 + 0.5, 2.4, 0.6);
  // 지붕 + 눈
  const a = Math.atan2(roofH, w / 2), ov = 0.65, ex = w / 2 + ov, ey = topY - ov * Math.tan(a), ay = topY + roofH + 0.05;
  const len = Math.hypot(ex, ay - ey), cx = ex / 2, cy = (ay + ey) / 2;
  for (const s of [-1, 1]) {
    const r = box(len, 0.2, d + 1.1, 0x5a3a2a, s * cx, cy, 0, g); r.rotation.z = -s * a;
    const sn = box(len * 0.98, 0.3, d + 1.2, 0xffffff, s * (cx + Math.sin(a) * 0.2), cy + Math.cos(a) * 0.2, 0, g); sn.rotation.z = -s * a;
  }
  box(0.7, 0.34, d + 1.2, 0xffffff, 0, ay + 0.1, 0, g);
  // 굴뚝
  box(0.65, 1.8, 0.65, 0x7a5a4a, w * 0.25, topY + roofH * 0.4 + 0.9, -d * 0.15, g);
  box(0.9, 0.18, 0.9, 0xffffff, w * 0.25, topY + roofH * 0.4 + 1.85, -d * 0.15, g);
  // 문 + 현관 지붕 + 등불
  const dx = -w * 0.22;
  box(1.1, 1.8, 0.1, 0x6b4526, dx, 0.5 + 0.9, d / 2 + 0.04, g); box(1.3, 0.12, 0.14, 0x4a2f1c, dx, 2.35, d / 2 + 0.06, g);
  const dk = box(0.12, 0.1, 0.1, 0xffd36e, dx + 0.35, 1.5, d / 2 + 0.12, g); dk.visible = false;
  const lant = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffdf8a })); lant.position.set(dx + 0.95, 2.0, d / 2 + 0.2); g.add(lant);
  glow(g, dx + 0.95, 2.0, d / 2 + 0.3, 2.0, 0.9);
  const awn = box(2.0, 0.14, 1.1, 0x5a3a2a, dx, 2.65, d / 2 + 0.55, g); awn.rotation.x = 0.12;
  const awnS = box(2.1, 0.2, 1.15, 0xffffff, dx, 2.8, d / 2 + 0.55, g); awnS.rotation.x = 0.12;
  // 창문 (앞 / 양옆)
  winFrame(g, w * 0.24, 0.5 + h * 0.3, 1.0, 0.9, d / 2, shutter);
  winFrame(g, -w * 0.28, 0.5 + h * 0.74, 0.9, 0.8, d / 2, shutter); winFrame(g, w * 0.28, 0.5 + h * 0.74, 0.9, 0.8, d / 2, shutter);
  for (const s of [-1, 1]) {
    const side = new THREE.Group(); side.position.set(s * w / 2, 0, 0); side.rotation.y = s * Math.PI / 2; g.add(side);
    winFrame(side, -d * 0.2, 0.5 + h * 0.4, 0.9, 0.85, 0, shutter); winFrame(side, d * 0.2, 0.5 + h * 0.4, 0.9, 0.85, 0, shutter);
  }
  if (light) {
    const pl = new THREE.PointLight(0xffb84d, 14, 12, 2); pl.position.set(dx, 2.4, d / 2 + 1.6); g.add(pl);
  }
  // 문 앞 지점 (길 연결용)
  const fx = x + (dx * Math.cos(phi) + (d / 2 + 1.5) * Math.sin(phi)), fz = z + (-dx * Math.sin(phi) + (d / 2 + 1.5) * Math.cos(phi));
  HOUSES.push({ x, z }); COLLIDERS.push({ x, z, r: Math.max(w, d) * 0.62 });
  road(PLAZA.x, PLAZA.z, fx, fz);
  return g;
}
chalet(-15, -13, { wall: 0x8a5a34, shutter: 0x3f6b4a, light: true });
chalet(15, -13, { wall: 0x7a4e2c, shutter: 0xb5483d, plaster: 0xe9d3c5, light: true });
chalet(-19, 4, { w: 5.4, d: 4.4, wall: 0x94623a, shutter: 0x2f5a7a, light: true });
chalet(19, 6, { w: 5.6, d: 4.4, wall: 0x7d5232, shutter: 0x8a3f5a, plaster: 0xdfe8d2, light: true });
chalet(-6, -21, { w: 7, d: 5, h: 3, wall: 0x6f4a2d, shutter: 0xb5483d });
chalet(-25, -7, { w: 5.6, d: 4.6, wall: 0x8a5a34, shutter: 0x3f6b4a });
chalet(25, -4, { w: 6, d: 4.6, wall: 0x94623a, shutter: 0x2f5a7a });
chalet(-9, 19, { w: 6, d: 4.6, wall: 0x7a4e2c, shutter: 0x8a3f5a });
chalet(13, 19, { w: 5.6, d: 4.4, wall: 0x8a5a34, shutter: 0xb5483d });

// 눈 쌓인 소나무 (건물/길을 피해서)
// 나무 한 층: 위가 뾰족하고 아래로 갈수록 퍼지는 종 모양, 가장자리는 들쭉날쭉 (낮은 폴리 + 각진 면)
function tierGeo(r, h, lift = 0, valley = 0, seed = 0, scale = 1) {
  const seg = 10, g = new THREE.ConeGeometry(r, h, seg, 2, true), pos = g.attributes.position;
  const rad = t => r * (t < 0.5 ? 0.62 * (t / 0.5) : 0.62 + 0.38 * ((t - 0.5) / 0.5));
  const hash = k => { const v = Math.sin((k + 1) * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < pos.count; i++) {
    const row = Math.floor(i / (seg + 1)), col = i % (seg + 1), c = col % seg, a = col / seg * Math.PI * 2;
    let t = row * 0.5, rr;
    if (row === 2) {
      const dip = c % 2 ? valley : lift;                       // 눈 아랫단: 뾰족/오목 번갈아
      t = 1 - (dip + hash(c) * 0.08 * h) / h; rr = rad(t) * (c % 2 ? 0.92 : 1.04) * (0.94 + hash(c + 9) * 0.12);
    } else rr = rad(t) * (row === 1 ? 0.95 + hash(c + 4) * 0.1 : 1);
    pos.setXYZ(i, Math.sin(a) * rr * scale, h / 2 - t * h, Math.cos(a) * rr * scale);
  }
  const f = g.toNonIndexed(); f.computeVertexNormals(); return f;
}
function tree(x, z, sc = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(sc); g.rotation.y = rng() * 6; scene.add(g);
  box(0.5, 1.2, 0.5, 0x6b4a2b, 0, 0.6, 0, g);
  const tiers = [[2.5, 2.0, 0.9], [2.1, 1.9, 1.8], [1.7, 1.8, 2.7], [1.3, 1.7, 3.55], [0.9, 1.6, 4.3]];
  tiers.forEach(([r, h, y], i) => {
    const green = new THREE.Mesh(tierGeo(r, h, 0, 0, i), mat(i % 2 ? 0x3a8348 : 0x2f7a46));
    green.position.y = y + h / 2; green.rotation.y = i * 0.7; green.castShadow = true; green.userData.noOutline = true; g.add(green);
    const snow = new THREE.Mesh(tierGeo(r, h, h * 0.04, h * 0.26, i + 5, 1.035), mat(0xf4f8ff));
    snow.position.y = y + h / 2 + 0.03; snow.rotation.y = green.rotation.y; snow.castShadow = true; snow.userData.noOutline = true; g.add(snow);
  });
}
const clear = (x, z, hr, rr, pr) => HOUSES.every(h => Math.hypot(h.x - x, h.z - z) > hr) && ROADS.every(r => distSeg(x, z, r) > rr) && Math.hypot(x - PLAZA.x, z - PLAZA.z) > pr;
for (let n = 0, i = 0; n < 10 && i < 400; i++) {
  const a = rng() * Math.PI * 2, r = R(16, 40), x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (clear(x, z, 8, 3.2, PLAZA_R + 2)) { tree(x, z, R(0.9, 1.35)); n++; }
}
// 마을 가까이에도 큼직한 나무 몇 그루
for (let n = 0, i = 0; n < 6 && i < 400; i++) {
  const a = rng() * Math.PI * 2, r = R(12, 24), x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (clear(x, z, 6.5, 3.6, PLAZA_R + 0.8)) { tree(x, z, R(1.2, 1.6)); n++; }
}
// 눈 더미
for (let n = 0, i = 0; n < 46 && i < 500; i++) {
  const a = rng() * Math.PI * 2, r = R(8, 55), x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (!clear(x, z, 6, 3.4, PLAZA_R + 1.5)) continue;
  const s = R(1.2, 4), m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), mat(0xffffff));
  m.scale.set(s, s * R(0.22, 0.36), s * R(0.8, 1.2)); m.position.set(x, 0, z); m.receiveShadow = true; m.userData.noOutline = true; scene.add(m); n++;
}

// 눈사람
(function snowman() {
  const g = new THREE.Group(); g.position.set(-5, 0, 4); scene.add(g);
  [[0.8, 0.8], [0.6, 1.9], [0.4, 2.7]].forEach(([r, y]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0xffffff)); s.position.y = y; s.castShadow = true; g.add(s);
  });
  const n = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 8), mat(0xff7a1a));
  n.position.set(0, 2.7, 0.4); n.rotation.x = Math.PI / 2; g.add(n);
})();

// 가로등 (따뜻한 노란 불빛)
function lamp(x, z, withLight = false) {
  box(0.14, 3.2, 0.14, 0x2f3340, x, 1.6, z);
  box(0.5, 0.12, 0.5, 0x2f3340, x, 3.25, z);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  b.position.set(x, 3.5, z); scene.add(b);
  glow(scene, x, 3.5, z, 3.6, 0.9);
  if (withLight) { const pl = new THREE.PointLight(0xffc766, 10, 11, 2); pl.position.set(x, 3.3, z); scene.add(pl); }
}
lamp(-4, -2, true); lamp(8, -1, true); lamp(9, 8); lamp(-9, 8); lamp(-8, -9); lamp(14, -8); lamp(-1, 14); lamp(5, 13);

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
// 통통한 캐릭터: 큰 구체 몸통 + 큰 머리 + 볼터치
function chubby(o = {}) {
  const { shirt = 0x3f7fbf, skin = 0xffdcc0, scarf = 0xd9453d, hat = { type: 'beanie', color: 0xd9453d } } = o;
  const g = new THREE.Group();
  const S = (r, c, sx = 1, sy = 1, sz = 1, noOut = false) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(c));
    m.scale.set(sx, sy, sz); m.castShadow = true; if (noOut) m.userData.noOutline = true; return m;
  };
  const body = S(0.5, shirt, 1, 0.95, 0.95); body.position.y = 0.5;
  const head = S(0.46, skin); head.position.y = 1.3;
  const eyeL = S(0.045, 0x2a2438, 1, 1.3, 0.6, true); eyeL.position.set(-0.15, 1.33, 0.41);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.15;
  const chL = S(0.065, 0xff9fb0, 1, 0.7, 0.4, true); chL.position.set(-0.27, 1.2, 0.36);
  const chR = chL.clone(); chR.position.x = 0.27;
  const armL = S(0.15, shirt); armL.position.set(-0.52, 0.6, 0.05);
  const armR = armL.clone(); armR.position.x = 0.52;
  const footL = S(0.17, 0x5a4a6a, 1, 0.7, 1.3); footL.position.set(-0.2, 0.1, 0.1);
  const footR = footL.clone(); footR.position.x = 0.2;
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 20), mat(scarf));
  sc.rotation.x = Math.PI / 2; sc.position.y = 0.98;
  g.add(body, head, eyeL, eyeR, chL, chR, armL, armR, footL, footR, sc);
  const hc = hat.color;
  if (hat.type === 'beanie' || hat.type === 'bear') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.49, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(hc));
    cap.position.y = 1.32; cap.castShadow = true; g.add(cap);
    if (hat.type === 'beanie') { const p = S(0.11, 0xffffff); p.position.y = 1.84; g.add(p); }
    else for (const sx of [-1, 1]) { const e = S(0.14, hc); e.position.set(sx * 0.32, 1.73, 0); g.add(e); }
  } else if (hat.type === 'santa') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 14), mat(0xd9302a));
    cone.position.set(0, 1.9, 0); cone.rotation.z = 0.15; cone.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.08, 8, 20), mat(0xffffff));
    band.rotation.x = Math.PI / 2; band.position.y = 1.55;
    const p = S(0.1, 0xffffff); p.position.set(0.14, 2.3, 0);
    g.add(cone, band, p);
  }
  g.userData.body = body; g.userData.arms = [armL, armR];
  g.userData.shirtMeshes = [body, armL, armR];
  scene.add(g); return g;
}
const player = chubby({ shirt: 0x3f7fbf });
player.position.set(0, 0, 4);
const customer = chubby({ shirt: 0x7bbf6a, hat: { type: 'beanie', color: 0x6a6a99 }, scarf: 0xf2c14e });
const CUST_POS = new THREE.Vector3(3.8, 0, -3.4);
customer.position.copy(CUST_POS); customer.rotation.y = Math.PI;

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
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: flakeTex, color: 0xffffff, size: 0.28, transparent: true, opacity: 0.95, depthWrite: false }));
snow.frustumCulled = false; scene.add(snow);

// ---------- 게임 상태 ----------
let mode = 'third';           // 'third' | 'first'
let money = 0;
let tray = [];                // 구운 붕어빵 품질(0~1) 목록
let order = null;             // {n}
let orderTimer = 0;
const keys = {};
let yaw = 0, pitch = 0.45, camDist = 7;
let dragging = false;
let hoverSlot = null;
const mouse = new THREE.Vector2();
const ray = new THREE.Raycaster();

function newOrder() {
  order = { n: 1 + Math.floor(Math.random() * 3) };
  customer.visible = true;
  const cols = [0x7bbf6a, 0xbf7bb6, 0xbfa24a, 0x6aa6bf];
  customer.userData.shirtMeshes.forEach(m => m.material.color.setHex(cols[Math.floor(Math.random() * cols.length)]));
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
    ? 'WASD / 방향키: 이동   마우스 드래그: 카메라   노점 앞에서 E: 붕어빵 굽기   손님 앞에서 E: 판매'
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

  skyGroup.position.copy(camera.position);
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
      player.position.y = Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.06;
    }
    // 충돌(카운터, 맵 경계)
    const pp = player.position;
    if (Math.abs(pp.x) < 2.9 && pp.z < -4.8 && pp.z > -7.4) pp.z = pp.z > -6 ? -4.8 : -7.4;
    const r = Math.hypot(pp.x, pp.z); if (r > 34) { pp.x *= 34 / r; pp.z *= 34 / r; }
    for (const c of COLLIDERS) { const dx = pp.x - c.x, dz = pp.z - c.z, dd = Math.hypot(dx, dz); if (dd < c.r) { pp.x = c.x + dx / dd * c.r; pp.z = c.z + dz / dd * c.r; } }
    // 카메라
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

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
