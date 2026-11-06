// 유물: 보유 목록, 이벤트 훅, 규칙 확장 지점, 추첨. 유물 정의(이름, 등급, 설명, 수치)는 CONFIG.RELICS에 있다.
//
// 보유 유물은 game.relics(유물 키 배열, 슬롯 순서)이고, 유물마다 상태 객체 game.relicState[키]가 있다.
// 효과는 RELIC_LOGIC[키]에 이벤트 처리 함수와 질의 함수로 둔다. 모두 (game, data, state, def)를 받는다.
//   state는 그 유물의 상태 객체, def는 CONFIG.RELICS[키]다.
//
// 이벤트 (game.emit(이름, data)으로 보유 유물에 차례로 전달된다)
//   acquire / remove        유물을 얻거나 잃었다 {}
//   runStart                런 시작 {}
//   waveStart / waveClear   { wave }
//   cycleStart              { cycle }
//   cycleEnd                { cycle, nodes, hits, perfectHits, allPerfect, interrupted }
//                           interrupted: 이동이나 링 재시작으로 사이클이 끝까지 가지 못했다
//   node                    노드 판정 { grade, drum, beat, ring, targets, damage, hits, whiff }
//                           targets: 맞힌 적, damage: 적 하나에 준 최종 데미지, hits: 이 노드를 포함한 HIT (Miss면 0)
//                           whiff: 빈 범위를 쳤지만 HIT로 센 노드 (에어 드럼)
//   enemyHit                { enemy, damage, source }  source: node, crash, sforzando, tap, crescendo, freestyle
//   enemyKill               { enemy, source }
//   playerMove              { from, to, onBeat, kept }  onBeat: 누른 순간이 가장 가까운 노드의 Perfect 윈도우 안
//                           kept: 링이 리셋되지 않았다
//   playerHurt              { amount, absorbed }  absorbed: 실드가 막은 양
//   telegraphStart          { enemy, telegraph }
//   weaponEquip             { kind, reason }  reason: start, switch, replace
//   weaponSwitch            { from, to }      턴테이블 전환. 교체가 아니다.
//   weaponReplace           { from, to }      무기 보상으로 슬롯의 무기가 바뀌었다
//   weaponRemove            { kind }          무기가 슬롯에서 빠졌다
//   ringRestart             링이 새로 시작됐다 {}
//   ringStop                이동이나 프리스타일로 링이 멈췄다 {}
//   update                  매 로직 스텝 (전투 중) { dt }
//
// 질의 (규칙 확장 지점)
//   damagePct(ctx)          유물 % 풀에 더할 값. ctx = { drum, beat, weaponKind, grade, hits, freestyle }
//   damageMult(ctx)         최종 데미지에 따로 곱할 배율
//   attackCells(ctx)        공격 범위를 대신할 칸 목록. null이면 무기 범위를 쓴다. ctx = { beat }
//   keepRingOnMove(ctx)     true면 이동해도 링을 리셋하지 않는다. ctx = { onBeat }
//   whiffHits(ctx)          true면 빈 범위를 친 Good 이상도 HIT로 센다
//   attackInput(ctx)        true면 공격 키 입력을 유물이 처리했다 (리듬 판정을 하지 않는다). ctx = { drum, age }
//   weaponSlots(ctx)        무기 슬롯 수. 가장 큰 값을 쓰고 없으면 1이다.

// 배열 a가 b보다 사전순으로 앞서는지
function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

