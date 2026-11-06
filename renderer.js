// 모든 그리기 코드. 도형은 저해상도 버퍼에 그려 정수배로 확대하고,
// 글자는 작은 크기에서 한글이 뭉개지므로 확대 후 화면 해상도로 그린다.

const COLORS = {
  bg: '#12141f',
  cellA: '#1c2030',
  cellB: '#20253a',
  gridLine: '#2c3350',
  player: '#5fd38d',
  playerDark: '#2f8a58',
  text: '#e8ecf5',
  dim: '#8a93ad',
  ring: '#4aa8ff',
  ringKick: '#39ff14',          // 쿵: 형광 초록
  ringSnare: '#c13cff',         // 짝: 형광 보라
  ringTarget: '#2f4f7f',
  ringFlash: '#cfe8ff',
  ringGoal: '#ffffff',          // 공격 키를 눌렀을 때 나타나는 범위 테두리
  ringOutline: '#0b0d14',
  telegraphBase: '#3a1c24',
  telegraphEdge: '#ff5a5f',
  impact: '#ff8a80',
  enemyHp: '#ff7b7b',
  particle: '#ffe066',
  debugGood: '#2f8a58',
  debugPerfect: '#c9a93a',
};

// marks는 몸통 위에 dark 색으로 그리는 무기 표시. [x, y, 너비, 높이]는 칸 안의 위치.
const ENEMY_LOOKS = {
  sword: { body: '#e0555c', dark: '#9c2f3a', marks: [[3, 15, 4, 2]] },
  spear: { body: '#e0609e', dark: '#99366a', marks: [[0, 15, 7, 2]] },
  twinblade: { body: '#b06be0', dark: '#6f3a99', marks: [[3, 9, 4, 2], [3, 19, 4, 2]] },
  greatsword: { body: '#b5474f', dark: '#6e2229', marks: [[2, 7, 5, 18]] },
  archer: { body: '#e08a3c', dark: '#a05a1e', marks: [[2, 16, 5, 3]] },
  shotgun: { body: '#d9b63a', dark: '#94781c', marks: [[2, 13, 5, 8]] },
  mortar: { body: '#9aa36a', dark: '#5f6638', marks: [[15, 8, 8, 8]] },
  beam: { body: '#4fc3c9', dark: '#2a7f84', marks: [[3, 10, 4, 2], [3, 15, 4, 2], [3, 20, 4, 2]] },
};

const TELEGRAPH_FILLS = { melee: '#a8323e', ranged: '#b5482c' };

const RARITY_LOOKS = {
  common: { label: '일반', color: '#8a93ad' },
  rare: { label: '희귀', color: '#4aa8ff' },
  epic: { label: '영웅', color: '#c77dff' },
  weapon: { label: '무기', color: '#ffc14d' },
};

// 무기 티어별 카드 색
const TIER_COLORS = { 1: '#8a93ad', 2: '#4aa8ff', 3: '#c77dff', 4: '#ffc14d' };

const POPUP_STYLES = {
  perfect: { label: 'Perfect', size: 11, color: '#ffe066' },
  good: { label: 'Good', size: 9, color: COLORS.ringFlash },
  miss: { label: 'Miss', size: 9, color: '#9aa3b8' },
};

const PLAYER_TOP = 6; // 칸 위쪽에서 플레이어 몸통까지의 거리

const FONT_FAMILY ='"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

function drumColor(drum) {
  return drum === 'snare' ? COLORS.ringSnare : COLORS.ringKick;
}

// 공격 범위 칸들이 이루는 모양의 바깥으로 튀어나온 모서리. 링의 ㄱ자는 이 모서리에만 놓인다.
// 안쪽으로 꺾인 모서리에는 ㄱ자가 맞물릴 수 없으므로 뺀다.
// x, y는 모서리 좌표(내부 해상도 픽셀), dirX, dirY는 범위 안쪽 방향(1 또는 -1).
function rangeCorners(cells) {
  const size = CONFIG.CELL_SIZE;
  const has = new Set(cells.map((c) => `${c.col},${c.row}`));
  const corners = [];
  for (const key of has) {
    const [col, row] = key.split(',').map(Number);
    for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (has.has(`${col + ox},${row}`) || has.has(`${col},${row + oy}`)) continue;
      corners.push({
        x: Grid.cellX(col) + (ox > 0 ? size : 0),
        y: Grid.cellY(row) + (oy > 0 ? size : 0),
        dirX: -ox,
        dirY: -oy,
      });
    }
  }
  return corners;
}

