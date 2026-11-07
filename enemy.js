// 적과 웨이브 스폰. 종류별 수치는 CONFIG.ENEMIES에 있다.
// 행동 순환: idle → attack(접근 → 공격 → 복귀) → idle

// 공격이 플레이어에게 닿는 칸들. 이동하지 않는 적은 지금 칸뿐이다.
// 왼쪽만 공격하는 적은 플레이어가 맨 오른쪽 열에 있으면 후보가 없다.
function attackPositions(enemy, player) {
  if (enemy.def.stationary) return [{ col: enemy.col, row: enemy.row }];
  const positions = [];
  for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
    for (let col = 0; col < CONFIG.GRID_COLS; col++) {
      if (col === player.col && row === player.row) continue;
      const cells = attackCells({ def: enemy.def, col, row }, player);
      if (cells.some((c) => c.col === player.col && c.row === player.row)) positions.push({ col, row });
    }
  }
  return positions;
}

// 후보 칸 중 갈 수 있는 가장 가까운 칸. 거리가 같으면 기준 행에 가까운 칸, 그다음 오른쪽 칸을 고른다.
// 갈 수 있는 칸이 없으면 맨해튼 거리로 가장 가까운 칸을 돌려준다. 후보가 없으면 null.
function nearestCell(cells, distanceTo, from, preferRow) {
  if (!cells.length) return null;
  const score = (c, d) => [d, Math.abs(c.row - preferRow), -c.col];
  const better = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  let best = null;
  let bestScore = null;
  for (const cell of cells) {
    const d = distanceTo(cell.col, cell.row);
    if (d === Infinity) continue;
    const s = score(cell, d);
    if (!best || better(s, bestScore)) { best = cell; bestScore = s; }
  }
  if (best) return best;
  const manhattan = (c) => Math.abs(c.col - from.col) + Math.abs(c.row - from.row);
  return cells.reduce((a, b) => (manhattan(b) < manhattan(a) ? b : a));
}

// 공격하러 갈 칸. 다른 적이 차지하지 않은 후보 중 가장 가까운 칸이고, 모두 막혔으면 가장 가까운 후보다.
function chooseAttackPosition(enemy, game) {
  const occupied = (c, r) => game.isOccupied(c, r);
  return nearestCell(attackPositions(enemy, game.player), Grid.distances(enemy, occupied), enemy, game.player.row);
}

// 공격 대상 칸들을 돌려준다. 그리드 밖 칸은 뺀다.
function attackCells(enemy, player) {
  const { cells = [], rows = [], aimed } = enemy.def.attack;
  const origin = aimed ? player : enemy;
  const result = cells.map(([dc, dr]) => ({ col: origin.col + dc, row: origin.row + dr }));
  for (const dr of rows) {
    for (let col = origin.col - 1; col >= 0; col--) result.push({ col, row: origin.row + dr });
  }
  return result.filter((c) => Grid.inBounds(c.col, c.row));
}

// 적이 새 칸으로 미끄러지는 시간. 이동 틱의 앞부분이고, 남은 틱 동안은 멈춰 있다.
// 이동 틱이 이보다 짧으면 틱 전체에 걸쳐 미끄러진다.
function enemyMoveAnimTime() {
  return Math.min(CONFIG.ENEMY_MOVE_ANIM_TIME, CONFIG.ENEMY_MOVE_TICK);
}

function homeMinCol() {
  return CONFIG.GRID_COLS - CONFIG.ENEMY_HOME_COLS;
}

class Enemy {
  constructor(kind, col, row, wave) {
    const def = CONFIG.ENEMIES[kind];
    this.kind = kind;
    this.def = def;
    this.col = col;
    this.row = row;
    this.prevCol = col;
    this.prevRow = row;
    this.moveAnim = 0;

    const growth = wave - 1;
    const attackSpeed = Math.min(CONFIG.ENEMY_ATTACK_SPEED_MAX, 1 + CONFIG.ENEMY_ATTACK_SPEED_GROWTH * growth);
    this.maxHp = Math.round(def.hp * (1 + CONFIG.ENEMY_HP_GROWTH * growth));
    this.hp = this.maxHp;
    this.telegraphTime = Math.max(CONFIG.ENEMY_TELEGRAPH_MIN, def.telegraphTime / attackSpeed);
    this.idleDuration = def.idleDuration / attackSpeed;

    this.spawnTimer = CONFIG.SPAWN_DELAY;
    this.flash = 0;
    this.bump = 0;           // 부딪힘 연출(서브우퍼)의 남은 시간. 그리기에만 쓴다.
    this.enterIdle();
  }

  enterIdle() {
    this.state = 'idle';
    this.attackPhase = null;
    this.targetCell = null;  // 접근 중에 노리는 공격 칸. idle 적이 비켜 줄 때 쓴다.
    // 같은 웨이브의 적이 동시에 움직이지 않도록 길이를 조금씩 흩뜨린다
    const jitter = 1 + CONFIG.ENEMY_IDLE_JITTER * (Math.random() * 2 - 1);
    this.stateTimer = this.idleDuration * jitter;
    this.moveTimer = CONFIG.ENEMY_IDLE_MOVE_INTERVAL;
  }

  enterAttack() {
    this.state = 'attack';
    this.attackPhase = 'approach';
    this.moveTimer = 0;
  }

  moveTo(col, row, interval) {
    this.prevCol = this.col;
    this.prevRow = this.row;
    this.col = col;
    this.row = row;
    this.moveTimer = interval;
    this.moveAnim = enemyMoveAnimTime();
  }

