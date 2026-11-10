// 적과 웨이브 스폰. 종류별 수치와 행동은 CONFIG.ENEMIES에 있고, 규칙은 적 제작 툴(enemy-tool)의 시연과 같다.
// 행동 순환: idle → attack(chase 추적 → strike 시행 → gap 사이 대기 → strike … → retreat 복귀) → idle

function samePos(a, b) {
  return !!a && !!b && a.col === b.col && a.row === b.row;
}

// 경로가 다른 적에 막히는 공격 종류. 이동목표도 플레이어까지 경로가 막힌 칸은 고르지 않는다.
function attackBlocks(attack) {
  return attack.kind === 'projectile' || attack.kind === 'dash';
}

// 두 칸을 잇는 직선 위의 칸들 (양 끝 제외). 각 단계 좌표를 반올림한다.
function lineCells(from, to) {
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  const steps = Math.max(Math.abs(dc), Math.abs(dr));
  const cells = [];
  for (let i = 1; i < steps; i++) {
    cells.push({ col: Math.round(from.col + dc * i / steps), row: Math.round(from.row + dr * i / steps) });
  }
  return cells;
}

// from에서 to까지 직선 경로에 self가 아닌 적이 서 있는지
function lineBlocked(game, from, to, self) {
  return lineCells(from, to).some((c) => {
    const other = game.enemyAt(c.col, c.row);
    return !!other && other !== self;
  });
}

// 돌진 방향. 같은 행이면 가로, 같은 열이면 세로로 플레이어를 향하고, 둘 다 아니면 플레이어 쪽 가로다.
function dashDirection(from, to) {
  const dc = Math.sign(to.col - from.col);
  const dr = Math.sign(to.row - from.row);
  if (dr === 0 || dc !== 0) return { col: dc || -1, row: 0 };
  return { col: 0, row: dr };
}

function inHomeCells(def, col, row) {
  return def.retreat.home.some(([c, r]) => c === col && r === row);
}

const NEIGHBOR_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

class Enemy {
  constructor(kind, col, row, wave) {
    const def = CONFIG.ENEMIES[kind];
    this.kind = kind;
    this.def = def;
    this.col = col;
    this.row = row;
    this.prevCol = col;
    this.prevRow = row;
    this.moveAnim = 0;       // 새 칸으로 미끄러지는 남은 시간
    this.moveAnimTime = CONFIG.ENEMY_MOVE_ANIM_TIME;

    const growth = wave - 1;
    this.attackSpeed = Math.min(CONFIG.ENEMY_ATTACK_SPEED_MAX, 1 + CONFIG.ENEMY_ATTACK_SPEED_GROWTH * growth);
    this.maxHp = Math.round(def.hp * (1 + CONFIG.ENEMY_HP_GROWTH * growth));
    this.hp = this.maxHp;
    this.idleDuration = def.idle.duration / this.attackSpeed;

    this.spawnTimer = CONFIG.SPAWN_DELAY;
    this.flash = 0;
    this.bump = 0;           // 부딪힘 연출(서브우퍼)의 남은 시간. 그리기에만 쓴다.
    this.hidden = false;     // 사라짐 이동 중. 칸을 차지하지 않고 맞지도 않는다.
    this.dash = null;        // 진행 중인 돌진 { attack, dir, steps, clock, telegraph, shown }
    this.attackIndex = 0;    // 지금 실행 중인 공격 번호 (0이 1타)
    this.target = null;      // 추적 중인 이동목표 (refresh가 false면 이 칸을 유지한다)
    this.targetCell = null;  // 다른 idle 적이 비켜 줄 칸. 추적 중에만 있다.
    this.enterIdle();
  }

  // 공격 예고 시간. 공격 속도만큼 짧아지지만 ENEMY_TELEGRAPH_MIN(정의 값이 더 짧으면 정의 값)보다 짧아지지 않는다.
  telegraphTime(attack) {
    return Math.max(Math.min(attack.telegraph, CONFIG.ENEMY_TELEGRAPH_MIN), attack.telegraph / this.attackSpeed);
  }

  enterIdle() {
    this.state = 'idle';
    this.phase = 'idle';
    this.target = null;
    this.targetCell = null;
    this.dash = null;
    // 같은 웨이브의 적이 동시에 움직이지 않도록 길이를 조금씩 흩뜨린다
    const jitter = 1 + CONFIG.ENEMY_IDLE_JITTER * (Math.random() * 2 - 1);
    this.stateTimer = this.idleDuration * jitter;
    this.moveTimer = this.def.idle.interval;
  }