class Renderer {
  constructor(canvas) {
    this.screen = canvas;
    this.screenCtx = canvas.getContext('2d');
    this.buffer = document.createElement('canvas');
    this.buffer.width = CONFIG.VIEW_WIDTH;
    this.buffer.height = CONFIG.VIEW_HEIGHT;
    this.ctx = this.buffer.getContext('2d');
    this.scale = 1;
    this.texts = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.scale = Math.max(1, Math.floor(Math.min(
      window.innerWidth * dpr / CONFIG.VIEW_WIDTH,
      window.innerHeight * dpr / CONFIG.VIEW_HEIGHT
    )));
    this.screen.width = CONFIG.VIEW_WIDTH * this.scale;
    this.screen.height = CONFIG.VIEW_HEIGHT * this.scale;
    this.screen.style.width = this.screen.width / dpr + 'px';
    this.screen.style.height = this.screen.height / dpr + 'px';
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // 안쪽으로 thickness만큼 두꺼운 테두리
  frame(x, y, w, h, color, thickness = 1) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, thickness);
    this.ctx.fillRect(x, y + h - thickness, w, thickness);
    // 반투명일 때 모서리가 진해지지 않도록 가로 변과 겹치지 않게 그린다
    this.ctx.fillRect(x, y + thickness, thickness, h - thickness * 2);
    this.ctx.fillRect(x + w - thickness, y + thickness, thickness, h - thickness * 2);
  }

  // 좌표와 크기는 내부 해상도 기준. 프레임 끝에 한 번에 그려진다.
  text(str, x, y, size, color, align = 'left', alpha = 1) {
    this.texts.push({ str, x, y, size, color, align, alpha });
  }

  // maxWidth(내부 해상도 픽셀) 안에 들어가는 글자 크기. maxSize보다 크게 하지 않는다.
  fitTextSize(str, maxWidth, maxSize) {
    const ctx = this.screenCtx;
    ctx.font = `bold 10px ${FONT_FAMILY}`;
    const perSize = ctx.measureText(str).width / 10;
    return Math.min(maxSize, Math.floor(maxWidth / perSize * 2) / 2);
  }

  flushTexts() {
    const ctx = this.screenCtx;
    ctx.textBaseline = 'top';
    for (const t of this.texts) {
      ctx.font = `bold ${t.size * this.scale}px ${FONT_FAMILY}`;
      ctx.textAlign = t.align;
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = '#000';
      const sx = t.x * this.scale;
      const sy = t.y * this.scale;
      ctx.fillText(t.str, sx + this.scale * 0.5, sy + this.scale * 0.5);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, sx, sy);
    }
    ctx.globalAlpha = 1;
    this.texts = [];
  }

  draw(game) {
    this.rect(0, 0, CONFIG.VIEW_WIDTH, CONFIG.VIEW_HEIGHT, COLORS.bg);
    if (game.state === 'title') {
      this.drawTitle();
    } else if (game.state === 'weaponSelect') {
      this.drawWeaponSelect(game);
    } else {
      this.drawWorld(game);
      if (game.state === 'play') {
        this.drawRingKeys(game.player);
        this.drawPopups(game);
        this.drawHud(game);
        if (game.debug) this.drawDebug(game);
      }
      if (game.state === 'reward') this.drawRewardScreen(game);
      if (game.state === 'gameover') this.drawGameOver(game);
    }
    this.present(game);
  }

  drawWorld(game) {
    this.drawGrid();
    this.drawTelegraphs(game);
    for (const enemy of game.enemies) this.drawEnemy(enemy);
    this.drawPlayer(game.player);
    this.drawRing(game.player);
    this.drawRingBursts(game);
    this.drawImpacts(game);
    for (const p of game.particles) this.rect(p.x - 1, p.y - 1, 2, 2, COLORS.particle);
  }

  drawDebug(game) {
    const player = game.player;
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
      for (let col = 0; col < CONFIG.GRID_COLS; col++) {
        this.text(`${col},${row}`, Grid.cellX(col) + 1, Grid.cellY(row) + 1, 5, COLORS.dim);
      }
    }
    for (const enemy of game.enemies) {
      this.text(enemy.def.name, Grid.cellX(enemy.col) + CONFIG.CELL_SIZE / 2, Grid.cellY(enemy.row) + 26, 5, COLORS.text, 'center');
    }
    const fmtMs = (s) => (s === null ? '-' : `${s > 0 ? '+' : ''}${Math.round(s * 1000)}ms`);
    const offset = player.ringActive ? player.matchBeat(0).error : null;
    const beat = player.ringActive ? `${player.beatIndex + 1}/${player.weapon.intervals.length}` : '-';
    this.text(`FPS ${Math.round(Loop.fps)}   플레이어 ${player.col},${player.row}   리듬 ${beat}   매치까지 ${fmtMs(offset)}`,
      4, 165, 6, COLORS.text);
    this.text(`최근 입력 오차 ${fmtMs(player.lastError)}   윈도우 P ±${Math.round(player.perfectWindow * 1000)} / G ±${Math.round(player.goodWindow * 1000)}ms`,
      4, 172, 6, COLORS.text);

    // 매치 시점을 가운데로 둔 타임라인 (폭은 고정 시간)
    const span = 0.6;
    const barX = 216;
    const barW = 100;
    const barY = 168;
    const toX = (t) => barX + barW / 2 + (t / span) * barW;
    this.rect(barX, barY, barW, 8, COLORS.gridLine);
    this.rect(toX(-player.goodWindow), barY, toX(player.goodWindow) - toX(-player.goodWindow), 8, COLORS.debugGood);
    this.rect(toX(-player.perfectWindow), barY, toX(player.perfectWindow) - toX(-player.perfectWindow), 8, COLORS.debugPerfect);
    if (player.lastError !== null && Math.abs(player.lastError) <= span / 2) {
      this.rect(toX(player.lastError), barY - 2, 1, 12, COLORS.telegraphEdge);
    }
    if (offset !== null && Math.abs(offset) <= span / 2) this.rect(toX(offset), barY - 1, 1, 10, COLORS.text);
  }

  // 패턴 한 바퀴를 가로 막대로 그린다. 눈금이 각 리듬이고, 쿵은 초록, 짝은 보라로 높게 표시한다.
  drawRhythmBar(x, y, width, weapon) {
    const total = weapon.intervals.reduce((sum, v) => sum + v, 0);
    this.rect(x, y + 2, width, 2, COLORS.gridLine);
    let time = 0;
    weapon.intervals.forEach((interval, i) => {
      time += interval;
      const px = x + (time / total) * (width - 2);
      if (weapon.drums[i] === 'snare') this.rect(px, y - 1, 2, 8, COLORS.ringSnare);
      else this.rect(px, y, 2, 6, COLORS.ringKick);
    });
  }

  // 화면 아래 가운데의 전투 리듬 막대. 한 바퀴를 8칸으로 나눠 1~8박에 세로선을 긋는다. 4박과 8박은 길게 긋는다.
  // 노드는 그 리듬이 오는 시점에 놓고, 아래에 눌러야 할 키를 쓴다.
  drawBeatBar(player) {
    const { intervals, drums } = player.weapon;
    const width = CONFIG.BEAT_BAR_WIDTH;
    const left = (CONFIG.VIEW_WIDTH - width) / 2;
    const y = CONFIG.BEAT_BAR_Y;
    const total = intervals.reduce((sum, v) => sum + v, 0);
    const toX = (time) => left + (time / total) * width;
    this.rect(left, y, width, 2, COLORS.gridLine);
    for (let step = 1; step <= CONFIG.BEAT_BAR_STEPS; step++) {
      const x = toX(total * step / CONFIG.BEAT_BAR_STEPS);
      if (step % (CONFIG.BEAT_BAR_STEPS / 2) === 0) this.rect(x, y - 5, 1, 12, COLORS.text);
      else this.rect(x, y - 3, 1, 8, COLORS.dim);
    }
    let time = 0;
    intervals.forEach((interval, i) => {
      time += interval;
      const x = toX(time);
      const color = drums[i] === 'snare' ? COLORS.ringSnare : COLORS.ringKick;
      this.rect(x - 1, y - 2, 3, 6, color);
      this.text(CONFIG.DRUM_KEYS[drums[i]].replace('Key', ''), x, y + 5, 6, color, 'center');
    });
    if (player.ringActive) this.rect(toX(player.cycleTime), y - 4, 1, 10, COLORS.text);
  }

  drawWeaponSelect(game) {
    const cx = CONFIG.VIEW_WIDTH / 2;
    this.text('무기 선택', cx, 8, 13, COLORS.text, 'center');
    this.text('무기마다 리듬과 데미지, 공격 범위가 다르다', cx, 25, 7, COLORS.dim, 'center');
    const width = 74;
    const gap = 4;
    const count = game.weaponKinds.length;
    const left = (CONFIG.VIEW_WIDTH - (count * width + (count - 1) * gap)) / 2;
    const top = 38;
    const height = 112;
    game.weaponKinds.forEach((kind, i) => {
      const weapon = CONFIG.WEAPONS[kind];
      const x = left + i * (width + gap);
      const selected = i === game.weaponIndex;
      this.rect(x, top, width, height, COLORS.cellB);
      this.frame(x, top, width, height, selected ? COLORS.text : COLORS.gridLine, selected ? 2 : 1);
      this.text(`${i + 1}`, x + 5, top + 4, 7, COLORS.dim);
      this.text(weapon.name, x + width / 2, top + 14, this.fitTextSize(weapon.name, width - 8, 9), COLORS.text, 'center');
      this.drawRangePreview(weapon, x + (width - 56) / 2, top + 30);
      this.drawRhythmBar(x + 6, top + 68, width - 12, weapon);
      this.text(weaponDamageText(weapon), x + width / 2, top + 80, 6, COLORS.text, 'center');
      this.text(`쿨다운 ${weapon.cooldown}초`, x + width / 2, top + 94, 7, COLORS.dim, 'center');
    });
    this.text('← → 선택     Enter 확정     1~4 바로 선택', cx, 158, 8, COLORS.ring, 'center');
  }

  // 게임과 같은 8열 4행 격자를 작게 그리고, 플레이어를 시작 위치(열 1, 행 1)에 두고 공격 범위를 그린다.
  // 범위는 그 범위를 쓰는 리듬의 드럼 색이다. 쿵과 짝이 함께 쓰는 칸은 위 절반 초록, 아래 절반 보라다.
  drawRangePreview(weapon, x, y, size = 7) {
    const cols = CONFIG.GRID_COLS;
    const rows = CONFIG.GRID_ROWS;
    const pc = CONFIG.PLAYER_START_COL;
    const pr = CONFIG.PLAYER_START_ROW;
    const half = Math.floor(size / 2);
    const drums = {};
    weapon.drums.forEach((drum, beat) => {
      for (const cell of weaponRangeCells(weapon, beat, pc, pr, cols - 1)) {
        const key = `${cell.col},${cell.row}`;
        drums[key] = drums[key] || new Set();
        drums[key].add(drum);
      }
    });
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = x + col * size;
        const py = y + row * size;
        const used = drums[`${col},${row}`];
        if (!used) this.rect(px, py, size - 1, size - 1, COLORS.cellA);
        else if (used.size === 2) {
          this.rect(px, py, size - 1, half, COLORS.ringKick);
          this.rect(px, py + half, size - 1, size - 1 - half, COLORS.ringSnare);
        } else this.rect(px, py, size - 1, size - 1, drumColor([...used][0]));
      }
    }
    this.rect(x + pc * size, y + pr * size, size - 1, size - 1, COLORS.player);
  }

  drawTitle() {
    const cx = CONFIG.VIEW_WIDTH / 2;
    this.text('4Bit_Prototype', cx, 36, 24, COLORS.text, 'center');
    this.text('링이 공격 범위에 맞는 순간 키를 눌러라. 움직이면 리듬이 처음부터 다시 시작된다.', cx, 72, 7, COLORS.dim, 'center');
    this.text('방향키  이동', cx, 94, 8, COLORS.text, 'center');
    this.text('A  쿵 (초록 링)', cx - 44, 106, 8, COLORS.ringKick, 'center');
    this.text('S  짝 (보라 링)', cx + 44, 106, 8, COLORS.ringSnare, 'center');
    this.text('M  음소거      D  디버그', cx, 118, 8, COLORS.text, 'center');
    this.text('Enter로 시작', cx, 144, 10, COLORS.ring, 'center');
  }

  drawOverlay() {
    this.ctx.globalAlpha = 0.75;
    this.rect(0, 0, CONFIG.VIEW_WIDTH, CONFIG.VIEW_HEIGHT, COLORS.bg);
    this.ctx.globalAlpha = 1;
  }

  statLine(stats) {
    return `Perfect ${stats.perfect}    Good ${stats.good}    Miss ${stats.miss}`;
  }

  drawRewardScreen(game) {
    this.drawOverlay();
    const cx = CONFIG.VIEW_WIDTH / 2;
    this.text(`WAVE ${game.wave} 클리어`, cx, 8, 13, COLORS.text, 'center');
    this.text(this.statLine(game.waveStats), cx, 26, 8, COLORS.dim, 'center');
    this.text(`Perfect 비율 ${Math.round(game.wavePerfectRatio * 100)}%`, cx, 37, 8, POPUP_STYLES.perfect.color, 'center');

    const cards = game.rewardCards;
    const width = 92;
    const gap = 8;
    const left = (CONFIG.VIEW_WIDTH - (cards.length * width + (cards.length - 1) * gap)) / 2;
    const top = 52;
    const height = 100;
    cards.forEach((card, i) => {
      const x = left + i * (width + gap);
      const weapon = card.weapon ? CONFIG.WEAPONS[card.weapon] : null;
      const look = weapon
        ? { label: `${weapon.tier}티어 무기`, color: TIER_COLORS[weapon.tier] }
        : RARITY_LOOKS[card.rarity];
      const selected = i === game.rewardIndex;
      this.rect(x, top, width, height, COLORS.cellB);
      this.frame(x, top, width, height, selected ? COLORS.text : look.color, selected ? 2 : 1);
      this.text(`${i + 1}`, x + 6, top + 5, 8, COLORS.dim);
      this.text(look.label, x + width - 6, top + 5, 7, look.color, 'right');
      if (weapon) {
        // 무기 카드: 이름, 범위 그림, 리듬 막대, 데미지
        this.text(card.name, x + width / 2, top + 18, this.fitTextSize(card.name, width - 10, 10), COLORS.text, 'center');
        this.drawRangePreview(weapon, x + (width - 64) / 2, top + 36, 8);
        this.drawRhythmBar(x + 8, top + 74, width - 16, weapon);
        this.text(weaponDamageText(weapon), x + width / 2, top + 86, 6, COLORS.text, 'center');
        return;
      }
      this.text(card.name, x + width / 2, top + 22, 10, COLORS.text, 'center');
      card.desc.split('\n').forEach((line, n) => {
        this.text(line, x + width / 2, top + 44 + n * 11, 7, COLORS.dim, 'center');
      });
    });
    this.text('← → 선택     Enter 확정     1~3 바로 선택', cx, 160, 8, COLORS.ring, 'center');
  }

  drawGameOver(game) {
    this.drawOverlay();
    const cx = CONFIG.VIEW_WIDTH / 2;
    this.text('GAME OVER', cx, 30, 22, COLORS.telegraphEdge, 'center');
    this.text(`도달 웨이브 ${game.wave}`, cx, 66, 12, COLORS.text, 'center');
    this.text(this.statLine(game.totalStats), cx, 88, 9, COLORS.dim, 'center');
    this.text(`최고 연속 Perfect ${game.bestCombo}`, cx, 102, 9, POPUP_STYLES.perfect.color, 'center');
    this.text('Enter 또는 R  재시작     T  타이틀', cx, 136, 9, COLORS.ring, 'center');
  }

  drawTelegraphs(game) {
    const size = CONFIG.CELL_SIZE;
    for (const telegraph of game.telegraphs) {
      for (const cell of telegraph.cells) {
        const x = Grid.cellX(cell.col);
        const y = Grid.cellY(cell.row);
        this.rect(x, y, size, size, COLORS.telegraphBase);
        // 안쪽에서 차오르는 사각형이 칸을 가득 채우면 공격이 실행된다
        const fill = Math.round(size * telegraph.progress / 2) * 2;
        const inset = (size - fill) / 2;
        this.rect(x + inset, y + inset, fill, fill, TELEGRAPH_FILLS[telegraph.owner.def.family]);
        this.frame(x, y, size, size, COLORS.telegraphEdge);
      }
    }
  }

  drawImpacts(game) {
    const size = CONFIG.CELL_SIZE;
    for (const impact of game.impacts) {
      this.rect(Grid.cellX(impact.col), Grid.cellY(impact.row), size, size, COLORS.impact);
    }
  }

  drawEnemy(enemy) {
    // 스폰 대기 중에는 깜빡인다
    if (enemy.spawnTimer > 0 && Math.floor(enemy.spawnTimer * 12) % 2 === 0) return;
    const x = CONFIG.GRID_X + enemy.drawCol * CONFIG.CELL_SIZE;
    const y = CONFIG.GRID_Y + enemy.drawRow * CONFIG.CELL_SIZE;
    const look = ENEMY_LOOKS[enemy.kind];
    const flashing = enemy.flash > 0;
    this.rect(x + 7, y + 6, 18, 20, flashing ? COLORS.text : look.body);
    this.rect(x + 7, y + 22, 18, 4, flashing ? COLORS.text : look.dark);
    // attack 상태 표시
    if (enemy.state === 'attack') this.frame(x + 6, y + 5, 20, 22, COLORS.telegraphEdge);
    // 왼쪽을 보는 눈
    this.rect(x + 9, y + 11, 4, 4, COLORS.bg);
    for (const [mx, my, mw, mh] of look.marks) this.rect(x + mx, y + my, mw, mh, look.dark);
    // HP 칸
    const pips = enemy.maxHp;
    const width = Math.min(24, pips * 4);
    const pipWidth = width / pips;
    const left = x + (CONFIG.CELL_SIZE - width) / 2;
    for (let i = 0; i < pips; i++) {
      const px = Math.round(left + i * pipWidth);
      const pw = Math.max(1, Math.round(left + (i + 1) * pipWidth) - px - 1);
      this.rect(px, y + 2, pw, 2, i < enemy.hp ? COLORS.enemyHp : COLORS.gridLine);
    }
  }

  drawHud(game) {
    const player = game.player;
    // HP
    this.text('HP', 8, 4, 8, COLORS.dim);
    this.rect(24, 6, 60, 7, COLORS.gridLine);
    this.rect(24, 6, 60 * player.hp / player.stats.maxHp, 7, COLORS.player);
    this.text(`${player.hp}/${player.stats.maxHp}`, 88, 4, 8, COLORS.text);
    if (Sfx.muted) this.text('음소거', 8, 16, 7, COLORS.dim);
    // 웨이브와 콤보
    this.text(`WAVE ${game.wave}`, 160, 3, 10, COLORS.text, 'center');
    this.text(`연속 Perfect ${game.combo}`, 160, 15, 7, game.combo ? POPUP_STYLES.perfect.color : COLORS.dim, 'center');
    // 공격 쿨다운
    const ready = player.cooldown <= 0;
    this.text('A / S', 232, 4, 8, ready ? COLORS.ring : COLORS.dim);
    this.rect(262, 6, 50, 7, COLORS.gridLine);
    const charge = 1 - player.cooldown / player.cooldownTotal;
    this.rect(262, 6, 50 * charge, 7, ready ? COLORS.ring : COLORS.ringTarget);
    // 무기와 리듬 패턴
    this.text(player.weapon.name, 232, 16, 7, COLORS.text);
    this.drawBeatBar(player);
  }

  // (x, y) 모서리에서 안쪽으로 뻗는 록온 ㄱ자. dirX, dirY는 안쪽 방향(1 또는 -1).
  // 반투명일 때 진하기가 달라지지 않도록 외곽선과 몸통을 겹치지 않게 그린다.
  drawCorner(x, y, dirX, dirY, length, thickness, color) {
    const part = (dx, dy, w, h, c) => {
      this.rect(dirX > 0 ? x + dx : x - dx - w, dirY > 0 ? y + dy : y - dy - h, w, h, c);
    };
    const outline = COLORS.ringOutline;
    part(-1, -1, length + 2, 1, outline);
    part(-1, 0, 1, length + 1, outline);
    part(length, 0, 1, thickness, outline);
    part(thickness, thickness, length - thickness + 1, 1, outline);
    part(thickness, thickness + 1, 1, length - thickness, outline);
    part(0, length, thickness, 1, outline);
    part(0, 0, length, thickness, color);
    part(0, thickness, thickness, length - thickness, color);
  }

  // 범위 모양의 바깥 모서리마다 ㄱ자를 그린다. gap만큼 모서리에서 바깥 대각선으로 떨어진다 (음수면 안쪽).
  // 안쪽으로 들어갈 때 같은 변의 ㄱ자끼리 겹치지 않도록 길이를 줄인다.
  drawRangeRing(cells, gap, color, thickness) {
    const length = Math.max(thickness + 1,
      Math.min(CONFIG.RING_CORNER_LENGTH, Math.floor(CONFIG.CELL_SIZE / 2 + Math.min(0, gap))));
    for (const { x, y, dirX, dirY } of rangeCorners(cells)) {
      this.drawCorner(x - dirX * gap, y - dirY * gap, dirX, dirY, length, thickness, color);
    }
  }

  // 칸마다 1픽셀 안쪽을 채운다. 무기 제작 툴처럼 칸 경계가 보인다.
  fillCells(cells, color) {
    const size = CONFIG.CELL_SIZE;
    for (const c of cells) this.rect(Grid.cellX(c.col) + 1, Grid.cellY(c.row) + 1, size - 2, size - 2, color);
  }

  // 공격에 성공한 링이 그 크기에서 바깥으로 퍼지며 흐려진다.
  // 색은 쿵과 짝의 링 색을 따른다. Perfect는 굵고 모서리마다 불꽃이 튀며, Good은 얇고 약하게 퍼진다.
  drawRingBursts(game) {
    const ctx = this.ctx;
    ctx.save();
    for (const burst of game.ringBursts) {
      const t = burst.age / CONFIG.RING_BURST_TIME;
      const eased = 1 - (1 - t) * (1 - t);
      const gap = Math.round(burst.gap + CONFIG.RING_BURST_SPREAD[burst.grade] * eased);
      const perfect = burst.grade === 'perfect';
      const color = drumColor(burst.drum);
      ctx.globalAlpha = CONFIG.RING_BURST_ALPHA[burst.grade] * (1 - t);
      this.drawRangeRing(burst.cells, gap, color, (perfect ? 2 : 1) + (t < 0.5 ? 1 : 0));
      if (perfect) {
        const out = gap + CONFIG.RING_BURST_SPREAD.perfect * eased * 0.6;
        for (const { x, y, dirX, dirY } of rangeCorners(burst.cells)) {
          this.rect(x - dirX * out - 2, y - dirY * out - 2, 4, 4, color);
        }
      }
    }
    ctx.restore();
  }

  // 무기 제작 툴의 시연과 같은 연출이다. 공격 범위는 평소에 보이지 않는다.
  // 리듬마다 링이 하나씩이고, 그 리듬의 공격 범위 모양으로 고정 속도로 줄어든다. 그 리듬까지 남은 시간이 곧 링 크기다.
  // 링이 보이는 동안 범위가 그 리듬의 드럼 색으로 점점 진하게 채워지고, 리듬 순간 진하게 채워졌다가 흐려진다.
  // 리듬이 지나면 늦은 입력이 인정되는 동안 링이 범위 안쪽으로 계속 줄어든다.
  // 공격 키를 누르면 그 리듬의 범위 테두리가 하얗게 나타났다가 사라진다.
  drawRing(player) {
    if (!player.ringActive) return;
    const ctx = this.ctx;
    ctx.save();
    // 가까운 리듬의 링이 위에 오도록 먼 것부터 그린다
    const beats = player.upcomingBeats(CONFIG.RING_APPEAR_TIME).reverse();
    if (player.lateBeat) beats.push(player.lateBeat);
    const rings = beats.map(({ time, beat }) => ({
      time,
      cells: player.attackCells(beat),
      color: drumColor(player.weapon.drums[beat]),
      // 투명하게 나타나 리듬 순간에 가장 진해진다. 지나간 리듬은 그 진하기를 유지한다.
      closeness: 1 - Math.max(0, time) / CONFIG.RING_APPEAR_TIME,
    }));
    for (const { cells, color, closeness } of rings) {
      ctx.globalAlpha = CONFIG.RANGE_FILL_ALPHA * closeness;
      this.fillCells(cells, color);
    }
    // 리듬 순간: 범위가 진하게 채워졌다가 흐려진다
    if (player.ringCycles > 0 && player.ringTime < CONFIG.MATCH_FLASH_TIME) {
      ctx.globalAlpha = CONFIG.RANGE_MATCH_FILL_ALPHA * (1 - player.ringTime / CONFIG.MATCH_FLASH_TIME);
      this.fillCells(player.attackCells(player.lastBeat), drumColor(player.weapon.drums[player.lastBeat]));
    }
    for (const { time, cells, color, closeness } of rings) {
      ctx.globalAlpha = CONFIG.RING_MAX_ALPHA * closeness;
      this.drawRangeRing(cells, Math.round(CONFIG.RING_SPEED * time), color, CONFIG.RING_THICKNESS);
    }
    // 공격 키를 누른 순간의 하얀 범위 테두리
    if (player.goalFlash > 0) {
      const size = CONFIG.CELL_SIZE;
      ctx.globalAlpha = player.goalFlash / CONFIG.RING_GOAL_PRESS_TIME;
      for (const c of player.attackCells(player.goalFlashBeat)) {
        this.frame(Grid.cellX(c.col) + 1, Grid.cellY(c.row) + 1, size - 2, size - 2, COLORS.ringGoal, CONFIG.RING_GOAL_THICKNESS);
      }
    }
    ctx.restore();
  }

  // 플레이어 위에 공격 키를 표시한다. 지금 눌러야 할 키만 선명하고 나머지는 흐리다.
  drawRingKeys(player) {
    const target = player.ringActive ? player.weapon.drums[player.targetBeat] : null;
    const x = CONFIG.GRID_X + player.drawCol * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
    const y = CONFIG.GRID_Y + player.drawRow * CONFIG.CELL_SIZE + PLAYER_TOP - CONFIG.RING_KEY_SIZE;
    Object.entries(CONFIG.DRUM_KEYS).forEach(([drum, code], i) => {
      const color = drum === 'snare' ? COLORS.ringSnare : COLORS.ringKick;
      const alpha = drum === target ? 1 : CONFIG.RING_KEY_DIM_ALPHA;
      this.text(code.replace('Key', ''), x + (i - 0.5) * CONFIG.RING_KEY_GAP, y, CONFIG.RING_KEY_SIZE, color, 'center', alpha);
    });
  }

  drawPopups(game) {
    for (const popup of game.popups) {
      const t = popup.age / CONFIG.POPUP_TIME;
      const style = POPUP_STYLES[popup.kind];
      const x = Grid.cellX(popup.col) + CONFIG.CELL_SIZE / 2;
      const y = Grid.cellY(popup.row) - 2 - t * 10;
      // 빈 칸을 친 판정은 흐리게 표시한다
      this.text(style.label, x, y, style.size, popup.whiff ? COLORS.dim : style.color, 'center');
    }
  }

  present(game) {
    const ctx = this.screenCtx;
    // 화면 흔들림은 표시 단계에서만 적용한다
    let ox = 0;
    let oy = 0;
    if (game.shakeTime > 0 && game.state === 'play') {
      const power = game.shakePower * game.shakeTime / CONFIG.SHAKE_DURATION;
      ox = Math.round((Math.random() * 2 - 1) * power);
      oy = Math.round((Math.random() * 2 - 1) * power);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.screen.width, this.screen.height);
    ctx.drawImage(this.buffer, ox * this.scale, oy * this.scale, this.screen.width, this.screen.height);
    this.flushTexts();
  }

  drawGrid() {
    const size = CONFIG.CELL_SIZE;
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
      for (let col = 0; col < CONFIG.GRID_COLS; col++) {
        const color = (col + row) % 2 ? COLORS.cellB : COLORS.cellA;
        this.rect(Grid.cellX(col), Grid.cellY(row), size, size, color);
      }
    }
    this.frame(CONFIG.GRID_X - 1, CONFIG.GRID_Y - 1,
      CONFIG.GRID_COLS * size + 2, CONFIG.GRID_ROWS * size + 2, COLORS.gridLine);
  }

  drawPlayer(player) {
    // 피격 후 깜빡임
    if (player.hurtFlash > 0 && Math.floor(player.hurtFlash * 20) % 2 === 0) return;
    const x = CONFIG.GRID_X + player.drawCol * CONFIG.CELL_SIZE;
    const y = CONFIG.GRID_Y + player.drawRow * CONFIG.CELL_SIZE;
    this.rect(x + 7, y + PLAYER_TOP, 18, 20, COLORS.player);
    this.rect(x + 7, y + 22, 18, 4, COLORS.playerDark);
    // 오른쪽을 보는 눈
    this.rect(x + 19, y + 11, 4, 4, COLORS.bg);
  }
}
