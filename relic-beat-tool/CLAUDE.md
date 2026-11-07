# 유물 비트 메이커 — Claude 지침서

`relic-beat-tool/`에서 일할 때 읽는 문서다. 툴 사용법, 조정할 수 있는 값, 설계서(.md) 양식, 설계서를 직접 쓰거나 게임에 옮길 때의 규칙, 툴을 고칠 때의 주의점을 담는다.
값의 원본은 `tool.js`다. 이 문서와 코드가 다르면 코드를 따르고 이 문서를 고친다. 답변은 한국어로 쓴다(프로젝트 루트 `CLAUDE.md` 규칙).

## 1. 이 툴은 무엇인가

- 게임의 유물마다 고유한 16박 비트(악기 1종)를 찍고, 최대 5개를 겹쳐 믹스로 들어 보고, 설계서(.md)와 WAV로 내보내는 웹 툴이다. 나중에 게임 BGM의 유물별 층으로 쓸 데이터를 만든다.
- 게임 코드(`config.js` 등)와 독립이다. 웹 링크(Artifact)에 넣지 않으므로 툴만 고쳤으면 재게시하지 않는다.
- 파일: `index.html`(화면), `tool.css`(스타일), `tool.js`(전부), `relic-beats-*.md`(설계서 예시·작업물), 이 문서.
- 기술 제약: 바닐라 JS, 클래식 `<script>`, 외부 라이브러리·오디오 파일 없음, `index.html` 더블클릭(file://)으로 동작. 소리는 Web Audio로 합성한다. AudioWorklet은 file://에서 모듈 로드가 막혀 쓰지 않는다. 수치 상수는 `tool.js` 맨 위 `TOOL`에 둔다.

## 2. 시간 기준

| 항목 | 값 |
|---|---|
| 1박 | 0.3초 (게임 링 박자와 같다) |
| 1칸 (노트 단위) | 0.5박 = 0.15초 |
| 루프 | 16박 = 32칸 = 4.8초, 반복 |
| 칸 번호 | 0~31. "박.위치" 표기로 칸 0 = 1.0, 칸 1 = 1.5, 칸 31 = 16.5 |
| 박 번호 → 칸 | 칸 = (박 - 1) x 2 (예: 4.5박 → 칸 7) |
| 칸 i의 시각 | i x 0.15초 + (i가 홀수면 swing x 0.15초) |

음악적으로는 0.3초를 8분음표로 들으면 100BPM 4/4, 16박 = 2마디다.

## 3. 화면과 조작

- **왼쪽:** 유물 목록(+ 추가, 이름 중복 불가·30자, 체크박스 = 내보내기 대상, ✎ 이름 변경, × 삭제, '체크한 유물 삭제'), 악기 프리셋 목록(카테고리 머리글), 오디오 내보내기(WAV)와 'WAV에 데모 드럼 포함', 설계서 내보내기, 불러오기(파일 선택 또는 화면에 끌어다 놓기).
- **위쪽:** 스케일 선택, 믹스 바 5칸(+ 넣기, × 빼기, 칸 볼륨 0~150%), 믹스 재생, 랜덤 믹스(전체 유물에서 무작위로 5칸 채움). 둘째 줄은 전역 설정: 데모 드럼(없음/록·J-pop/붐뱁/하우스·EDM)과 드럼 볼륨, 스윙 0~50%, 바이닐 노이즈.
- **가운데 편집기:** 세로 음높이(위가 높음), 가로 32칸. 편집기 위에 '입력 세기'(강/중/약), '새 노트 길이'(1/2/4/8칸), '롤'(없음/2/3/4번, 2 이상이면 1칸 롤 노트를 찍고 길이 선택은 쓰지 않는다). 롤 노트는 칸 안에 (롤 수 - 1)개의 가는 세로 선이 보이고 길이 손잡이가 없다.
  - 빈 칸 클릭: 찍기. 노트 시작 칸 클릭: 지우기. 드래그: 처음 동작(찍기/지우기)을 이어서.
  - Shift+클릭 또는 우클릭: 세기를 강 → 중 → 약 → 강으로.
  - 음높이 노트의 마지막 칸 오른쪽 끝(7px)을 끌기: 길이 바꾸기. 같은 행의 다음 노트에서 멈춘다.
  - 긴 노트가 이어지는 칸에 찍으면 앞 노트가 그 칸 직전까지 줄고 새 노트가 생긴다.
  - 같은 칸에 여러 행(화음)을 찍을 수 있다. 찍을 때 그 음이 한 번 들린다. 재생 중에는 흰 선이 현재 위치다.
- **오른쪽:** 선택한 유물 단독 재생, 유물 볼륨(0~150%), 노트 모두 지우기, 믹스 설정 슬라이더(사이드체인, 리버브 센드, 딜레이 센드, 로파이, 저음 깎기, 고음 깎기, 각 0~100%. 저음·고음 깎기는 필터 Hz도 보인다), 정보(악기, 음높이 범위, 노트 수, 특징).
- 단독 재생과 믹스 재생은 동시에 돌지 않는다. 재생 중 편집·볼륨·칸 변경이 바로 반영된다.
- 작업 상태는 localStorage `relicBeatTool.state`에 자동 저장된다. 이전 버전이 저장한 상태도 없는 항목을 기본값으로 채워 연다.

## 4. 조정할 수 있는 값

### 4-1. 유물별 값 (설계서 JSON에 들어간다)

| 값 | 범위 | 기본 | 뜻 |
|---|---|---|---|
| `preset` | 프리셋 id | `marimba` | 악기 1종 |
| `volume` | 0 ~ 1.5 | 1 | 유물 볼륨 |
| `sidechain` | 0 ~ 1 | 0 | 데모 드럼 킥마다 소리를 (1 - 값)까지 0.01초에 눌렀다가 0.2초에 되돌린다. 데모 드럼이 '없음'이면 효과 없음 |
| `reverbSend` | 0 ~ 1 | 0 | 공통 리버브로 보내는 양 |
| `delaySend` | 0 ~ 1 | 0 | 공통 딜레이로 보내는 양 |
| `lofi` | 0 ~ 1 | 0 | 계단 곡선(12비트 → 3비트) + 로우패스(18kHz → 2.5kHz) |
| `lowCut` | 0 ~ 1 | 0 | 저음 깎기: 하이패스 20 x (800 / 20)^값 Hz (0.5 → 126Hz, 1 → 800Hz), Q 0.707 |
| `highCut` | 0 ~ 1 | 0 | 고음 깎기: 로우패스 20000 x (800 / 20000)^값 Hz (0.5 → 4kHz, 1 → 800Hz), Q 0.707 |
| 노트 `velocity` | 0 ~ 1 | 1 | 노트 게인 배율. 입력 단계는 강 1.0 / 중 0.7 / 약 0.4 |
| 노트 `length` | 1 ~ (32 - 시작 칸) | 1 | 칸 수. 음높이 악기만 쓴다(타악은 무시). 같은 행에서 노트끼리 겹치지 않는다 |
| 노트 `repeat` | 1 ~ 4 | 1 | 롤: 그 칸(스윙 반영)을 N등분해 같은 세기로 N번 친다. 한 번의 게이트는 그 간격. 2 이상이면 `length`는 1로 맞춘다 |

### 4-2. 전역 값

| 값 | 범위 | 기본 | 설계서 | 뜻 |
|---|---|---|---|---|
| 스케일 | `SCALES` 6종 | C 마이너 펜타토닉 | `scale` | 음높이 행의 음. C 마이너/메이저 펜타토닉, C 자연 단음계, C 장음계, C 도리안, C 블루스 |
| 스윙 | 0 ~ 0.5 | 0 | `groove.swing` | 홀수 칸의 시작과 노트 끝 경계를 swing x 0.15초 늦춘다. 0.33 근처가 셔플 |
| 데모 드럼 | 없음/rock/boombap/house | 없음 | 없음 | 미리듣기 전용 킥·스네어. 유물 프리셋 목록에 없다 |
| 드럼 볼륨 | 0 ~ 1.5 | 1 | 없음 | |
| 바이닐 노이즈 | 켜기/끄기 | 끄기 | 없음 | 재생 전용. WAV에도 넣지 않는다 |
| 믹스 바 | 5칸, 칸 볼륨 0 ~ 1.5 | 비어 있음 | `mixSlot`, `mixVolume` | 믹스 재생 대상 |

데모 드럼 패턴(박 번호): 록 킥 1 4 5 8 9 12 13 15.5 / 붐뱁 킥 1 4 6.5 9 12 14.5 / 하우스 킥 1 3 5 7 9 11 13 15. 스네어는 모두 3 7 11 15이고 하우스는 클랩 톤이다.

### 4-3. 코드 상수 (`tool.js`의 `TOOL`)

| 묶음 | 상수 (값) |
|---|---|
| 시간 | `BEAT_SECONDS` 0.3, `STEP_SECONDS` 0.15, `BEATS` 16, `STEPS` 32, `LOOP_SECONDS` 4.8 |
| 편집 | `PITCH_ROWS` 8, `MIX_SLOTS` 5, `NAME_MAX` 30, `DEFAULT_SCALE`, `DEFAULT_PRESET` 'marimba', `VOLUME_MAX` 1.5, `NOTE_LENGTHS` [1,2,4,8], `RESIZE_HANDLE_PX` 7 |
| 세기 | `VELOCITY_LEVELS` 강 1 / 중 0.7 / 약 0.4, 설계서 표기 경계 `VELOCITY_STRONG_MIN` 0.85, `VELOCITY_MEDIUM_MIN` 0.55 |
| 재생 | `SCHEDULE_MS` 25, `LOOKAHEAD` 0.15, `HIDDEN_LOOKAHEAD` 1.5, `START_DELAY` 0.06, `PREVIEW_GAIN` 0.8 |
| 마스터 | `MASTER_GAIN` 0.6, 압축기 -10dB 4:1 (코드 안 값), 리미터 `LIMITER_THRESHOLD_DB` -3 20:1 어택 0 |
| 사이드체인 | `SIDECHAIN_ATTACK` 0.01, `SIDECHAIN_RELEASE` 0.2 |
| 스윙 | `SWING_MAX` 0.5 |
| 리버브 | `REVERB_SECONDS` 1.6, `REVERB_DECAY_POWER` 3, `REVERB_SEED` (시드 고정이라 렌더마다 같다) |
| 딜레이 | `DELAY_TIME` 0.45 (1.5박), `DELAY_FEEDBACK` 0.35, `DELAY_FEEDBACK_LOWPASS` 3000 |
| 로파이 | `LOFI_BITS_MAX` 12, `LOFI_BITS_MIN` 3, `LOFI_CURVE_SIZE` 8192, `LOFI_CUTOFF_MAX` 18000, `LOFI_CUTOFF_MIN` 2500 (컷오프는 지수, 비트는 선형) |
| 저음·고음 깎기 | `LOW_CUT_MIN` 20, `HIGH_CUT_MAX` 20000, `CUT_FULL` 800 (값 1의 주파수), `CUT_Q` 0.707 (주파수는 지수) |
| 바이닐 | `VINYL_GAIN` 0.02, `VINYL_SECONDS` 4, `VINYL_CRACKLES_PER_SECOND` 5 |
| 합성 | `NOISE_SECONDS` 2, `DISTORTION_CURVE_SIZE` 2048, `VIBRATO_FADE` 0.08 |
| 파일 | `WAV_SAMPLE_RATE` 44100, `DOWNLOAD_GAP_MS` 400, `SAVE_DELAY_MS` 300, `STORAGE_PREFIX` 'relicBeatTool.', `SCHEMA` '4bit-prototype-relic-beat-tool/v1' |

### 4-4. 악기 프리셋 (`PRESETS`, 43종)

킥·스네어 음색은 게임의 쿵(A)·짝(S) 판정 소리와 겹쳐 넣지 않는다. 파라미터는 고정이고 UI로 편집하지 않는다. 음높이 악기는 스케일 음 8행(행 0의 옥타브가 프리셋마다 다르다), 타악은 1행이다.

| 묶음 | id (이름, 옥타브) |
|---|---|
| 드럼·타악 (`drums`) | `closed_hat` 클로즈드 하이햇, `open_hat` 오픈 하이햇, `ride_cymbal` 라이드 심벌, `mid_tom` 미드 톰, `high_tom` 하이 톰, `tambourine` 탬버린, `shaker` 셰이커, `conga_high` 콩가 (높은), `clave` 클라베 |
| 베이스 (`bass`) | `electric_bass` 일렉 베이스 (2), `deep_bass` 딥 베이스 (2) |
| 기타 (`guitar`) | `power_chord` 디스토션 파워코드 (2), `palm_mute` 팜뮤트 기타 (2), `clean_guitar` 클린 기타 (3), `lead_guitar` 리드 기타 (4) |
| 건반 (`keys`) | `acoustic_piano` 어쿠스틱 피아노 (3), `electric_piano` 일렉 피아노 (3), `organ` 오르간 (3), `house_organ` 하우스 오르간 (3, 1칸 스탭용), `warm_rhodes` 따뜻한 로즈 (3) |
| 신스 (`synth`) | `synth_bass` 신스 베이스 (2), `synth_pluck` 신스 플럭 (4), `supersaw_lead` 슈퍼소 리드 (4), `sub_808` 808 서브 (2), `chord_stab` 코드 스탭 (3), `wobble_bass` 워블 베이스 (2, 필터 LFO 3.33Hz = 1박에 한 번) |
| 효과음 (`fx`) | 타악: `noise_riser` 노이즈 라이저(어택 0.85초, 칸보다 길게 울려 빌드업용), `laser_zap` 레이저 잽 |
| 기존 악기 (category 없음, 원래 순서) | 타악: `low_tom` 로우 톰, `hand_clap` 핸드 클랩, `cowbell` 카우벨, `tap_perc` 탭 퍼커션, `scratch_noise` 스크래치 노이즈, `crash_cymbal` 크래시 심벌 / 음높이: `sub_bass` 서브 베이스 (2), `walking_bass` 워킹 베이스 (2), `marimba` 마림바 (4), `glockenspiel` 글로켄슈필 (5), `brass_stab` 브라스 스탭 (3), `flute_lead` 플루트 리드 (5), `arp_synth` 아르페지오 신스 (4), `rising_strings` 상승 스트링 (3), `sustained_pad` 지속 패드 (3) |

행 0의 MIDI = 12 x (옥타브 + 1) + 스케일 첫 음. 행 r의 음 = 스케일 음을 행 0부터 차례로 쌓은 r번째(스케일 길이를 넘으면 한 옥타브 위로).

### 4-5. 프리셋 파라미터 형식 (`params`)

| 항목 | 형식 | 뜻 |
|---|---|---|
| `oscs` | `[{ type, ratio?, fixed?, detune?, gain? }]` | 오실레이터. `ratio`는 음높이 배수, `fixed`는 고정 Hz(타악), `detune` 센트 |
| `noise` | `{ gain, filter? }` | 노이즈. `filter`가 있으면 그 필터만 거쳐 메인 필터를 지나지 않는다 |
| `filter` | `{ type, freq, Q, from?, sweep? }` | 메인 필터. `from`이 있으면 노트 시작에 from Hz에서 sweep초 동안 freq로 |
| `pitchSlide` | `{ semis, time }` | 시작 음높이가 semis 반음 위(음수면 아래)에서 time초 동안 제 음으로 |
| `env` | `{ attack, decay, sustain, release }` | 초, sustain은 0~1 |
| `bursts` | `{ count, gap }` | 짧은 타격을 겹침(클랩) |
| `gain` | 수 | 최대 음량 |
| `distortion` | `{ drive }` | 선택. 오실레이터 합에 tanh WaveShaper, 필터 앞 |
| `fm` | `{ ratio, index, decay }` | 선택. 사인 모듈레이터, 깊이 = index x 모듈레이터 Hz가 decay초 동안 0으로 |
| `vibrato` | `{ rate, depth, delay }` | 선택. LFO가 detune을 ±depth센트로, delay초 뒤 시작 |
| `hold` | 초 | 선택. 게이트의 하한 |
| `filterLfo` | `{ rate, depth }` | 선택. 사인 LFO가 메인 필터 주파수에 ±depth Hz를 rate Hz로 더한다(`from`/`sweep` 스윕 위에 얹힌다). 노트 시작에 위상 0. 메인 필터가 있어야 하고 depth < `filter.freq`로 정한다. 1박에 한 번 = 3.33Hz, 1칸에 한 번 = 6.67Hz |

게이트 = max(노트 길이 x 0.15초(스윙 반영), attack + decay, hold). 게이트 끝에서 release 동안 사라진다. 프리셋 하나의 노트 피크는 마스터 전 0.95 이하로 맞춘다(기존 `sub_bass`만 1.06이며 호환성 때문에 그대로 둔다).

## 5. 소리 경로

- 노트 → 유물 체인: 볼륨 → 사이드체인 덕킹 게인 → (저음 깎기 하이패스) → (고음 깎기 로우패스) → (로파이: 계단 WaveShaper → 로우패스) → 마스터 입력, 그리고 그 끝(필터·로파이를 지난 소리)에서 리버브·딜레이 센드. 값이 0이면 필터·로파이·센드 노드를 만들지 않아 이전과 소리가 같다. 실시간 재생은 `chainKey`(로파이 값, 필터·센드 유무)가 바뀌면 체인을 새로 만들고, 필터 주파수·센드 양은 바로 바꾼다.
- 마스터: 입력 게인 0.6 → 압축기 → 리미터. 리버브(감쇠 노이즈 임펄스 컨볼버)와 딜레이(피드백 경로 로우패스) 버스 출력은 입력 게인에 합친다(압축기·리미터 앞).
- 데모 드럼: 드럼 볼륨 게인 → 마스터 입력. 덕킹·로파이·센드를 거치지 않는다.
- 재생 스케줄러: 25ms마다 AudioContext 시간으로 0.15초(탭이 가려지면 1.5초) 앞까지 예약한다. 노트 시각은 `시작 시각 + stepTime(재생 시작부터 센 칸 번호)`로 매번 계산해 오차가 쌓이지 않는다.
- WAV(`renderLoop`): ① 한 바퀴 노트를 압축기 앞까지 두 바퀴 길이로 렌더(사이드체인 덕킹은 두 번째 바퀴 자리 킥에도 건다) → ② 루프 끝을 넘은 꼬리를 앞으로 접어 더함 → ③ 그 한 바퀴를 두 번 반복 재생하며 압축기·리미터를 거쳐 두 번째 바퀴를 쓴다. 44.1kHz 16비트 스테레오, 정확히 4.8초, 반복해도 이음매가 없다. 체크한 유물마다 1개 + 체크한 유물 전부를 합친 믹스 1개. 'WAV에 데모 드럼 포함'이면 드럼 소리도 넣고, 데모 드럼이 선택되어 있으면 사이드체인은 체크와 상관없이 적용한다.

## 6. 설계서 양식 (`relic-beats-YYYYMMDD-HHMMSS.md`)

맨 아래 JSON 코드블록이 원본이다. 위의 표와 글은 JSON에서 만든 것이고, 둘이 다르면 JSON을 따른다. 툴의 불러오기도 JSON만 읽는다.

### 6-1. 구성 (툴이 내보내는 순서)

1. `# 유물 비트 설계서`와 한 줄 소개.
2. `## 읽는 법`: 시간 기준, 칸 번호, 음 표기, 세기, 노트 길이, 스케일, 스윙, 믹스 설정 상수, 데모 드럼은 데이터에 없음, JSON이 원본, 게임 반영 시 주의, 선택 파라미터.
3. `## 요약`: `| 유물 | 악기 | 음높이 범위 | 노트 수 | 특징 |` 표. 특징은 자동 문장이다(칸 밀도 빽빽함/보통/성김, 정박/엇박, 음 종류와 폭, 화음 있음, 강약 있음, 긴 노트 있음, 롤 있음, 믹스 설정 있음). 믹스 바에 든 유물이 있으면 `믹스 바: 1번 이름 (100%) …` 한 줄.
4. 유물마다 `## 유물 이름`: 악기(이름, id, 음높이 악기/타악, 행 0 옥타브), 볼륨(믹스 칸이면 칸 번호와 칸 볼륨), 노트 수, 믹스 설정 한 줄(하나라도 0이 아닐 때만: `사이드체인 N%, 리버브 센드 N%, 딜레이 센드 N%, 로파이 N%, 저음 깎기 N% (Hz), 고음 깎기 N% (Hz)`, Hz는 0이 아닐 때만), 합성 파라미터 목록, 박 단위 표, 한 줄 패턴.
5. `## 데이터 (JSON)`: 필드 설명 한 줄과 ```json 코드블록.

### 6-2. 노트 표기 (박 단위 표와 한 줄 패턴)

| 표기 | 뜻 |
|---|---|
| `C4` | 음높이 노트(과학적 음이름, C4 = MIDI 60, 샵 표기) |
| `X` | 타악 노트 |
| `-` | 쉼 |
| `C4+G4` | 같은 칸의 여러 음(화음) |
| `@m`, `@w` | 세기 중(0.55 이상 0.85 미만), 약(0.55 미만). 강은 표기 없음. 타악은 `X@m` |
| `C3*4` | 시작 칸에서 4칸 이어지는 노트(길이 1이면 생략) |
| `X/3` | 롤: 그 칸에서 3번 나눠 친다(1이면 생략). 롤 노트는 길이를 쓰지 않는다 |
| `=` | 앞에서 시작한 긴 노트가 이어지는 칸(그 칸에 시작하는 노트가 없을 때) |

- 박 단위 표: `| 박 | .0 | .5 |`, 1~16행. `.0`은 칸 2(박-1), `.5`는 칸 2(박-1)+1.
- 한 줄 패턴: 코드블록 안에 `1.0:C4 1.5:- 2.0:E4*2@m 2.5:= …` 32개 토큰.
- 순서: 음, 길이, 롤, 세기 (예: `C3*4@m`, `C3/2@m`, `X/3@w`).

### 6-3. JSON 스키마 (`4bit-prototype-relic-beat-tool/v1`)

```json
{
  "schema": "4bit-prototype-relic-beat-tool/v1",
  "exportedAt": "ISO 시각",
  "timing": { "beatSeconds": 0.3, "stepSeconds": 0.15, "beats": 16, "steps": 32, "loopSeconds": 4.8 },
  "scale": { "name": "C 마이너 펜타토닉", "root": "C", "intervals": [0, 3, 5, 7, 10] },
  "groove": { "swing": 0.33 },
  "relics": [
    {
      "id": "relic_1",
      "name": "유물 이름",
      "preset": { "id": "electric_bass", "name": "일렉 베이스", "pitched": true, "octave": 2, "params": { } },
      "volume": 1,
      "mixSlot": 1,
      "mixVolume": 1,
      "sidechain": 0.6,
      "reverbSend": 0.2,
      "delaySend": 0.1,
      "lofi": 0.3,
      "lowCut": 0.5,
      "notes": [
        { "step": 0, "row": 0, "midi": 36, "pitch": "C2" },
        { "step": 3, "row": 2, "midi": 41, "pitch": "F2", "velocity": 0.7 },
        { "step": 8, "row": 1, "midi": 39, "pitch": "D#2", "length": 4 },
        { "step": 13, "row": 0, "midi": 36, "pitch": "C2", "repeat": 3 }
      ]
    }
  ]
}
```

- 필수: `schema`(정확히 이 문자열), `relics`(1개 이상), 유물의 `name`(겹치지 않음), `preset.id`(`PRESETS`에 있는 id), `notes`. 노트의 `step`(0~31 정수), `row`(음높이 악기 0~7, 타악 0).
- 선택(기본값이면 내보낼 때 생략): `groove.swing`(0), 유물의 `sidechain`·`reverbSend`·`delaySend`·`lofi`·`lowCut`·`highCut`(0), 노트의 `velocity`(1)·`length`(1)·`repeat`(1).
- 참고값(불러올 때 쓰지 않음): `timing`, `scale.root`·`intervals`, `preset.name`·`pitched`·`octave`·`params`, 노트의 `midi`·`pitch`, `id`, `exportedAt`. 소리는 툴의 프리셋 정의로 만들고 설계서의 `params`는 기록일 뿐이다.
- `mixSlot`·`mixVolume`: 내보낼 때 믹스 바 정보를 적지만 불러오기는 믹스 바를 바꾸지 않는다.

### 6-4. 불러오기 규칙

- JSON 코드블록(```json)만 읽는다. 여러 개면 마지막 블록이다. 표·글은 무시한다.
- 스키마 이름이 다르거나 버전이 v1이 아니면, 스케일·프리셋 id를 모르거나 `step`·`row`가 범위 밖이면 이유를 알리고 불러오지 않는다.
- 새 항목은 범위를 벗어나면 범위 안으로 맞추고(예: `sidechain` 3 → 1, `swing` 2 → 0.5), 모르는 필드는 무시한다. `length`는 루프 끝까지로 자르고 같은 행에서 겹치면 다음 노트 직전까지로 줄인다.
- 이름이 같은 유물은 덮어쓴다. 파일 내용이 곧 그 유물이라 파일에 없는 새 항목은 기본값으로 돌아간다. 없는 이름은 새 유물로 추가한다. 목록에만 있는 유물과 믹스 바는 그대로다.
- 파일의 스케일과 스윙(없으면 0)을 툴 전체에 적용한다. 덮어쓰기·스케일 변경·스윙 변경이 있으면 확인 창에 알리고 취소할 수 있다.

