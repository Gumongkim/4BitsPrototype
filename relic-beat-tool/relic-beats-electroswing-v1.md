# 유물 비트 설계서

4Bit_Prototype 유물 비트 메이커(`relic-beat-tool/`)에서 내보낸 파일이다. 유물마다 악기 하나로 찍은 16박(4마디) 루프다.

> **일렉트로 스윙 v1 — 32마디 루프 한 곡 (116BPM, D 단조, 8분 스윙 0.33)**
> fox capture plan「Jazz me tender」(neoswing dance 버전)를 듣고 지금 툴로 낼 수 있는 재즈 느낌을 고른 곡이다. 진짜 재즈(즉흥 연주, 곡 전체에 걸친 코드 진행)가 아니라 워킹 베이스·피아노 컴핑·브라스 리프·라이드에 하우스 킥을 얹은 일렉트로 스윙 루프다.
> 코드 진행은 마디마다 Dm(add9) | Gm7 | B♭6 | A7 (4마디 반복). D 하모닉 마이너라 A7의 C#이 스케일 안에 있다. 8분 격자에 전체 스윙 0.33이라 뒷박(홀수 칸)이 셋잇단 느낌으로 늦게 온다.
>
> | 루프 | 마디 | 구간 | 워킹 베이스 | 피아노 | 브라스 | 클라리넷풍 플루트 | 라이드 |
> |---|---|---|---|---|---|---|---|
> | 1 | 1~4 | 인트로 | - | O | - | - | O |
> | 2 | 5~8 | 그루브 | O | O | - | - | O |
> | 3 | 9~12 | 테마 (브라스 리프) | O | O | O | - | O |
> | 4 | 13~16 | 테마 | O | O | O | - | O |
> | 5 | 17~20 | 브레이크 (피아노 + 플루트) | - | O | - | O | - |
> | 6 | 21~24 | 응답 (플루트가 리프 자리) | O | O | - | O | O |
> | 7 | 25~28 | 메인 | O | O | O | - | O |
> | 8 | 29~32 | 메인 (전부) | O | O | O | O | O |
>
> 권장 미리듣기: 데모 드럼 하우스/EDM, 킥 음색 기본, 펌핑 기준 4분 정박, 드럼 볼륨 60~70%. 32마디 전체는 믹스 재생을 약 66초 듣거나 WAV 길이를 '한 사이클'로 내보낸다. 피아노에 로파이를, 브라스·베이스·플루트에 테이프를 걸어 옛 녹음 느낌을 냈다. 데모 드럼은 32마디 내내 같아서 인트로·브레이크에서도 킥이 나온다.

## 읽는 법