  // Attack 추적을 시작한다. 1타가 던지기면 이동 없이 바로 공격한다.
  enterAttack(game) {
    this.state = 'attack';
    this.phase = 'chase';
    this.moveTimer = 0;
    this.target = null;
    if (this.def.attacks[0].kind === 'throw') this.beginAttack(game);
  }

  // interval: 다음 이동까지의 시간, animTime: 미끄러지는 시간의 상한 (실제로는 ENEMY_MOVE_ANIM_TIME과 작은 쪽)
  moveTo(col, row, interval, animTime = CONFIG.ENEMY_MOVE_ANIM_TIME) {
    this.prevCol = this.col;
    this.prevRow = this.row;
    this.col = col;
    this.row = row;
    this.moveTimer = interval;
    this.moveAnimTime = Math.min(CONFIG.ENEMY_MOVE_ANIM_TIME, animTime);
    this.moveAnim = this.moveAnimTime;
  }

  // 미끄러지지 않고 바로 옮긴다 (사라졌다 나타날 때)
  teleport(col, row) {
    this.col = col;
    this.row = row;
    this.prevCol = col;
    this.prevRow = row;
    this.moveAnim = 0;
  }

  update(dt, game) {
    if (this.spawnTimer > 0) {
      this.spawnTimer = tickDown(this.spawnTimer, dt);
      return;
    }
    this.moveAnim = tickDown(this.moveAnim, dt);
    this.moveTimer = tickDown(this.moveTimer, dt);
    this.stateTimer = tickDown(this.stateTimer, dt);
    if (this.phase === 'idle') this.updateIdle(game);
    else if (this.phase === 'chase') this.updateChase(game);
    else if (this.phase === 'strike') { if (this.dash) this.updateDash(dt, game); }
    else if (this.phase === 'gap') { if (this.stateTimer <= 0) this.beginStrike(game); }
    else if (this.phase === 'retreat') this.updateRetreat(game);
    // 근접·발사체·던지기는 텔레그래프가 끝나면 game이 onAttackFinished를 부른다
  }

  // ---------------------------------------------------------------- Idle

  // 복귀 칸(retreat.home) 안의 인접 빈칸 중 하나로 일정 간격마다 이동한다.
  updateIdle(game) {
    if (this.stateTimer <= 0) {
      this.enterAttack(game);
      return;
    }
    const { idle } = this.def;
    if (!idle.moves) return;
    // 공격하러 오는 적이 이 칸을 노리면 이동 간격을 기다리지 않고 비켜 준다
    if (this.moveAnim <= 0 && this.isWantedBy(game) && this.stepAside(game)) return;
    if (this.moveTimer > 0) return;
    const free = this.neighbors().filter((c) => inHomeCells(this.def, c.col, c.row) && !game.isOccupied(c.col, c.row));
    if (free.length) {
      const cell = pickRandom(free);
      this.moveTo(cell.col, cell.row, idle.interval);
    } else {
      this.moveTimer = idle.interval;
    }
  }

  neighbors() {
    return NEIGHBOR_DIRS
      .map(([dc, dr]) => ({ col: this.col + dc, row: this.row + dr }))
      .filter((c) => Grid.inBounds(c.col, c.row));
  }

  isWantedBy(game) {
    return game.enemies.some((o) => o !== this && samePos(o.targetCell, this));
  }

  // 인접한 빈 칸으로 비킨다. 다른 적이 노리지 않는 칸, 그중 복귀 칸 안의 칸을 먼저 고른다.
  stepAside(game) {
    const wanted = (c) => game.enemies.some((o) => samePos(o.targetCell, c));
    const free = this.neighbors().filter((c) => !game.isOccupied(c.col, c.row) && !wanted(c));
    const cell = free.find((c) => inHomeCells(this.def, c.col, c.row)) || free[0];
    if (!cell) return false;
    this.moveTo(cell.col, cell.row, this.def.idle.interval);
    return true;
  }

  // ---------------------------------------------------------------- Attack 추적

