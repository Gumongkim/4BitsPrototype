# 적 제작 툴 지침서

적 종류를 만드는 웹 툴이다. 이 툴이나 적 데이터 파일을 다루기 전에 이 문서를 읽는다. 사용자용 조작 설명은 루트 `README.md`의 '적 제작 툴' 항목에 있다. 답변은 루트 `CLAUDE.md`의 규칙대로 한국어로 쓴다.

툴을 바꾸면 이 문서와 README를 함께 고친다. 양식을 바꾸면 `enemies-current.*`도 같이 갱신한다.

## 파일

| 파일 | 역할 |
|---|---|
| `index.html`, `tool.css`, `tool.js` | 툴 본체. 게임 코드와 독립이고 웹 링크(Artifact)에 넣지 않는다. 상수는 `tool.js` 맨 위 `TOOL` |
| `enemies-current.md` | 지금 게임의 적 14종. 위쪽은 사람이 읽는 표와 그림, 맨 아래는 툴이 읽는 JSON |
| `enemies-current.json` | 같은 데이터의 JSON 파일. `enemies-current.md`의 JSON 코드블록과 내용이 같다 |
| `enemies-design-v1.md` | 적 14종 설계안 (기존 8종 개편 + 신규 6종). 적마다 질문·신호·정답·허점을 적은 기획 문서다. 게임에는 사용자가 툴에서 고쳐 내보낸 `enemies-20261110-123540.json`이 들어갔으므로 수치는 이 문서와 다를 수 있다. 지금 값은 `enemies-current.*`가 기준이다 |
| `enemies-20261110-123540.json` | 2026-11-10에 게임에 옮긴 적 14종의 원본 내보내기 파일 |

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
| `chase.refreshTarget` | `false`면 추적 시작 때 고른 목표를 유지 | | true |
| `chase.move.method` | `shortest` 또는 `vanish` | | `shortest` |
| `chase.move.stepMode` | `any-direction` 또는 `horizontal-only`(세로 1칸씩 행을 맞춘 뒤 가로 n칸씩) | | `any-direction` |
| `chase.move.cellsPerMove` | 정수. `horizontal-only`에서만 쓴다 | 1~7 | 2 |
| `chase.move.tickSeconds` | 숫자. `shortest`에서 쓴다 | 0.05 이상 | 0.5 |
| `chase.move.vanishSeconds` | 숫자. `vanish`에서 쓴다 | 0 이상 | 0.8 |
| `attacks[].kind` | `melee`, `projectile`, `throw`, `dash` | | `melee` |
| `attacks[].cells` | `[[열 차이, 행 차이], ...]`. `dash`는 쓰지 않는다 | 열 ±7, 행 ±3. `[0, 0]`은 `throw`만 | 비어 있으면 경고 |
| `attacks[].dash.maxCells` | 정수. `dash`의 최대 이동 칸 수 | 1~7 | 7 |
| `attacks[].dash.tickSeconds` | 숫자. `dash`의 칸당 시간 | 0.05 이상 | 0.15 |
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
| `dash` | 범위 없음. 적이 직접 달린다 | 장애물·다른 적·그리드 끝에서 멈춤 |

- **돌진(`dash`):** 예고가 시작될 때 플레이어 쪽으로 방향을 정한다. 같은 행이면 가로, 같은 열이면 세로, 둘 다 아니면 플레이어 쪽 가로다. 예고가 끝나면 `tickSeconds`마다 1칸씩 일직선으로 나아간다. **예고 칸은 개수가 아니라 예고시간으로만 정한다.** 출발 뒤 (k - 1) x `tickSeconds`에 들어가는 k번째 칸은 들어가기 `telegraphSeconds` 전부터 보이고 들어가면 사라진다. 그래서 예고 중에는 앞 칸부터 `tickSeconds` 간격으로 한 칸씩 늘어나고, 달리는 동안에는 `telegraphSeconds` 안에 들어갈 칸이 모두 보인다(약 `telegraphSeconds / tickSeconds`칸). 장애물·그리드 끝·최대 거리 너머와 플레이어 칸 뒤는 보이지 않는다. 다음 칸이 플레이어면 그 앞에서 멈추며 피해를 1번 주고, 장애물·다른 적·그리드 끝·`maxCells`에서는 피해 없이 멈춘다. 멈춘 칸이 적의 새 위치이고, 다음 타와 복귀는 그 칸에서 시작한다.
- **이동목표는 1타만 본다.** 1타 범위가 적 기준 `[a, b]`면 자동 목표는 플레이어 기준 `[-a, -b]`다. 예를 들어 왼쪽 1칸 공격 `[-1, 0]`의 목표는 플레이어 오른쪽 1칸 `[1, 0]`이다. 1타가 `dash`면 플레이어 행에서 돌진으로 닿는 `[±1, 0]` ~ `[±(maxCells + 1), 0]`이다.
- **1타가 `throw`면** 위치 제한이 없어 이동목표는 현재 위치다. 이동하지 않고 `chase.targets`와 `chase.move`는 쓰지 않는다.
- **`chase.targets`가 원본이다.** 목록을 주면 자동 칸에서 빠진 칸은 끈 칸, 자동이 아닌 칸은 직접 켠 칸으로 읽는다. 빈 배열은 '목표 없음'이고, 항목을 아예 빼면 자동 계산이다.
- **목표 고르기:** 그리드 안이고 비어 있는 칸 중 가장 가까운 칸이다. 1타가 `projectile`·`dash`면 플레이어까지 경로가 막힌 칸은 뺀다. 거리가 같으면 플레이어 행에 가까운 칸, 그다음 오른쪽 칸이다.
- **목표가 없으면** 공격을 포기하지 않는다. Idle로 돌아가지 않고 추적 상태로 남아 목표를 계속 다시 찾는다. 모든 공격 종류가 같다.
- **`refreshTarget`:** true면 이동할 때마다 목표를 다시 고르고, `vanish`는 나타나는 순간 고른다. false면 추적을 시작할 때(`vanish`는 사라질 때) 고른 칸으로 간다. 그 칸에 플레이어가 서거나 경로가 막혔을 때만 다시 고른다.
- **`horizontal-only`:** 틱마다 먼저 세로로 1칸씩 목표 행을 맞추고, 그 뒤 가로로 `cellsPerMove`칸씩 간다. 남은 거리가 더 짧으면 남은 만큼만 가고, 막힌 칸 앞에서 멈췄다가 다음 틱에 다시 시도한다. 목표까지의 거리는 세로 칸 수 + ceil(가로 칸 수 / `cellsPerMove`)로 잰다.
- **`vanish`:** 목표가 있어야 사라진다. 나타날 칸이 없으면 숨은 채 기다린다.
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

