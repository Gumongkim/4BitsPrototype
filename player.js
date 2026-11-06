// 플레이어: 이동 틱, 무기 리듬, 판정.

const MOVE_DIRS = {
  ArrowLeft: { col: -1, row: 0 },
  ArrowRight: { col: 1, row: 0 },
  ArrowUp: { col: 0, row: -1 },
  ArrowDown: { col: 0, row: 1 },
};
const MOVE_KEYS = Object.keys(MOVE_DIRS);

// beat번 리듬의 공격 범위. ranges에 그 리듬 범위가 있으면 그것을, 없으면 range를 쓴다.
function weaponBeatRange(weapon, beat) {
  return (weapon.ranges && weapon.ranges[beat]) || weapon.range || { cells: [] };
}

// beat번 리듬이 범위에서 가장 가까운 적 하나만 맞는지
function weaponFirstTargetOnly(weapon, beat) {
  const range = weaponBeatRange(weapon, beat);
  return range.firstTargetOnly !== undefined ? !!range.firstTargetOnly : !!weapon.firstTargetOnly;
}

// beat번 리듬 공격 범위의 칸들. lastCol은 rowToEnd 범위가 끝나는 열이다.
function weaponRangeCells(weapon, beat, col, row, lastCol) {
  const { cells = [], rowToEnd } = weaponBeatRange(weapon, beat);
  const result = cells.map(([dc, dr]) => ({ col: col + dc, row: row + dr }));
  if (rowToEnd) {
    for (let c = col + 1; c <= lastCol; c++) result.push({ col: c, row });
  }
  return result;
}

// 노드별 HIT 난이도 d_i. 원값은 간격 계수 x (직전 노드와 드럼이 다르면 HIT_KEY_CHANGE_MULT)이고,
// 무기 평균으로 나눠 평균이 1이 되게 한다. 직전 노드는 순환해서 잡는다 (0번 노드의 직전은 마지막 노드).
function weaponHitDifficulty(weapon) {
  const { intervals, drums } = weapon;
  const raw = intervals.map((gap, i) => {
    const gapValue = CONFIG.HIT_GAP_DIFFICULTY.find((g) => gap <= g.maxGap + 1e-9).value;
    const prev = drums[(i - 1 + drums.length) % drums.length];
    return gapValue * (prev !== drums[i] ? CONFIG.HIT_KEY_CHANGE_MULT : 1);
  });
  const mean = raw.reduce((sum, v) => sum + v, 0) / raw.length;
  return raw.map((v) => v / mean);
}

// 카드에 표시할 데미지. 박자가 많은 무기도 한 줄에 들어가도록 같은 값은 한 번만 쓴다.
function weaponDamageText(weapon) {
  return `데미지 ${[...new Set(weapon.damages)].join(' / ')}`;
}

class Player {
  constructor(weaponKind = CONFIG.DEFAULT_WEAPON) {
    this.col = CONFIG.PLAYER_START_COL;
    this.row = CONFIG.PLAYER_START_ROW;
    this.prevCol = this.col;
    this.prevRow = this.row;
    this.moveTimer = 0;
    this.bufferedMove = null;
    this.stats = {
      maxHp: CONFIG.PLAYER_MAX_HP,
      moveTick: CONFIG.MOVE_TICK,
      windowBonus: 0,
      perfectMult: CONFIG.JUDGE.perfect.damageMult,
      goodMult: CONFIG.JUDGE.good.damageMult,
    };
    this.hp = this.stats.maxHp;
    this.hurtFlash = 0;    // 시각 효과일 뿐 판정에 영향을 주지 않는다
    this.goalFlash = 0;    // 공격 키를 누른 뒤 공격 범위 테두리가 하얗게 보이는 남은 시간. 역시 시각 효과다.
    this.goalFlashBeat = 0; // 그 테두리를 그릴 리듬 번호

    this.ringTime = 0;     // 현재 간격의 경과 시간. 간격이 끝나는 순간이 매치 시점.
    this.ringCycles = 0;   // 링 생성 후 지나간 매치 시점 수
    this.beatIndex = 0;    // 다음에 맞을 리듬 번호
    this.clearedRing = -1; // 공격 성공으로 사라진 링. ringCycles와 같은 기준으로 센 번호.
    this.lastBeat = 0;     // 마지막으로 지나간 리듬 번호
    this.justMatched = false;
    this.lastError = null; // 디버그용: 마지막 입력의 매치 시점 오차
    this.setWeapon(weaponKind);
  }

