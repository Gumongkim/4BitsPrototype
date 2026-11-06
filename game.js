// 게임 상태와 진행, 연출 타이머, 효과음.

const SFX_TABLE = {
  perfect: { freq: 1320, dur: 0.1, type: 'square', gain: 1 },
  good: { freq: 880, dur: 0.07, type: 'square', gain: 0.8 },
  miss: { freq: 180, dur: 0.08, type: 'triangle', gain: 1 },
  tick: { freq: 660, dur: 0.02, type: 'sine', gain: 0.35 },
  tickStrong: { freq: 990, dur: 0.04, type: 'sine', gain: 0.6 },
  hurt: { freq: 120, dur: 0.16, type: 'sawtooth', gain: 1.2 },
  telegraph: { freq: 320, dur: 0.04, type: 'triangle', gain: 0.5 },
  kill: { freq: 520, dur: 0.12, type: 'square', gain: 0.8 },
  clear: { freq: 990, dur: 0.2, type: 'triangle', gain: 1.2 },
  gameover: { freq: 90, dur: 0.5, type: 'sawtooth', gain: 1.2 },
};

const Sfx = {
  ctx: null,
  muted: false,

  // 브라우저 정책상 AudioContext는 사용자 입력 이후에 만든다.
  init() {
    window.addEventListener('keydown', () => {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    });
  },

  play(name) {
    if (this.muted || !this.ctx) return;
    const sound = SFX_TABLE[name];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = sound.type;
    osc.frequency.value = sound.freq;
    gain.gain.setValueAtTime(CONFIG.SFX_VOLUME * sound.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + sound.dur);
  },
};

class Game {
  constructor() {
    this.debug = false;
    // 런 시작 화면에는 1티어 무기만 나온다
    this.weaponKinds = Object.keys(CONFIG.WEAPONS).filter((kind) => CONFIG.WEAPONS[kind].tier === 1);
    this.weaponIndex = 0;  // 재시작할 때 지난번 선택을 기억한다
    this.resetRun();
    this.state = 'title';
  }

  enterWeaponSelect() {
    this.resetRun();
    this.state = 'weaponSelect';
  }

  startRun(weaponKind) {
    this.resetRun(weaponKind);
    this.state = 'play';
    this.nextWave();
  }

  resetRun(weaponKind) {
    this.player = new Player(weaponKind);
    this.popups = [];
    this.enemies = [];
    this.telegraphs = [];
    this.impacts = [];
    this.ringBursts = [];
    this.particles = [];
    this.hitStop = 0;
    this.shakeTime = 0;
    this.shakePower = 0;
    this.wave = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.totalStats = { perfect: 0, good: 0, miss: 0 };
    this.waveStats = { perfect: 0, good: 0, miss: 0 };
    this.clearTimer = 0;
    this.rewardCards = [];
    this.rewardIndex = 0;
    this.rewardLock = 0;
  }

  nextWave() {
    this.wave++;
    this.waveStats = { perfect: 0, good: 0, miss: 0 };
    this.telegraphs = [];
    this.enemies = spawnWave(this.wave, (c, r) => this.isOccupied(c, r));
  }

  enemyAt(col, row) {
    return this.enemies.find((e) => e.col === col && e.row === row) || null;
  }

  isOccupied(col, row) {
    return (this.player.col === col && this.player.row === row) || !!this.enemyAt(col, row);
  }

  update(dt) {
    if (Input.wasPressed('KeyD')) this.debug = !this.debug;
    if (Input.wasPressed('KeyM')) Sfx.muted = !Sfx.muted;
    switch (this.state) {
      case 'title': this.updateTitle(); break;
      case 'weaponSelect': this.updateWeaponSelect(); break;
      case 'play': this.updatePlay(dt); break;
      case 'reward': this.updateReward(dt); break;
      case 'gameover': this.updateGameOver(); break;
    }
  }

  updateTitle() {
    if (Input.wasPressed('Enter')) this.enterWeaponSelect();
  }

  updateWeaponSelect() {
    const count = this.weaponKinds.length;
    if (Input.wasPressed('ArrowLeft')) this.weaponIndex = (this.weaponIndex + count - 1) % count;
    if (Input.wasPressed('ArrowRight')) this.weaponIndex = (this.weaponIndex + 1) % count;
    for (let i = 0; i < count; i++) {
      if (Input.wasPressed(`Digit${i + 1}`)) {
        this.weaponIndex = i;
        this.startRun(this.weaponKinds[i]);
        return;
      }
    }
    if (Input.wasPressed('Enter')) this.startRun(this.weaponKinds[this.weaponIndex]);
  }