const RELIC_LOGIC = {
  kick_solo: {
    damagePct: (game, ctx, state, def) => (ctx.drum === 'kick' ? def.pct : 0),
  },
  snare_solo: {
    damagePct: (game, ctx, state, def) => (ctx.drum === 'snare' ? def.pct : 0),
  },

  // 쿵 Perfect로 맞은 적을 오른쪽으로 민다. 벽이나 다른 적(플레이어 포함)에 막히면 그대로다.
  // 이동하지 않는 적은 밀리지 않는다. 진행 중인 텔레그래프 칸은 그대로 둔다.
  // 오른쪽 적부터 밀어 나란히 선 적이 서로 막지 않게 한다.
  subwoofer: {
    node(game, e, state, def) {
      if (e.grade !== 'perfect' || e.drum !== 'kick') return;
      const alive = e.targets.filter((t) => !t.dead && !t.def.stationary).sort((a, b) => b.col - a.col);
      for (const enemy of alive) {
        const col = enemy.col + def.push;
        if (!Grid.inBounds(col, enemy.row) || game.isOccupied(col, enemy.row)) continue;
        enemy.moveTo(col, enemy.row, enemy.moveTimer);
      }
    },
  },

  // 짝 Perfect로 맞은 적의 상하좌우 적에게 그 노드 최종 데미지의 50%. 이 노드가 직접 맞힌 적은 제외하고,
  // 여러 대상에 인접한 적도 한 번만 맞는다.
  crash_cymbal: {
    node(game, e, state, def) {
      if (e.grade !== 'perfect' || e.drum !== 'snare' || !e.targets.length) return;
      const hit = new Set(e.targets);
      for (const target of e.targets) {
        for (const enemy of game.adjacentEnemies(target.col, target.row)) {
          if (hit.has(enemy)) continue;
          hit.add(enemy);
          game.burst(enemy.col, enemy.row, CONFIG.PARTICLES_RELIC);
          game.damageEnemy(enemy, e.damage * def.splash, 'crash');
        }
      }
    },
  },

  // 무기별로 연속 클리어한 웨이브를 센다. 웨이브 클리어 때 장착 중이던 무기만 +1이다.
  // 슬롯에서 빠진 무기의 카운트는 지운다. 턴테이블 전환은 교체가 아니다. 유물을 얻은 뒤부터 센다.
  rehearsal: {
    acquire(game, e, state) { state.counts = {}; },
    waveClear(game, e, state) {
      const kind = game.player.weaponKind;
      state.counts[kind] = (state.counts[kind] || 0) + 1;
    },
    weaponRemove(game, e, state) { delete state.counts[e.kind]; },
    damagePct: (game, ctx, state, def) => Math.min(def.maxPct, def.pctPerWave * (state.counts[ctx.weaponKind] || 0)),
  },

  // 장착한 적이 있는 서로 다른 무기 수. 유물을 얻은 순간 장착 중인 무기부터 센다.
  repertoire: {
    acquire(game, e, state) { state.used = new Set([game.player.weaponKind]); },
    weaponEquip(game, e, state) { state.used.add(e.kind); },
    damagePct: (game, ctx, state, def) => Math.min(def.maxPct, def.pctPerWeapon * state.used.size),
  },

  // 빈 범위를 친 Good 이상도 HIT로 센다. 쌓인 HIT의 추가 배율은 이후 적중에 그대로 붙는다.
  air_drum: {
    whiffHits: () => true,
  },

  // 적을 맞힌 Perfect를 웨이브마다 0부터 세어 8회마다 실드 +1. 실드는 다음 웨이브로 이어진다.
  metronome: {
    acquire(game, e, state) { state.perfects = 0; },
    waveStart(game, e, state) { state.perfects = 0; },
    node(game, e, state, def) {
      if (e.grade !== 'perfect' || !e.targets.length) return;
      state.perfects++;
      if (state.perfects % def.perfectsPerShield === 0) game.player.shield++;
    },
  },

  // 처치한 적의 상하좌우 적에게 그 적 최대 HP의 25%. 그 피해로 처치되면 다시 퍼진다 (같은 적은 한 번만 처치된다).
  sforzando: {
    enemyKill(game, e, state, def) {
      for (const enemy of game.adjacentEnemies(e.enemy.col, e.enemy.row)) {
        game.burst(enemy.col, enemy.row, CONFIG.PARTICLES_RELIC);
        game.damageEnemy(enemy, e.enemy.maxHp * def.maxHpRatio, 'sforzando');
      }
    },
  },

  // 이동에 성공하면 도착 칸 상하좌우의 적에게 고정 피해
  tap_dance: {
    playerMove(game, e, state, def) {
      for (const enemy of game.adjacentEnemies(e.to.col, e.to.row)) {
        game.burst(enemy.col, enemy.row, CONFIG.PARTICLES_RELIC);
        game.damageEnemy(enemy, def.damage, 'tap');
      }
    },
  },

  // 누른 순간이 가장 가까운 노드의 Perfect 윈도우 안인 이동은 링과 HIT를 유지한다. 이동 틱은 그대로다.
  // 그렇게 이동하면 다음 성공 노드(적을 맞힌 Good 이상) 데미지 x nextAttackMult. 링이 리셋되면 사라진다.
  walking_bass: {
    acquire(game, e, state) { state.bonus = false; },
    keepRingOnMove: (game, ctx) => ctx.onBeat,
    playerMove(game, e, state) { if (e.kept) state.bonus = true; },
    ringStop(game, e, state) { state.bonus = false; },
    damageMult: (game, ctx, state, def) => (state.bonus ? def.nextAttackMult : 1),
    node(game, e, state) { if (e.grade !== 'miss' && e.targets.length) state.bonus = false; },
  },

  // Perfect로 맞은 적의 진행 중인 텔레그래프를 지우고 복귀 단계로 보낸다
  counterpoint: {
    node(game, e) {
      if (e.grade !== 'perfect') return;
      for (const enemy of e.targets) if (!enemy.dead) game.cancelEnemyAttack(enemy);
    },
  },

  // 게이지가 차면 프리스타일 모드: 링이 멈추고 A/S를 누를 때마다 플레이어 오른쪽 칸들을 박자 없이 공격한다.
  // 모드 중에는 노드 판정이 없으므로 Perfect·HIT 기반 유물은 발동하지 않는다. 처치 이벤트는 발동한다.
  // 게이지가 0이 되면 링을 새로 시작한다 (새 사이클, HIT 0).
  freestyle: {
    acquire(game, e, state) {
      state.gauge = 0;
      state.active = false;
      state.cooldown = 0;
    },
    remove(game, e, state) { if (state.active) game.player.resumeRing(); },
    node(game, e, state, def) {
      if (state.active || e.grade === 'miss' || !(e.targets.length || e.whiff)) return;
      const nodes = game.player.weapon.intervals.length;
      state.gauge = Math.min(def.gaugeMax, state.gauge + def.gaugeMax / (nodes * def.chargeCycles));
      if (state.gauge >= def.gaugeMax - 1e-9) {
        state.gauge = def.gaugeMax;
        state.active = true;
        state.cooldown = 0;
        game.player.pauseRing();
      }
    },
    update(game, e, state, def) {
      if (!state.active) return;
      state.cooldown = tickDown(state.cooldown, e.dt);
      state.gauge -= def.drainPerSec * e.dt;
      if (state.gauge <= 1e-9) RELIC_LOGIC.freestyle.end(game, state);
    },
    waveClear(game, e, state) { if (state.active) RELIC_LOGIC.freestyle.end(game, state); },
    end(game, state) {
      state.active = false;
      state.gauge = 0;
      game.player.resumeRing();
    },
    attackInput(game, ctx, state, def) {
      if (!state.active) return false;
      if (state.cooldown > 0) return true;
      state.cooldown = def.cooldown;
      const player = game.player;
      const cells = def.cells.map(([dc, dr]) => ({ col: player.col + dc, row: player.row + dr }))
        .filter((c) => Grid.inBounds(c.col, c.row));
      const targets = cells.map((c) => game.enemyAt(c.col, c.row)).filter(Boolean);
      const base = player.weapon.damages.reduce((sum, v) => sum + v, 0) / def.damageDivisor * def.damageMult;
      const damage = base * (1 + Relics.sum(game, 'damagePct', {
        drum: ctx.drum, beat: null, weaponKind: player.weaponKind, grade: null, hits: 0, freestyle: true,
      }));
      Sfx.play('good');
      if (cells.length) game.ringBursts.push({ cells, gap: 0, grade: 'good', drum: ctx.drum, age: 0 });
      if (targets.length) game.hitStop = CONFIG.HITSTOP_GOOD;
      for (const target of targets) {
        game.burst(target.col, target.row, CONFIG.PARTICLES_RELIC);
        game.damageEnemy(target, damage, 'freestyle');
      }
      return true;
    },
  },

  // 무기 슬롯 2개. 숫자키 전환(game.updateWeaponSwitch)은 교체가 아니며 링을 다시 시작한다.
  // 전환 후 첫 성공 노드(적을 맞힌 Good 이상) 데미지 x switchMult. 이동으로 링이 리셋되면 사라진다.
  // 유물을 잃으면 장착 중인 무기만 남는다.
  turntable: {
    acquire(game, e, state) { state.pending = false; },
    remove(game) {
      const player = game.player;
      for (const kind of player.weapons.filter((k) => k !== player.weaponKind)) game.emit('weaponRemove', { kind });
      player.weapons = [player.weaponKind];
    },
    weaponSlots: (game, ctx, state, def) => def.slots,
    weaponSwitch(game, e, state) { state.pending = true; },
    ringStop(game, e, state) { state.pending = false; },
    damageMult: (game, ctx, state, def) => (state.pending ? def.switchMult : 1),
    node(game, e, state) { if (e.grade !== 'miss' && e.targets.length) state.pending = false; },
  },

  // 공격 범위 대신 맨해튼 거리로 가장 가까운 적의 칸 1x1을 친다. 동률이면 플레이어와 같은 행, 그다음 위쪽,
  // 그다음 오른쪽 칸이다. 범위는 매번 다시 계산하므로 링도 그 칸에 그려지고 판정 순간의 칸을 맞힌다.
  // 적이 없으면 범위가 없다. 노드 데미지 x damageMult.
  quantize: {
    attackCells(game) {
      const player = game.player;
      let best = null;
      let bestScore = null;
      for (const enemy of game.enemies) {
        const score = [
          Math.abs(enemy.col - player.col) + Math.abs(enemy.row - player.row),
          enemy.row === player.row ? 0 : 1,
          enemy.row,
          -enemy.col,
        ];
        if (!best || lexLess(score, bestScore)) {
          best = enemy;
          bestScore = score;
        }
      }
      return best ? [{ col: best.col, row: best.row }] : [];
    },
    damageMult: (game, ctx, state, def) => def.damageMult,
  },

  // 한 사이클의 모든 노드가 적을 맞힌 Perfect면 마지막 노드에서 모든 적과 텔레그래프를 freezeTime초 멈춘다
  fermata: {
    node(game, e, state, def) {
      if (e.grade !== 'perfect' || !e.targets.length || !game.cycle) return;
      if (game.cycle.perfectHits === game.cycle.nodes) game.freezeTimer = def.freezeTime;
    },
  },

  // Good 이상이고 HIT가 minHit 이상인 노드마다 무작위 적 하나를 범위와 상관없이 추가로 때린다.
  // 데미지는 그 노드의 기본 데미지 x damageRatio (판정·HIT·유물 배율 없음). 에어 드럼으로 센 빈 범위 노드도 발동한다.
  crescendo: {
    node(game, e, state, def) {
      if (e.grade === 'miss' || e.hits < def.minHit || !game.enemies.length) return;
      const enemy = pickRandom(game.enemies);
      game.burst(enemy.col, enemy.row, CONFIG.PARTICLES_RELIC);
      game.damageEnemy(enemy, game.player.weapon.damages[e.beat] * def.damageRatio, 'crescendo');
    },
  },
};