## 7. Claude가 설계서를 직접 쓸 때

- JSON을 먼저 정하고, 박 단위 표·한 줄 패턴·요약 표·믹스 설정 줄은 JSON과 정확히 맞게 쓴다. 가능하면 툴에 불러온 뒤 '설계서 내보내기'로 다시 만들어 표를 JSON에서 생성한다.
- `row`가 실제 음을 정한다. `midi`·`pitch`는 그 스케일과 프리셋 옥타브로 계산한 값을 적는다(4-4의 식). 스케일을 바꾸면 같은 `row`가 다른 음이 된다.
- 기본값인 새 항목은 쓰지 않는다. 타악 노트에는 `length`를 쓰지 않는다. 같은 행의 노트가 길이 때문에 겹치지 않게 한다.
- 데모 드럼과 바이닐 노이즈는 데이터에 없다. 장르 의도(권장 데모 드럼, 코드 진행 등)는 제목 아래 인용문(`>`)으로 적어도 된다. 불러오기는 무시한다.
- 사이드체인을 쓰는 설계서에는 "툴에서는 데모 드럼 킥 기준, 게임에서는 무기 킥 시각에 맞춰야 한다"를 적는다.
- 파일 이름은 `relic-beats-장르-버전.md`처럼 내용을 알 수 있게 짓고 이 폴더에 둔다(툴이 내보낸 원본 이름은 `relic-beats-YYYYMMDD-HHMMSS.md`).