  setWeapon(kind) {
    this.weaponKind = kind;
    this.weapon = CONFIG.WEAPONS[kind];
    this.hitDifficulty = weaponHitDifficulty(this.weapon); // 노드별 난이도 d_i
    this.ringActive = false;
    this.cooldown = 0;
    this.cooldownTotal = CONFIG.ATTACK_COOLDOWN; // HUD 막대용: 현재 쿨다운의 전체 길이
    this.resetHit();
  }

  // HIT 상태와 표시를 지운다. 링이 (재)시작되거나 멈추면 부른다.
  resetHit() {
    this.hitCycle = -1;    // HIT를 세고 있는 사이클 id. 링 시작부터 센 사이클 번호다.
    this.hitCount = 0;     // 그 사이클의 HIT
    this.hitShown = false; // "n HIT" 표시 여부
    this.hitValue = 0;     // 표시 중인 숫자
    this.hitPrevValue = null; // 굴러 올라가며 사라지는 이전 숫자
    this.hitRoll = 0;      // 숫자가 바뀌는 연출의 남은 시간
    this.hitPop = 0;       // 팝 연출의 남은 시간
    this.hitFade = 0;      // 사라지는 연출의 남은 시간. 0이면 사라지는 중이 아니다.
  }

  // 다음에 올 리듬이 속한 사이클 id
  get currentCycle() {
    return Math.floor(this.ringCycles / this.weapon.intervals.length);
  }

  // ring번 리듬(matchBeat의 ring) 공격이 적을 맞혀 성공했을 때 부른다. 그 노드를 포함한 HIT를 돌려준다.
  // 사이클 경계에서 늦게 들어온 입력은 이전 사이클의 HIT로 센다.
  registerHit(ring) {
    const cycle = Math.floor(ring / this.weapon.intervals.length);
    // 이미 다음 사이클을 세기 시작한 뒤 이전 사이클 입력이 오는 경우는 순서상 생기지 않는다. 생기면 첫 HIT로 본다.
    if (cycle < this.hitCycle) return 1;
    if (cycle > this.hitCycle) {
      this.hitCycle = cycle;
      this.hitCount = 0;
    }
    this.hitCount++;
    this.hitPrevValue = this.hitShown ? this.hitValue : null;
    this.hitValue = this.hitCount;
    this.hitShown = true;
    this.hitRoll = CONFIG.HIT_UI_ROLL_TIME;
    this.hitPop = CONFIG.HIT_UI_POP_TIME;
    // 지나간 사이클의 늦은 입력이면 사라지는 연출을 처음부터 다시 한다
    this.hitFade = cycle < this.currentCycle ? CONFIG.HIT_UI_FADE_TIME : 0;
    return this.hitCount;
  }

  // n번째 HIT로 beat번 노드를 맞혔을 때의 추가 배율
  hitBonus(n, beat) {
    const nodes = this.weapon.intervals.length;
    const progress = (n - 1) / Math.max(1, nodes - 1);
    return Math.min(CONFIG.HIT_BONUS_CAP, CONFIG.HIT_MAX_BONUS * progress * this.hitDifficulty[beat]);
  }

  updateHitUi(dt) {
    this.hitRoll = tickDown(this.hitRoll, dt);
    this.hitPop = tickDown(this.hitPop, dt);
    if (this.hitFade > 0) {
      this.hitFade = tickDown(this.hitFade, dt);
      if (this.hitFade === 0) this.hitShown = false;
    }
  }

  // 판정 윈도우. 모든 무기에 같다. 한 리듬에 두 번 성공하는 것은 tryAttack에서 막는다.
  get perfectWindow() {
    return CONFIG.JUDGE.perfect.window + this.stats.windowBonus;
  }

  get goodWindow() {
    return CONFIG.JUDGE.good.window + this.stats.windowBonus;
  }

  // beat번 리듬의 그리드 안에 있는 공격 범위 칸들
  attackCells(beat) {
    return weaponRangeCells(this.weapon, beat, this.col, this.row, CONFIG.GRID_COLS - 1)
      .filter((c) => Grid.inBounds(c.col, c.row));
  }