  updateGameOver() {
    if (Input.wasPressed('Enter') || Input.wasPressed('KeyR')) this.enterWeaponSelect();
    else if (Input.wasPressed('KeyT')) {
      this.resetRun();
      this.state = 'title';
    }
  }

  // 공격 키는 전투 중 연타 입력이 넘어와 잘못 고를 수 있어 확정 키로 쓰지 않는다.
  updateReward(dt) {
    if (this.rewardLock > 0) {
      this.rewardLock -= dt;
      return;
    }
    const count = this.rewardCards.length;
    if (Input.wasPressed('ArrowLeft')) this.rewardIndex = (this.rewardIndex + count - 1) % count;
    if (Input.wasPressed('ArrowRight')) this.rewardIndex = (this.rewardIndex + 1) % count;
    for (let i = 0; i < count; i++) {
      if (Input.wasPressed(`Digit${i + 1}`)) {
        this.selectReward(i);
        return;
      }
    }
    if (Input.wasPressed('Enter')) this.selectReward(this.rewardIndex);
  }

  selectReward(index) {
    Rewards.apply(this.rewardCards[index], this.player);
    this.player.ringActive = false;
    this.player.cooldown = 0;
    this.popups = [];
    this.ringBursts = [];
    this.state = 'play';
    this.nextWave();
  }

  enterReward() {
    Sfx.play('clear');
    this.state = 'reward';
    this.rewardCards = Rewards.draw(this.player, this.wave);
    this.rewardIndex = 0;
    this.rewardLock = CONFIG.REWARD_INPUT_LOCK;
  }

