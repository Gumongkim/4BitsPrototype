// 적 제작 툴. 적의 HP·공격력과 행동 상태(Idle, Attack 추적, Attack 시행, 복귀)를 정하고,
// 그리드에서 한 사이클을 시연하고, 체크한 적을 JSON으로 내보내거나 다시 불러온다.
// 게임(../)과 같은 규칙으로 file:// 에서 돌아가며 외부 라이브러리를 쓰지 않는다.

'use strict';

const TOOL = {
  // 그리드: 게임과 같은 8열 x 4행. 플레이어·적의 처음 위치이자 내보내기 그림의 기준이다.
  COLS: 8,
  ROWS: 4,
  PLAYER_COL: 1,
  PLAYER_ROW: 1,
  ENEMY_COL: 5,
  ENEMY_ROW: 1,
  CELL: 64,                     // 화면에 그리는 칸 크기 (CSS 픽셀)
  FIELD_PAD: 28,                // 좌표 눈금을 쓰는 여백

  // 새 적의 기본값. 게임의 근접 적과 같다.
  DEFAULT_HP: 4.5,
  DEFAULT_DAMAGE: 2,
  DEFAULT_IDLE_DURATION: 5.5,
  DEFAULT_IDLE_INTERVAL: 3,
  DEFAULT_TICK: 0.5,
  DEFAULT_CELLS_PER_MOVE: 2,
  DEFAULT_VANISH: 0.8,
  DEFAULT_TELEGRAPH: 0.6,
  DEFAULT_GAP: 0.3,
  DEFAULT_DASH_CELLS: 7,        // 돌진 최대 거리 (칸). 7이면 그리드 끝까지
  DEFAULT_DASH_TICK: 0.15,      // 돌진 칸당 시간
  DEFAULT_ATTACK_CELLS: [[-1, 0]], // 적 왼쪽 1칸
  DEFAULT_HOME_COLS: 4,         // 복귀 목표 기본값: 오른쪽에서 몇 개 열인지

  MIN_TIME: 0.05,               // 예고시간·이동 틱의 하한
  MIN_HP: 0.25,
  MIN_INTERVAL: 0.1,

  // 시연
  DEMO_MAX_DT: 0.05,            // 탭이 멈췄다 돌아와도 한 번에 크게 건너뛰지 않게 한다
  IMPACT_TIME: 0.18,            // 공격 실행 순간의 번쩍임

  STORAGE_KEY: '4bit-enemy-tool.v1',
};

const COLORS = {
  cellA: '#1c2030',
  cellB: '#20253a',
  gridLine: '#2c3350',
  player: '#5fd38d',
  playerDark: '#2f8a58',
  enemy: '#ff7a6b',
  enemyDark: '#a83a32',
  text: '#e8ecf5',
  dim: '#8a93ad',
  outline: '#0b0d14',
  attack: '#ff4d4d',
  flash: '#fff2d0',
  target: '#4aa8ff',
  manual: '#ffc14d',
  home: '#35d6c0',
  obstacle: '#59617f',
  obstacleDark: '#3a4160',
};

// 공격 종류. blocked: 경로의 적·장애물에 막힌다. anchor: 범위의 기준 칸.
const KINDS = {
  melee: { label: '근접', blocked: false, anchor: 'enemy', info: '적 칸 기준 범위. 사이에 무엇이 있어도 범위 칸을 그대로 맞힙니다.' },
  projectile: { label: '발사체', blocked: true, anchor: 'enemy', info: '적 칸 기준 범위. 적에서 대상 칸까지의 경로에 적이나 장애물이 있으면 막힙니다.' },
  throw: { label: '던지기', blocked: false, anchor: 'player', info: '공격 시작 시점의 플레이어 칸 기준 범위. 위치 제한이 없고 막히지 않습니다.' },
  dash: { label: '돌진', blocked: true, anchor: 'enemy', info: '예고가 시작될 때 플레이어 쪽으로 방향을 정하고 예고시간 뒤 일정한 속도로 일직선 돌진합니다. 경로의 각 칸은 적이 들어가기 예고시간 전부터 순서대로 보입니다(개수 제한 없음). 플레이어에 닿으면 그 앞에서 멈추며 피해를 주고, 장애물·그리드 끝·최대 거리에서도 멈춥니다. 돌진이 끝난 칸이 적의 새 위치입니다.' },
};

const STATE_LABELS = { idle: 'Idle', chase: 'Attack 추적', attack: 'Attack 시행', retreat: '복귀' };

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- 상태와 저장

let state = loadState() || freshState();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultHomeCells() {
  const cells = [];
  for (let col = TOOL.COLS - TOOL.DEFAULT_HOME_COLS; col < TOOL.COLS; col++) {
    for (let row = 0; row < TOOL.ROWS; row++) cells.push([col, row]);
  }
  return cells;
}

function makeAttack(cells) {
  return {
    id: uid(),
    kind: 'melee',
    cells,
    telegraph: TOOL.DEFAULT_TELEGRAPH,
    gap: TOOL.DEFAULT_GAP,
    dashCells: TOOL.DEFAULT_DASH_CELLS, // 돌진에서만 쓴다
    dashTick: TOOL.DEFAULT_DASH_TICK,
  };
}

function makeWork(name) {
  return {
    id: uid(),
    name,
    checked: true,
    hp: TOOL.DEFAULT_HP,
    damage: TOOL.DEFAULT_DAMAGE,
    idle: { moves: true, interval: TOOL.DEFAULT_IDLE_INTERVAL, duration: TOOL.DEFAULT_IDLE_DURATION },
    chase: {
      // 이동목표는 1타 범위에서 자동 계산한 칸에서 off를 빼고 on을 더한 것이다.
      off: [],
      on: [],
      refresh: true,            // true면 이동할 때마다 이동목표를 다시 고르고, false면 추적 시작 때 고른 칸으로 간다
      method: 'shortest',
      step: 'all',
      n: TOOL.DEFAULT_CELLS_PER_MOVE,
      tick: TOOL.DEFAULT_TICK,
      vanish: TOOL.DEFAULT_VANISH,
    },
    attacks: [makeAttack(TOOL.DEFAULT_ATTACK_CELLS.map((c) => [...c]))],
    retreat: { home: defaultHomeCells(), tick: TOOL.DEFAULT_TICK },
    game: null,                 // 게임 등록 정보(key, family, firstWave). 불러온 파일에 있으면 그대로 돌려준다.
  };
}

function startPlayer() {
  return { col: TOOL.PLAYER_COL, row: TOOL.PLAYER_ROW };
}

function startEnemy() {
  return { col: TOOL.ENEMY_COL, row: TOOL.ENEMY_ROW };
}

function freshState() {
  const work = makeWork('적 1');
  return {
    works: [work],
    currentId: work.id,
    tab: 'idle',
    chaseView: 'target',
    attackIndex: 0,
    // 아래는 모든 적에 공통인 화면 설정이며 내보내기에 들어가지 않는다.
    player: startPlayer(),
    enemy: startEnemy(),
    obstacles: [],
    obstacleMode: false,
  };
}

function inGrid(col, row) {
  return col >= 0 && col < TOOL.COLS && row >= 0 && row < TOOL.ROWS;
}

function isPos(p) {
  return !!p && Number.isInteger(p.col) && Number.isInteger(p.row) && inGrid(p.col, p.row);
}

// 브라우저 저장소는 막혀 있을 수 있으므로 실패해도 툴은 그대로 동작한다.
function loadState() {
  try {
    const raw = localStorage.getItem(TOOL.STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.works) || !data.works.length) return null;
    if (!data.works.some((w) => w.id === data.currentId)) data.currentId = data.works[0].id;
    if (!STATE_LABELS[data.tab]) data.tab = 'idle';
    if (data.chaseView !== 'method') data.chaseView = 'target';
    if (!Number.isInteger(data.attackIndex)) data.attackIndex = 0;
    if (!isPos(data.player)) data.player = startPlayer();
    if (!isPos(data.enemy)) data.enemy = startEnemy();
    if (samePos(data.player, data.enemy)) { data.player = startPlayer(); data.enemy = startEnemy(); }
    if (!Array.isArray(data.obstacles)) data.obstacles = [];
    data.obstacles = data.obstacles.filter((o) => isPos(o) && !samePos(o, data.player) && !samePos(o, data.enemy));
    data.obstacleMode = false;
    // 이전 버전에서 저장한 작업에 새 항목의 기본값을 채운다
    for (const work of data.works) {
      if (typeof work.chase.refresh !== 'boolean') work.chase.refresh = true;
      for (const attack of work.attacks) {
        if (!Number.isInteger(attack.dashCells)) attack.dashCells = TOOL.DEFAULT_DASH_CELLS;
        if (!Number.isFinite(attack.dashTick)) attack.dashTick = TOOL.DEFAULT_DASH_TICK;
      }
    }
    return data;
  } catch (e) {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(TOOL.STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // 저장하지 못해도 이번 세션 동안은 계속 쓸 수 있다
  }
}

function currentWork() {
  return state.works.find((w) => w.id === state.currentId);
}

function currentAttack() {
  const work = currentWork();
  state.attackIndex = Math.max(0, Math.min(work.attacks.length - 1, state.attackIndex));
  return work.attacks[state.attackIndex];
}

function samePos(a, b) {
  return a.col === b.col && a.row === b.row;
}

