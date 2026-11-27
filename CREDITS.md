# 크레딧 / 출처

## 3D 모델: Kenney Holiday Kit
- 작가: Kenney (www.kenney.nl)
- 라이선스: CC0 1.0 (퍼블릭 도메인, 표기 의무 없음 — 감사의 뜻으로 기록)
- 링크: https://kenney.nl/assets/holiday-kit
- 위치: `winter-game/assets/holiday/`
- 사용: 나무, 눈사람, 눈더미, 선물, 사탕지팡이, 진저브레드, 호두까기 인형, 순록, 화환, 양말, 전구줄, 랜턴, 벤치, 울타리, 바닥 판, 썰매, 바위, 기차/선로 등
- 사용하지 않음: 건물/오두막(`cabin-*`, 울타리 `cabin-fence`만 사용). 집은 코드로 직접 만든 `house()`
- 모델은 마을 톤에 맞게 토온 셰이딩/외곽선/색 보정을 코드에서 입혀서 사용

## 코드로 만든 것 (외부 에셋 없음)
- 집, 캐릭터(2등신), 노점, 산, 하늘, 돌바닥 등은 three.js 코드와 Canvas 텍스처로 직접 생성
- 효과음/배경음은 WebAudio로 합성

## 라이브러리
- three.js r160 (MIT) — `winter-game/vendor/`