  update(dt, game) {
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      return;
    }
    if (this.moveAnim > 0) this.moveAnim = Math.max(0, this.moveAnim - dt);
    this.moveTimer = tickDown(this.moveTimer, dt);
    if (this.state === 'idle') this.updateIdle(dt, game);
    else if (this.attackPhase === 'approach') this.updateApproach(game);
    else if (this.attackPhase === 'return') this.updateReturn(game);
    // strike 단계는 텔레그래프가 끝나면 onAttackFinished로 넘어간다
  }

  // 오른쪽 구역 안에서 인접 4방향 빈 칸 중 하나로 일정 간격마다 이동한다.
  updateIdle(dt, game) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.enterAttack();
      return;
    }
    // 공격하러 오는 적이 이 칸을 노리면 이동 간격을 기다리지 않고 비켜 준다
    if (this.moveAnim <= 0 && this.isWantedBy(game) && this.stepAside(game)) return;
    if (this.moveTimer > 0) return;
    const free = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      .map(([dc, dr]) => ({ col: this.col + dc, row: this.row + dr }))
      .filter((c) => Grid.inBounds(c.col, c.row) && c.col >= homeMinCol() && !game.isOccupied(c.col, c.row));
    if (free.length) {
      const cell = pickRandom(free);
      this.moveTo(cell.col, cell.row, CONFIG.ENEMY_IDLE_MOVE_INTERVAL);
    } else {
      this.moveTimer = CONFIG.ENEMY_IDLE_MOVE_INTERVAL;
    }
  }

  isWantedBy(game) {
    return game.enemies.some((o) => o !== this && o.targetCell
      && o.targetCell.col === this.col && o.targetCell.row === this.row);
  }

  // 인접한 빈 칸으로 비킨다. 다른 적이 노리지 않는 칸, 그중 대기 구역 안의 칸을 먼저 고른다.
  stepAside(game) {
    const wanted = (c) => game.enemies.some((o) => o.targetCell && o.targetCell.col === c.col && o.targetCell.row === c.row);
    const free = [[1, 0], [0, -1], [0, 1], [-1, 0]]
      .map(([dc, dr]) => ({ col: this.col + dc, row: this.row + dr }))
      .filter((c) => Grid.inBounds(c.col, c.row) && !game.isOccupied(c.col, c.row) && !wanted(c));
    const cell = free.find((c) => c.col >= homeMinCol()) || free[0];
    if (!cell) return false;
    this.moveTo(cell.col, cell.row, CONFIG.ENEMY_IDLE_MOVE_INTERVAL);
    return true;
  }

  // 공격이 플레이어에게 닿는 칸 중 가장 가까운 빈 칸으로 이동하고, 도착하면 공격을 시작한다.
  updateApproach(game) {
    const position = chooseAttackPosition(this, game);
    this.targetCell = position;
    if (!position) {
      // 공격이 닿는 칸이 없으면 이번 공격을 포기하고 돌아간다
      this.attackPhase = 'return';
      return;
    }
    if (position.col === this.col && position.row === this.row) {
      this.attackPhase = 'strike';
      this.targetCell = null;
      game.startEnemyAttack(this, attackCells(this, game.player));
      return;
    }
    this.stepTo(position, game);
  }

  onAttackFinished() {
    this.attackPhase = 'return';
    this.moveTimer = CONFIG.ENEMY_MOVE_TICK;
  }

  // 대기 구역에서 가장 가까운 빈 칸으로 돌아간다.
  updateReturn(game) {
    if (this.col >= homeMinCol()) {
      this.enterIdle();
      return;
    }
    if (this.moveTimer > 0) return;
    const occupied = (c, r) => game.isOccupied(c, r);
    const home = Grid.emptyCells(occupied).filter((c) => c.col >= homeMinCol());
    const target = nearestCell(home, Grid.distances(this, occupied), this, this.row) || { col: homeMinCol(), row: this.row };
    this.stepTo(target, game);
  }

  stepTo(target, game) {
    if (this.moveTimer > 0) return;
    const step = Grid.stepToward(this, target, (c, r) => game.isOccupied(c, r));
    if (step) this.moveTo(step.col, step.row, CONFIG.ENEMY_MOVE_TICK);
  }

  // 데미지를 적용하고 죽었는지 돌려준다.
  takeDamage(amount) {
    this.hp -= amount;
    this.flash = CONFIG.ENEMY_FLASH_TIME;
    return this.hp <= 0;
  }

  get drawCol() {
    const t = 1 - this.moveAnim / enemyMoveAnimTime();
    return this.prevCol + (this.col - this.prevCol) * t;
  }

  get drawRow() {
    const t = 1 - this.moveAnim / enemyMoveAnimTime();
    return this.prevRow + (this.row - this.prevRow) * t;
  }
}

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

// 후보 칸 중 우선 조건을 만족하는 칸을 고르고, 없으면 아무 빈 칸이나 고른다.
function pickSpawnCell(isBlocked, prefer) {
  const empty = Grid.emptyCells(isBlocked);
  const preferred = empty.filter((c) => prefer(c.col));
  if (preferred.length) return pickRandom(preferred);
  return empty.length ? pickRandom(empty) : null;
}

function spawnWave(wave, isBlocked) {
  const enemies = [];
  const blocked = (c, r) => isBlocked(c, r) || enemies.some((e) => e.col === c && e.row === r);
  for (const kind of rollEnemyKinds(wave)) {
    const cell = pickSpawnCell(blocked, (col) => col >= homeMinCol());
    if (cell) enemies.push(new Enemy(kind, cell.col, cell.row, wave));
  }
  return enemies;
}