function hasCell(list, dc, dr) {
  return list.some(([c, r]) => c === dc && r === dr);
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

// 편집 후 공통 처리. 시연 중이면 바뀐 값으로 처음부터 다시 한다.
function changed() {
  saveState();
  if (demo.running) demo.start();
  renderList();
  renderPanel();
}

// ---------------------------------------------------------------- 규칙 계산

function isThrowFirst(work) {
  return work.attacks[0].kind === 'throw';
}

// 1타 범위로 자동 계산한 이동목표. 플레이어 칸 기준 [열 차이, 행 차이]이다.
// 적이 그 칸에 서면 1타 범위가 플레이어 칸에 닿는다. 범위가 적 기준 (a, b)면 목표는 (-a, -b)다.
// 1타가 돌진이면 플레이어 행에서 돌진으로 닿는 거리(최대 거리 + 1칸)의 양옆 칸이다.
function autoTargets(work) {
  const first = work.attacks[0];
  if (first.kind === 'throw') return [];
  if (first.kind === 'dash') {
    const targets = [];
    for (let d = 1; d <= Math.min(first.dashCells + 1, TOOL.COLS - 1); d++) targets.push([d, 0], [-d, 0]);
    return targets;
  }
  return first.cells.map(([dc, dr]) => [-dc, -dr]);
}

// 돌진 방향. 같은 행이면 가로, 같은 열이면 세로로 플레이어를 향하고, 둘 다 아니면 플레이어 쪽 가로다.
function dashDirection(from, to) {
  const dc = Math.sign(to.col - from.col);
  const dr = Math.sign(to.row - from.row);
  if (dr === 0 || dc !== 0) return { col: dc || -1, row: 0 };
  return { col: 0, row: dr };
}

// 돌진이 지날 칸들과 플레이어에 닿는지. blocked(칸)이면 그 앞에서 멈춘다.
function dashPath(attack, from, player, blocked) {
  const dir = dashDirection(from, player);
  const cells = [];
  let pos = from;
  for (let step = 0; step <= attack.dashCells; step++) {
    const next = { col: pos.col + dir.col, row: pos.row + dir.row };
    if (samePos(next, player)) return { cells, dir, hit: true };
    if (step === attack.dashCells || !inGrid(next.col, next.row) || blocked(next)) break;
    cells.push(next);
    pos = next;
  }
  return { cells, dir, hit: false };
}

function effectiveTargets(work) {
  if (isThrowFirst(work)) return [];
  const { off, on } = work.chase;
  const result = autoTargets(work).filter(([c, r]) => !hasCell(off, c, r));
  for (const [c, r] of on) if (!hasCell(result, c, r)) result.push([c, r]);
  return result;
}

function isObstacle(col, row) {
  return state.obstacles.some((o) => o.col === col && o.row === row);
}

// 두 칸을 잇는 직선 위의 칸들 (양 끝 제외)
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

function lineBlocked(from, to) {
  return lineCells(from, to).some((c) => isObstacle(c.col, c.row));
}

// 공격 범위의 기준 칸
function attackOrigin(attack, enemyPos) {
  return KINDS[attack.kind].anchor === 'player' ? state.player : enemyPos;
}

// 공격 범위의 그리드 안 칸들. 그리드 밖으로 나간 칸은 화면에서만 빠지고 데이터에는 남는다.
function attackCellsAt(attack, enemyPos) {
  const origin = attackOrigin(attack, enemyPos);
  return attack.cells
    .map(([dc, dr]) => ({ col: origin.col + dc, row: origin.row + dr }))
    .filter((c) => inGrid(c.col, c.row));
}

// 시작 칸에서 각 칸까지의 걸음 수. 장애물과 플레이어는 지나지 못한다. 시작 칸은 막혀 있어도 0이다.
function distancesFrom(start) {
  const key = (c, r) => r * TOOL.COLS + c;
  const dist = new Array(TOOL.COLS * TOOL.ROWS).fill(Infinity);
  dist[key(start.col, start.row)] = 0;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    for (const [dc, dr] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
      const col = node.col + dc;
      const row = node.row + dr;
      if (!inGrid(col, row) || dist[key(col, row)] !== Infinity) continue;
      if (isObstacle(col, row) || (col === state.player.col && row === state.player.row)) continue;
      dist[key(col, row)] = dist[key(node.col, node.row)] + 1;
      queue.push({ col, row });
    }
  }
  return (col, row) => dist[key(col, row)];
}

// 목표까지 최단 경로의 첫 걸음. 갈 수 없으면 null.
function stepToward(pos, target) {
  const dist = distancesFrom(target);
  let best = null;
  let bestD = dist(pos.col, pos.row);
  if (bestD === Infinity) return null;
  for (const [dc, dr] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
    const col = pos.col + dc;
    const row = pos.row + dr;
    if (inGrid(col, row) && dist(col, row) < bestD) {
      best = { col, row };
      bestD = dist(col, row);
    }
  }
  return best;
}

// 이 목표 칸이 지금 막혀 있는지. 장애물이 서 있거나, 1타가 발사체인데 플레이어까지의 경로가 막혔다.
function targetBlocked(work, cell) {
  if (isObstacle(cell.col, cell.row)) return true;
  return KINDS[work.attacks[0].kind].blocked && lineBlocked(cell, state.player);
}

// from에서 고를 이동목표. 가장 가까운 칸이고, 같으면 플레이어 행에 가까운 칸, 그다음 오른쪽 칸이다 (게임과 같다).
function chooseTarget(work, from) {
  const dist = work.chase.method === 'vanish'
    ? (c, r) => Math.abs(c - from.col) + Math.abs(r - from.row)
    : work.chase.step === 'horizontal'
      // 세로 1칸씩 + 가로 n칸씩 걸리는 틱 수
      ? (c, r) => Math.abs(r - from.row) + Math.ceil(Math.abs(c - from.col) / work.chase.n)
      : distancesFrom(from);
  let best = null;
  let bestScore = null;
  for (const [dc, dr] of effectiveTargets(work)) {
    const cell = { col: state.player.col + dc, row: state.player.row + dr };
    if (!inGrid(cell.col, cell.row) || samePos(cell, state.player) || targetBlocked(work, cell)) continue;
    const d = dist(cell.col, cell.row);
    if (d === Infinity) continue;
    const score = [d, Math.abs(cell.row - state.player.row), -cell.col];
    const better = !best || score.reduce((res, v, i) => (res !== 0 ? res : v - bestScore[i]), 0) < 0;
    if (better) { best = cell; bestScore = score; }
  }
  return best;
}

// ---------------------------------------------------------------- 편집 동작

function addWork() {
  const used = new Set(state.works.map((w) => w.name));
  let n = state.works.length + 1;
  while (used.has(`적 ${n}`)) n++;
  const work = makeWork(`적 ${n}`);
  state.works.push(work);
  openWork(work.id);
  const list = $('work-list');
  list.scrollTop = list.scrollHeight;
}

function openWork(id) {
  state.currentId = id;
  state.attackIndex = 0;
  changed();
}

// 작업이 하나도 남지 않으면 빈 작업을 만든다.
function removeWorks(ids) {
  state.works = state.works.filter((w) => !ids.includes(w.id));
  if (!state.works.length) state.works.push(makeWork('적 1'));
  if (ids.includes(state.currentId)) {
    state.currentId = state.works[0].id;
    state.attackIndex = 0;
  }
  changed();
}

function deleteWork(work) {
  if (confirm(`'${work.name}' 작업을 삭제할까요?`)) removeWorks([work.id]);
}

function deleteCheckedWorks() {
  const works = state.works.filter((w) => w.checked);
  if (!works.length) {
    $('export-status').textContent = '체크된 작업이 없습니다.';
    return;
  }
  if (!confirm(`체크한 적 ${works.length}개를 삭제할까요?\n${works.map((w) => w.name).join(', ')}`)) return;
  removeWorks(works.map((w) => w.id));
  $('export-status').textContent = `${works.length}개를 삭제했습니다.`;
}

function toggleInList(list, a, b) {
  const i = list.findIndex(([c, r]) => c === a && r === b);
  if (i >= 0) list.splice(i, 1);
  else list.push([a, b]);
}

function toggleTarget(col, row) {
  const work = currentWork();
  const dc = col - state.player.col;
  const dr = row - state.player.row;
  if (dc === 0 && dr === 0) return;
  // 자동 칸은 off 목록으로 끄고, 자동이 아닌 칸은 on 목록으로 켠다.
  if (hasCell(autoTargets(work), dc, dr)) toggleInList(work.chase.off, dc, dr);
  else toggleInList(work.chase.on, dc, dr);
  changed();
}

function toggleAttackCell(col, row) {
  const attack = currentAttack();
  if (attack.kind === 'dash') return; // 돌진은 범위를 찍지 않는다
  const origin = attackOrigin(attack, state.enemy);
  const dc = col - origin.col;
  const dr = row - origin.row;
  // 적 자기 칸은 범위가 될 수 없다. 던지기는 기준이 플레이어 칸이고 그 칸도 범위가 된다.
  if (dc === 0 && dr === 0 && KINDS[attack.kind].anchor === 'enemy') return;
  toggleInList(attack.cells, dc, dr);
  changed();
}

function toggleHome(col, row) {
  toggleInList(currentWork().retreat.home, col, row);
  changed();
}

function toggleObstacle(col, row) {
  if (samePos({ col, row }, state.player) || samePos({ col, row }, state.enemy)) return;
  const i = state.obstacles.findIndex((o) => o.col === col && o.row === row);
  if (i >= 0) state.obstacles.splice(i, 1);
  else state.obstacles.push({ col, row });
  changed();
}

function setAttackKind(kind) {
  const attack = currentAttack();
  if (attack.kind === kind) return;
  const wasEnemyAnchor = KINDS[attack.kind].anchor === 'enemy';
  attack.kind = kind;
  // 적 기준으로 돌아오면 자기 칸 (0, 0)은 범위가 될 수 없다.
  if (!wasEnemyAnchor && KINDS[kind].anchor === 'enemy') attack.cells = attack.cells.filter(([c, r]) => c !== 0 || r !== 0);
  changed();
}

function addAttack() {
  const work = currentWork();
  const last = work.attacks[work.attacks.length - 1];
  const attack = makeAttack([]);
  attack.kind = last.kind;
  attack.telegraph = last.telegraph;
  work.attacks.push(attack);
  state.attackIndex = work.attacks.length - 1;
  changed();
}

function deleteAttack() {
  const work = currentWork();
  if (work.attacks.length < 2) return;
  work.attacks.splice(state.attackIndex, 1);
  changed();
}

// ---------------------------------------------------------------- 캔버스

function setupCanvas(canvas, width, height) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const FIELD_W = TOOL.COLS * TOOL.CELL + TOOL.FIELD_PAD * 2;
const FIELD_H = TOOL.ROWS * TOOL.CELL + TOOL.FIELD_PAD * 2;
const fieldCanvas = $('field');
let fieldCtx = setupCanvas(fieldCanvas, FIELD_W, FIELD_H);
let hoverCell = null;
let drag = null;               // { actor: 'player' | 'enemy', start: 칸, moved }

function cellX(col) {
  return TOOL.FIELD_PAD + col * TOOL.CELL;
}

function cellY(row) {
  return TOOL.FIELD_PAD + row * TOOL.CELL;
}

function withAlpha(ctx, alpha, draw) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  draw();
  ctx.restore();
}

function fillCells(ctx, cells, color, alpha) {
  withAlpha(ctx, alpha, () => {
    ctx.fillStyle = color;
    for (const c of cells) ctx.fillRect(cellX(c.col) + 1, cellY(c.row) + 1, TOOL.CELL - 2, TOOL.CELL - 2);
  });
}

