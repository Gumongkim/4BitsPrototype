# 요청서: 유물 비트 메이커에 신스 프리셋과 기능 추가

`relic-beat-tool/`에 일렉트로닉 댄스 계열(일렉트로 하우스, 댄스 팝, 베이스 뮤직, 하이퍼팝) 비트를 만들 수 있도록 프리셋을 더하고, 기능 두 개를 선택 항목으로 더한다. 작업 전에 `relic-beat-tool/CLAUDE.md`를 먼저 읽고, 특히 **9장(툴을 고칠 때)의 호환성 규칙과 알려진 함정**을 따른다. 값의 원본은 `tool.js`이고, 이 요청서와 코드가 다르면 코드를 따른다.

## 0. 배경

- 참고 방향은 "신스 베이스와 밝은 플럭 신스가 앞에 서고, 16분 하이햇과 4분 정박 킥이 받치는 일렉트로 댄스 팝", 그리고 "더 무겁고 어두운 클럽 하우스·베이스 뮤직"이다. 이 설명은 외부 AI가 준 것으로 곡 자체를 확인한 것은 아니므로 **방향 참고용**이다.
- 지금 30종 프리셋으로는 신스 베이스, 신스 리드, 808 서브가 없어 `electric_bass`, `lead_guitar`, `sub_bass`로 대신하고 있다 (`relic-beats-electropop-dance-v1.md` 참고).
- 템포는 1박 0.3초(8분음표 기준 100BPM)로 고정이다. 게임 링 박자와 묶여 있으므로 **이번 작업에서 바꾸지 않는다.** 빠른 체감은 16분 밀도로 낸다.

## 1. 범위와 우선순위

| 단계 | 내용 | 필수 |
|---|---|---|
| 1 | 새 프리셋 7종 (2장) | 필수 |
| 2 | 필터 LFO `filterLfo` + 프리셋 `wobble_bass` (3장) | 선택 |
| 3 | 노트 `repeat` (롤) (4장) | 선택 |

단계 1을 끝내고 검증한 뒤에 2, 3으로 간다. 단계 2, 3을 하지 않아도 단계 1만으로 쓸 수 있어야 한다.

## 2. 단계 1: 새 프리셋 7종

### 2-1. 규칙

- `PRESETS` **맨 뒤**에 붙인다. 기존 프리셋의 id·이름·파라미터·옥타브는 바꾸지 않는다.
- `PRESET_CATEGORIES`의 `{ id: null, name: '기존 악기' }` **앞**에 묶음을 추가한다: `{ id: 'synth', name: '신스' }`, `{ id: 'fx', name: '효과음' }`.
- 프리셋 하나의 **노트 피크는 마스터 전 0.95 이하**로 맞춘다. 아래 `gain`은 출발값이다. 오실레이터 수와 필터 공진(Q)이 피크를 키우므로 검증 결과로 조정한다 (오실레이터 게인 합 x `gain`이 대략의 상한이다).
- 파라미터는 기존 형식만 쓴다 (`oscs`, `noise`, `filter`, `pitchSlide`, `env`, `distortion`, `hold`, `gain`). `scheduleNote`는 이 단계에서 **고치지 않는다.**
- 킥·스네어 음색은 만들지 않는다 (게임 판정 소리와 겹침).

### 2-2. 프리셋 초안

