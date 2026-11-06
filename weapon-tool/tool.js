// 무기 제작 툴. 리듬 노드, 노드별 공격 범위와 공격력을 정해 무기를 만들고,
// 4/4 박자 한 사이클을 게임처럼 시연하고, 체크한 무기를 JSON으로 내보낸다.
// 게임(../)과 같은 규칙으로 file:// 에서 돌아가며 외부 라이브러리를 쓰지 않는다.

'use strict';

const TOOL = {
  // 시간: 한 사이클은 4/4 박자 8박이다
  BEAT_SEC: 0.3,
  BEATS: 8,
  // 노드는 0.5박 단위로 0.5박(0.15초)부터 8박(2.4초)까지 놓는다.
  // 8박은 다음 사이클 시작과 같은 순간이라 0초 자리는 두지 않는다.
  // 게임에서도 리듬은 간격이 지난 순간에 오므로 0초에는 오지 않는다.
  SLOTS_PER_BEAT: 2,

  // 그리드 필드: 게임과 같은 8열 x 4행. PLAYER_COL/ROW는 게임 시작 위치(0부터 셈)로,
  // 내보내기의 범위 그림 기준이다. 화면의 플레이어는 드래그로 옮길 수 있다 (state.player).
  COLS: 8,
  ROWS: 4,
  PLAYER_COL: 1,
  PLAYER_ROW: 1,
  CELL: 56,                     // 화면에 그리는 칸 크기 (CSS 픽셀)
  FIELD_PAD: 64,                // 링이 그리드 밖으로 1칸 나갈 수 있어 둘레에 여백을 둔다

  // 시연: 게임의 링 규칙을 따른다. 링은 0.5초에 1칸씩 공격 범위로 줄어든다.
  RING_APPEAR_TIME: 0.5,
  RING_THICKNESS: 4,
  MATCH_FLASH_TIME: 0.15,       // 리듬 순간 범위가 번쩍이는 시간
  BURST_SPREAD: 20,             // 리듬 순간 링이 바깥으로 퍼지는 거리
  LEAD_IN: 0.6,                 // 시연 시작 후 첫 사이클까지의 준비 시간

  // 비트라인
  SLOT_W: 44,
  BEAT_PAD_X: 36,
  BEAT_H: 120,
  BEAT_LINE_Y: 66,
  NODE_R: 13,

  // 새 노드의 기본값
  DEFAULT_DAMAGE: 1,
  DEFAULT_CELLS: [[1, 0]],      // 플레이어 앞 1칸

  STORAGE_KEY: '4bit-weapon-tool.v1',
};
TOOL.SLOTS = TOOL.BEATS * TOOL.SLOTS_PER_BEAT;
TOOL.SLOT_SEC = TOOL.BEAT_SEC / TOOL.SLOTS_PER_BEAT;
TOOL.CYCLE_SEC = TOOL.BEAT_SEC * TOOL.BEATS;

const COLORS = {
  bg: '#12141f',
  cellA: '#1c2030',
  cellB: '#20253a',
  gridLine: '#2c3350',
  player: '#5fd38d',
  playerDark: '#2f8a58',
  text: '#e8ecf5',
  dim: '#8a93ad',
  faint: '#3a4160',
  outline: '#0b0d14',
  flash: '#cfe8ff',
  warn: '#ffc14d',
  playhead: '#4aa8ff',
};

const DRUMS = {
  kick: { key: 'A', label: '쿵', color: '#39ff14' },
  snare: { key: 'S', label: '짝', color: '#c13cff' },
};

// ---------------------------------------------------------------- 상태와 저장

let state = loadState() || freshState();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeWork(name) {
  return { id: uid(), name, checked: true, nodes: [] };
}

function freshState() {
  const work = makeWork('무기 1');
  return { works: [work], currentId: work.id, selectedNodeId: null, paletteDrum: 'kick', player: startPlayer() };
}

// 화면의 플레이어 위치. 모든 무기에 공통인 보기 설정이며 내보내기에는 들어가지 않는다.
function startPlayer() {
  return { col: TOOL.PLAYER_COL, row: TOOL.PLAYER_ROW };
}

function inGrid(col, row) {
  return col >= 0 && col < TOOL.COLS && row >= 0 && row < TOOL.ROWS;
}

function isPlayerCell(col, row) {
  return col === state.player.col && row === state.player.row;
}