- **시간 기준:** 116BPM(4분음표 기준, JSON `bpm`, 없으면 130). 1박 = 4분음표 = 0.5172초, 격자 8분(JSON `grid`, 없으면 8): 칸 하나 = 0.5박 = 8분음표 = 0.2586초, 16박 = 4마디 = 32칸, 루프 = 8.2759초. 루프는 이음매 없이 반복한다. 표의 초는 반올림한 값이고 정확한 칸 시간은 30 / 116초다.
- **칸 번호:** 0~31. 칸 i는 루프 시작 후 i x 0.2586초에 울린다. "박.위치" 표기로 칸 0 = 1.0, 칸 1 = 1.5, 칸 2 = 2.0 … 칸 31 = 16.5다.
- **음 표기:** 과학적 음이름(C4 = MIDI 60, 샵 표기). 쉬는 칸은 `-`, 음높이 없는 타악은 `X`, 같은 칸의 여러 음(화음)은 `+`로 잇는다.
- **세기:** 음 뒤 `@m`은 중(0.7), `@w`는 약(0.4)이고 표기가 없으면 강(1.0)이다 (타악은 `X@m`). JSON `velocity`는 노트 게인 배율이고 없으면 1이다.
- **노트 길이:** 기본 1칸이다. `C3*4`처럼 `*칸 수`가 붙은 음높이 노트는 그만큼 이어지고 표에서 이어지는 칸은 `=`다(JSON `length`, 없으면 1, 타악은 쓰지 않음). 게이트 = max(길이 x 0.2586초, 어택+디케이, 홀드)이고 루프 끝을 넘는 길이는 루프 끝에서 자른다. 악기의 릴리스는 게이트 뒤로 이어진다.
- **롤:** `X/3`처럼 `/N`이 붙은 노트는 그 칸에서 N번 나눠 친다 (JSON `repeat` 2~4, 없으면 1). 칸(스윙 반영)을 N등분한 간격으로 같은 세기로 치고, 한 번의 게이트는 그 간격이다. 롤 노트는 길이를 쓰지 않는다(1칸). 표기 순서는 음, 길이, 롤, 세기다 (예: `C3/2@m`).
- **스윙:** 33% (JSON `groove.swing`). 칸 i의 시각 = i x 0.2586초 + (i가 홀수면 swing x 0.2586초). 노트의 끝 경계도 같은 규칙을 따른다.
- **믹스 설정 (유물별, 없으면 0):** `sidechain`은 킥마다 유물 소리를 (1 - 값)까지 0.01초에 눌렀다가 0.2초에 되돌린다. 4분 정박 킥(매 박 머리) 기준으로 설계했다. `reverbSend`·`delaySend`는 공통 리버브(감쇠 노이즈 임펄스 1.6초)와 공통 딜레이(점4분 = 1.5박 = 0.7759초, JSON `delayNote`, 없으면 3/8, 피드백 0.35, 피드백 로우패스 3000Hz)로 보내는 양이다. `lofi`는 계단 곡선(12비트에서 3비트로)과 로우패스(18000Hz에서 2500Hz로)를 값에 따라 건다. `lowCut`(저음 깎기)은 하이패스 20 x (800 / 20)^값 Hz, `highCut`(고음 깎기)은 로우패스 20000 x (800 / 20000)^값 Hz다 (값 1이면 둘 다 800Hz, Q 0.707, 12dB/oct). `hallSend`는 두 번째 리버브 '홀'로 보내는 양이다: 짧은 룸(위 공통 리버브 1.6초)과 달리 길이 4초, 프리딜레이 30ms, 좌우 다른 노이즈, 꼬리 뒤쪽일수록 어둡고 리턴에 하이패스 250Hz·로우패스 6000Hz. `chorus`는 스테레오 코러스(좌우 지연 15ms를 ±3ms 반대 위상으로 흔듦, LFO는 1마디에 한 번 = bpm / 240 Hz, 젖은 소리 = 값, 마른 소리 = 1 - 값 x 0.5). `tape`는 아날로그 테이프 질감(포화 tanh drive 1 + 4 x 값, 흔들림 8ms 지연을 ±0.6 x 값 ms로 2박에 한 번, 고음 감쇠 로우패스 18000 x (6000 / 18000)^값 Hz)로, 디지털 비트 감소인 `lofi`와 다르다. 템포에 묶인 LFO는 모두 루프 머리에서 위상 0이다. 소리 경로는 볼륨, 사이드체인, 하이패스, 로우패스, 필터 스윕, 테이프, 로파이, 코러스, 팬 순이고 리버브·홀·딜레이 센드는 팬 앞(코러스 뒤)에서 뽑는다.
- **데모 드럼:** 툴의 데모 드럼(킥·스네어)은 미리듣기 전용이며 이 데이터에 없다.
- **스케일:** D 하모닉 마이너 (C 하모닉 마이너 + root 2) (반음 간격 0 2 3 5 7 8 11). 음높이는 C 기준 스케일 음에 키 `root`(2) 반음을 더한다(JSON `root` 0~11, 없으면 0). 음높이 악기는 스케일 음 15행(JSON `pitchRows` 8 또는 15, 없으면 8, 행 0이 가장 낮다), 타악은 행 1개다. 노트의 `midi`·`pitch`는 키와 유물의 옥타브 이동을 반영한 실제 음이다.
- **유물 설정 (유물별, 없으면 기본):** `swing`(0~0.5)이 있으면 그 유물만 이 스윙을 쓰고 없으면 전체 스윙을 따른다. `octaveShift`(-2~+2)는 음을 옥타브 단위로 옮긴다(MIDI 0~127을 넘으면 옥타브 단위로 안으로 접는다). `pan`(-1 왼쪽 ~ 1 오른쪽)은 마스터로 가는 소리만 좌우로 보내고 리버브·딜레이 센드는 가운데에서 뽑는다. `filterSweep`({ from, to, shape? }, 각 0~1)은 사이클 머리에서 끝까지 로우패스를 20000 x (800 / 20000)^값 Hz로 움직이고 사이클마다 처음으로 돌아간다(고음 깎기와 따로 직렬로 건다). `shape`는 up(from -> to, 없으면 이것), down(to -> from), upDown(사이클 앞 절반 from -> to, 뒤 절반 to -> from). `loops`(사이클 안 루프별 true/false)가 있으면 false인 루프에서 그 유물의 노트를 치지 않는다(없으면 모든 루프, 모자란 칸은 켜짐).
- **사이클:** 8루프 = 32마디 (JSON `cycleLoops` 1, 2, 4, 8, 없으면 1). 노트 데이터는 4마디 한 루프이고, 필터 스윕과 등장 루프 같은 자동화가 사이클 전체에 걸친다.
- **원본 데이터:** 맨 아래 JSON이 원본이고 위의 표는 JSON에서 만든 것이다. 둘이 다르면 JSON을 따른다. 툴의 불러오기도 JSON만 읽는다.
- **게임 반영 시 주의:** 게임의 쿵(A)·짝(S) 판정 소리와 겹치지 않게 킥·스네어 음색은 쓰지 않았다. 템포와 격자는 위 시간 기준을 따르며 게임 링 박자(0.3초)와 묶여 있지 않다. 볼륨(`volume` x `mixVolume`)은 상대값이다. 합성 파라미터는 Web Audio API 기준(오실레이터 파형, BiquadFilter, 게인 엔벨로프)이다.
- **선택 파라미터:** `distortion`(WaveShaper tanh 곡선, drive가 클수록 강함, 필터 앞), `fm`(사인 모듈레이터가 주파수를 변조, 깊이 = index x 모듈레이터 Hz가 decay초 동안 0으로), `vibrato`(LFO로 detune을 ±depth센트 흔듦, delay초 뒤 시작), `hold`(게이트를 max(1칸, 어택+디케이, hold)로 늘림), `filterLfo`(사인 LFO가 메인 필터 주파수에 ±depth Hz를 rate Hz로 더함, 노트 시작에 위상 0), `spread`(오실레이터를 좌우로 -spread ~ +spread에 고르게 벌림), `tremolo`(노트 게인을 beats박 주기로 1 - depth ~ 1 사이에서 흔듦, 루프 머리 기준 위상, stereo면 좌우 반대 위상), `formants`(메인 필터 대신 병렬 밴드패스 [{ freq, Q, gain }]를 지나 합침, 보컬 모음. 자체 필터가 없는 노이즈도 포먼트를 지난다)는 있는 프리셋에만 쓴다. 없으면 그 처리를 하지 않는다.

