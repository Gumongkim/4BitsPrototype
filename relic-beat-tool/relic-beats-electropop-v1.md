# 유물 비트 설계서

4Bit_Prototype 유물 비트 메이커(`relic-beat-tool/`)에서 내보낸 파일이다. 유물마다 악기 하나로 찍은 16박(4마디) 루프다.

> **일렉트로 팝 v1 — 보컬 없는 32마디 루프 한 곡 (130BPM, A 단조)**
> 柊マグネタイト「雑魚」의 느낌(빠른 16분 드라이브, 두꺼운 저음, 브레이크 다음 드롭)을 참고했다. 유물 5개 = 악기 5개이고 믹스 바 1~5번에 모두 넣는다.
> 코드 진행은 마디마다 Am | F | C | G (4마디 반복). 노트는 4마디 한 루프이고, 32마디 흐름은 사이클 8루프의 등장 루프와 코드 필터 스윕으로 만든다.
>
> | 루프 | 마디 | 구간 | 베이스 | 코드 | 리드 | 플럭 | 하이햇 |
> |---|---|---|---|---|---|---|---|
> | 1 | 1~4 | 인트로 | - | O (어두움) | - | O | - |
> | 2 | 5~8 | 벌스 | O | O | - | O | O |
> | 3 | 9~12 | 벌스 | O | O | - | O | O |
> | 4 | 13~16 | 빌드업 (베이스 빠짐) | - | O | - | O | O |
> | 5 | 17~20 | 드롭 1 | O | O | O | O | O |
> | 6 | 21~24 | 드롭 1 | O | O | O | O | O |
> | 7 | 25~28 | 브레이크 (저음·리듬 빠짐) | - | O | O | - | - |
> | 8 | 29~32 | 드롭 2 (가장 밝음) | O | O | O | O | O |
>
> 권장 미리듣기: 데모 드럼 하우스/EDM, 킥 음색 909, 펌핑 기준 4분 정박, 드럼 볼륨 70~80%. 32마디 전체는 믹스 재생을 약 59초 듣거나 WAV 길이를 '한 사이클'로 내보낸다. 데모 드럼은 32마디 내내 같아서 브레이크에서도 킥이 나온다.

## 읽는 법

- **시간 기준:** 130BPM(4분음표 기준, JSON `bpm`, 없으면 130). 1박 = 4분음표 = 0.4615초, 격자 16분(JSON `grid`, 없으면 8): 칸 하나 = 0.25박 = 16분음표 = 0.1154초, 16박 = 4마디 = 64칸, 루프 = 7.3846초. 루프는 이음매 없이 반복한다. 표의 초는 반올림한 값이고 정확한 칸 시간은 15 / 130초다.
- **칸 번호:** 0~63. 칸 i는 루프 시작 후 i x 0.1154초에 울린다. "박.위치" 표기로 칸 0 = 1.0, 칸 1 = 1.25, 칸 2 = 1.5, 칸 3 = 1.75, 칸 4 = 2.0 … 칸 63 = 16.75다.
- **음 표기:** 과학적 음이름(C4 = MIDI 60, 샵 표기). 쉬는 칸은 `-`, 음높이 없는 타악은 `X`, 같은 칸의 여러 음(화음)은 `+`로 잇는다.
- **세기:** 음 뒤 `@m`은 중(0.7), `@w`는 약(0.4)이고 표기가 없으면 강(1.0)이다 (타악은 `X@m`). JSON `velocity`는 노트 게인 배율이고 없으면 1이다.
- **노트 길이:** 기본 1칸이다. `C3*4`처럼 `*칸 수`가 붙은 음높이 노트는 그만큼 이어지고 표에서 이어지는 칸은 `=`다(JSON `length`, 없으면 1, 타악은 쓰지 않음). 게이트 = max(길이 x 0.1154초, 어택+디케이, 홀드)이고 루프 끝을 넘는 길이는 루프 끝에서 자른다. 악기의 릴리스는 게이트 뒤로 이어진다.
- **롤:** `X/3`처럼 `/N`이 붙은 노트는 그 칸에서 N번 나눠 친다 (JSON `repeat` 2~4, 없으면 1). 칸(스윙 반영)을 N등분한 간격으로 같은 세기로 치고, 한 번의 게이트는 그 간격이다. 롤 노트는 길이를 쓰지 않는다(1칸). 표기 순서는 음, 길이, 롤, 세기다 (예: `C3/2@m`).
- **스윙:** 없음. JSON에 `groove.swing`이 있으면 칸 i의 시각 = i x 0.1154초 + (i가 홀수면 swing x 0.1154초)다.
- **믹스 설정 (유물별, 없으면 0):** `sidechain`은 킥마다 유물 소리를 (1 - 값)까지 0.01초에 눌렀다가 0.2초에 되돌린다. 4분 정박 킥(매 박 머리) 기준으로 설계했다. `reverbSend`·`delaySend`는 공통 리버브(감쇠 노이즈 임펄스 1.6초)와 공통 딜레이(점8분 = 0.75박 = 0.3462초, JSON `delayNote`, 없으면 3/8, 피드백 0.35, 피드백 로우패스 3000Hz)로 보내는 양이다. `lofi`는 계단 곡선(12비트에서 3비트로)과 로우패스(18000Hz에서 2500Hz로)를 값에 따라 건다. `lowCut`(저음 깎기)은 하이패스 20 x (800 / 20)^값 Hz, `highCut`(고음 깎기)은 로우패스 20000 x (800 / 20000)^값 Hz다 (값 1이면 둘 다 800Hz, Q 0.707, 12dB/oct). `hallSend`는 두 번째 리버브 '홀'로 보내는 양이다: 짧은 룸(위 공통 리버브 1.6초)과 달리 길이 4초, 프리딜레이 30ms, 좌우 다른 노이즈, 꼬리 뒤쪽일수록 어둡고 리턴에 하이패스 250Hz·로우패스 6000Hz. `chorus`는 스테레오 코러스(좌우 지연 15ms를 ±3ms 반대 위상으로 흔듦, LFO는 1마디에 한 번 = bpm / 240 Hz, 젖은 소리 = 값, 마른 소리 = 1 - 값 x 0.5). `tape`는 아날로그 테이프 질감(포화 tanh drive 1 + 4 x 값, 흔들림 8ms 지연을 ±0.6 x 값 ms로 2박에 한 번, 고음 감쇠 로우패스 18000 x (6000 / 18000)^값 Hz)로, 디지털 비트 감소인 `lofi`와 다르다. 템포에 묶인 LFO는 모두 루프 머리에서 위상 0이다. 소리 경로는 볼륨, 사이드체인, 하이패스, 로우패스, 필터 스윕, 테이프, 로파이, 코러스, 팬 순이고 리버브·홀·딜레이 센드는 팬 앞(코러스 뒤)에서 뽑는다.
- **데모 드럼:** 툴의 데모 드럼(킥·스네어)은 미리듣기 전용이며 이 데이터에 없다.
- **스케일:** A 자연 단음계 (C 자연 단음계 + root 9) (반음 간격 0 2 3 5 7 8 10). 음높이는 C 기준 스케일 음에 키 `root`(9) 반음을 더한다(JSON `root` 0~11, 없으면 0). 음높이 악기는 스케일 음 15행(JSON `pitchRows` 8 또는 15, 없으면 8, 행 0이 가장 낮다), 타악은 행 1개다. 노트의 `midi`·`pitch`는 키와 유물의 옥타브 이동을 반영한 실제 음이다.
- **유물 설정 (유물별, 없으면 기본):** `swing`(0~0.5)이 있으면 그 유물만 이 스윙을 쓰고 없으면 전체 스윙을 따른다. `octaveShift`(-2~+2)는 음을 옥타브 단위로 옮긴다(MIDI 0~127을 넘으면 옥타브 단위로 안으로 접는다). `pan`(-1 왼쪽 ~ 1 오른쪽)은 마스터로 가는 소리만 좌우로 보내고 리버브·딜레이 센드는 가운데에서 뽑는다. `filterSweep`({ from, to, shape? }, 각 0~1)은 사이클 머리에서 끝까지 로우패스를 20000 x (800 / 20000)^값 Hz로 움직이고 사이클마다 처음으로 돌아간다(고음 깎기와 따로 직렬로 건다). `shape`는 up(from -> to, 없으면 이것), down(to -> from), upDown(사이클 앞 절반 from -> to, 뒤 절반 to -> from). `loops`(사이클 안 루프별 true/false)가 있으면 false인 루프에서 그 유물의 노트를 치지 않는다(없으면 모든 루프, 모자란 칸은 켜짐).
- **사이클:** 8루프 = 32마디 (JSON `cycleLoops` 1, 2, 4, 8, 없으면 1). 노트 데이터는 4마디 한 루프이고, 필터 스윕과 등장 루프 같은 자동화가 사이클 전체에 걸친다.
- **원본 데이터:** 맨 아래 JSON이 원본이고 위의 표는 JSON에서 만든 것이다. 둘이 다르면 JSON을 따른다. 툴의 불러오기도 JSON만 읽는다.
- **게임 반영 시 주의:** 게임의 쿵(A)·짝(S) 판정 소리와 겹치지 않게 킥·스네어 음색은 쓰지 않았다. 템포와 격자는 위 시간 기준을 따르며 게임 링 박자(0.3초)와 묶여 있지 않다. 볼륨(`volume` x `mixVolume`)은 상대값이다. 합성 파라미터는 Web Audio API 기준(오실레이터 파형, BiquadFilter, 게인 엔벨로프)이다.
- **선택 파라미터:** `distortion`(WaveShaper tanh 곡선, drive가 클수록 강함, 필터 앞), `fm`(사인 모듈레이터가 주파수를 변조, 깊이 = index x 모듈레이터 Hz가 decay초 동안 0으로), `vibrato`(LFO로 detune을 ±depth센트 흔듦, delay초 뒤 시작), `hold`(게이트를 max(1칸, 어택+디케이, hold)로 늘림), `filterLfo`(사인 LFO가 메인 필터 주파수에 ±depth Hz를 rate Hz로 더함, 노트 시작에 위상 0), `spread`(오실레이터를 좌우로 -spread ~ +spread에 고르게 벌림), `tremolo`(노트 게인을 beats박 주기로 1 - depth ~ 1 사이에서 흔듦, 루프 머리 기준 위상, stereo면 좌우 반대 위상), `formants`(메인 필터 대신 병렬 밴드패스 [{ freq, Q, gain }]를 지나 합침, 보컬 모음. 자체 필터가 없는 노이즈도 포먼트를 지난다)는 있는 프리셋에만 쓴다. 없으면 그 처리를 하지 않는다.