  // 이 칸을 이동목표로 쓸 수 있는지. 그리드 안이고 플레이어 칸이 아니고 다른 적이 없어야 하며,
  // 1타가 발사체·돌진이면 그 칸에서 플레이어까지 경로가 다른 적에 막히지 않아야 한다.
  targetUsable(game, cell) {
    if (!cell || !Grid.inBounds(cell.col, cell.row) || samePos(cell, game.player)) return false;
    const other = game.enemyAt(cell.col, cell.row);
    if (other && other !== this) return false;
    return !(attackBlocks(this.def.attacks[0]) && lineBlocked(game, cell, game.player, this));
  }

  // 이동목표 중 가장 가까운 칸. 거리가 같으면 플레이어 행에 가까운 칸, 그다음 오른쪽 칸이다. 없으면 null.
  chooseTarget(game) {
    const { chase } = this.def;
    const player = game.player;
    let distanceTo;
    if (chase.move === 'vanish') {
      distanceTo = (c, r) => Math.abs(c - this.col) + Math.abs(r - this.row);
    } else if (chase.step === 'horizontal') {
      // 세로 1칸씩 + 가로 cellsPerMove칸씩 걸리는 틱 수
      distanceTo = (c, r) => Math.abs(r - this.row) + Math.ceil(Math.abs(c - this.col) / chase.cellsPerMove);
    } else {
      distanceTo = Grid.distances(this, (c, r) => game.isOccupied(c, r));
    }
    let best = null;
    let bestScore = null;
    for (const [dc, dr] of chase.targets) {
      const cell = { col: player.col + dc, row: player.row + dr };
      if (!this.targetUsable(game, cell)) continue;
      const d = distanceTo(cell.col, cell.row);
      if (d === Infinity) continue;
      const score = [d, Math.abs(cell.row - player.row), -cell.col];
      if (!best || lexLess(score, bestScore)) {
        best = cell;
        bestScore = score;
      }
    }
    return best;
  }

  // refresh가 true면 매번 다시 고르고, false면 처음 고른 칸이 막히거나 플레이어가 설 때만 다시 고른다.
  currentTarget(game) {
    if (this.def.chase.refresh || !this.targetUsable(game, this.target)) this.target = this.chooseTarget(game);
    return this.target;
  }

  // 목표가 없어도 공격을 포기하지 않는다. 추적 상태로 남아 매 스텝 다시 찾는다.
  updateChase(game) {
    const { chase } = this.def;
    if (chase.move === 'vanish') {
      this.updateVanish(game);
      return;
    }
    const target = this.currentTarget(game);
    this.targetCell = target;
    if (!target) return;
    if (samePos(target, this)) {
      this.beginAttack(game);
      return;
    }
    if (this.moveTimer > 0) return;
    const next = chase.step === 'horizontal'
      ? this.horizontalStep(game, target)
      : Grid.stepToward(this, target, (c, r) => game.isOccupied(c, r));
    if (!next) return; // 막혔으면 다음 스텝에 다시 시도한다
    this.moveTo(next.col, next.row, chase.tick, chase.tick);
  }

  // 세로로 1칸씩 목표 행을 맞춘 뒤 가로로 cellsPerMove칸씩 간다. 남은 거리가 더 짧으면 남은 만큼만 가고,
  // 막힌 칸이 있으면 그 앞에서 멈춘다.
  horizontalStep(game, target) {
    const free = (col, row) => Grid.inBounds(col, row) && !game.isOccupied(col, row);
    if (target.row !== this.row) {
      const row = this.row + Math.sign(target.row - this.row);
      return free(this.col, row) ? { col: this.col, row } : null;
    }
    const dir = Math.sign(target.col - this.col);
    const steps = Math.min(this.def.chase.cellsPerMove, Math.abs(target.col - this.col));
    let col = this.col;
    for (let i = 0; i < steps && free(col + dir, this.row); i++) col += dir;
    return col === this.col ? null : { col, row: this.row };
  }

  // 목표가 있어야 사라진다. vanish초 뒤 목표 칸에 나타나 바로 1타 예고를 시작한다.
  // refresh가 true면 나타나는 순간의 플레이어 기준으로 다시 고른다. 나타날 칸이 없으면 숨은 채 기다린다.
  updateVanish(game) {
    if (!this.hidden) {
      if (!this.currentTarget(game)) return;
      this.hidden = true;
      this.stateTimer = this.def.chase.vanish;
      game.burst(this.col, this.row, CONFIG.PARTICLES_VANISH);
      return;
    }
    if (this.stateTimer > 0) return;
    const target = this.currentTarget(game);
    if (!target) return;
    this.hidden = false;
    this.teleport(target.col, target.row);
    game.burst(this.col, this.row, CONFIG.PARTICLES_VANISH);
    this.beginAttack(game);
  }

