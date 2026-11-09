# 적 데이터: 지금 게임의 적 8종

- 기준: `config.js` `ENEMIES`, 빌드 `2026.11.07-1`
- 스키마: `4bit-prototype-enemy-tool/v1`
- 불러오기: 적 제작 툴(`enemy-tool/index.html`)의 '불러오기' 버튼을 누르거나 이 파일을 툴 화면에 끌어다 놓는다.
- **원본은 맨 아래 JSON 코드블록이다.** 툴은 그 블록만 읽는다. 표와 그림은 사람이 읽는 용도이므로 값을 고칠 때는 JSON을 고친다.
- 양식 설명: `enemy-tool/CLAUDE.md`

## 요약

| 이름 (키) | 계열 | 첫 웨이브 | HP | 공격력 | Idle 지속 | 공격 종류 | 예고 | 이동목표 |
|---|---|---|---|---|---|---|---|---|
| 검병 (`sword`) | 근접 | 1 | 4.5 | 2 | 5.5 | 근접 | 0.6 | 플레이어 오른쪽 1칸 |
| 창병 (`spear`) | 근접 | 3 | 4.5 | 2 | 6.5 | 근접 | 0.7 | 플레이어 오른쪽 1~2칸 |
| 쌍검병 (`twinblade`) | 근접 | 7 | 4.5 | 2 | 4 | 근접 | 0.6 | 플레이어 상하좌우 |
| 대검병 (`greatsword`) | 근접 | 9 | 4.5 | 2 | 7.5 | 근접 | 0.9 | 플레이어 오른쪽 열, 위아래 1행 안의 3칸 |
| 궁수 (`archer`) | 원거리 | 2 | 3 | 1 | 6.5 | 발사체 | 1 | 같은 행, 플레이어보다 오른쪽 |
| 산탄병 (`shotgun`) | 원거리 | 5 | 3 | 1 | 5.5 | 발사체 | 0.8 | 오른쪽 1~2열, 위아래 1행 안의 6칸 |
| 포격병 (`mortar`) | 원거리 | 11 | 3 | 1 | 7.5 | 던지기 | 1.2 | 현재 위치 (이동 없음) |
| 광선병 (`beam`) | 원거리 | 13 | 3 | 1 | 8.5 | 발사체 | 1.3 | 플레이어 행과 위아래 행, 플레이어보다 오른쪽 |

8종 공통 (시간 단위는 초):

- 1회 공격이다.
- Idle 중 3초마다 대기 구역 안의 인접 빈칸으로 이동한다.
- 추적은 최단거리로 0.5초마다 1칸 이동한다 (포격병 제외).
- 복귀 목표는 오른쪽 4x4이고 0.5초마다 1칸 이동한다.

## 주의

- 궁수·산탄병·광선병을 '발사체'로 적은 것은 툴에서 쓰려고 나눈 값이다. **지금 게임의 적 공격은 경로에 막히지 않는다.** 그래서 이 셋은 JSON의 `needsGameCode`에 그 내용이 적혀 있다.
- 궁수·광선병의 게임 값 `rows`(왼쪽 끝까지)는 그리드에서 닿을 수 있는 가장 먼 거리인 왼쪽 7칸까지의 `cells`로 옮겼다. 게임 안에서의 범위는 같다.
- 게임의 `aimed: true` + `stationary: true`(포격병)는 툴의 '던지기'에 해당한다.

## 공격 범위 그림

P = 플레이어(열 1, 행 1), E = 적(열 5, 행 1), # = 공격 범위, @ = 플레이어 칸이 범위에 포함, . = 빈 칸.

검병

```text
........
.P..#E..
........
........
```

창병

```text
........
.P.##E..
........
........
```

쌍검병

```text
.....#..
.P..#E#.
.....#..
........
```

대검병

```text
....#...
.P..#E..
....#...
........
```

궁수

```text
........
#@###E..
........
........
```

산탄병

```text
...##...
.P.##E..
...##...
........
```

포격병 (플레이어 칸 기준이라 E를 그리지 않는다)

```text
.#......
#@#.....
.#......
........
```

광선병

```text
#####...
#@###E..
#####...
........
```

## 원본 데이터 (JSON)

툴이 읽는 부분이다. 맨 앞의 `howToRead`에 항목별 설명이 있다.