## 8. 게임에 옮길 때 주의

- 박 시작은 게임 링 박자(0.3초 격자)에 맞춘다. 4.8초 루프가 게임의 무엇에 맞춰 시작하는지는 게임 연동 작업에서 정한다.
- 킥·스네어는 게임에서 무기가 낸다. 사이드체인은 데모 드럼 킥이 아니라 무기 킥 시각에 맞춰 눌러야 한다.
- 볼륨(`volume` x `mixVolume`)은 상대값이다. 합성 파라미터는 Web Audio 기준(오실레이터 파형, BiquadFilter, 게인 엔벨로프, WaveShaper, Convolver, Delay)이라 같은 엔진이면 그대로 옮길 수 있다.
- 유물은 최대 5개(믹스 바 5칸 = 게임 유물 소지 상한)가 동시에 울린다는 전제로 만든다.

## 9. 툴을 고칠 때

### 9-1. 호환성 규칙

- 스키마 이름 `4bit-prototype-relic-beat-tool/v1`을 바꾸지 않는다. 새 필드는 선택 항목으로 넣고, 기본값이면 내보내지 않고, 없으면 기본값으로 읽는다. 값이 범위를 벗어나면 맞추고, 모르는 필드는 무시한다.
- 기존 프리셋의 id·이름·파라미터·옥타브를 바꾸지 않는다. 새 프리셋은 뒤에 붙이고 `category`로 묶는다.
- 새 기능이 기본값이면 소리가 이전과 같아야 한다. 기본값일 때 노드를 만들지 않는 식으로 구현한다.
- localStorage에 저장된 이전 작업이 열려야 한다(`loadState`가 없는 항목을 채운다).
- 툴 설명은 프로젝트 루트 `README.md`의 '유물 비트 메이커' 절에도 있다. 기능을 바꾸면 그 절과 이 문서를 함께 고친다. 루트 `CLAUDE.md`의 relic-beat-tool 항목은 한 줄 요약만 둔다.