  // ---------------------------------------------------------------- Attack 시행

  beginAttack(game) {
    this.attackIndex = 0;
    this.targetCell = null;
    this.beginStrike(game);
  }

  // 공격 예고를 시작한다. 범위는 지금 위치로 정한다. 돌진은 방향만 정하고 보이는 칸은 시간으로 정한다.
  beginStrike(game) {
    const attack = this.def.attacks[this.attackIndex];
    const time = this.telegraphTime(attack);
    this.phase = 'strike';
    if (attack.kind === 'dash') {
      this.dash = { attack, dir: dashDirection(this, game.player), steps: 0, clock: 0, telegraph: time, shown: [] };
      this.dash.shown = this.dashTelegraph(game);
      game.startEnemyDash(this);
      return;
    }
    game.startEnemyAttack(this, this.strikeCells(game, attack), time);
  }

  // 공격 범위의 그리드 안 칸들. 던지기는 지금 플레이어 칸 기준이고, 발사체는 경로가 다른 적에 막힌 칸을 뺀다.
  strikeCells(game, attack) {
    const origin = attack.kind === 'throw' ? { col: game.player.col, row: game.player.row } : this;
    let cells = attack.cells
      .map(([dc, dr]) => ({ col: origin.col + dc, row: origin.row + dr }))
      .filter((c) => Grid.inBounds(c.col, c.row));
    if (attack.kind === 'projectile') cells = cells.filter((c) => !lineBlocked(game, this, c, this));
    return cells;
  }

  // 돌진 경로에서 지금 보여야 할 칸들 { col, row, lead }. 개수 제한 없이 예고시간으로만 정한다.
  // 출발 뒤 (k - 1) x 칸당 시간에 들어가는 k번째 칸은 들어가기 예고시간 전부터 보이고, 들어가면 빠진다.
  // 다른 적·그리드 끝·최대 거리 앞에서 끊기고, 플레이어 칸은 보이되 그 뒤는 안 보인다. lead는 들어갈 때까지 남은 시간이다.
  dashTelegraph(game) {
    const { attack, dir, steps, clock, telegraph } = this.dash;
    const shown = [];
    for (let k = 1; steps + k <= attack.maxCells + 1; k++) {
      const col = this.col + dir.col * k;
      const row = this.row + dir.row * k;
      if (!Grid.inBounds(col, row)) break;
      const other = game.enemyAt(col, row);
      if (other && other !== this) break;
      const isPlayer = samePos({ col, row }, game.player);
      if (steps + k > attack.maxCells && !isPlayer) break; // 최대 거리 다음 칸은 플레이어가 있을 때만 친다
      const lead = telegraph + (steps + k - 1) * attack.tick - clock;
      if (lead > telegraph + 1e-9) break;
      shown.push({ col, row, lead: Math.max(0, lead) });
      if (isPlayer) break;
    }
    return shown;
  }

  // 예고가 끝나면 tick마다 1칸씩 나아간다. 이동 시각은 예고 표시와 같은 시계(clock)로 정해
  // 칸이 보인 뒤 정확히 예고시간 뒤에 들어간다. 다음 칸이 플레이어면 그 앞에서 멈추며 피해를 주고,
  // 다른 적·그리드 끝·최대 거리에서는 피해 없이 멈춘다.
  updateDash(dt, game) {
    const dash = this.dash;
    dash.clock += dt;
    while (this.dash && dash.clock + 1e-9 >= dash.telegraph + dash.steps * dash.attack.tick) {
      const next = { col: this.col + dash.dir.col, row: this.row + dash.dir.row };
      if (samePos(next, game.player)) {
        this.finishDash(game, [next]);
        return;
      }
      if (dash.steps >= dash.attack.maxCells || !Grid.inBounds(next.col, next.row) || game.isOccupied(next.col, next.row)) {
        this.finishDash(game, []);
        return;
      }
      this.moveTo(next.col, next.row, 0, dash.attack.tick);
      dash.steps++;
    }
    dash.shown = this.dashTelegraph(game);
  }

  finishDash(game, cells) {
    this.dash = null;
    game.resolveEnemyStrike(this, cells);
    if (this.phase === 'strike') this.onAttackFinished();
  }

