// 게임오버 로그: 플레이 중 집계, 게임오버 때 런 기록 생성, localStorage 누적, 내보내기(JSON / CSV), 백업 복구, 웹훅.
// 밸런스 분석용 읽기 전용 집계다. 게임 규칙에는 영향을 주지 않는다.
// 게임 코드는 Logger.*만 부른다. 모든 진입점은 try/catch로 감싸 로거 오류가 게임을 멈추지 않게 한다.
//
// 런 기록(한 판 1건)과 웨이브 행은 README.md의 '게임오버 로그'에 필드 표가 있다.
// 저장은 런 기록 배열의 JSON이고, 웨이브 행은 런 기록의 waves 배열에 중첩해 둔다 (CSV에서만 분리).

const LOG_SCHEMA = 1;

function logId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logRound(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const k = 10 ** digits;
  return Math.round(value * k) / k;
}

// 파일 이름용 시각: 20261107-153012
function logStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// rows: 객체 배열, columns: [[머리글, 값을 꺼내는 함수], ...]. 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다.
function toCsv(rows, columns) {
  const lines = [columns.map(([name]) => csvCell(name)).join(',')];
  for (const row of rows) lines.push(columns.map(([, get]) => csvCell(get(row))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const LOG_RUN_COLUMNS = [
  ['schema', (r) => r.schema],
  ['runId', (r) => r.runId],
  ['sessionId', (r) => r.sessionId],
  ['build', (r) => r.build],
  ['endedAt', (r) => r.endedAt],
  ['playSeconds', (r) => r.playSeconds],
  ['reachedWave', (r) => r.reachedWave],
  ['death.enemyKind', (r) => r.death && r.death.enemyKind],
  ['death.wave', (r) => r.death && r.death.wave],
  ['judge.perfect', (r) => r.judge.perfect],
  ['judge.good', (r) => r.judge.good],
  ['judge.miss', (r) => r.judge.miss],
  ['timing.meanError', (r) => r.timing.meanError],
  ['timing.meanAbsError', (r) => r.timing.meanAbsError],
  ['hits.taken', (r) => r.hits.taken],
  ['hits.shieldAbsorbed', (r) => r.hits.shieldAbsorbed],
  ['hits.damageByEnemy', (r) => r.hits.damageByEnemy],
  ['bestHit', (r) => r.bestHit],
  ['weaponSwitches', (r) => r.weaponSwitches],
  ['weapons', (r) => r.weapons],
  ['relics', (r) => r.relics],
  ['rewards', (r) => r.rewards],
];

const LOG_WAVE_COLUMNS = [
  ['runId', (w) => w.runId],
  ['wave', (w) => w.wave],
  ['weaponKind', (w) => w.weaponKind],
  ['cleared', (w) => w.cleared],
  ['seconds', (w) => w.seconds],
  ['damageTaken', (w) => w.damageTaken],
  ['perfectRate', (w) => w.perfectRate],
];

// 실제 구현. 바깥에서는 try/catch로 감싼 Logger를 쓴다.
const LoggerCore = {
  enabled: true,         // false면 집계와 저장을 모두 건너뛴다
  printTable: true,      // 게임오버 때 console.table 출력 여부
  sessionId: logId(),    // 페이지를 연 뒤 한 번 만든 익명 ID
  run: null,             // 진행 중인 런의 집계
  wave: null,            // 진행 중인 웨이브의 집계
  lastRecord: null,      // 방금 끝난 판의 기록 (Y 복사용)
  memory: [],            // localStorage에 저장하지 못한 기록. 페이지를 닫으면 사라진다.
  backupMemory: null,    // localStorage에 저장하지 못한 백업
  storedCount: null,     // 화면 표시용 저장 기록 수 캐시
  notice: '',            // 화면에 잠깐 띄울 알림
  noticeTimer: 0,

  // 현재 웨이브 번호 기준으로, 지금 얻은 것이 처음 쓰이는 웨이브. 보상 화면에서 얻으면 다음 웨이브다.
  usedFromWave(game) {
    return game.state === 'play' ? Math.max(1, game.wave) : game.wave + 1;
  },

  startRun(game) {
    if (!this.enabled) return;
    const kind = game.player.weaponKind;
    this.run = {
      runId: logId(),
      playSeconds: 0,
      weapons: [{ kind, tier: CONFIG.WEAPONS[kind].tier, fromWave: 1 }],
      weaponSwitches: 0,
      relicFrom: {},
      judge: { perfect: 0, good: 0, miss: 0 },
      errorSum: 0,
      absErrorSum: 0,
      errorCount: 0,
      hits: { taken: 0, shieldAbsorbed: 0, damageByEnemy: {} },
      lastDamageBy: null,
      rewards: [],
      waves: [],
      finished: false,
    };
    this.wave = null;
  },

  startWave(game) {
    if (!this.run || this.run.finished) return;
    this.wave = { wave: game.wave, seconds: 0, damageTaken: 0, perfect: 0, good: 0, miss: 0 };
  },

  // play 상태의 로직 스텝마다 부른다
  tick(dt) {
    if (!this.run || this.run.finished) return;
    this.run.playSeconds += dt;
    if (this.wave) this.wave.seconds += dt;
  },

  // 적을 맞힌 공격의 판정. error는 매치 시점 오차(초, 이름 음수, 늦음 양수)
  judge(grade, error) {
    if (!this.run || this.run.finished) return;
    this.run.judge[grade]++;
    if (this.wave) this.wave[grade]++;
    if (grade === 'miss') return;
    this.run.errorSum += error;
    this.run.absErrorSum += Math.abs(error);
    this.run.errorCount++;
  },

  // 적 공격에 맞았다. hpDamage는 실제로 줄어든 HP, absorbed는 실드가 막은 양
  hurt(enemyKind, hpDamage, absorbed) {
    if (!this.run || this.run.finished) return;
    const hits = this.run.hits;
    hits.taken++;
    hits.shieldAbsorbed += absorbed;
    if (hpDamage > 0) {
      const key = enemyKind || 'unknown';
      hits.damageByEnemy[key] = (hits.damageByEnemy[key] || 0) + hpDamage;
      this.run.lastDamageBy = key;
      if (this.wave) this.wave.damageTaken += hpDamage;
    }
  },

  weaponAcquired(game, kind) {
    if (!this.run || this.run.finished) return;
    this.run.weapons.push({ kind, tier: CONFIG.WEAPONS[kind].tier, fromWave: this.usedFromWave(game) });
  },

  weaponSwitch() {
    if (!this.run || this.run.finished) return;
    this.run.weaponSwitches++;
  },

  relicAcquired(game, id) {
    if (!this.run || this.run.finished) return;
    this.run.relicFrom[id] = this.usedFromWave(game);
  },

  // 보상 화면에 제시된 카드. 같은 화면을 다시 열면(교체 선택에서 취소) 같은 항목을 덮어쓴다.
  rewardOffered(game, kind, offered) {
    if (!this.run || this.run.finished) return;
    const last = this.run.rewards[this.run.rewards.length - 1];
    if (last && last.wave === game.wave && last.kind === kind && last.chosen === null) {
      last.offered = offered;
      return;
    }
    this.run.rewards.push({ wave: game.wave, kind, offered, chosen: null });
  },

  // 고른 카드. 무기: 무기 키 또는 'keep', 유물: 유물 키 또는 'skip'. extra는 교체한 슬롯이나 유물 등.
  rewardChosen(kind, chosen, extra = {}) {
    if (!this.run || this.run.finished) return;
    const entry = [...this.run.rewards].reverse().find((r) => r.kind === kind && r.chosen === null);
    if (entry) Object.assign(entry, { chosen }, extra);
  },

  closeWave(game, cleared) {
    if (!this.run || !this.wave) return;
    const w = this.wave;
    const judged = w.perfect + w.good + w.miss;
    this.run.waves.push({
      runId: this.run.runId,
      wave: w.wave,
      weaponKind: game.player.weaponKind,
      cleared,
      seconds: logRound(w.seconds),
      damageTaken: logRound(w.damageTaken),
      perfectRate: judged ? logRound(w.perfect / judged) : null,
    });
    this.wave = null;
  },

  // 게임오버 때 한 번 부른다. 런 기록을 만들어 저장하고, 콘솔 출력과 웹훅 전송을 한다.
  finishRun(game) {
    const run = this.run;
    if (!run || run.finished) return;
    this.closeWave(game, false);
    run.finished = true;
    const count = run.errorCount;
    const record = {
      schema: LOG_SCHEMA,
      runId: run.runId,
      sessionId: this.sessionId,
      build: CONFIG.BUILD_VERSION,
      endedAt: new Date().toISOString(),
      playSeconds: logRound(run.playSeconds),
      weapons: run.weapons,
      weaponSwitches: run.weaponSwitches,
      relics: game.relics.map((id) => ({ id, name: CONFIG.RELICS[id].name, fromWave: run.relicFrom[id] ?? null })),
      reachedWave: game.wave,
      death: { enemyKind: run.lastDamageBy, wave: game.wave },
      judge: run.judge,
      timing: {
        meanError: count ? logRound(run.errorSum / count, 4) : null,
        meanAbsError: count ? logRound(run.absErrorSum / count, 4) : null,
      },
      hits: {
        taken: run.hits.taken,
        shieldAbsorbed: logRound(run.hits.shieldAbsorbed),
        damageByEnemy: Object.fromEntries(Object.entries(run.hits.damageByEnemy).map(([k, v]) => [k, logRound(v)])),
      },
      bestHit: game.bestHit ?? null,
      rewards: run.rewards,
      waves: run.waves,
    };
    this.lastRecord = record;
    this.save(record);
    if (this.printTable && typeof console !== 'undefined' && console.table) {
      console.table([{
        runId: record.runId, build: record.build, reachedWave: record.reachedWave, death: record.death.enemyKind,
        playSeconds: record.playSeconds, perfect: record.judge.perfect, good: record.judge.good, miss: record.judge.miss,
        meanError: record.timing.meanError, taken: record.hits.taken, bestHit: record.bestHit,
      }]);
      console.table(record.waves);
    }
    this.sendWebhook(record);
  },

  // --- 저장 ---

  readStore(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // 저장에 성공하면 true. 용량 초과면 false.
  writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  removeStore(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* 쓸 수 없는 저장소 */ }
  },

  storedRuns() {
    const list = this.readStore(CONFIG.LOG_STORAGE_KEY);
    return Array.isArray(list) ? list : [];
  },

  // 최근 LOG_MAX_RUNS판만 남긴다. 용량이 넘치면 오래된 기록부터 지우며 다시 시도하고,
  // 그래도 안 되면 메모리에 보관한다.
  save(record) {
    const list = this.storedRuns().concat([record]);
    while (list.length > CONFIG.LOG_MAX_RUNS) list.shift();
    let saved = this.writeStore(CONFIG.LOG_STORAGE_KEY, list);
    // 한 번에 10%씩(최소 1건) 지워 큰 저장소에서도 다시 시도하는 횟수를 줄인다. 방금 판은 지우지 않는다.
    while (!saved && list.length > 1) {
      list.splice(0, Math.min(list.length - 1, Math.max(1, Math.ceil(list.length * 0.1))));
      saved = this.writeStore(CONFIG.LOG_STORAGE_KEY, list);
    }
    if (!saved) {
      this.memory.push(record);
      while (this.memory.length > CONFIG.LOG_MAX_RUNS) this.memory.shift();
    }
    this.storedCount = null;
  },

  // 내보낼 모든 기록: 저장소 + 메모리 보관분 (runId 중복 제거)
  allRuns() {
    const seen = new Set();
    return this.storedRuns().concat(this.memory).filter((r) => r && !seen.has(r.runId) && seen.add(r.runId));
  },

  count() {
    if (this.storedCount === null) this.storedCount = this.allRuns().length;
    return this.storedCount;
  },

  clearRuns() {
    this.removeStore(CONFIG.LOG_STORAGE_KEY);
    this.memory = [];
    this.storedCount = null;
  },

  // --- 내보내기 ---
  // 웹 링크(claude.ai Artifact) 안에서는 페이지가 직접 파일을 내려받을 수 없다. 이때는 Artifact의 downloads 기능
  // (claude.use('downloads'))으로 저장 확인 창을 띄운다. 그 밖(index.html 직접 실행 등)에서는 <a download>로 내려받는다.

  downloadsApi: undefined,   // undefined: 확인 중, null: 쓸 수 없음, 객체: Artifact downloads 기능
  downloadsReady: null,      // downloadsApi 확인이 끝나면 풀리는 Promise
  busy: false,               // 저장 확인 창이 열려 있는 동안 다시 누른 내보내기를 무시한다

  initDownloads() {
    const claude = typeof window !== 'undefined' ? window.claude : null;
    if (!claude || typeof claude.use !== 'function') {
      this.downloadsApi = null;
      this.downloadsReady = Promise.resolve(null);
      return;
    }
    this.downloadsReady = claude.use('downloads')
      .then((api) => { this.downloadsApi = api || null; return this.downloadsApi; })
      .catch(() => { this.downloadsApi = null; return null; });
  },

  // 파일들을 내보낸다. 모두 저장되면 true. 뷰어가 취소하거나 저장할 수 없으면 false.
  //  - Artifact 안: downloads 기능의 저장 확인 창 (저장 위치는 브라우저 설정을 따른다)
  //  - 그 밖, 파일 선택 창을 쓸 수 있는 브라우저(크롬·엣지): 저장 위치를 고르는 창을 띄운다.
  //    파일 하나(JSON)는 '다른 이름으로 저장' 창, 여럿(CSV 2개)은 폴더 선택 창 한 번으로 그 폴더에 모두 쓴다.
  //  - 그 밖: <a download>로 브라우저 기본 다운로드 폴더에 내려받는다.
  async deliver(files) {
    const api = await this.downloadsReady;
    if (!api) return this.saveWithPicker(files);
    // 확인 창은 한 번에 하나만 열 수 있으므로 차례로 연다
    for (const file of files) {
      try {
        await api.save({ filename: file.name, data: file.content });
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') this.say('저장을 취소했다 (로그는 그대로 남아 있다)');
        else if (code === 'rate_limited') this.say('저장 확인 창이 이미 열려 있다');
        else this.say('이 화면에서는 파일을 내려받을 수 없다');
        return false;
      }
    }
    return true;
  },

  // 저장 위치를 고르는 창(File System Access API). 쓸 수 없는 브라우저나 화면이면 기본 다운로드로 대신한다.
  // 창은 공격 키 입력 직후(사용자 입력으로 인정되는 시간 안)에 열린다. id로 지난번 위치를 기억한다.
  async saveWithPicker(files) {
    const canPick = typeof window !== 'undefined' && window.isSecureContext
      && (files.length === 1 ? typeof window.showSaveFilePicker === 'function' : typeof window.showDirectoryPicker === 'function');
    if (!canPick) {
      this.downloadAll(files);
      return true;
    }
    try {
      if (files.length === 1) {
        const file = files[0];
        const ext = file.name.slice(file.name.lastIndexOf('.'));
        const handle = await window.showSaveFilePicker({
          id: CONFIG.LOG_PICKER_ID,
          suggestedName: file.name,
          types: [{ description: ext === '.csv' ? 'CSV' : 'JSON', accept: { [file.type.split(';')[0]]: [ext] } }],
        });
        await this.writeHandle(handle, file);
      } else {
        const dir = await window.showDirectoryPicker({ id: CONFIG.LOG_PICKER_ID, mode: 'readwrite' });
        for (const file of files) await this.writeHandle(await dir.getFileHandle(file.name, { create: true }), file);
      }
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        this.say('저장 위치 선택을 취소했다 (로그는 그대로 남아 있다)');
        return false;
      }
      // 권한 거부·보안 제한 등: 기본 다운로드로 대신한다
      this.downloadAll(files);
      return true;
    }
  },

  async writeHandle(handle, file) {
    const writable = await handle.createWritable();
    await writable.write(file.content);
    await writable.close();
  },

  download(file) {
    const blob = new Blob([file.content], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // 여러 파일은 브라우저가 막지 않도록 조금씩 간격을 두고 내려받는다
  downloadAll(files) {
    files.forEach((file, i) => {
      if (i === 0) this.download(file);
      else setTimeout(() => { try { this.download(file); } catch (e) { /* 무시 */ } }, i * CONFIG.LOG_DOWNLOAD_GAP_MS);
    });
  },

  buildFiles(runs, format) {
    const stamp = logStamp();
    const meta = {
      exportedAt: new Date().toISOString(),
      build: CONFIG.BUILD_VERSION,
      count: runs.length,
      firstRunId: runs[0].runId,
      lastRunId: runs[runs.length - 1].runId,
    };
    if (format === 'json') {
      return [{
        name: `logs-${stamp}.json`,
        type: 'application/json',
        content: JSON.stringify(Object.assign(meta, { runs }), null, 2),
      }];
    }
    const waves = runs.flatMap((r) => r.waves || []);
    return [
      { name: `runs-${stamp}.csv`, type: 'text/csv;charset=utf-8', content: toCsv(runs, LOG_RUN_COLUMNS) },
      { name: `waves-${stamp}.csv`, type: 'text/csv;charset=utf-8', content: toCsv(waves, LOG_WAVE_COLUMNS) },
    ];
  },

  // 누적 기록을 모두 내려받고 저장소에서 지운다. 내려받은 묶음은 백업 키에 한 번분만 남긴다.
  // Artifact 저장 확인 창에서 뷰어가 거절하면 지우지 않는다.
  exportRuns(format) {
    if (this.busy) return;
    const runs = this.allRuns();
    if (!runs.length) {
      this.say('내보낼 로그가 없다');
      return;
    }
    const files = this.buildFiles(runs, format);
    const backup = { savedAt: new Date().toISOString(), files };
    if (this.writeStore(CONFIG.LOG_BACKUP_KEY, backup)) this.backupMemory = null;
    else {
      this.removeStore(CONFIG.LOG_BACKUP_KEY);
      this.backupMemory = backup;
    }
    const ids = new Set(runs.map((r) => r.runId));
    this.busy = true;
    this.say('내보내는 중');
    this.deliver(files).then((ok) => {
      if (!ok) return;
      this.removeRuns(ids);
      this.say(`${runs.length}판 내보냄 (${format === 'json' ? 'JSON' : 'CSV'})`);
    }).catch(() => {}).finally(() => { this.busy = false; });
  },

  // 내보낸 기록만 지운다. 저장 확인을 기다리는 동안 끝난 판은 남는다.
  removeRuns(ids) {
    const left = this.storedRuns().filter((r) => !ids.has(r.runId));
    if (left.length) this.writeStore(CONFIG.LOG_STORAGE_KEY, left);
    else this.removeStore(CONFIG.LOG_STORAGE_KEY);
    this.memory = this.memory.filter((r) => !ids.has(r.runId));
    this.storedCount = null;
  },

  // 직전에 내보낸 묶음을 다시 내려받는다 (복구용, 저장소는 건드리지 않는다)
  restoreBackup() {
    if (this.busy) return;
    const backup = this.backupMemory || this.readStore(CONFIG.LOG_BACKUP_KEY);
    if (!backup || !Array.isArray(backup.files) || !backup.files.length) {
      this.say('복구할 백업이 없다');
      return;
    }
    this.busy = true;
    this.deliver(backup.files).then((ok) => {
      if (ok) this.say('직전 내보내기를 다시 내려받음');
    }).catch(() => {}).finally(() => { this.busy = false; });
  },

  // 방금 판의 JSON을 클립보드로 복사한다. 쓸 수 없으면 조용히 무시한다.
  copyLast() {
    if (!this.lastRecord || !navigator.clipboard) return;
    navigator.clipboard.writeText(JSON.stringify(this.lastRecord, null, 2))
      .then(() => this.say('이번 판 JSON 복사함'), () => {});
  },

  sendWebhook(record) {
    const url = CONFIG.LOG_WEBHOOK_URL;
    if (!url || typeof fetch !== 'function') return;
    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(record),
      keepalive: true,
    }).catch(() => {});
  },

  say(message) {
    this.notice = message;
    this.noticeTimer = CONFIG.LOG_NOTICE_TIME;
  },

  // 타이틀·게임오버 화면에서 부른다. 플레이 중에는 부르지 않는다.
  // E: JSON, Shift+E: CSV, Shift+L: 백업 복구, Y: 이번 판 복사 (게임오버 화면만)
  handleKeys(game, dt) {
    this.noticeTimer = tickDown(this.noticeTimer, dt);
    if (Input.wasPressed('KeyE')) this.exportRuns(Input.withShift('KeyE') ? 'csv' : 'json');
    if (Input.wasPressed('KeyL') && Input.withShift('KeyL')) this.restoreBackup();
    if (game.state === 'gameover' && Input.wasPressed('KeyY')) this.copyLast();
  },
};

// 모든 진입점을 try/catch로 감싼다. 로거 오류는 콘솔에 경고만 남긴다.
const Logger = {};
for (const [name, value] of Object.entries(LoggerCore)) {
  if (typeof value !== 'function') continue;
  Logger[name] = (...args) => {
    try {
      return value.apply(LoggerCore, args);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('Logger 오류:', e);
      return undefined;
    }
  };
}
// 상태 값(enabled, notice 등)은 LoggerCore를 그대로 읽고 쓴다
Logger.core = LoggerCore;
Logger.initDownloads();
