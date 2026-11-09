# 적 제작 툴 지침서

적 종류를 만드는 웹 툴이다. 이 툴이나 적 데이터 파일을 다루기 전에 이 문서를 읽는다. 사용자용 조작 설명은 루트 `README.md`의 '적 제작 툴' 항목에 있다. 답변은 루트 `CLAUDE.md`의 규칙대로 한국어로 쓴다.

툴을 바꾸면 이 문서와 README를 함께 고친다. 양식을 바꾸면 `enemies-current.*`도 같이 갱신한다.

## 파일

| 파일 | 역할 |
|---|---|
| `index.html`, `tool.css`, `tool.js` | 툴 본체. 게임 코드와 독립이고 웹 링크(Artifact)에 넣지 않는다. 상수는 `tool.js` 맨 위 `TOOL` |
| `enemies-current.md` | 지금 게임의 적 8종. 위쪽은 사람이 읽는 표와 그림, 맨 아래는 툴이 읽는 JSON |
| `enemies-current.json` | 같은 데이터의 JSON 파일. `enemies-current.md`의 JSON 코드블록과 내용이 같다 |
| `enemies-design-v1.md` | 적 13종 설계안 (기존 8종 개편 + 신규 5종). **게임에 반영되지 않은 제안이고 봇 수치로 검증하지 않았다.** 적마다 질문·신호·정답·허점을 적었다. 게임에 옮기려면 적별 `needsGameCode`의 코드 수정이 먼저 필요하다 |

## 파일 양식