## 요약

| 유물 | 악기 | 음높이 범위 | 노트 수 | 특징 |
|---|---|---|---|---|
| 베이스 | 리스 베이스 | A2 ~ G4 | 32 | 32/64칸 빽빽함, 엇박 위주, 음 8종, 폭 22반음, 강약 있음, 믹스 설정 있음, 등장 루프 있음 |
| 코드 | 퓨처 코드 | B3 ~ A4 | 72 | 24/64칸 보통, 정박·엇박 섞임, 음 7종, 폭 10반음, 화음 있음, 강약 있음, 긴 노트 있음, 믹스 설정 있음, 유물 설정 있음 |
| 리드 | 슈퍼소 리드 | C5 ~ C6 | 28 | 28/64칸 보통, 정박·엇박 섞임, 음 8종, 폭 12반음, 강약 있음, 긴 노트 있음, 믹스 설정 있음, 등장 루프 있음 |
| 플럭 | 신스 플럭 | A3 ~ G5 | 64 | 64/64칸 빽빽함, 엇박 위주, 음 13종, 폭 22반음, 강약 있음, 믹스 설정 있음, 유물 설정 있음, 등장 루프 있음 |
| 하이햇 | 클로즈드 하이햇 | 타격음 | 64 | 64/64칸 빽빽함, 엇박 위주, 타악, 강약 있음, 롤 있음, 유물 설정 있음, 등장 루프 있음 |

믹스 바: 1번 베이스 (100%), 2번 코드 (100%), 3번 리드 (100%), 4번 플럭 (100%), 5번 하이햇 (100%)

## 베이스

- **악기:** 리스 베이스 (`reese_bass`, 음높이 악기, 행 0 옥타브 2)
- **볼륨:** 80%, 믹스 1번 칸 100%
- **노트 수:** 32
- **믹스 설정:** 사이드체인 50%, 리버브 센드 0%, 딜레이 센드 0%, 로파이 0%, 저음 깎기 0%, 고음 깎기 0%, 코러스 0%, 홀 리버브 0%, 테이프 15%
- **등장 루프:** 2, 3, 5, 6, 8 / 8

합성 파라미터:

- 오실레이터 sawtooth, 음높이 x1, 디튠 -18센트, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 디튠 18센트, 게인 1
- 오실레이터 sine, 음높이 x0.5, 게인 0.6
- 필터 lowpass 900Hz Q1
- 디스토션: drive 2 (오실레이터 합을 tanh 곡선으로 찌그러뜨린 뒤 필터)
- 엔벨로프: 어택 0.01초, 디케이 0.3초, 서스테인 0.8, 릴리스 0.1초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.25

| 박 | .0 | .25 | .5 | .75 |
|---|---|---|---|---|
| 1 | - | - | A2 | A2@m |
| 2 | - | - | A2 | A2@m |
| 3 | - | - | A2 | A2@m |
| 4 | - | - | A2 | A3@m |
| 5 | - | - | F3 | F3@m |
| 6 | - | - | F3 | F3@m |
| 7 | - | - | F3 | F3@m |
| 8 | - | - | F3 | F4@m |
| 9 | - | - | C3 | C3@m |
| 10 | - | - | C3 | C3@m |
| 11 | - | - | C3 | C3@m |
| 12 | - | - | C3 | C4@m |
| 13 | - | - | G3 | G3@m |
| 14 | - | - | G3 | G3@m |
| 15 | - | - | G3 | G3@m |
| 16 | - | - | G3 | G4@m |

한 줄 패턴:

```
1.0:- 1.25:- 1.5:A2 1.75:A2@m 2.0:- 2.25:- 2.5:A2 2.75:A2@m 3.0:- 3.25:- 3.5:A2 3.75:A2@m 4.0:- 4.25:- 4.5:A2 4.75:A3@m 5.0:- 5.25:- 5.5:F3 5.75:F3@m 6.0:- 6.25:- 6.5:F3 6.75:F3@m 7.0:- 7.25:- 7.5:F3 7.75:F3@m 8.0:- 8.25:- 8.5:F3 8.75:F4@m 9.0:- 9.25:- 9.5:C3 9.75:C3@m 10.0:- 10.25:- 10.5:C3 10.75:C3@m 11.0:- 11.25:- 11.5:C3 11.75:C3@m 12.0:- 12.25:- 12.5:C3 12.75:C4@m 13.0:- 13.25:- 13.5:G3 13.75:G3@m 14.0:- 14.25:- 14.5:G3 14.75:G3@m 15.0:- 15.25:- 15.5:G3 15.75:G3@m 16.0:- 16.25:- 16.5:G3 16.75:G4@m
```

## 코드

- **악기:** 퓨처 코드 (`future_chord`, 음높이 악기, 행 0 옥타브 3)
- **볼륨:** 60%, 믹스 2번 칸 100%
- **노트 수:** 72
- **믹스 설정:** 사이드체인 45%, 리버브 센드 15%, 딜레이 센드 0%, 로파이 0%, 저음 깎기 40% (87Hz), 고음 깎기 0%, 코러스 0%, 홀 리버브 0%, 테이프 0%
- **유물 설정:** 필터 스윕 70% (2101Hz) -> 0% (20000Hz)

합성 파라미터:

- 오실레이터 sawtooth, 음높이 x1, 디튠 -15센트, 게인 1
- 오실레이터 square, 음높이 x0.5, 게인 0.3
- 오실레이터 sawtooth, 음높이 x1, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 디튠 15센트, 게인 1
- 필터 lowpass 1800Hz Q3, 시작 6000Hz에서 0.18초 동안 이동
- 좌우 벌림(spread): 0.6 (오실레이터를 -0.6 ~ +0.6에 고르게)
- 엔벨로프: 어택 0.005초, 디케이 0.25초, 서스테인 0.4, 릴리스 0.12초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.2

| 박 | .0 | .25 | .5 | .75 |
|---|---|---|---|---|
| 1 | C4*3+E4*3+A4*3 | = | = | C4*3@m+E4*3@m+A4*3@m |
| 2 | = | = | C4*2@m+E4*2@m+A4*2@m | = |
| 3 | C4*3+E4*3+A4*3 | = | = | C4*3@m+E4*3@m+A4*3@m |
| 4 | = | = | C4@m+E4@m+A4@m | - |
| 5 | C4*3+F4*3+A4*3 | = | = | C4*3@m+F4*3@m+A4*3@m |
| 6 | = | = | C4*2@m+F4*2@m+A4*2@m | = |
| 7 | C4*3+F4*3+A4*3 | = | = | C4*3@m+F4*3@m+A4*3@m |
| 8 | = | = | C4@m+F4@m+A4@m | - |
| 9 | C4*3+E4*3+G4*3 | = | = | C4*3@m+E4*3@m+G4*3@m |
| 10 | = | = | C4*2@m+E4*2@m+G4*2@m | = |
| 11 | C4*3+E4*3+G4*3 | = | = | C4*3@m+E4*3@m+G4*3@m |
| 12 | = | = | C4@m+E4@m+G4@m | - |
| 13 | B3*3+D4*3+G4*3 | = | = | B3*3@m+D4*3@m+G4*3@m |
| 14 | = | = | B3*2@m+D4*2@m+G4*2@m | = |
| 15 | B3*3+D4*3+G4*3 | = | = | B3*3@m+D4*3@m+G4*3@m |
| 16 | = | = | B3@m+D4@m+G4@m | - |

한 줄 패턴:

```
1.0:C4*3+E4*3+A4*3 1.25:= 1.5:= 1.75:C4*3@m+E4*3@m+A4*3@m 2.0:= 2.25:= 2.5:C4*2@m+E4*2@m+A4*2@m 2.75:= 3.0:C4*3+E4*3+A4*3 3.25:= 3.5:= 3.75:C4*3@m+E4*3@m+A4*3@m 4.0:= 4.25:= 4.5:C4@m+E4@m+A4@m 4.75:- 5.0:C4*3+F4*3+A4*3 5.25:= 5.5:= 5.75:C4*3@m+F4*3@m+A4*3@m 6.0:= 6.25:= 6.5:C4*2@m+F4*2@m+A4*2@m 6.75:= 7.0:C4*3+F4*3+A4*3 7.25:= 7.5:= 7.75:C4*3@m+F4*3@m+A4*3@m 8.0:= 8.25:= 8.5:C4@m+F4@m+A4@m 8.75:- 9.0:C4*3+E4*3+G4*3 9.25:= 9.5:= 9.75:C4*3@m+E4*3@m+G4*3@m 10.0:= 10.25:= 10.5:C4*2@m+E4*2@m+G4*2@m 10.75:= 11.0:C4*3+E4*3+G4*3 11.25:= 11.5:= 11.75:C4*3@m+E4*3@m+G4*3@m 12.0:= 12.25:= 12.5:C4@m+E4@m+G4@m 12.75:- 13.0:B3*3+D4*3+G4*3 13.25:= 13.5:= 13.75:B3*3@m+D4*3@m+G4*3@m 14.0:= 14.25:= 14.5:B3*2@m+D4*2@m+G4*2@m 14.75:= 15.0:B3*3+D4*3+G4*3 15.25:= 15.5:= 15.75:B3*3@m+D4*3@m+G4*3@m 16.0:= 16.25:= 16.5:B3@m+D4@m+G4@m 16.75:-
```