### 9-2. 코드 지도 (`tool.js`)

| 부분 | 함수·객체 |
|---|---|
| 상수·데이터 | `TOOL`, `SCALES`, `PRESETS`, `PRESET_CATEGORIES`, `DEMO_DRUM_SOUNDS`, `DEMO_DRUMS` |
| 상태 | `defaultState`, `loadState`, `saveSoon`/`saveNow`, `normalizeNotes`, `relicMix`, `MIX_FIELDS`, `lowCutFreq`/`highCutFreq`, `chainKey`, `noteVelocity`, `noteLength`, `coveringNote` |
| 합성 | `scheduleNote`(노트 하나), `makeFilter`, `distortionCurve`, `noiseBuffer` |
| 경로 | `makeBus`(마스터·리버브·딜레이), `makeDynamics`(압축기·리미터), `makeChain`(유물 체인), `reverbImpulse`, `lofiCurve` |
| 시간 | `stepTime`(칸 시각, 스윙), `noteGate`(노트 게이트), `scheduleRelicStep`(길이·롤), `scheduleDrumStep`, `duckAt`, `noteRepeat`·`noteLength`·`noteVelocity` |
| 재생 | `Player`(start/stop/tick/chain/setVinyl/preview/position) |
| 화면 | `render*`, `setup*`, 편집기 입력 `setupEditorInput`·`addNote`·`paintNotes` |
| 설계서 | `designData`(JSON), `designMarkdown`(md), `stepText`, `velocitySuffix`, `mixSettingsText`·`mixValueText`(믹스 값 % 와 Hz), `paramsText`, `featureText` |
| 불러오기 | `parseDesign`, `importText` |
| WAV | `renderLoop`, `encodeWav`, `exportAudio` |