  // 어느 리듬이든 그리드 안에 공격 범위가 있는지
  get hasAttackCells() {
    return this.weapon.intervals.some((_, beat) => this.attackCells(beat).length > 0);
  }

  // 현재 입력을 읽어 이동을 시도한다. isBlocked(col, row)면 들어갈 수 없다.
  // 막혀서 이동하지 못한 입력은 정지 상태를 깨지 않는다.
  updateMovement(dt, isBlocked) {
    for (const code of MOVE_KEYS) {
      if (Input.wasPressed(code)) this.bufferedMove = code;
    }
    this.moveTimer = tickDown(this.moveTimer, dt);
    if (this.moveTimer > 0) return;

    // 키를 한 번 누를 때마다 한 칸만 이동한다. 누르고 있어도 반복하지 않는다.
    const code = this.bufferedMove;
    this.bufferedMove = null;
    if (!code) return;
    const col = this.col + MOVE_DIRS[code].col;
    const row = this.row + MOVE_DIRS[code].row;
    if (!Grid.inBounds(col, row) || isBlocked(col, row)) return;
    this.prevCol = this.col;
    this.prevRow = this.row;
    this.col = col;
    this.row = row;
    this.moveTimer = this.stats.moveTick;
    this.ringActive = false;
    this.resetHit(); // 이동하면 링과 함께 HIT도 사라진다
  }

  // 리듬은 입력과 상관없이 무기의 간격대로 계속 진행한다.
  updateRing(dt) {
    this.justMatched = false;
    this.cooldown = tickDown(this.cooldown, dt);
    if (!this.ringActive && this.moveTimer <= 0 && this.hasAttackCells) this.restartRing();
    if (!this.ringActive) return;
    this.ringTime += dt;
    if (this.ringTime >= this.currentInterval) {
      this.ringTime -= this.currentInterval;
      this.lastBeat = this.beatIndex;
      this.beatIndex = (this.beatIndex + 1) % this.weapon.intervals.length;
      this.ringCycles++;
      this.justMatched = true;
      // 사이클이 바뀌는 순간부터 지난 사이클의 HIT 표시가 사라지기 시작한다
      if (this.hitShown && this.hitCycle < this.currentCycle && this.hitFade === 0) this.hitFade = CONFIG.HIT_UI_FADE_TIME;
    }
  }

  restartRing() {
    this.ringActive = true;
    this.ringTime = this.weapon.startOffset || 0;
    this.ringCycles = 0;
    this.beatIndex = 0;
    this.clearedRing = -1;
    this.resetHit(); // 새 링은 HIT 0, 사이클 0부터
  }

  get currentInterval() {
    return this.weapon.intervals[this.beatIndex];
  }

  // 다음 리듬까지 남은 시간
  get timeToNextBeat() {
    return this.currentInterval - this.ringTime;
  }

  // within초 안에 올 리듬들을 가까운 순서로 돌려준다. { time: 남은 시간, beat: 리듬 번호 }
  // 공격 성공으로 사라진 링은 뺀다.
  upcomingBeats(within) {
    const beats = [];
    let beat = this.beatIndex;
    let ring = this.ringCycles;
    let time = this.timeToNextBeat;
    while (time <= within) {
      if (ring !== this.clearedRing) beats.push({ time, beat });
      beat = (beat + 1) % this.weapon.intervals.length;
      ring++;
      time += this.weapon.intervals[beat];
    }
    return beats;
  }

  // 지나갔지만 늦은 입력이 아직 인정되는 리듬. time은 음수다. 없거나 링이 사라졌으면 null.
  // 쿨다운이 끝나기 전에 Good 윈도우가 닫히면 칠 수 없으므로 링도 안쪽으로 들어오지 않는다.
  get lateBeat() {
    if (this.ringCycles === 0 || this.ringTime + this.cooldown > this.goodWindow) return null;
    if (this.ringCycles - 1 === this.clearedRing) return null;
    return { time: -this.ringTime, beat: this.lastBeat };
  }