- 스키마 이름: `4bit-prototype-enemy-tool/v1`
- 툴은 `.json`과 `.md`를 읽는다. `.md`는 **맨 마지막 ` ```json ` 코드블록만** 읽고 나머지는 무시한다.
- 최상위는 `{ "enemies": [...] }`가 기본이다. 적 배열 하나 또는 `attacks`가 있는 적 객체 하나도 받는다.
- 좌표는 8열 x 4행이고 오른쪽이 +열, 아래가 +행이다. 시간 단위는 초다.

### 툴이 읽는 항목

손으로 쓸 때는 아래 항목만 쓰면 된다. 없거나 범위를 벗어난 숫자는 기본값으로 고쳐서 읽고, 고친 내용을 툴 왼쪽 아래에 보여준다.

| 경로 | 값 | 범위 | 기본값 |
|---|---|---|---|
| `name` | 문자열 | 20자까지 | `불러온 적 n` |
| `game.key`, `game.family`, `game.firstWave` | `config.js` `ENEMIES`의 키, `melee` 또는 `ranged`, 정수 | 툴 화면에 없고 그대로 돌려준다 | 없으면 `game: null` |
| `stats.hp` | 숫자 | 0.25 이상 | 4.5 |
| `stats.damage` | 숫자. 공격 1회의 공격력 | 0 이상 | 2 |
| `idle.moves` | `false`면 이동 안 함 | | true |
| `idle.moveIntervalSeconds` | 숫자 | 0.1 이상 | 3 |
| `idle.durationSeconds` | 숫자 | 0 이상 | 5.5 |
| `chase.targets` | `[[열 차이, 행 차이], ...]`. 플레이어 칸 기준 | 열 ±7, 행 ±3, `[0, 0]` 불가 | 없으면 1타 범위로 자동 계산 |
| `chase.move.method` | `shortest` 또는 `vanish` | | `shortest` |
| `chase.move.stepMode` | `any-direction` 또는 `horizontal-only` | | `any-direction` |
| `chase.move.cellsPerMove` | 정수. `horizontal-only`에서만 쓴다 | 1~7 | 2 |
| `chase.move.tickSeconds` | 숫자. `shortest`에서 쓴다 | 0.05 이상 | 0.5 |
| `chase.move.vanishSeconds` | 숫자. `vanish`에서 쓴다 | 0 이상 | 0.8 |
| `attacks[].kind` | `melee`, `projectile`, `throw` | | `melee` |
| `attacks[].cells` | `[[열 차이, 행 차이], ...]` | 열 ±7, 행 ±3. `[0, 0]`은 `throw`만 | 비어 있으면 경고 |
| `attacks[].telegraphSeconds` | 숫자 | 0.05 이상 | 0.6 |
| `attacks[].gapBeforeSeconds` | 숫자. 2타부터 쓴다 | 0 이상 | 0.3 |
| `retreat.homeCells` | `[[열, 행], ...]` 절대 좌표 | 그리드 안 | 오른쪽 4x4 |
| `retreat.tickSeconds` | 숫자 | 0.05 이상 | 0.5 |

### 읽지 않는 항목

`format`, `exportedAt`, `howToRead`, `grid`, `chase.targetMode`, `chase.targetMap`, `attacks[].index`, `attacks[].blockedByObstacles`, `attacks[].anchor`, `attacks[].map`, `retreat.map`, `gameConfig`, `needsGameCode`, `warnings`는 내보낼 때 계산해 넣는 값이다. 불러올 때는 무시하고, 툴에서 다시 내보내면 새로 계산된다.

### 규칙

- **행동 순환:** Idle → Attack 추적(`chase`) → Attack 시행(`attacks`) → 복귀(`retreat`) → Idle.
- **공격 종류:**

| `kind` | 범위 기준 | 막힘 |
|---|---|---|
| `melee` | 적 칸 | 막히지 않음 |
| `projectile` | 적 칸 | 대상 칸까지의 직선 경로(양 끝 제외)에 적이나 장애물이 있으면 그 칸을 못 맞힘 |
| `throw` | 공격 시작 시점의 플레이어 칸 | 막히지 않음 |

- **이동목표는 1타만 본다.** 1타 범위가 적 기준 `[a, b]`면 자동 목표는 플레이어 기준 `[-a, -b]`다. 예를 들어 왼쪽 1칸 공격 `[-1, 0]`의 목표는 플레이어 오른쪽 1칸 `[1, 0]`이다.
- **1타가 `throw`면** 위치 제한이 없어 이동목표는 현재 위치다. 이동하지 않고 `chase.targets`와 `chase.move`는 쓰지 않는다.
- **`chase.targets`가 원본이다.** 목록을 주면 자동 칸에서 빠진 칸은 끈 칸, 자동이 아닌 칸은 직접 켠 칸으로 읽는다. 빈 배열은 '목표 없음'이고, 항목을 아예 빼면 자동 계산이다.
- **목표 고르기:** 그리드 안이고 비어 있고 이동 방법으로 닿는 칸 중 가장 가까운 칸. 거리가 같으면 플레이어 행에 가까운 칸, 그다음 오른쪽 칸이다. 갈 칸이 없으면 공격을 포기하고 복귀한다.
- **`horizontal-only`:** 세로로 움직이지 않는다. 지금 행에서 `cellsPerMove` 배수 거리로 닿는 목표만 유효하다.
- **Idle 이동:** `retreat.homeCells` 안의 인접 빈칸으로만 움직인다. 지금 게임의 대기 구역 규칙과 같다.
- **`gapBeforeSeconds`:** 앞 타가 실행된 순간부터 이 타의 예고가 시작될 때까지의 시간이다.
- 불러오기는 항상 새 작업으로 추가하고, 이름이 겹치면 `이름 (2)`처럼 번호를 붙인다.

### 최소 예시

왼쪽 1칸을 치고, 이어서 왼쪽 2칸을 치는 2연타 근접 적이다. `chase.targets`를 빼서 1타 기준으로 자동 계산한다.

```json
{
  "enemies": [{
    "name": "2연타병",
    "stats": { "hp": 6, "damage": 1 },
    "idle": { "moves": true, "moveIntervalSeconds": 3, "durationSeconds": 5 },
    "chase": { "move": { "method": "shortest", "stepMode": "any-direction", "tickSeconds": 0.5 } },
    "attacks": [
      { "kind": "melee", "cells": [[-1, 0]], "telegraphSeconds": 0.6 },
      { "kind": "melee", "cells": [[-2, 0]], "telegraphSeconds": 0.4, "gapBeforeSeconds": 0.2 }
    ],
    "retreat": { "homeCells": [[6, 1], [7, 1]], "tickSeconds": 0.5 }
  }]
}
```

마크다운으로 쓸 때는 이 내용을 ` ```json ` 코드블록에 넣어 파일 맨 아래에 둔다.

