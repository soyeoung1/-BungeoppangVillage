// 마을 소품: Kenney Holiday Kit(CC0) 모델을 불러와 토온 셰이딩 + 외곽선으로 마을 톤에 맞춰 배치한다.
// 배치는 마을배치도.html 기준. 모델 로드에 실패하면 코드로 만든 간단한 물체로 대체해서 게임이 멈추지 않는다.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 건물(cabin-*)은 쓰지 않는다. 울타리(cabin-fence)만 예외로 사용.
export const KIT_NAMES = [
  'tree', 'tree-snow-a', 'tree-snow-b', 'tree-snow-c', 'tree-decorated', 'tree-decorated-snow',
  'snowman', 'snowman-hat', 'snow-pile', 'snow-flat', 'snow-flat-large', 'snow-bunker', 'snowflake-a', 'snowflake-b', 'snowflake-c',
  'present-a-cube', 'present-a-rectangle', 'present-a-round', 'present-b-cube', 'present-b-rectangle', 'present-b-round',
  'candy-cane-green', 'candy-cane-red', 'gingerbread-man', 'gingerbread-woman', 'nutcracker', 'reindeer', 'wreath', 'wreath-decorated',
  'sock-green', 'sock-green-cane', 'sock-red', 'sock-red-cane', 'lights-colored', 'lights-green', 'lights-red', 'festivus-pole',
  'hanukkah-dreidel', 'hanukkah-menorah', 'hanukkah-menorah-candles', 'kwanzaa-kikombe', 'kwanzaa-kinara', 'kwanzaa-kinara-alternative',
  'sled', 'sled-long', 'rocks-small', 'rocks-medium', 'rocks-large',
  'lantern', 'lantern-hanging', 'bench', 'bench-short', 'cabin-fence', 'floor-stone', 'floor-wood', 'floor-wood-snow',
  'train-locomotive', 'train-tender', 'train-wagon', 'train-wagon-short', 'train-wagon-flat', 'train-wagon-flat-short', 'train-wagon-logs',
  'trainset-rail-straight', 'trainset-rail-bend', 'trainset-rail-corner', 'trainset-rail-detailed-straight', 'trainset-rail-detailed-bend', 'trainset-rail-detailed-corner',
];