## 리드

- **악기:** 슈퍼소 리드 (`supersaw_lead`, 음높이 악기, 행 0 옥타브 4)
- **볼륨:** 80%, 믹스 3번 칸 100%
- **노트 수:** 28
- **믹스 설정:** 사이드체인 20%, 리버브 센드 15%, 딜레이 센드 15%, 로파이 0%, 저음 깎기 0%, 고음 깎기 0%, 코러스 0%, 홀 리버브 20%, 테이프 0%
- **등장 루프:** 5, 6, 7, 8 / 8

합성 파라미터:

- 오실레이터 sawtooth, 음높이 x1, 디튠 -14센트, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 디튠 -7센트, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 디튠 7센트, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 디튠 14센트, 게인 1
- 필터 lowpass 6000Hz Q0.8
- 비브라토: 5.5Hz, 깊이 ±8센트, 0.15초 뒤 시작
- 엔벨로프: 어택 0.006초, 디케이 0.12초, 서스테인 0.75, 릴리스 0.14초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.17

| 박 | .0 | .25 | .5 | .75 |
|---|---|---|---|---|
| 1 | E5*2 | = | - | E5@m |
| 2 | D5*2 | = | C5*2 | = |
| 3 | A5*3 | = | = | G5@m |
| 4 | E5*3 | = | = | - |
| 5 | A5*2 | = | - | A5@m |
| 6 | G5*2 | = | F5*2 | = |
| 7 | C6*3 | = | = | A5@m |
| 8 | F5*3 | = | = | - |
| 9 | G5*2 | = | - | G5@m |
| 10 | E5*2 | = | C5*2 | = |
| 11 | C6*3 | = | = | B5@m |
| 12 | G5*3 | = | = | - |
| 13 | B5*2 | = | - | A5@m |
| 14 | G5*2 | = | D5*2 | = |
| 15 | G5*2 | = | A5*2 | = |
| 16 | B5*4 | = | = | = |

한 줄 패턴:

```
1.0:E5*2 1.25:= 1.5:- 1.75:E5@m 2.0:D5*2 2.25:= 2.5:C5*2 2.75:= 3.0:A5*3 3.25:= 3.5:= 3.75:G5@m 4.0:E5*3 4.25:= 4.5:= 4.75:- 5.0:A5*2 5.25:= 5.5:- 5.75:A5@m 6.0:G5*2 6.25:= 6.5:F5*2 6.75:= 7.0:C6*3 7.25:= 7.5:= 7.75:A5@m 8.0:F5*3 8.25:= 8.5:= 8.75:- 9.0:G5*2 9.25:= 9.5:- 9.75:G5@m 10.0:E5*2 10.25:= 10.5:C5*2 10.75:= 11.0:C6*3 11.25:= 11.5:= 11.75:B5@m 12.0:G5*3 12.25:= 12.5:= 12.75:- 13.0:B5*2 13.25:= 13.5:- 13.75:A5@m 14.0:G5*2 14.25:= 14.5:D5*2 14.75:= 15.0:G5*2 15.25:= 15.5:A5*2 15.75:= 16.0:B5*4 16.25:= 16.5:= 16.75:=
```

## 플럭

- **악기:** 신스 플럭 (`synth_pluck`, 음높이 악기, 행 0 옥타브 4)
- **볼륨:** 50%, 믹스 4번 칸 100%
- **노트 수:** 64
- **믹스 설정:** 사이드체인 30%, 리버브 센드 15%, 딜레이 센드 20%, 로파이 0%, 저음 깎기 0%, 고음 깎기 0%, 코러스 0%, 홀 리버브 0%, 테이프 0%
- **유물 설정:** 옥타브 -1, 팬 왼쪽 15
- **등장 루프:** 1, 2, 3, 4, 5, 6, 8 / 8

합성 파라미터:

- 오실레이터 sawtooth, 음높이 x1, 게인 1
- 오실레이터 square, 음높이 x1, 디튠 8센트, 게인 0.5
- 오실레이터 sawtooth, 음높이 x1, 디튠 -8센트, 게인 0.5
- 필터 lowpass 2800Hz Q2, 시작 8000Hz에서 0.09초 동안 이동
- 엔벨로프: 어택 0.002초, 디케이 0.22초, 서스테인 0.05, 릴리스 0.08초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.3

| 박 | .0 | .25 | .5 | .75 |
|---|---|---|---|---|
| 1 | A3 | A4@w | C5@w | E5 |
| 2 | C5@w | A4@w | C4 | A4@w |
| 3 | A3 | A4@w | C5@w | E5 |
| 4 | C5@w | A4@w | C4 | A4@w |
| 5 | C4 | A4@w | C5@w | F5 |
| 6 | C5@w | A4@w | C4 | A4@w |
| 7 | C4 | A4@w | C5@w | F5 |
| 8 | C5@w | A4@w | C4 | A4@w |
| 9 | C4 | C5@w | E5@w | G5 |
| 10 | E5@w | C5@w | G4 | E4@w |
| 11 | C4 | C5@w | E5@w | G5 |
| 12 | E5@w | C5@w | G4 | E4@w |
| 13 | B3 | G4@w | B4@w | D5 |
| 14 | B4@w | G4@w | D4 | G4@w |
| 15 | B3 | G4@w | B4@w | D5 |
| 16 | B4@w | G4@w | D4 | G4@w |

한 줄 패턴:

```
1.0:A3 1.25:A4@w 1.5:C5@w 1.75:E5 2.0:C5@w 2.25:A4@w 2.5:C4 2.75:A4@w 3.0:A3 3.25:A4@w 3.5:C5@w 3.75:E5 4.0:C5@w 4.25:A4@w 4.5:C4 4.75:A4@w 5.0:C4 5.25:A4@w 5.5:C5@w 5.75:F5 6.0:C5@w 6.25:A4@w 6.5:C4 6.75:A4@w 7.0:C4 7.25:A4@w 7.5:C5@w 7.75:F5 8.0:C5@w 8.25:A4@w 8.5:C4 8.75:A4@w 9.0:C4 9.25:C5@w 9.5:E5@w 9.75:G5 10.0:E5@w 10.25:C5@w 10.5:G4 10.75:E4@w 11.0:C4 11.25:C5@w 11.5:E5@w 11.75:G5 12.0:E5@w 12.25:C5@w 12.5:G4 12.75:E4@w 13.0:B3 13.25:G4@w 13.5:B4@w 13.75:D5 14.0:B4@w 14.25:G4@w 14.5:D4 14.75:G4@w 15.0:B3 15.25:G4@w 15.5:B4@w 15.75:D5 16.0:B4@w 16.25:G4@w 16.5:D4 16.75:G4@w
```

## 하이햇

- **악기:** 클로즈드 하이햇 (`closed_hat`, 타악·노이즈)
- **볼륨:** 70%, 믹스 5번 칸 100%
- **노트 수:** 64
- **유물 설정:** 팬 오른쪽 15
- **등장 루프:** 2, 3, 4, 5, 6, 8 / 8

합성 파라미터:

- 노이즈 게인 1 (자체 필터 highpass 7000Hz Q0.7)
- 엔벨로프: 어택 0.001초, 디케이 0.04초, 서스테인 0, 릴리스 0.01초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.35

| 박 | .0 | .25 | .5 | .75 |
|---|---|---|---|---|
| 1 | X@m | X@w | X | X@w |
| 2 | X@m | X@w | X | X@w |
| 3 | X@m | X@w | X | X@w |
| 4 | X@m | X@w | X | X@w |
| 5 | X@m | X@w | X | X@w |
| 6 | X@m | X@w | X | X@w |
| 7 | X@m | X@w | X | X@w |
| 8 | X@m | X@w | X | X@w |
| 9 | X@m | X@w | X | X@w |
| 10 | X@m | X@w | X | X@w |
| 11 | X@m | X@w | X | X@w |
| 12 | X@m | X@w | X | X@w |
| 13 | X@m | X@w | X | X@w |
| 14 | X@m | X@w | X | X@w |
| 15 | X@m | X@w | X | X@w |
| 16 | X@m | X@w | X | X/2@m |

한 줄 패턴:

```
1.0:X@m 1.25:X@w 1.5:X 1.75:X@w 2.0:X@m 2.25:X@w 2.5:X 2.75:X@w 3.0:X@m 3.25:X@w 3.5:X 3.75:X@w 4.0:X@m 4.25:X@w 4.5:X 4.75:X@w 5.0:X@m 5.25:X@w 5.5:X 5.75:X@w 6.0:X@m 6.25:X@w 6.5:X 6.75:X@w 7.0:X@m 7.25:X@w 7.5:X 7.75:X@w 8.0:X@m 8.25:X@w 8.5:X 8.75:X@w 9.0:X@m 9.25:X@w 9.5:X 9.75:X@w 10.0:X@m 10.25:X@w 10.5:X 10.75:X@w 11.0:X@m 11.25:X@w 11.5:X 11.75:X@w 12.0:X@m 12.25:X@w 12.5:X 12.75:X@w 13.0:X@m 13.25:X@w 13.5:X 13.75:X@w 14.0:X@m 14.25:X@w 14.5:X 14.75:X@w 15.0:X@m 15.25:X@w 15.5:X 15.75:X@w 16.0:X@m 16.25:X@w 16.5:X 16.75:X/2@m
```

## 데이터 (JSON)

최상위 선택 항목: `bpm`(60~180 정수, 없으면 130), `grid`(8 또는 16, 없으면 8), `root`(0~11, 없으면 0), `pitchRows`(8 또는 15, 없으면 8), `cycleLoops`(1, 2, 4, 8, 없으면 1), `delayNote`(1/8, 3/16, 1/4, 3/8, 없으면 3/8). `timing`은 참고값이라 불러올 때 쓰지 않는다.

`notes`의 `step`은 칸 번호(8분 격자 0~31, 16분 격자 0~63), `row`는 음높이 행(스케일 기준, 행 0이 가장 낮음), `midi`와 `pitch`는 그 행의 실제 음(타악은 null)이다. 선택 항목: 노트의 `velocity`(0~1, 없으면 1), `length`(칸 수, 없으면 1), `repeat`(한 칸 안 타격 수 1~4, 없으면 1, 2 이상이면 length는 1), 유물의 `sidechain`·`reverbSend`·`delaySend`·`lofi`·`lowCut`·`highCut`(0~1, 없으면 0)·`swing`(없으면 전체 스윙)·`octaveShift`(-2~2, 없으면 0)·`pan`(-1~1, 없으면 0)·`filterSweep`({ from, to, shape? }, 없으면 없음)·`loops`(루프별 켜짐 배열, 없으면 모두 켜짐)·`chorus`·`hallSend`·`tape`(0~1, 없으면 0), 전체의 `groove.swing`(0~0.5, 없으면 0).