## 요약

| 유물 | 악기 | 음높이 범위 | 노트 수 | 특징 |
|---|---|---|---|---|
| 워킹 베이스 | 워킹 베이스 | D2 ~ F3 | 16 | 16/32칸 빽빽함, 정박 위주, 음 10종, 폭 15반음, 강약 있음, 긴 노트 있음, 믹스 설정 있음, 등장 루프 있음 |
| 피아노 | 어쿠스틱 피아노 | F3 ~ A4 | 48 | 12/32칸 보통, 정박·엇박 섞임, 음 10종, 폭 16반음, 화음 있음, 강약 있음, 긴 노트 있음, 믹스 설정 있음, 유물 설정 있음 |
| 브라스 | 브라스 스탭 | E4 ~ D5 | 17 | 17/32칸 빽빽함, 정박·엇박 섞임, 음 7종, 폭 10반음, 강약 있음, 긴 노트 있음, 믹스 설정 있음, 유물 설정 있음, 등장 루프 있음 |
| 클라리넷풍 플루트 | 플루트 리드 | F5 ~ E6 | 9 | 9/32칸 보통, 정박·엇박 섞임, 음 5종, 폭 11반음, 강약 있음, 긴 노트 있음, 믹스 설정 있음, 등장 루프 있음 |
| 라이드 | 라이드 심벌 | 타격음 | 24 | 24/32칸 빽빽함, 정박·엇박 섞임, 타악, 강약 있음, 유물 설정 있음, 등장 루프 있음 |

믹스 바: 1번 워킹 베이스 (100%), 2번 피아노 (100%), 3번 브라스 (100%), 4번 클라리넷풍 플루트 (100%), 5번 라이드 (100%)

## 워킹 베이스

- **악기:** 워킹 베이스 (`walking_bass`, 음높이 악기, 행 0 옥타브 2)
- **볼륨:** 50%, 믹스 1번 칸 100%
- **노트 수:** 16
- **믹스 설정:** 사이드체인 25%, 리버브 센드 0%, 딜레이 센드 0%, 로파이 0%, 저음 깎기 0%, 고음 깎기 0%, 코러스 0%, 홀 리버브 0%, 테이프 20%
- **등장 루프:** 2, 3, 4, 6, 7, 8 / 8

합성 파라미터:

- 오실레이터 triangle, 음높이 x1, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 게인 0.25
- 필터 lowpass 1100Hz Q1
- 엔벨로프: 어택 0.004초, 디케이 0.18초, 서스테인 0.45, 릴리스 0.06초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.8

| 박 | .0 | .5 |
|---|---|---|
| 1 | D2*2 | = |
| 2 | F2*2@m | = |
| 3 | A2*2 | = |
| 4 | F2*2@m | = |
| 5 | G2*2 | = |
| 6 | D3*2@m | = |
| 7 | A#2*2 | = |
| 8 | D3*2@m | = |
| 9 | A#2*2 | = |
| 10 | D3*2@m | = |
| 11 | F3*2 | = |
| 12 | D3*2@m | = |
| 13 | A2*2 | = |
| 14 | C#3*2@m | = |
| 15 | E3*2 | = |
| 16 | E2*2@m | = |

한 줄 패턴:

```
1.0:D2*2 1.5:= 2.0:F2*2@m 2.5:= 3.0:A2*2 3.5:= 4.0:F2*2@m 4.5:= 5.0:G2*2 5.5:= 6.0:D3*2@m 6.5:= 7.0:A#2*2 7.5:= 8.0:D3*2@m 8.5:= 9.0:A#2*2 9.5:= 10.0:D3*2@m 10.5:= 11.0:F3*2 11.5:= 12.0:D3*2@m 12.5:= 13.0:A2*2 13.5:= 14.0:C#3*2@m 14.5:= 15.0:E3*2 15.5:= 16.0:E2*2@m 16.5:=
```

## 피아노