  updatePlay(dt) {
    const player = this.player;
    player.updateMovement(dt, (c, r) => !!this.enemyAt(c, r));
    player.updateRing(dt);
    if (player.justMatched) Sfx.play(player.isSnare(player.lastBeat) ? 'tickStrong' : 'tick');
    for (const [drum, code] of Object.entries(CONFIG.DRUM_KEYS)) {
      if (!Input.wasPressed(code)) continue;
      // 누른 순간 그 리듬의 공격 범위 테두리가 하얗게 보인다
      player.goalFlash = CONFIG.RING_GOAL_PRESS_TIME;
      player.goalFlashBeat = player.targetBeat;
      const result = player.tryAttack(Input.pressAge(code), drum);
      if (result) {
        player.goalFlashBeat = result.beat;
        this.resolveAttack(result);
      }
    }
    // 히트스톱은 적과 텔레그래프만 멈춘다. 링 박자와 플레이어 입력은 멈추지 않는다.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
    } else {
      for (const enemy of this.enemies) enemy.update(dt, this);
      this.updateTelegraphs(dt);
    }
    this.updateEffects(dt);
    this.updateWaveProgress(dt);
  }

  resolveAttack(result) {
    const player = this.player;
    const cells = player.attackCells(result.beat);
    let targets = cells.map((c) => this.enemyAt(c.col, c.row)).filter(Boolean);
    if (weaponFirstTargetOnly(player.weapon, result.beat)) {
      targets = targets.sort((a, b) => a.col - b.col).slice(0, 1);
    }
    // 이 리듬 범위가 그리드 밖이면 플레이어 칸 위에 판정을 띄운다
    const popupCell = targets[0] || cells.find((c) => c.row === player.row) || cells[0] || player;
    this.addPopup(popupCell.col, popupCell.row, result.grade, !targets.length);
    Sfx.play(result.grade);
    if (result.grade !== 'miss' && cells.length) {
      // 입력 순간의 링 크기에서 터진다. 오차의 부호가 남은 시간과 반대다.
      const gap = Math.round(CONFIG.RING_SPEED * -result.error);
      this.ringBursts.push({ cells, gap, grade: result.grade, drum: result.drum, age: 0 });
    }
    // 빈 칸을 친 입력은 판정만 표시하고 통계와 콤보에 넣지 않는다.
    // 적이 없는 곳에서 친 판정으로 콤보와 통계가 부풀려지는 것을 막기 위해서다.
    if (!targets.length) return;

    this.waveStats[result.grade]++;
    this.totalStats[result.grade]++;
    if (result.grade === 'miss') {
      this.combo = 0;
      return;
    }
    let damage = result.damage;
    if (result.grade === 'perfect') {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      damage *= player.stats.perfectMult;
      if (player.stats.comboBonusDamage && this.combo % CONFIG.COMBO_BONUS_EVERY === 0) {
        damage += player.stats.comboBonusDamage;
      }
      this.hitStop = CONFIG.HITSTOP_PERFECT;
      this.shake(CONFIG.SHAKE_PERFECT);
      for (const target of targets) this.burst(target.col, target.row, CONFIG.PARTICLES_PERFECT);
    } else {
      this.combo = 0;
      damage *= player.stats.goodMult;
      this.hitStop = CONFIG.HITSTOP_GOOD;
    }
    for (const target of targets) {
      if (target.takeDamage(damage)) this.killEnemy(target);
    }
  }

  shake(power) {
    this.shakeTime = CONFIG.SHAKE_DURATION;
    this.shakePower = power;
  }

  burst(col, row, count) {
    const x = Grid.cellX(col) + CONFIG.CELL_SIZE / 2;
    const y = Grid.cellY(row) + CONFIG.CELL_SIZE / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = CONFIG.PARTICLE_SPEED * (0.5 + Math.random() / 2);
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0 });
    }
  }

  killEnemy(enemy) {
    Sfx.play('kill');
    this.burst(enemy.col, enemy.row, CONFIG.PARTICLES_KILL);
    this.enemies = this.enemies.filter((e) => e !== enemy);
    // 죽은 적의 예고 공격은 함께 사라진다
    this.telegraphs = this.telegraphs.filter((t) => t.owner !== enemy);
  }

  startEnemyAttack(enemy, cells) {
    Sfx.play('telegraph');
    this.telegraphs.push(new EnemyTelegraph(enemy, cells, enemy.telegraphTime, enemy.def.damage));
  }

  updateTelegraphs(dt) {
    const player = this.player;
    for (const telegraph of this.telegraphs) {
      telegraph.update(dt);
      if (!telegraph.finished) continue;
      telegraph.owner.onAttackFinished();
      for (const cell of telegraph.cells) {
        this.impacts.push({ col: cell.col, row: cell.row, age: 0 });
      }
      if (telegraph.covers(player.col, player.row)) this.hurtPlayer(telegraph.damage);
    }
    this.telegraphs = this.telegraphs.filter((t) => !t.finished);
  }

  hurtPlayer(amount) {
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.player.hurtFlash = CONFIG.HURT_FLASH_TIME;
    this.combo = 0;
    this.shake(CONFIG.SHAKE_HURT);
    Sfx.play('hurt');
    if (this.player.hp === 0) {
      Sfx.play('gameover');
      this.state = 'gameover';
    }
  }

  updateWaveProgress(dt) {
    if (this.enemies.length) return;
    this.clearTimer += dt;
    if (this.clearTimer >= CONFIG.WAVE_CLEAR_DELAY) {
      this.clearTimer = 0;
      this.enterReward();
    }
  }

  addPopup(col, row, kind, whiff = false) {
    this.popups.push({ col, row, kind, whiff, age: 0 });
  }

  updateEffects(dt) {
    for (const popup of this.popups) popup.age += dt;
    this.popups = this.popups.filter((p) => p.age < CONFIG.POPUP_TIME);
    for (const impact of this.impacts) impact.age += dt;
    this.impacts = this.impacts.filter((i) => i.age < CONFIG.IMPACT_TIME);
    for (const burst of this.ringBursts) burst.age += dt;
    this.ringBursts = this.ringBursts.filter((b) => b.age < CONFIG.RING_BURST_TIME);
    for (const enemy of this.enemies) {
      if (enemy.flash > 0) enemy.flash -= dt;
    }
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
    }
    this.particles = this.particles.filter((p) => p.age < CONFIG.PARTICLE_TIME);
    if (this.shakeTime > 0) this.shakeTime -= dt;
    if (this.player.hurtFlash > 0) this.player.hurtFlash -= dt;
    this.player.goalFlash = tickDown(this.player.goalFlash, dt);
  }
}