// 브라우저 저장소는 막혀 있을 수 있으므로 실패해도 툴은 그대로 동작한다.
function loadState() {
  try {
    const raw = localStorage.getItem(TOOL.STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.works) || !data.works.length) return null;
    if (!data.works.some((w) => w.id === data.currentId)) data.currentId = data.works[0].id;
    if (!DRUMS[data.paletteDrum]) data.paletteDrum = 'kick';
    const p = data.player;
    if (!p || !Number.isInteger(p.col) || !Number.isInteger(p.row) || !inGrid(p.col, p.row)) data.player = startPlayer();
    // 예전 버전의 0초 노드는 같은 순간인 사이클 끝(8박)으로 옮긴다. 그 자리에 이미 노드가 있으면 버린다.
    for (const work of data.works) {
      for (const node of work.nodes) {
        if (node.slot === 0 && !work.nodes.some((n) => n.slot === TOOL.SLOTS)) node.slot = TOOL.SLOTS;
      }
      work.nodes = work.nodes.filter((n) => n.slot >= 1 && n.slot <= TOOL.SLOTS);
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

function selectedNode() {
  const work = currentWork();
  return work.nodes.find((n) => n.id === state.selectedNodeId) || null;
}

function sortedNodes(work) {
  return [...work.nodes].sort((a, b) => a.slot - b.slot);
}

function nodeAtSlot(work, slot) {
  return work.nodes.find((n) => n.slot === slot) || null;
}

// 화면과 내보내기에서 쓰는 박 위치. 사이클 시작부터 지난 박 수다 (0.5 ~ 8).
function beatLabel(slot) {
  return slot / TOOL.SLOTS_PER_BEAT;
}

function slotTime(slot) {
  return round3(slot * TOOL.SLOT_SEC);
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

function changed() {
  saveState();
  renderList();
  renderPanel();
}

// ---------------------------------------------------------------- 편집 동작

function addWork() {
  const used = new Set(state.works.map((w) => w.name));
  let n = state.works.length + 1;
  while (used.has(`무기 ${n}`)) n++;
  const work = makeWork(`무기 ${n}`);
  state.works.push(work);
  openWork(work.id);
  // 새 작업이 목록 맨 아래에 보이도록 스크롤한다
  const list = document.getElementById('work-list');
  list.scrollTop = list.scrollHeight;
}

function openWork(id) {
  state.currentId = id;
  state.selectedNodeId = null;
  demo.reset();
  changed();
}

function deleteWork(id) {
  const work = state.works.find((w) => w.id === id);
  if (!work || !confirm(`'${work.name}' 작업을 삭제할까요?`)) return;
  state.works = state.works.filter((w) => w.id !== id);
  if (!state.works.length) state.works.push(makeWork('무기 1'));
  if (state.currentId === id) {
    state.currentId = state.works[0].id;
    state.selectedNodeId = null;
  }
  changed();
}

function placeNode(slot) {
  const node = {
    id: uid(),
    slot,
    drum: state.paletteDrum,
    damage: TOOL.DEFAULT_DAMAGE,
    cells: TOOL.DEFAULT_CELLS.map((c) => [...c]),
    firstTargetOnly: false,
  };
  currentWork().nodes.push(node);
  state.selectedNodeId = node.id;
  changed();
}

function deleteNode(id) {
  const work = currentWork();
  work.nodes = work.nodes.filter((n) => n.id !== id);
  if (state.selectedNodeId === id) state.selectedNodeId = null;
  changed();
}

function toggleCell(col, row) {
  const node = selectedNode();
  if (!node || isPlayerCell(col, row)) return;
  const dc = col - state.player.col;
  const dr = row - state.player.row;
  const i = node.cells.findIndex(([c, r]) => c === dc && r === dr);
  if (i >= 0) node.cells.splice(i, 1);
  else node.cells.push([dc, dr]);
  changed();
}

function setPalette(drum) {
  state.paletteDrum = drum;
  changed();
}

// ---------------------------------------------------------------- 캔버스 공통

// CSS 크기는 고정 비율로 늘고 줄며, 그리기는 논리 크기 기준으로 한다.
function setupCanvas(canvas, width, height) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function pointerPos(canvas, width, height, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (width / rect.width),
    y: (e.clientY - rect.top) * (height / rect.height),
  };
}

function withAlpha(ctx, alpha, draw) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  draw();
  ctx.restore();
}

// ---------------------------------------------------------------- 그리드 필드

const FIELD_W = TOOL.COLS * TOOL.CELL + TOOL.FIELD_PAD * 2;
const FIELD_H = TOOL.ROWS * TOOL.CELL + TOOL.FIELD_PAD * 2;
const fieldCanvas = document.getElementById('field');
let fieldCtx = setupCanvas(fieldCanvas, FIELD_W, FIELD_H);
let hoverCell = null;

function cellX(col) {
  return TOOL.FIELD_PAD + col * TOOL.CELL;
}

function cellY(row) {
  return TOOL.FIELD_PAD + row * TOOL.CELL;
}

// 노드 범위의 그리드 칸들 (지금 플레이어 위치 기준 절대 좌표, 그리드 안만)
// 플레이어를 옮겨 그리드 밖으로 나간 칸은 화면에서만 빠지고 데이터에는 남는다.
function nodeCells(node) {
  return node.cells
    .map(([dc, dr]) => ({ col: state.player.col + dc, row: state.player.row + dr }))
    .filter((c) => inGrid(c.col, c.row));
}

// 범위 전체를 감싼 직사각형
function cellsBounds(cells) {
  const cols = cells.map((c) => c.col);
  const rows = cells.map((c) => c.row);
  const left = cellX(Math.min(...cols));
  const top = cellY(Math.min(...rows));
  return {
    left,
    top,
    right: cellX(Math.max(...cols)) + TOOL.CELL,
    bottom: cellY(Math.max(...rows)) + TOOL.CELL,
  };
}

function fillCells(ctx, cells, color, alpha) {
  withAlpha(ctx, alpha, () => {
    ctx.fillStyle = color;
    for (const c of cells) ctx.fillRect(cellX(c.col) + 1, cellY(c.row) + 1, TOOL.CELL - 2, TOOL.CELL - 2);
  });
}

function strokeCells(ctx, cells, color, alpha, width) {
  withAlpha(ctx, alpha, () => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    const inset = width / 2 + 1;
    for (const c of cells) {
      ctx.strokeRect(cellX(c.col) + inset, cellY(c.row) + inset, TOOL.CELL - inset * 2, TOOL.CELL - inset * 2);
    }
  });
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
  // 좌표 눈금
  ctx.fillStyle = COLORS.dim;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let col = 0; col < TOOL.COLS; col++) ctx.fillText(col, cellX(col) + TOOL.CELL / 2, cellY(0) - 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < TOOL.ROWS; row++) ctx.fillText(row, cellX(0) - 6, cellY(row) + TOOL.CELL / 2);
}

function drawPlayer(ctx) {
  const x = cellX(state.player.col);
  const y = cellY(state.player.row);
  if (playerDrag) {
    // 드래그 중에는 칸 테두리로 잡고 있음을 보여준다
    strokeCells(ctx, [state.player], COLORS.player, 0.9, 2);
  }
  const m = 12;
  ctx.fillStyle = COLORS.playerDark;
  ctx.fillRect(x + m, y + m, TOOL.CELL - m * 2, TOOL.CELL - m * 2);
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(x + m, y + m, TOOL.CELL - m * 2, TOOL.CELL - m * 2 - 6);
  ctx.fillStyle = COLORS.outline;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', x + TOOL.CELL / 2, y + TOOL.CELL / 2 - 3);
}