2026-11-10부터 게임(`enemy.js`)이 이 툴의 모든 동작을 같은 규칙으로 지원한다. 게임에서 '장애물'은 다른 적이고, 사라짐 이동 중인 적은 칸을 차지하지 않는다. 게임만의 규칙은 웨이브가 오를수록 idle 지속시간과 예고시간이 공격 속도만큼 짧아지는 것이다(예고는 `ENEMY_TELEGRAPH_MIN` 0.6초, 정의 값이 더 짧으면 정의 값 아래로 줄지 않는다).

1. 파일의 `howToRead`와 적별 `warnings`, `needsGameCode`를 읽는다.
2. `needsGameCode`가 비어 있으면 `gameConfig`를 `config.js` `ENEMIES[key]`에 그대로 옮긴다(긴 칸 목록은 `cellBlock`, `sideCells`로 줄여 써도 된다). `key`나 `firstWave`가 `null`이면 사용자에게 묻는다. 등장 웨이브는 스테이지 구성(`STAGE_WAVES`)에 맞춰 정한다. 새 적은 `renderer.js`의 `ENEMY_LOOKS`에도 모양을 넣는다.
3. `needsGameCode`가 비어 있지 않으면 그 항목은 `enemy.js` 등의 수정이 필요하다. 진행 전에 사용자에게 확인한다.
4. 밸런스에 영향을 주면 `BUILD_VERSION`을 올리고, 봇 시뮬레이션(`tools/bot-sim.html`)으로 확인한 뒤 README와 웹 링크를 루트 `CLAUDE.md`대로 갱신한다.

`needsGameCode`는 `tool.js`의 `gameCodeNeeds`가 만든다. 지금은 항상 빈 배열이다. 툴에 게임이 지원하지 않는 동작을 새로 넣으면 이 함수에 항목을 추가하고, 게임이 지원하게 되면 뺀다.

## `enemies-current.*` 갱신

`config.js` `ENEMIES`를 바꾸면 두 파일을 다시 만든다. 게임 `ENEMIES`는 툴 양식과 같은 구조라 대응이 그대로다.

| 게임 `ENEMIES` | 파일 |
|---|---|
| 객체 키, `name`, `family`, `firstWave` | `game.key`, `name`, `game.family`, `game.firstWave` |
| `hp`, `damage` | `stats` |
| `idle.moves`, `idle.interval`, `idle.duration` | `idle.moves`, `idle.moveIntervalSeconds`, `idle.durationSeconds` |
| `chase.targets`, `chase.refresh` | `chase.targets`, `chase.refreshTarget` |
| `chase.move`, `chase.step`(`any`/`horizontal`), `chase.cellsPerMove`, `chase.tick`, `chase.vanish` | `chase.move.method`, `chase.move.stepMode`(`any-direction`/`horizontal-only`), `cellsPerMove`, `tickSeconds`, `vanishSeconds` |
| `attacks[].kind`, `cells`, `telegraph`, `gap` | `attacks[].kind`, `cells`, `telegraphSeconds`, `gapBeforeSeconds` |
| `attacks[].maxCells`, `attacks[].tick` (돌진) | `attacks[].dash.maxCells`, `attacks[].dash.tickSeconds` |
| `retreat.home`, `retreat.tick` | `retreat.homeCells`, `retreat.tickSeconds` |

JSON은 손으로 고치지 말고 툴의 `buildExport`로 만든다. 브라우저 콘솔에서 위 대응대로 `parseEnemy`에 넣어 작업을 만들고 `JSON.stringify(buildExport(works), null, 2)`를 저장한다. `enemies-current.md`의 위쪽 표와 그림도 같은 값으로 고친다.

## 검증 환경

- 이 PC에는 Node와 Python이 없다. 검증은 내장 브라우저로 한다.
- 내장 브라우저는 `file://` 페이지를 정적 스냅샷으로만 연다. PowerShell `HttpListener`로 임시 정적 서버를 만들어 `.claude/launch.json`으로 띄우고 끝나면 정리한다.
- 브라우저 창이 가려져 있으면 `requestAnimationFrame`이 돌지 않는다. 시연은 `demo.start()` 뒤 `demo.update(1 / 60)`을 반복문으로 직접 호출해 검사한다.
- `state`, `demo`, `parseEnemy`, `buildExport`, `importFiles` 등은 페이지 전역이라 JavaScript 도구에서 바로 부를 수 있다. `importFiles([new File([text], 'x.md')])`로 실제 불러오기 경로를 검사할 수 있다.
- 검사 후에는 `localStorage.removeItem(TOOL.STORAGE_KEY)`로 시험 데이터를 지운다.