- **악기:** 어쿠스틱 피아노 (`acoustic_piano`, 음높이 악기, 행 0 옥타브 3)
- **볼륨:** 60%, 믹스 2번 칸 100%
- **노트 수:** 48
- **믹스 설정:** 사이드체인 15%, 리버브 센드 15%, 딜레이 센드 0%, 로파이 25%, 저음 깎기 35% (73Hz), 고음 깎기 0%, 코러스 0%, 홀 리버브 0%, 테이프 0%
- **유물 설정:** 팬 왼쪽 15

합성 파라미터:

- 오실레이터 triangle, 음높이 x1, 게인 1
- 오실레이터 sine, 음높이 x2, 게인 0.5
- 오실레이터 sine, 음높이 x3, 게인 0.25
- 오실레이터 sine, 음높이 x4, 게인 0.12
- 필터 lowpass 3500Hz Q0.7, 시작 6000Hz에서 0.08초 동안 이동
- 엔벨로프: 어택 0.002초, 디케이 0.9초, 서스테인 0.15, 릴리스 0.25초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.5

| 박 | .0 | .5 |
|---|---|---|
| 1 | F3@m+A3@m+D4@m+E4@m | - |
| 2 | - | F3*2+A3*2+D4*2+E4*2 |
| 3 | = | F3@w+A3@w+D4@w+E4@w |
| 4 | - | - |
| 5 | F3@m+A#3@m+D4@m+G4@m | - |
| 6 | - | F3*2+A#3*2+D4*2+G4*2 |
| 7 | = | F3@w+A#3@w+D4@w+G4@w |
| 8 | - | - |
| 9 | A#3@m+D4@m+F4@m+G4@m | - |
| 10 | - | A#3*2+D4*2+F4*2+G4*2 |
| 11 | = | A#3@w+D4@w+F4@w+G4@w |
| 12 | - | - |
| 13 | G3@m+C#4@m+E4@m+A4@m | - |
| 14 | - | G3*2+C#4*2+E4*2+A4*2 |
| 15 | = | G3@w+C#4@w+E4@w+A4@w |
| 16 | - | - |

한 줄 패턴:

```
1.0:F3@m+A3@m+D4@m+E4@m 1.5:- 2.0:- 2.5:F3*2+A3*2+D4*2+E4*2 3.0:= 3.5:F3@w+A3@w+D4@w+E4@w 4.0:- 4.5:- 5.0:F3@m+A#3@m+D4@m+G4@m 5.5:- 6.0:- 6.5:F3*2+A#3*2+D4*2+G4*2 7.0:= 7.5:F3@w+A#3@w+D4@w+G4@w 8.0:- 8.5:- 9.0:A#3@m+D4@m+F4@m+G4@m 9.5:- 10.0:- 10.5:A#3*2+D4*2+F4*2+G4*2 11.0:= 11.5:A#3@w+D4@w+F4@w+G4@w 12.0:- 12.5:- 13.0:G3@m+C#4@m+E4@m+A4@m 13.5:- 14.0:- 14.5:G3*2+C#4*2+E4*2+A4*2 15.0:= 15.5:G3@w+C#4@w+E4@w+A4@w 16.0:- 16.5:-
```

## 브라스

- **악기:** 브라스 스탭 (`brass_stab`, 음높이 악기, 행 0 옥타브 3)
- **볼륨:** 75%, 믹스 3번 칸 100%
- **노트 수:** 17
- **믹스 설정:** 사이드체인 0%, 리버브 센드 15%, 딜레이 센드 0%, 로파이 0%, 저음 깎기 0%, 고음 깎기 0%, 코러스 0%, 홀 리버브 0%, 테이프 30%
- **유물 설정:** 팬 오른쪽 15
- **등장 루프:** 3, 4, 7, 8 / 8

합성 파라미터:

- 오실레이터 sawtooth, 음높이 x1, 디튠 -8센트, 게인 1
- 오실레이터 sawtooth, 음높이 x1, 디튠 8센트, 게인 1
- 필터 lowpass 2200Hz Q2, 시작 400Hz에서 0.06초 동안 이동
- 엔벨로프: 어택 0.015초, 디케이 0.15초, 서스테인 0.45, 릴리스 0.07초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.4

| 박 | .0 | .5 |
|---|---|---|
| 1 | - | A4@m |
| 2 | D5 | C#5@m |
| 3 | A4*2 | = |
| 4 | - | - |
| 5 | - | G4@m |
| 6 | A#4 | A4@m |
| 7 | G4*2 | = |
| 8 | - | - |
| 9 | - | F4@m |
| 10 | A4 | A#4@m |
| 11 | D5*2 | = |
| 12 | A#4@m | - |
| 13 | C#5*2 | = |
| 14 | - | A4@m |
| 15 | G4*2 | = |
| 16 | E4*2@m | = |

한 줄 패턴:

```
1.0:- 1.5:A4@m 2.0:D5 2.5:C#5@m 3.0:A4*2 3.5:= 4.0:- 4.5:- 5.0:- 5.5:G4@m 6.0:A#4 6.5:A4@m 7.0:G4*2 7.5:= 8.0:- 8.5:- 9.0:- 9.5:F4@m 10.0:A4 10.5:A#4@m 11.0:D5*2 11.5:= 12.0:A#4@m 12.5:- 13.0:C#5*2 13.5:= 14.0:- 14.5:A4@m 15.0:G4*2 15.5:= 16.0:E4*2@m 16.5:=
```

