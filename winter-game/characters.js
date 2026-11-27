// 2등신 겨울 캐릭터 (동숲/오버쿡드 느낌): 옵션 조합식으로 NPC마다 다르게 만든다.
// 지오메트리는 모두 캐시해서 캐릭터끼리 공유 → 메시/메모리 절약.
export function createCharacterFactory({ THREE, mat, addOutlines, scene }) {
  const geo = {}, mats = {};
  const sph = (r, w = 18, h = 12) => geo['s' + r] ||= new THREE.SphereGeometry(r, w, h);
  const tor = (r, t) => geo['t' + r + '_' + t] ||= new THREE.TorusGeometry(r, t, 8, 24);
  const cap = (r, l) => geo['c' + r + '_' + l] ||= new THREE.CapsuleGeometry(r, l, 4, 8);
  const dome = (r, th) => geo['d' + r + '_' + th] ||= new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, th);
  const box = (w, h, d) => geo['b' + w + '_' + h + '_' + d] ||= new THREE.BoxGeometry(w, h, d);
  const M = c => mats[c] ||= mat(c);

  // 작은 구체/상자를 붙이는 헬퍼. out=true 인 것만 외곽선을 둔다(실루엣을 만드는 큰 덩어리).
  function add(parent, g, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, out = false, material) {
    const m = new THREE.Mesh(g, material || M(color));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = out;
    if (!out) m.userData.noOutline = true;
    parent.add(m); return m;
  }
  const ringMesh = (parent, y, r, t, color, out = false) => { const m = add(parent, tor(r, t), color, 0, y, 0, 1, 1, 1, out); m.rotation.x = Math.PI / 2; return m; };

  // 얼굴 텍스처: 작고 까만 눈 + 흰 하이라이트, 큰 분홍 볼터치, 작은 미소 (구체 UV상 앞면은 u=0.25)
  const faceMats = {};
  function faceMat(skin) {
    if (faceMats[skin]) return faceMats[skin];
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#' + new THREE.Color(skin).getHexString(); x.fillRect(0, 0, 512, 256);
    const cx = 128;
    for (const s of [-1, 1]) {
      x.fillStyle = 'rgba(255,120,140,0.72)'; x.beginPath(); x.ellipse(cx + s * 60, 160, 15, 11, 0, 0, 7); x.fill();      // 볼터치
      x.fillStyle = '#2a2030'; x.beginPath(); x.ellipse(cx + s * 38, 138, 7.5, 10, 0, 0, 7); x.fill();                     // 눈
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + s * 38 - 2.2, 134, 3, 0, 7); x.fill();                                // 하이라이트
    }
    x.strokeStyle = '#8a4a3a'; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - 8, 160); x.quadraticCurveTo(cx, 170, cx + 8, 160); x.stroke();   // 입
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return faceMats[skin] = mat(0xffffff, { map: t });
  }
  const puffTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();

  const DEF = { skin: 0xffe0c4, hair: 0x7a4a2a, coat: 0x4aa3f0, coat2: 0x2f78c4, hat: 0x3f8fe0, hat2: 0xffffff, scarf: 0xff7a5a, scarf2: 0xffffff, boots: 0x6b4a36, fur: 0xf6f0e4, glove: null, pants: 0x5a4a6a, accent: 0xd9453d };

  function chubby(opt = {}) {
    const { hat = 'beanie', coat = 'shortPadding', neck = 'scarf', boots = 'furBoots', extras = [], hairStyle = 'short', idle = ['breathe'] } = opt;
    const C = { ...DEF, ...(opt.colors || {}) };
    const has = e => extras.includes(e);
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
    const BY = 0.58, H = 1.36;                                   // 몸통 중심 / 머리 중심 높이

    // ── 몸통(작고 둥근 알) + 머리(키의 절반 이상) ──
    const body = add(rig, sph(0.38), C.coat, 0, BY, 0, 1, 1, 0.92, true);
    const headG = new THREE.Group(); headG.position.y = H; rig.add(headG);
    const head = add(headG, sph(0.5, 26, 18), 0xffffff, 0, 0, 0, 1, 1, 1, true, faceMat(C.skin));

    // ── 팔(짧은 캡슐) + 둥근 손 ──
    const arms = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.4, 0.78, 0); rig.add(p);
      add(p, cap(0.085, 0.1), C.coat, 0, -0.15, 0, 1, 1, 1, true);
      const mit = has('mittens'), hc = C.glove ?? (mit ? C.accent : C.skin);
      add(p, sph(mit ? 0.17 : 0.12), hc, 0, mit ? -0.33 : -0.31, 0, 1, 1, 1, true);
      if (mit) add(p, sph(0.07), hc, -s * 0.13, -0.28, 0.04);
      arms.push(p);
    }
    // ── 발(둥근 부츠) ──
    const feet = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Group(); f.position.set(s * 0.18, 0, 0.07); rig.add(f);
      if (boots === 'rainBoots') { add(f, sph(0.16), C.boots, 0, 0.17, 0, 1, 1.25, 1.2, true); ringMesh(f, 0.32, 0.12, 0.035, C.accent); }
      else if (boots === 'sneakers') { add(f, sph(0.16), 0xffffff, 0, 0.12, 0, 1, 0.8, 1.35, true); add(f, sph(0.1), C.boots, 0, 0.1, 0.14, 1, 0.9, 1); }
      else { add(f, sph(0.16), C.boots, 0, 0.13, 0, 1, 0.9, 1.3, true); ringMesh(f, 0.26, 0.12, 0.055, C.fur); }   // furBoots
      if (coat !== 'longPadding' && coat !== 'coat') add(f, cap(0.06, 0.08), C.pants, 0, 0.3, -0.04);
      feet.push(f);
    }

    // ── 옷 ──
    const coatR = y => y < 0.66 ? 0.46 - (y - 0.2) * 0.2 : 0.37;
    const skirt = (c, y0, y1, r0, r1) => add(rig, geo['k' + y0 + y1 + r0 + r1] ||= new THREE.CylinderGeometry(r1, r0, y1 - y0, 18, 1, true), c, 0, (y0 + y1) / 2, 0, 1, 1, 1, true);
    if (coat === 'shortPadding' || coat === 'parka') for (const dy of [-0.22, -0.07, 0.08, 0.23]) ringMesh(rig, BY + dy, Math.sqrt(0.1444 - dy * dy) + 0.02, 0.05, C.coat2);
    if (coat === 'longPadding') {
      const m = skirt(C.coat, 0.2, 0.66, 0.46, 0.36); m.material.side = THREE.DoubleSide;
      for (const y of [0.24, 0.4, 0.56, 0.72]) ringMesh(rig, y, coatR(y) + 0.02, 0.055, C.coat2);
    }
    if (coat === 'parka') {
      skirt(C.coat, 0.3, 0.5, 0.43, 0.39);
      for (const s of [-1, 1]) add(rig, box(0.16, 0.12, 0.05), C.coat2, s * 0.22, 0.42, 0.33);
      add(rig, box(0.04, 0.55, 0.04), C.coat2, 0, 0.6, 0.36);
    }
    if (coat === 'knit') {
      ringMesh(rig, 0.93, 0.25, 0.1, C.coat);                                   // 목폴라
      for (const dy of [-0.12, 0.05, 0.2]) ringMesh(rig, BY + dy, Math.sqrt(0.1444 - dy * dy) + 0.015, 0.035, C.coat2);   // 가로 무늬
      ringMesh(rig, 0.25, 0.3, 0.05, C.coat);
    }
    if (coat === 'coat') {
      skirt(C.coat, 0.2, 0.66, 0.46, 0.36);
      ringMesh(rig, 0.5, 0.39, 0.04, C.coat2);
      for (const y of [0.62, 0.44, 0.3]) add(rig, sph(0.035), C.coat2, 0, y, 0.37 + (y < 0.5 ? 0.06 : 0));
      for (const s of [-1, 1]) { const l = add(rig, box(0.13, 0.2, 0.03), C.coat2, s * 0.1, 0.84, 0.33); l.rotation.z = s * 0.5; }
    }
    if (has('apron')) {
      add(rig, sph(0.3), 0xfff2d8, 0, 0.5, 0.3, 1, 1.25, 0.26, true);
      add(rig, box(0.2, 0.13, 0.04), C.accent, 0, 0.36, 0.4);
    }

    // ── 목 ──
    if (neck === 'scarf') {
      ringMesh(rig, 0.93, 0.31, 0.1, C.scarf, true);
      for (const [x, len, z] of [[0.16, 0.5, 0.37], [0.28, 0.36, 0.33]]) {
        const t = add(rig, box(0.14, len, 0.05), C.scarf, x, 0.9 - len / 2, z, 1, 1, 1, true); t.rotation.z = 0.06;
        add(rig, box(0.145, 0.05, 0.055), C.scarf2, x, 0.9 - len * 0.75, z + 0.004).rotation.z = 0.06;
      }
    } else if (neck === 'muffler') {
      ringMesh(rig, 0.93, 0.3, 0.14, C.scarf, true); ringMesh(rig, 0.8, 0.31, 0.1, C.scarf2);
      add(rig, box(0.2, 0.62, 0.06), C.scarf, 0.1, 0.5, 0.38, 1, 1, 1, true);
      add(rig, box(0.205, 0.06, 0.065), C.scarf2, 0.1, 0.3, 0.382);
    }
    if (coat === 'parka' && hat !== 'none')                                                   // 털 칼라
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(rig, sph(0.075), C.fur, Math.sin(a) * 0.3, 0.9, Math.cos(a) * 0.3); }

    // ── 머리카락 (모자가 덮지 않는 부분만) ──
    const coversForehead = ['beanie', 'bear', 'furHat', 'santa'].includes(hat);
    if (hairStyle !== 'none') {
      if (!coversForehead) {
        const hc = add(headG, dome(0.515, 1.18), C.hair, 0, 0, 0, 1, 1, 1, true); hc.rotation.x = -0.28;
        for (const [x, y, r] of [[-0.2, 0.17, 0.2], [0, 0.2, 0.2], [0.2, 0.17, 0.2]]) add(headG, sph(0.13), C.hair, x, y + 0.09, 0.4 + (0.2 - r), 1.1, 0.8, 0.8);
      }
      for (const s of [-1, 1]) add(headG, sph(0.13), C.hair, s * 0.44, -0.1, 0.0, 0.8, hairStyle === 'bob' ? 1.9 : 1.3, 1);
      if (hairStyle === 'bob') add(headG, sph(0.4), C.hair, 0, -0.08, -0.22, 1.1, 1, 0.8);
      if (hairStyle === 'bun') add(headG, sph(0.17), C.hair, 0, 0.12, -0.5);
    }

    // ── 모자 ──
    const hatG = new THREE.Group(); headG.add(hatG);
    if (hat === 'beanie' || hat === 'bear') {
      hatG.rotation.x = -0.12;
      add(hatG, dome(0.545, Math.PI * 0.47), C.hat, 0, 0, 0, 1, 1, 1, true);
      ringMesh(hatG, 0.05, 0.54, 0.075, C.hat2, true);
      if (hat === 'beanie') add(hatG, sph(0.14), C.hat2, 0, 0.56, 0, 1, 1, 1, true);
      else for (const s of [-1, 1]) { add(hatG, sph(0.15), C.hat, s * 0.37, 0.43, 0, 1, 1, 1, true); add(hatG, sph(0.08), 0xffb0b8, s * 0.37, 0.44, 0.07); }
    } else if (hat === 'furHat') {
      hatG.rotation.x = -0.08;
      add(hatG, dome(0.55, Math.PI * 0.44), C.hat, 0, 0.02, 0, 1, 1, 1, true);
      ringMesh(hatG, 0.06, 0.55, 0.11, C.hat2, true);
      for (const s of [-1, 1]) add(hatG, sph(0.17), C.hat2, s * 0.5, -0.14, 0.0, 0.7, 1.4, 1, true);
      add(hatG, sph(0.07), C.accent, 0, 0.17, 0.56);
    } else if (hat === 'earmuff') {
      const band = add(hatG, geo.band ||= new THREE.TorusGeometry(0.52, 0.035, 8, 24, Math.PI), C.hat2, 0, 0, 0, 1, 1, 1, true);
      for (const s of [-1, 1]) add(hatG, sph(0.16), C.hat, s * 0.52, -0.02, 0, 0.7, 1, 1, true);
    } else if (hat === 'santa') {
      const cn = add(hatG, geo.cone ||= new THREE.ConeGeometry(0.46, 0.8, 16), 0xd9302a, 0.05, 0.6, 0, 1, 1, 1, true); cn.rotation.z = 0.2;
      ringMesh(hatG, 0.1, 0.5, 0.09, 0xffffff, true); add(hatG, sph(0.11), 0xffffff, 0.2, 1.0, 0);
    }
    if (has('snowHat')) for (const [x, z] of [[0.1, 0.05], [-0.18, -0.1], [0.2, -0.2]]) add(hatG, sph(0.1), 0xffffff, x, 0.5 - z * 0.2, z, 1.2, 0.6, 1.2);

    // ── 소품 ──
    if (has('glasses')) {
      for (const s of [-1, 1]) add(headG, tor(0.105, 0.02), 0x3a2c30, s * 0.215, -0.07, 0.465);
      add(headG, box(0.1, 0.02, 0.02), 0x3a2c30, 0, -0.06, 0.5);
    }
    if (has('mailbag')) {
      add(rig, box(0.36, 0.3, 0.16), C.accent, -0.38, 0.42, 0.14, 1, 1, 1, true);
      add(rig, box(0.38, 0.1, 0.18), C.coat2, -0.38, 0.55, 0.14);
      const st = add(rig, box(0.06, 0.85, 0.03), C.coat2, -0.02, 0.6, 0.36); st.rotation.z = -0.55;
    }
    if (has('backpack')) { add(rig, sph(0.3), C.accent, 0, 0.62, -0.36, 1, 1.1, 0.7, true); add(rig, sph(0.17), C.coat2, 0, 0.55, -0.48, 1, 0.8, 0.5); }

    // ── 입김(카페 언니 등) ──
    const puffs = [];
    if (idle.includes('breath')) for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
      rig.add(s); puffs.push({ s, t: i / 3 * 2.4 });
    }

    // ── 애니메이션 (뼈대 없이 코드 모션) ──
    const u = g.userData;
    u.body = body; u.shirtMeshes = [body]; u.walk = 0; u.phase = Math.random() * 10;
    u.update = (dt, t, moving) => {
      u.walk += ((moving ? 1 : 0) - u.walk) * Math.min(1, dt * 10);
      const w = u.walk, k = 1 - w, tt = t + u.phase, sp = t * 11;
      let bob = Math.abs(Math.sin(sp)) * 0.08 * w, lean = Math.sin(sp) * 0.07 * w, sy = 1;
      let aL = [Math.sin(sp) * 0.7 * w, 0.35 * w + 0.4 * k], aR = [-Math.sin(sp) * 0.7 * w, 0.35 * w + 0.4 * k];   // [앞뒤, 바깥 벌림]
      let fLy = Math.max(0, Math.cos(sp)) * 0.07 * w, fRy = Math.max(0, -Math.cos(sp)) * 0.07 * w;
      let headNod = Math.sin(sp * 2) * 0.03 * w;
      for (const kind of idle) {
        if (kind === 'breathe') sy += Math.sin(tt * 2) * 0.018 * k;
        if (kind === 'sway') { lean += Math.sin(tt * 2.2) * 0.08 * k; aL[1] += Math.sin(tt * 2.2) * 0.12 * k; aR[1] -= Math.sin(tt * 2.2) * 0.12 * k; }
        if (kind === 'hop') { bob += Math.abs(Math.sin(tt * 5.5)) * 0.22 * k; aL[1] += (0.7 + Math.sin(tt * 11) * 0.3) * k; aR[1] += (0.7 + Math.cos(tt * 11) * 0.3) * k; }
        if (kind === 'stomp') { fLy += Math.max(0, Math.sin(tt * 7)) * 0.13 * k; fRy += Math.max(0, -Math.sin(tt * 7)) * 0.13 * k; bob += Math.abs(Math.sin(tt * 7)) * 0.02 * k; lean += Math.sin(tt * 7) * 0.03 * k; }
        if (kind === 'rub') {                                                       // 손을 비빈다: 팔을 앞으로 모아 빠르게 문지름
          aL[0] += (-1.15 + Math.sin(tt * 16) * 0.13) * k; aR[0] += (-1.15 - Math.sin(tt * 16) * 0.13) * k;
          aL[1] += (-0.9) * k; aR[1] += (-0.9) * k; headNod += 0.06 * k;
        }
      }
      rig.position.y = bob; rig.rotation.z = lean; rig.scale.y = sy;
      arms[0].rotation.set(aL[0], 0, -aL[1]); arms[1].rotation.set(aR[0], 0, aR[1]);
      feet[0].position.z = 0.07 + Math.sin(sp) * 0.12 * w; feet[1].position.z = 0.07 - Math.sin(sp) * 0.12 * w;
      feet[0].position.y = fLy; feet[1].position.y = fRy;
      headG.rotation.x = headNod + Math.sin(tt * 1.5) * 0.015;
      for (const q of puffs) {
        q.t += dt; if (q.t > 2.4) q.t -= 2.4; const f = q.t / 2.4;
        q.s.position.set(0, H - 0.2 + f * 0.3, 0.5 + f * 0.4); const sc = 0.07 + f * 0.25; q.s.scale.set(sc, sc, 1);
        q.s.material.opacity = Math.sin(Math.PI * f) * 0.3;
      }
    };
    scene.add(g); addOutlines(g, 0.02);
    return g;
  }

  // ── NPC 6명 프리셋: 옷 2~3색 + 포인트 1색, 모자·목도리 색은 멀리서도 구분되게 ──
  const PRESETS = {
    player: { hat: 'beanie', coat: 'shortPadding', neck: 'none', boots: 'furBoots', extras: ['apron'], hairStyle: 'short', idle: ['breathe'],
      colors: { coat: 0x4aa3f0, coat2: 0x2f78c4, hat: 0x2f78c4, hat2: 0xff7a3c, hair: 0x6b4228, boots: 0x6b4a36, accent: 0xff7a3c } },
    grandma: { hat: 'furHat', coat: 'coat', neck: 'muffler', boots: 'furBoots', extras: [], hairStyle: 'bun', idle: ['rub'],
      colors: { skin: 0xf6d2b0, hair: 0xdfe3ec, coat: 0xd9bf98, coat2: 0x8a4a6a, hat: 0x8a4a6a, hat2: 0xf6f0e4, scarf: 0xb5566e, scarf2: 0xf2d9a0, boots: 0x7a5a48, accent: 0xf2c14e } },
    kid: { hat: 'bear', coat: 'shortPadding', neck: 'none', boots: 'rainBoots', extras: ['mittens'], hairStyle: 'short', idle: ['hop'],
      colors: { coat: 0xffd23f, coat2: 0xf2a900, hat: 0xa8743c, hair: 0x5a3a22, boots: 0x3f8fe0, accent: 0xe84a3c } },
    postman: { hat: 'earmuff', coat: 'parka', neck: 'none', boots: 'rainBoots', extras: ['mailbag'], hairStyle: 'short', idle: ['stomp'],
      colors: { skin: 0xf0c8a0, hair: 0x33261a, coat: 0x7a8a45, coat2: 0xb5a56a, hat: 0x55612f, hat2: 0x2e2e2e, boots: 0x4a4030, accent: 0xc8433a, fur: 0xe8e0c8 } },
    cafe: { hat: 'earmuff', coat: 'longPadding', neck: 'scarf', boots: 'furBoots', extras: ['glasses'], hairStyle: 'bob', idle: ['sway', 'breath'],
      colors: { hair: 0x4a3030, coat: 0xf3e9d2, coat2: 0xc9b6ec, hat: 0xf6efe0, hat2: 0xb39ae6, scarf: 0x9a82d6, scarf2: 0xf3e9d2, boots: 0xe8dcc4, accent: 0x9a82d6 } },
    prankster: { hat: 'beanie', coat: 'knit', neck: 'none', boots: 'furBoots', extras: ['mittens', 'snowHat'], hairStyle: 'short', idle: ['sway'],
      colors: { hair: 0xb98a55, coat: 0x8fd8ff, coat2: 0xffffff, hat: 0x5cc2f5, hat2: 0xffffff, boots: 0xdfe9f2, accent: 0xff8fb0 } },
  };
  return { chubby, PRESETS };
}
