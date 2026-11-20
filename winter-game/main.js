import * as THREE from 'three';

// ---------- 기본 세팅 ----------
const scene = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#9ccbef'); g.addColorStop(0.6, '#d8ecfa'); g.addColorStop(1, '#fde9ef');
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}
scene.fog = new THREE.Fog(0xe6eef8, 28, 75);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
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

scene.add(new THREE.HemisphereLight(0xe4f3ff, 0xd3c2e0, 1.35));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.0);
sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
sun.position.set(10, 20, 8); sun.castShadow = true;
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
const warm = new THREE.PointLight(0xffaa55, 0, 8); // 노점 불빛
warm.position.set(0, 2.2, -5.5); scene.add(warm);

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

// ---------- 월드 ----------
const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), mat(0xf3f8ff));
ground.userData.noOutline = true;
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

function tree(x, z) {
  box(0.4, 1.2, 0.4, 0x6b4a2b, x, 0.6, z);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.4, 1.8, 8), mat(0x2f6b4a));
    c.position.set(x, 1.8 + i * 1.0, z); c.castShadow = true; scene.add(c);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.9 - i * 0.2, 0.6, 8), mat(0xffffff));
    s.position.set(x, 2.4 + i * 1.0, z); scene.add(s);
  }
}
function house(x, z, color, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  box(5, 3, 4, color, 0, 1.5, 0, g);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.8, 4), mat(0xb5483d));
  roof.position.y = 3.9; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 0.7, 4), mat(0xffffff));
  cap.position.y = 4.4; cap.rotation.y = Math.PI / 4; g.add(cap);
  box(0.9, 1.6, 0.1, 0x7a4b2a, 0, 0.8, 2.02, g);
  box(0.8, 0.8, 0.1, 0xffe9a0, 1.5, 1.8, 2.02, g);
}
for (let i = 0; i < 26; i++) {
  const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 16;
  tree(Math.cos(a) * r, Math.sin(a) * r);
}
house(-12, -14, 0xf2d6a2, 0.2); house(12, -14, 0xc9e0c4, -0.2); house(-16, 4, 0xe9c5c5, 1.4);
house(16, 2, 0xc5d6e9, -1.4);

// 눈사람
(function snowman() {
  const g = new THREE.Group(); g.position.set(-5, 0, 4); scene.add(g);
  [[0.8, 0.8], [0.6, 1.9], [0.4, 2.7]].forEach(([r, y]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0xffffff)); s.position.y = y; s.castShadow = true; g.add(s);
  });
  const n = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 8), mat(0xff7a1a));
  n.position.set(0, 2.7, 0.4); n.rotation.x = Math.PI / 2; g.add(n);
})();

// 가로등
function lamp(x, z) {
  box(0.12, 3.2, 0.12, 0x333844, x, 1.6, z);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
  b.position.set(x, 3.3, z); scene.add(b);
}
lamp(-4, -2); lamp(5, -1); lamp(8, 8); lamp(-9, 8);

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
function person(shirt, hat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 12), mat(shirt)); body.position.y = 0.7; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat(0xffd9b5)); head.position.y = 1.45; head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat)); cap.position.y = 1.5;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0x222222)); eyeL.position.set(-0.1, 1.47, 0.24);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.1;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 16), mat(0xd9453d)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.22;
  g.add(body, head, cap, eyeL, eyeR, scarf); scene.add(g); return g;
}
const player = person(0x3f7fbf, 0xd9453d);
player.position.set(0, 0, 4);
const customer = person(0x7bbf6a, 0x555577);
const CUST_POS = new THREE.Vector3(3.8, 0, -3.4);
customer.position.copy(CUST_POS); customer.rotation.y = Math.PI;

// ---------- 눈 ----------
const SN = 1500;
const snowGeo = new THREE.BufferGeometry();
const sp = new Float32Array(SN * 3), sv = new Float32Array(SN);
for (let i = 0; i < SN; i++) { sp[i * 3] = (Math.random() - .5) * 60; sp[i * 3 + 1] = Math.random() * 25; sp[i * 3 + 2] = (Math.random() - .5) * 60; sv[i] = 1 + Math.random() * 1.5; }
snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.9 }));
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
  customer.children[0].material.color.setHex(cols[Math.floor(Math.random() * cols.length)]);
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
  mode = 'first'; player.visible = false; warm.intensity = 1.2; setHelp(); $('msg').style.display = 'none';
}
function exitFirst() {
  mode = 'third'; player.visible = true; warm.intensity = 0.6; hoverSlot = null; setHelp();
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
  if (mode === 'third') warm.intensity = 0.6;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
