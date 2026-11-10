# 적 데이터: 지금 게임의 적 14종

- 기준: `config.js` `ENEMIES`, 빌드 `2026.11.10-1`
- 원본: 적 제작 툴에서 내보낸 `enemies-20261110-123540.json`. 등장 웨이브(`game.firstWave`)만 스테이지 구성에 맞춰 바꿨다.
- 스키마: `4bit-prototype-enemy-tool/v1`
- 불러오기: 적 제작 툴(`enemy-tool/index.html`)의 '불러오기' 버튼을 누르거나 이 파일을 툴 화면에 끌어다 놓는다.
- **원본은 맨 아래 JSON 코드블록이다.** 툴은 그 블록만 읽는다. 표와 그림은 사람이 읽는 용도이므로 값을 고칠 때는 JSON을 고친다.
- 양식 설명: `enemy-tool/CLAUDE.md`

## 요약

시간은 초이고 웨이브 1 기준이다. 웨이브가 오르면 Idle 지속과 예고가 공격 속도만큼 짧아진다.

| 스테이지 | 이름 (키) | 계열 | 첫 웨이브 | HP | 공격력 | Idle (이동 간격 / 지속) | 추적 | 공격 (예고, 사이) | 복귀 틱 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 검병 (`sword`) | 근접 | 1 | 4.5 | 2 | 3 / 5.4 | 1칸 0.6 | 근접 (0.9) | 0.6 |
| 1 | 궁수 (`archer`) | 원거리 | 2 | 3 | 1 | 3 / 6.6 | 1칸 0.6 | 발사체 (1.2) | 0.6 |
| 2 | 창병 (`spear`) | 근접 | 4 | 4.5 | 2 | 3 / 6.6 | 1칸 0.6 | 근접 (0.9) | 0.6 |
| 2 | 돌격병 (`charger`) | 근접 | 5 | 4 | 3 | 1.5 / 4.2 | 세로 1칸 후 가로 2칸 0.3, 목표 고정 | 근접 (0.6) | 0.3 |
| 3 | 산탄병 (`shotgun`) | 원거리 | 7 | 3 | 1 | 3 / 5.4 | 1칸 0.6 | 발사체 (0.9) | 0.6 |
| 3 | 암살자 (`assassin`) | 근접 | 8 | 3 | 3 | 3 / 6 | 사라짐 0.9 | 근접 (0.6) | 0.9 |
| 4 | 쌍검병 (`twinblade`) | 근접 | 10 | 4.5 | 1 | 3 / 4.2 | 1칸 0.6 | 근접 (0.9) → 근접 (0.6, 사이 0) | 0.6 |
| 4 | 방패병 (`shieldbearer`) | 근접 | 11 | 9 | 1 | 이동 안 함 / 7.2 | 1칸 0.7 | 돌진 최대 7칸 칸당 0.3 (0.5) | 0.9 |
| 5 | 대검병 (`greatsword`) | 근접 | 13 | 7 | 3 | 3 / 7.5 | 세로 1칸 후 가로 2칸 0.7 | 근접 (1.5) | 0.9 |
| 5 | 진동술사 (`quake`) | 원거리 | 14 | 4 | 2 | 3 / 6.6 | 1칸 0.6 | 근접 (0.6) → 근접 (0.6, 사이 0) → 근접 (0.6, 사이 0) | 0.6 |
| 6 | 포격병 (`mortar`) | 원거리 | 16 | 3 | 2 | 이동 안 함 / 7.5 | 이동 없음 | 던지기 (1.2) | 0.6 |
| 6 | 사냥꾼 (`hunter`) | 근접 | 17 | 6 | 1 | 1.8 / 6 | 1칸 0.3 | 발사체 (0.6) | 0.3 |
| 7 | 광선병 (`beam`) | 원거리 | 19 | 3 | 2 | 3 / 8.4 | 1칸 0.6 | 근접 (1.5) | 0.6 |
| 7 | 기마병 (`cavalry`) | 근접 | 20 | 6 | 2 | 3 / 6.6 | 1칸 0.6 | 돌진 최대 7칸 칸당 0.15 (0.4) | 0.6 |

## 주의

- 게임은 툴의 모든 동작을 같은 규칙으로 지원한다. 그래서 JSON의 `needsGameCode`는 모두 비어 있다. 게임에서 장애물은 다른 적이다.
- 예고 시간은 공격 속도가 올라도 0.6초(`ENEMY_TELEGRAPH_MIN`, 정의 값이 더 짧으면 정의 값) 아래로 줄지 않는다. 돌진의 칸당 시간과 이동 틱은 줄지 않는다.
- 스테이지는 3웨이브다. 스테이지 첫 웨이브와 둘째 웨이브에 새 적이 한 종씩 처음 나온다.

## 그림

P = 플레이어(열 1, 행 1), E = 적(열 5, 행 1), # = 공격 범위, @ = 플레이어 칸이 범위에 포함, < 등 = 돌진 경로, T = 이동목표, H = 복귀 칸, . = 빈 칸.

### 검병 (`sword`)

이동목표

```text
........
.PT.....
........
........
```

1타 근접

```text
........
.P..#E..
........
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 궁수 (`archer`)

이동목표

```text
........
.P..TTTT
........
........
```

1타 발사체

```text
........
#@###E..
........
........
```

복귀 칸

```text
......HH
......HH
......HH
......HH
```

### 창병 (`spear`)

이동목표

```text
........
.P.T....
........
........
```

1타 근접

```text
........
.P.##E..
........
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 돌격병 (`charger`)

