// 적 공격 텔레그래프. 시간이 다 되면 그 순간 대상 칸에 있는 플레이어에게 데미지를 준다.

class EnemyTelegraph {
  constructor(owner, cells, duration, damage) {
    this.owner = owner;
    this.cells = cells;
    this.duration = duration;
    this.damage = damage;
    this.time = 0;
  }

  get progress() {
    return Math.min(1, this.time / this.duration);
  }

  get finished() {
    return this.time >= this.duration;
  }

  covers(col, row) {
    return this.cells.some((c) => c.col === col && c.row === row);
  }

  update(dt) {
    this.time += dt;
  }
}