  // 지금 쳐야 할 리듬 번호. 늦은 입력이 남았으면 그 리듬, 다음 링이 이미 사라졌으면 그다음 리듬이다.
  get targetBeat() {
    if (this.lateBeat) return this.lastBeat;
    if (this.ringCycles === this.clearedRing) return (this.beatIndex + 1) % this.weapon.intervals.length;
    return this.beatIndex;
  }

  // 패턴 한 바퀴 안에서의 경과 시간
  get cycleTime() {
    const before = this.weapon.intervals.slice(0, this.beatIndex).reduce((sum, v) => sum + v, 0);
    return before + this.ringTime;
  }

  // 짝 리듬인지. 아니면 쿵 리듬이다.
  isSnare(index) {
    return this.weapon.drums[index] === 'snare';
  }

  // 가장 가까운 리듬과 부호 있는 오차. 음수면 이름, 양수면 늦음.
  // 늦은 입력은 다음 간격 초반에 들어오므로 지나간 리듬과도 비교한다.
  matchBeat(age) {
    return this.beatCandidates(age)[0];
  }

  // 다음 리듬과 지나간 리듬을 오차가 작은 순서로 돌려준다. 같으면 다음 리듬이 먼저다.
  beatCandidates(age) {
    const t = this.ringCycles > 0 ? this.ringTime - age : Math.max(0, this.ringTime - age);
    const candidates = [{ error: t - this.currentInterval, beat: this.beatIndex, ring: this.ringCycles }];
    if (this.ringCycles > 0) candidates.push({ error: t, beat: this.lastBeat, ring: this.ringCycles - 1 });
    return candidates.sort((a, b) => Math.abs(a.error) - Math.abs(b.error));
  }

  // 공격 입력이 노리는 리듬. 가장 가까운 리듬이 이미 성공한 리듬이면 다른 리듬이 Good 윈도우 안일 때만 그 리듬을 노리고,
  // 아니면 null(입력 무시)이다. 윈도우가 쿨다운보다 길어 같은 리듬을 두 번 칠 수 있기 때문이다.
  attackTarget(age) {
    const [nearest, other] = this.beatCandidates(age);
    if (nearest.ring !== this.clearedRing) return nearest;
    if (other && other.ring !== this.clearedRing && Math.abs(other.error) <= this.goodWindow) return other;
    return null;
  }

  gradeOf(error) {
    const abs = Math.abs(error);
    if (abs <= this.perfectWindow) return 'perfect';
    if (abs <= this.goodWindow) return 'good';
    return 'miss';
  }

  // 공격 키 입력 처리. age는 입력 후 경과 초, drum은 누른 키의 드럼('kick' 또는 'snare').
  // 쿨다운 중이거나 링이 없거나 이미 성공한 리듬에 맞춘 입력이면 null(완전 무시). 노린 리듬과 드럼이 다르면 Miss다.
  // 키를 누르고 있는 동안의 반복 입력은 Input에서 버리므로 꾹 누르기는 한 번 누른 것과 같다.
  tryAttack(age, drum) {
    if (this.cooldown > 0 || !this.ringActive) return null;
    const target = this.attackTarget(age);
    if (!target) return null;
    const { error, beat, ring } = target;
    const grade = this.weapon.drums[beat] === drum ? this.gradeOf(error) : 'miss';
    if (grade !== 'miss') this.clearedRing = ring;
    this.cooldownTotal = grade === 'miss' ? CONFIG.ATTACK_MISS_COOLDOWN : CONFIG.ATTACK_COOLDOWN;
    this.cooldown = this.cooldownTotal;
    this.lastError = error;
    return { grade, error, drum, beat, ring, damage: this.weapon.damages[beat] };
  }

  // 화면상 이동 진행도. 틱의 앞부분 MOVE_ANIM_TIME 동안 새 칸에 도착하고, 남은 틱 동안은 멈춰 있다.
  // 보상으로 틱이 이보다 짧아지면 틱 전체에 걸쳐 이동한다.
  get moveProgress() {
    const elapsed = this.stats.moveTick - this.moveTimer;
    return Math.min(1, elapsed / Math.min(CONFIG.MOVE_ANIM_TIME, this.stats.moveTick));
  }

  get drawCol() {
    return this.prevCol + (this.col - this.prevCol) * this.moveProgress;
  }

  get drawRow() {
    return this.prevRow + (this.row - this.prevRow) * this.moveProgress;
  }
}
