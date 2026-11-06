// 그리드 좌표 계산과 길찾기. 상태는 갖지 않는다.

// 타이머를 줄인다. 부동소수 오차로 틱이 한 스텝 늘어나지 않도록 아주 작은 나머지는 0으로 본다.
function tickDown(timer, dt) {
  const left = timer - dt;
  return left > 1e-9 ? left : 0;
}

const Grid = {
  inBounds(col, row) {
    return col >= 0 && col < CONFIG.GRID_COLS && row >= 0 && row < CONFIG.GRID_ROWS;
  },

  cellX(col) {
    return CONFIG.GRID_X + col * CONFIG.CELL_SIZE;
  },

  cellY(row) {
    return CONFIG.GRID_Y + row * CONFIG.CELL_SIZE;
  },

  emptyCells(isBlocked) {
    const cells = [];
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
      for (let col = 0; col < CONFIG.GRID_COLS; col++) {
        if (!isBlocked(col, row)) cells.push({ col, row });
      }
    }
    return cells;
  },

  // from에서 막히지 않은 칸만 지나 각 칸까지 가는 걸음 수. (col, row) => 걸음 수, 갈 수 없으면 Infinity.
  // from 칸 자체는 막혀 있어도 0이다.
  distances(from, isBlocked) {
    const cols = CONFIG.GRID_COLS;
    const dist = new Array(cols * CONFIG.GRID_ROWS).fill(Infinity);
    dist[from.row * cols + from.col] = 0;
    const queue = [{ col: from.col, row: from.row }];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      const d = dist[node.row * cols + node.col];
      for (const [dc, dr] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        const col = node.col + dc;
        const row = node.row + dr;
        if (!this.inBounds(col, row) || dist[row * cols + col] !== Infinity || isBlocked(col, row)) continue;
        dist[row * cols + col] = d + 1;
        queue.push({ col, row });
      }
    }
    return (col, row) => dist[row * cols + col];
  },

  // 막히지 않은 칸만 지나서 목표에 가장 가까워지는 경로의 첫 걸음을 돌려준다.
  // 이미 가장 가까운 위치면 null.
  stepToward(from, target, isBlocked) {
    const key = (c, r) => r * CONFIG.GRID_COLS + c;
    const dist = (c, r) => Math.abs(c - target.col) + Math.abs(r - target.row);
    const dirs = [[-1, 0], [0, -1], [0, 1], [1, 0]];
    const seen = new Set([key(from.col, from.row)]);
    const queue = [{ col: from.col, row: from.row, first: null }];
    let best = queue[0];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      if (dist(node.col, node.row) < dist(best.col, best.row)) best = node;
      for (const [dc, dr] of dirs) {
        const col = node.col + dc;
        const row = node.row + dr;
        if (!this.inBounds(col, row) || seen.has(key(col, row)) || isBlocked(col, row)) continue;
        seen.add(key(col, row));
        queue.push({ col, row, first: node.first || { col, row } });
      }
    }
    return best.first;
  },
};