function strokeCells(ctx, cells, color, alpha, width, dash) {
  withAlpha(ctx, alpha, () => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    const inset = width / 2 + 1;
    for (const c of cells) {
      ctx.strokeRect(cellX(c.col) + inset, cellY(c.row) + inset, TOOL.CELL - inset * 2, TOOL.CELL - inset * 2);
    }
  });
}

function drawCross(ctx, cell, color) {
  const x = cellX(cell.col);
  const y = cellY(cell.row);
  const m = 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + m, y + m);
  ctx.lineTo(x + TOOL.CELL - m, y + TOOL.CELL - m);
  ctx.moveTo(x + TOOL.CELL - m, y + m);
  ctx.lineTo(x + m, y + TOOL.CELL - m);
  ctx.stroke();
}

function drawFieldBase(ctx) {
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  for (let row = 0; row < TOOL.ROWS; row++) {
    for (let col = 0; col < TOOL.COLS; col++) {
      ctx.fillStyle = (col + row) % 2 ? COLORS.cellB : COLORS.cellA;
      ctx.fillRect(cellX(col), cellY(row), TOOL.CELL, TOOL.CELL);
    }
  }
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 0; col <= TOOL.COLS; col++) {
    ctx.moveTo(cellX(col) + 0.5, cellY(0));
    ctx.lineTo(cellX(col) + 0.5, cellY(TOOL.ROWS));
  }
  for (let row = 0; row <= TOOL.ROWS; row++) {
    ctx.moveTo(cellX(0), cellY(row) + 0.5);
    ctx.lineTo(cellX(TOOL.COLS), cellY(row) + 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.dim;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let col = 0; col < TOOL.COLS; col++) ctx.fillText(col, cellX(col) + TOOL.CELL / 2, cellY(0) - 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < TOOL.ROWS; row++) ctx.fillText(row, cellX(0) - 6, cellY(row) + TOOL.CELL / 2);
}

function drawObstacles(ctx) {
  for (const o of state.obstacles) {
    const x = cellX(o.col);
    const y = cellY(o.row);
    const m = 8;
    ctx.fillStyle = COLORS.obstacleDark;
    ctx.fillRect(x + m, y + m, TOOL.CELL - m * 2, TOOL.CELL - m * 2);
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(x + m, y + m, TOOL.CELL - m * 2, TOOL.CELL - m * 2 - 8);
  }
}

function drawActor(ctx, pos, color, dark, label) {
  const x = cellX(pos.col);
  const y = cellY(pos.row);
  const m = 15;
  ctx.fillStyle = dark;
  ctx.fillRect(x + m, y + m, TOOL.CELL - m * 2, TOOL.CELL - m * 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + m, y + m, TOOL.CELL - m * 2, TOOL.CELL - m * 2 - 6);
  ctx.fillStyle = COLORS.outline;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + TOOL.CELL / 2, y + TOOL.CELL / 2 - 3);
}

function drawTargets(ctx, work) {
  if (isThrowFirst(work)) {
    strokeCells(ctx, [state.enemy], COLORS.target, 0.95, 3);
    return;
  }
  const auto = autoTargets(work);
  const active = effectiveTargets(work);
  for (let row = 0; row < TOOL.ROWS; row++) {
    for (let col = 0; col < TOOL.COLS; col++) {
      const cell = { col, row };
      if (samePos(cell, state.player)) continue;
      const dc = col - state.player.col;
      const dr = row - state.player.row;
      const isAuto = hasCell(auto, dc, dr);
      if (!hasCell(active, dc, dr)) {
        if (isAuto) strokeCells(ctx, [cell], COLORS.target, 0.5, 2, [5, 4]);
        continue;
      }
      const color = isAuto ? COLORS.target : COLORS.manual;
      fillCells(ctx, [cell], color, 0.35);
      strokeCells(ctx, [cell], color, 0.95, 2);
      if (targetBlocked(work, cell)) drawCross(ctx, cell, COLORS.attack);
    }
  }
}

function drawAttackEdit(ctx, work) {
  const selected = currentAttack();
  for (const attack of work.attacks) {
    if (attack !== selected) strokeCells(ctx, attackCellsAt(attack, state.enemy), COLORS.attack, 0.3, 1);
  }
  if (selected.kind === 'dash') {
    // 지금 위치에서 돌진하면 지날 칸. 플레이어에 닿으면 플레이어 칸을 빨갛게 두른다.
    const path = dashPath(selected, state.enemy, state.player, (c) => isObstacle(c.col, c.row));
    fillCells(ctx, path.cells, COLORS.attack, 0.2);
    strokeCells(ctx, path.cells, COLORS.attack, 0.7, 2, [5, 4]);
    if (path.hit) strokeCells(ctx, [state.player], COLORS.attack, 1, 3);
    return;
  }
  const origin = attackOrigin(selected, state.enemy);
  const cells = attackCellsAt(selected, state.enemy);
  fillCells(ctx, cells, COLORS.attack, 0.38);
  strokeCells(ctx, cells, COLORS.attack, 0.95, 2);
  if (KINDS[selected.kind].blocked) {
    for (const c of cells) if (lineBlocked(origin, c)) drawCross(ctx, c, COLORS.text);
  }
}

function drawHome(ctx, work) {
  const cells = work.retreat.home.map(([col, row]) => ({ col, row }));
  fillCells(ctx, cells, COLORS.home, 0.25);
  strokeCells(ctx, cells, COLORS.home, 0.9, 2);
}

function drawDemo(ctx) {
  if (demo.phase === 'attack') {
    const p = 1 - demo.timer / demo.telegraphTotal;
    fillCells(ctx, demo.cells, COLORS.attack, 0.12 + 0.43 * p);
    strokeCells(ctx, demo.cells, COLORS.attack, 0.95, 2);
  }
  // 돌진 예고: 칸마다 들어갈 때가 가까울수록 진해진다
  const telegraph = demo.telegraphTotal;
  for (const { cell, lead } of demo.dashShown) {
    fillCells(ctx, [cell], COLORS.attack, 0.12 + 0.43 * (1 - lead / telegraph));
    strokeCells(ctx, [cell], COLORS.attack, 0.95, 2);
  }
  if (demo.flash > 0) fillCells(ctx, demo.flashCells, COLORS.flash, demo.flash / TOOL.IMPACT_TIME);
  if (demo.vanishTarget) strokeCells(ctx, [demo.vanishTarget], COLORS.enemy, 0.7, 2, [5, 4]);
}

function drawField() {
  const ctx = fieldCtx;
  const work = currentWork();
  drawFieldBase(ctx);
  if (demo.running) {
    drawDemo(ctx);
  } else {
    if (state.tab === 'chase') drawTargets(ctx, work);
    else if (state.tab === 'attack') drawAttackEdit(ctx, work);
    else if (state.tab === 'retreat') drawHome(ctx, work);
    if (hoverCell && !drag) strokeCells(ctx, [hoverCell], COLORS.text, 0.4, 1);
  }
  drawObstacles(ctx);
  if (demo.running && demo.hurt > 0) strokeCells(ctx, [state.player], COLORS.attack, 1, 3);
  drawActor(ctx, state.player, COLORS.player, COLORS.playerDark, 'P');
  if (!demo.running) drawActor(ctx, state.enemy, COLORS.enemy, COLORS.enemyDark, 'E');
  else if (demo.visible) drawActor(ctx, demo.pos, COLORS.enemy, COLORS.enemyDark, 'E');
}

function fieldCellAt(e) {
  const rect = fieldCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (FIELD_W / rect.width);
  const y = (e.clientY - rect.top) * (FIELD_H / rect.height);
  const col = Math.floor((x - TOOL.FIELD_PAD) / TOOL.CELL);
  const row = Math.floor((y - TOOL.FIELD_PAD) / TOOL.CELL);
  return inGrid(col, row) ? { col, row } : null;
}

function actorAt(cell) {
  if (samePos(cell, state.player)) return 'player';
  if (samePos(cell, state.enemy)) return 'enemy';
  return null;
}

// 칸 클릭: 장애물 배치 중이면 장애물을, 아니면 지금 상태의 그리드 값을 넣고 뺀다.
function clickCell(cell) {
  if (state.obstacleMode) toggleObstacle(cell.col, cell.row);
  else if (state.tab === 'chase' && state.chaseView === 'target' && !isThrowFirst(currentWork())) toggleTarget(cell.col, cell.row);
  else if (state.tab === 'attack') toggleAttackCell(cell.col, cell.row);
  else if (state.tab === 'retreat') toggleHome(cell.col, cell.row);
}

function moveActor(actor, cell) {
  if (actorAt(cell) || isObstacle(cell.col, cell.row)) return false;
  state[actor] = { col: cell.col, row: cell.row };
  return true;
}

fieldCanvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || demo.running) return;
  const cell = fieldCellAt(e);
  if (!cell) return;
  const actor = actorAt(cell);
  if (actor) {
    drag = { actor, start: cell, moved: false };
    fieldCanvas.setPointerCapture(e.pointerId);
    fieldCanvas.style.cursor = 'grabbing';
  } else {
    clickCell(cell);
  }
});
fieldCanvas.addEventListener('pointermove', (e) => {
  hoverCell = fieldCellAt(e);
  if (drag) {
    if (hoverCell && moveActor(drag.actor, hoverCell)) {
      drag.moved = true;
      changed();
    }
    return;
  }
  fieldCanvas.style.cursor = hoverCell && actorAt(hoverCell) ? 'grab' : '';
});
fieldCanvas.addEventListener('pointerup', () => {
  if (!drag) return;
  const { moved, start } = drag;
  drag = null;
  fieldCanvas.style.cursor = '';
  // 옮기지 않고 뗐으면 그 칸을 클릭한 것이다. 플레이어나 적이 선 칸도 범위·목표로 넣고 뺄 수 있다.
  if (!moved) clickCell(start);
});
fieldCanvas.addEventListener('pointercancel', () => {
  drag = null;
  fieldCanvas.style.cursor = '';
});
fieldCanvas.addEventListener('pointerleave', () => { hoverCell = null; });
// 더블클릭하면 처음 위치로 돌아간다. 앞선 클릭 두 번의 토글은 서로 상쇄된다.
fieldCanvas.addEventListener('dblclick', (e) => {
  const cell = fieldCellAt(e);
  const actor = cell && !demo.running ? actorAt(cell) : null;
  if (!actor) return;
  const home = actor === 'player' ? startPlayer() : startEnemy();
  if (moveActor(actor, home)) changed();
});