```json
{
  "schema": "4bit-prototype-relic-beat-tool/v1",
  "exportedAt": "2026-11-08T11:24:26.115Z",
  "timing": {
    "bpm": 130,
    "grid": 16,
    "beatSeconds": 0.46153846153846156,
    "stepSeconds": 0.11538461538461539,
    "beats": 16,
    "steps": 64,
    "loopSeconds": 7.384615384615385
  },
  "scale": {
    "name": "C 자연 단음계",
    "root": "A",
    "intervals": [
      0,
      2,
      3,
      5,
      7,
      8,
      10
    ]
  },
  "grid": 16,
  "root": 9,
  "pitchRows": 15,
  "cycleLoops": 8,
  "delayNote": "3/16",
  "relics": [
    {
      "id": "relic_1",
      "name": "베이스",
      "preset": {
        "id": "reese_bass",
        "name": "리스 베이스",
        "pitched": true,
        "octave": 2,
        "params": {
          "oscs": [
            {
              "type": "sawtooth",
              "detune": -18,
              "gain": 1
            },
            {
              "type": "sawtooth",
              "detune": 18,
              "gain": 1
            },
            {
              "type": "sine",
              "ratio": 0.5,
              "gain": 0.6
            }
          ],
          "filter": {
            "type": "lowpass",
            "freq": 900,
            "Q": 1
          },
          "distortion": {
            "drive": 2
          },
          "env": {
            "attack": 0.01,
            "decay": 0.3,
            "sustain": 0.8,
            "release": 0.1
          },
          "gain": 0.25
        }
      },
      "volume": 0.8,
      "mixSlot": 1,
      "mixVolume": 1,
      "sidechain": 0.5,
      "tape": 0.15,
      "loops": [
        false,
        true,
        true,
        false,
        true,
        true,
        false,
        true
      ],
      "notes": [
        {
          "step": 2,
          "row": 0,
          "midi": 45,
          "pitch": "A2"
        },
        {
          "step": 3,
          "row": 0,
          "midi": 45,
          "pitch": "A2",
          "velocity": 0.7
        },
        {
          "step": 6,
          "row": 0,
          "midi": 45,
          "pitch": "A2"
        },
        {
          "step": 7,
          "row": 0,
          "midi": 45,
          "pitch": "A2",
          "velocity": 0.7
        },
        {
          "step": 10,
          "row": 0,
          "midi": 45,
          "pitch": "A2"
        },
        {
          "step": 11,
          "row": 0,
          "midi": 45,
          "pitch": "A2",
          "velocity": 0.7
        },
        {
          "step": 14,
          "row": 0,
          "midi": 45,
          "pitch": "A2"
        },
        {
          "step": 15,
          "row": 7,
          "midi": 57,
          "pitch": "A3",
          "velocity": 0.7
        },
        {
          "step": 18,
          "row": 5,
          "midi": 53,
          "pitch": "F3"
        },
        {
          "step": 19,
          "row": 5,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.7
        },
        {
          "step": 22,
          "row": 5,
          "midi": 53,
          "pitch": "F3"
        },
        {
          "step": 23,
          "row": 5,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.7
        },
        {
          "step": 26,
          "row": 5,
          "midi": 53,
          "pitch": "F3"
        },
        {
          "step": 27,
          "row": 5,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.7
        },
        {
          "step": 30,
          "row": 5,
          "midi": 53,
          "pitch": "F3"
        },
        {
          "step": 31,
          "row": 12,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.7
        },
        {
          "step": 34,
          "row": 2,
          "midi": 48,
          "pitch": "C3"
        },
        {
          "step": 35,
          "row": 2,
          "midi": 48,
          "pitch": "C3",
          "velocity": 0.7
        },
        {
          "step": 38,
          "row": 2,
          "midi": 48,
          "pitch": "C3"
        },
        {
          "step": 39,
          "row": 2,
          "midi": 48,
          "pitch": "C3",
          "velocity": 0.7
        },
        {
          "step": 42,
          "row": 2,
          "midi": 48,
          "pitch": "C3"
        },
        {
          "step": 43,
          "row": 2,
          "midi": 48,
          "pitch": "C3",
          "velocity": 0.7
        },
        {
          "step": 46,
          "row": 2,
          "midi": 48,
          "pitch": "C3"
        },
        {
          "step": 47,
          "row": 9,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7
        },
        {
          "step": 50,
          "row": 6,
          "midi": 55,
          "pitch": "G3"
        },
        {
          "step": 51,
          "row": 6,
          "midi": 55,
          "pitch": "G3",
          "velocity": 0.7
        },
        {
          "step": 54,
          "row": 6,
          "midi": 55,
          "pitch": "G3"
        },
        {
          "step": 55,
          "row": 6,
          "midi": 55,
          "pitch": "G3",
          "velocity": 0.7
        },
        {
          "step": 58,
          "row": 6,
          "midi": 55,
          "pitch": "G3"
        },
        {
          "step": 59,
          "row": 6,
          "midi": 55,
          "pitch": "G3",
          "velocity": 0.7
        },
        {
          "step": 62,
          "row": 6,
          "midi": 55,
          "pitch": "G3"
        },
        {
          "step": 63,
          "row": 13,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7
        }
      ]
    },
    {
      "id": "relic_2",
      "name": "코드",
      "preset": {
        "id": "future_chord",
        "name": "퓨처 코드",
        "pitched": true,
        "octave": 3,
        "params": {
          "oscs": [
            {
              "type": "sawtooth",
              "detune": -15,
              "gain": 1
            },
            {
              "type": "square",
              "ratio": 0.5,
              "gain": 0.3
            },
            {
              "type": "sawtooth",
              "gain": 1
            },
            {
              "type": "sawtooth",
              "detune": 15,
              "gain": 1
            }
          ],
          "filter": {
            "type": "lowpass",
            "freq": 1800,
            "Q": 3,
            "from": 6000,
            "sweep": 0.18
          },
          "spread": 0.6,
          "env": {
            "attack": 0.005,
            "decay": 0.25,
            "sustain": 0.4,
            "release": 0.12
          },
          "gain": 0.2
        }
      },
      "volume": 0.6,
      "mixSlot": 2,
      "mixVolume": 1,
      "sidechain": 0.45,
      "reverbSend": 0.15,
      "lowCut": 0.4,
      "filterSweep": {
        "from": 0.7,
        "to": 0
      },
      "notes": [
        {
          "step": 0,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "length": 3
        },
        {
          "step": 0,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "length": 3
        },
        {
          "step": 0,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "length": 3
        },
        {
          "step": 3,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 3,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 3,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 6,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 6,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 6,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 8,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "length": 3
        },
        {
          "step": 8,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "length": 3
        },
        {
          "step": 8,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "length": 3
        },
        {
          "step": 11,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 11,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 11,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 14,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7
        },
        {
          "step": 14,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7
        },
        {
          "step": 14,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7
        },
        {
          "step": 16,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "length": 3
        },
        {
          "step": 16,
          "row": 5,
          "midi": 65,
          "pitch": "F4",
          "length": 3
        },
        {
          "step": 16,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "length": 3
        },
        {
          "step": 19,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 19,
          "row": 5,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 19,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 22,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 22,
          "row": 5,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 22,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 24,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "length": 3
        },
        {
          "step": 24,
          "row": 5,
          "midi": 65,
          "pitch": "F4",
          "length": 3
        },
        {
          "step": 24,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "length": 3
        },
        {
          "step": 27,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 27,
          "row": 5,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 27,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 30,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7
        },
        {
          "step": 30,
          "row": 5,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.7
        },
        {
          "step": 30,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7
        },
        {
          "step": 32,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "length": 3
        },
        {
          "step": 32,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "length": 3
        },
        {
          "step": 32,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "length": 3
        },
        {
          "step": 35,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 35,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 35,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 38,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 38,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 38,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 40,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "length": 3
        },
        {
          "step": 40,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "length": 3
        },
        {
          "step": 40,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "length": 3
        },
        {
          "step": 43,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 43,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 43,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 46,
          "row": 2,
          "midi": 60,
          "pitch": "C4",
          "velocity": 0.7
        },
        {
          "step": 46,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7
        },
        {
          "step": 46,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7
        },
        {
          "step": 48,
          "row": 1,
          "midi": 59,
          "pitch": "B3",
          "length": 3
        },
        {
          "step": 48,
          "row": 3,
          "midi": 62,
          "pitch": "D4",
          "length": 3
        },
        {
          "step": 48,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "length": 3
        },
        {
          "step": 51,
          "row": 1,
          "midi": 59,
          "pitch": "B3",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 51,
          "row": 3,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 51,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 54,
          "row": 1,
          "midi": 59,
          "pitch": "B3",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 54,
          "row": 3,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 54,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 56,
          "row": 1,
          "midi": 59,
          "pitch": "B3",
          "length": 3
        },
        {
          "step": 56,
          "row": 3,
          "midi": 62,
          "pitch": "D4",
          "length": 3
        },
        {
          "step": 56,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "length": 3
        },
        {
          "step": 59,
          "row": 1,
          "midi": 59,
          "pitch": "B3",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 59,
          "row": 3,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 59,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7,
          "length": 3
        },
        {
          "step": 62,
          "row": 1,
          "midi": 59,
          "pitch": "B3",
          "velocity": 0.7
        },
        {
          "step": 62,
          "row": 3,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.7
        },
        {
          "step": 62,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7
        }
      ]
    },
    {
      "id": "relic_3",
      "name": "리드",
      "preset": {
        "id": "supersaw_lead",
        "name": "슈퍼소 리드",
        "pitched": true,
        "octave": 4,
        "params": {
          "oscs": [
            {
              "type": "sawtooth",
              "detune": -14,
              "gain": 1
            },
            {
              "type": "sawtooth",
              "detune": -7,
              "gain": 1
            },
            {
              "type": "sawtooth",
              "gain": 1
            },
            {
              "type": "sawtooth",
              "detune": 7,
              "gain": 1
            },
            {
              "type": "sawtooth",
              "detune": 14,
              "gain": 1
            }
          ],
          "filter": {
            "type": "lowpass",
            "freq": 6000,
            "Q": 0.8
          },
          "vibrato": {
            "rate": 5.5,
            "depth": 8,
            "delay": 0.15
          },
          "env": {
            "attack": 0.006,
            "decay": 0.12,
            "sustain": 0.75,
            "release": 0.14
          },
          "gain": 0.17
        }
      },
      "volume": 0.8,
      "mixSlot": 3,
      "mixVolume": 1,
      "sidechain": 0.2,
      "reverbSend": 0.15,
      "delaySend": 0.15,
      "hallSend": 0.2,
      "loops": [
        false,
        false,
        false,
        false,
        true,
        true,
        true,
        true
      ],
      "notes": [
        {
          "step": 0,
          "row": 4,
          "midi": 76,
          "pitch": "E5",
          "length": 2
        },
        {
          "step": 3,
          "row": 4,
          "midi": 76,
          "pitch": "E5",
          "velocity": 0.7
        },
        {
          "step": 4,
          "row": 3,
          "midi": 74,
          "pitch": "D5",
          "length": 2
        },
        {
          "step": 6,
          "row": 2,
          "midi": 72,
          "pitch": "C5",
          "length": 2
        },
        {
          "step": 8,
          "row": 7,
          "midi": 81,
          "pitch": "A5",
          "length": 3
        },
        {
          "step": 11,
          "row": 6,
          "midi": 79,
          "pitch": "G5",
          "velocity": 0.7
        },
        {
          "step": 12,
          "row": 4,
          "midi": 76,
          "pitch": "E5",
          "length": 3
        },
        {
          "step": 16,
          "row": 7,
          "midi": 81,
          "pitch": "A5",
          "length": 2
        },
        {
          "step": 19,
          "row": 7,
          "midi": 81,
          "pitch": "A5",
          "velocity": 0.7
        },
        {
          "step": 20,
          "row": 6,
          "midi": 79,
          "pitch": "G5",
          "length": 2
        },
        {
          "step": 22,
          "row": 5,
          "midi": 77,
          "pitch": "F5",
          "length": 2
        },
        {
          "step": 24,
          "row": 9,
          "midi": 84,
          "pitch": "C6",
          "length": 3
        },
        {
          "step": 27,
          "row": 7,
          "midi": 81,
          "pitch": "A5",
          "velocity": 0.7
        },
        {
          "step": 28,
          "row": 5,
          "midi": 77,
          "pitch": "F5",
          "length": 3
        },
        {
          "step": 32,
          "row": 6,
          "midi": 79,
          "pitch": "G5",
          "length": 2
        },
        {
          "step": 35,
          "row": 6,
          "midi": 79,
          "pitch": "G5",
          "velocity": 0.7
        },
        {
          "step": 36,
          "row": 4,
          "midi": 76,
          "pitch": "E5",
          "length": 2
        },
        {
          "step": 38,
          "row": 2,
          "midi": 72,
          "pitch": "C5",
          "length": 2
        },
        {
          "step": 40,
          "row": 9,
          "midi": 84,
          "pitch": "C6",
          "length": 3
        },
        {
          "step": 43,
          "row": 8,
          "midi": 83,
          "pitch": "B5",
          "velocity": 0.7
        },
        {
          "step": 44,
          "row": 6,
          "midi": 79,
          "pitch": "G5",
          "length": 3
        },
        {
          "step": 48,
          "row": 8,
          "midi": 83,
          "pitch": "B5",
          "length": 2
        },
        {
          "step": 51,
          "row": 7,
          "midi": 81,
          "pitch": "A5",
          "velocity": 0.7
        },
        {
          "step": 52,
          "row": 6,
          "midi": 79,
          "pitch": "G5",
          "length": 2
        },
        {
          "step": 54,
          "row": 3,
          "midi": 74,
          "pitch": "D5",
          "length": 2
        },
        {
          "step": 56,
          "row": 6,
          "midi": 79,
          "pitch": "G5",
          "length": 2
        },
        {
          "step": 58,
          "row": 7,
          "midi": 81,
          "pitch": "A5",
          "length": 2
        },
        {
          "step": 60,
          "row": 8,
          "midi": 83,
          "pitch": "B5",
          "length": 4
        }
      ]
    },
    {
      "id": "relic_4",
      "name": "플럭",
      "preset": {
        "id": "synth_pluck",
        "name": "신스 플럭",
        "pitched": true,
        "octave": 4,
        "params": {
          "oscs": [
            {
              "type": "sawtooth",
              "gain": 1
            },
            {
              "type": "square",
              "detune": 8,
              "gain": 0.5
            },
            {
              "type": "sawtooth",
              "detune": -8,
              "gain": 0.5
            }
          ],
          "filter": {
            "type": "lowpass",
            "freq": 2800,
            "Q": 2,
            "from": 8000,
            "sweep": 0.09
          },
          "env": {
            "attack": 0.002,
            "decay": 0.22,
            "sustain": 0.05,
            "release": 0.08
          },
          "gain": 0.3
        }
      },
      "volume": 0.5,
      "mixSlot": 4,
      "mixVolume": 1,
      "sidechain": 0.3,
      "reverbSend": 0.15,
      "delaySend": 0.2,
      "octaveShift": -1,
      "pan": -0.15,
      "loops": [
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        true
      ],
      "notes": [
        {
          "step": 0,
          "row": 0,
          "midi": 57,
          "pitch": "A3"
        },
        {
          "step": 1,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 2,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 3,
          "row": 11,
          "midi": 76,
          "pitch": "E5"
        },
        {
          "step": 4,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 5,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 6,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 7,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 8,
          "row": 0,
          "midi": 57,
          "pitch": "A3"
        },
        {
          "step": 9,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 10,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 11,
          "row": 11,
          "midi": 76,
          "pitch": "E5"
        },
        {
          "step": 12,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 13,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 14,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 15,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 16,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 17,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 18,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 19,
          "row": 12,
          "midi": 77,
          "pitch": "F5"
        },
        {
          "step": 20,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 21,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 22,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 23,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 24,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 25,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 26,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 27,
          "row": 12,
          "midi": 77,
          "pitch": "F5"
        },
        {
          "step": 28,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 29,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 30,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 31,
          "row": 7,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.5
        },
        {
          "step": 32,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 33,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 34,
          "row": 11,
          "midi": 76,
          "pitch": "E5",
          "velocity": 0.5
        },
        {
          "step": 35,
          "row": 13,
          "midi": 79,
          "pitch": "G5"
        },
        {
          "step": 36,
          "row": 11,
          "midi": 76,
          "pitch": "E5",
          "velocity": 0.5
        },
        {
          "step": 37,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 38,
          "row": 6,
          "midi": 67,
          "pitch": "G4"
        },
        {
          "step": 39,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.5
        },
        {
          "step": 40,
          "row": 2,
          "midi": 60,
          "pitch": "C4"
        },
        {
          "step": 41,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 42,
          "row": 11,
          "midi": 76,
          "pitch": "E5",
          "velocity": 0.5
        },
        {
          "step": 43,
          "row": 13,
          "midi": 79,
          "pitch": "G5"
        },
        {
          "step": 44,
          "row": 11,
          "midi": 76,
          "pitch": "E5",
          "velocity": 0.5
        },
        {
          "step": 45,
          "row": 9,
          "midi": 72,
          "pitch": "C5",
          "velocity": 0.5
        },
        {
          "step": 46,
          "row": 6,
          "midi": 67,
          "pitch": "G4"
        },
        {
          "step": 47,
          "row": 4,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.5
        },
        {
          "step": 48,
          "row": 1,
          "midi": 59,
          "pitch": "B3"
        },
        {
          "step": 49,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.5
        },
        {
          "step": 50,
          "row": 8,
          "midi": 71,
          "pitch": "B4",
          "velocity": 0.5
        },
        {
          "step": 51,
          "row": 10,
          "midi": 74,
          "pitch": "D5"
        },
        {
          "step": 52,
          "row": 8,
          "midi": 71,
          "pitch": "B4",
          "velocity": 0.5
        },
        {
          "step": 53,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.5
        },
        {
          "step": 54,
          "row": 3,
          "midi": 62,
          "pitch": "D4"
        },
        {
          "step": 55,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.5
        },
        {
          "step": 56,
          "row": 1,
          "midi": 59,
          "pitch": "B3"
        },
        {
          "step": 57,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.5
        },
        {
          "step": 58,
          "row": 8,
          "midi": 71,
          "pitch": "B4",
          "velocity": 0.5
        },
        {
          "step": 59,
          "row": 10,
          "midi": 74,
          "pitch": "D5"
        },
        {
          "step": 60,
          "row": 8,
          "midi": 71,
          "pitch": "B4",
          "velocity": 0.5
        },
        {
          "step": 61,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.5
        },
        {
          "step": 62,
          "row": 3,
          "midi": 62,
          "pitch": "D4"
        },
        {
          "step": 63,
          "row": 6,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.5
        }
      ]
    },
    {
      "id": "relic_5",
      "name": "하이햇",
      "preset": {
        "id": "closed_hat",
        "name": "클로즈드 하이햇",
        "pitched": false,
        "octave": null,
        "params": {
          "noise": {
            "gain": 1,
            "filter": {
              "type": "highpass",
              "freq": 7000,
              "Q": 0.7
            }
          },
          "env": {
            "attack": 0.001,
            "decay": 0.04,
            "sustain": 0,
            "release": 0.01
          },
          "gain": 0.35
        }
      },
      "volume": 0.7,
      "mixSlot": 5,
      "mixVolume": 1,
      "pan": 0.15,
      "loops": [
        false,
        true,
        true,
        true,
        true,
        true,
        false,
        true
      ],
      "notes": [
        {
          "step": 0,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 1,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 2,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 3,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 4,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 5,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 6,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 7,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 8,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 9,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 10,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 11,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 12,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 13,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 14,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 15,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 16,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 17,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 18,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 19,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 20,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 21,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 22,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 23,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 24,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 25,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 26,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 27,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 28,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 29,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 30,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 31,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 32,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 33,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 34,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 35,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 36,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 37,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 38,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 39,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 40,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 41,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 42,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 43,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 44,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 45,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 46,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 47,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 48,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 49,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 50,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 51,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 52,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 53,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 54,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 55,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 56,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 57,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 58,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 59,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 60,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7
        },
        {
          "step": 61,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.4
        },
        {
          "step": 62,
          "row": 0,
          "midi": null,
          "pitch": null
        },
        {
          "step": 63,
          "row": 0,
          "midi": null,
          "pitch": null,
          "velocity": 0.7,
          "repeat": 2
        }
      ]
    }
  ]
}
```