### 9-3. 알려진 함정

- **시각 계산:** 노트 시각은 `g x 0.15`처럼 곱셈 하나로 계산한다. `4.8 + s x 0.15`처럼 나눠 더하면 반올림으로 샘플이 1개씩 어긋나 기준 렌더와 달라진다.
- **엔벨로프:** 디케이 끝과 게이트 끝은 한 번만 계산해 게이트 끝이 디케이 끝보다 앞서지 않게 한다. 앞서면 감쇠 램프가 무시되고 노트가 최대 음량으로 남는다.
- **주파수 자동화:** 음높이 슬라이드·FM·비브라토처럼 주파수가 움직이는 오실레이터는 브라우저가 렌더 시각마다 위상을 조금씩 다르게 만든다(일정한 주파수는 같다). 같은 노트도 시각이 다르면 파형이 다르므로, 이런 프리셋은 샘플 단위 비교 대신 RMS로 보고, 루프 이음매는 꼬리를 접는 `renderLoop` 방식으로 맞춘다.
- **노이즈:** 노이즈 버퍼는 컨텍스트마다 `Math.random`으로 한 번 만든다. 렌더를 비교할 때는 `Math.random`을 시드 고정 함수로 바꿔 렌더한다. 리버브 임펄스는 자체 시드라 영향이 없다.
- **리버브 렌더 흔들림:** 브라우저의 컨볼버(리버브)는 긴 임펄스의 뒷부분을 별도 스레드에서 처리해, 같은 코드로 같은 설계서를 렌더해도 `reverbSend`가 있으면 결과가 렌더마다 조금 달라진다(샘플 최대 차이 약 6e-3, 50ms 구간 RMS 상대 약 7e-4). 리버브를 끄면 1e-5 이하로 같다. 기준 비교에서 리버브를 쓰는 파일만 이 정도 차이가 나면 이 흔들림이다. 의심되면 한 번 더 렌더하거나 `reverbSend`를 0으로 바꿔 비교한다.
- **피크:** 5층을 모두 150%로 올린 극단적인 믹스는 피크가 0.96~0.99까지 간다(1.0은 넘지 않는다). 리미터 값을 바꾸면 기존 소리가 바뀌므로 함부로 바꾸지 않는다.