// ---------------------------------------------------------------- 시연

// 플레이어는 그 자리에 서 있고, 적이 Idle → 추적 → 시행 → 복귀를 반복한다. 게임의 이동·판정 순서를 따른다.
const demo = {
  running: false,
  phase: null,
  pos: null,
  timer: 0,
  moveTimer: 0,
  visible: true,
  vanishing: false,
  vanishTarget: null,
  target: null,                // 추적 중인 이동목표 (갱신을 끄면 이 칸을 유지한다)
  dashDir: null,
  dashOrigin: null,            // 돌진을 시작한 칸
  dashSteps: 0,
  dashShown: [],               // 지금 보이는 돌진 예고 칸 { cell, lead }
  strikeClock: 0,              // 이번 공격의 예고가 시작된 뒤 흐른 시간
  attackIndex: 0,
  cells: [],
  telegraphTotal: 1,
  flash: 0,
  flashCells: [],
  hurt: 0,
  hits: 0,
  message: '',
  lastMs: 0,

  start() {
    this.running = true;
    this.pos = { ...state.enemy };
    this.hits = 0;
    this.flash = 0;
    this.hurt = 0;
    this.visible = true;
    this.vanishing = false;
    this.vanishTarget = null;
    this.target = null;
    this.attackIndex = 0;
    this.dashShown = [];
    this.message = '';
    this.lastMs = performance.now();
    this.enterIdle();
  },

  stop() {
    this.running = false;
    this.phase = null;
    this.dashShown = [];
  },

  toggle() {
    if (this.running) this.stop();
    else this.start();
    renderPanel();
  },

  enterIdle() {
    const { idle } = currentWork();
    this.phase = 'idle';
    this.timer = idle.duration;
    this.moveTimer = idle.interval;
  },

  enterChase() {
    this.phase = 'chase';
    this.message = '';
    this.moveTimer = 0;
    this.target = null;
    this.vanishing = false;
    this.vanishTarget = null;
    if (isThrowFirst(currentWork())) this.enterAttack();
  },

  // 고정한 목표(갱신 끔)를 계속 쓸 수 있는지. 플레이어가 그 칸에 서거나 막히면 다시 고른다.
  targetUsable(work, cell) {
    return !!cell && !samePos(cell, state.player) && !targetBlocked(work, cell);
  },

  // 이동목표. 갱신이 켜져 있으면 매번 다시 고르고, 꺼져 있으면 처음 고른 칸을 쓴다.
  currentTarget(work) {
    if (work.chase.refresh || !this.targetUsable(work, this.target)) this.target = chooseTarget(work, this.pos);
    this.message = this.target ? '' : '갈 수 있는 이동목표가 없어 계속 찾는 중입니다.';
    return this.target;
  },

  enterAttack() {
    this.attackIndex = 0;
    this.beginStrike();
  },

  // 공격 시작 시점의 위치로 범위를 정한다. 발사체는 경로가 막힌 칸을 뺀다.
  beginStrike() {
    const attack = currentWork().attacks[this.attackIndex];
    this.phase = 'attack';
    this.timer = attack.telegraph;
    this.telegraphTotal = attack.telegraph;
    if (attack.kind === 'dash') {
      // 돌진 방향은 예고가 시작될 때 정한다. 보이는 칸은 dashTelegraph가 시간으로 정한다.
      this.dashDir = dashDirection(this.pos, state.player);
      this.dashOrigin = { ...this.pos };
      this.dashSteps = 0;
      this.strikeClock = 0;
      this.cells = [];
      this.dashShown = this.dashTelegraph(attack);
      return;
    }
    const origin = attackOrigin(attack, this.pos);
    let cells = attackCellsAt(attack, this.pos);
    if (KINDS[attack.kind].blocked) cells = cells.filter((c) => !lineBlocked(origin, c));
    this.cells = cells;
  },

  // 돌진 경로에서 지금 보여야 할 칸들. 개수 제한 없이 예고시간으로만 정한다.
  // k번째 칸은 출발(예고 끝) 뒤 (k - 1) x 칸당 시간에 들어가고, 들어가기 예고시간 전부터 보인다.
  // 아직 들어가지 않은 칸만 보이고, 장애물·그리드 끝·최대 거리 앞에서 끊긴다. 플레이어 칸은 보이고 그 뒤는 안 보인다.
  // lead는 그 칸에 들어갈 때까지 남은 시간이다.
  dashTelegraph(attack) {
    const shown = [];
    for (let k = this.dashSteps + 1; k <= attack.dashCells + 1; k++) {
      const cell = { col: this.dashOrigin.col + this.dashDir.col * k, row: this.dashOrigin.row + this.dashDir.row * k };
      if (!inGrid(cell.col, cell.row) || isObstacle(cell.col, cell.row)) break;
      const isPlayer = samePos(cell, state.player);
      if (k > attack.dashCells && !isPlayer) break; // 최대 거리 다음 칸은 플레이어가 있을 때만 친다
      const lead = attack.telegraph + (k - 1) * attack.dashTick - this.strikeClock;
      if (lead > attack.telegraph) break;
      shown.push({ cell, lead: Math.max(0, lead) });
      if (isPlayer) break;
    }
    return shown;
  },

  // 예고가 끝나면 범위를 친다. 돌진은 이때부터 달리기 시작한다.
  finishStrike() {
    if (currentWork().attacks[this.attackIndex].kind === 'dash') {
      this.phase = 'dash';
      this.updateDash(); // 첫 칸은 예고가 끝난 그 순간에 들어간다
      return;
    }
    this.resolveStrike(this.cells);
  },

  // 일정한 속도로 한 칸씩 나아간다. 플레이어에 닿으면 그 앞에서 멈추며 피해를 주고,
  // 장애물·그리드 끝·최대 거리에서도 멈춘다.
  // 이동 시각은 예고 표시와 같은 시계(strikeClock)로 정해 칸이 보인 뒤 정확히 예고시간 뒤에 들어간다.
  updateDash() {
    const attack = currentWork().attacks[this.attackIndex];
    if (this.strikeClock + 1e-9 < attack.telegraph + this.dashSteps * attack.dashTick) return;
    const next = { col: this.pos.col + this.dashDir.col, row: this.pos.row + this.dashDir.row };
    if (samePos(next, state.player)) {
      this.resolveStrike([next]);
      return;
    }
    if (this.dashSteps >= attack.dashCells || !inGrid(next.col, next.row) || isObstacle(next.col, next.row)) {
      this.resolveStrike([]);
      return;
    }
    this.pos = next;
    this.dashSteps++;
  },

  // 공격이 실행된 칸을 번쩍이고, 다음 공격이나 복귀로 넘어간다.
  resolveStrike(cells) {
    const work = currentWork();
    this.flash = TOOL.IMPACT_TIME;
    this.flashCells = cells;
    if (cells.some((c) => samePos(c, state.player))) {
      this.hits++;
      this.hurt = TOOL.IMPACT_TIME;
    }
    this.attackIndex++;
    if (this.attackIndex < work.attacks.length) {
      this.phase = 'gap';
      this.timer = work.attacks[this.attackIndex].gap;
    } else {
      this.enterRetreat();
    }
  },

  enterRetreat() {
    this.phase = 'retreat';
    this.moveTimer = currentWork().retreat.tick;
  },

  inHome() {
    return hasCell(currentWork().retreat.home, this.pos.col, this.pos.row);
  },

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.moveTimer = Math.max(0, this.moveTimer - dt);
    this.timer = Math.max(0, this.timer - dt);
    const strike = currentWork().attacks[this.attackIndex];
    if (strike && strike.kind === 'dash' && (this.phase === 'attack' || this.phase === 'dash')) this.strikeClock += dt;
    if (this.phase === 'idle') this.updateIdle();
    else if (this.phase === 'chase') this.updateChase();
    else if (this.phase === 'attack') { if (this.timer <= 0) this.finishStrike(); }
    else if (this.phase === 'dash') this.updateDash();
    else if (this.phase === 'gap') { if (this.timer <= 0) this.beginStrike(); }
    else if (this.phase === 'retreat') this.updateRetreat();
    // 돌진 예고 칸은 시간이 흐르면서 늘어나고, 적이 들어간 칸은 빠진다
    const attack = currentWork().attacks[this.attackIndex];
    const dashing = attack && attack.kind === 'dash' && (this.phase === 'attack' || this.phase === 'dash');
    if (dashing) {
      this.dashShown = this.dashTelegraph(attack);
    } else {
      this.dashShown = [];
    }
  },

  // 게임처럼 복귀 목표(대기 구역) 안의 인접 빈칸으로만 움직인다.
  updateIdle() {
    if (this.timer <= 0) {
      this.enterChase();
      return;
    }
    const { idle, retreat } = currentWork();
    if (!idle.moves || this.moveTimer > 0) return;
    this.moveTimer = idle.interval;
    const free = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      .map(([dc, dr]) => ({ col: this.pos.col + dc, row: this.pos.row + dr }))
      .filter((c) => inGrid(c.col, c.row) && !isObstacle(c.col, c.row) && !samePos(c, state.player)
        && hasCell(retreat.home, c.col, c.row));
    if (free.length) this.pos = free[Math.floor(Math.random() * free.length)];
  },

  // 목표가 없어도 공격을 포기하지 않는다. 추적 상태로 남아 매 프레임 다시 찾는다.
  updateChase() {
    const work = currentWork();
    if (work.chase.method === 'vanish') {
      this.updateVanish(work);
      return;
    }
    const target = this.currentTarget(work);
    if (!target) return;
    if (samePos(target, this.pos)) {
      this.enterAttack();
      return;
    }
    if (this.moveTimer > 0) return;
    const next = work.chase.step === 'horizontal' ? this.horizontalStep(target, work.chase.n) : stepToward(this.pos, target);
    if (!next) return; // 막혔으면 다음 프레임에 다시 시도한다
    this.pos = next;
    this.moveTimer = work.chase.tick;
  },

  // 세로로 1칸씩 목표 행을 맞춘 뒤 가로로 n칸씩 간다. 남은 거리가 n보다 짧으면 남은 만큼만 가고,
  // 막힌 칸이 있으면 그 앞에서 멈춘다.
  horizontalStep(target, n) {
    const free = (c) => inGrid(c.col, c.row) && !isObstacle(c.col, c.row) && !samePos(c, state.player);
    const p = this.pos;
    if (target.row !== p.row) {
      const next = { col: p.col, row: p.row + Math.sign(target.row - p.row) };
      return free(next) ? next : null;
    }
    const dir = Math.sign(target.col - p.col);
    const steps = Math.min(n, Math.abs(target.col - p.col));
    let col = p.col;
    for (let i = 0; i < steps && free({ col: col + dir, row: p.row }); i++) col += dir;
    return col === p.col ? null : { col, row: p.row };
  },

  // 목표가 있어야 사라진다. 갱신이 켜져 있으면 나타나는 순간의 플레이어 기준으로 다시 고르고,
  // 꺼져 있으면 사라질 때 고른 칸에 나타난다. 나타날 칸이 없으면 숨은 채 기다린다.
  updateVanish(work) {
    if (!this.vanishing) {
      if (!this.currentTarget(work)) return;
      this.vanishing = true;
      this.visible = false;
      this.timer = work.chase.vanish;
    }
    const target = this.currentTarget(work);
    this.vanishTarget = target;
    if (this.timer > 0 || !target) return;
    this.pos = target;
    this.vanishing = false;
    this.vanishTarget = null;
    this.visible = true;
    this.enterAttack();
  },

  updateRetreat() {
    if (this.inHome()) {
      this.enterIdle();
      return;
    }
    if (this.moveTimer > 0) return;
    const work = currentWork();
    const dist = distancesFrom(this.pos);
    let best = null;
    for (const [col, row] of work.retreat.home) {
      if (isObstacle(col, row) || (col === state.player.col && row === state.player.row)) continue;
      if (dist(col, row) !== Infinity && (!best || dist(col, row) < dist(best.col, best.row))) best = { col, row };
    }
    const next = best && stepToward(this.pos, best);
    if (!next) {
      this.message = '갈 수 있는 복귀 목표가 없어 그 자리에서 Idle로 돌아갔습니다.';
      this.enterIdle();
      return;
    }
    this.pos = next;
    this.moveTimer = work.retreat.tick;
  },

  statusText() {
    const work = currentWork();
    const count = `${this.attackIndex + 1}/${work.attacks.length}타`;
    const left = `${this.timer.toFixed(1)}초`;
    let text = '';
    if (this.phase === 'idle') text = `Idle · ${left} 남음`;
    else if (this.phase === 'chase') text = this.vanishing ? `Attack 추적 · 사라짐 ${left}` : 'Attack 추적 · 이동 중';
    else if (this.phase === 'attack') text = `Attack 시행 ${count} · 예고 ${left}`;
    else if (this.phase === 'dash') text = `Attack 시행 ${count} · 돌진 중`;
    else if (this.phase === 'gap') text = `Attack 시행 ${count} 전 대기 · ${left}`;
    else if (this.phase === 'retreat') text = '복귀 · 이동 중';
    return `${text} · 플레이어 적중 ${this.hits}회${this.message ? ` · ${this.message}` : ''}`;
  },
};