```js
// 신스 (category: 'synth')
// 신스 베이스: 16분 싱코페이션 바운스용. 톱니 + 사각 + 사인 서브, 필터가 열렸다 닫힌다.
{ id: 'synth_bass', name: '신스 베이스', pitched: true, octave: 2, category: 'synth', params: {
  oscs: [{ type: 'sawtooth', gain: 1 }, { type: 'square', detune: -5, gain: 0.4 }, { type: 'sine', gain: 0.8 }],
  filter: { type: 'lowpass', freq: 900, Q: 3, from: 3000, sweep: 0.07 },
  env: { attack: 0.003, decay: 0.14, sustain: 0.55, release: 0.05 }, gain: 0.35 } },

// 신스 플럭: 아르페지오와 대선율용. 필터가 빠르게 닫히는 짧은 소리.
{ id: 'synth_pluck', name: '신스 플럭', pitched: true, octave: 4, category: 'synth', params: {
  oscs: [{ type: 'sawtooth', gain: 1 }, { type: 'square', detune: 8, gain: 0.5 }, { type: 'sawtooth', detune: -8, gain: 0.5 }],
  filter: { type: 'lowpass', freq: 2800, Q: 2, from: 8000, sweep: 0.09 },
  env: { attack: 0.002, decay: 0.22, sustain: 0.05, release: 0.08 }, gain: 0.3 } },

// 슈퍼소 리드: 청량한 메인 멜로디용. 톱니파 5개를 ±7, ±14센트 디튠.
{ id: 'supersaw_lead', name: '슈퍼소 리드', pitched: true, octave: 4, category: 'synth', params: {
  oscs: [
    { type: 'sawtooth', detune: -14, gain: 1 }, { type: 'sawtooth', detune: -7, gain: 1 }, { type: 'sawtooth', gain: 1 },
    { type: 'sawtooth', detune: 7, gain: 1 }, { type: 'sawtooth', detune: 14, gain: 1 },
  ],
  filter: { type: 'lowpass', freq: 6000, Q: 0.8 },
  vibrato: { rate: 5.5, depth: 8, delay: 0.15 },
  env: { attack: 0.006, decay: 0.12, sustain: 0.75, release: 0.14 }, gain: 0.17 } },

// 808 서브: 길게 울리는 무거운 저음. 디스토션으로 배음을 만들어 작은 스피커에서도 들리게 한다.
// octave 1은 32Hz대라 대부분의 스피커에서 안 들리므로 2로 둔다.
{ id: 'sub_808', name: '808 서브', pitched: true, octave: 2, category: 'synth', params: {
  oscs: [{ type: 'sine', gain: 1 }], pitchSlide: { semis: 7, time: 0.04 },
  distortion: { drive: 2.5 }, filter: { type: 'lowpass', freq: 500, Q: 0.7 },
  env: { attack: 0.004, decay: 0.9, sustain: 0, release: 0.12 }, hold: 0.4, gain: 0.75 } },

// 코드 스탭: 하우스 뒷박 스탭용. 디튠 톱니파 3개, 필터가 빠르게 닫힌다 (brass_stab보다 날카롭다).
{ id: 'chord_stab', name: '코드 스탭', pitched: true, octave: 3, category: 'synth', params: {
  oscs: [{ type: 'sawtooth', detune: -10, gain: 1 }, { type: 'sawtooth', gain: 1 }, { type: 'sawtooth', detune: 10, gain: 1 }],
  filter: { type: 'lowpass', freq: 3000, Q: 1.5, from: 6500, sweep: 0.05 },
  env: { attack: 0.003, decay: 0.14, sustain: 0.2, release: 0.06 }, gain: 0.25 } },

// 효과음 (category: 'fx')
// 노이즈 라이저: 빌드업과 드롭 직전용. 노이즈 전용 밴드패스가 300Hz에서 9kHz로 올라가고 어택이 길다.
// 게이트가 어택 + 디케이(약 0.9초)로 늘어나 칸 길이보다 길게 울린다.
{ id: 'noise_riser', name: '노이즈 라이저', pitched: false, category: 'fx', params: {
  noise: { gain: 1, filter: { type: 'bandpass', freq: 9000, Q: 1.2, from: 300, sweep: 0.9 } },
  env: { attack: 0.85, decay: 0.06, sustain: 0, release: 0.08 }, gain: 0.35 } },

// 레이저 잽: 하이퍼팝 효과음. 사각파가 36반음 위에서 빠르게 내려온다 (fixed 420Hz).
{ id: 'laser_zap', name: '레이저 잽', pitched: false, category: 'fx', params: {
  oscs: [{ type: 'square', fixed: 420, gain: 0.6 }], pitchSlide: { semis: 36, time: 0.14 },
  filter: { type: 'lowpass', freq: 5000, Q: 1 },
  env: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.02 }, gain: 0.3 } },
```

### 2-3. 완료 기준 (단계 1)

- 프리셋 목록에 '신스', '효과음' 머리글이 생기고 7종을 고를 수 있다. 목록은 30종에서 **37종**이 된다.
- 기존 설계서(`relic-beats-*.md`)를 불러와 WAV로 렌더한 결과가 수정 전과 같다 (상대 오차 1e-6 안팎, 9-4 기준 렌더 방법).
- 7종 모두 스케일 6종 x 8행(타악은 1행)을 렌더해 무음 없음, NaN 없음, 피크 0.95 이하.
- `noise_riser`를 칸 26~28에 두고 WAV로 내보냈을 때 루프 이음매에 튐이 없다 (`renderLoop`가 꼬리를 접는다).

## 3. 단계 2 (선택): 필터 LFO와 `wobble_bass`

### 3-1. 기능

프리셋 파라미터에 선택 항목 `filterLfo: { rate, depth }`를 추가한다.

