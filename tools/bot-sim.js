// 봇 시뮬레이션. 게임 스크립트를 그대로 불러 화면 없이 60Hz 스텝으로 돌린다. 게임 스크립트가 아니며 HTML과 웹 링크에 넣지 않는다.
//
// 봇 규칙
// - 공격: 리듬마다 정규분포(표준편차 TIMING_SD) 오차로 키를 누른다. 누르는 순간 그 리듬 범위에 적이 있을 때만 친다.
// - 회피: 자기 칸이 적 공격 예고(돌진 예고 칸 포함)에 덮이면, 이동할 수 있는 대로 가장 가까운 예고 밖 칸
//   (거리가 같으면 한 사이클 기대 데미지가 큰 칸)으로 간다. 인접 칸이 모두 예고 칸이면 그 칸들을 지나 두 칸 이상 피한다.
// - 위치: 그 밖에는 예고 칸과 적을 피해 갈 수 있는 칸 중 한 사이클 기대 데미지가 지금 칸보다 큰 칸이 있으면 그쪽으로 한 칸씩 간다.
// - 보상: 무기 보상은 항상 '지금 무기 유지', 유물 선택은 항상 '건너뛰기'. 유물 없이 한 무기로 끝까지 간다.
//
// 기록: 판마다 도달 웨이브와 사망 원인, 웨이브마다 처치 시간(스폰부터 보상 화면까지), 적 종류별 등장 수와 깎은 HP.

const SIM = {
  DT: 1 / 60,
  TIMING_SD: 0.035,       // 입력 오차 표준편차(초)
  WAVE_TIME_LIMIT: 120,   // 한 웨이브가 이보다 길면 막힌 것으로 보고 그 판을 끝낸다 (stuck)
  CHUNK_MS: 40,           // 한 번에 돌리는 시간. 페이지가 멈추지 않도록 나눠 돈다.
};

// 로그를 남기지 않는다 (저장소에 시뮬레이션 판이 쌓이지 않게)
for (const name of Object.keys(Logger)) {
  if (typeof Logger[name] === 'function') Logger[name] = () => {};
}

function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

const ARROWS = { '-1,0': 'ArrowLeft', '1,0': 'ArrowRight', '0,-1': 'ArrowUp', '0,1': 'ArrowDown' };