const Relics = {
  has(game, id) {
    return game.relics.includes(id);
  },

  // 보유 유물마다 (함수, 상태, 정의)로 fn을 부른다. 슬롯 순서다.
  each(game, hook, fn) {
    for (const id of game.relics.slice()) {
      const handler = RELIC_LOGIC[id] && RELIC_LOGIC[id][hook];
      if (handler && game.relics.includes(id)) fn(handler, game.relicState[id], CONFIG.RELICS[id], id);
    }
  },

  emit(game, event, data) {
    this.each(game, event, (handler, state, def) => handler(game, data, state, def));
  },

  sum(game, hook, ctx) {
    let total = 0;
    this.each(game, hook, (handler, state, def) => { total += handler(game, ctx, state, def) || 0; });
    return total;
  },

  product(game, hook, ctx) {
    let total = 1;
    this.each(game, hook, (handler, state, def) => { total *= handler(game, ctx, state, def) ?? 1; });
    return total;
  },

  any(game, hook, ctx = {}) {
    let result = false;
    this.each(game, hook, (handler, state, def) => { if (!result && handler(game, ctx, state, def)) result = true; });
    return result;
  },

  // 처음으로 null이 아닌 값을 돌려준 유물의 값
  first(game, hook, ctx = {}) {
    let result = null;
    this.each(game, hook, (handler, state, def) => {
      if (result === null) {
        const value = handler(game, ctx, state, def);
        if (value !== null && value !== undefined) result = value;
      }
    });
    return result;
  },

  max(game, hook, ctx, fallback) {
    let result = fallback;
    this.each(game, hook, (handler, state, def) => { result = Math.max(result, handler(game, ctx, state, def)); });
    return result;
  },

  // slot이 있으면 그 칸의 유물과 바꾼다. 없으면 빈 칸 중 가장 왼쪽에 넣는다.
  add(game, id, slot = null) {
    if (this.has(game, id)) return;
    if (slot !== null && game.relics[slot]) this.remove(game, game.relics[slot], true);
    game.relicState[id] = {};
    if (slot !== null && slot <= game.relics.length) game.relics.splice(slot, 0, id);
    else game.relics.push(id);
    const handler = RELIC_LOGIC[id] && RELIC_LOGIC[id].acquire;
    if (handler) handler(game, {}, game.relicState[id], CONFIG.RELICS[id]);
  },

  remove(game, id) {
    if (!this.has(game, id)) return;
    const handler = RELIC_LOGIC[id] && RELIC_LOGIC[id].remove;
    if (handler) handler(game, {}, game.relicState[id], CONFIG.RELICS[id]);
    game.relics = game.relics.filter((r) => r !== id);
    delete game.relicState[id];
  },

  // 보유하지 않은 유물 RELIC_CHOICES개. 카드마다 등급을 가중치로 뽑고 그 등급에서 하나를 고른다.
  // 에픽은 RELIC_EPIC_UNLOCK_WAVE부터 나온다. 남은 유물이 없는 등급은 뽑지 않는다.
  draw(game) {
    const owned = (id) => game.relics.includes(id);
    const rarities = Object.keys(CONFIG.RELIC_RARITY_WEIGHTS)
      .filter((r) => r !== 'epic' || game.wave >= CONFIG.RELIC_EPIC_UNLOCK_WAVE);
    const chosen = [];
    while (chosen.length < CONFIG.RELIC_CHOICES) {
      const left = (r) => Object.keys(CONFIG.RELICS).filter((id) => CONFIG.RELICS[id].rarity === r && !owned(id) && !chosen.includes(id));
      const open = rarities.filter((r) => left(r).length);
      if (!open.length) break;
      let roll = Math.random() * open.reduce((sum, r) => sum + CONFIG.RELIC_RARITY_WEIGHTS[r], 0);
      let rarity = open[open.length - 1];
      for (const r of open) {
        roll -= CONFIG.RELIC_RARITY_WEIGHTS[r];
        if (roll < 0) { rarity = r; break; }
      }
      chosen.push(pickRandom(left(rarity)));
    }
    return chosen;
  },
};
