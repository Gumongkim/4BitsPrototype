// 밸런스와 관련된 모든 숫자는 이 파일에 모은다. 시간 단위는 초.

const CONFIG = {
  // 화면
  VIEW_WIDTH: 320,
  VIEW_HEIGHT: 180,
  CELL_SIZE: 32,
  GRID_X: 32,
  GRID_Y: 36,

  // 시간
  LOGIC_HZ: 60,
  MAX_FRAME_DELTA: 0.25,        // 탭 전환 등으로 프레임이 크게 밀렸을 때의 상한
  MAX_INPUT_AGE: 0.1,           // 입력 시각 보정의 상한

  // 그리드
  GRID_COLS: 8,
  GRID_ROWS: 4,

  // 플레이어
  PLAYER_START_COL: 1,
  PLAYER_START_ROW: 1,
  PLAYER_MAX_HP: 10,
  MOVE_TICK: 0.2,               // 이동 틱. 한 칸 이동 후 다음 이동까지의 시간
  MOVE_ANIM_TIME: 0.1,          // 틱 앞부분에서 새 칸으로 미끄러지는 시간. 나머지는 멈춰 있다.

  // 공격 링
  // 링의 각 변이 0.5초에 1칸씩 안쪽으로 움직인다. 무기와 상관없이 고정이다 (내부 해상도 픽셀/초).
  RING_SPEED: 32 / 0.5,
  // 리듬까지 이 시간 이하로 남은 링만 보인다. 공격 범위의 상하좌우 1칸이 크기 상한이다 (1칸 범위면 3x3).
  RING_APPEAR_TIME: 0.5,
  RING_MAX_ALPHA: 1,            // 리듬 순간의 진하기. 링은 완전히 투명한 상태로 나타나 여기까지 진해진다.
  RING_THICKNESS: 2,            // 링 두께 (내부 해상도 픽셀)
  RING_CORNER_LENGTH: 32 / 2,   // 링 모서리 ㄱ자 한 변의 길이. 0.5칸이라 네 개가 모이면 1칸이 된다.
  // 공격 범위는 평소에 그리지 않는다. 링이 보이는 동안만 그 리듬의 드럼 색으로 채운다.
  RANGE_FILL_ALPHA: 0.22,       // 링이 보이는 동안 범위 채우기가 리듬 순간까지 이 진하기로 진해진다
  RANGE_MATCH_FILL_ALPHA: 0.45, // 리듬 순간의 범위 채우기 진하기. MATCH_FLASH_TIME 동안 흐려진다.
  RING_GOAL_THICKNESS: 2,       // 공격 키를 눌렀을 때 나타나는 하얀 범위 테두리 두께
  RING_GOAL_PRESS_TIME: 0.15,   // 그 테두리가 선명하게 나타났다가 사라지는 시간
  RING_KEY_SIZE: 8,             // 플레이어 위에 표시하는 키 글자 크기
  RING_KEY_GAP: 9,              // 키 글자 사이 간격 (내부 해상도 픽셀)
  RING_KEY_DIM_ALPHA: 0.3,      // 지금 눌러야 할 키가 아닌 글자의 진하기

  // 판정 배율
  JUDGE: {
    perfect: { damageMult: 2 },
    good: { damageMult: 1 },
  },
  WINDOW_MARGIN: 0.005,         // 판정 윈도우 x 2가 쿨다운보다 이만큼 작게 유지된다

  // 화면 아래 리듬 막대
  BEAT_BAR_STEPS: 8,            // 무기 패턴 한 바퀴를 나누는 칸 수 (4칸 + 4칸)
  BEAT_BAR_WIDTH: 100,          // 막대 길이 (내부 해상도 픽셀)
  BEAT_BAR_Y: 168,              // 막대 가로선의 위치

  // 드럼별 입력 키. 리듬과 다른 키를 누르면 Miss다.
  DRUM_KEYS: { kick: 'KeyA', snare: 'KeyS' },

  // 무기. 새 무기는 여기에 추가한다.
  //   intervals: 각 리듬을 치기 전까지의 간격. 끝나면 처음으로 돌아간다.
  //   startOffset: 리듬이 시작될 때 이미 지나 있는 시간. 패턴 전체가 이만큼 일찍 온다. 없으면 0.
  //   drums: 리듬별 드럼. kick(쿵, 초록 링) 또는 snare(짝, 보라 링).
  //   damages: 리듬별 데미지. 최종 데미지는 리듬 데미지 x 판정 배율이다.
  //   cooldown: 공격 입력 쿨다운. 가장 짧은 간격보다 조금 작게 둔다.
  //   missCooldown: Miss를 냈을 때의 쿨다운. 없으면 cooldown과 같다.
  //   perfectWindow, goodWindow: 매치 시점 기준 ± 초
  //   range: 공격 범위. ranges에 범위가 없는 리듬은 모두 이 범위를 쓴다.
  //     cells: [[열, 행], ...]  플레이어 기준 상대 위치
  //     rowToEnd: true          오른쪽 끝까지 이어지는 같은 행
  //     firstTargetOnly: true   범위에서 가장 가까운 적 하나만 맞는다. 없으면 무기의 firstTargetOnly를 따른다.
  //   ranges: 리듬별 공격 범위 [range, ...]. 리듬 순서이고 형식은 range와 같다. 없거나 빈 자리는 range를 쓴다.
  //     무기 제작 툴 JSON의 gameConfig.ranges를 그대로 넣으면 된다.
  //   firstTargetOnly: true면 범위에서 가장 가까운 적 하나만 맞는다
  DEFAULT_WEAPON: 'sword',
  WEAPONS: {
    sword: {
      name: '한손검', rangeDesc: '앞 1칸',
      // 기본 백비트: 쿵 . 짝 . 쿵 . 짝 .
      intervals: [0.6, 0.6, 0.6, 0.6], drums: ['kick', 'snare', 'kick', 'snare'], damages: [0.5, 1.5, 0.5, 1.5], cooldown: 0.5,
      perfectWindow: 0.05, goodWindow: 0.12,
      range: { cells: [[1, 0]] },
    },
    dagger: {
      name: '단검', rangeDesc: '앞 1칸',
      // 쿵쿵짝: 쿵 쿵 짝 . 쿵 쿵 짝 .
      intervals: [0.6, 0.3, 0.3, 0.6, 0.3, 0.3], drums: ['kick', 'kick', 'snare', 'kick', 'kick', 'snare'], damages: [0.5, 0.5, 1.25, 0.5, 0.5, 1.25], cooldown: 0.25, missCooldown: 0.6,
      perfectWindow: 0.05, goodWindow: 0.12,
      range: { cells: [[1, 0]] },
    },
    greatsword: {
      name: '양손검', rangeDesc: '앞 열 3칸',
      // 하프타임: 쿵 . . . 짝 . . .
      intervals: [1.2, 1.2], startOffset: 0.3, drums: ['kick', 'snare'], damages: [2, 3.5], cooldown: 0.85,
      perfectWindow: 0.05, goodWindow: 0.12,
      range: { cells: [[1, -1], [1, 0], [1, 1]] },
    },
    bow: {
      name: '활', rangeDesc: '같은 행 첫 적',
      // 트레실로: 쿵 . . 쿵 . . 짝 .
      intervals: [0.6, 0.9, 0.9], drums: ['kick', 'kick', 'snare'], damages: [1, 1, 1.5], cooldown: 0.55,
      perfectWindow: 0.05, goodWindow: 0.12,
      range: { rowToEnd: true },
      firstTargetOnly: true,
    },
  },

  // 연속 Perfect 보너스 (보상으로 활성화)
  COMBO_BONUS_EVERY: 3,         // N연속 Perfect마다 보너스 발동

  // 적 공통 행동
  ENEMY_HOME_COLS: 4,           // idle 구역: 오른쪽에서 몇 개 열인지
  ENEMY_MOVE_TICK: 0.5,         // attack 상태의 이동 틱 (접근과 복귀)
  ENEMY_MOVE_ANIM_TIME: 0.1,    // 새 칸으로 미끄러지는 시간. 이동 틱의 나머지는 멈춰 있다. idle 이동도 같은 시간으로 미끄러진다.
  ENEMY_IDLE_MOVE_INTERVAL: 3,  // idle 상태의 이동 간격
  ENEMY_IDLE_JITTER: 0.2,       // idle 지속 시간을 ±이 비율만큼 흩뜨린다

  // 적 정의. 새 적은 여기에 추가하고 renderer.js의 ENEMY_LOOKS에 모양을 넣는다.
  //   family: melee 또는 ranged. 스폰 확률을 나눌 때 쓴다.
  //   firstWave: 처음 등장하는 웨이브. 그 웨이브에는 반드시 한 마리가 나온다.
  //   idleDuration: idle 상태 지속 시간
  //   telegraphTime: 공격 예고 시간
  //   공격 위치는 정하지 않는다. attack 상태가 되면 공격 범위가 플레이어에게 닿는 칸 중
  //   다른 적이 없는 가장 가까운 칸으로 이동한다.
  //   stationary: true면 이동하지 않고 그 자리에서 공격한다.
  //   attack: 공격 범위
  //     cells: [[열, 행], ...]  기준 칸에서의 상대 위치. 왼쪽이 열 -1, 위쪽이 행 -1.
  //     rows: [행, ...]         기준 칸 왼쪽 끝까지 이어지는 행 (상대 위치)
  //     aimed: true             기준 칸이 적이 아니라 공격 시작 시점의 플레이어 칸
  ENEMIES: {
    // 근접
    sword: {
      name: '검병', family: 'melee', firstWave: 1,
      hp: 4.5, damage: 2,
      idleDuration: 5.5, telegraphTime: 0.6,
      attack: { cells: [[-1, 0]] },
    },
    spear: {
      name: '창병', family: 'melee', firstWave: 3,
      hp: 4.5, damage: 2,
      idleDuration: 6.5, telegraphTime: 0.7,
      attack: { cells: [[-1, 0], [-2, 0]] },
    },
    twinblade: {
      name: '쌍검병', family: 'melee', firstWave: 7,
      hp: 4.5, damage: 2,
      idleDuration: 4, telegraphTime: 0.6,
      attack: { cells: [[-1, 0], [1, 0], [0, -1], [0, 1]] },
    },
    greatsword: {
      name: '대검병', family: 'melee', firstWave: 9,
      hp: 4.5, damage: 2,
      idleDuration: 7.5, telegraphTime: 0.9,
      attack: { cells: [[-1, -1], [-1, 0], [-1, 1]] },
    },
    // 원거리
    archer: {
      name: '궁수', family: 'ranged', firstWave: 2,
      hp: 3, damage: 1,
      idleDuration: 6.5, telegraphTime: 1.0,
      attack: { rows: [0] },
    },
    shotgun: {
      name: '산탄병', family: 'ranged', firstWave: 5,
      hp: 3, damage: 1,
      idleDuration: 5.5, telegraphTime: 0.8,
      attack: { cells: [[-1, -1], [-1, 0], [-1, 1], [-2, -1], [-2, 0], [-2, 1]] },
    },
    mortar: {
      name: '포격병', family: 'ranged', firstWave: 11,
      hp: 3, damage: 1,
      idleDuration: 7.5, telegraphTime: 1.2,
      stationary: true,
      attack: { aimed: true, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    },
    beam: {
      name: '광선병', family: 'ranged', firstWave: 13,
      hp: 3, damage: 1,
      idleDuration: 8.5, telegraphTime: 1.3,
      attack: { rows: [-1, 0, 1] },
    },
  },

  // 웨이브와 스폰
  SPAWN_FIRST_WAVE: 1,          // 1웨이브에 스폰되는 수
  SPAWN_MIN: 2,                 // 2웨이브부터 스폰되는 수의 범위
  SPAWN_MAX: 3,
  SPAWN_DELAY: 0.6,             // 스폰 후 행동 시작까지의 대기
  RANGED_SPAWN_CHANCE: 0.4,     // 원거리 계열이 나올 확률. 계열 안에서는 등장한 종류 중 균등하게 고른다.
  ENEMY_HP_GROWTH: 0.15,        // 웨이브당 HP 증가율
  ENEMY_ATTACK_SPEED_GROWTH: 0.06, // 웨이브당 공격 속도 증가율
  ENEMY_ATTACK_SPEED_MAX: 1.8,
  ENEMY_TELEGRAPH_MIN: 0.6,     // 공격 예고 시간의 하한. 정의 값이나 공격 속도와 상관없이 이보다 짧아지지 않는다.
  WAVE_CLEAR_DELAY: 0.6,        // 마지막 적 처치 후 보상 화면까지의 대기

  // 보상
  REWARD_CARD_COUNT: 3,
  REWARD_INPUT_LOCK: 0.4,       // 보상 화면 진입 직후 입력을 막는 시간
  // Perfect 비율 0%와 100%일 때의 등급 가중치. 그 사이는 선형 보간한다.
  RARITY_WEIGHTS: {
    common: { low: 80, high: 25 },
    rare: { low: 18, high: 45 },
    epic: { low: 2, high: 30 },
  },
  WEAPON_CARD_CHANCE: 0.35,     // 보상 화면 마지막 카드가 다른 무기 카드로 바뀔 확률
  // 보상으로 도달할 수 있는 수치의 한계.
  STAT_LIMITS: {
    windowBonus: { max: 0.03 },
    perfectMult: { max: 5 },
    moveTick: { min: 0.09 },
    comboBonusDamage: { max: 3 },
  },
  // 새 보상은 이 배열에만 추가하면 된다.
  // effects의 stat은 player.stats의 키, add는 더할 값. heal은 현재 HP 회복량.
  REWARDS: [
    { id: 'max_hp', name: '체력 단련', desc: '최대 HP +2', rarity: 'common',
      effects: [{ stat: 'maxHp', add: 2 }], heal: 2 },
    { id: 'move_tick', name: '가벼운 발', desc: '이동 틱 -0.02초', rarity: 'common',
      effects: [{ stat: 'moveTick', add: -0.02 }] },
    { id: 'window_up', name: '넓은 시야', desc: 'Perfect 윈도우 +0.01초\nGood 윈도우 +0.01초', rarity: 'rare',
      effects: [{ stat: 'windowBonus', add: 0.01 }] },
    { id: 'perfect_dmg', name: '정밀 타격', desc: 'Perfect 데미지 배율 +1', rarity: 'rare',
      effects: [{ stat: 'perfectMult', add: 1 }] },
    { id: 'combo_bonus', name: '리듬 연쇄', desc: '3연속 Perfect마다\n추가 데미지 +2', rarity: 'epic',
      effects: [{ stat: 'comboBonusDamage', add: 2 }] },
    { id: 'big_hp', name: '강철 심장', desc: '최대 HP +5', rarity: 'epic',
      effects: [{ stat: 'maxHp', add: 5 }], heal: 5 },
  ],

  // 연출
  HITSTOP_PERFECT: 0.07,
  HITSTOP_GOOD: 0.03,
  SHAKE_PERFECT: 2,             // 흔들림 세기 (내부 해상도 픽셀)
  SHAKE_HURT: 3,
  SHAKE_DURATION: 0.15,
  HURT_FLASH_TIME: 0.3,
  ENEMY_FLASH_TIME: 0.1,
  POPUP_TIME: 0.6,
  IMPACT_TIME: 0.12,            // 적 공격 실행 순간의 번쩍임
  MATCH_FLASH_TIME: 0.15,       // 리듬 순간 범위가 드럼 색으로 진하게 채워졌다가 흐려지는 시간
  RING_BURST_TIME: 0.2,         // 공격 성공으로 링이 터지는 이펙트
  RING_BURST_SPREAD: { perfect: 14, good: 6 }, // 터지며 퍼지는 거리 (내부 해상도 픽셀)
  RING_BURST_ALPHA: { perfect: 1, good: 0.7 }, // 터지는 순간의 진하기
  PARTICLES_PERFECT: 8,
  PARTICLES_KILL: 6,
  PARTICLE_SPEED: 60,           // 내부 해상도 픽셀/초
  PARTICLE_TIME: 0.25,
  SFX_VOLUME: 0.08,
};