class Bot {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.presses = [];       // { time, beat, drum }
    this.scheduledRing = -1; // 마지막으로 입력을 예약한 링 번호
  }

  // 적 공격 예고에 덮인 칸들 (근접·발사체·던지기 예고와 돌진 예고)
  dangerCells() {
    const game = this.game;
    const set = new Set();
    for (const t of game.telegraphs) for (const c of t.cells) set.add(`${c.col},${c.row}`);
    for (const e of game.enemies) if (e.dash) for (const c of e.dash.shown) set.add(`${c.col},${c.row}`);
    return set;
  }

  // (col, row)에 서 있을 때 한 사이클 동안 줄 수 있는 데미지의 기대값 (적 수 x 리듬 데미지)
  expectedDamage(col, row) {
    const { game } = this;
    const weapon = game.player.weapon;
    let total = 0;
    weapon.intervals.forEach((_, beat) => {
      const cells = weaponRangeCells(weapon, beat, col, row, CONFIG.GRID_COLS - 1).filter((c) => Grid.inBounds(c.col, c.row));
      let count = cells.filter((c) => game.enemyAt(c.col, c.row)).length;
      if (weaponFirstTargetOnly(weapon, beat)) count = Math.min(1, count);
      total += count * weapon.damages[beat];
    });
    return total;
  }

  // 이번 스텝의 입력을 정한다. 다음 스텝이 대표하는 시각은 this.time + DT다.
  decide() {
    const { game } = this;
    const player = game.player;
    const now = this.time + SIM.DT;
    Input.pressedNow = {};
    Input.shiftNow = {};

    // 공격 입력 예약: 다음 리듬마다 한 번
    if (!player.ringActive) {
      this.presses = [];
      this.scheduledRing = -1;
    } else if (player.ringCycles !== this.scheduledRing) {
      this.scheduledRing = player.ringCycles;
      this.presses.push({
        time: this.time + player.timeToNextBeat + gauss() * SIM.TIMING_SD,
        beat: player.beatIndex,
        drum: player.weapon.drums[player.beatIndex],
      });
    }
    this.presses = this.presses.filter((p) => {
      if (p.time > now) return true;
      const hasEnemy = player.attackCells(p.beat).some((c) => game.enemyAt(c.col, c.row));
      const code = CONFIG.DRUM_KEYS[p.drum];
      if (hasEnemy && Input.pressedNow[code] === undefined) Input.pressedNow[code] = Math.min(now - p.time, CONFIG.MAX_INPUT_AGE);
      return false;
    });

    // 이동: 이동할 수 있을 때만 정한다
    if (player.moveTimer > SIM.DT || player.bufferedMove) return;
    const danger = this.dangerCells();
    const free = (c, r) => Grid.inBounds(c, r) && !game.enemyAt(c, r);
    const here = `${player.col},${player.row}`;
    let step = null;
    if (danger.has(here)) {
      // 예고 칸을 지나서라도 가장 가까운 안전 칸으로 간다. 거리가 같으면 기대 데미지가 큰 칸이다.
      const firstStep = new Map([[here, null]]);
      const queue = [{ col: player.col, row: player.row, d: 0 }];
      let best = null;
      for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        if (best && node.d > best.d) break;
        for (const key of Object.keys(ARROWS)) {
          const [dc, dr] = key.split(',').map(Number);
          const c = node.col + dc;
          const r = node.row + dr;
          if (firstStep.has(`${c},${r}`) || !free(c, r)) continue;
          const first = firstStep.get(`${node.col},${node.row}`) || key;
          firstStep.set(`${c},${r}`, first);
          queue.push({ col: c, row: r, d: node.d + 1 });
          if (danger.has(`${c},${r}`)) continue;
          const value = this.expectedDamage(c, r);
          if (!best || (node.d + 1 === best.d && value > best.value)) best = { d: node.d + 1, value, first };
        }
      }
      step = best ? best.first : null;
    } else {
      // 예고 칸과 적을 피해 갈 수 있는 칸 중 기대 데미지가 가장 큰 칸으로 가는 첫 걸음
      const current = this.expectedDamage(player.col, player.row);
      const blocked = (c, r) => !free(c, r) || danger.has(`${c},${r}`);
      const firstStep = new Map([[here, null]]);
      const queue = [{ col: player.col, row: player.row }];
      let best = current;
      for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        for (const key of Object.keys(ARROWS)) {
          const [dc, dr] = key.split(',').map(Number);
          const c = node.col + dc;
          const r = node.row + dr;
          if (firstStep.has(`${c},${r}`) || blocked(c, r)) continue;
          const first = firstStep.get(`${node.col},${node.row}`) || key;
          firstStep.set(`${c},${r}`, first);
          queue.push({ col: c, row: r });
          const value = this.expectedDamage(c, r);
          if (value > best) { best = value; step = first; }
        }
      }
    }
    if (step) Input.pressedNow[ARROWS[step]] = 0;
  }
}

// 한 판을 돌린다. 끝나면 판 기록을 돌려주는 제너레이터 (나눠 돌리기 위해)
function* runOne(weaponKind, targetWaves) {
  const game = new Game();
  const bot = new Bot(game);
  const record = {
    weapon: weaponKind, tier: CONFIG.WEAPONS[weaponKind].tier,
    reachedWave: 0, died: false, stuck: false, deathKind: null,
    waves: [], spawns: {}, hpLost: {}, hitsTaken: {},
  };
  // 피격 기록: 실제로 깎인 HP를 적 종류별로 센다
  const hurt = game.hurtPlayer.bind(game);
  game.hurtPlayer = (amount, kind) => {
    const before = game.player.hp;
    hurt(amount, kind);
    const lost = before - game.player.hp;
    record.hitsTaken[kind] = (record.hitsTaken[kind] || 0) + 1;
    record.hpLost[kind] = (record.hpLost[kind] || 0) + lost;
    if (game.player.hp === 0) record.deathKind = kind;
  };
  game.startRun(weaponKind);
  let wave = 0;
  let waveStart = 0;
  let steps = 0;
  while (true) {
    if (game.wave !== wave) {
      wave = game.wave;
      waveStart = bot.time;
      for (const e of game.enemies) record.spawns[e.kind] = (record.spawns[e.kind] || 0) + 1;
    }
    if (game.state === 'gameover') {
      record.died = true;
      record.waves.push({ wave, cleared: false, seconds: bot.time - waveStart });
      break;
    }
    if (game.state === 'reward' || game.state === 'pick') {
      record.waves.push({ wave, cleared: true, seconds: bot.time - waveStart });
      if (wave >= targetWaves) break;
      // 화면 입력 잠금을 기다리지 않고 바로 고른다
      if (game.state === 'pick') {
        const skip = game.picker.cards.findIndex((c) => c.skip);
        game.pickCard(skip >= 0 ? skip : game.picker.cards.length - 1);
      }
      if (game.state === 'reward') game.selectReward(game.rewardCards.length - 1);
      continue;
    }
    if (bot.time - waveStart > SIM.WAVE_TIME_LIMIT) {
      record.stuck = true;
      // 막힌 원인을 보려고 남은 적의 상태를 남긴다
      record.stuckEnemies = game.enemies.map((e) => `${e.kind}:${e.phase}${e.hidden ? '(숨음)' : ''}@${e.col},${e.row}`);
      record.stuckPlayer = `${game.player.col},${game.player.row}`;
      record.waves.push({ wave, cleared: false, seconds: bot.time - waveStart });
      break;
    }
    bot.decide();
    game.update(SIM.DT);
    bot.time += SIM.DT;
    if (++steps % 600 === 0) yield null;
  }
  record.reachedWave = wave;
  return record;
}

