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
  bump: { freq: 150, dur: 0.07, type: 'square', gain: 1 },
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
    Logger.startRun(this);
    this.emit('runStart', {});
    this.emit('weaponEquip', { kind: this.player.weaponKind, reason: 'start' });
    this.nextWave();
  }

  resetRun(weaponKind) {
    this.player = new Player(weaponKind);
    this.relics = [];      // 보유 유물 키. 슬롯 순서(왼쪽부터)다.
    this.relicState = {};  // 유물 키 -> 그 유물의 상태 객체
    this.debugRelic = 0;   // 디버그 지급 커서 (CONFIG.RELICS 순서)
    this.cycle = null;     // 진행 중인 사이클 요약 { id, nodes, hits, perfectHits }
    this.freezeTimer = 0;  // 적과 텔레그래프를 멈추는 시간 (페르마타). 히트스톱과 별도다.
    this.picker = null;    // 카드 선택 화면 (유물 선택, 유물 교체, 무기 교체)
    this.popups = [];
    this.enemies = [];
    this.telegraphs = [];
    this.impacts = [];
    this.bumpFlashes = []; // 서브우퍼 부딪힘 섬광 { col, row, age }. 칸 오른쪽 경계에 그린다.
    this.ringBursts = [];
    this.particles = [];
    this.hitStop = 0;
    this.shakeTime = 0;
    this.shakePower = 0;
    this.wave = 0;
    this.bestHit = 0;  // 사이클 하나에서 달성한 최대 HIT
    this.totalStats = { perfect: 0, good: 0, miss: 0 };
    this.waveStats = { perfect: 0, good: 0, miss: 0 };
    this.clearTimer = 0;
    this.rewardCards = [];
    this.rewardIndex = 0;
    this.rewardLock = 0;
    this.connectPlayer();
  }

  // 플레이어의 훅을 유물 시스템에 연결한다
  connectPlayer() {
    const player = this.player;
    player.emit = (name, data) => this.onPlayerEvent(name, data);
    player.rangeOverride = (beat) => Relics.first(this, 'attackCells', { beat });
    player.keepRingOnMove = (error) => Relics.any(this, 'keepRingOnMove', { error });
  }

  onPlayerEvent(name, data) {
    if (name === 'ringRestart' || name === 'ringStop') this.endCycle(true);
    this.emit(name, data);
  }

  // 보유 유물에 이벤트를 전달한다. 이벤트와 질의 목록은 relics.js 맨 위에 있다.
  emit(name, data) {
    Relics.emit(this, name, data);
  }

  // 무기 슬롯 수. 턴테이블이 있으면 2다.
  get weaponSlotCount() {
    return Relics.max(this, 'weaponSlots', {}, 1);
  }

  nextWave() {
    this.wave++;
    this.waveStats = { perfect: 0, good: 0, miss: 0 };
    this.telegraphs = [];
    this.freezeTimer = 0;
    this.enemies = spawnWave(this.wave, (c, r) => this.isOccupied(c, r));
    Logger.startWave(this);
    this.emit('waveStart', { wave: this.wave });
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
      case 'title': this.updateTitle(dt); break;
      case 'weaponSelect': this.updateWeaponSelect(); break;
      case 'play': this.updatePlay(dt); break;
      case 'reward': this.updateReward(dt); break;
      case 'pick': this.updatePick(dt); break;
      case 'gameover': this.updateGameOver(dt); break;
    }
  }

  // 타이틀과 게임오버 화면에서만 로그 내보내기 키(E, Shift+E, Shift+L, Y)가 동작한다
  updateTitle(dt) {
    Logger.handleKeys(this, dt);
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

  updateGameOver(dt) {
    Logger.handleKeys(this, dt);
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

  // 무기 카드를 고르면 무기 슬롯에 넣는다. 슬롯이 하나면 교체, 빈 슬롯이 있으면 추가(장착 무기는 그대로),
  // 슬롯이 가득 찼으면 교체할 무기를 고르는 화면으로 간다.
  selectReward(index) {
    const card = this.rewardCards[index];
    const player = this.player;
    if (card.weapon) {
      const slots = this.weaponSlotCount;
      if (slots > 1 && player.weapons.length < slots) {
        player.weapons.push(card.weapon);
        Logger.weaponAcquired(this, card.weapon);
        Logger.rewardChosen('weapon', card.weapon, { added: true });
      } else if (slots > 1) {
        this.openWeaponReplace(card);
        return;
      } else {
        this.replaceWeapon(0, card.weapon);
        Logger.rewardChosen('weapon', card.weapon);
      }
    } else {
      Logger.rewardChosen('weapon', 'keep');
    }
    Rewards.apply(card, player);
    this.startNextWave();
  }

  // slot번 슬롯의 무기를 kind로 바꾼다. 장착 중이던 슬롯이면 새 무기를 장착한다.
  replaceWeapon(slot, kind) {
    const player = this.player;
    const from = player.weapons[slot];
    player.weapons[slot] = kind;
    Logger.weaponAcquired(this, kind);
    this.emit('weaponRemove', { kind: from });
    this.emit('weaponReplace', { from, to: kind });
    if (player.weaponKind === from) {
      player.setWeapon(kind);
      this.emit('weaponEquip', { kind, reason: 'replace' });
    }
  }

  // 턴테이블 슬롯이 가득 찼을 때 새 무기와 바꿀 슬롯을 고른다
  openWeaponReplace(card) {
    const player = this.player;
    const cards = player.weapons.map((kind, i) => ({
      name: CONFIG.WEAPONS[kind].name,
      desc: `${i + 1}번 슬롯${kind === player.weaponKind ? ' · 장착 중' : ''}`,
      color: TIER_COLORS[CONFIG.WEAPONS[kind].tier],
      label: `${CONFIG.WEAPONS[kind].tier}티어`,
    }));
    cards.push({ name: '취소', desc: '무기 보상으로 돌아간다', color: COLORS.dim });
    this.openPicker({
      title: `${CONFIG.WEAPONS[card.weapon].name}와 바꿀 무기`,
      subtitle: '고른 슬롯의 무기가 새 무기로 바뀐다',
      cards,
      onPick: (i) => {
        if (i >= player.weapons.length) {
          this.state = 'reward';
          this.rewardLock = CONFIG.REWARD_INPUT_LOCK;
          return;
        }
        this.replaceWeapon(i, card.weapon);
        Logger.rewardChosen('weapon', card.weapon, { replacedSlot: i + 1 });
        this.startNextWave();
      },
    });
  }

  startNextWave() {
    this.player.ringActive = false;
    this.player.cooldown = 0;
    this.popups = [];
    this.ringBursts = [];
    this.state = 'play';
    this.nextWave();
  }

  // 웨이브 클리어. RELIC_ENCOUNTER_EVERY의 배수 웨이브면 유물 선택 화면을 먼저 연다.
  enterReward() {
    Sfx.play('clear');
    Logger.closeWave(this, true);
    this.player.stopRing();
    this.emit('waveClear', { wave: this.wave });
    if (this.wave % CONFIG.RELIC_ENCOUNTER_EVERY === 0) {
      const choices = Relics.draw(this);
      if (choices.length) {
        this.openRelicSelect(choices);
        return;
      }
    }
    this.enterWeaponReward();
  }

  enterWeaponReward() {
    this.state = 'reward';
    this.rewardCards = Rewards.draw(this.player, this.wave);
    Logger.rewardOffered(this, 'weapon', this.rewardCards.map((c) => c.weapon || 'keep'));
    this.rewardIndex = 0;
    this.rewardLock = CONFIG.REWARD_INPUT_LOCK;
  }

  relicCard(id) {
    const def = CONFIG.RELICS[id];
    return { name: def.name, desc: def.desc, color: RELIC_COLORS[def.rarity], label: CONFIG.RELIC_RARITY_NAMES[def.rarity], relic: id };
  }

  // 유물 선택 화면: 보유하지 않은 유물 카드들과 '건너뛰기'. 슬롯이 가득 찼으면 고른 뒤 교체할 유물을 고른다.
  openRelicSelect(choices) {
    const cards = choices.map((id) => this.relicCard(id));
    cards.push({ name: '건너뛰기', desc: '유물을 받지 않는다', color: COLORS.dim, skip: true });
    Logger.rewardOffered(this, 'relic', [...choices, 'skip']);
    this.openPicker({
      kind: 'relic',
      title: `WAVE ${this.wave} 클리어`,
      subtitle: `유물 선택  (보유 ${this.relics.length}/${CONFIG.RELIC_SLOTS})`,
      cards,
      onPick: (i) => {
        const card = cards[i];
        if (card.skip) {
          Logger.rewardChosen('relic', 'skip');
          this.enterWeaponReward();
        } else if (this.relics.length < CONFIG.RELIC_SLOTS) {
          Relics.add(this, card.relic);
          Logger.rewardChosen('relic', card.relic);
          this.enterWeaponReward();
        } else {
          this.openRelicReplace(card.relic, choices);
        }
      },
    });
  }

  openRelicReplace(id, choices) {
    const cards = this.relics.map((owned) => this.relicCard(owned));
    cards.push({ name: '취소', desc: '유물 선택으로 돌아간다', color: COLORS.dim });
    this.openPicker({
      title: `${CONFIG.RELICS[id].name}와 바꿀 유물`,
      subtitle: '고른 유물은 사라지고 그 칸에 새 유물이 들어간다',
      cards,
      onPick: (i) => {
        if (i >= this.relics.length) {
          this.openRelicSelect(choices);
        } else {
          const replaced = this.relics[i];
          Relics.add(this, id, i);
          Logger.rewardChosen('relic', id, { replaced });
          this.enterWeaponReward();
        }
      },
    });
  }

  // 카드 선택 화면. 조작은 무기 보상 화면과 같다 (← →, 숫자키, Enter, 진입 직후 입력 잠금).
  // cards: [{ name, desc, color, label }], onPick(번호)
  openPicker({ kind = 'pick', title, subtitle, cards, onPick }) {
    this.picker = { kind, title, subtitle, cards, onPick, index: 0 };
    this.state = 'pick';
    this.rewardLock = CONFIG.REWARD_INPUT_LOCK;
  }

  updatePick(dt) {
    if (this.rewardLock > 0) {
      this.rewardLock -= dt;
      return;
    }
    const picker = this.picker;
    const count = picker.cards.length;
    if (Input.wasPressed('ArrowLeft')) picker.index = (picker.index + count - 1) % count;
    if (Input.wasPressed('ArrowRight')) picker.index = (picker.index + 1) % count;
    for (let i = 0; i < count; i++) {
      if (Input.wasPressed(`Digit${i + 1}`)) {
        this.pickCard(i);
        return;
      }
    }
    if (Input.wasPressed('Enter')) this.pickCard(picker.index);
  }

  pickCard(index) {
    this.picker.index = index;
    this.picker.onPick(index);
  }

  // 사이클 요약. 사이클은 마지막 노드의 늦은 입력 윈도우가 닫히면 끝난다.
  beginCycle(id) {
    this.cycle = { id, nodes: this.player.weapon.intervals.length, hits: 0, perfectHits: 0 };
    this.emit('cycleStart', { cycle: id });
  }

  endCycle(interrupted) {
    if (!this.cycle) return;
    const c = this.cycle;
    this.cycle = null;
    this.emit('cycleEnd', {
      cycle: c.id, nodes: c.nodes, hits: c.hits, perfectHits: c.perfectHits,
      allPerfect: c.perfectHits === c.nodes, interrupted,
    });
  }

  updateCycle() {
    const player = this.player;
    if (!player.ringActive) {
      this.endCycle(true);
      return;
    }
    if (this.cycle) {
      const boundary = (this.cycle.id + 1) * this.cycle.nodes;
      const closed = player.ringCycles > boundary
        || (player.ringCycles === boundary && player.ringTime > player.goodWindow);
      if (closed) this.endCycle(false);
    }
    if (!this.cycle) this.beginCycle(player.currentCycle);
  }

  // ring번 노드를 HIT로 센다. 이 노드를 포함한 HIT를 돌려준다.
  // perfectHit: 적을 맞힌 Perfect라 사이클 요약의 perfectHits에 센다.
  countHit(ring, perfectHit) {
    const player = this.player;
    const hits = player.registerHit(ring);
    this.bestHit = Math.max(this.bestHit, hits);
    const id = Math.floor(ring / player.weapon.intervals.length);
    if (this.cycle && id > this.cycle.id) this.endCycle(false);
    if (!this.cycle) this.beginCycle(id);
    if (id === this.cycle.id) {
      this.cycle.hits = hits;
      if (perfectHit) this.cycle.perfectHits++;
    }
    return hits;
  }

  updatePlay(dt) {
    const player = this.player;
    Logger.tick(dt);
    if (this.debug) this.updateDebugRelics();
    this.updateWeaponSwitch();
    player.updateMovement(dt, (c, r) => !!this.enemyAt(c, r));
    player.updateRing(dt);
    this.updateCycle();
    player.updateHitUi(dt);
    this.emit('update', { dt });
    if (player.justMatched) Sfx.play(player.isSnare(player.lastBeat) ? 'tickStrong' : 'tick');
    for (const [drum, code] of Object.entries(CONFIG.DRUM_KEYS)) {
      if (!Input.wasPressed(code)) continue;
      // 유물이 공격 입력을 대신 처리하면(프리스타일 모드) 리듬 판정을 하지 않는다
      if (Relics.any(this, 'attackInput', { drum, age: Input.pressAge(code) })) continue;
      // 누른 순간 그 리듬의 공격 범위 테두리가 하얗게 보인다
      player.goalFlash = CONFIG.RING_GOAL_PRESS_TIME;
      player.goalFlashBeat = player.targetBeat;
      const result = player.tryAttack(Input.pressAge(code), drum);
      if (result) {
        player.goalFlashBeat = result.beat;
        this.resolveAttack(result);
      }
    }
    // 히트스톱과 정지(페르마타)는 적과 텔레그래프만 멈춘다. 링 박자와 플레이어 입력은 멈추지 않는다.
    const frozen = this.freezeTimer > 0;
    this.freezeTimer = tickDown(this.freezeTimer, dt);
    if (this.hitStop > 0) {
      this.hitStop -= dt;
    } else if (!frozen) {
      for (const enemy of this.enemies) enemy.update(dt, this);
      this.updateTelegraphs(dt);
    }
    this.updateEffects(dt);
    if (this.state === 'play') this.updateWaveProgress(dt);
  }

  // 턴테이블: 숫자키로 슬롯의 무기를 장착한다. 전환은 교체가 아니며 링을 다시 시작한다.
  updateWeaponSwitch() {
    const player = this.player;
    if (player.weapons.length < 2) return;
    player.weapons.forEach((kind, i) => {
      if (!Input.wasPressed(`Digit${i + 1}`) || kind === player.weaponKind) return;
      const from = player.weaponKind;
      player.setWeapon(kind);
      Logger.weaponSwitch();
      this.emit('weaponSwitch', { from, to: kind });
      this.emit('weaponEquip', { kind, reason: 'switch' });
    });
  }

  // 디버그 전용 유물 지급: [ ] 로 커서를 옮기고 P로 그 유물을 지급하거나 회수한다.
  // 슬롯이 가득 찼으면 맨 왼쪽 유물과 바꾼다.
  updateDebugRelics() {
    const ids = Object.keys(CONFIG.RELICS);
    if (Input.wasPressed('BracketLeft')) this.debugRelic = (this.debugRelic + ids.length - 1) % ids.length;
    if (Input.wasPressed('BracketRight')) this.debugRelic = (this.debugRelic + 1) % ids.length;
    if (!Input.wasPressed('KeyP')) return;
    const id = ids[this.debugRelic];
    if (Relics.has(this, id)) Relics.remove(this, id);
    else Relics.add(this, id, this.relics.length >= CONFIG.RELIC_SLOTS ? 0 : null);
  }

  resolveAttack(result) {
    const player = this.player;
    const cells = player.attackCells(result.beat);
    let targets = cells.map((c) => this.enemyAt(c.col, c.row)).filter(Boolean);
    if (!player.rangeOverride(result.beat) && weaponFirstTargetOnly(player.weapon, result.beat)) {
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
    const node = {
      grade: result.grade, drum: result.drum, beat: result.beat, ring: result.ring,
      targets, damage: 0, hits: 0, whiff: false,
    };
    // 빈 칸을 친 입력은 판정만 표시하고 통계와 HIT에 넣지 않는다.
    // 적이 없는 곳에서 친 판정으로 HIT와 통계가 부풀려지는 것을 막기 위해서다. 에어 드럼이 있으면 HIT로 센다.
    if (!targets.length) {
      if (result.grade !== 'miss' && Relics.any(this, 'whiffHits')) {
        node.hits = this.countHit(result.ring, false);
        node.whiff = true;
        this.emit('node', node);
      }
      return;
    }

    this.waveStats[result.grade]++;
    this.totalStats[result.grade]++;
    Logger.judge(result.grade, result.error);
    // Miss는 HIT를 올리지도 초기화하지도 않는다
    if (result.grade === 'miss') {
      this.emit('node', node);
      return;
    }
    let damage = result.damage;
    if (result.grade === 'perfect') {
      damage *= player.stats.perfectMult;
      this.hitStop = CONFIG.HITSTOP_PERFECT;
      this.shake(CONFIG.SHAKE_PERFECT);
      for (const target of targets) this.burst(target.col, target.row, CONFIG.PARTICLES_PERFECT);
    } else {
      damage *= player.stats.goodMult;
      this.hitStop = CONFIG.HITSTOP_GOOD;
    }
    // HIT: 이번 노드를 포함한 사이클 안의 성공 횟수만큼 추가 배율이 붙는다. 여러 적을 맞혀도 배율은 같다.
    const hits = this.countHit(result.ring, result.grade === 'perfect');
    damage *= 1 + player.hitBonus(hits, result.beat);
    damage *= this.relicDamageFactor({
      drum: result.drum, beat: result.beat, weaponKind: player.weaponKind, grade: result.grade, hits, freestyle: false,
    });
    node.hits = hits;
    node.damage = damage;
    for (const target of targets) this.damageEnemy(target, damage, 'node');
    this.emit('node', node);
  }

  // 유물이 데미지에 곱하는 값: (1 + 유물 % 풀) x 따로 곱하는 배율들
  relicDamageFactor(ctx) {
    return (1 + Relics.sum(this, 'damagePct', ctx)) * Relics.product(this, 'damageMult', ctx);
  }

  // 적에게 데미지를 준다. 이미 처치된 적은 무시한다.
  damageEnemy(enemy, amount, source) {
    if (enemy.dead) return;
    const killed = enemy.takeDamage(amount);
    this.emit('enemyHit', { enemy, damage: amount, source });
    if (killed) this.killEnemy(enemy, source);
  }

  // (col, row) 상하좌우 칸의 살아 있는 적
  adjacentEnemies(col, row) {
    return [[-1, 0], [1, 0], [0, -1], [0, 1]]
      .map(([dc, dr]) => this.enemyAt(col + dc, row + dr))
      .filter(Boolean);
  }

  shake(power) {
    this.shakeTime = CONFIG.SHAKE_DURATION;
    this.shakePower = power;
  }

  // 밀린 적이 오른쪽 장애물에 부딪히는 연출. 데미지는 부르는 쪽이 준다.
  bumpEnemy(enemy) {
    enemy.bump = CONFIG.BUMP_TIME;
    this.bumpFlashes.push({ col: enemy.col, row: enemy.row, age: 0 });
    const x = Grid.cellX(enemy.col) + CONFIG.CELL_SIZE;
    const y = Grid.cellY(enemy.row) + CONFIG.CELL_SIZE / 2;
    for (let i = 0; i < CONFIG.PARTICLES_BUMP; i++) {
      // 부딪힌 면에서 왼쪽 위아래로 튄다
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = CONFIG.PARTICLE_SPEED * (0.5 + Math.random() / 2);
      this.particles.push({ x, y: y + (Math.random() - 0.5) * 16, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0 });
    }
    this.shake(CONFIG.SHAKE_PERFECT);
    Sfx.play('bump');
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

  killEnemy(enemy, source = 'node') {
    if (enemy.dead) return;
    enemy.dead = true;
    Sfx.play('kill');
    this.burst(enemy.col, enemy.row, CONFIG.PARTICLES_KILL);
    this.enemies = this.enemies.filter((e) => e !== enemy);
    // 죽은 적의 예고 공격은 함께 사라진다
    this.telegraphs = this.telegraphs.filter((t) => t.owner !== enemy);
    this.emit('enemyKill', { enemy, source });
  }

  startEnemyAttack(enemy, cells) {
    Sfx.play('telegraph');
    const telegraph = new EnemyTelegraph(enemy, cells, enemy.telegraphTime, enemy.def.damage);
    this.telegraphs.push(telegraph);
    this.emit('telegraphStart', { enemy, telegraph });
  }

  // enemy의 진행 중인 공격 예고를 지우고 적을 복귀 단계로 보낸다 (카운터포인트)
  cancelEnemyAttack(enemy) {
    const before = this.telegraphs.length;
    this.telegraphs = this.telegraphs.filter((t) => t.owner !== enemy);
    if (this.telegraphs.length !== before) enemy.onAttackFinished();
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
      if (telegraph.covers(player.col, player.row)) this.hurtPlayer(telegraph.damage, telegraph.owner.kind);
    }
    this.telegraphs = this.telegraphs.filter((t) => !t.finished);
  }

  // 실드가 있으면 피해 1점당 실드 1점이 먼저 막는다
  // enemyKind: 공격한 적의 종류. 로그(피격·사망 원인)에만 쓴다.
  hurtPlayer(amount, enemyKind = null) {
    const player = this.player;
    const absorbed = Math.min(player.shield, amount);
    player.shield -= absorbed;
    amount -= absorbed;
    Logger.hurt(enemyKind, Math.min(player.hp, Math.max(0, amount)), absorbed);
    this.emit('playerHurt', { amount, absorbed });
    if (amount <= 0) {
      this.shake(CONFIG.SHAKE_PERFECT);
      Sfx.play('miss');
      return;
    }
    player.hp = Math.max(0, player.hp - amount);
    player.hurtFlash = CONFIG.HURT_FLASH_TIME;
    this.shake(CONFIG.SHAKE_HURT);
    Sfx.play('hurt');
    if (player.hp === 0) {
      Sfx.play('gameover');
      this.state = 'gameover';
      Logger.finishRun(this);
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
    for (const flash of this.bumpFlashes) flash.age += dt;
    this.bumpFlashes = this.bumpFlashes.filter((f) => f.age < CONFIG.BUMP_FLASH_TIME);
    for (const impact of this.impacts) impact.age += dt;
    this.impacts = this.impacts.filter((i) => i.age < CONFIG.IMPACT_TIME);
    for (const burst of this.ringBursts) burst.age += dt;
    this.ringBursts = this.ringBursts.filter((b) => b.age < CONFIG.RING_BURST_TIME);
    for (const enemy of this.enemies) {
      if (enemy.flash > 0) enemy.flash -= dt;
      enemy.bump = tickDown(enemy.bump, dt);
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