// ---------------------------------------------------------------- 왼쪽 목록

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderList() {
  $('work-list').innerHTML = state.works.map((work) => {
    const kinds = [...new Set(work.attacks.map((a) => KINDS[a.kind].label))].join('·');
    return `<li class="work-item${work.id === state.currentId ? ' active' : ''}" data-id="${work.id}">
      <input type="checkbox" class="pick" ${work.checked ? 'checked' : ''} title="내보내기·삭제에 포함">
      <span class="name">${escapeHtml(work.name || '(이름 없음)')}</span>
      <button class="del" title="작업 삭제">×</button>
      <span class="meta">HP ${work.hp} · 공격력 ${work.damage} · ${kinds} ${work.attacks.length}타</span>
    </li>`;
  }).join('');
  const all = $('check-all');
  const checkedCount = state.works.filter((w) => w.checked).length;
  all.checked = checkedCount === state.works.length;
  all.indeterminate = checkedCount > 0 && checkedCount < state.works.length;
}

$('work-list').addEventListener('click', (e) => {
  const item = e.target.closest('.work-item');
  if (!item) return;
  const work = state.works.find((w) => w.id === item.dataset.id);
  if (e.target.classList.contains('pick')) {
    work.checked = e.target.checked;
    changed();
  } else if (e.target.classList.contains('del')) {
    deleteWork(work);
  } else if (work.id !== state.currentId) {
    openWork(work.id);
  }
});

$('check-all').addEventListener('change', (e) => {
  for (const work of state.works) work.checked = e.target.checked;
  changed();
});

$('add-work').addEventListener('click', addWork);
$('delete-checked').addEventListener('click', deleteCheckedWorks);

// ---------------------------------------------------------------- 오른쪽 패널

const panelSyncs = [];         // renderPanel 때 입력 칸을 지금 값으로 맞추는 함수들

function bindNumber(id, read, write, { min = 0, max = Infinity, integer = false } = {}) {
  const input = $(id);
  panelSyncs.push(() => {
    // 입력 중인 칸은 값을 덮어쓰지 않는다
    if (document.activeElement !== input) input.value = read();
  });
  input.addEventListener('input', () => {
    const value = Number(input.value);
    if (input.value === '' || !Number.isFinite(value) || value < min || value > max) return;
    if (integer && !Number.isInteger(value)) return;
    write(value);
    changed();
  });
  // 잘못된 값을 남기고 나가면 마지막 올바른 값으로 되돌린다
  input.addEventListener('change', () => {
    input.blur();
    renderPanel();
  });
}

function bindRadio(name, read, write) {
  const inputs = [...document.querySelectorAll(`input[name="${name}"]`)];
  panelSyncs.push(() => {
    const value = read();
    for (const input of inputs) input.checked = input.value === value;
  });
  for (const input of inputs) {
    input.addEventListener('change', () => {
      write(input.value);
      changed();
    });
  }
}

bindNumber('stat-hp', () => currentWork().hp, (v) => { currentWork().hp = v; }, { min: TOOL.MIN_HP });
bindNumber('stat-damage', () => currentWork().damage, (v) => { currentWork().damage = v; });
bindRadio('idle-move', () => (currentWork().idle.moves ? 'move' : 'stay'), (v) => { currentWork().idle.moves = v === 'move'; });
bindNumber('idle-interval', () => currentWork().idle.interval, (v) => { currentWork().idle.interval = v; }, { min: TOOL.MIN_INTERVAL });
bindNumber('idle-duration', () => currentWork().idle.duration, (v) => { currentWork().idle.duration = v; });
bindRadio('chase-method', () => currentWork().chase.method, (v) => { currentWork().chase.method = v; });
bindRadio('chase-step', () => currentWork().chase.step, (v) => { currentWork().chase.step = v; });
bindNumber('chase-n', () => currentWork().chase.n, (v) => { currentWork().chase.n = v; }, { min: 1, max: TOOL.COLS - 1, integer: true });
bindNumber('chase-tick', () => currentWork().chase.tick, (v) => { currentWork().chase.tick = v; }, { min: TOOL.MIN_TIME });
bindNumber('chase-vanish', () => currentWork().chase.vanish, (v) => { currentWork().chase.vanish = v; });
bindNumber('attack-telegraph', () => currentAttack().telegraph, (v) => { currentAttack().telegraph = v; }, { min: TOOL.MIN_TIME });
bindNumber('attack-gap', () => currentAttack().gap, (v) => { currentAttack().gap = v; });
bindNumber('attack-dash-cells', () => currentAttack().dashCells, (v) => { currentAttack().dashCells = v; }, { min: 1, max: TOOL.COLS - 1, integer: true });
bindNumber('attack-dash-tick', () => currentAttack().dashTick, (v) => { currentAttack().dashTick = v; }, { min: TOOL.MIN_TIME });

const refreshInput = $('chase-refresh');
panelSyncs.push(() => { refreshInput.checked = currentWork().chase.refresh; });
refreshInput.addEventListener('change', () => {
  currentWork().chase.refresh = refreshInput.checked;
  changed();
});

bindNumber('retreat-tick',() => currentWork().retreat.tick, (v) => { currentWork().retreat.tick = v; }, { min: TOOL.MIN_TIME });

const nameInput = $('enemy-name');

// 그리드 칸 그림 범례와 현재 상태 설명
function fieldHintText(work) {
  if (state.obstacleMode) return '장애물 배치 중 · 칸 클릭으로 시험용 장애물을 넣고 뺍니다. 내보내기에는 들어가지 않습니다.';
  if (state.tab === 'idle') return 'Idle 상태 · 오른쪽에서 이동 여부와 지속시간을 정합니다.';
  if (state.tab === 'chase') {
    if (isThrowFirst(work)) return '이동목표: 현재 위치 (파란 테두리).';
    const view = state.chaseView === 'target' ? '칸 클릭으로 켜고 끕니다' : '이동 방법 편집 중';
    return `이동목표 · 파랑: 자동 계산 · 노랑: 직접 켠 칸 · 점선: 끈 칸 · X: 지금 막힘 · ${view}`;
  }
  if (state.tab === 'attack') {
    const attack = currentAttack();
    if (attack.kind === 'dash') return `${state.attackIndex + 1}타 돌진 · 지금 위치에서 돌진하면 지날 칸(점선)과 플레이어 적중(빨간 테두리) 미리보기 · 칸 클릭 없음`;
    const base = KINDS[attack.kind].anchor === 'player' ? '플레이어(P) 기준' : '적(E) 기준';
    return `${state.attackIndex + 1}타 공격 범위 · ${base} · 칸 클릭으로 넣고 뺍니다 · 흐린 테두리: 다른 타${KINDS[attack.kind].blocked ? ' · X: 장애물에 막힘' : ''}`;
  }
  return '복귀 선호 위치 · 칸 클릭으로 넣고 뺍니다.';
}

function renderAttackPanel(work) {
  const attack = currentAttack();
  $('attack-tabs').innerHTML = work.attacks
    .map((a, i) => `<button data-attack="${i}" class="${i === state.attackIndex ? 'on' : ''}">${i + 1}타</button>`)
    .join('') + '<button data-attack="add" title="추가 공격">+</button>';
  for (const button of document.querySelectorAll('[data-kind]')) button.classList.toggle('on', button.dataset.kind === attack.kind);
  $('attack-kind-info').textContent = KINDS[attack.kind].info;
  $('attack-gap-wrap').hidden = state.attackIndex === 0;
  $('attack-delete').disabled = work.attacks.length < 2;
  const isDash = attack.kind === 'dash';
  $('attack-dash-wrap').hidden = !isDash;
  $('attack-clear').hidden = isDash;
  if (isDash) {
    $('attack-range-info').textContent = `범위는 찍지 않습니다. 최대 ${attack.dashCells}칸, 칸당 ${attack.dashTick}초로 달립니다. 예고시간 뒤 출발하고, 각 칸은 들어가기 예고시간 전부터 보입니다(지금 값이면 동시에 약 ${Math.min(attack.dashCells, Math.max(1, Math.floor(attack.telegraph / attack.dashTick + 1e-9)))}칸).`;
    return;
  }
  const count = attack.cells.length;
  const hidden = count - attackCellsAt(attack, state.enemy).length;
  $('attack-range-info').textContent = count
    ? `범위 ${count}칸${hidden ? ` (지금 위치에서 ${hidden}칸은 그리드 밖)` : ''}. 가운데 그리드에서 넣고 뺍니다.`
    : '범위가 비어 있습니다. 가운데 그리드에서 칸을 클릭하세요.';
}