### 9-4. 검증 방법

- 동작 확인은 내장 브라우저로 한다. 내장 브라우저는 file:// 페이지를 정적 스냅샷으로만 열어 스크립트가 돌지 않으므로, 임시 로컬 서버(`.claude/launch.json`, 루트를 `relic-beat-tool/`로)를 띄워 확인하고 끝나면 `.claude/`를 지운다. 이 PC에는 `npx`가 없으므로 PowerShell `HttpListener` 스크립트로 띄우고, 스크립트는 한글이 없는 경로(예: `.claude/serve.ps1`)에 둔다(한글 경로는 `-File` 인자가 깨진다). file:// 실행은 사용자에게 직접 확인을 부탁한다.
- **기준 렌더:** 이 폴더의 `relic-beats-*.md`를 `parseDesign`으로 읽어 `renderLoop`로 렌더하고(`Math.random` 시드 고정), 50ms 구간 RMS와 유물별 RMS를 기준값으로 저장한다. 수정한 뒤 같은 방법으로 렌더해 상대 오차로 비교한다(같은 코드를 다시 돌려도 1e-6 정도 차이가 난다). 수정 전 코드를 스크래치패드에 복사해 다른 포트로 띄우면 언제든 비교할 수 있다.
- **노트 하나:** `OfflineAudioContext`에 `scheduleNote(ctx, ctx.destination, preset, midi, t)`로 렌더해 무음 여부, NaN, 피크(0.95 이하)를 본다. 음높이 악기는 스케일 6종 x 8행을 모두 돈다.
- **박자:** `Player.stats`(`late` = 늦게 예약된 노트 수, `firstTimes` = 루프별 첫 칸 시각)로 루프를 여러 번 돌려 늦은 예약 0개, 루프 간격 4.8초를 확인한다. 예약 시각은 `scheduleNote`를 감싸 기록하면 볼 수 있다.
- **이음매:** 내보낸 루프의 끝 샘플 → 첫 샘플 변화를 평소 샘플 간 변화와 비교한다.
- **화면 조작:** 편집기 칸에 `MouseEvent`(mousedown/mouseover, `shiftKey`, `button: 2`, 오른쪽 끝 `clientX`)를 보내 확인한다. 다운로드는 `downloadBlob`을 바꿔 가로채 내용만 본다(실제 파일을 내려받지 않는다).
- 소리의 좋고 나쁨은 코드로 판단할 수 없다. 사용자가 들어볼 수 있게 어떤 유물을 어떤 값으로 들으면 되는지 짧게 알려 준다.
