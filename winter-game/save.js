// 저장: localStorage에 돈, 구매품, 호감도를 보관 (껐다 켜도 유지)
const KEY = 'bungeoppang-village-save-v1';

export const DEFAULT = () => ({
  money: 0,
  recipes: ['red', 'sugar'],          // 가진 속재료 (팥 / 설탕은 기본)
  wraps: ['none'], wrap: 'none',      // 포장지
  outfits: ['basic'], outfit: 'basic',// 옷
  affinity: { grandma: 0, kid: 0, uncle: 0 },
  done: 0,                            // 완료한 퀘스트 수
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT();
    const s = { ...DEFAULT(), ...JSON.parse(raw) };
    s.affinity = { ...DEFAULT().affinity, ...s.affinity };
    return s;
  } catch (e) { return DEFAULT(); }
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 저장 불가 시 무시 */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch (e) { } }