// 편집 화면: 선택한 노드의 범위를 노드 색으로 보여준다.
function drawEditRange(ctx) {
  const node = selectedNode();
  if (!node) return;
  const color = DRUMS[node.drum].color;
  const cells = nodeCells(node);
  fillCells(ctx, cells, color, 0.3);
  strokeCells(ctx, cells, color, 0.95, 2);
  if (hoverCell && !playerDrag && !isPlayerCell(hoverCell.col, hoverCell.row)) {
    strokeCells(ctx, [hoverCell], COLORS.text, 0.5, 1);
  }
}

// 게임의 링 모서리 ㄱ자. (x, y)에서 안쪽(dirX, dirY)으로 뻗는다.
function drawCorner(ctx, x, y, dirX, dirY, length, thickness, color) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x + dirX * length, y + dirY * thickness / 2);
    ctx.lineTo(x + dirX * thickness / 2, y + dirY * thickness / 2);
    ctx.lineTo(x + dirX * thickness / 2, y + dirY * length);
  };
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  path();
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = thickness + 2;
  ctx.stroke();
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.stroke();
}

function drawRing(ctx, b, gap, color, alpha) {
  const x0 = b.left - gap;
  const y0 = b.top - gap;
  const x1 = b.right + gap;
  const y1 = b.bottom + gap;
  const length = Math.min(TOOL.CELL / 2, (x1 - x0) / 2, (y1 - y0) / 2);
  withAlpha(ctx, alpha, () => {
    drawCorner(ctx, x0, y0, 1, 1, length, TOOL.RING_THICKNESS, color);
    drawCorner(ctx, x1, y0, -1, 1, length, TOOL.RING_THICKNESS, color);
    drawCorner(ctx, x0, y1, 1, -1, length, TOOL.RING_THICKNESS, color);
    drawCorner(ctx, x1, y1, -1, -1, length, TOOL.RING_THICKNESS, color);
  });
}

// 시연 화면: 다가오는 리듬마다 링이 노드의 공격 범위로 줄어들고, 리듬 순간에 범위가 번쩍인다.
function drawDemo(ctx, t) {
  const events = [];
  for (const node of currentWork().nodes) {
    const cells = nodeCells(node);
    if (!cells.length) continue;
    for (const until of demo.occurrences(node, t)) events.push({ node, cells, until });
  }
  // 범위 채우기: 링이 보이는 동안 점점 진해진다
  for (const { node, cells, until } of events) {
    const color = DRUMS[node.drum].color;
    if (until >= 0) fillCells(ctx, cells, color, 0.22 * (1 - until / TOOL.RING_APPEAR_TIME));
    else fillCells(ctx, cells, color, 0.45 * (1 + until / TOOL.MATCH_FLASH_TIME));
  }
  // 먼 리듬의 링부터 그려 가까운 링이 위에 오게 한다
  events.sort((a, b) => b.until - a.until);
  for (const { node, cells, until } of events) {
    const color = DRUMS[node.drum].color;
    const b = cellsBounds(cells);
    if (until >= 0) {
      const gap = TOOL.CELL * until / TOOL.RING_APPEAR_TIME;
      drawRing(ctx, b, gap, color, 1 - until / TOOL.RING_APPEAR_TIME);
    } else {
      // 리듬 순간: 범위 테두리가 번쩍이고 링이 바깥으로 퍼지며 사라진다
      const p = -until / TOOL.MATCH_FLASH_TIME;
      strokeCells(ctx, cells, COLORS.flash, 1 - p, 4);
      const eased = 1 - (1 - p) * (1 - p);
      drawRing(ctx, b, TOOL.BURST_SPREAD * eased, color, 1 - p);
    }
  }
}

function drawField() {
  const ctx = fieldCtx;
  drawFieldBase(ctx);
  if (demo.running) drawDemo(ctx, demo.time());
  else drawEditRange(ctx);
  drawPlayer(ctx);
}

function fieldCellAt(e) {
  const { x, y } = pointerPos(fieldCanvas, FIELD_W, FIELD_H, e);
  const col = Math.floor((x - TOOL.FIELD_PAD) / TOOL.CELL);
  const row = Math.floor((y - TOOL.FIELD_PAD) / TOOL.CELL);
  if (col < 0 || col >= TOOL.COLS || row < 0 || row >= TOOL.ROWS) return null;
  return { col, row };
}

// 플레이어 칸을 누르면 드래그로 옮기고, 다른 칸을 누르면 범위를 넣고 뺀다.
// 범위는 플레이어 기준 상대 위치라 플레이어를 따라 움직인다.
let playerDrag = false;

function movePlayer(col, row) {
  if (isPlayerCell(col, row)) return;
  state.player = { col, row };
  changed();
}

fieldCanvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const cell = fieldCellAt(e);
  if (!cell) return;
  if (isPlayerCell(cell.col, cell.row)) {
    playerDrag = true;
    fieldCanvas.setPointerCapture(e.pointerId);
    fieldCanvas.style.cursor = 'grabbing';
  } else {
    toggleCell(cell.col, cell.row);
  }
});
fieldCanvas.addEventListener('pointermove', (e) => {
  hoverCell = fieldCellAt(e);
  if (playerDrag) {
    if (hoverCell) movePlayer(hoverCell.col, hoverCell.row);
    return;
  }
  fieldCanvas.style.cursor = hoverCell && isPlayerCell(hoverCell.col, hoverCell.row) ? 'grab' : '';
});
const endPlayerDrag = () => {
  if (!playerDrag) return;
  playerDrag = false;
  fieldCanvas.style.cursor = '';
};
fieldCanvas.addEventListener('pointerup', endPlayerDrag);
fieldCanvas.addEventListener('pointercancel', endPlayerDrag);
fieldCanvas.addEventListener('pointerleave', () => { hoverCell = null; });
// 플레이어를 더블클릭하면 게임 시작 위치로 돌아간다
fieldCanvas.addEventListener('dblclick', (e) => {
  const cell = fieldCellAt(e);
  if (cell && isPlayerCell(cell.col, cell.row)) movePlayer(TOOL.PLAYER_COL, TOOL.PLAYER_ROW);
});