function renderChasePanel(work) {
  const throwFirst = isThrowFirst(work);
  $('chase-throw-note').hidden = !throwFirst;
  $('chase-body').hidden = throwFirst;
  for (const button of document.querySelectorAll('[data-chase-view]')) {
    button.classList.toggle('on', button.dataset.chaseView === state.chaseView);
  }
  $('chase-target').hidden = state.chaseView !== 'target';
  $('chase-method').hidden = state.chaseView !== 'method';
  const { method, step, off, on } = work.chase;
  $('method-shortest').hidden = method !== 'shortest';
  $('method-vanish').hidden = method !== 'vanish';
  $('chase-n-wrap').hidden = step !== 'horizontal';
  $('chase-refresh-info').textContent = work.chase.refresh
    ? '이동할 때마다 플레이어 위치로 목표를 다시 고릅니다. 사라짐은 나타나는 순간 고릅니다.'
    : '추적을 시작할 때 고른 칸으로 갑니다. 그 칸에 플레이어가 서거나 막힐 때만 다시 고릅니다. 사라짐은 사라질 때 고릅니다.';
  const count = effectiveTargets(work).length;
  const source = work.attacks[0].kind === 'dash' ? '1타 돌진이 닿는 플레이어 행의 칸입니다(최대 거리 + 1칸).' : '1타 범위로 계산한 위치입니다.';
  $('chase-target-info').textContent = `${source} 플레이어 기준 ${count}칸 (끈 칸 ${off.length}, 직접 켠 칸 ${on.length}). `
    + '가운데 그리드를 클릭해 켜고 끕니다. 목표가 없으면 공격을 포기하지 않고 계속 찾습니다.';
}

function renderPanel() {
  const work = currentWork();
  if (document.activeElement !== nameInput) nameInput.value = work.name;
  for (const sync of panelSyncs) sync();
  for (const button of document.querySelectorAll('[data-tab]')) button.classList.toggle('on', button.dataset.tab === state.tab);
  for (const tab of Object.keys(STATE_LABELS)) $(`panel-${tab}`).hidden = tab !== state.tab;
  $('idle-interval-wrap').hidden = !work.idle.moves;
  renderChasePanel(work);
  renderAttackPanel(work);
  $('retreat-info').textContent = `복귀 선호 위치 ${work.retreat.home.length}칸. 가운데 그리드를 클릭해 넣고 뺍니다. 가장 가까운 빈 칸으로 돌아갑니다.`;
  $('obstacle-mode').classList.toggle('on', state.obstacleMode);
  $('demo-toggle').textContent = demo.running ? '■ 정지' : '▶ 시연';
  $('field-hint').textContent = fieldHintText(work);
  if (!demo.running) $('demo-status').textContent = '플레이어는 그 자리에 서 있고 적이 한 사이클씩 반복합니다.';
}

nameInput.addEventListener('input', () => {
  currentWork().name = nameInput.value;
  saveState();
  renderList();
});

function setTab(tab) {
  state.tab = tab;
  state.obstacleMode = false;
  saveState();
  renderPanel();
}

for (const button of document.querySelectorAll('[data-tab]')) button.addEventListener('click', () => setTab(button.dataset.tab));
for (const button of document.querySelectorAll('[data-chase-view]')) {
  button.addEventListener('click', () => {
    state.chaseView = button.dataset.chaseView;
    saveState();
    renderPanel();
  });
}
for (const button of document.querySelectorAll('[data-kind]')) button.addEventListener('click', () => setAttackKind(button.dataset.kind));

$('attack-tabs').addEventListener('click', (e) => {
  const button = e.target.closest('[data-attack]');
  if (!button) return;
  if (button.dataset.attack === 'add') {
    addAttack();
    return;
  }
  state.attackIndex = Number(button.dataset.attack);
  saveState();
  renderPanel();
});
$('attack-clear').addEventListener('click', () => {
  currentAttack().cells = [];
  changed();
});
$('attack-delete').addEventListener('click', deleteAttack);
$('chase-target-reset').addEventListener('click', () => {
  const { chase } = currentWork();
  chase.off = [];
  chase.on = [];
  changed();
});
$('retreat-reset').addEventListener('click', () => {
  currentWork().retreat.home = defaultHomeCells();
  changed();
});
$('obstacle-mode').addEventListener('click', () => {
  state.obstacleMode = !state.obstacleMode;
  saveState();
  renderPanel();
});
$('obstacle-clear').addEventListener('click', () => {
  state.obstacles = [];
  changed();
});
$('demo-toggle').addEventListener('click', () => demo.toggle());

window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const typing = (tag === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') || tag === 'TEXTAREA';
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space') {
    e.preventDefault();
    demo.toggle();
  }
});

// ---------------------------------------------------------------- 내보내기

// 8열 x 4행 그림. marks(col, row)가 글자를 돌려주고, 없으면 '.'이다.
function gridMap(marks) {
  const rows = [];
  for (let row = 0; row < TOOL.ROWS; row++) {
    let line = '';
    for (let col = 0; col < TOOL.COLS; col++) line += marks(col, row) || '.';
    rows.push(line);
  }
  return rows;
}

const EXAMPLE_PLAYER = { col: TOOL.PLAYER_COL, row: TOOL.PLAYER_ROW };
const EXAMPLE_ENEMY = { col: TOOL.ENEMY_COL, row: TOOL.ENEMY_ROW };

function attackMap(attack) {
  if (attack.kind === 'dash') {
    // 돌진: 예시 위치에서 지날 칸을 진행 방향 화살표로, 플레이어에 닿으면 @로 그린다
    const path = dashPath(attack, EXAMPLE_ENEMY, EXAMPLE_PLAYER, () => false);
    const arrow = path.dir.col < 0 ? '<' : path.dir.col > 0 ? '>' : path.dir.row < 0 ? '^' : 'v';
    return gridMap((col, row) => {
      if (col === EXAMPLE_PLAYER.col && row === EXAMPLE_PLAYER.row) return path.hit ? '@' : 'P';
      if (col === EXAMPLE_ENEMY.col && row === EXAMPLE_ENEMY.row) return 'E';
      return path.cells.some((c) => c.col === col && c.row === row) ? arrow : '.';
    });
  }
  const anchor = KINDS[attack.kind].anchor;
  const origin = anchor === 'player' ? EXAMPLE_PLAYER : EXAMPLE_ENEMY;
  return gridMap((col, row) => {
    const inRange = hasCell(attack.cells, col - origin.col, row - origin.row);
    if (col === EXAMPLE_PLAYER.col && row === EXAMPLE_PLAYER.row) return inRange ? '@' : 'P';
    if (anchor === 'enemy' && col === EXAMPLE_ENEMY.col && row === EXAMPLE_ENEMY.row) return 'E';
    return inRange ? '#' : '.';
  });
}

function targetMap(targets) {
  return gridMap((col, row) => {
    if (col === EXAMPLE_PLAYER.col && row === EXAMPLE_PLAYER.row) return 'P';
    return hasCell(targets, col - EXAMPLE_PLAYER.col, row - EXAMPLE_PLAYER.row) ? 'T' : '.';
  });
}

function homeMap(home) {
  return gridMap((col, row) => (hasCell(home, col, row) ? 'H' : '.'));
}

// 지금 게임 코드(enemy.js)로는 표현할 수 없어 코드 수정이 필요한 항목.
// 2026-11-10부터 게임이 툴의 모든 동작(연속 공격, 발사체 막힘, 돌진, 사라짐, 적별 틱·복귀 칸·이동목표 등)을 지원해 비어 있다.
// 툴에 게임이 지원하지 않는 동작을 새로 넣으면 여기에 항목을 추가한다.
function gameCodeNeeds(work) {
  return [];
}

// 게임 config.js ENEMIES 항목 형식. 이 값을 그대로 ENEMIES[key]에 넣으면 된다.
function gameConfigOf(work) {
  const first = work.attacks[0];
  const game = work.game || {};
  const { chase } = work;
  const targets = effectiveTargets(work).map((c) => [...c]);
  const chaseConfig = chase.method === 'vanish'
    ? { targets, refresh: chase.refresh, move: 'vanish', vanish: chase.vanish }
    : {
      targets, refresh: chase.refresh, move: 'shortest', step: chase.step === 'horizontal' ? 'horizontal' : 'any',
      ...(chase.step === 'horizontal' ? { cellsPerMove: chase.n } : {}),
      tick: chase.tick,
    };
  return {
    key: game.key || null,
    name: work.name,
    family: game.family || (first.kind === 'melee' || first.kind === 'dash' ? 'melee' : 'ranged'),
    firstWave: Number.isInteger(game.firstWave) ? game.firstWave : null,
    hp: work.hp,
    damage: work.damage,
    idle: { moves: work.idle.moves, interval: work.idle.interval, duration: work.idle.duration },
    chase: chaseConfig,
    attacks: work.attacks.map((a, i) => ({
      kind: a.kind,
      ...(a.kind === 'dash' ? { maxCells: a.dashCells, tick: a.dashTick } : { cells: a.cells.map((c) => [...c]) }),
      telegraph: a.telegraph,
      ...(i > 0 ? { gap: a.gap } : {}),
    })),
    retreat: { home: work.retreat.home.map((c) => [...c]), tick: work.retreat.tick },
  };
}