// 여러 판을 나눠 돌린다. onProgress(끝난 판 수, 전체)
function runBatch(weaponKinds, runsPerWeapon, targetWaves, onProgress) {
  const jobs = [];
  for (const kind of weaponKinds) for (let i = 0; i < runsPerWeapon; i++) jobs.push(kind);
  const records = [];
  return new Promise((resolve) => {
    let current = null;
    function tick() {
      const until = performance.now() + SIM.CHUNK_MS;
      while (performance.now() < until) {
        if (!current) {
          if (!jobs.length) {
            resolve(records);
            return;
          }
          current = runOne(jobs.shift(), targetWaves);
        }
        const r = current.next();
        if (r.done) {
          records.push(r.value);
          current = null;
          onProgress(records.length, records.length + jobs.length + 1);
        }
      }
      channel.port2.postMessage(null);
    }
    // 페이지가 가려져도 setTimeout처럼 느려지지 않도록 MessageChannel로 다음 조각을 예약한다
    const channel = new MessageChannel();
    channel.port1.onmessage = tick;
    tick();
  });
}

// ---------------------------------------------------------------- 요약

const avg = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : null);
const fmt = (v, d = 1) => (v === null || v === undefined ? '-' : v.toFixed(d));
const pct = (v) => (v === null ? '-' : `${Math.round(v * 100)}%`);

function summarize(records, targetWaves) {
  const byTier = {};
  for (const r of records) (byTier[r.tier] = byTier[r.tier] || []).push(r);
  const tiers = Object.keys(byTier).sort().map((tier) => {
    const list = byTier[tier];
    const cleared = list.flatMap((r) => r.waves.filter((w) => w.cleared).map((w) => w.seconds));
    return {
      tier: Number(tier), runs: list.length,
      clearSeconds: avg(cleared),
      deathRate: list.filter((r) => r.died || r.stuck).length / list.length,
      avgReached: avg(list.map((r) => r.reachedWave)),
    };
  });

  const stageCount = Math.ceil(targetWaves / CONFIG.STAGE_WAVES);
  const stages = [];
  for (let s = 1; s <= stageCount; s++) {
    const lo = (s - 1) * CONFIG.STAGE_WAVES + 1;
    const hi = s * CONFIG.STAGE_WAVES;
    const waves = records.flatMap((r) => r.waves.filter((w) => w.wave >= lo && w.wave <= hi));
    const entered = records.filter((r) => r.reachedWave >= lo).length;
    const deaths = records.filter((r) => (r.died || r.stuck) && r.reachedWave >= lo && r.reachedWave <= hi).length;
    stages.push({
      stage: s, entered, deaths, deathRate: entered ? deaths / entered : null,
      clearSeconds: avg(waves.filter((w) => w.cleared).map((w) => w.seconds)),
    });
  }

  const enemies = Object.keys(CONFIG.ENEMIES).map((kind) => {
    const spawns = records.reduce((s, r) => s + (r.spawns[kind] || 0), 0);
    const hp = records.reduce((s, r) => s + (r.hpLost[kind] || 0), 0);
    const hits = records.reduce((s, r) => s + (r.hitsTaken[kind] || 0), 0);
    const deaths = records.filter((r) => r.deathKind === kind).length;
    return { kind, name: CONFIG.ENEMIES[kind].name, firstWave: CONFIG.ENEMIES[kind].firstWave, spawns, hp, hits,
      hpPerSpawn: spawns ? hp / spawns : null, hitRate: spawns ? hits / spawns : null, deaths };
  });

  return {
    runs: records.length, targetWaves,
    stuck: records.filter((r) => r.stuck).length,
    deathRate: records.filter((r) => r.died || r.stuck).length / records.length,
    tiers, stages, enemies,
  };
}