// ---------------------------------------------------------------- 비트라인

const BEAT_W = TOOL.BEAT_PAD_X * 2 + TOOL.SLOTS * TOOL.SLOT_W;
const beatCanvas = document.getElementById('beatline');
let beatCtx = setupCanvas(beatCanvas, BEAT_W, TOOL.BEAT_H);
let hoverSlot = null;

function slotX(slot) {
  return TOOL.BEAT_PAD_X + slot * TOOL.SLOT_W;
}

function drawNode(ctx, x, y, drum, radius, alpha) {
  withAlpha(ctx, alpha, () => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = DRUMS[drum].color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.outline;
    ctx.stroke();
    ctx.fillStyle = COLORS.outline;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(DRUMS[drum].key, x, y + 1);
  });
}

function drawBeatline() {
  const ctx = beatCtx;
  const y = TOOL.BEAT_LINE_Y;
  const work = currentWork();
  ctx.clearRect(0, 0, BEAT_W, TOOL.BEAT_H);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, BEAT_W, TOOL.BEAT_H);

  // 1박마다 번갈아 칠한 띠와 눈금
  for (let beat = 0; beat < TOOL.BEATS; beat++) {
    const x = slotX(beat * TOOL.SLOTS_PER_BEAT);
    ctx.fillStyle = beat % 2 ? '#171a28' : '#1b1f30';
    ctx.fillRect(x, y - 30, TOOL.SLOT_W * TOOL.SLOTS_PER_BEAT, 60);
  }
  ctx.fillStyle = COLORS.gridLine;
  ctx.fillRect(slotX(0), y - 1, slotX(TOOL.SLOTS) - slotX(0), 2);
  ctx.textAlign = 'center';
  for (let slot = 0; slot <= TOOL.SLOTS; slot++) {
    const x = slotX(slot);
    const onBeat = slot % TOOL.SLOTS_PER_BEAT === 0;
    const bar = slot % (TOOL.SLOTS_PER_BEAT * 4) === 0; // 4박마다 마디 구분
    ctx.fillStyle = bar ? COLORS.text : onBeat ? COLORS.dim : COLORS.faint;
    const h = bar ? 30 : onBeat ? 22 : 8;
    ctx.fillRect(x - (bar ? 1 : 0.5), y - h, bar ? 2 : 1, h * 2);
    // 박 번호는 그 박이 끝나는 눈금에 쓴다. 노드도 이 눈금 위에 놓인다.
    if (onBeat && slot > 0) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${slot / TOOL.SLOTS_PER_BEAT}`, x, y - 32);
    }
    if (onBeat) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(`${(slot * TOOL.SLOT_SEC).toFixed(1)}s`, x, y + 34);
    }
  }

  // 빈 자리에 배치할 노드 미리보기
  if (hoverSlot !== null && !nodeAtSlot(work, hoverSlot)) {
    drawNode(ctx, slotX(hoverSlot), y, state.paletteDrum, TOOL.NODE_R, 0.35);
  }

  // 시연 중에는 방금 친 노드가 잠깐 커진다
  const t = demo.running ? demo.time() : null;
  for (const node of sortedNodes(work)) {
    const x = slotX(node.slot);
    let radius = TOOL.NODE_R;
    if (t !== null) {
      const past = demo.occurrences(node, t).find((u) => u < 0);
      if (past !== undefined) radius += 5 * (1 + past / TOOL.MATCH_FLASH_TIME);
    }
    if (node.id === state.selectedNodeId) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    drawNode(ctx, x, y, node.drum, radius, 1);
    if (!node.cells.length) {
      // 범위가 비어 있는 노드는 내보내기 전에 알아볼 수 있게 표시한다
      ctx.fillStyle = COLORS.warn;
      ctx.font = 'bold 11px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x + radius + 4, y - radius);
    }
  }

  // 재생 헤드
  if (t !== null && t >= 0) {
    const x = slotX(0) + (t % TOOL.CYCLE_SEC) / TOOL.SLOT_SEC * TOOL.SLOT_W;
    ctx.fillStyle = COLORS.playhead;
    ctx.fillRect(x - 1, y - 36, 3, 72);
  }
}

function slotAt(e) {
  const { x, y } = pointerPos(beatCanvas, BEAT_W, TOOL.BEAT_H, e);
  if (Math.abs(y - TOOL.BEAT_LINE_Y) > 32) return null;
  const slot = Math.round((x - TOOL.BEAT_PAD_X) / TOOL.SLOT_W);
  if (slot < 1 || slot > TOOL.SLOTS) return null;
  return slot;
}

beatCanvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const slot = slotAt(e);
  if (slot === null) return;
  const node = nodeAtSlot(currentWork(), slot);
  if (node) {
    state.selectedNodeId = node.id;
    changed();
  } else {
    placeNode(slot);
  }
});
beatCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const slot = slotAt(e);
  const node = slot === null ? null : nodeAtSlot(currentWork(), slot);
  if (node) deleteNode(node.id);
});
beatCanvas.addEventListener('pointermove', (e) => { hoverSlot = slotAt(e); });
beatCanvas.addEventListener('pointerleave', () => { hoverSlot = null; });

// ---------------------------------------------------------------- 시연과 소리

const Sound = {
  ctx: null,

  // 브라우저 정책상 AudioContext는 사용자 입력 이후에 만든다
  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  envelope(peak, dur) {
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    gain.connect(this.ctx.destination);
    return gain;
  },

  kick() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    osc.connect(this.envelope(0.6, 0.16));
    osc.start(now);
    osc.stop(now + 0.17);
  },

  snare() {
    const now = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * 0.15);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500;
    noise.connect(filter);
    filter.connect(this.envelope(0.35, 0.14));
    noise.start(now);
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 220;
    osc.connect(this.envelope(0.25, 0.07));
    osc.start(now);
    osc.stop(now + 0.08);
  },

  click(strong) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = strong ? 1600 : 1100;
    osc.connect(this.envelope(strong ? 0.06 : 0.035, 0.03));
    osc.start(now);
    osc.stop(now + 0.04);
  },

  play(name, ...args) {
    if (!this.ctx || !document.getElementById('demo-sound').checked) return;
    this[name](...args);
  },
};

const demo = {
  running: false,
  startMs: 0,
  lastT: 0,

  // 사이클 시작(0초)부터의 시간. 준비 시간 동안은 음수다.
  time() {
    return (performance.now() - this.startMs) / 1000 - TOOL.LEAD_IN;
  },

  start() {
    Sound.ensure();
    this.running = true;
    this.startMs = performance.now();
    this.lastT = this.time();
    renderPanel();
  },

  stop() {
    this.running = false;
    renderPanel();
  },

  toggle() {
    if (this.running) this.stop();
    else this.start();
  },

  // 무기를 바꾸면 시연을 처음부터 다시 한다
  reset() {
    if (this.running) this.start();
  },

  // 시각 t 기준으로 화면에 보여야 할 이 노드의 리듬들. 값은 리듬까지 남은 시간이다.
  // 링이 보이는 0 ~ RING_APPEAR_TIME과, 방금 지나 번쩍이는 -MATCH_FLASH_TIME ~ 0을 돌려준다.
  occurrences(node, t) {
    const at = slotTime(node.slot);
    const result = [];
    const first = Math.max(0, Math.floor((t - at - TOOL.MATCH_FLASH_TIME) / TOOL.CYCLE_SEC));
    for (let k = first; k <= first + 2; k++) {
      const until = at + k * TOOL.CYCLE_SEC - t;
      if (until >= -TOOL.MATCH_FLASH_TIME && until <= TOOL.RING_APPEAR_TIME) result.push(until);
    }
    return result;
  },

  // 지난 프레임과 이번 프레임 사이에 지나간 리듬과 박을 소리로 낸다.
  update() {
    if (!this.running) return;
    const t = this.time();
    const from = this.lastT;
    this.lastT = t;
    if (t <= from) return;
    const crossed = (at) => {
      const k = Math.floor((t - at) / TOOL.CYCLE_SEC);
      const hit = at + k * TOOL.CYCLE_SEC;
      return k >= 0 && hit > from && hit <= t;
    };
    if (document.getElementById('demo-metronome').checked) {
      for (let beat = 0; beat < TOOL.BEATS; beat++) {
        if (crossed(beat * TOOL.BEAT_SEC)) Sound.play('click', beat % 4 === 0);
      }
    }
    for (const node of currentWork().nodes) {
      if (crossed(slotTime(node.slot))) Sound.play(node.drum);
    }
  },
};

// ---------------------------------------------------------------- 왼쪽 목록

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderList() {
  const list = document.getElementById('work-list');
  list.innerHTML = state.works.map((work) => {
    const slots = Array.from({ length: TOOL.SLOTS }, (_, i) => {
      const node = nodeAtSlot(work, i + 1);
      return `<span class="${node ? node.drum : ''}"></span>`;
    }).join('');
    return `<li class="work-item${work.id === state.currentId ? ' active' : ''}" data-id="${work.id}">
      <input type="checkbox" class="pick" ${work.checked ? 'checked' : ''} title="내보내기에 포함">
      <span class="name">${escapeHtml(work.name || '(이름 없음)')}</span>
      <button class="del" title="작업 삭제">×</button>
      <span class="meta">노드 ${work.nodes.length}개</span>
      <div class="mini">${slots}</div>
    </li>`;
  }).join('');
  const all = document.getElementById('check-all');
  const checkedCount = state.works.filter((w) => w.checked).length;
  all.checked = checkedCount === state.works.length;
  all.indeterminate = checkedCount > 0 && checkedCount < state.works.length;
}

document.getElementById('work-list').addEventListener('click', (e) => {
  const item = e.target.closest('.work-item');
  if (!item) return;
  const work = state.works.find((w) => w.id === item.dataset.id);
  if (e.target.classList.contains('pick')) {
    work.checked = e.target.checked;
    changed();
  } else if (e.target.classList.contains('del')) {
    deleteWork(work.id);
  } else if (work.id !== state.currentId) {
    openWork(work.id);
  }
});

document.getElementById('check-all').addEventListener('change', (e) => {
  for (const work of state.works) work.checked = e.target.checked;
  changed();
});

document.getElementById('add-work').addEventListener('click', addWork);

// ---------------------------------------------------------------- 오른쪽 패널

const nameInput = document.getElementById('weapon-name');
const damageInput = document.getElementById('node-damage');
const firstInput = document.getElementById('node-first');

function renderPanel() {
  const work = currentWork();
  // 입력 중인 칸은 값을 덮어쓰지 않는다
  if (document.activeElement !== nameInput) nameInput.value = work.name;
  const total = work.nodes.reduce((sum, n) => sum + n.damage, 0);
  document.getElementById('weapon-stat').textContent =
    `노드 ${work.nodes.length}개 · 사이클 공격력 합 ${round3(total)} · 초당 ${round3(total / TOOL.CYCLE_SEC)}`;

  const node = selectedNode();
  document.getElementById('node-empty').hidden = !!node;
  document.getElementById('node-edit').hidden = !node;
  if (node) {
    const order = sortedNodes(work).indexOf(node) + 1;
    document.getElementById('node-title').textContent =
      `노드 ${order} / ${work.nodes.length} · ${beatLabel(node.slot)}박 (${slotTime(node.slot).toFixed(2)}초)`;
    for (const button of document.querySelectorAll('[data-set-drum]')) {
      button.classList.toggle('on', button.dataset.setDrum === node.drum);
    }
    if (document.activeElement !== damageInput) damageInput.value = node.damage;
    firstInput.checked = node.firstTargetOnly;
    const count = node.cells.length;
    const hidden = count - nodeCells(node).length;
    document.getElementById('node-range-info').textContent = count
      ? `공격 범위 ${count}칸${hidden ? ` (지금 위치에서 ${hidden}칸은 그리드 밖이라 안 보임)` : ''}. 위 그리드에서 칸을 클릭해 넣고 뺍니다.`
      : '공격 범위가 비어 있습니다. 위 그리드에서 칸을 클릭하세요.';
  }

  for (const button of document.querySelectorAll('[data-palette]')) {
    button.classList.toggle('on', button.dataset.palette === state.paletteDrum);
  }
  document.getElementById('demo-toggle').textContent = demo.running ? '■ 정지' : '▶ 시연';
  const p = state.player;
  const playerText = `P = 플레이어 (열 ${p.col}, 행 ${p.row}) · P 드래그: 이동, 더블클릭: 시작 위치로`;
  document.getElementById('field-hint').textContent = node
    ? `${DRUMS[node.drum].label}(${DRUMS[node.drum].key}) 노드의 공격 범위를 편집 중 · 칸 클릭으로 넣고 빼기 · ${playerText}`
    : `비트라인에서 노드를 선택하면 공격 범위를 지정할 수 있습니다 · ${playerText}`;
}

nameInput.addEventListener('input', () => {
  currentWork().name = nameInput.value;
  saveState();
  renderList();
});

damageInput.addEventListener('input', () => {
  const node = selectedNode();
  const value = parseFloat(damageInput.value);
  if (!node || !Number.isFinite(value) || value < 0) return;
  node.damage = value;
  changed();
});
damageInput.addEventListener('change', () => {
  // 잘못된 값을 남기고 나가면 마지막 올바른 값으로 되돌린다
  damageInput.blur();
  renderPanel();
});

firstInput.addEventListener('change', () => {
  const node = selectedNode();
  if (!node) return;
  node.firstTargetOnly = firstInput.checked;
  changed();
});

for (const button of document.querySelectorAll('[data-set-drum]')) {
  button.addEventListener('click', () => {
    const node = selectedNode();
    if (!node) return;
    node.drum = button.dataset.setDrum;
    changed();
  });
}
for (const button of document.querySelectorAll('[data-palette]')) {
  button.addEventListener('click', () => setPalette(button.dataset.palette));
}

document.getElementById('node-clear-range').addEventListener('click', () => {
  const node = selectedNode();
  if (!node) return;
  node.cells = [];
  changed();
});
document.getElementById('node-delete').addEventListener('click', () => {
  const node = selectedNode();
  if (node) deleteNode(node.id);
});
document.getElementById('demo-toggle').addEventListener('click', () => demo.toggle());

// ---------------------------------------------------------------- 키보드

window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const typing = (tag === 'INPUT' && e.target.type !== 'checkbox') || tag === 'TEXTAREA';
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyA') setPalette('kick');
  else if (e.code === 'KeyS') setPalette('snare');
  else if (e.code === 'Space') {
    e.preventDefault();
    demo.toggle();
  } else if (e.code === 'Delete' || e.code === 'Backspace') {
    const node = selectedNode();
    if (node) deleteNode(node.id);
  } else if (e.code === 'Escape') {
    state.selectedNodeId = null;
    changed();
  }
});

// ---------------------------------------------------------------- 내보내기

// 노드별 범위를 그리드 그림으로. P = 플레이어, # = 공격 범위, . = 빈 칸
function rangeMap(node) {
  const rows = [];
  for (let row = 0; row < TOOL.ROWS; row++) {
    let line = '';
    for (let col = 0; col < TOOL.COLS; col++) {
      const inRange = node.cells.some(([dc, dr]) => TOOL.PLAYER_COL + dc === col && TOOL.PLAYER_ROW + dr === row);
      line += col === TOOL.PLAYER_COL && row === TOOL.PLAYER_ROW ? 'P' : inRange ? '#' : '.';
    }
    rows.push(line);
  }
  return rows;
}

// 0.5박 칸을 1박씩 묶은 리듬 그림. 한 박은 (그 박의 0.5박, 그 박 끝) 두 글자다. A = 쿵, S = 짝, . = 쉼
function patternText(work) {
  const beats = [];
  for (let beat = 0; beat < TOOL.BEATS; beat++) {
    let text = '';
    for (let i = 1; i <= TOOL.SLOTS_PER_BEAT; i++) {
      const node = nodeAtSlot(work, beat * TOOL.SLOTS_PER_BEAT + i);
      text += node ? DRUMS[node.drum].key : '.';
    }
    beats.push(text);
  }
  return beats.join(' ');
}

// 게임 config.js WEAPONS 형식의 리듬 값. 리듬 i는 intervals[i]가 지난 순간에 오고,
// 사이클이 2.4초가 되도록 첫 간격에 마지막 리듬에서 사이클 끝까지의 시간을 더한다.
// startOffset만큼 이미 지난 상태로 시작하므로 첫 리듬은 노드 위치에 온다.
// 마지막 노드가 8박(2.4초)이면 startOffset은 0이고 간격은 노드 사이 시간 그대로다.
function gameRhythm(nodes) {
  if (!nodes.length) return null;
  const times = nodes.map((n) => slotTime(n.slot));
  const last = times[times.length - 1];
  const intervals = times.map((t, i) => round3(i === 0 ? t + TOOL.CYCLE_SEC - last : t - times[i - 1]));
  return {
    intervals,
    startOffset: round3(TOOL.CYCLE_SEC - last),
    drums: nodes.map((n) => n.drum),
    damages: nodes.map((n) => n.damage),
    ranges: nodes.map((n) => ({ cells: n.cells.map((c) => [...c]), firstTargetOnly: n.firstTargetOnly })),
  };
}

function exportWeapon(work) {
  const nodes = sortedNodes(work);
  const warnings = [];
  if (!nodes.length) warnings.push('노드가 없습니다.');
  nodes.forEach((n, i) => {
    if (!n.cells.length) warnings.push(`노드 ${i + 1} (${beatLabel(n.slot)}박): 공격 범위가 비어 있습니다.`);
    if (!n.damage) warnings.push(`노드 ${i + 1} (${beatLabel(n.slot)}박): 공격력이 0입니다.`);
  });
  return {
    name: work.name,
    pattern: patternText(work),
    nodes: nodes.map((n, i) => ({
      index: i + 1,
      beat: beatLabel(n.slot),
      time: slotTime(n.slot),
      drum: n.drum,
      key: DRUMS[n.drum].key,
      damage: n.damage,
      range: {
        cells: n.cells.map((c) => [...c]),
        firstTargetOnly: n.firstTargetOnly,
        map: rangeMap(n),
      },
    })),
    gameConfig: gameRhythm(nodes),
    warnings,
  };
}

function buildExport(works) {
  return {
    format: '4bit-prototype-weapon-tool/v1',
    exportedAt: new Date().toISOString(),
    howToRead: [
      '4Bit_Prototype 무기 제작 툴에서 내보낸 플레이어 무기 데이터다.',
      '한 사이클은 4/4 박자 8박 = 2.4초다 (1박 0.3초). 사이클은 끝나면 처음부터 반복된다.',
      'nodes는 시간순이다. beat는 사이클 시작부터 지난 박 수(0.5, 1, ..., 8)이고 time은 그 초(0.15 ~ 2.4)다. 노드는 0.5박 단위이며 0초 자리는 없다. 8박(2.4초)은 사이클 끝이자 다음 사이클 시작과 같은 순간이다. 게임에서 리듬이 간격이 지난 순간에 오는 것과 같다.',
      'drum: kick = 쿵 (A키, 형광 초록 링), snare = 짝 (S키, 형광 보라 링). 게임 config.js WEAPONS의 drums와 같은 값이다.',
      'damage: 그 리듬의 기본 공격력. 게임에서는 여기에 판정 배율(Perfect 1.25, Good 1)이 곱해진다.',
      'range.cells: 플레이어 칸 기준 [열 차이, 행 차이]. 오른쪽이 +열, 아래가 +행이다. 게임 WEAPONS.range.cells와 같은 형식이다.',
      'range.firstTargetOnly: true면 범위 안에서 플레이어에게 가장 가까운 적 1명만 맞는다 (게임의 firstTargetOnly).',
      'range.map: 8열 x 4행 그리드 그림. P = 게임 시작 위치의 플레이어 (열 1, 행 1, 0부터 셈), # = 공격 범위, . = 빈 칸. 이 위치에서 그리드 밖으로 나가는 칸은 그림에는 없고 cells에만 있다.',
      'pattern: 1박씩 띄어 쓴 리듬 그림. 한 박은 두 글자로 앞 글자는 그 박의 절반(0.5박), 뒤 글자는 그 박 끝이다. A = 쿵, S = 짝, . = 쉼. 예: 한손검은 ".. .A .. .S .. .A .. .S"',
      'gameConfig: 게임 config.js WEAPONS에 옮길 때 쓰는 값. intervals, startOffset, drums, damages는 게임과 같은 의미다. ranges는 노드별 공격 범위 배열(노드 순서)이며 게임 WEAPONS.ranges에 그대로 넣는다. 그 경우 range에는 ranges에 없는 리듬이 쓸 기본 범위를 둔다. 쿨다운과 판정 윈도우는 모든 무기에 같은 게임 공통 값(ATTACK_COOLDOWN, ATTACK_MISS_COOLDOWN, JUDGE)이라 무기에 넣지 않는다.',
      'warnings: 비어 있는 범위 등 확인이 필요한 점. 비어 있으면 문제없다.',
    ],
    timing: {
      beatSeconds: TOOL.BEAT_SEC,
      beatsPerCycle: TOOL.BEATS,
      cycleSeconds: TOOL.CYCLE_SEC,
      nodeStepBeats: 1 / TOOL.SLOTS_PER_BEAT,
    },
    grid: { cols: TOOL.COLS, rows: TOOL.ROWS, player: { col: TOOL.PLAYER_COL, row: TOOL.PLAYER_ROW } },
    weapons: works.map(exportWeapon),
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

document.getElementById('export').addEventListener('click', () => {
  const status = document.getElementById('export-status');
  document.getElementById('import-report').hidden = true;
  const works = state.works.filter((w) => w.checked);
  if (!works.length) {
    status.textContent = '체크된 작업이 없습니다.';
    return;
  }
  const text = JSON.stringify(buildExport(works), null, 2);
  const filename = `weapons-${timestamp()}.json`;
  downloadText(text, filename);
  copyText(text).then((copied) => {
    status.textContent = `${works.length}개 무기를 ${filename}로 저장${copied ? '하고 클립보드에 복사했습니다.' : '했습니다. (클립보드 복사 실패)'}`;
  });
});

// ---------------------------------------------------------------- 불러오기

// 내보낸 JSON(또는 같은 양식)을 읽어 무기 작업으로 만든다. 잘못된 값은 고쳐서 읽고, 고친 내용을 notes에 남긴다.
// 박 위치는 time(초)을 먼저 쓴다. 예전 버전 파일은 beat를 1부터 셌기 때문에 time이 더 확실하다.
function parseWeaponFile(text, fileName) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`${fileName}: JSON 형식이 아닙니다.`);
  }
  let weapons = null;
  if (data && Array.isArray(data.weapons)) weapons = data.weapons;
  else if (Array.isArray(data)) weapons = data;
  else if (data && Array.isArray(data.nodes)) weapons = [data];
  if (!weapons) throw new Error(`${fileName}: weapons 목록이 없습니다.`);
  const notes = [];
  const works = weapons
    .filter((w) => w && typeof w === 'object')
    .map((w, i) => parseWeapon(w, i, notes));
  return { works, notes };
}

function parseWeapon(raw, index, notes) {
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 20) : `불러온 무기 ${index + 1}`;
  const work = makeWork(name);
  const note = (where, text) => notes.push(`${name}${where ? ` ${where}` : ''}: ${text}`);
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  if (!Array.isArray(raw.nodes)) note('', 'nodes가 없어 빈 무기로 불러왔습니다.');

  rawNodes.forEach((rawNode, i) => {
    const where = `노드 ${i + 1}`;
    if (!rawNode || typeof rawNode !== 'object') {
      note(where, '노드 형식이 아니라 뺐습니다.');
      return;
    }
    // 위치: time(초) → 0.5박 칸
    let seconds = Number(rawNode.time);
    if (!Number.isFinite(seconds)) seconds = Number(rawNode.beat) * TOOL.BEAT_SEC;
    if (!Number.isFinite(seconds)) {
      note(where, '위치(time, beat)가 없어 뺐습니다.');
      return;
    }
    const exact = seconds / TOOL.SLOT_SEC;
    let slot = Math.round(exact);
    if (Math.abs(exact - slot) > 1e-6) {
      note(where, `${round3(seconds)}초를 0.5박 단위인 ${slotTime(slot)}초로 맞췄습니다.`);
    }
    if (slot === 0) {
      slot = TOOL.SLOTS;
      note(where, '0초 노드를 같은 순간인 8박(2.4초)으로 옮겼습니다.');
    }
    if (slot < 1 || slot > TOOL.SLOTS) {
      note(where, `${round3(seconds)}초는 사이클(0.15 ~ 2.4초) 밖이라 뺐습니다.`);
      return;
    }
    const at = `${where} (${beatLabel(slot)}박)`;
    if (nodeAtSlot(work, slot)) {
      note(at, '같은 자리에 노드가 이미 있어 뺐습니다.');
      return;
    }

    // 드럼: drum 값, 없으면 key(A/S)
    let drum = DRUMS[rawNode.drum] ? rawNode.drum : null;
    if (!drum) drum = Object.keys(DRUMS).find((d) => DRUMS[d].key === String(rawNode.key).toUpperCase()) || null;
    if (!drum) {
      note(at, '드럼 종류(kick/snare)를 알 수 없어 뺐습니다.');
      return;
    }

    let damage = Number(rawNode.damage);
    if (!Number.isFinite(damage) || damage < 0) {
      note(at, `공격력이 올바르지 않아 ${TOOL.DEFAULT_DAMAGE}로 정했습니다.`);
      damage = TOOL.DEFAULT_DAMAGE;
    }

    const range = rawNode.range && typeof rawNode.range === 'object' ? rawNode.range : {};
    const cells = [];
    let dropped = 0;
    for (const cell of Array.isArray(range.cells) ? range.cells : []) {
      const dc = Array.isArray(cell) ? Number(cell[0]) : NaN;
      const dr = Array.isArray(cell) ? Number(cell[1]) : NaN;
      // 플레이어를 옮겨 가며 범위를 찍을 수 있으므로, 플레이어가 그리드 어딘가에 있을 때
      // 그리드 안에 들어올 수 있는 상대 위치면 받는다 (열 차이 ±7, 행 차이 ±3).
      const valid = Number.isInteger(dc) && Number.isInteger(dr)
        && Math.abs(dc) < TOOL.COLS && Math.abs(dr) < TOOL.ROWS
        && !(dc === 0 && dr === 0);
      if (!valid) dropped++;
      else if (!cells.some(([c, r]) => c === dc && r === dr)) cells.push([dc, dr]);
    }
    if (dropped) note(at, `그리드보다 멀거나 잘못된 범위 칸 ${dropped}개를 뺐습니다.`);
    if (!cells.length) note(at, '공격 범위가 비어 있습니다.');

    work.nodes.push({
      id: uid(),
      slot,
      drum,
      damage,
      cells,
      firstTargetOnly: range.firstTargetOnly === true,
    });
  });
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
      const result = parseWeaponFile(await readFileText(file), file.name);
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
    state.selectedNodeId = null;
    demo.reset();
  }
  changed();
  document.getElementById('export-status').textContent = added.length
    ? `${added.length}개 무기를 불러왔습니다.${notes.length ? ` 고친 점 ${notes.length}개:` : ''}`
    : '불러온 무기가 없습니다.';
  const report = document.getElementById('import-report');
  report.innerHTML = notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('');
  report.hidden = !notes.length;
}

const importInput = document.getElementById('import-file');
document.getElementById('import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
  importFiles(importInput.files);
  importInput.value = ''; // 같은 파일을 다시 골라도 불러오도록 비운다
});

// 파일을 화면 어디에나 끌어다 놓으면 불러온다
const dropOverlay = document.getElementById('drop-overlay');
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
  beatCtx = setupCanvas(beatCanvas, BEAT_W, TOOL.BEAT_H);
});

renderList();
renderPanel();

(function frame() {
  demo.update();
  drawField();
  drawBeatline();
  requestAnimationFrame(frame);
})();