  // 한 타가 실행된 뒤 부른다. 다음 타가 있으면 사이 시간을 기다리고, 없으면 복귀한다.
  onAttackFinished() {
    this.attackIndex++;
    const next = this.def.attacks[this.attackIndex];
    if (next) {
      this.phase = 'gap';
      this.stateTimer = next.gap || 0;
    } else {
      this.enterRetreat();
    }
  }

  // 진행 중인 공격(예고 또는 돌진)을 멈추고 남은 연속 공격 없이 복귀한다 (카운터포인트). 멈췄으면 true.
  cancelAttack() {
    if (this.phase !== 'strike') return false;
    this.enterRetreat();
    return true;
  }

  // ---------------------------------------------------------------- 복귀

  enterRetreat() {
    this.phase = 'retreat';
    this.dash = null;
    this.moveTimer = this.def.retreat.tick;
  }

  // 복귀 칸 중 갈 수 있는 가장 가까운 빈 칸으로 돌아간다. 갈 칸이 없으면 그 자리에서 Idle로 돌아간다.
  updateRetreat(game) {
    if (inHomeCells(this.def, this.col, this.row)) {
      this.enterIdle();
      return;
    }
    if (this.moveTimer > 0) return;
    const occupied = (c, r) => game.isOccupied(c, r);
    const distanceTo = Grid.distances(this, occupied);
    let best = null;
    for (const [col, row] of this.def.retreat.home) {
      if (occupied(col, row) || distanceTo(col, row) === Infinity) continue;
      if (!best || distanceTo(col, row) < distanceTo(best.col, best.row)) best = { col, row };
    }
    const next = best && Grid.stepToward(this, best, occupied);
    if (!next) {
      this.enterIdle();
      return;
    }
    this.moveTo(next.col, next.row, this.def.retreat.tick, this.def.retreat.tick);
  }

  // 데미지를 적용하고 죽었는지 돌려준다.
  takeDamage(amount) {
    this.hp -= amount;
    this.flash = CONFIG.ENEMY_FLASH_TIME;
    return this.hp <= 0;
  }

  get drawCol() {
    const t = this.moveAnimTime > 0 ? 1 - this.moveAnim / this.moveAnimTime : 1;
    return this.prevCol + (this.col - this.prevCol) * t;
  }

  get drawRow() {
    const t = this.moveAnimTime > 0 ? 1 - this.moveAnim / this.moveAnimTime : 1;
    return this.prevRow + (this.row - this.prevRow) * t;
  }
}

// lexLess(사전순 비교)는 relics.js에 있다. 실행 중에만 부르므로 스크립트 순서와 상관없다.

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function rollEnemyKinds(wave) {
  const all = Object.keys(CONFIG.ENEMIES);
  const unlocked = (family) => all.filter((kind) => {
    const def = CONFIG.ENEMIES[kind];
    return def.family === family && def.firstWave <= wave;
  });
  const melee = unlocked('melee');
  const ranged = unlocked('ranged');
  const count = wave === 1 ? CONFIG.SPAWN_FIRST_WAVE : randInt(CONFIG.SPAWN_MIN, CONFIG.SPAWN_MAX);
  const kinds = [];
  for (let i = 0; i < count; i++) {
    const useRanged = ranged.length && Math.random() < CONFIG.RANGED_SPAWN_CHANCE;
    kinds.push(pickRandom(useRanged ? ranged : melee));
  }
  // 새 종류가 처음 나오는 웨이브에는 반드시 한 마리를 넣는다
  all.filter((kind) => CONFIG.ENEMIES[kind].firstWave === wave).forEach((kind, i) => {
    if (!kinds.includes(kind)) kinds[i] = kind;
  });
  return kinds;
}

// 빈 칸 중 그 적의 복귀 칸을 먼저 고르고, 없으면 아무 빈 칸이나 고른다.
function pickSpawnCell(isBlocked, def) {
  const empty = Grid.emptyCells(isBlocked);
  const preferred = empty.filter((c) => inHomeCells(def, c.col, c.row));
  if (preferred.length) return pickRandom(preferred);
  return empty.length ? pickRandom(empty) : null;
}

function spawnWave(wave, isBlocked) {
  const enemies = [];
  const blocked = (c, r) => isBlocked(c, r) || enemies.some((e) => e.col === c && e.row === r);
  for (const kind of rollEnemyKinds(wave)) {
    const cell = pickSpawnCell(blocked, CONFIG.ENEMIES[kind]);
    if (cell) enemies.push(new Enemy(kind, cell.col, cell.row, wave));
  }
  return enemies;
}