## 클라리넷풍 플루트

- **악기:** 플루트 리드 (`flute_lead`, 음높이 악기, 행 0 옥타브 5)
- **볼륨:** 40%, 믹스 4번 칸 100%
- **노트 수:** 9
- **믹스 설정:** 사이드체인 0%, 리버브 센드 20%, 딜레이 센드 0%, 로파이 0%, 저음 깎기 0%, 고음 깎기 0%, 코러스 0%, 홀 리버브 20%, 테이프 20%
- **등장 루프:** 5, 6, 8 / 8

합성 파라미터:

- 오실레이터 sine, 음높이 x1, 게인 1
- 오실레이터 triangle, 음높이 x1, 게인 0.25
- 노이즈 게인 0.05 (자체 필터 bandpass 2500Hz Q1)
- 엔벨로프: 어택 0.04초, 디케이 0.08초, 서스테인 0.8, 릴리스 0.1초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.5

| 박 | .0 | .5 |
|---|---|---|
| 1 | - | - |
| 2 | - | - |
| 3 | - | - |
| 4 | A5 | G5@m |
| 5 | A5@m | - |
| 6 | - | - |
| 7 | - | - |
| 8 | F5*2 | = |
| 9 | - | - |
| 10 | - | - |
| 11 | - | - |
| 12 | A5 | C#6@m |
| 13 | E6*2 | = |
| 14 | - | - |
| 15 | - | - |
| 16 | C#6 | A5@m |

한 줄 패턴:

```
1.0:- 1.5:- 2.0:- 2.5:- 3.0:- 3.5:- 4.0:A5 4.5:G5@m 5.0:A5@m 5.5:- 6.0:- 6.5:- 7.0:- 7.5:- 8.0:F5*2 8.5:= 9.0:- 9.5:- 10.0:- 10.5:- 11.0:- 11.5:- 12.0:A5 12.5:C#6@m 13.0:E6*2 13.5:= 14.0:- 14.5:- 15.0:- 15.5:- 16.0:C#6 16.5:A5@m
```

## 라이드

- **악기:** 라이드 심벌 (`ride_cymbal`, 타악·노이즈)
- **볼륨:** 90%, 믹스 5번 칸 100%
- **노트 수:** 24
- **유물 설정:** 팬 오른쪽 20
- **등장 루프:** 1, 2, 3, 4, 6, 7, 8 / 8

합성 파라미터:

- 오실레이터 sine, 고정 3100Hz, 게인 0.3
- 노이즈 게인 1 (자체 필터 bandpass 7500Hz Q0.6)
- 엔벨로프: 어택 0.001초, 디케이 0.9초, 서스테인 0, 릴리스 0.1초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))
- 최대 게인 0.3

| 박 | .0 | .5 |
|---|---|---|
| 1 | X@m | - |
| 2 | X | X@w |
| 3 | X@m | - |
| 4 | X | X@w |
| 5 | X@m | - |
| 6 | X | X@w |
| 7 | X@m | - |
| 8 | X | X@w |
| 9 | X@m | - |
| 10 | X | X@w |
| 11 | X@m | - |
| 12 | X | X@w |
| 13 | X@m | - |
| 14 | X | X@w |
| 15 | X@m | - |
| 16 | X | X@w |

한 줄 패턴:

```
1.0:X@m 1.5:- 2.0:X 2.5:X@w 3.0:X@m 3.5:- 4.0:X 4.5:X@w 5.0:X@m 5.5:- 6.0:X 6.5:X@w 7.0:X@m 7.5:- 8.0:X 8.5:X@w 9.0:X@m 9.5:- 10.0:X 10.5:X@w 11.0:X@m 11.5:- 12.0:X 12.5:X@w 13.0:X@m 13.5:- 14.0:X 14.5:X@w 15.0:X@m 15.5:- 16.0:X 16.5:X@w
```

## 데이터 (JSON)

최상위 선택 항목: `bpm`(60~180 정수, 없으면 130), `grid`(8 또는 16, 없으면 8), `root`(0~11, 없으면 0), `pitchRows`(8 또는 15, 없으면 8), `cycleLoops`(1, 2, 4, 8, 없으면 1), `delayNote`(1/8, 3/16, 1/4, 3/8, 없으면 3/8). `timing`은 참고값이라 불러올 때 쓰지 않는다.

`notes`의 `step`은 칸 번호(8분 격자 0~31, 16분 격자 0~63), `row`는 음높이 행(스케일 기준, 행 0이 가장 낮음), `midi`와 `pitch`는 그 행의 실제 음(타악은 null)이다. 선택 항목: 노트의 `velocity`(0~1, 없으면 1), `length`(칸 수, 없으면 1), `repeat`(한 칸 안 타격 수 1~4, 없으면 1, 2 이상이면 length는 1), 유물의 `sidechain`·`reverbSend`·`delaySend`·`lofi`·`lowCut`·`highCut`(0~1, 없으면 0)·`swing`(없으면 전체 스윙)·`octaveShift`(-2~2, 없으면 0)·`pan`(-1~1, 없으면 0)·`filterSweep`({ from, to, shape? }, 없으면 없음)·`loops`(루프별 켜짐 배열, 없으면 모두 켜짐)·`chorus`·`hallSend`·`tape`(0~1, 없으면 0), 전체의 `groove.swing`(0~0.5, 없으면 0).

