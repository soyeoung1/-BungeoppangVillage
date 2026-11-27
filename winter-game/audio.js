// 효과음/배경음: 파일 없이 WebAudio로 직접 합성 (용량 0, 저작권 걱정 없음)
let ctx = null, master = null, sizzleGain = null, muted = false;

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  // 지글지글 소리: 노이즈를 계속 돌리고 볼륨만 조절
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.15 ? 1 : 0.25);
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
  sizzleGain = ctx.createGain(); sizzleGain.gain.value = 0;
  src.connect(hp); hp.connect(sizzleGain); sizzleGain.connect(master); src.start();
  startMusic();
  return true;
}

function tone(freq, dur, type = 'sine', vol = 0.2, delay = 0, slideTo = null) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noiseBurst(dur, vol, hpf = 800) {
  if (!ensure() || muted) return;
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hpf;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}

// 잔잔한 오르골 배경음 (펜타토닉 랜덤)
let musicOn = false;
function startMusic() {
  if (musicOn) return; musicOn = true;
  const scale = [523, 587, 659, 784, 880, 1047];
  let step = 0;
  setInterval(() => {
    if (muted || !ctx) return;
    step++;
    if (step % 2 === 0 || Math.random() < 0.4) tone(scale[Math.floor(Math.random() * scale.length)], 1.6, 'sine', 0.05);
    if (step % 8 === 0) tone([262, 220, 196, 233][Math.floor(step / 8) % 4], 3.2, 'triangle', 0.05);
  }, 650);
}

export const sfx = {
  init: ensure,
  click: () => tone(660, 0.08, 'triangle', 0.12),
  pour: () => { noiseBurst(0.35, 0.12, 500); tone(300, 0.3, 'sine', 0.06, 0, 200); },
  bean: () => { tone(500, 0.07, 'triangle', 0.14); tone(380, 0.09, 'triangle', 0.1, 0.05); },
  start: () => { noiseBurst(0.5, 0.25, 2000); },
  flip: () => { tone(300, 0.18, 'square', 0.07, 0, 700); noiseBurst(0.1, 0.1, 3000); },
  take: () => { tone(880, 0.12, 'triangle', 0.15); tone(1175, 0.2, 'triangle', 0.12, 0.08); },
  burnt: () => { tone(160, 0.35, 'sawtooth', 0.1, 0, 90); },
  coin: () => { tone(988, 0.1, 'square', 0.1); tone(1319, 0.3, 'square', 0.1, 0.09); },
  quest: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.1)); },
  done: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, i * 0.11)); },
  buy: () => { tone(784, 0.1, 'square', 0.09); tone(1047, 0.12, 'square', 0.09, 0.08); tone(1568, 0.3, 'square', 0.09, 0.16); },
  no: () => tone(200, 0.2, 'square', 0.1, 0, 140),
  talk: () => tone(500 + Math.random() * 200, 0.05, 'triangle', 0.08),
  // 굽는 동안 지글지글 (0~1)
  sizzle: v => { if (sizzleGain) sizzleGain.gain.setTargetAtTime(muted ? 0 : v * 0.09, ctx.currentTime, 0.15); },
  toggleMute: () => { muted = !muted; if (muted && sizzleGain) sizzleGain.gain.value = 0; return muted; },
};