- `rate`: Hz. `depth`: 필터 주파수에 더해지는 Hz 폭.
- `scheduleNote`에서 메인 필터가 있을 때만 사인 LFO를 만들어 `lfoGain(depth)`를 거쳐 `main.frequency`에 연결한다. LFO는 노트 시작 시각 `t`에 시작해 `sources`에 넣는다 (다른 소스와 같은 시각에 멈추고 연결이 정리된다).
- 필터 `from`/`sweep` 스윕과 함께 써도 동작해야 한다 (오토메이션 위에 LFO가 더해진다).
- `filterLfo`가 없으면 노드를 만들지 않아 소리가 이전과 같다.
- 제약: 필터 주파수가 0 이하로 내려가지 않게 `depth < freq`가 되도록 프리셋을 정한다.

### 3-2. 프리셋 초안

1박 = 0.3초이므로 1박에 1번 출렁이면 3.33Hz, 16분(1칸 0.15초)마다 1번이면 6.67Hz다.

```js
{ id: 'wobble_bass', name: '워블 베이스', pitched: true, octave: 2, category: 'synth', params: {
  oscs: [{ type: 'sawtooth', detune: -12, gain: 1 }, { type: 'sawtooth', detune: 12, gain: 1 }, { type: 'square', gain: 0.5 }],
  filter: { type: 'lowpass', freq: 700, Q: 5 }, filterLfo: { rate: 3.33, depth: 500 },
  distortion: { drive: 4 },
  env: { attack: 0.004, decay: 0.2, sustain: 0.7, release: 0.06 }, hold: 0.3, gain: 0.22 } },
```

- 완료 시 프리셋은 **38종**이 된다.
- 설계서의 합성 파라미터 목록(`paramsText`)과 읽는 법의 '선택 파라미터' 줄에 `filterLfo`를 한 줄 추가한다 (예: "필터 LFO: 3.33Hz, 폭 ±500Hz").
- LFO 위상은 노트 시작 시각 0에서 시작하므로 렌더 시각이 달라도 같은 소리여야 한다. 그래도 9-3의 '주파수 자동화' 함정처럼 RMS로 비교한다.

## 4. 단계 3 (선택): 노트 `repeat` (롤)

한 칸(0.15초) 안에서 같은 노트를 2~4번 나눠 치는 기능이다. 트랩·하이퍼팝의 하이햇 롤이나 스네어 롤처럼 칸 해상도보다 빠른 연타에 쓴다.

### 4-1. 데이터와 호환

- 노트의 선택 필드 `repeat`: 정수 1~4, **없으면 1**. 기본값이면 내보내지 않는다.
- `repeat > 1`인 노트는 `length`를 쓰지 않는다 (1칸). 둘이 같이 들어오면 `length`를 1로 맞춘다.
- 스키마 이름 `4bit-prototype-relic-beat-tool/v1`은 **바꾸지 않는다.** 모르는 필드는 이전 툴이 무시하므로 하위 호환이다.
- `normalizeNotes`, `parseDesign`에서 범위를 벗어난 값은 범위 안으로 맞춘다 (예: 9 → 4, 0 → 1).

### 4-2. 소리

- `scheduleRelicStep`에서 `repeat`가 k이면 칸 시각 `t`부터 칸 길이를 k등분한 간격으로 k번 `scheduleNote`를 부른다. 한 번의 게이트는 간격 길이다.
- 스윙이 있어도 칸 시작과 끝 경계는 기존 `stepTime`, `noteGate` 규칙을 따르고, 그 안을 균등하게 나눈다.
- 세기는 모든 타격이 같다 (노트의 `velocity`).
- 재생과 WAV 내보내기가 같은 `scheduleRelicStep`을 쓰므로 한 곳만 고치면 둘 다 반영된다.
- 시각은 곱셈으로 계산한다 (9-3의 '시각 계산' 함정).

### 4-3. 화면과 설계서

- 편집기 위 도구줄에 '롤'(1/2/3/4) 선택을 두고, 새 노트의 `repeat`로 쓴다. 찍힌 노트에는 작은 표시(예: 칸 안 가는 세로 선 `repeat - 1`개)를 그린다. 가능하면 `새 노트 길이`와 같은 방식으로 맞춘다.
- 노트 표기에 `/N` 접미사를 추가한다: `X/3`은 한 칸에서 3번, `X/2@m`처럼 세기와 같이 쓸 수 있다 (순서: 음, 길이, 롤, 세기. 예 `C3/2@m`).
- 요약 표 특징에 '롤 있음'을 덧붙인다 (`featureText`).
- 읽는 법에 한 줄 추가: "`/N`이 붙은 노트는 그 칸에서 N번 나눠 친다 (JSON `repeat`, 없으면 1)".

