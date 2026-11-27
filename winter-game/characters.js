// 동물의 숲 주민 스타일 2등신 겨울 캐릭터.
// 옷 = "몸통+소매가 이어진 한 겹의 부드러운 껍데기"(Lathe) + Canvas로 그린 무늬 텍스처. 링/작은 조각 붙이기 없음.
// 외부 API: createCharacterFactory(...) → { chubby(opt), PRESETS, setOutfit(ch, coat, colors) }, ch.userData.update(dt,t,moving)
export function createCharacterFactory({ THREE, addOutlines, scene }) {
  const TOP = 1.0;                                                   // 몸통 윗끝(목)
  const css = c => '#' + new THREE.Color(c).getHexString();
  const shade = (c, k) => css(new THREE.Color(c).multiplyScalar(k));

  // ───────── 공유 지오메트리 / 머티리얼 / 텍스처 캐시 ─────────
  const geo = {}, mats = {}, texs = {};
  const sph = (r, w = 20, h = 14) => geo['s' + r + '_' + w] ||= new THREE.SphereGeometry(r, w, h);
  const tor = (r, t) => geo['t' + r + '_' + t] ||= new THREE.TorusGeometry(r, t, 12, 28);
  const cap = (r, l) => geo['c' + r + '_' + l] ||= new THREE.CapsuleGeometry(r, l, 6, 14);
  const dome = (r, th) => geo['d' + r + '_' + th] ||= new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, th);
  const box = (w, h, d) => geo['b' + w + '_' + h + '_' + d] ||= new THREE.BoxGeometry(w, h, d);

  // 림 라이트: 윤곽이 마을 불빛/하늘빛으로 은은하게 빛남
  const RIM = new THREE.Color(0x9fc0ff);
  function rimify(m) {
    m.onBeforeCompile = sh => {
      sh.uniforms.rimColor = { value: RIM };
      sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        'outgoingLight += rimColor * pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.4) * 0.2;\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'rim1';
    return m;
  }
  function std(color, o = {}) {
    const key = color + '|' + (o.rough ?? 0.7) + '|' + (o.mapKey || '') + '|' + (o.side || 0) + '|' + (o.emis || 0);
    // 밤에도 칙칙하지 않게: 색(또는 무늬)을 아주 약하게 스스로 발광시켜 그림자 쪽을 살짝 밝힘
    return mats[key] ||= rimify(new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: 0, map: o.map, side: o.side || THREE.FrontSide,
      emissive: o.emis ?? color, emissiveMap: o.map, emissiveIntensity: o.emis !== undefined ? 1 : 0.2 }));
  }
  function canvasTex(key, W, H, draw) {
    if (texs[key]) return texs[key];
    const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return texs[key] = t;
  }
  function add(parent, g, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, out = false) {
    const m = new THREE.Mesh(g, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = out; if (!out) m.userData.noOutline = true; parent.add(m); return m;
  }

  // ───────── 얼굴 (1024x512, 구체 앞면 u=0.25 → x=256) ─────────
  const faceMats = {};
  function faceMat(skin, hair) {
    const key = skin + '_' + hair; if (faceMats[key]) return faceMats[key];
    const t = canvasTex('face' + key, 1024, 512, (x, W, H) => {
      x.fillStyle = css(skin); x.fillRect(0, 0, W, H);
      const cx = 256, nose = shade(skin, 0.8);
      for (const s of [-1, 1]) {
        const g = x.createRadialGradient(cx + s * 96, 320, 2, cx + s * 96, 320, 40);               // 볼터치: 크고 연한 분홍, 가장자리 흐림
        g.addColorStop(0, 'rgba(255,120,130,0.55)'); g.addColorStop(0.6, 'rgba(255,130,140,0.28)'); g.addColorStop(1, 'rgba(255,130,140,0)');
        x.fillStyle = g; x.fillRect(cx + s * 96 - 44, 276, 88, 88);
        const ex = cx + s * 54, ey = 262;                                                         // 눈: 흰자 없이 갈색 홍채 + 짙은 동공
        x.fillStyle = '#6a4630'; x.beginPath(); x.ellipse(ex, ey, 21, 35, 0, 0, 7); x.fill();
        x.fillStyle = '#2b1810'; x.beginPath(); x.ellipse(ex, ey + 3, 12, 21, 0, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(ex - 6, ey - 14, 7.5, 0, 7); x.fill();           // 하이라이트(큰 것)
        x.beginPath(); x.arc(ex + 7, ey + 14, 3.6, 0, 7); x.fill();                                  // 하이라이트(작은 것)
        x.strokeStyle = css(new THREE.Color(hair).multiplyScalar(0.7)); x.lineWidth = 5; x.lineCap = 'round';   // 눈썹: 얇은 짧은 선
        x.beginPath(); x.moveTo(ex - 18, 208 + s * 2); x.quadraticCurveTo(ex, 199, ex + 18, 208 - s * 2); x.stroke();
      }
      x.fillStyle = nose; x.beginPath(); x.ellipse(cx, 306, 9, 7, 0, 0, 7); x.fill();           // 코: 작은 둥근 점 + 하이라이트
      x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.arc(cx - 3, 303, 2.6, 0, 7); x.fill();
      x.strokeStyle = '#8a3a2a'; x.lineWidth = 5; x.lineCap = 'round';                           // 입: 양끝이 올라간 미소
      x.beginPath(); x.moveTo(cx - 26, 332); x.quadraticCurveTo(cx, 358, cx + 26, 332); x.stroke();
    });
    return faceMats[key] = std(0xffffff, { map: t, mapKey: key, rough: 0.6, emis: 0x8a6a60 });
  }

  // ───────── 옷 껍데기 (Lathe) ─────────
  const BODY_R = [[0.2, 0.33], [0.3, 0.35], [0.45, 0.32], [0.62, 0.29], [0.78, 0.285], [0.9, 0.24], [0.99, 0.16]];   // 위가 좁고 아래가 넓은 몸통
  function bodyR(y) {
    for (let i = 1; i < BODY_R.length; i++) if (y <= BODY_R[i][0]) { const [y0, r0] = BODY_R[i - 1], [y1, r1] = BODY_R[i]; return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0)); }
    return BODY_R[BODY_R.length - 1][1];
  }
  function shellGeo(hem, puff, flare, ridge) {
    const key = 'shell' + hem + '_' + puff + '_' + flare + '_' + ridge; if (geo[key]) return geo[key];
    const pts = [new THREE.Vector2(0.001, hem)], N = 30;
    for (let i = 0; i <= N; i++) {
      const y = hem + (TOP - hem) * i / N, f = (TOP - y) / (TOP - hem);
      let r = bodyR(y) * puff * (1 + flare * f * f);
      if (ridge) r *= 1 + ridge * Math.cos((y - hem) / 0.115 * Math.PI * 2);               // 패딩 마디: 지오메트리를 살짝 부풀렸다 잘록하게
      pts.push(new THREE.Vector2(r, y));
    }
    pts.push(new THREE.Vector2(0.001, TOP + 0.001));
    const g = new THREE.LatheGeometry(pts, 36); g.rotateY(Math.PI);                         // 이음매를 등쪽으로 → 앞 가운데가 u=0.5
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setY(i, (p.getY(i) - hem) / (TOP - hem));          // v = 높이 비율(아래 0 → 위 1)
    return geo[key] = g;
  }

  // 무늬 그리기 도구
  const knit = (x, W, H, k = 1) => {
    for (let i = 0; i < W; i += 5) { x.fillStyle = i % 10 ? `rgba(0,0,0,${0.07 * k})` : `rgba(255,255,255,${0.07 * k})`; x.fillRect(i, 0, 2, H); }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 3); }
  };
  const tartan = (x, W, H, base, dark, line, tile = 64) => {
    x.fillStyle = base; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,0.58)';
    for (let i = 0; i < W; i += tile) x.fillRect(i, 0, tile / 2, H);
    for (let j = 0; j < H; j += tile) x.fillRect(0, j, W, tile / 2);
    x.fillStyle = line; for (let i = 0; i < W; i += tile) x.fillRect(i + tile * 0.62, 0, 3, H);
    for (let j = 0; j < H; j += tile) x.fillRect(0, j + tile * 0.62, W, 3);
    x.fillStyle = dark; for (let i = 0; i < W; i += tile) x.fillRect(i - 2, 0, 3, H);
  };
  const dot = (x, px, py, r, c, ring) => { x.fillStyle = c; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); if (ring) { x.strokeStyle = ring; x.lineWidth = 2; x.stroke(); } };
  const snowflake = (x, px, py, s, c) => { x.strokeStyle = c; x.lineWidth = 3; for (let a = 0; a < 4; a++) { const t = a * Math.PI / 4; x.beginPath(); x.moveTo(px - Math.cos(t) * s, py - Math.sin(t) * s); x.lineTo(px + Math.cos(t) * s, py + Math.sin(t) * s); x.stroke(); } dot(x, px, py, 3, c); };
  const diamond = (x, px, py, s, fill, stroke) => { x.beginPath(); x.moveTo(px, py - s); x.lineTo(px + s, py); x.lineTo(px, py + s); x.lineTo(px - s, py); x.closePath(); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = 3; x.stroke(); } };
  const nordicBand = (x, W, y0, y1, bg, c1, c2) => {                                         // 가슴/소매 둘레를 도는 노르딕 띠
    x.fillStyle = bg; x.fillRect(0, y0, W, y1 - y0);
    x.fillStyle = c1; x.fillRect(0, y0, W, 5); x.fillRect(0, y1 - 5, W, 5);
    x.fillStyle = c2; x.fillRect(0, y0 + 8, W, 3); x.fillRect(0, y1 - 11, W, 3);
    const cy = (y0 + y1) / 2, step = 48;
    for (let px = 24; px < W + 24; px += step) { diamond(x, px, cy, 15, c2, c1); snowflake(x, px + step / 2, cy, 8, c1); }
  };

  // 옷 사양: 길이(hem) / 부풀림(puff) / 아랫단 퍼짐(flare) / 마디(ridge) / 칼라 / 질감
  const SPEC = {
    flannel: { hem: 0.3, puff: 1.08, flare: 0.0, collar: 'shirt', rough: 0.9, base: 0xc0272d },
    varsity: { hem: 0.3, puff: 1.1, flare: 0.0, collar: 'rib', rough: 0.88, base: 0x7a1f35 },
    loopf: { hem: 0.3, puff: 1.1, flare: 0.0, collar: 'turtle', rough: 0.95, base: 0x7b1f3a },
    treeSweater: { hem: 0.3, puff: 1.1, flare: 0.0, collar: 'turtle', rough: 0.95, base: 0xf0e6cf },
    peacoat: { hem: 0.22, puff: 1.1, flare: 0.1, collar: 'wide', rough: 0.85, base: 0xc08a4a },
    slimKnit: { hem: 0.3, puff: 1.04, flare: 0.0, collar: 'turtle', rough: 0.95, base: 0xefe3c6 },
    nordic: { hem: 0.3, puff: 1.1, flare: 0.0, collar: 'turtle', rough: 0.95, base: 0xc02a2a },
    duffle: { hem: 0.22, puff: 1.12, flare: 0.1, collar: 'wide', rough: 0.85, base: 0xc9944f, hood: true },
    checkScarfSweater: { hem: 0.3, puff: 1.1, flare: 0.0, collar: 'turtle', rough: 0.95, base: 0xc9944f },
    shortPadding: { hem: 0.3, puff: 1.12, flare: 0.04, collar: 'puffy', rough: 0.38, ridge: 0.03, base: 0x4aa3f0 },
    longPadding: { hem: 0.2, puff: 1.12, flare: 0.1, collar: 'puffy', rough: 0.38, ridge: 0.03, base: 0xf3e9d2 },
  };
  const ALIAS = { coat: 'peacoat', parka: 'duffle', knit: 'slimKnit' };

  function bodyTexture(name, P, spec) {
    return canvasTex('body' + name + P.base + '_' + P.c2 + '_' + P.acc, 512, 512, (x, W, H) => {
      const Y = y => (1 - (y - spec.hem) / (TOP - spec.hem)) * H, cx = W / 2;
      x.fillStyle = css(P.base); x.fillRect(0, 0, W, H);
      if (name === 'flannel') {
        tartan(x, W, H, css(P.base), css(P.c2), 'rgba(255,255,255,0.3)');
        x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(cx - 3, 0, 6, H);                                  // 단추 줄
        for (const y of [0.78, 0.66, 0.54, 0.42]) dot(x, cx, Y(y), 6, '#efe4cc', '#3a2a22');
        for (const s of [-1, 1]) { x.strokeStyle = 'rgba(0,0,0,0.65)'; x.lineWidth = 3; x.strokeRect(cx + s * 60 - 23, Y(0.74), 46, 48); x.beginPath(); x.moveTo(cx + s * 60 - 23, Y(0.74) + 14); x.lineTo(cx + s * 60 + 23, Y(0.74) + 14); x.stroke(); }   // 가슴 주머니 2개
      } else if (name === 'varsity') {
        x.fillStyle = css(P.c2); x.fillRect(0, Y(0.36), W, 12); x.fillRect(0, Y(0.31), W, 6);          // 허리단 밝은 줄
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(cx - 2, 0, 4, H);
        for (const y of [0.76, 0.64, 0.52, 0.4]) dot(x, cx, Y(y), 7, '#e8c25a', '#7a5a14');
        x.font = 'bold 76px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';          // 가슴 'N' 패치
        x.lineWidth = 8; x.strokeStyle = '#d6a93a'; x.strokeText('N', cx + 62, Y(0.72)); x.fillStyle = '#f4ead0'; x.fillText('N', cx + 62, Y(0.72));
      } else if (name === 'loopf') {
        nordicBand(x, W, Y(0.8), Y(0.56), css(P.base), css(P.c2), css(P.acc));
        x.fillStyle = css(P.c2); x.fillRect(0, Y(0.36), W, 5); for (let px = 20; px < W; px += 40) snowflake(x, px, Y(0.45), 8, css(P.c2));
        knit(x, W, H, 0.8);
      } else if (name === 'treeSweater') {
        knit(x, W, H);
        const ty = Y(0.78), tx = cx;                                                                      // 가슴 중앙 크리스마스 나무
        x.fillStyle = '#7a4a24'; x.fillRect(tx - 6, ty + 78, 12, 18);
        x.fillStyle = '#2f7d3a'; for (const [w, off] of [[72, 40], [58, 14], [44, -10]]) { x.beginPath(); x.moveTo(tx, ty + off - 2); x.lineTo(tx + w / 2, ty + off + 42); x.lineTo(tx - w / 2, ty + off + 42); x.closePath(); x.fill(); }
        dot(x, tx - 14, ty + 72, 4, '#e84a3c'); dot(x, tx + 12, ty + 50, 4, '#f2c14e'); dot(x, tx - 6, ty + 36, 4, '#e84a3c');
        x.fillStyle = '#f2c14e'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 13, a = i * Math.PI / 5 - Math.PI / 2; x.lineTo(tx + Math.cos(a) * r, ty - 6 + Math.sin(a) * r); } x.fill();
      } else if (name === 'peacoat') {
        for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.045})`; x.fillRect(Math.random() * W, Math.random() * H, 3, 2); }   // 울 질감
        x.fillStyle = shade(P.base, 0.8);                                                                // 넓은 라펠(V자)
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx, Y(0.98)); x.lineTo(cx + s * 70, Y(0.98)); x.lineTo(cx + s * 22, Y(0.66)); x.closePath(); x.fill(); }
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(cx - 2, Y(0.66), 4, Y(spec.hem) - Y(0.66));
        for (const s of [-1, 1]) for (const y of [0.78, 0.6, 0.42]) dot(x, cx + s * 30, Y(y), 11, '#4a2c18', '#2a180c');   // 두 줄 단추 6개
        for (const s of [-1, 1]) dot(x, cx + s * 30 - 3, Y(0.78) - 4, 3, 'rgba(255,255,255,0.35)');
        x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 3; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * 70, Y(0.4)); x.lineTo(cx + s * 110, Y(0.4)); x.stroke(); }
      } else if (name === 'slimKnit') {
        knit(x, W, H, 1.4); x.fillStyle = 'rgba(0,0,0,0.06)'; for (let j = 0; j < H; j += 14) x.fillRect(0, j, W, 3);
      } else if (name === 'nordic') {
        knit(x, W, H, 0.9);
        nordicBand(x, W, Y(0.84), Y(0.56), css(P.base), css(P.c2), css(P.acc));
        x.fillStyle = shade(P.base, 0.78); x.fillRect(0, Y(0.34), W, 12);
        x.fillStyle = css(P.c2); x.fillRect(0, Y(0.5) + 24, W, 4);
      } else if (name === 'duffle') {
        for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.045})`; x.fillRect(Math.random() * W, Math.random() * H, 3, 2); }
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(cx - 2, 0, 4, H);
        for (const y of [0.8, 0.66, 0.52, 0.38]) {                                                      // 토글 단추 4개 + 끈 고리
          x.strokeStyle = '#4a2c18'; x.lineWidth = 4; x.beginPath(); x.ellipse(cx - 34, Y(y), 16, 7, 0, 0, 7); x.stroke();
          x.fillStyle = '#7a4a24'; x.beginPath(); x.roundRect(cx + 4, Y(y) - 7, 36, 14, 7); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(cx + 10, Y(y) - 5, 22, 3);
        }
      } else if (name === 'checkScarfSweater') {
        knit(x, W, H, 1.1);
      } else {                                                                                            // shortPadding / longPadding
        x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(cx - 2, 0, 4, H);                                    // 지퍼
        const per = 0.115 / (TOP - spec.hem) * H; x.fillStyle = 'rgba(0,0,0,0.18)';                      // 마디 사이 홈
        for (let j = per / 2; j < H; j += per) x.fillRect(0, j - 3, W, 6);
        x.fillStyle = 'rgba(255,255,255,0.08)'; for (let j = 0; j < H; j += per) x.fillRect(0, j + per * 0.2, W, 5);
        dot(x, cx + 5, Y(0.86), 6, 'rgba(255,255,255,0.6)');
      }
    });
  }
  function sleeveTexture(name, P) {
    return canvasTex('sl' + name + P.base + '_' + P.c2 + '_' + P.acc, 128, 256, (x, W, H) => {
      x.fillStyle = css(P.base); x.fillRect(0, 0, W, H);
      if (name === 'flannel') tartan(x, W, H, css(P.base), css(P.c2), 'rgba(255,255,255,0.3)');
      else if (name === 'varsity') { x.fillStyle = css(P.c2); for (const y of [20, 34, H - 34, H - 20]) x.fillRect(0, y, W, 7); }
      else if (name === 'loopf') nordicBand(x, W, 96, 160, css(P.base), css(P.c2), css(P.acc));
      else if (name === 'nordic') { nordicBand(x, W, 92, 164, css(P.base), css(P.c2), css(P.acc)); x.fillStyle = shade(P.base, 0.78); x.fillRect(0, 0, W, 24); x.fillRect(0, H - 24, W, 24); }
      else if (name === 'shortPadding' || name === 'longPadding') { x.fillStyle = 'rgba(0,0,0,0.18)'; for (const y of [64, 128, 192]) x.fillRect(0, y - 3, W, 6); }
      else if (['treeSweater', 'slimKnit', 'checkScarfSweater'].includes(name)) { x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, 0, W, 22); x.fillRect(0, H - 22, W, 22); }
      if (['loopf', 'treeSweater', 'slimKnit', 'nordic', 'checkScarfSweater'].includes(name)) knit(x, W, H, 1);
    });
  }
  function scarfTexture(c1, c2, tartanMode) {
    return canvasTex('scarf' + c1 + '_' + c2 + tartanMode, 128, 128, (x, W, H) => {
      if (tartanMode) tartan(x, W, H, css(c1), css(c2), 'rgba(255,255,255,0.35)', 40);
      else { x.fillStyle = css(c1); x.fillRect(0, 0, W, H); x.fillStyle = css(c2); for (let i = 0; i < W; i += 32) x.fillRect(i, 0, 14, H); }
      knit(x, W, H, 0.8);
    });
  }
  const fabric = (color, rough = 0.9) => std(color, { rough, map: canvasTex('fab', 64, 64, (x, W, H) => { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); knit(x, W, H, 1.2); }), mapKey: 'fab' });

  // ───────── 옷 입히기 (setOutfit에서 재호출) ─────────
  const DEF = { skin: 0xffdcc0, hair: 0x7a4a2a, coat: null, coat2: null, hat: 0x3f8fe0, hat2: 0xffffff, scarf: 0xff7a5a, scarf2: 0xffffff, boots: 0x6b4a36, fur: 0xf6f0e4, glove: null, pants: 0x5a4a6a, accent: 0xd9453d };
  function dress(g, opt) {
    const u = g.userData, C = u.C, has = e => (opt.extras || []).includes(e);
    const name = ALIAS[opt.coat] || opt.coat || 'shortPadding', spec = SPEC[name] || SPEC.shortPadding;
    const P = { base: C.coat ?? spec.base, c2: C.coat2 ?? 0xffffff, acc: C.accent };
    if (name === 'flannel') P.c2 = C.coat2 ?? 0x16222f;
    if (name === 'varsity') P.c2 = C.coat2 ?? 0xe8d8b0;
    if (name === 'loopf') { P.c2 = 0xf4ead2; P.acc = new THREE.Color(P.base).multiplyScalar(1.6).getHex(); }
    const parts = [], root = new THREE.Group(); u.rig.add(root); parts.push(root);
    const tag = name + P.base + '_' + P.c2 + '_' + P.acc;
    const shell = add(root, shellGeo(spec.hem, spec.puff, spec.flare, spec.ridge || 0), std(0xffffff, { rough: spec.rough, map: bodyTexture(name, P, spec), mapKey: 'b' + tag }), 0, 0, 0, 1, 1, 1, true);
    u.body = shell; u.shirtMeshes = [shell];

    // 소매(캡슐) + 작고 둥근 주먹
    const slMat = std(0xffffff, { rough: spec.rough, map: sleeveTexture(name, P), mapKey: 's' + tag });
    const mit = has('mittens'), hc = C.glove ?? (mit ? C.accent : C.skin);
    u.arms.forEach((p, i) => {
      parts.push(add(p, cap(0.115 * (spec.puff > 1.1 ? 1.12 : 1.0), 0.1), slMat, 0, -0.15, 0, 1, 1, 1, true));
      u.hands[i].material = std(hc, { rough: 0.6, emis: hc === C.skin ? new THREE.Color(C.skin).multiplyScalar(0.5).getHex() : undefined }); u.hands[i].scale.setScalar(mit ? 1.4 : 1);
    });

    // 칼라: 상의 위에 얹는 짧은 원통 1개 (머리 바로 아래 보이는 위치)
    const ccol = name === 'flannel' ? shade(P.base, 0.75) : name === 'varsity' ? css(P.c2) : shade(P.base, (name === 'peacoat' || name === 'duffle') ? 0.82 : 1.05);
    const cm = std(new THREE.Color(ccol).getHex(), { rough: spec.rough, side: THREE.DoubleSide });
    const cd = { shirt: [0.25, 0.27, 0.08], rib: [0.25, 0.27, 0.1], turtle: [0.24, 0.26, 0.16], wide: [0.34, 0.27, 0.13], puffy: [0.27, 0.29, 0.14] }[spec.collar];
    parts.push(add(root, geo['col' + cd] ||= new THREE.CylinderGeometry(cd[0], cd[1], cd[2], 24, 1, true), cm, 0, 0.9, 0, 1, 1, 0.95, false));
    if (spec.hood) parts.push(add(root, sph(0.3, 20, 12), std(new THREE.Color(shade(P.base, 0.9)).getHex(), { rough: 0.85 }), 0, 0.88, -0.26, 1.05, 0.75, 0.6, true));   // 뒤로 젖힌 후드

    if (name === 'checkScarfSweater') {                                                                  // 어깨에 걸친 빨강 체크 목도리 + 늘어진 끝 1개
      const sm = std(0xffffff, { rough: 0.9, map: scarfTexture(0xc0272d, 0x2a2630, true), mapKey: 'chk' });
      const t = add(root, tor(0.3, 0.11), sm, 0, 0.9, 0, 1, 1, 0.82, true); t.rotation.x = Math.PI / 2; parts.push(t);
      parts.push(add(root, box(0.2, 0.5, 0.08), sm, 0.17, 0.62, 0.3, 1, 1, 1, true));
    }
    if (has('apron')) {
      parts.push(add(root, sph(0.27, 20, 14), std(0xfff2d8, { rough: 0.8 }), 0, 0.5, 0.27, 1, 1.25, 0.3, true));
      parts.push(add(root, box(0.2, 0.13, 0.04), std(C.accent, { rough: 0.8 }), 0, 0.38, 0.36));
    }
    const neck = name === 'checkScarfSweater' ? 'none' : (opt.neck || 'none');                       // 목도리: 굵은 토러스 1 + 늘어진 끝 1, 줄무늬는 텍스처
    if (neck !== 'none') {
      const big = neck === 'muffler', sm = std(0xffffff, { rough: 0.9, map: scarfTexture(C.scarf, C.scarf2, false), mapKey: 'sc' + C.scarf + '_' + C.scarf2 });
      const t = add(root, tor(big ? 0.31 : 0.29, big ? 0.15 : 0.12), sm, 0, 0.9, 0.02, 1, 1, 0.82, true); t.rotation.x = Math.PI / 2; parts.push(t);
      parts.push(add(root, box(big ? 0.22 : 0.17, big ? 0.62 : 0.5, 0.07), sm, 0.15, 0.62, 0.3, 1, 1, 1, true));
    }
    return parts;
  }

  // ───────── 캐릭터 본체 ─────────
  function chubby(opt = {}) {
    const { hat = 'beanie', boots = 'furBoots', extras = [], hairStyle = 'short', idle = ['breathe'] } = opt;
    const C = { ...DEF, ...(opt.colors || {}) };
    const has = e => extras.includes(e);
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
    const u = g.userData; u.rig = rig; u.C = C; u.opt = opt;
    const H = 1.38;                                                // 머리 중심 높이 (머리 높이 ≈ 키의 55%)

    // 발밑 둥근 접촉 그림자
    const shMat = mats.shadowMat ||= new THREE.MeshBasicMaterial({ map: canvasTex('shadow', 64, 64, (x, W) => { const r = x.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(10,8,30,0.5)'); r.addColorStop(1, 'rgba(10,8,30,0)'); x.fillStyle = r; x.fillRect(0, 0, W, W); }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const sh = new THREE.Mesh(geo.shadow ||= new THREE.CircleGeometry(0.62, 28), shMat);
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.075; sh.userData.noOutline = true; g.add(sh);

    // 머리: 위아래로 살짝 눌린 큰 둥근 머리 + 작은 귀
    const headG = new THREE.Group(); headG.position.y = H; rig.add(headG);
    add(headG, sph(0.58, 32, 22), faceMat(C.skin, C.hair), 0, 0, 0, 1, 0.9, 0.95, true);
    for (const s of [-1, 1]) add(headG, sph(0.085), std(C.skin, { rough: 0.6, emis: new THREE.Color(C.skin).multiplyScalar(0.5).getHex() }), s * 0.575, -0.04, 0, 0.7, 1, 0.9);

    // 팔(피벗) + 주먹
    const arms = [], hands = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.37, 0.84, 0); rig.add(p); arms.push(p);
      hands.push(add(p, sph(0.1), std(C.skin, {}), 0, -0.33, 0, 1, 1, 1, true));
    }
    u.arms = arms; u.hands = hands;

    // 다리(짧고 통통한 캡슐) + 앞이 둥글고 두툼한 신발(밑창 색 다르게)
    const feet = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Group(); f.position.set(s * 0.15, 0, 0.05); rig.add(f); feet.push(f);
      add(f, cap(0.075, 0.1), std(C.pants, { rough: 0.8 }), 0, 0.3, -0.03);
      const sole = boots === 'sneakers' ? 0xf4f0e8 : new THREE.Color(C.boots).multiplyScalar(0.55).getHex();
      if (boots === 'rainBoots') { add(f, cap(0.1, 0.12), std(C.boots, { rough: 0.3 }), 0, 0.2, -0.02, 1, 1, 1.05, true); add(f, sph(0.15), std(C.boots, { rough: 0.3 }), 0, 0.1, 0.07, 1, 0.85, 1.35, true); }
      else add(f, sph(0.16), std(boots === 'sneakers' ? 0xffffff : C.boots, { rough: 0.7 }), 0, 0.15, 0.03, 1, 0.9, 1.3, true);
      add(f, sph(0.16), std(sole, { rough: 0.8 }), 0, 0.06, 0.03, 1.04, 0.32, 1.36);
      if (boots === 'furBoots') { const t = add(f, tor(0.12, 0.045), std(C.fur, { rough: 0.95 }), 0, 0.27, -0.01); t.rotation.x = Math.PI / 2; }
    }

    // 머리카락: 큰 반구 캡 + 앞머리 덩어리 + 옆/뒷머리 (같은 재질, 한 덩어리처럼)
    const hairM = std(C.hair, { rough: 0.5 }), coversTop = ['beanie', 'bear', 'furHat', 'santa'].includes(hat);
    if (hairStyle !== 'none') {
      const R = 0.6;
      if (!coversTop) add(headG, dome(R, 1.2), hairM, 0, 0, -0.01, 1, 0.9, 0.97, true);
      const back = hairStyle === 'bob' ? [1.0, 2.05] : [1.0, 1.42];                                   // 스타일 차이: 뒷머리 길이만
      add(headG, geo['bk' + back] ||= new THREE.SphereGeometry(R + 0.005, 30, 16, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, back[0], back[1] - back[0]), std(C.hair, { rough: 0.5, side: THREE.DoubleSide }), 0, 0, -0.01, 1, 0.9, 0.97, true);
      const by = coversTop ? 0.12 : 0.2, bz = coversTop ? 0.545 : 0.5, bs = coversTop ? 0.5 : 1;       // 앞머리 3덩어리를 겹쳐 이마를 쓸어내림 (모자 아래로 살짝 삐져나옴)
      for (const [x, rz, sc] of [[-0.17, 0.4, 1.0], [0.0, -0.05, 1.1], [0.18, -0.45, 0.95]]) { const b = add(headG, sph(0.22), hairM, x, by - Math.abs(x) * 0.1, bz - Math.abs(x) * 0.2, 1.1 * sc, 0.62 * sc * bs, 0.5, true); b.rotation.z = rz; }
      if (hairStyle === 'bun') add(headG, sph(0.2), hairM, 0, 0.42, -0.5, 1, 1, 1, true);
    }

    // 모자: 머리에 딱 맞는 부드러운 반구 + 굵은 토러스 단 하나 + 방울/털 구체 하나
    const hatG = new THREE.Group(); headG.add(hatG); const HS = [1, 0.9, 0.97];
    const dm = (r, th, color) => add(hatG, dome(r, th), fabric(color), 0, 0, 0, ...HS, true);
    if (hat === 'beanie' || hat === 'bear') {
      hatG.rotation.x = -0.1; dm(0.64, Math.PI * 0.43, C.hat);
      const t = add(hatG, tor(0.63 * Math.sin(Math.PI * 0.43), 0.09), fabric(C.hat2), 0, 0.64 * 0.9 * Math.cos(Math.PI * 0.43), 0, 1, 0.9, 0.97, true); t.rotation.x = Math.PI / 2;
      if (hat === 'beanie') add(hatG, sph(0.16), fabric(C.hat2), 0, 0.6, 0, 1, 1, 1, true);
      else for (const s of [-1, 1]) { add(hatG, sph(0.16), fabric(C.hat), s * 0.4, 0.46, 0, 1, 1, 0.7, true); add(hatG, sph(0.09), std(0xffb0b8, { rough: 0.9 }), s * 0.4, 0.46, 0.07, 1, 1, 0.5); }
    } else if (hat === 'furHat') {
      hatG.rotation.x = -0.06; dm(0.64, Math.PI * 0.42, C.hat);
      const t = add(hatG, tor(0.62 * Math.sin(Math.PI * 0.42), 0.12), fabric(C.hat2), 0, 0.64 * 0.9 * Math.cos(Math.PI * 0.42), 0, 1, 0.9, 0.97, true); t.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) add(hatG, sph(0.19), fabric(C.hat2), s * 0.6, -0.12, 0, 0.7, 1.45, 1, true);        // 귀덮개
    } else if (hat === 'earmuff') {
      add(hatG, geo.band2 ||= new THREE.TorusGeometry(0.6, 0.04, 10, 28, Math.PI), std(C.hat2, { rough: 0.5 }), 0, 0, 0, 1, 0.9, 0.97, true);
      for (const s of [-1, 1]) add(hatG, sph(0.18), fabric(C.hat), s * 0.6, -0.03, 0, 0.7, 1, 1, true);
    } else if (hat === 'santa') {
      const cn = add(hatG, geo.cone2 ||= new THREE.ConeGeometry(0.5, 0.85, 20), fabric(0xd9302a), 0.05, 0.62, 0, 1, 1, 1, true); cn.rotation.z = 0.2;
      const t = add(hatG, tor(0.58, 0.1), fabric(0xffffff), 0, 0.14, 0, 1, 0.9, 0.97, true); t.rotation.x = Math.PI / 2; add(hatG, sph(0.12), fabric(0xffffff), 0.22, 1.05, 0, 1, 1, 1, true);
    }
    if (has('snowHat')) add(hatG, sph(0.2), std(0xffffff, { rough: 0.9 }), 0.08, 0.62, 0.05, 1.5, 0.45, 1.3);

    // 소품
    if (has('glasses')) { for (const s of [-1, 1]) add(headG, tor(0.115, 0.022), std(0x3a2c30, { rough: 0.4 }), s * 0.185, -0.03, 0.54); add(headG, box(0.1, 0.022, 0.022), std(0x3a2c30, {}), 0, -0.02, 0.57); }
    if (has('mailbag')) {
      add(rig, box(0.36, 0.3, 0.16), std(C.accent, { rough: 0.7 }), -0.4, 0.42, 0.14, 1, 1, 1, true);
      add(rig, box(0.38, 0.1, 0.18), std(new THREE.Color(C.accent).multiplyScalar(0.8).getHex(), { rough: 0.7 }), -0.4, 0.55, 0.14);
      add(rig, box(0.06, 0.85, 0.03), std(new THREE.Color(C.accent).multiplyScalar(0.8).getHex(), { rough: 0.7 }), -0.02, 0.62, 0.31).rotation.z = -0.55;
    }
    if (has('backpack')) add(rig, sph(0.3), std(C.accent, { rough: 0.7 }), 0, 0.62, -0.36, 1, 1.1, 0.7, true);

    // 입김
    const puffs = [], puffTex = canvasTex('puff', 64, 64, (x, W) => { const r = x.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, W, W); });
    if (idle.includes('breath')) for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); rig.add(s); puffs.push({ s, t: i / 3 * 2.4 }); }

    u.feet = feet; u.walk = 0; u.phase = Math.random() * 10;
    u.garment = dress(g, opt);
    u.update = (dt, t, moving) => {
      u.walk += ((moving ? 1 : 0) - u.walk) * Math.min(1, dt * 10);
      const w = u.walk, k = 1 - w, tt = t + u.phase, sp = t * 11;
      let bob = Math.abs(Math.sin(sp)) * 0.08 * w, lean = Math.sin(sp) * 0.07 * w, sy = 1;
      const aL = [Math.sin(sp) * 0.7 * w, 0.2 * w + 0.15 * k], aR = [-Math.sin(sp) * 0.7 * w, 0.2 * w + 0.15 * k];   // [앞뒤, 바깥 벌림]
      let fLy = Math.max(0, Math.cos(sp)) * 0.07 * w, fRy = Math.max(0, -Math.cos(sp)) * 0.07 * w, headNod = Math.sin(sp * 2) * 0.03 * w;
      for (const kind of idle) {
        if (kind === 'breathe') sy += Math.sin(tt * 2) * 0.018 * k;
        if (kind === 'sway') { lean += Math.sin(tt * 2.2) * 0.08 * k; aL[1] += Math.sin(tt * 2.2) * 0.12 * k; aR[1] -= Math.sin(tt * 2.2) * 0.12 * k; }
        if (kind === 'hop') { bob += Math.abs(Math.sin(tt * 5.5)) * 0.22 * k; aL[1] += (0.9 + Math.sin(tt * 11) * 0.35) * k; aR[1] += (0.9 + Math.cos(tt * 11) * 0.35) * k; }
        if (kind === 'stomp') { fLy += Math.max(0, Math.sin(tt * 7)) * 0.13 * k; fRy += Math.max(0, -Math.sin(tt * 7)) * 0.13 * k; bob += Math.abs(Math.sin(tt * 7)) * 0.02 * k; lean += Math.sin(tt * 7) * 0.03 * k; }
        if (kind === 'rub') { aL[0] += (-1.15 + Math.sin(tt * 16) * 0.13) * k; aR[0] += (-1.15 - Math.sin(tt * 16) * 0.13) * k; aL[1] -= 0.55 * k; aR[1] -= 0.55 * k; headNod += 0.06 * k; }
      }
      rig.position.y = bob; rig.rotation.z = lean; rig.scale.y = sy;
      arms[0].rotation.set(aL[0], 0, -aL[1]); arms[1].rotation.set(aR[0], 0, aR[1]);
      feet[0].position.z = 0.05 + Math.sin(sp) * 0.12 * w; feet[1].position.z = 0.05 - Math.sin(sp) * 0.12 * w;
      feet[0].position.y = fLy; feet[1].position.y = fRy;
      headG.rotation.x = headNod + Math.sin(tt * 1.5) * 0.015;
      for (const q of puffs) {
        q.t += dt; if (q.t > 2.4) q.t -= 2.4; const f = q.t / 2.4;
        q.s.position.set(0, H - 0.24 + f * 0.3, 0.52 + f * 0.4); const sc = 0.07 + f * 0.25; q.s.scale.set(sc, sc, 1);
        q.s.material.opacity = Math.sin(Math.PI * f) * 0.3;
      }
    };
    scene.add(g); addOutlines(g, 0.009);
    return g;
  }

  // 옷 갈아입히기 (상점에서 구매 시): 기존 옷 파츠를 떼고 새 껍데기를 입힌다
  function setOutfit(ch, coatName, colors = {}) {
    const u = ch.userData;
    for (const p of u.garment) p.parent && p.parent.remove(p);
    u.opt = { ...u.opt, coat: coatName }; u.C = { ...u.C, ...colors };
    u.garment = dress(ch, u.opt); addOutlines(ch, 0.009);
  }

  // ───────── NPC 6명: 실루엣(모자/코트 길이)과 포인트 색으로 구분 ─────────
  const PRESETS = {
    player: { hat: 'beanie', coat: 'flannel', neck: 'none', boots: 'furBoots', extras: ['apron'], hairStyle: 'short', idle: ['breathe'],
      colors: { coat: 0x3a86d8, coat2: 0x16283f, hat: 0x2f78c4, hat2: 0xff7a3c, hair: 0x6b4228, boots: 0x6b4a36, accent: 0xff7a3c, pants: 0x3a3550 } },
    grandma: { hat: 'furHat', coat: 'peacoat', neck: 'muffler', boots: 'furBoots', extras: [], hairStyle: 'bun', idle: ['rub'],
      colors: { skin: 0xf6d2b0, hair: 0xdfe3ec, coat: 0xcfa06a, hat: 0x8a4a6a, hat2: 0xf6f0e4, scarf: 0xb5566e, scarf2: 0xf2d9a0, boots: 0x7a5a48, pants: 0x6a4a5a, accent: 0xf2c14e } },
    kid: { hat: 'bear', coat: 'nordic', neck: 'none', boots: 'rainBoots', extras: ['mittens'], hairStyle: 'short', idle: ['hop'],
      colors: { coat: 0xffcf3a, coat2: 0xffffff, hat: 0xa8743c, hair: 0x5a3a22, boots: 0x3f8fe0, accent: 0xe84a3c, pants: 0x3a5a9a } },
    postman: { hat: 'earmuff', coat: 'duffle', neck: 'none', boots: 'rainBoots', extras: ['mailbag'], hairStyle: 'short', idle: ['stomp'],
      colors: { skin: 0xf0c8a0, hair: 0x33261a, coat: 0x7f8f48, hat: 0x55612f, hat2: 0x2e2e2e, boots: 0x4a4030, accent: 0xc8433a, pants: 0x4a4a3a } },
    cafe: { hat: 'earmuff', coat: 'longPadding', neck: 'scarf', boots: 'furBoots', extras: ['glasses'], hairStyle: 'bob', idle: ['sway', 'breath'],
      colors: { hair: 0x4a3030, coat: 0xf3e9d2, hat: 0xf6efe0, hat2: 0xb39ae6, scarf: 0x9a82d6, scarf2: 0xf3e9d2, boots: 0xe8dcc4, accent: 0x9a82d6, pants: 0xf3e9d2 } },
    prankster: { hat: 'beanie', coat: 'treeSweater', neck: 'none', boots: 'furBoots', extras: ['mittens', 'snowHat'], hairStyle: 'short', idle: ['sway'],
      colors: { hair: 0xb98a55, coat: 0xa6e0ff, hat: 0x5cc2f5, hat2: 0xffffff, boots: 0xdfe9f2, accent: 0xff8fb0, pants: 0x3a5a9a } },
  };
  return { chubby, PRESETS, setOutfit };
}