function exportEnemy(work) {
  const warnings = [];
  const throwFirst = isThrowFirst(work);
  const targets = effectiveTargets(work);
  work.attacks.forEach((a, i) => {
    if (a.kind !== 'dash' && !a.cells.length) warnings.push(`${i + 1}타: 공격 범위가 비어 있습니다.`);
  });
  if (!throwFirst && !targets.length) warnings.push('이동목표가 없어 적이 공격하러 갈 수 없습니다.');
  if (!work.retreat.home.length) warnings.push('복귀 목표가 없습니다.');
  if (!work.damage) warnings.push('공격력이 0입니다.');
  const move = work.chase.method === 'vanish'
    ? { method: 'vanish', vanishSeconds: work.chase.vanish }
    : {
      method: 'shortest',
      stepMode: work.chase.step === 'horizontal' ? 'horizontal-only' : 'any-direction',
      cellsPerMove: work.chase.step === 'horizontal' ? work.chase.n : 1,
      tickSeconds: work.chase.tick,
    };
  return {
    name: work.name,
    game: work.game ? { ...work.game } : null,
    stats: { hp: work.hp, damage: work.damage },
    idle: {
      moves: work.idle.moves,
      moveIntervalSeconds: work.idle.interval,
      durationSeconds: work.idle.duration,
    },
    chase: {
      targetMode: throwFirst ? 'currentPosition' : 'cells',
      targets: targets.map((c) => [...c]),
      targetMap: throwFirst ? null : targetMap(targets),
      refreshTarget: work.chase.refresh,
      move,
    },
    attacks: work.attacks.map((a, i) => ({
      index: i + 1,
      kind: a.kind,
      blockedByObstacles: KINDS[a.kind].blocked,
      anchor: KINDS[a.kind].anchor,
      cells: a.kind === 'dash' ? [] : a.cells.map((c) => [...c]),
      ...(a.kind === 'dash' ? { dash: { maxCells: a.dashCells, tickSeconds: a.dashTick } } : {}),
      telegraphSeconds: a.telegraph,
      gapBeforeSeconds: i === 0 ? 0 : a.gap,
      map: attackMap(a),
    })),
    retreat: {
      homeCells: work.retreat.home.map((c) => [...c]),
      map: homeMap(work.retreat.home),
      tickSeconds: work.retreat.tick,
    },
    gameConfig: gameConfigOf(work),
    needsGameCode: gameCodeNeeds(work),
    warnings,
  };
}

function buildExport(works) {
  return {
    format: '4bit-prototype-enemy-tool/v1',
    exportedAt: new Date().toISOString(),
    howToRead: [
      '4Bit_Prototype 적 제작 툴에서 내보낸 적 데이터다. enemies 배열의 원소 하나가 적 하나다.',
      '행동 순환: idle → chase(Attack 추적) → attacks(Attack 시행) → retreat(복귀) → idle. 시간 단위는 모두 초이고 그리드는 8열 x 4행, 오른쪽이 +열, 아래가 +행이다.',
      'stats: hp와 damage(공격 1회의 공격력). 연속 공격은 타마다 같은 공격력이다.',
      'idle: moves가 true면 moveIntervalSeconds마다 인접 빈칸으로 이동한다(게임과 같이 retreat.homeCells 안에서). false면 이동하지 않는다. durationSeconds가 지나면 chase로 간다.',
      'chase.targetMode: cells면 targets 중 한 칸으로 이동한 뒤 공격한다. currentPosition이면 1타가 던지기라 위치 제한이 없어 이동 없이 그 자리에서 공격하며 targets와 move는 쓰지 않는다.',
      'chase.targets: 플레이어 칸 기준 [열 차이, 행 차이]. 툴이 1타 범위로 계산한 위치에서 사용자가 끄고 켠 최종 결과다. 1타가 적 기준 범위 [a, b]를 가지면 자동 목표는 [-a, -b]이다. 1타가 dash면 플레이어 행에서 돌진으로 닿는 [±1, 0] ~ [±(maxCells + 1), 0]이다. 런타임에는 그리드 안이고 플레이어 칸이 아니고 비어 있는 칸(1타가 막히는 종류면 플레이어까지 경로도 비어 있는 칸) 중 가장 가까운 칸을 고른다. 거리가 같으면 플레이어 행에 가까운 칸, 그다음 오른쪽 칸이다. 고를 칸이 없으면 공격을 포기하지 않고 추적 상태로 남아 계속 다시 찾는다(Idle로 돌아가지 않는다).',
      'chase.refreshTarget: true면 이동할 때마다 목표를 다시 고르고 vanish는 나타나는 순간 고른다. false면 추적을 시작할 때(vanish는 사라질 때) 고른 칸으로 가며, 그 칸에 플레이어가 서거나 막혔을 때만 다시 고른다.',
      'chase.targetMap: 플레이어를 게임 시작 위치(P, 열 1, 행 1)에 둔 그림. T = 이동목표, . = 빈 칸. 이 위치에서 그리드 밖으로 나가는 칸은 그림에 없고 targets에만 있다.',
      'chase.move: method가 shortest면 stepMode가 any-direction일 때 상하좌우 최단 경로로 tickSeconds마다 1칸, horizontal-only일 때 tickSeconds마다 먼저 세로로 1칸씩 목표 행을 맞추고, 그 뒤 가로로 cellsPerMove칸씩 이동한다(남은 거리가 더 짧으면 남은 만큼, 막힌 칸 앞에서 멈추고 다음 틱에 다시 시도). 목표 거리는 세로 칸 수 + ceil(가로 칸 수 / cellsPerMove)로 잰다. method가 vanish면 화면에서 사라졌다가 vanishSeconds 뒤 목표 칸에 나타나고, 나타날 칸이 없으면 숨은 채 기다린다.',
      'attacks: 순서대로 실행하는 공격 목록. index 1이 1타다. 이동목표 계산에는 1타만 쓴다.',
      'attacks[].kind: melee(근접), projectile(발사체), throw(던지기). blockedByObstacles가 true인 projectile은 적 칸에서 대상 칸까지의 직선 경로(양 끝 제외, 각 단계 좌표를 반올림한 칸)에 적이나 장애물이 있으면 그 칸을 맞히지 못한다. 이동목표도 플레이어까지 경로가 막힌 칸은 고르지 않는다. melee와 throw는 막히지 않는다. dash(돌진)는 cells를 쓰지 않고 dash.maxCells(최대 거리, 1~7칸)와 dash.tickSeconds(칸당 시간)를 쓴다. 예고가 시작될 때 플레이어 쪽으로 방향을 정한다(같은 행이면 가로, 같은 열이면 세로, 둘 다 아니면 플레이어 쪽 가로). 예고가 끝나면 tickSeconds마다 1칸씩 일직선으로 나아간다. 예고 칸은 개수가 아니라 예고시간으로 정한다: 출발 뒤 (k - 1) x tickSeconds에 들어가는 k번째 칸은 들어가기 telegraphSeconds 전부터 보이고, 들어가면 사라진다. 그래서 예고 중에는 앞 칸부터 tickSeconds 간격으로 한 칸씩 늘어나고, 달리는 동안에는 telegraphSeconds 안에 들어갈 칸이 모두 보인다. 장애물·그리드 끝·최대 거리 너머와 플레이어 칸 뒤는 보이지 않는다. 다음 칸이 플레이어면 그 앞에서 멈추며 피해를 1번 주고, 장애물·다른 적·그리드 끝·최대 거리에서는 피해 없이 멈춘다. 멈춘 칸이 적의 새 위치다.',
      'attacks[].anchor와 cells: anchor가 enemy면 cells는 적 칸 기준 [열 차이, 행 차이]다. player면 공격 시작 시점의 플레이어 칸 기준이고 throw가 여기에 해당하며 [0, 0]도 범위가 될 수 있다. 범위는 각 타의 예고가 시작되는 순간에 정한다.',
      'attacks[].map: 그림. P = 플레이어(열 1, 행 1), E = 적(열 5, 행 1, anchor가 enemy일 때만), # = 공격 범위, @ = 플레이어 칸이 범위에 포함, . = 빈 칸.',
      'attacks[].telegraphSeconds: 공격 예고 시간. gapBeforeSeconds: 앞 타의 공격이 실행된 순간부터 이 타의 예고가 시작될 때까지의 시간. 1타는 0이다.',
      'retreat.homeCells: 복귀 선호 위치, 그리드 절대 좌표 [열, 행]. 가장 가까운 빈 칸으로 tickSeconds마다 1칸씩 돌아간다. map의 H가 그 칸이다.',
      'game: 게임 등록 정보(key = config.js ENEMIES의 키, family, firstWave). 툴에서 새로 만든 적은 null이다.',
      'gameConfig: 지금 게임 config.js ENEMIES 항목 형식으로 옮긴 값(idle, chase, attacks 전체, retreat). key나 firstWave가 null이면 사용자에게 물어 정한다. 새 적은 renderer.js의 ENEMY_LOOKS에도 모양을 넣는다. 게임은 웨이브가 오를수록 idle 지속시간과 예고시간을 공격 속도만큼 줄인다.',
      'needsGameCode: 지금 게임 코드로는 표현할 수 없어 enemy.js 등의 수정이 필요한 항목. 비어 있으면 gameConfig만 옮기면 동작이 같다. 게임에서 장애물은 다른 적이다.',
      'warnings: 비어 있는 범위 등 확인이 필요한 점. 비어 있으면 문제없다.',
      '불러올 때는 name, game, stats, idle, chase.targets, chase.move, attacks의 kind·cells·telegraphSeconds·gapBeforeSeconds, retreat.homeCells·tickSeconds만 읽는다. 그림과 gameConfig, needsGameCode, warnings는 무시한다. 값을 고칠 때는 읽는 항목만 고치면 된다.',
    ],
    grid: { cols: TOOL.COLS, rows: TOOL.ROWS, examplePlayer: EXAMPLE_PLAYER, exampleEnemy: EXAMPLE_ENEMY },
    enemies: works.map(exportEnemy),
  };
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true, () => copyFallback(text));
  }
  return Promise.resolve(copyFallback(text));
}