```json
{
  "format": "4bit-prototype-enemy-tool/v1",
  "exportedAt": "2026-11-09T08:12:54.923Z",
  "howToRead": [
    "4Bit_Prototype 적 제작 툴에서 내보낸 적 데이터다. enemies 배열의 원소 하나가 적 하나다.",
    "행동 순환: idle → chase(Attack 추적) → attacks(Attack 시행) → retreat(복귀) → idle. 시간 단위는 모두 초이고 그리드는 8열 x 4행, 오른쪽이 +열, 아래가 +행이다.",
    "stats: hp와 damage(공격 1회의 공격력). 연속 공격은 타마다 같은 공격력이다.",
    "idle: moves가 true면 moveIntervalSeconds마다 인접 빈칸으로 이동한다(게임과 같이 retreat.homeCells 안에서). false면 이동하지 않는다. durationSeconds가 지나면 chase로 간다.",
    "chase.targetMode: cells면 targets 중 한 칸으로 이동한 뒤 공격한다. currentPosition이면 1타가 던지기라 위치 제한이 없어 이동 없이 그 자리에서 공격하며 targets와 move는 쓰지 않는다.",
    "chase.targets: 플레이어 칸 기준 [열 차이, 행 차이]. 툴이 1타 범위로 계산한 위치에서 사용자가 끄고 켠 최종 결과다. 1타가 적 기준 범위 [a, b]를 가지면 자동 목표는 [-a, -b]이다. 런타임에는 그리드 안이고 플레이어 칸이 아니고 비어 있는 칸 중 가장 가까운 칸을 고른다. 거리가 같으면 플레이어 행에 가까운 칸, 그다음 오른쪽 칸이다.",
    "chase.targetMap: 플레이어를 게임 시작 위치(P, 열 1, 행 1)에 둔 그림. T = 이동목표, . = 빈 칸. 이 위치에서 그리드 밖으로 나가는 칸은 그림에 없고 targets에만 있다.",
    "chase.move: method가 shortest면 stepMode가 any-direction일 때 상하좌우 최단 경로로 tickSeconds마다 1칸, horizontal-only일 때 tickSeconds마다 가로로 cellsPerMove칸씩 이동한다(세로 이동 없음. 지금 행에서 그 배수 거리로 닿는 목표만 유효하고, 없으면 공격을 포기하고 retreat로 간다). method가 vanish면 화면에서 사라졌다가 vanishSeconds 뒤 목표 칸에 나타난다.",
    "attacks: 순서대로 실행하는 공격 목록. index 1이 1타다. 이동목표 계산에는 1타만 쓴다.",
    "attacks[].kind: melee(근접), projectile(발사체), throw(던지기). blockedByObstacles가 true인 projectile은 적 칸에서 대상 칸까지의 직선 경로(양 끝 제외, 각 단계 좌표를 반올림한 칸)에 적이나 장애물이 있으면 그 칸을 맞히지 못한다. 이동목표도 플레이어까지 경로가 막힌 칸은 고르지 않는다. melee와 throw는 막히지 않는다.",
    "attacks[].anchor와 cells: anchor가 enemy면 cells는 적 칸 기준 [열 차이, 행 차이]다. player면 공격 시작 시점의 플레이어 칸 기준이고 throw가 여기에 해당하며 [0, 0]도 범위가 될 수 있다. 범위는 각 타의 예고가 시작되는 순간에 정한다.",
    "attacks[].map: 그림. P = 플레이어(열 1, 행 1), E = 적(열 5, 행 1, anchor가 enemy일 때만), # = 공격 범위, @ = 플레이어 칸이 범위에 포함, . = 빈 칸.",
    "attacks[].telegraphSeconds: 공격 예고 시간. gapBeforeSeconds: 앞 타의 공격이 실행된 순간부터 이 타의 예고가 시작될 때까지의 시간. 1타는 0이다.",
    "retreat.homeCells: 복귀 선호 위치, 그리드 절대 좌표 [열, 행]. 가장 가까운 빈 칸으로 tickSeconds마다 1칸씩 돌아간다. map의 H가 그 칸이다.",
    "game: 게임 등록 정보(key = config.js ENEMIES의 키, family, firstWave). 툴에서 새로 만든 적은 null이다.",
    "gameConfig: 지금 게임 config.js ENEMIES 항목 형식으로 옮긴 값. key나 firstWave가 null이면 사용자에게 물어 정한다. 1타의 값만 들어 있다. 새 적은 renderer.js의 ENEMY_LOOKS에도 모양을 넣는다.",
    "needsGameCode: 지금 게임 코드로는 표현할 수 없어 enemy.js 등의 수정이 필요한 항목. 비어 있으면 gameConfig만 옮기면 동작이 같다.",
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
        "durationSeconds": 5.5
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
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
          "telegraphSeconds": 0.6,
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "sword",
        "name": "검병",
        "family": "melee",
        "firstWave": 1,
        "hp": 4.5,
        "damage": 2,
        "idleDuration": 5.5,
        "telegraphTime": 0.6,
        "attack": {
          "cells": [
            [
              -1,
              0
            ]
          ]
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
        "firstWave": 3
      },
      "stats": {
        "hp": 4.5,
        "damage": 2
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 6.5
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
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
          "telegraphSeconds": 0.7,
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "spear",
        "name": "창병",
        "family": "melee",
        "firstWave": 3,
        "hp": 4.5,
        "damage": 2,
        "idleDuration": 6.5,
        "telegraphTime": 0.7,
        "attack": {
          "cells": [
            [
              -1,
              0
            ],
            [
              -2,
              0
            ]
          ]
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
        "firstWave": 7
      },
      "stats": {
        "hp": 4.5,
        "damage": 2
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 4
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
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
          "telegraphSeconds": 0.6,
          "gapBeforeSeconds": 0,
          "map": [
            ".....#..",
            ".P..#E#.",
            ".....#..",
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "twinblade",
        "name": "쌍검병",
        "family": "melee",
        "firstWave": 7,
        "hp": 4.5,
        "damage": 2,
        "idleDuration": 4,
        "telegraphTime": 0.6,
        "attack": {
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
          ]
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
        "firstWave": 9
      },
      "stats": {
        "hp": 4.5,
        "damage": 2
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
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
          "telegraphSeconds": 0.9,
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "greatsword",
        "name": "대검병",
        "family": "melee",
        "firstWave": 9,
        "hp": 4.5,
        "damage": 2,
        "idleDuration": 7.5,
        "telegraphTime": 0.9,
        "attack": {
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
          ]
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
        "durationSeconds": 6.5
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
          ]
        ],
        "targetMap": [
          "........",
          ".PTTTTTT",
          "........",
          "........"
        ],
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
          "telegraphSeconds": 1,
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "archer",
        "name": "궁수",
        "family": "ranged",
        "firstWave": 2,
        "hp": 3,
        "damage": 1,
        "idleDuration": 6.5,
        "telegraphTime": 1,
        "attack": {
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
          ]
        }
      },
      "needsGameCode": [
        "kind=projectile: 지금 게임의 적 공격은 경로에 막히지 않는다."
      ],
      "warnings": []
    },
    {
      "name": "산탄병",
      "game": {
        "key": "shotgun",
        "family": "ranged",
        "firstWave": 5
      },
      "stats": {
        "hp": 3,
        "damage": 1
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 5.5
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
          "..TT....",
          ".PTT....",
          "..TT....",
          "........"
        ],
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
          "telegraphSeconds": 0.8,
          "gapBeforeSeconds": 0,
          "map": [
            "...##...",
            ".P.##E..",
            "...##...",
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "shotgun",
        "name": "산탄병",
        "family": "ranged",
        "firstWave": 5,
        "hp": 3,
        "damage": 1,
        "idleDuration": 5.5,
        "telegraphTime": 0.8,
        "attack": {
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
          ]
        }
      },
      "needsGameCode": [
        "kind=projectile: 지금 게임의 적 공격은 경로에 막히지 않는다."
      ],
      "warnings": []
    },
    {
      "name": "포격병",
      "game": {
        "key": "mortar",
        "family": "ranged",
        "firstWave": 11
      },
      "stats": {
        "hp": 3,
        "damage": 1
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 7.5
      },
      "chase": {
        "targetMode": "currentPosition",
        "targets": [],
        "targetMap": null,
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "mortar",
        "name": "포격병",
        "family": "ranged",
        "firstWave": 11,
        "hp": 3,
        "damage": 1,
        "idleDuration": 7.5,
        "telegraphTime": 1.2,
        "stationary": true,
        "attack": {
          "aimed": true,
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
          ]
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
        "firstWave": 13
      },
      "stats": {
        "hp": 3,
        "damage": 1
      },
      "idle": {
        "moves": true,
        "moveIntervalSeconds": 3,
        "durationSeconds": 8.5
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
        "move": {
          "method": "shortest",
          "stepMode": "any-direction",
          "cellsPerMove": 1,
          "tickSeconds": 0.5
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
          "telegraphSeconds": 1.3,
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
        "tickSeconds": 0.5
      },
      "gameConfig": {
        "key": "beam",
        "name": "광선병",
        "family": "ranged",
        "firstWave": 13,
        "hp": 3,
        "damage": 1,
        "idleDuration": 8.5,
        "telegraphTime": 1.3,
        "attack": {
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
          ]
        }
      },
      "needsGameCode": [
        "kind=projectile: 지금 게임의 적 공격은 경로에 막히지 않는다."
      ],
      "warnings": []
    }
  ]
}
```