## 게임에 옮기기

1. 파일의 `howToRead`와 적별 `warnings`, `needsGameCode`를 읽는다.
2. `needsGameCode`가 비어 있으면 `gameConfig`를 `config.js` `ENEMIES`에 옮긴다. `key`나 `firstWave`가 `null`이면 사용자에게 묻는다. 새 적은 `renderer.js`의 `ENEMY_LOOKS`에도 모양을 넣는다.
3. `needsGameCode`가 비어 있지 않으면 그 항목은 `enemy.js` 등의 수정이 필요하다. 진행 전에 사용자에게 확인한다. `gameConfig`에는 1타 값만 들어 있다.
4. 밸런스에 영향을 주면 `BUILD_VERSION`을 올리고 README와 웹 링크를 루트 `CLAUDE.md`대로 갱신한다.

`needsGameCode`는 `tool.js`의 `gameCodeNeeds`가 만든다. 게임이 새 동작을 지원하게 되면 이 함수에서 해당 항목을 뺀다. 게임 공통 값 비교에는 `TOOL.GAME_IDLE_MOVE_INTERVAL`, `TOOL.GAME_MOVE_TICK`을 쓴다.

## `enemies-current.*` 갱신

`config.js` `ENEMIES`를 바꾸면 두 파일을 다시 만든다. 게임 값과의 대응은 다음과 같다.

| 게임 `ENEMIES` | 파일 |
|---|---|
| `hp`, `damage` | `stats` |
| `idleDuration` | `idle.durationSeconds` |
| `telegraphTime` | `attacks[0].telegraphSeconds` |
| `attack.cells` | `attacks[0].cells` |
| `attack.rows: [행, ...]` | 행마다 `[-1, 행]` ~ `[-7, 행]`의 `cells` |
| `aimed: true` + `stationary: true` | `kind: "throw"` |
| `name`, 객체 키, `family`, `firstWave` | `name`, `game.key`, `game.family`, `game.firstWave` |
| 공통 값 `ENEMY_IDLE_MOVE_INTERVAL`, `ENEMY_MOVE_TICK`, `ENEMY_HOME_COLS` | `idle.moveIntervalSeconds`, 추적·복귀 `tickSeconds`, `retreat.homeCells` |

공격 종류는 사용자가 정한 값이다. 지금은 검병·창병·쌍검병·대검병이 `melee`, 궁수·산탄병·광선병이 `projectile`, 포격병이 `throw`다.

JSON은 손으로 고치지 말고 툴의 `buildExport`로 만든다. 브라우저 콘솔에서 위 대응대로 `parseEnemy`에 넣어 작업을 만들고 `JSON.stringify(buildExport(works), null, 2)`를 저장한다. `enemies-current.md`의 위쪽 표와 그림도 같은 값으로 고친다.

## 검증 환경

- 이 PC에는 Node와 Python이 없다. 검증은 내장 브라우저로 한다.
- 내장 브라우저는 `file://` 페이지를 정적 스냅샷으로만 연다. PowerShell `HttpListener`로 임시 정적 서버를 만들어 `.claude/launch.json`으로 띄우고 끝나면 정리한다.
- 브라우저 창이 가려져 있으면 `requestAnimationFrame`이 돌지 않는다. 시연은 `demo.start()` 뒤 `demo.update(1 / 60)`을 반복문으로 직접 호출해 검사한다.
- `state`, `demo`, `parseEnemy`, `buildExport`, `importFiles` 등은 페이지 전역이라 JavaScript 도구에서 바로 부를 수 있다. `importFiles([new File([text], 'x.md')])`로 실제 불러오기 경로를 검사할 수 있다.
- 검사 후에는 `localStorage.removeItem(TOOL.STORAGE_KEY)`로 시험 데이터를 지운다.