이동목표

```text
........
.PTT....
........
........
```

1타 근접

```text
........
.P.##E..
........
........
```

복귀 칸

```text
......HH
......HH
......HH
......HH
```

### 산탄병 (`shotgun`)

이동목표

```text
...T....
.PTT....
...T....
........
```

1타 발사체

```text
...#....
.P.##E..
...#....
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 암살자 (`assassin`)

이동목표

```text
........
TP......
........
........
```

1타 근접

```text
........
.P...E#.
........
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 쌍검병 (`twinblade`)

이동목표

```text
.T......
TPT.....
.T......
........
```

1타 근접

```text
.....#..
.P..#E#.
.....#..
........
```

2타 근접

```text
....#.#.
.P...E..
....#.#.
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 방패병 (`shieldbearer`)

이동목표

```text
........
TPTTTTTT
........
........
```

1타 돌진

```text
........
.@<<<E..
........
........
```

복귀 칸

```text
...HH...
...HH...
...HH...
...HH...
```

### 대검병 (`greatsword`)

이동목표

```text
..T.....
.PT.....
..T.....
........
```

1타 근접

```text
....#...
.P..#E..
....#...
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 진동술사 (`quake`)

이동목표

```text
....T...
.P..T...
....T...
........
```

1타 근접

```text
....#...
.P..#E..
....#...
....#...
```

2타 근접

```text
...#....
.P.#.E..
...#....
...#....
```

3타 근접

```text
..#.....
.P#..E..
..#.....
..#.....
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 포격병 (`mortar`)

1타 던지기

```text
.#......
#@#.....
.#......
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 사냥꾼 (`hunter`)

이동목표

```text
...T....
.PTTTTTT
...T....
....T...
```

1타 발사체