```json
{
  "schema": "4bit-prototype-relic-beat-tool/v1",
  "exportedAt": "2026-11-08T12:24:35.161Z",
  "timing": {
    "bpm": 116,
    "grid": 8,
    "beatSeconds": 0.5172413793103449,
    "stepSeconds": 0.25862068965517243,
    "beats": 16,
    "steps": 32,
    "loopSeconds": 8.275862068965518
  },
  "scale": {
    "name": "C 하모닉 마이너",
    "root": "D",
    "intervals": [
      0,
      2,
      3,
      5,
      7,
      8,
      11
    ]
  },
  "bpm": 116,
  "root": 2,
  "pitchRows": 15,
  "cycleLoops": 8,
  "groove": {
    "swing": 0.33
  },
  "relics": [
    {
      "id": "relic_1",
      "name": "워킹 베이스",
      "preset": {
        "id": "walking_bass",
        "name": "워킹 베이스",
        "pitched": true,
        "octave": 2,
        "params": {
          "oscs": [
            {
              "type": "triangle",
              "gain": 1
            },
            {
              "type": "sawtooth",
              "gain": 0.25
            }
          ],
          "filter": {
            "type": "lowpass",
            "freq": 1100,
            "Q": 1
          },
          "env": {
            "attack": 0.004,
            "decay": 0.18,
            "sustain": 0.45,
            "release": 0.06
          },
          "gain": 0.8
        }
      },
      "volume": 0.5,
      "mixSlot": 1,
      "mixVolume": 1,
      "sidechain": 0.25,
      "tape": 0.2,
      "loops": [
        false,
        true,
        true,
        true,
        false,
        true,
        true,
        true
      ],
      "notes": [
        {
          "step": 0,
          "row": 0,
          "midi": 38,
          "pitch": "D2",
          "length": 2
        },
        {
          "step": 2,
          "row": 2,
          "midi": 41,
          "pitch": "F2",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 4,
          "row": 4,
          "midi": 45,
          "pitch": "A2",
          "velocity": 0.85,
          "length": 2
        },
        {
          "step": 6,
          "row": 2,
          "midi": 41,
          "pitch": "F2",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 8,
          "row": 3,
          "midi": 43,
          "pitch": "G2",
          "length": 2
        },
        {
          "step": 10,
          "row": 7,
          "midi": 50,
          "pitch": "D3",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 12,
          "row": 5,
          "midi": 46,
          "pitch": "A#2",
          "velocity": 0.85,
          "length": 2
        },
        {
          "step": 14,
          "row": 7,
          "midi": 50,
          "pitch": "D3",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 16,
          "row": 5,
          "midi": 46,
          "pitch": "A#2",
          "length": 2
        },
        {
          "step": 18,
          "row": 7,
          "midi": 50,
          "pitch": "D3",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 20,
          "row": 9,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.85,
          "length": 2
        },
        {
          "step": 22,
          "row": 7,
          "midi": 50,
          "pitch": "D3",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 24,
          "row": 4,
          "midi": 45,
          "pitch": "A2",
          "length": 2
        },
        {
          "step": 26,
          "row": 6,
          "midi": 49,
          "pitch": "C#3",
          "velocity": 0.7,
          "length": 2
        },
        {
          "step": 28,
          "row": 8,
          "midi": 52,
          "pitch": "E3",
          "velocity": 0.85,
          "length": 2
        },
        {
          "step": 30,
          "row": 1,
          "midi": 40,
          "pitch": "E2",
          "velocity": 0.7,
          "length": 2
        }
      ]
    },
    {
      "id": "relic_2",
      "name": "피아노",
      "preset": {
        "id": "acoustic_piano",
        "name": "어쿠스틱 피아노",
        "pitched": true,
        "octave": 3,
        "params": {
          "oscs": [
            {
              "type": "triangle",
              "gain": 1
            },
            {
              "type": "sine",
              "ratio": 2,
              "gain": 0.5
            },
            {
              "type": "sine",
              "ratio": 3,
              "gain": 0.25
            },
            {
              "type": "sine",
              "ratio": 4,
              "gain": 0.12
            }
          ],
          "filter": {
            "type": "lowpass",
            "freq": 3500,
            "Q": 0.7,
            "from": 6000,
            "sweep": 0.08
          },
          "env": {
            "attack": 0.002,
            "decay": 0.9,
            "sustain": 0.15,
            "release": 0.25
          },
          "gain": 0.5
        }
      },
      "volume": 0.6,
      "mixSlot": 2,
      "mixVolume": 1,
      "sidechain": 0.15,
      "reverbSend": 0.15,
      "lofi": 0.25,
      "lowCut": 0.35,
      "pan": -0.15,
      "notes": [
        {
          "step": 0,
          "row": 2,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.7
        },
        {
          "step": 0,
          "row": 4,
          "midi": 57,
          "pitch": "A3",
          "velocity": 0.7
        },
        {
          "step": 0,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.7
        },
        {
          "step": 0,
          "row": 8,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7
        },
        {
          "step": 3,
          "row": 2,
          "midi": 53,
          "pitch": "F3",
          "length": 2
        },
        {
          "step": 3,
          "row": 4,
          "midi": 57,
          "pitch": "A3",
          "length": 2
        },
        {
          "step": 3,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "length": 2
        },
        {
          "step": 3,
          "row": 8,
          "midi": 64,
          "pitch": "E4",
          "length": 2
        },
        {
          "step": 5,
          "row": 2,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.4
        },
        {
          "step": 5,
          "row": 4,
          "midi": 57,
          "pitch": "A3",
          "velocity": 0.4
        },
        {
          "step": 5,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.4
        },
        {
          "step": 5,
          "row": 8,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.4
        },
        {
          "step": 8,
          "row": 2,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.7
        },
        {
          "step": 8,
          "row": 5,
          "midi": 58,
          "pitch": "A#3",
          "velocity": 0.7
        },
        {
          "step": 8,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.7
        },
        {
          "step": 8,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7
        },
        {
          "step": 11,
          "row": 2,
          "midi": 53,
          "pitch": "F3",
          "length": 2
        },
        {
          "step": 11,
          "row": 5,
          "midi": 58,
          "pitch": "A#3",
          "length": 2
        },
        {
          "step": 11,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "length": 2
        },
        {
          "step": 11,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "length": 2
        },
        {
          "step": 13,
          "row": 2,
          "midi": 53,
          "pitch": "F3",
          "velocity": 0.4
        },
        {
          "step": 13,
          "row": 5,
          "midi": 58,
          "pitch": "A#3",
          "velocity": 0.4
        },
        {
          "step": 13,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.4
        },
        {
          "step": 13,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.4
        },
        {
          "step": 16,
          "row": 5,
          "midi": 58,
          "pitch": "A#3",
          "velocity": 0.7
        },
        {
          "step": 16,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.7
        },
        {
          "step": 16,
          "row": 9,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.7
        },
        {
          "step": 16,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7
        },
        {
          "step": 19,
          "row": 5,
          "midi": 58,
          "pitch": "A#3",
          "length": 2
        },
        {
          "step": 19,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "length": 2
        },
        {
          "step": 19,
          "row": 9,
          "midi": 65,
          "pitch": "F4",
          "length": 2
        },
        {
          "step": 19,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "length": 2
        },
        {
          "step": 21,
          "row": 5,
          "midi": 58,
          "pitch": "A#3",
          "velocity": 0.4
        },
        {
          "step": 21,
          "row": 7,
          "midi": 62,
          "pitch": "D4",
          "velocity": 0.4
        },
        {
          "step": 21,
          "row": 9,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.4
        },
        {
          "step": 21,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.4
        },
        {
          "step": 24,
          "row": 3,
          "midi": 55,
          "pitch": "G3",
          "velocity": 0.7
        },
        {
          "step": 24,
          "row": 6,
          "midi": 61,
          "pitch": "C#4",
          "velocity": 0.7
        },
        {
          "step": 24,
          "row": 8,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7
        },
        {
          "step": 24,
          "row": 11,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7
        },
        {
          "step": 27,
          "row": 3,
          "midi": 55,
          "pitch": "G3",
          "length": 2
        },
        {
          "step": 27,
          "row": 6,
          "midi": 61,
          "pitch": "C#4",
          "length": 2
        },
        {
          "step": 27,
          "row": 8,
          "midi": 64,
          "pitch": "E4",
          "length": 2
        },
        {
          "step": 27,
          "row": 11,
          "midi": 69,
          "pitch": "A4",
          "length": 2
        },
        {
          "step": 29,
          "row": 3,
          "midi": 55,
          "pitch": "G3",
          "velocity": 0.4
        },
        {
          "step": 29,
          "row": 6,
          "midi": 61,
          "pitch": "C#4",
          "velocity": 0.4
        },
        {
          "step": 29,
          "row": 8,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.4
        },
        {
          "step": 29,
          "row": 11,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.4
        }
      ]
    },
    {
      "id": "relic_3",
      "name": "브라스",
      "preset": {
        "id": "brass_stab",
        "name": "브라스 스탭",
        "pitched": true,
        "octave": 3,
        "params": {
          "oscs": [
            {
              "type": "sawtooth",
              "detune": -8,
              "gain": 1
            },
            {
              "type": "sawtooth",
              "detune": 8,
              "gain": 1
            }
          ],
          "filter": {
            "type": "lowpass",
            "freq": 2200,
            "Q": 2,
            "from": 400,
            "sweep": 0.06
          },
          "env": {
            "attack": 0.015,
            "decay": 0.15,
            "sustain": 0.45,
            "release": 0.07
          },
          "gain": 0.4
        }
      },
      "volume": 0.75,
      "mixSlot": 3,
      "mixVolume": 1,
      "reverbSend": 0.15,
      "tape": 0.3,
      "pan": 0.15,
      "loops": [
        false,
        false,
        true,
        true,
        false,
        false,
        true,
        true
      ],
      "notes": [
        {
          "step": 1,
          "row": 11,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7
        },
        {
          "step": 2,
          "row": 14,
          "midi": 74,
          "pitch": "D5"
        },
        {
          "step": 3,
          "row": 13,
          "midi": 73,
          "pitch": "C#5",
          "velocity": 0.7
        },
        {
          "step": 4,
          "row": 11,
          "midi": 69,
          "pitch": "A4",
          "length": 2
        },
        {
          "step": 9,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "velocity": 0.7
        },
        {
          "step": 10,
          "row": 12,
          "midi": 70,
          "pitch": "A#4"
        },
        {
          "step": 11,
          "row": 11,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7
        },
        {
          "step": 12,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "length": 2
        },
        {
          "step": 17,
          "row": 9,
          "midi": 65,
          "pitch": "F4",
          "velocity": 0.7
        },
        {
          "step": 18,
          "row": 11,
          "midi": 69,
          "pitch": "A4"
        },
        {
          "step": 19,
          "row": 12,
          "midi": 70,
          "pitch": "A#4",
          "velocity": 0.7
        },
        {
          "step": 20,
          "row": 14,
          "midi": 74,
          "pitch": "D5",
          "length": 2
        },
        {
          "step": 22,
          "row": 12,
          "midi": 70,
          "pitch": "A#4",
          "velocity": 0.7
        },
        {
          "step": 24,
          "row": 13,
          "midi": 73,
          "pitch": "C#5",
          "length": 2
        },
        {
          "step": 27,
          "row": 11,
          "midi": 69,
          "pitch": "A4",
          "velocity": 0.7
        },
        {
          "step": 28,
          "row": 10,
          "midi": 67,
          "pitch": "G4",
          "length": 2
        },
        {
          "step": 30,
          "row": 8,
          "midi": 64,
          "pitch": "E4",
          "velocity": 0.7,
          "length": 2
        }
      ]
    },
    {
      "id": "relic_4",
      "name": "클라리넷풍 플루트",
      "preset": {
        "id": "flute_lead",
        "name": "플루트 리드",
        "pitched": true,
        "octave": 5,
        "params": {
          "oscs": [
            {
              "type": "sine",
              "gain": 1
            },
            {
              "type": "triangle",
              "gain": 0.25
            }
          ],
          "noise": {
            "gain": 0.05,
            "filter": {
              "type": "bandpass",
              "freq": 2500,
              "Q": 1
            }
          },
          "env": {
            "attack": 0.04,
            "decay": 0.08,
            "sustain": 0.8,
            "release": 0.1
          },
          "gain": 0.5
        }
      },
      "volume": 0.4,
      "mixSlot": 4,
      "mixVolume": 1,
      "reverbSend": 0.2,
      "hallSend": 0.2,
      "tape": 0.2,
      "loops": [
        false,
        false,
        false,
        false,
        true,
        true,
        false,
        true
      ],
      "notes": [
        {
          "step": 6,
          "row": 4,
          "midi": 81,
          "pitch": "A5"
        },
        {
          "step": 7,
          "row": 3,
          "midi": 79,
          "pitch": "G5",
          "velocity": 0.7
        },
        {
          "step": 8,
          "row": 4,
          "midi": 81,
          "pitch": "A5",
          "velocity": 0.7
        },
        {
          "step": 14,
          "row": 2,
          "midi": 77,
          "pitch": "F5",
          "length": 2
        },
        {
          "step": 22,
          "row": 4,
          "midi": 81,
          "pitch": "A5"
        },
        {
          "step": 23,
          "row": 6,
          "midi": 85,
          "pitch": "C#6",
          "velocity": 0.7
        },
        {
          "step": 24,
          "row": 8,
          "midi": 88,
          "pitch": "E6",
          "length": 2
        },
        {
          "step": 30,
          "row": 6,
          "midi": 85,
          "pitch": "C#6"
        },
        {
          "step": 31,
          "row": 4,
          "midi": 81,
          "pitch": "A5",
          "velocity": 0.7
        }
      ]
    },
    {
      "id": "relic_5",
      "name": "라이드",
      "preset": {
        "id": "ride_cymbal",
        "name": "라이드 심벌",
        "pitched": false,
        "octave": null,
        "params": {
          "oscs": [
            {
              "type": "sine",
              "fixed": 3100,
              "gain": 0.3
            }
          ],
          "noise": {
            "gain": 1,
            "filter": {
              "type": "bandpass",
              "freq": 7500,
              "Q": 0.6
            }
          },
          "env": {
            "attack": 0.001,
            "decay": 0.9,
            "sustain": 0,
            "release": 0.1
          },
          "gain": 0.3
        }
      },
      "volume": 0.9,
      "mixSlot": 5,
      "mixVolume": 1,
      "pan": 0.2,
      "loops": [
        true,
        true,
        true,
        true,
        false,
        true,
        true,
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
        }
      ]
    }
  ]
}
```