function copyFallback(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  area.remove();
  return ok;
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestamp() {
  const d = new Date();
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

$('export').addEventListener('click', () => {
  const status = $('export-status');
  $('import-report').hidden = true;
  const works = state.works.filter((w) => w.checked);
  if (!works.length) {
    status.textContent = '체크된 작업이 없습니다.';
    return;
  }
  const text = JSON.stringify(buildExport(works), null, 2);
  const filename = `enemies-${timestamp()}.json`;
  downloadText(text, filename);
  copyText(text).then((copied) => {
    status.textContent = `${works.length}개 적을 ${filename}로 저장${copied ? '하고 클립보드에 복사했습니다.' : '했습니다. (클립보드 복사 실패)'}`;
  });
});

// ---------------------------------------------------------------- 불러오기

// 마크다운 파일은 맨 아래 ```json 코드블록만 읽는다. 표와 그림은 사람이 읽는 용도다.
function jsonTextOf(text, fileName) {
  if (!/\.(md|markdown)$/i.test(fileName)) return text;
  const blocks = [...text.matchAll(/```json[ \t]*\r?\n([\s\S]*?)\r?\n```/g)];
  if (!blocks.length) throw new Error(`${fileName}: json 코드블록이 없습니다.`);
  return blocks[blocks.length - 1][1];
}

function parseEnemyFile(text, fileName) {
  const jsonText = jsonTextOf(text, fileName);
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`${fileName}: JSON 형식이 아닙니다.`);
  }
  let enemies = null;
  if (data && Array.isArray(data.enemies)) enemies = data.enemies;
  else if (Array.isArray(data)) enemies = data;
  else if (data && Array.isArray(data.attacks)) enemies = [data];
  if (!enemies) throw new Error(`${fileName}: enemies 목록이 없습니다.`);
  const notes = [];
  const works = enemies
    .filter((e) => e && typeof e === 'object')
    .map((e, i) => parseEnemy(e, i, notes));
  return { works, notes };
}

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

// [열, 행] 목록을 검사해 올바른 칸만 중복 없이 돌려준다. 빠진 칸 수는 note로 알린다.
function cleanCells(list, isValid, label, note) {
  const cells = [];
  let dropped = 0;
  for (const cell of Array.isArray(list) ? list : []) {
    const a = Array.isArray(cell) ? Number(cell[0]) : NaN;
    const b = Array.isArray(cell) ? Number(cell[1]) : NaN;
    if (!Number.isInteger(a) || !Number.isInteger(b) || !isValid(a, b)) dropped++;
    else if (!hasCell(cells, a, b)) cells.push([a, b]);
  }
  if (dropped) note(`${label}에서 잘못되었거나 그리드보다 먼 칸 ${dropped}개를 뺐습니다.`);
  return cells;
}

const inRelativeReach = (a, b) => Math.abs(a) < TOOL.COLS && Math.abs(b) < TOOL.ROWS;

// 잘못된 값은 고쳐서 읽고, 고친 내용을 notes에 남긴다.
function parseEnemy(raw, index, notes) {
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 20) : `불러온 적 ${index + 1}`;
  const work = makeWork(name);
  const note = (text) => notes.push(`${name}: ${text}`);
  const num = (value, fallback, min, label) => {
    const v = Number(value);
    if (value === undefined || value === null || !Number.isFinite(v) || v < min) {
      note(`${label} 값이 올바르지 않아 ${fallback}(으)로 정했습니다.`);
      return fallback;
    }
    return v;
  };

  const game = asObject(raw.game);
  if (typeof game.key === 'string' || typeof game.family === 'string' || Number.isInteger(game.firstWave)) {
    work.game = {
      key: typeof game.key === 'string' ? game.key : null,
      family: game.family === 'melee' || game.family === 'ranged' ? game.family : null,
      firstWave: Number.isInteger(game.firstWave) ? game.firstWave : null,
    };
  }

  const stats = asObject(raw.stats);
  work.hp = num(stats.hp, TOOL.DEFAULT_HP, TOOL.MIN_HP, 'HP');
  work.damage = num(stats.damage, TOOL.DEFAULT_DAMAGE, 0, '공격력');

  const idle = asObject(raw.idle);
  work.idle.moves = idle.moves !== false;
  work.idle.interval = num(idle.moveIntervalSeconds, TOOL.DEFAULT_IDLE_INTERVAL, TOOL.MIN_INTERVAL, 'Idle 이동 간격');
  work.idle.duration = num(idle.durationSeconds, TOOL.DEFAULT_IDLE_DURATION, 0, 'Idle 지속시간');

  // 공격을 먼저 읽는다. 이동목표의 자동 칸이 1타 범위에서 나오기 때문이다.
  const rawAttacks = Array.isArray(raw.attacks) ? raw.attacks.filter((a) => a && typeof a === 'object') : [];
  if (rawAttacks.length) {
    work.attacks = rawAttacks.map((rawAttack, i) => {
      const label = `${i + 1}타`;
      let kind = rawAttack.kind;
      if (!KINDS[kind]) {
        note(`${label} 공격 종류를 알 수 없어 근접으로 정했습니다.`);
        kind = 'melee';
      }
      const allowCenter = KINDS[kind].anchor === 'player';
      // 돌진은 범위 칸을 쓰지 않는다
      const cells = kind === 'dash'
        ? []
        : cleanCells(rawAttack.cells, (a, b) => inRelativeReach(a, b) && (allowCenter || a !== 0 || b !== 0), `${label} 범위`, note);
      if (kind !== 'dash' && !cells.length) note(`${label} 공격 범위가 비어 있습니다.`);
      const attack = makeAttack(cells);
      attack.kind = kind;
      if (kind === 'dash') {
        const dash = asObject(rawAttack.dash);
        const maxCells = Number(dash.maxCells);
        if (Number.isInteger(maxCells) && maxCells >= 1 && maxCells < TOOL.COLS) attack.dashCells = maxCells;
        else note(`${label} 돌진 최대 거리가 올바르지 않아 ${TOOL.DEFAULT_DASH_CELLS}(으)로 정했습니다.`);
        attack.dashTick = num(dash.tickSeconds, TOOL.DEFAULT_DASH_TICK, TOOL.MIN_TIME, `${label} 돌진 칸당 시간`);
      }
      attack.telegraph = num(rawAttack.telegraphSeconds, TOOL.DEFAULT_TELEGRAPH, TOOL.MIN_TIME, `${label} 예고시간`);
      attack.gap = i === 0 ? TOOL.DEFAULT_GAP : num(rawAttack.gapBeforeSeconds, TOOL.DEFAULT_GAP, 0, `${label} 사이 시간`);
      return attack;
    });
  } else {
    note('attacks가 없어 기본 공격으로 불러왔습니다.');
  }

  const chase = asObject(raw.chase);
  const move = asObject(chase.move);
  work.chase.refresh = chase.refreshTarget !== false;
  if (move.method === 'vanish') {
    work.chase.method = 'vanish';
    work.chase.vanish = num(move.vanishSeconds, TOOL.DEFAULT_VANISH, 0, '사라짐 시간');
  } else {
    if (move.method !== 'shortest' && !isThrowFirst(work)) note('이동 방법을 알 수 없어 최단거리로 정했습니다.');
    work.chase.tick = move.tickSeconds === undefined && isThrowFirst(work)
      ? TOOL.DEFAULT_TICK
      : num(move.tickSeconds, TOOL.DEFAULT_TICK, TOOL.MIN_TIME, '추적 이동 틱');
    if (move.stepMode === 'horizontal-only') {
      work.chase.step = 'horizontal';
      const n = Number(move.cellsPerMove);
      if (Number.isInteger(n) && n >= 1 && n < TOOL.COLS) work.chase.n = n;
      else note(`가로 이동 칸 수가 올바르지 않아 ${TOOL.DEFAULT_CELLS_PER_MOVE}(으)로 정했습니다.`);
    }
  }
  // 파일의 targets가 원본이다. 자동 칸과 비교해 끈 칸과 켠 칸으로 나눈다.
  if (!isThrowFirst(work) && Array.isArray(chase.targets)) {
    const targets = cleanCells(chase.targets, (a, b) => inRelativeReach(a, b) && (a !== 0 || b !== 0), '이동목표', note);
    const auto = autoTargets(work);
    work.chase.off = auto.filter(([c, r]) => !hasCell(targets, c, r));
    work.chase.on = targets.filter(([c, r]) => !hasCell(auto, c, r));
  }

  const retreat = asObject(raw.retreat);
  if (Array.isArray(retreat.homeCells)) work.retreat.home = cleanCells(retreat.homeCells, inGrid, '복귀 목표', note);
  else note('복귀 목표가 없어 기본값(오른쪽 4x4)으로 정했습니다.');
  work.retreat.tick = num(retreat.tickSeconds, TOOL.DEFAULT_TICK, TOOL.MIN_TIME, '복귀 이동 틱');
  return work;
}

// 이름이 겹치면 '이름 (2)'처럼 번호를 붙인다
function uniqueName(name) {
  const used = new Set(state.works.map((w) => w.name));
  if (!used.has(name)) return name;
  let n = 2;
  while (used.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`${file.name}: 파일을 읽지 못했습니다.`));
    reader.readAsText(file);
  });
}

async function importFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const added = [];
  const notes = [];
  for (const file of files) {
    try {
      const result = parseEnemyFile(await readFileText(file), file.name);
      for (const work of result.works) {
        work.name = uniqueName(work.name);
        state.works.push(work);
        added.push(work);
      }
      notes.push(...result.notes);
    } catch (e) {
      notes.push(e.message);
    }
  }
  if (added.length) {
    state.currentId = added[0].id;
    state.attackIndex = 0;
  }
  changed();
  $('export-status').textContent = added.length
    ? `${added.length}개 적을 불러왔습니다.${notes.length ? ` 고친 점 ${notes.length}개:` : ''}`
    : '불러온 적이 없습니다.';
  const report = $('import-report');
  report.innerHTML = notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('');
  report.hidden = !notes.length;
}

const importInput = $('import-file');
$('import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
  importFiles(importInput.files);
  importInput.value = ''; // 같은 파일을 다시 골라도 불러오도록 비운다
});

// 파일을 화면 어디에나 끌어다 놓으면 불러온다
const dropOverlay = $('drop-overlay');
let dragDepth = 0;
const isFileDrag = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth++;
  dropOverlay.hidden = false;
});
window.addEventListener('dragover', (e) => {
  if (isFileDrag(e)) e.preventDefault();
});
window.addEventListener('dragleave', (e) => {
  if (!isFileDrag(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropOverlay.hidden = true;
});
window.addEventListener('drop', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.hidden = true;
  importFiles(e.dataTransfer.files);
});

// ---------------------------------------------------------------- 시작

window.addEventListener('resize', () => {
  fieldCtx = setupCanvas(fieldCanvas, FIELD_W, FIELD_H);
});

renderList();
renderPanel();

(function frame() {
  if (demo.running) {
    const now = performance.now();
    demo.update(Math.min((now - demo.lastMs) / 1000, TOOL.DEMO_MAX_DT));
    demo.lastMs = now;
    const text = demo.statusText();
    if ($('demo-status').textContent !== text) $('demo-status').textContent = text;
  }
  drawField();
  requestAnimationFrame(frame);
})();