function table(headers, rows) {
  const head = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  return `<table>${head}${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>`;
}

function renderSummary(s) {
  return [
    `<p>${s.runs}판, 목표 ${s.targetWaves}웨이브 · 사망률 ${pct(s.deathRate)} · 막힘 ${s.stuck}판</p>`,
    '<h2>티어별</h2>',
    table(['티어', '판', '처치 시간', '사망률', '평균 도달 웨이브'],
      s.tiers.map((t) => [t.tier, t.runs, fmt(t.clearSeconds), pct(t.deathRate), fmt(t.avgReached)])),
    '<h2>스테이지별</h2>',
    table(['스테이지', '진입 판', '사망', '사망률', '처치 시간'],
      s.stages.map((t) => [t.stage, t.entered, t.deaths, pct(t.deathRate), fmt(t.clearSeconds)])),
    '<h2>적별</h2>',
    table(['적', '첫 웨이브', '등장', '깎은 HP', '등장당 HP', '등장당 적중', '사망 원인'],
      s.enemies.map((e) => [e.name, e.firstWave, e.spawns, e.hp, fmt(e.hpPerSpawn, 2), fmt(e.hitRate, 2), e.deaths])),
  ].join('');
}

// ---------------------------------------------------------------- 페이지

const SimPage = {
  last: null,       // 마지막 요약
  records: null,    // 마지막 판 기록
  running: false,
  jobs: [],         // 동기 실행용 남은 판 (queue / step)

  // 페이지가 가려져 있으면 run의 예약 실행이 크게 느려진다. 그때는 queue로 판을 쌓고
  // step(밀리초)을 여러 번 불러 동기로 나눠 돌린 뒤 summary()로 요약한다 (Claude가 내장 브라우저에서 쓰는 방법).
  queue({ weapon = 'all', runs = 10, waves = 21 } = {}) {
    const kinds = weapon === 'all' ? Object.keys(CONFIG.WEAPONS) : [weapon];
    this.jobs = [];
    for (const kind of kinds) for (let i = 0; i < runs; i++) this.jobs.push(kind);
    this.records = [];
    this.waves = waves;
    return this.jobs.length;
  },

  step(budgetMs = 20000) {
    const until = performance.now() + budgetMs;
    while (this.jobs.length && performance.now() < until) {
      const run = runOne(this.jobs.shift(), this.waves);
      let r;
      while (!(r = run.next()).done);
      this.records.push(r.value);
    }
    return { done: this.records.length, left: this.jobs.length };
  },

  summary() {
    this.last = summarize(this.records, this.waves);
    document.getElementById('result').innerHTML = renderSummary(this.last);
    return this.last;
  },

  async run({ weapon = 'all', runs = 10, waves = 21 } = {}) {
    if (this.running) return null;
    this.running = true;
    const kinds = weapon === 'all' ? Object.keys(CONFIG.WEAPONS) : [weapon];
    const status = document.getElementById('status');
    const started = performance.now();
    const records = await runBatch(kinds, runs, waves, (done, total) => {
      status.textContent = `${done} / ${total}판`;
    });
    this.records = records;
    this.last = summarize(records, waves);
    status.textContent = `완료 (${((performance.now() - started) / 1000).toFixed(1)}초)`;
    document.getElementById('result').innerHTML = renderSummary(this.last);
    this.running = false;
    return this.last;
  },
};

(function setupPage() {
  const select = document.getElementById('weapon');
  for (const [kind, w] of Object.entries(CONFIG.WEAPONS)) {
    const option = document.createElement('option');
    option.value = kind;
    option.textContent = `${w.tier}티어 ${w.name}`;
    select.appendChild(option);
  }
  document.getElementById('start').addEventListener('click', () => {
    SimPage.run({
      weapon: select.value,
      runs: Number(document.getElementById('runs').value) || 10,
      waves: Number(document.getElementById('waves').value) || 21,
    });
  });
})();