```text
...#....
#@###E..
...#....
..#.....
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

### 광선병 (`beam`)

이동목표

```text
..TTTTTT
.PTTTTTT
..TTTTTT
........
```

1타 근접

```text
#####...
#@###E..
#####...
........
```

복귀 칸

```text
......HH
......HH
......HH
......HH
```

### 기마병 (`cavalry`)

이동목표

```text
........
TPTTTTTT
........
........
```

1타 돌진

```text
........
.@<<<E..
........
........
```

복귀 칸

```text
....HHHH
....HHHH
....HHHH
....HHHH
```

## 원본 데이터 (JSON)

툴은 아래 블록만 읽는다.

```json
{
  "format": "4bit-prototype-enemy-tool/v1",
  "exportedAt": "2026-11-10T04:17:25.604Z",
  "howToRead": [
    "4Bit_Prototype 적 제작 툴에서 내보낸 적 데이터다. enemies 배열의 원소 하나가 적 하나다.",
    "행동 순환: idle → chase(Attack 추적) → attacks(Attack 시행) → retreat(복귀) → idle. 시간 단위는 모두 초이고 그리드는 8열 x 4행, 오른쪽이 +열, 아래가 +행이다.",
    "stats: hp와 damage(공격 1회의 공격력). 연속 공격은 타마다 같은 공격력이다.",
    "idle: moves가 true면 moveIntervalSeconds마다 인접 빈칸으로 이동한다(게임과 같이 retreat.homeCells 안에서). false면 이동하지 않는다. durationSeconds가 지나면 chase로 간다.",
    "chase.targetMode: cells면 targets 중 한 칸으로 이동한 뒤 공격한다. currentPosition이면 1타가 던지기라 위치 제한이 없어 이동 없이 그 자리에서 공격하며 targets와 move는 쓰지 않는다.",
    "chase.targets: 플레이어 칸 기준 [열 차이, 행 차이]. 툴이 1타 범위로 계산한 위치에서 사용자가 끄고 켠 최종 결과다. 1타가 적 기준 범위 [a, b]를 가지면 자동 목표는 [-a, -b]이다. 1타가 dash면 플레이어 행에서 돌진으로 닿는 [±1, 0] ~ [±(maxCells + 1), 0]이다. 런타임에는 그리드 안이고 플레이어 칸이 아니고 비어 있는 칸(1타가 막히는 종류면 플레이어까지 경로도 비어 있는 칸) 중 가장 가까운 칸을 고른다. 거리가 같으면 플레이어 행에 가까운 칸, 그다음 오른쪽 칸이다. 고를 칸이 없으면 공격을 포기하지 않고 추적 상태로 남아 계속 다시 찾는다(Idle로 돌아가지 않는다).",
    "chase.refreshTarget: true면 이동할 때마다 목표를 다시 고르고 vanish는 나타나는 순간 고른다. false면 추적을 시작할 때(vanish는 사라질 때) 고른 칸으로 가며, 그 칸에 플레이어가 서거나 막혔을 때만 다시 고른다.",
    "chase.targetMap: 플레이어를 게임 시작 위치(P, 열 1, 행 1)에 둔 그림. T = 이동목표, . = 빈 칸. 이 위치에서 그리드 밖으로 나가는 칸은 그림에 없고 targets에만 있다.",
    "chase.move: method가 shortest면 stepMode가 any-direction일 때 상하좌우 최단 경로로 tickSeconds마다 1칸, horizontal-only일 때 tickSeconds마다 먼저 세로로 1칸씩 목표 행을 맞추고, 그 뒤 가로로 cellsPerMove칸씩 이동한다(남은 거리가 더 짧으면 남은 만큼, 막힌 칸 앞에서 멈추고 다음 틱에 다시 시도). 목표 거리는 세로 칸 수 + ceil(가로 칸 수 / cellsPerMove)로 잰다. method가 vanish면 화면에서 사라졌다가 vanishSeconds 뒤 목표 칸에 나타나고, 나타날 칸이 없으면 숨은 채 기다린다.",
    "attacks: 순서대로 실행하는 공격 목록. index 1이 1타다. 이동목표 계산에는 1타만 쓴다.",
    "attacks[].kind: melee(근접), projectile(발사체), throw(던지기). blockedByObstacles가 true인 projectile은 적 칸에서 대상 칸까지의 직선 경로(양 끝 제외, 각 단계 좌표를 반올림한 칸)에 적이나 장애물이 있으면 그 칸을 맞히지 못한다. 이동목표도 플레이어까지 경로가 막힌 칸은 고르지 않는다. melee와 throw는 막히지 않는다. dash(돌진)는 cells를 쓰지 않고 dash.maxCells(최대 거리, 1~7칸)와 dash.tickSeconds(칸당 시간)를 쓴다. 예고가 시작될 때 플레이어 쪽으로 방향을 정한다(같은 행이면 가로, 같은 열이면 세로, 둘 다 아니면 플레이어 쪽 가로). 예고가 끝나면 tickSeconds마다 1칸씩 일직선으로 나아간다. 예고 칸은 개수가 아니라 예고시간으로 정한다: 출발 뒤 (k - 1) x tickSeconds에 들어가는 k번째 칸은 들어가기 telegraphSeconds 전부터 보이고, 들어가면 사라진다. 그래서 예고 중에는 앞 칸부터 tickSeconds 간격으로 한 칸씩 늘어나고, 달리는 동안에는 telegraphSeconds 안에 들어갈 칸이 모두 보인다. 장애물·그리드 끝·최대 거리 너머와 플레이어 칸 뒤는 보이지 않는다. 다음 칸이 플레이어면 그 앞에서 멈추며 피해를 1번 주고, 장애물·다른 적·그리드 끝·최대 거리에서는 피해 없이 멈춘다. 멈춘 칸이 적의 새 위치다.",
    "attacks[].anchor와 cells: anchor가 enemy면 cells는 적 칸 기준 [열 차이, 행 차이]다. player면 공격 시작 시점의 플레이어 칸 기준이고 throw가 여기에 해당하며 [0, 0]도 범위가 될 수 있다. 범위는 각 타의 예고가 시작되는 순간에 정한다.",
    "attacks[].map: 그림. P = 플레이어(열 1, 행 1), E = 적(열 5, 행 1, anchor가 enemy일 때만), # = 공격 범위, @ = 플레이어 칸이 범위에 포함, . = 빈 칸.",
    "attacks[].telegraphSeconds: 공격 예고 시간. gapBeforeSeconds: 앞 타의 공격이 실행된 순간부터 이 타의 예고가 시작될 때까지의 시간. 1타는 0이다.",
    "retreat.homeCells: 복귀 선호 위치, 그리드 절대 좌표 [열, 행]. 가장 가까운 빈 칸으로 tickSeconds마다 1칸씩 돌아간다. map의 H가 그 칸이다.",
    "game: 게임 등록 정보(key = config.js ENEMIES의 키, family, firstWave). 툴에서 새로 만든 적은 null이다.",
    "gameConfig: 지금 게임 config.js ENEMIES 항목 형식으로 옮긴 값(idle, chase, attacks 전체, retreat). key나 firstWave가 null이면 사용자에게 물어 정한다. 새 적은 renderer.js의 ENEMY_LOOKS에도 모양을 넣는다. 게임은 웨이브가 오를수록 idle 지속시간과 예고시간을 공격 속도만큼 줄인다.",
    "needsGameCode: 지금 게임 코드로는 표현할 수 없어 enemy.js 등의 수정이 필요한 항목. 비어 있으면 gameConfig만 옮기면 동작이 같다. 게임에서 장애물은 다른 적이다.",
    "warnings: 비어 있는 범위 등 확인이 필요한 점. 비어 있으면 문제없다.",
    "불러올 때는 name, game, stats, idle, chase.targets, chase.move, attacks의 kind·cells·telegraphSeconds·gapBeforeSeconds, retreat.homeCells·tickSeconds만 읽는다. 그림과 gameConfig, needsGameCode, warnings는 무시한다. 값을 고칠 때는 읽는 항목만 고치면 된다."
  ],
  "grid": {
    "cols": 8,
    "rows": 4,
    "examplePlayer": {
      "col": 1,
      "row": 1
    },
    "exampleEnemy": {
      "col": 5,
      "row": 1
    }
  },
  "enemies": [
    {
      "name": "검병",
      "game": {
        "key": "sword",
        "family": "melee",
        "firstWave": 1
      },
      "stats": {
        "hp": 4.5,
        "damage": 2
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 5.4
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            0
          ]
        ],
        "targetMap": [
          "........",
          ".PT.....",
          "........",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              0
            ]
          ],
          "telegraphSeconds": 0.9,
          "gapBeforeSeconds": 0,
          "map": [
            "........",
            ".P..#E..",
            "........",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "sword",
        "name": "검병",
        "family": "melee",
        "firstWave": 1,
        "hp": 4.5,
        "damage": 2,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 5.4
        },
        "chase": {
          "targets": [
            [
              1,
              0
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                0
              ]
            ],
            "telegraph": 0.9
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "궁수",
      "game": {
        "key": "archer",
        "family": "ranged",
        "firstWave": 2
      },
      "stats": {
        "hp": 3,
        "damage": 1
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 6.6
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            7,
            0
          ]
        ],
        "targetMap": [
          "........",
          ".P..TTTT",
          "........",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "projectile",
          "blockedByObstacles": true,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              0
            ],
            [
              -2,
              0
            ],
            [
              -3,
              0
            ],
            [
              -4,
              0
            ],
            [
              -5,
              0
            ],
            [
              -6,
              0
            ],
            [
              -7,
              0
            ]
          ],
          "telegraphSeconds": 1.2,
          "gapBeforeSeconds": 0,
          "map": [
            "........",
            "#@###E..",
            "........",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "......HH",
          "......HH",
          "......HH",
          "......HH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "archer",
        "name": "궁수",
        "family": "ranged",
        "firstWave": 2,
        "hp": 3,
        "damage": 1,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 6.6
        },
        "chase": {
          "targets": [
            [
              3,
              0
            ],
            [
              4,
              0
            ],
            [
              5,
              0
            ],
            [
              6,
              0
            ],
            [
              7,
              0
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "projectile",
            "cells": [
              [
                -1,
                0
              ],
              [
                -2,
                0
              ],
              [
                -3,
                0
              ],
              [
                -4,
                0
              ],
              [
                -5,
                0
              ],
              [
                -6,
                0
              ],
              [
                -7,
                0
              ]
            ],
            "telegraph": 1.2
          }
        ],
        "retreat": {
          "home": [
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "창병",
      "game": {
        "key": "spear",
        "family": "melee",
        "firstWave": 4
      },
      "stats": {
        "hp": 4.5,
        "damage": 2
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 6.6
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            2,
            0
          ]
        ],
        "targetMap": [
          "........",
          ".P.T....",
          "........",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              0
            ],
            [
              -2,
              0
            ]
          ],
          "telegraphSeconds": 0.9,
          "gapBeforeSeconds": 0,
          "map": [
            "........",
            ".P.##E..",
            "........",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "spear",
        "name": "창병",
        "family": "melee",
        "firstWave": 4,
        "hp": 4.5,
        "damage": 2,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 6.6
        },
        "chase": {
          "targets": [
            [
              2,
              0
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                0
              ],
              [
                -2,
                0
              ]
            ],
            "telegraph": 0.9
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "돌격병",
      "game": {
        "key": "charger",
        "family": "melee",
        "firstWave": 5
      },
      "stats": {
        "hp": 4,
        "damage": 3
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 1.5,
        "durationSeconds": 4.2
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            0
          ],
          [
            2,
            0
          ]
        ],
        "targetMap": [
          "........",
          ".PTT....",
          "........",
          "........"
        ],
        "refreshTarget": false,
        "move": {
          "method": "shortest",
          "stepMode": "horizontal-only",
          "cellsPerMove": 2,
          "tickSeconds": 0.3
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              0
            ],
            [
              -2,
              0
            ]
          ],
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            "........",
            ".P.##E..",
            "........",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "......HH",
          "......HH",
          "......HH",
          "......HH"
        ],
        "tickSeconds": 0.3
      },
      "gameConfig": {
        "key": "charger",
        "name": "돌격병",
        "family": "melee",
        "firstWave": 5,
        "hp": 4,
        "damage": 3,
        "idle": {
          "moves": true,
          "interval": 1.5,
          "duration": 4.2
        },
        "chase": {
          "targets": [
            [
              1,
              0
            ],
            [
              2,
              0
            ]
          ],
          "refresh": false,
          "move": "shortest",
          "step": "horizontal",
          "cellsPerMove": 2,
          "tick": 0.3
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                0
              ],
              [
                -2,
                0
              ]
            ],
            "telegraph": 0.6
          }
        ],
        "retreat": {
          "home": [
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.3
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "산탄병",
      "game": {
        "key": "shotgun",
        "family": "ranged",
        "firstWave": 7
      },
      "stats": {
        "hp": 3,
        "damage": 1
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 5.4
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            0
          ],
          [
            2,
            1
          ],
          [
            2,
            0
          ],
          [
            2,
            -1
          ]
        ],
        "targetMap": [
          "...T....",
          ".PTT....",
          "...T....",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "projectile",
          "blockedByObstacles": true,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              0
            ],
            [
              -2,
              -1
            ],
            [
              -2,
              0
            ],
            [
              -2,
              1
            ]
          ],
          "telegraphSeconds": 0.9,
          "gapBeforeSeconds": 0,
          "map": [
            "...#....",
            ".P.##E..",
            "...#....",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "shotgun",
        "name": "산탄병",
        "family": "ranged",
        "firstWave": 7,
        "hp": 3,
        "damage": 1,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 5.4
        },
        "chase": {
          "targets": [
            [
              1,
              0
            ],
            [
              2,
              1
            ],
            [
              2,
              0
            ],
            [
              2,
              -1
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "projectile",
            "cells": [
              [
                -1,
                0
              ],
              [
                -2,
                -1
              ],
              [
                -2,
                0
              ],
              [
                -2,
                1
              ]
            ],
            "telegraph": 0.9
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "암살자",
      "game": {
        "key": "assassin",
        "family": "melee",
        "firstWave": 8
      },
      "stats": {
        "hp": 3,
        "damage": 3
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 6
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            -1,
            0
          ]
        ],
        "targetMap": [
          "........",
          "TP......",
          "........",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "vanish",
          "vanishSeconds": 0.9
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              1,
              0
            ]
          ],
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            "........",
            ".P...E#.",
            "........",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.9
      },
      "gameConfig": {
        "key": "assassin",
        "name": "암살자",
        "family": "melee",
        "firstWave": 8,
        "hp": 3,
        "damage": 3,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 6
        },
        "chase": {
          "targets": [
            [
              -1,
              0
            ]
          ],
          "refresh": true,
          "move": "vanish",
          "vanish": 0.9
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                1,
                0
              ]
            ],
            "telegraph": 0.6
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.9
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "쌍검병",
      "game": {
        "key": "twinblade",
        "family": "melee",
        "firstWave": 10
      },
      "stats": {
        "hp": 4.5,
        "damage": 1
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 4.2
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            0
          ],
          [
            -1,
            0
          ],
          [
            0,
            1
          ],
          [
            0,
            -1
          ]
        ],
        "targetMap": [
          ".T......",
          "TPT.....",
          ".T......",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              0
            ],
            [
              1,
              0
            ],
            [
              0,
              -1
            ],
            [
              0,
              1
            ]
          ],
          "telegraphSeconds": 0.9,
          "gapBeforeSeconds": 0,
          "map": [
            ".....#..",
            ".P..#E#.",
            ".....#..",
            "........"
          ]
        },
        {
          "index": 2,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              -1
            ],
            [
              1,
              -1
            ],
            [
              -1,
              1
            ],
            [
              1,
              1
            ]
          ],
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            "....#.#.",
            ".P...E..",
            "....#.#.",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "twinblade",
        "name": "쌍검병",
        "family": "melee",
        "firstWave": 10,
        "hp": 4.5,
        "damage": 1,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 4.2
        },
        "chase": {
          "targets": [
            [
              1,
              0
            ],
            [
              -1,
              0
            ],
            [
              0,
              1
            ],
            [
              0,
              -1
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                0
              ],
              [
                1,
                0
              ],
              [
                0,
                -1
              ],
              [
                0,
                1
              ]
            ],
            "telegraph": 0.9
          },
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                -1
              ],
              [
                1,
                -1
              ],
              [
                -1,
                1
              ],
              [
                1,
                1
              ]
            ],
            "telegraph": 0.6,
            "gap": 0
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "방패병",
      "game": {
        "key": "shieldbearer",
        "family": "melee",
        "firstWave": 11
      },
      "stats": {
        "hp": 9,
        "damage": 1
      },
      "idle": {
        "moves": false,
        "moveIntervalSeconds": 3,
        "durationSeconds": 7.2
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            0
          ],
          [
            -1,
            0
          ],
          [
            2,
            0
          ],
          [
            -2,
            0
          ],
          [
            3,
            0
          ],
          [
            -3,
            0
          ],
          [
            4,
            0
          ],
          [
            -4,
            0
          ],
          [
            5,
            0
          ],
          [
            -5,
            0
          ],
          [
            6,
            0
          ],
          [
            -6,
            0
          ],
          [
            7,
            0
          ],
          [
            -7,
            0
          ]
        ],
        "targetMap": [
          "........",
          "TPTTTTTT",
          "........",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.7
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "dash",
          "blockedByObstacles": true,
          "anchor": "enemy",
          "cells": [],
          "dash": {
            "maxCells": 7,
            "tickSeconds": 0.3
          },
          "telegraphSeconds": 0.5,
          "gapBeforeSeconds": 0,
          "map": [
            "........",
            ".@<<<E..",
            "........",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            3,
            0
          ],
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            3,
            3
          ],
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ]
        ],
        "map": [
          "...HH...",
          "...HH...",
          "...HH...",
          "...HH..."
        ],
        "tickSeconds": 0.9
      },
      "gameConfig": {
        "key": "shieldbearer",
        "name": "방패병",
        "family": "melee",
        "firstWave": 11,
        "hp": 9,
        "damage": 1,
        "idle": {
          "moves": false,
          "interval": 3,
          "duration": 7.2
        },
        "chase": {
          "targets": [
            [
              1,
              0
            ],
            [
              -1,
              0
            ],
            [
              2,
              0
            ],
            [
              -2,
              0
            ],
            [
              3,
              0
            ],
            [
              -3,
              0
            ],
            [
              4,
              0
            ],
            [
              -4,
              0
            ],
            [
              5,
              0
            ],
            [
              -5,
              0
            ],
            [
              6,
              0
            ],
            [
              -6,
              0
            ],
            [
              7,
              0
            ],
            [
              -7,
              0
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.7
        },
        "attacks": [
          {
            "kind": "dash",
            "maxCells": 7,
            "tick": 0.3,
            "telegraph": 0.5
          }
        ],
        "retreat": {
          "home": [
            [
              3,
              0
            ],
            [
              3,
              1
            ],
            [
              3,
              2
            ],
            [
              3,
              3
            ],
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ]
          ],
          "tick": 0.9
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "대검병",
      "game": {
        "key": "greatsword",
        "family": "melee",
        "firstWave": 13
      },
      "stats": {
        "hp": 7,
        "damage": 3
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 7.5
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            1
          ],
          [
            1,
            0
          ],
          [
            1,
            -1
          ]
        ],
        "targetMap": [
          "..T.....",
          ".PT.....",
          "..T.....",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "horizontal-only",
          "cellsPerMove": 2,
          "tickSeconds": 0.7
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              -1
            ],
            [
              -1,
              0
            ],
            [
              -1,
              1
            ]
          ],
          "telegraphSeconds": 1.5,
          "gapBeforeSeconds": 0,
          "map": [
            "....#...",
            ".P..#E..",
            "....#...",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.9
      },
      "gameConfig": {
        "key": "greatsword",
        "name": "대검병",
        "family": "melee",
        "firstWave": 13,
        "hp": 7,
        "damage": 3,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 7.5
        },
        "chase": {
          "targets": [
            [
              1,
              1
            ],
            [
              1,
              0
            ],
            [
              1,
              -1
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "horizontal",
          "cellsPerMove": 2,
          "tick": 0.7
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                -1
              ],
              [
                -1,
                0
              ],
              [
                -1,
                1
              ]
            ],
            "telegraph": 1.5
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.9
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "진동술사",
      "game": {
        "key": "quake",
        "family": "ranged",
        "firstWave": 14
      },
      "stats": {
        "hp": 4,
        "damage": 2
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 6.6
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            3,
            -1
          ],
          [
            3,
            0
          ],
          [
            3,
            1
          ]
        ],
        "targetMap": [
          "....T...",
          ".P..T...",
          "....T...",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              -3
            ],
            [
              -1,
              -2
            ],
            [
              -1,
              -1
            ],
            [
              -1,
              0
            ],
            [
              -1,
              1
            ],
            [
              -1,
              2
            ],
            [
              -1,
              3
            ]
          ],
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            "....#...",
            ".P..#E..",
            "....#...",
            "....#..."
          ]
        },
        {
          "index": 2,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -2,
              -3
            ],
            [
              -2,
              -2
            ],
            [
              -2,
              -1
            ],
            [
              -2,
              0
            ],
            [
              -2,
              1
            ],
            [
              -2,
              2
            ],
            [
              -2,
              3
            ]
          ],
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            "...#....",
            ".P.#.E..",
            "...#....",
            "...#...."
          ]
        },
        {
          "index": 3,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -3,
              -3
            ],
            [
              -3,
              -2
            ],
            [
              -3,
              -1
            ],
            [
              -3,
              0
            ],
            [
              -3,
              1
            ],
            [
              -3,
              2
            ],
            [
              -3,
              3
            ]
          ],
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            "..#.....",
            ".P#..E..",
            "..#.....",
            "..#....."
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "quake",
        "name": "진동술사",
        "family": "ranged",
        "firstWave": 14,
        "hp": 4,
        "damage": 2,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 6.6
        },
        "chase": {
          "targets": [
            [
              3,
              -1
            ],
            [
              3,
              0
            ],
            [
              3,
              1
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                -3
              ],
              [
                -1,
                -2
              ],
              [
                -1,
                -1
              ],
              [
                -1,
                0
              ],
              [
                -1,
                1
              ],
              [
                -1,
                2
              ],
              [
                -1,
                3
              ]
            ],
            "telegraph": 0.6
          },
          {
            "kind": "melee",
            "cells": [
              [
                -2,
                -3
              ],
              [
                -2,
                -2
              ],
              [
                -2,
                -1
              ],
              [
                -2,
                0
              ],
              [
                -2,
                1
              ],
              [
                -2,
                2
              ],
              [
                -2,
                3
              ]
            ],
            "telegraph": 0.6,
            "gap": 0
          },
          {
            "kind": "melee",
            "cells": [
              [
                -3,
                -3
              ],
              [
                -3,
                -2
              ],
              [
                -3,
                -1
              ],
              [
                -3,
                0
              ],
              [
                -3,
                1
              ],
              [
                -3,
                2
              ],
              [
                -3,
                3
              ]
            ],
            "telegraph": 0.6,
            "gap": 0
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "포격병",
      "game": {
        "key": "mortar",
        "family": "ranged",
        "firstWave": 16
      },
      "stats": {
        "hp": 3,
        "damage": 2
      },
      "idle": {
        "moves": false,
        "moveIntervalSeconds": 3,
        "durationSeconds": 7.5
      },
      "chase": {
        "targetMode": "currentPosition",
        "targets": [],
        "targetMap": null,
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "throw",
          "blockedByObstacles": false,
          "anchor": "player",
          "cells": [
            [
              0,
              0
            ],
            [
              -1,
              0
            ],
            [
              1,
              0
            ],
            [
              0,
              -1
            ],
            [
              0,
              1
            ]
          ],
          "telegraphSeconds": 1.2,
          "gapBeforeSeconds": 0,
          "map": [
            ".#......",
            "#@#.....",
            ".#......",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "mortar",
        "name": "포격병",
        "family": "ranged",
        "firstWave": 16,
        "hp": 3,
        "damage": 2,
        "idle": {
          "moves": false,
          "interval": 3,
          "duration": 7.5
        },
        "chase": {
          "targets": [],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "throw",
            "cells": [
              [
                0,
                0
              ],
              [
                -1,
                0
              ],
              [
                1,
                0
              ],
              [
                0,
                -1
              ],
              [
                0,
                1
              ]
            ],
            "telegraph": 1.2
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "사냥꾼",
      "game": {
        "key": "hunter",
        "family": "melee",
        "firstWave": 17
      },
      "stats": {
        "hp": 6,
        "damage": 1
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 1.8,
        "durationSeconds": 6
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            7,
            0
          ],
          [
            2,
            -1
          ],
          [
            3,
            -2
          ],
          [
            2,
            1
          ],
          [
            3,
            2
          ],
          [
            4,
            3
          ],
          [
            4,
            -3
          ]
        ],
        "targetMap": [
          "...T....",
          ".PTTTTTT",
          "...T....",
          "....T..."
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.3
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "projectile",
          "blockedByObstacles": true,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              0
            ],
            [
              -2,
              0
            ],
            [
              -3,
              0
            ],
            [
              -4,
              0
            ],
            [
              -5,
              0
            ],
            [
              -6,
              0
            ],
            [
              -7,
              0
            ],
            [
              -2,
              1
            ],
            [
              -3,
              2
            ],
            [
              -2,
              -1
            ],
            [
              -3,
              -2
            ],
            [
              -4,
              -3
            ],
            [
              -4,
              3
            ]
          ],
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            "...#....",
            "#@###E..",
            "...#....",
            "..#....."
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.3
      },
      "gameConfig": {
        "key": "hunter",
        "name": "사냥꾼",
        "family": "melee",
        "firstWave": 17,
        "hp": 6,
        "damage": 1,
        "idle": {
          "moves": true,
          "interval": 1.8,
          "duration": 6
        },
        "chase": {
          "targets": [
            [
              1,
              0
            ],
            [
              2,
              0
            ],
            [
              3,
              0
            ],
            [
              4,
              0
            ],
            [
              5,
              0
            ],
            [
              6,
              0
            ],
            [
              7,
              0
            ],
            [
              2,
              -1
            ],
            [
              3,
              -2
            ],
            [
              2,
              1
            ],
            [
              3,
              2
            ],
            [
              4,
              3
            ],
            [
              4,
              -3
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.3
        },
        "attacks": [
          {
            "kind": "projectile",
            "cells": [
              [
                -1,
                0
              ],
              [
                -2,
                0
              ],
              [
                -3,
                0
              ],
              [
                -4,
                0
              ],
              [
                -5,
                0
              ],
              [
                -6,
                0
              ],
              [
                -7,
                0
              ],
              [
                -2,
                1
              ],
              [
                -3,
                2
              ],
              [
                -2,
                -1
              ],
              [
                -3,
                -2
              ],
              [
                -4,
                -3
              ],
              [
                -4,
                3
              ]
            ],
            "telegraph": 0.6
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.3
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "광선병",
      "game": {
        "key": "beam",
        "family": "ranged",
        "firstWave": 19
      },
      "stats": {
        "hp": 3,
        "damage": 2
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 8.4
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            1
          ],
          [
            2,
            1
          ],
          [
            3,
            1
          ],
          [
            4,
            1
          ],
          [
            5,
            1
          ],
          [
            6,
            1
          ],
          [
            7,
            1
          ],
          [
            1,
            0
          ],
          [
            2,
            0
          ],
          [
            3,
            0
          ],
          [
            4,
            0
          ],
          [
            5,
            0
          ],
          [
            6,
            0
          ],
          [
            7,
            0
          ],
          [
            1,
            -1
          ],
          [
            2,
            -1
          ],
          [
            3,
            -1
          ],
          [
            4,
            -1
          ],
          [
            5,
            -1
          ],
          [
            6,
            -1
          ],
          [
            7,
            -1
          ]
        ],
        "targetMap": [
          "..TTTTTT",
          ".PTTTTTT",
          "..TTTTTT",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "melee",
          "blockedByObstacles": false,
          "anchor": "enemy",
          "cells": [
            [
              -1,
              -1
            ],
            [
              -2,
              -1
            ],
            [
              -3,
              -1
            ],
            [
              -4,
              -1
            ],
            [
              -5,
              -1
            ],
            [
              -6,
              -1
            ],
            [
              -7,
              -1
            ],
            [
              -1,
              0
            ],
            [
              -2,
              0
            ],
            [
              -3,
              0
            ],
            [
              -4,
              0
            ],
            [
              -5,
              0
            ],
            [
              -6,
              0
            ],
            [
              -7,
              0
            ],
            [
              -1,
              1
            ],
            [
              -2,
              1
            ],
            [
              -3,
              1
            ],
            [
              -4,
              1
            ],
            [
              -5,
              1
            ],
            [
              -6,
              1
            ],
            [
              -7,
              1
            ]
          ],
          "telegraphSeconds": 1.5,
          "gapBeforeSeconds": 0,
          "map": [
            "#####...",
            "#@###E..",
            "#####...",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "......HH",
          "......HH",
          "......HH",
          "......HH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "beam",
        "name": "광선병",
        "family": "ranged",
        "firstWave": 19,
        "hp": 3,
        "damage": 2,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 8.4
        },
        "chase": {
          "targets": [
            [
              1,
              1
            ],
            [
              2,
              1
            ],
            [
              3,
              1
            ],
            [
              4,
              1
            ],
            [
              5,
              1
            ],
            [
              6,
              1
            ],
            [
              7,
              1
            ],
            [
              1,
              0
            ],
            [
              2,
              0
            ],
            [
              3,
              0
            ],
            [
              4,
              0
            ],
            [
              5,
              0
            ],
            [
              6,
              0
            ],
            [
              7,
              0
            ],
            [
              1,
              -1
            ],
            [
              2,
              -1
            ],
            [
              3,
              -1
            ],
            [
              4,
              -1
            ],
            [
              5,
              -1
            ],
            [
              6,
              -1
            ],
            [
              7,
              -1
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "melee",
            "cells": [
              [
                -1,
                -1
              ],
              [
                -2,
                -1
              ],
              [
                -3,
                -1
              ],
              [
                -4,
                -1
              ],
              [
                -5,
                -1
              ],
              [
                -6,
                -1
              ],
              [
                -7,
                -1
              ],
              [
                -1,
                0
              ],
              [
                -2,
                0
              ],
              [
                -3,
                0
              ],
              [
                -4,
                0
              ],
              [
                -5,
                0
              ],
              [
                -6,
                0
              ],
              [
                -7,
                0
              ],
              [
                -1,
                1
              ],
              [
                -2,
                1
              ],
              [
                -3,
                1
              ],
              [
                -4,
                1
              ],
              [
                -5,
                1
              ],
              [
                -6,
                1
              ],
              [
                -7,
                1
              ]
            ],
            "telegraph": 1.5
          }
        ],
        "retreat": {
          "home": [
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    },
    {
      "name": "기마병",
      "game": {
        "key": "cavalry",
        "family": "melee",
        "firstWave": 20
      },
      "stats": {
        "hp": 6,
        "damage": 2
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 6.6
      },
      "chase": {
        "targetMode": "cells",
        "targets": [
          [
            1,
            0
          ],
          [
            -1,
            0
          ],
          [
            2,
            0
          ],
          [
            -2,
            0
          ],
          [
            3,
            0
          ],
          [
            -3,
            0
          ],
          [
            4,
            0
          ],
          [
            -4,
            0
          ],
          [
            5,
            0
          ],
          [
            -5,
            0
          ],
          [
            6,
            0
          ],
          [
            -6,
            0
          ],
          [
            7,
            0
          ],
          [
            -7,
            0
          ]
        ],
        "targetMap": [
          "........",
          "TPTTTTTT",
          "........",
          "........"
        ],
        "refreshTarget": true,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.6
        }
      },
      "attacks": [
        {
          "index": 1,
          "kind": "dash",
          "blockedByObstacles": true,
          "anchor": "enemy",
          "cells": [],
          "dash": {
            "maxCells": 7,
            "tickSeconds": 0.15
          },
          "telegraphSeconds": 0.4,
          "gapBeforeSeconds": 0,
          "map": [
            "........",
            ".@<<<E..",
            "........",
            "........"
          ]
        }
      ],
      "retreat": {
        "homeCells": [
          [
            4,
            0
          ],
          [
            4,
            1
          ],
          [
            4,
            2
          ],
          [
            4,
            3
          ],
          [
            5,
            0
          ],
          [
            5,
            1
          ],
          [
            5,
            2
          ],
          [
            5,
            3
          ],
          [
            6,
            0
          ],
          [
            6,
            1
          ],
          [
            6,
            2
          ],
          [
            6,
            3
          ],
          [
            7,
            0
          ],
          [
            7,
            1
          ],
          [
            7,
            2
          ],
          [
            7,
            3
          ]
        ],
        "map": [
          "....HHHH",
          "....HHHH",
          "....HHHH",
          "....HHHH"
        ],
        "tickSeconds": 0.6
      },
      "gameConfig": {
        "key": "cavalry",
        "name": "기마병",
        "family": "melee",
        "firstWave": 20,
        "hp": 6,
        "damage": 2,
        "idle": {
          "moves": true,
          "interval": 3,
          "duration": 6.6
        },
        "chase": {
          "targets": [
            [
              1,
              0
            ],
            [
              -1,
              0
            ],
            [
              2,
              0
            ],
            [
              -2,
              0
            ],
            [
              3,
              0
            ],
            [
              -3,
              0
            ],
            [
              4,
              0
            ],
            [
              -4,
              0
            ],
            [
              5,
              0
            ],
            [
              -5,
              0
            ],
            [
              6,
              0
            ],
            [
              -6,
              0
            ],
            [
              7,
              0
            ],
            [
              -7,
              0
            ]
          ],
          "refresh": true,
          "move": "shortest",
          "step": "any",
          "tick": 0.6
        },
        "attacks": [
          {
            "kind": "dash",
            "maxCells": 7,
            "tick": 0.15,
            "telegraph": 0.4
          }
        ],
        "retreat": {
          "home": [
            [
              4,
              0
            ],
            [
              4,
              1
            ],
            [
              4,
              2
            ],
            [
              4,
              3
            ],
            [
              5,
              0
            ],
            [
              5,
              1
            ],
            [
              5,
              2
            ],
            [
              5,
              3
            ],
            [
              6,
              0
            ],
            [
              6,
              1
            ],
            [
              6,
              2
            ],
            [
              6,
              3
            ],
            [
              7,
              0
            ],
            [
              7,
              1
            ],
            [
              7,
              2
            ],
            [
              7,
              3
            ]
          ],
          "tick": 0.6
        }
      },
      "needsGameCode": [],
      "warnings": []
    }
  ]
}
```