### 4-4. 완료 기준 (단계 3)

- `repeat`가 없는 기존 설계서의 렌더가 수정 전과 같다.
- `X/3` 노트가 있는 설계서를 내보냈다 불러오면 같은 JSON이 나온다 (왕복).
- 칸 하나에 `repeat` 3을 둔 루프에서 `Player.stats`의 늦은 예약이 0이고 루프 간격이 4.8초다.

## 5. 문서 갱신

기능을 바꾸면 아래를 함께 고친다 (`relic-beat-tool/CLAUDE.md` 9-1).

- `relic-beat-tool/CLAUDE.md`: 4-4 프리셋 표(30종 → 37종, 묶음 `synth`·`fx`와 id), 4-5 파라미터(`filterLfo`), 6-2 노트 표기(`/N`), 6-3 JSON 스키마의 선택 필드(`repeat`), 9-2 코드 지도.
- 루트 `README.md`의 '유물 비트 메이커' 절: "악기 프리셋 30종"과 묶음별 목록, 합성 파라미터 절, 설계서 JSON의 선택 항목 절.
- 루트 `CLAUDE.md`의 relic-beat-tool 항목은 한 줄 요약이므로 바꿀 필요가 없다.
- 이 툴은 웹 링크(Artifact)에 넣지 않으므로 재게시하지 않는다.

## 6. 검증 (9-4 방법)

1. **기준 렌더:** 수정 **전에** `relic-beats-*.md` 전부를 `parseDesign`으로 읽어 `renderLoop`로 렌더(`Math.random` 시드 고정)하고 50ms 구간 RMS와 유물별 RMS를 저장한다. 수정 후 같은 방법으로 비교한다.
2. **노트 하나:** 새 프리셋마다 `OfflineAudioContext`에 `scheduleNote(ctx, ctx.destination, preset, midi, t)`로 렌더해 무음·NaN·피크(0.95 이하)를 본다. 음높이 악기는 스케일 6종 x 8행을 모두 돈다.
3. **박자:** `Player.stats`로 루프를 여러 번 돌려 늦은 예약 0개, 루프 간격 4.8초.
4. **이음매:** 내보낸 루프의 끝 → 첫 샘플 변화를 평소 샘플 간 변화와 비교한다.
5. **저장:** 이전 버전이 저장한 localStorage 상태가 열린다.
6. 동작 확인은 내장 브라우저로 한다. file:// 은 스크립트가 돌지 않으므로 임시 로컬 서버를 쓰고 끝나면 `.claude/`를 지운다. file:// 실행은 사용자에게 직접 확인을 부탁한다.
7. 소리의 좋고 나쁨은 코드로 판단할 수 없다. 어떤 유물을 어떤 값으로 들으면 되는지 짧게 알려 준다.

## 7. 구현 뒤 설계서 갱신 (후속)

프리셋이 생기면 `relic-beats-electropop-dance-v1.md`의 대용 악기를 바꾼 v2를 만든다. 노트는 그대로 두고 `preset.id`만 바꿔서 소리를 비교한다.

| 유물 | 지금 | 바꿀 후보 |
|---|---|---|
| 워킹 베이스 | `electric_bass` | `synth_bass` |
| 프리스타일 | `lead_guitar` | `supersaw_lead` |
| 카운터포인트 | `marimba` | `synth_pluck` |
| 서브우퍼 | `sub_bass` | `sub_808` |
| 스포르찬도 | `brass_stab` | `chord_stab` |
| 턴테이블 | `scratch_noise` | `laser_zap` (취향) |

`noise_riser`는 기존 유물 중 한 곳의 칸 26~28에 얹어 빌드업으로 시험한다. 바꾼 뒤에는 `preset.name`·`params`도 새 프리셋 값으로 맞춘다 (불러오기는 `preset.id`만 읽지만 설계서 기록을 정확히 하기 위해서다).

## 8. 구현 전에 정할 것 (기본값)

질문 없이 정하면 아래 기본값을 쓰고 답변에 적는다.

- 단계 2, 3 포함 여부: **기본은 단계 1만 하고, 끝난 뒤 사용자에게 단계 2, 3을 할지 묻는다.**
- `sub_808` 옥타브: 2 (옥타브 1은 스피커에서 안 들림).
- `repeat` 상한: 4.
- 프리셋 `gain`은 2-2의 초안에서 시작해 피크 0.95 이하가 되도록 조정하고, 조정한 값을 답변에 표로 적는다.