export async function buildVillage(ctx) {
  const { THREE, scene, mat, toonGrad, rng, R, PLAZA, HOUSES, COLLIDERS, ROADPTS, PATHS, glow } = ctx, STREAMPTS = ctx.STREAMPTS || [];
  const loadingEl = document.getElementById('loading');

  // ───────── ① 불러오기: 한 번만 읽고 clone/인스턴싱으로 재사용 ─────────
  const kit = {}, failed = [];
  const loader = new GLTFLoader();
  const TINT = new THREE.Color(0xe4ecff);                                   // 마을의 푸른 밤 톤에 맞춘 약한 색 보정
  function prepare(root, name) {
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root), c = bb.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group(); wrap.add(root);
    root.position.x -= c.x; root.position.z -= c.z; if (!name.includes('hanging')) root.position.y -= bb.min.y;
    wrap.traverse(o => {
      if (!o.isMesh) return;
      const old = o.material, map = old.map;
      if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true; }
      const col = old.color ? old.color.clone().multiply(TINT) : TINT.clone();     // 텍스처 없는 모델은 재질 색 그대로
      o.material = new THREE.MeshToonMaterial(map ? { map, gradientMap: toonGrad, color: TINT, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.1 } : { gradientMap: toonGrad, color: col, emissive: col, emissiveIntensity: 0.08 });
      o.castShadow = true; o.receiveShadow = true; o.userData.noOutline = true;
    });
    return wrap;
  }
  let done = 0;
  await Promise.all(KIT_NAMES.map(async n => {
    try { kit[n] = prepare((await loader.loadAsync(`assets/holiday/${n}.glb`)).scene, n); }
    catch (e) { failed.push(n); }
    if (loadingEl) loadingEl.textContent = `마을 불러오는 중... ${Math.round(++done / KIT_NAMES.length * 100)}%`;
  }));
  if (failed.length) console.warn('[village] 로드 실패 → 코드 물체로 대체:', failed.join(', '));
  if (loadingEl) loadingEl.style.display = 'none';
  const has = n => !!kit[n];

  // 외곽선: 같은 모델을 살짝 키운 뒤 뒤집어 그린다 (플랫 셰이딩 모델은 법선 확장 방식이 갈라져서 '확대' 방식 사용)
  const kitOutlineMat = new THREE.MeshBasicMaterial({ color: 0x2a2438, side: THREE.BackSide });
  kitOutlineMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position * 1.035;'); };
  kitOutlineMat.customProgramCacheKey = () => 'kitOutline';
  function addKitOutline(root) {
    const list = []; root.traverse(o => { if (o.isMesh && !o.userData.isOutline) list.push(o); });
    for (const m of list) { const o = new THREE.Mesh(m.geometry, kitOutlineMat); o.userData.isOutline = o.userData.noOutline = true; m.add(o); }
  }

  // 모델 한 개 놓기 (크기 ±15%, 회전, 살짝 기울임 랜덤)
  const sway = [];
  function prop(name, x, z, o = {}) {
    if (!has(name)) return null;
    const g = kit[name].clone(true), s = (o.s ?? 1) * (o.fixed ? 1 : R(0.88, 1.14)), tilt = o.fixed ? 0 : R(-0.035, 0.035);
    g.scale.setScalar(s); g.position.set(x, o.y ?? 0, z); g.rotation.set(tilt, o.rot ?? R(0, Math.PI * 2), tilt * 0.7);
    scene.add(g); if (o.out !== false) addKitOutline(g);
    if (o.collide) COLLIDERS.push({ x, z, r: o.collide * s });
    if (o.sway) sway.push({ g, ph: R(0, 6), amp: o.sway });
    return g;
  }
  // 인스턴싱: 같은 모델 수백 개를 draw call 몇 번으로
  function instanced(name, list, out = false) {
    if (!has(name)) return null;
    const src = kit[name]; src.updateMatrixWorld(true); const inv = src.matrixWorld.clone().invert(), grp = new THREE.Group(), tmp = new THREE.Matrix4();
    src.traverse(m => {
      if (!m.isMesh || m.userData.isOutline) return;
      const rel = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      list.forEach((t, i) => im.setMatrixAt(i, tmp.multiplyMatrices(t, rel)));
      im.instanceMatrix.needsUpdate = true; im.userData.noOutline = true; im.castShadow = false; im.frustumCulled = false; grp.add(im);
      if (out) { const om = new THREE.InstancedMesh(m.geometry, kitOutlineMat, list.length); om.instanceMatrix = im.instanceMatrix; om.userData.noOutline = true; om.frustumCulled = false; grp.add(om); }
    });
    scene.add(grp); return grp;
  }
  const xf = (x, z, s, rot = 0, y = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s));

  // 코드로 만든 대체 물체 (모델이 없을 때)
  const fallbackTree = (x, z, s) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s * 1.2); scene.add(g);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8), mat(0x6b4a2b)); t.position.y = 0.4; g.add(t);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.25, 1.3, 9), mat(0x2f6b4a)); c.position.y = 1.3 + i * 0.8; g.add(c);
      const sn = new THREE.Mesh(new THREE.ConeGeometry(0.85 - i * 0.22, 0.9, 9), mat(0xf4f8ff)); sn.position.y = 1.55 + i * 0.8; g.add(sn); } return g; };

  // 공통 판정
  const KEEP = [[0, 1, 10.5], [0, -6, 5], [0, -24, 4.5], [0, 29.5, 6.5], [0, 24, 5.5], [3.4, 13, 1], [-3, 19, 1]];
  const dPath = (x, z) => { let d = 1e9; for (const p of ROADPTS) { const e = Math.hypot(x - p[0], z - p[1]); if (e < d) d = e; } return d; };
  const dStream = (x, z) => { let d = 1e9; for (const p of STREAMPTS) { const e = Math.hypot(x - p[0], z - p[1]); if (e < d) d = e; } return d; };
  const nearHouse = (x, z, r) => HOUSES.some(h => Math.hypot(h.x - x, h.z - z) < r);
  const inKeep = (x, z) => KEEP.some(k => Math.hypot(x - k[0], z - k[1]) < k[2]);
  const free = (x, z, pathD = 3.4, houseD = 6.5) => dPath(x, z) > pathD && dStream(x, z) > 3.2 && !nearHouse(x, z, houseD) && !inKeep(x, z);
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

  // ───────── ② 나무: tree() 원뿔 나무 → Kenney 나무 (눈 얹힌 종류를 섞어서) ─────────
  const TREE_KINDS = ['tree-snow-a', 'tree-snow-b', 'tree-snow-c', 'tree-snow-a', 'tree-snow-b', 'tree'];
  const trees = { near: [], mid: [] };
  for (let i = 0; i < 2600 && trees.near.length + trees.mid.length < 95; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 35, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < 14 && rng() < 0.85) continue;                          // 마을 안쪽은 듬성듬성
    if (r < 22 && rng() < (22 - r) / 9 * 0.6) continue;            // 22m 안쪽으로 갈수록 성기게
    if (!free(x, z)) continue;
    const s = (0.95 + rng() * 0.7 + (r > 26 ? 0.3 : 0)) * 3.4;      // 숲 띠(22~34m)는 더 크고 촘촘
    (r < 27 ? trees.near : trees.mid).push({ x, z, s, r, kind: TREE_KINDS[Math.floor(rng() * TREE_KINDS.length)] });
  }
  for (const t of trees.near) {                                    // 마을과 가까운 나무: 개별 모델 (충돌 + 바람에 흔들림)
    if (has(t.kind)) prop(t.kind, t.x, t.z, { s: t.s, collide: 0.28, sway: 0.016 }); else fallbackTree(t.x, t.z, t.s * 0.5);
    if (!has(t.kind)) COLLIDERS.push({ x: t.x, z: t.z, r: 0.6 });
  }
  const byKind = {}; for (const t of trees.mid) (byKind[t.kind] ||= []).push(t);
  for (const [k, list] of Object.entries(byKind)) {                // 숲 띠: 인스턴싱 (+외곽선)
    if (has(k)) { instanced(k, list.map(t => xf(t.x, t.z, t.s, rng() * 6)), true); for (const t of list) COLLIDERS.push({ x: t.x, z: t.z, r: 0.28 * t.s }); }
    else list.forEach(t => { fallbackTree(t.x, t.z, t.s * 0.5); COLLIDERS.push({ x: t.x, z: t.z, r: 0.6 }); });
  }
  {                                                                // 먼 숲 (산 앞): 대충, 인스턴싱만
    const far = [], N = 140;
    for (let i = 0; i < N; i++) { const a = rng() * Math.PI * 2, r = R(40, 105); far.push(xf(Math.cos(a) * r, Math.sin(a) * r, R(4.5, 8), rng() * 6)); }
    if (has('tree-snow-a')) { instanced('tree-snow-a', far.filter((_, i) => i % 2 === 0)); instanced('tree-snow-b', far.filter((_, i) => i % 2 === 1)); }
    else { const cg = new THREE.ConeGeometry(1.5, 3.6, 7), im = new THREE.InstancedMesh(cg, mat(0x1f4a44), N); far.forEach((m, i) => im.setMatrixAt(i, m)); im.userData.noOutline = true; scene.add(im); }
  }

  // ───────── 갱신 루프 ─────────
  const state = { prop, instanced, xf, kit, has, free, dPath, nearHouse, inKeep, hash, addKitOutline, fallbackTree, KEEP, failed };
  function update(dt, t, player, moving) {
    for (const s of sway) { s.g.rotation.z = Math.sin(t * 0.8 + s.ph) * s.amp; s.g.rotation.x = Math.cos(t * 0.65 + s.ph * 1.3) * s.amp * 0.6; }
    for (const f of (state.updaters || [])) f(dt, t, player, moving);
  }
  state.update = update; state.sway = sway; state.trees = trees;
  if (ctx.extra) await ctx.extra(state, ctx);
  return state;
}
