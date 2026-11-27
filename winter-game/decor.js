// 마을 꾸미기: 눈사람·가로등·벤치·선물·눈뭉치·눈더미·발자국·반짝임까지. (배치 좌표는 마을배치도.html 기준)
// 눈뭉치/눈더미 위치는 v.snowballs / v.drifts 배열로 빼 두었다 → 나중에 줍기/던지기 기능을 붙일 수 있다.
export async function buildDecor(v, ctx) {
  const { THREE, scene, mat, rng, R, PLAZA, HOUSES, COLLIDERS, ROADPTS, PATHS, catmull, ribbonGeo, glow, glowTex } = ctx;
  const { prop, has, free, dPath, kit, hash } = v;
  const upd = v.updaters = [];
  const rnd = a => a[Math.floor(rng() * a.length)];
  const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const toWorld = (h, lx, lz) => [h.x + lx * Math.cos(h.phi) + lz * Math.sin(h.phi), h.z - lx * Math.sin(h.phi) + lz * Math.cos(h.phi)];
  const SNOWBALLS = v.snowballs = [], DRIFTS = v.drifts = [];
  const snowMat = mat(0xf4f8ff), snowSoft = mat(0xeef4ff);
  const onRoad = (x, z) => Math.hypot(x - PLAZA.x, z - PLAZA.z) < 9.6 || dPath(x, z) < 1.9;   // 길·광장 위에는 눈을 쌓지 않는다

  // ───────── ④ 눈뭉치 · 눈더미 ─────────
  const ballGeo = new THREE.SphereGeometry(1, 12, 9);
  function snowball(x, z, r) {
    if (onRoad(x, z)) return;
    const m = new THREE.Mesh(ballGeo, snowMat); m.scale.setScalar(r); m.position.set(x, r * 0.8, z);
    m.castShadow = m.receiveShadow = true; m.userData.noOutline = true; scene.add(m); SNOWBALLS.push({ x, z, r });
  }
  const snowballs = (x, z, n = 3, spread = 0.8) => { for (let i = 0; i < n; i++) snowball(x + R(-spread, spread), z + R(-spread, spread), R(0.12, 0.3) * (rng() < 0.2 ? 1.4 : 1)); };
  function drift(x, z, len = 2, rot = R(0, 6), hgt = 0.42) {                // 둥근 구체 여러 개를 겹쳐 부드러운 눈더미
    const n = 3 + Math.floor(rng() * 3);
    if (onRoad(x, z) || onRoad(x + Math.cos(rot) * len / 2, z + Math.sin(rot) * len / 2) || onRoad(x - Math.cos(rot) * len / 2, z - Math.sin(rot) * len / 2)) return;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5, r = R(0.45, 0.85) * (len > 3 ? 1.25 : 1);
      const m = new THREE.Mesh(ballGeo, snowSoft); m.scale.set(r * 1.25, r * hgt * R(0.8, 1.2), r);
      m.position.set(x + Math.cos(rot) * t * len + R(-0.15, 0.15), 0, z + Math.sin(rot) * t * len + R(-0.15, 0.15)); m.rotation.y = R(0, 6);
      m.receiveShadow = true; m.userData.noOutline = true; scene.add(m);
    }
    DRIFTS.push({ x, z });
  }
  const mound = (x, z, r, h) => { const m = new THREE.Mesh(ballGeo, snowSoft); m.scale.set(r, h, r); m.position.set(x, -h * 0.25, z); m.receiveShadow = true; m.userData.noOutline = true; scene.add(m); };

  // ───────── 코드로 만든 소품 (대응 모델이 없는 것) ─────────
  function woodPile(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    const log = mat(0x8a5a30), end = mat(0xd9b27a);
    [[4, 0.13], [3, 0.37], [2, 0.6]].forEach(([n, y]) => { for (let i = 0; i < n; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.2, 9), [log, end, end]); l.rotation.x = Math.PI / 2; l.position.set((i - (n - 1) / 2) * 0.27, y, 0); l.castShadow = true; g.add(l); } });
    const sn = new THREE.Mesh(ballGeo, snowSoft); sn.scale.set(0.7, 0.1, 0.62); sn.position.y = 0.75; sn.userData.noOutline = true; g.add(sn);
    COLLIDERS.push({ x, z, r: 0.7 }); return g;
  }
  function mailbox(x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), mat(0x6b4526)); post.position.y = 0.55; g.add(post);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 14, 1, false, 0, Math.PI), mat(0xd9453d)); body.rotation.set(0, 0, Math.PI / 2); body.rotation.order = 'YXZ'; body.rotation.y = Math.PI / 2; body.position.y = 1.2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.3, 0.6), mat(0xd9453d)); box.position.y = 1.1;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.2), mat(0xffd23f)); flag.position.set(0.31, 1.3, 0);
    const snow = new THREE.Mesh(ballGeo, snowMat); snow.scale.set(0.34, 0.07, 0.36); snow.position.y = 1.27; snow.userData.noOutline = true;
    g.add(box, flag, snow); COLLIDERS.push({ x, z, r: 0.3 }); return g;
  }
  function fenceLine(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 1.1)), a = Math.atan2(z2 - z1, x2 - x1);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; prop('cabin-fence', x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, { s: len / n / 1.1, rot: -a, fixed: true }); }
  }
  const hang = (name, x, y, z, s, amp = 0.1, drop = 0) => {                 // 줄에 매달린 장식: 윗부분을 축으로 살랑살랑
    if (!has(name)) return null;
    const pv = new THREE.Group(); pv.position.set(x, y, z); scene.add(pv);
    const m = kit[name].clone(true); m.scale.setScalar(s); m.position.y = drop * s; pv.add(m); v.addKitOutline(m);
    const ph = R(0, 6); upd.push((dt, t) => { pv.rotation.z = Math.sin(t * 1.3 + ph) * amp; pv.rotation.x = Math.cos(t * 1.1 + ph) * amp * 0.6; }); return pv;
  };
  // 발광 소재(랜턴/전구): 텍스처 색에 비례해 스스로 빛남 → 블룸으로 번짐
  const glowKit = (name, color, base) => { if (!has(name)) return; kit[name].traverse(o => { if (o.isMesh) { o.material.emissive = new THREE.Color(color); o.material.emissiveIntensity = base; o.userData.glowMat = true; } }); };
  glowKit('floor-wood-snow', 0xffffff, 0.45); glowKit('floor-wood', 0xffffff, 0.4); glowKit('lantern', 0xffd27a, 1.5); glowKit('lantern-hanging', 0xffd27a, 1.4);
  for (const n of ['lights-colored', 'lights-green', 'lights-red']) glowKit(n, 0xffffff, 0.9);

  // ───────── ③ 가로등: 광장 둘레 8개 + 다리 4개 ─────────
  const lampSpots = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.4; lampSpots.push([Math.cos(a) * 13.7, Math.sin(a) * 13.7 + 1, i % 2 === 0]); }
  [[-2.2, 19], [2.2, 15], [-2.2, 27.5], [2.2, 27.5]].forEach(([x, z], i) => lampSpots.push([x, z, i % 2 === 0]));
  const lamps = [];
  for (const [x, z, lit] of lampSpots) {
    const m = prop('lantern', x, z, { s: 1.55, out: true, collide: 0.22, fixed: true, rot: faceTo(x, z, 0, 1) });
    if (!m) { ctx.addFallbackLamp?.(x, z); }
    const top = 2.75; const gl = glow(scene, x, top, z, 4.2, 0.85);
    let pl = null; if (lit) { pl = new THREE.PointLight(0xffc766, 9, 11, 2); pl.position.set(x, top, z); scene.add(pl); }
    lamps.push({ gl, pl, ph: R(0, 6) });
  }
  upd.push((dt, t) => { for (const l of lamps) { const f = 0.93 + 0.07 * Math.sin(t * 3.1 + l.ph) + 0.03 * Math.sin(t * 7.3 + l.ph * 2); l.gl.material.opacity = 0.8 * f; if (l.pl) l.pl.intensity = 9 * f; } });

  // ───────── ③ 눈사람: 광장 옆 1 + 눈사람 놀이터 3 (크기·표정(모자 유무)·방향 다르게) ─────────
  [[-6, 7, 'snowman-hat', 2.5], [3.6, 31, 'snowman-hat', 2.3]].forEach(([x, z, k, s]) => {
    prop(k, x, z, { s, collide: 0.42, rot: faceTo(x, z, 0, 8) + R(-0.5, 0.5) });
    snowballs(x + R(-1.2, 1.2), z + R(1.0, 2.0), 2 + Math.floor(rng() * 3), 0.7); drift(x, z - 0.6, 2.4);
  });

  // ───────── 벤치 4(광장) + 전망 언덕 1 ─────────
  [[-6.5, -1], [6.5, -1], [-6.5, 4], [6.5, 4]].forEach(([x, z]) => { prop('bench', x, z, { s: 1.8, rot: faceTo(x, z, 0, 1), fixed: true, collide: 0.45 }); drift(x, z - 0.9, 2.2); });

  // ───────── 광장 중앙 트리 (0,1): 큰 장식 트리 + 별 + 깜빡이는 전구 + 약한 빛 ─────────
  {
    const S = 4.4, cx = 0, cz = 1;
    if (has('tree-decorated-snow')) prop('tree-decorated-snow', cx, cz, { s: S, fixed: true, rot: 0.3, collide: 0.3, sway: 0.006 }); else v.fallbackTree(cx, cz, 3.5);
    const H = 2.29 * S, bulbs = [], pal = [0xffd54a, 0xff6b6b, 0x7ad7ff, 0xffffff];
    const bg = new THREE.SphereGeometry(0.11, 8, 6);
    for (let i = 0; i < 46; i++) {
      const t = i / 46, y = 1.1 + t * (H - 2.4), rad = (1 - t) * 2.3 * (S / 4.4) + 0.2, a = t * Math.PI * 15;
      const c = new THREE.Color(pal[i % 4]).multiplyScalar(2.2), m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad); m.userData.noOutline = true; scene.add(m); bulbs.push({ m, ph: R(0, 6) });
    }
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.28 : 0.65, a = i * Math.PI / 5 + Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd54a).multiplyScalar(2.6) }));
    star.position.set(cx, H + 0.35, cz - 0.09); star.userData.noOutline = true; scene.add(star);
    glow(scene, cx, H + 0.4, cz, 4, 0.7); glow(scene, cx, H * 0.45, cz, 7, 0.12);
    const pl = new THREE.PointLight(0xffe0a0, 6, 15, 2); pl.position.set(cx, H * 0.4, cz + 3.2); scene.add(pl);
    upd.push((dt, t) => { for (const b of bulbs) b.m.scale.setScalar(0.75 + 0.5 * Math.max(0, Math.sin(t * 2.0 + b.ph)));   // 반짝반짝
      star.rotation.y = Math.sin(t * 0.7) * 0.6; pl.intensity = 6 * (0.94 + 0.06 * Math.sin(t * 2.7)); });
    
  }

  // ───────── 노점 주변 (0,-6): 전구줄·양말·화환·장식을 달아 따뜻하게 ─────────
  {
    const lt = ['lights-colored', 'lights-green', 'lights-red', 'lights-colored', 'lights-red', 'lights-green'];
    lt.forEach((n, i) => prop(n, -2.6 + i * 1.04, -4.64, { s: 1.05, y: 3.47, fixed: true, rot: 0, out: false }));
    [[-1.9, 'sock-red-cane'], [-0.6, 'sock-green'], [0.7, 'sock-red'], [1.9, 'sock-green-cane']].forEach(([x, n]) => prop(n, x, -4.6, { s: 1.15, y: 2.78, fixed: true, rot: 0 }));
    for (const s of [-1, 1]) {
      prop('wreath-decorated', s * 2.42, -5.15, { s: 1.5, y: 2.1, fixed: true, rot: 0, out: false });
      hang('lantern-hanging', s * 2.7, 3.78, -4.8, 1.3, 0.05);
      glow(scene, s * 2.7, 3.55, -4.5, 3, 0.7);
    }
    ['snowflake-a', 'snowflake-b', 'snowflake-c', 'snowflake-b'].forEach((n, i) => hang(n, -2.1 + i * 1.4, 3.62, -4.66, 1.6, 0.18, -0.35));
    // 카운터 위
    const cy = 1.08;
    prop('nutcracker', -2.2, -6.3, { s: 0.85, y: cy, fixed: true, rot: 0.1 });
    prop('hanukkah-menorah-candles', -1.65, -5.5, { s: 1.0, y: cy, fixed: true, rot: 0 });
    prop('kwanzaa-kinara', 1.9, -6.3, { s: 1.0, y: cy, fixed: true, rot: 0 });
    prop('kwanzaa-kikombe', 1.6, -5.45, { s: 1.6, y: cy, fixed: true });
    prop('hanukkah-dreidel', -2.3, -5.45, { s: 1.6, y: cy, fixed: true });
    prop('hanukkah-menorah', 2.35, -5.6, { s: 0.9, y: cy, fixed: true, rot: 0 });
    prop('gingerbread-man', 1.0, -5.5, { s: 1.5, y: cy, fixed: true, rot: 0.15 });
    prop('gingerbread-woman', -1.0, -5.45, { s: 1.5, y: cy, fixed: true, rot: -0.15 });
    prop('candy-cane-red', 2.6, -5.0, { s: 1.5, y: cy, rot: 0.6 }); prop('candy-cane-green', -2.6, -5.1, { s: 1.5, y: cy, rot: -0.4 });
    // 바닥
    ['present-a-cube', 'present-b-round', 'present-a-rectangle'].forEach((n, i) => prop(n, -3.5 + i * 0.35, -4.4 - i * 0.4, { s: 2.0 + i * 0.1 }));
    ['present-b-cube', 'present-a-round'].forEach((n, i) => prop(n, 3.5 + i * 0.4, -4.5 - i * 0.2, { s: 2.1 }));
    prop('present-b-rectangle', 3.9, -4.1, { s: 1.5, y: 0.55 + 0.0 });
    woodPile(-3.7, -7.3, 0.1); woodPile(3.8, -7.4, -0.2);
    prop('candy-cane-red', -3.1, -3.9, { s: 2.2 }); prop('candy-cane-green', 3.2, -3.8, { s: 2.2 });
    snowballs(-4.4, -5.0, 3); snowballs(4.5, -5.4, 3); drift(-4.4, -7, 3.5); drift(4.5, -7.2, 3.5); drift(0, -8.4, 7, 0, 0.3);
    // 순록 + 썰매
    prop('reindeer', -4.8, -2.4, { s: 1.7, collide: 0.5, rot: faceTo(-4.8, -2.4, 0, 1) + 0.3 });
    prop('sled-long', -6.6, -3.6, { s: 2.0, rot: 0.5, collide: 0.5 }); prop('present-b-cube', -6.6, -3.5, { s: 1.5, y: 0.5 }); prop('present-a-round', -6.35, -3.9, { s: 1.4, y: 0.5 });
    prop('festivus-pole', 8.7, 6.9, { s: 1.8, collide: 0.3 }); snowballs(8.0, 6.2, 3);
  }

  // ───────── 개울 다리 (0,24) + 스폰(0,29) 첫인상: 양옆 작은 나무·눈더미·등불 ─────────
  {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) prop('floor-wood-snow', -1.65 + c * 1.1, 22.55 + r * 1.1, { s: 1.1, y: 0.07, fixed: true, rot: 0 });
    for (const sx of [-2.3, 2.3]) { fenceLine(sx, 22.0, sx, 25.6); fenceLine(sx * 1.05, 26.0, sx * 1.05, 30.8); }
    // 한 쌍씩 작은 전나무 + 눈더미 (통과 가능한 작은 소품)
    [[-4.3, 30.6, 'tree-snow-a'], [4.5, 30.0, 'tree-snow-c'], [-5.0, 26.9, 'tree-snow-b'], [5.2, 27.5, 'tree-snow-a'], [-4.6, 21, 'tree-snow-c'], [4.7, 21.5, 'tree-snow-b'], [-4.2, 17, 'tree-snow-a'], [4.6, 18.5, 'tree-snow-c']]
      .forEach(([x, z, k]) => { prop(k, x, z, { s: R(1.5, 2.1), sway: 0.02 }); drift(x, z + 0.6, 2.6); });
    prop('present-a-cube', -1.7, 31, { s: 2 }); prop('present-b-round', -2.2, 30.5, { s: 1.8 }); snowballs(2.6, 29.2, 3); snowballs(-2.9, 24.4, 2);
    for (const x of [-3.2, 3.2]) prop('snow-pile', x, 25.0 + (x > 0 ? 0.8 : -0.4), { s: 2.4 });
  }

  // ───────── 전망 언덕 (0,-24): 큰 나무 + 벤치 + 눈더미 + 썰매 ─────────
  {
    mound(0, -24, 7.5, 1.7);
    prop('tree-snow-b', 0, -25.5, { s: 5.4, collide: 0.3, sway: 0.01 });
    prop('bench', 0, -21.6, { s: 1.8, rot: Math.PI, fixed: true, collide: 0.45 }); prop('bench-short', 2.6, -22.4, { s: 1.8, rot: Math.PI + 0.4, fixed: true });
    prop('sled', -2.7, -22.6, { s: 2.0, rot: 0.9 }); prop('sled-long', 3.4, -24.5, { s: 2.0, rot: -0.5 });
    [[-3.5, -26], [3.8, -27], [-1.5, -21], [2.3, -20.5]].forEach(([x, z]) => { prop('snow-pile', x, z, { s: 2.8 }); drift(x, z, 3); });
    snowballs(-1.8, -23.2, 4); snowballs(1.2, -22.8, 3); prop('rocks-medium', 5.2, -26.5, { s: 1.3 });
  }

  // ───────── 집 앞: 선물 · 작은 전나무 · 화환 · 문 앞 돌판 · 사이드 눈더미 ─────────
  for (const h of HOUSES) {
    const rot = h.phi;
    let [x, z] = toWorld(h, -2.4, h.d / 2 + 1.0); prop(rnd(['present-a-cube', 'present-b-rectangle', 'present-a-round']), x, z, { s: 2.0, rot });
    [x, z] = toWorld(h, 2.55, h.d / 2 + 0.9); prop(rnd(['present-b-cube', 'present-a-rectangle']), x, z, { s: 1.9, rot }); prop('present-b-round', x + 0.5, z + 0.3, { s: 1.5, y: 0.0 });
    [x, z] = toWorld(h, h.w / 2 - 0.3, h.d / 2 + 1.6); prop(rnd(['tree-snow-a', 'tree-snow-c']), x, z, { s: 1.5, sway: 0.02 }); drift(x, z + 0.4, 1.6);
    [x, z] = toWorld(h, -h.w / 2 + 0.3, h.d / 2 + 1.6); prop(rnd(['tree-snow-b', 'tree-snow-a']), x, z, { s: 1.35, sway: 0.02 }); drift(x, z + 0.4, 1.6);
    [x, z] = toWorld(h, 0, h.d / 2 + 2.15); prop('floor-stone', x, z, { s: 1.9, rot, fixed: true, y: 0.045, out: false });
    [x, z] = toWorld(h, 0.0, h.d / 2 + 0.14); { const w = prop('wreath-decorated', x, z, { s: 1.25, y: h.base + 2.05, rot, fixed: true, out: false }); }
    [x, z] = toWorld(h, 1.7, h.d / 2 + 1.2); prop(rnd(['candy-cane-red', 'candy-cane-green']), x, z, { s: 2.0, rot: rot + 0.4 });
    for (const [lx, lz, len, a] of [[-(h.w / 2 + 0.9), 0, h.d, Math.PI / 2], [h.w / 2 + 0.9, 0, h.d, Math.PI / 2], [0, -(h.d / 2 + 0.9), h.w, 0]]) { [x, z] = toWorld(h, lx, lz); drift(x, z, len, a + h.phi * -1); }
  }
  // 우편함 / 장작 / 선물 (마을배치도 소품 위치)
  mailbox(-3, 19, 0.2); woodPile(3.4, 13, 0.4); woodPile(-10, -12, 1.1);
  prop('present-b-cube', -17, 2, { s: 2.1 }); prop('present-a-rectangle', -17.7, 2.5, { s: 1.9 });

  // ───────── ④ 길가 장식: 8m 간격으로 선물·작은 전나무·사탕지팡이·눈뭉치를 흩뿌려 빈 곳이 없게 ─────────
  {
    const placed = [];
    const ok = (x, z) => free(x, z, 1.5, 4.2) && placed.every(p => Math.hypot(p[0] - x, p[1] - z) > 2.6) && Math.hypot(x, z) < 33;
    for (const P of PATHS) {
      let acc = R(2, 6);
      for (let i = 1; i < P.pts.length; i++) {
        const a = P.pts[i - 1], b = P.pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += seg;
        if (acc < 8) continue; acc = 0;
        const tx = (b[0] - a[0]) / (seg || 1), tz = (b[1] - a[1]) / (seg || 1), side = rng() < 0.5 ? 1 : -1, off = P.wd / 2 + R(1.4, 2.4);
        const x = b[0] - tz * side * off, z = b[1] + tx * side * off;
        if (!ok(x, z)) continue; placed.push([x, z]);
        const k = rng();
        if (k < 0.3) { prop(rnd(['present-a-cube', 'present-b-cube', 'present-a-rectangle']), x, z, { s: 2.0 }); prop(rnd(['present-b-round', 'present-a-round']), x + 0.55, z + 0.2, { s: 1.7 }); snowballs(x, z + 0.8, 2, 0.5); }
        else if (k < 0.62) { prop(rnd(['tree-snow-a', 'tree-snow-b', 'tree-snow-c']), x, z, { s: R(1.3, 1.9), sway: 0.02 }); drift(x, z + 0.5, 1.8); }
        else if (k < 0.8) { for (let j = 0; j < 3; j++) prop(rnd(['candy-cane-red', 'candy-cane-green']), x + j * 0.35, z + R(-0.2, 0.2), { s: R(1.8, 2.3) }); snowballs(x, z + 0.7, 3, 0.6); }
        else { snowballs(x, z, 4 + Math.floor(rng() * 2), 0.9); drift(x + 0.6, z, 2.2); if (rng() < 0.5) prop('snow-pile', x - 0.8, z + 0.5, { s: 2.2 }); }
      }
    }
    // 숲 가장자리 바위와 눈 쌓인 바닥
    for (let i = 0; i < 14; i++) { const a = R(0, 6.28), r = R(30, 34), x = Math.cos(a) * r, z = Math.sin(a) * r; if (free(x, z, 3, 7)) prop(rnd(['rocks-small', 'rocks-medium', 'rocks-large']), x, z, { s: R(1.0, 1.7), collide: 0.9 }); }
    for (let i = 0; i < 16; i++) { const a = R(0, 6.28), r = R(14, 32), x = Math.cos(a) * r, z = Math.sin(a) * r; if (free(x, z, 2.4, 6)) prop(rnd(['snow-flat', 'snow-flat-large']), x, z, { s: R(1.8, 3), y: 0.005, out: false }); }
    // 나무 밑동 눈더미
    for (const t of (v.trees?.near || [])) if (rng() < 0.7) drift(t.x, t.z + 0.3, t.s * 0.5);
  }

  // ───────── ⑥ 효과: 눈더미 위 반짝이, 발자국 ─────────
  {
    const sp = [], tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(200,225,255,0.8)'); g.addColorStop(1, 'rgba(200,225,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending, color: new THREE.Color(0xcfe6ff).multiplyScalar(1.4) })); scene.add(s);
      sp.push({ s, t: R(0, 4), dur: R(1.4, 3), place() { const d = DRIFTS[Math.floor(rng() * DRIFTS.length)]; if (!d) return; s.position.set(d.x + R(-1, 1), R(0.18, 0.5), d.z + R(-1, 1)); const k = R(0.18, 0.4); s.scale.set(k, k, 1); } });
    }
    sp.forEach(q => q.place());
    upd.push((dt) => { for (const q of sp) { q.t += dt; if (q.t > q.dur) { q.t = 0; q.dur = R(1.4, 3.2); q.place(); } const f = q.t / q.dur; q.s.material.opacity = Math.pow(Math.max(0, Math.sin(Math.PI * f)), 6) * 0.9; } });

    // 발자국: 길 위(광장/길)에서만 남고 14초에 걸쳐 서서히 사라진다
    const N = 40, FP = [], fg = new THREE.PlaneGeometry(0.2, 0.34); fg.rotateX(-Math.PI / 2);
    for (let i = 0; i < N; i++) { const m = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0x18203c, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })); m.visible = false; m.userData.noOutline = true; scene.add(m); FP.push({ m, age: 99 }); }
    let idx = 0, lx = 1e9, lz = 1e9, flip = 1;
    upd.push((dt, t, player, moving) => {
      for (const f of FP) { f.age += dt; if (f.age < 14) f.m.material.opacity = 0.36 * (1 - f.age / 14); else if (f.m.visible) f.m.visible = false; }
      if (!moving) return;
      const p = player.position;
      if (Math.hypot(p.x - lx, p.z - lz) > 0.62 && onRoad(p.x, p.z)) {
        lx = p.x; lz = p.z; flip = -flip; const f = FP[idx++ % N], ry = player.rotation.y;
        f.m.position.set(p.x + Math.cos(ry) * 0.14 * flip, 0.06, p.z - Math.sin(ry) * 0.14 * flip); f.m.rotation.y = ry; f.age = 0; f.m.visible = true;
      }
    });
  }
  return v;
}
