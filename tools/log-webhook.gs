// 4Bit_Prototype 게임오버 로그 웹훅 (구글 시트 Apps Script 예시)
// 게임 스크립트가 아니다. HTML과 웹 링크(Artifact)에 넣지 않는다.
//
// 설정
// 1. 구글 시트를 하나 만들고 확장 프로그램 > Apps Script를 연다.
// 2. 이 파일 내용을 붙여 넣고 저장한다.
// 3. 배포 > 새 배포 > 유형 '웹 앱', 실행 사용자 '나', 액세스 권한 '모든 사용자'로 배포한다.
// 4. 나온 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 config.js의 LOG_WEBHOOK_URL에 넣는다.
//
// 게임은 게임오버 때 런 기록 JSON을 text/plain으로 POST한다 (no-cors라 응답은 읽지 않는다).
// 'runs' 시트에 한 판을 한 줄로, 'waves' 시트에 웨이브 행을 추가한다. runId가 이미 있으면 건너뛴다.

const RUN_HEADERS = [
  'schema', 'runId', 'sessionId', 'build', 'endedAt', 'playSeconds', 'reachedWave',
  'death.enemyKind', 'death.wave', 'judge.perfect', 'judge.good', 'judge.miss',
  'timing.meanError', 'timing.meanAbsError', 'hits.taken', 'hits.shieldAbsorbed', 'hits.damageByEnemy',
  'bestHit', 'weaponSwitches', 'weapons', 'relics', 'rewards', 'receivedAt',
];
const WAVE_HEADERS = ['runId', 'wave', 'weaponKind', 'cleared', 'seconds', 'damageTaken', 'perfectRate'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const run = JSON.parse(e.postData.contents);
    const runs = sheetWithHeaders('runs', RUN_HEADERS);
    if (hasRunId(runs, run.runId)) return text('duplicate');
    const json = (v) => (v === undefined || v === null ? '' : JSON.stringify(v));
    const val = (v) => (v === undefined || v === null ? '' : v);
    runs.appendRow([
      run.schema, run.runId, run.sessionId, run.build, run.endedAt, run.playSeconds, run.reachedWave,
      val(run.death && run.death.enemyKind), val(run.death && run.death.wave),
      run.judge.perfect, run.judge.good, run.judge.miss,
      val(run.timing.meanError), val(run.timing.meanAbsError),
      run.hits.taken, run.hits.shieldAbsorbed, json(run.hits.damageByEnemy),
      val(run.bestHit), val(run.weaponSwitches), json(run.weapons), json(run.relics), json(run.rewards),
      new Date().toISOString(),
    ]);
    const waves = sheetWithHeaders('waves', WAVE_HEADERS);
    const rows = (run.waves || []).map((w) => WAVE_HEADERS.map((h) => val(w[h])));
    if (rows.length) waves.getRange(waves.getLastRow() + 1, 1, rows.length, WAVE_HEADERS.length).setValues(rows);
    return text('ok');
  } catch (err) {
    return text('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}

function sheetWithHeaders(name, headers) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(name) || book.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

// runId는 runs 시트의 2번째 열이다
function hasRunId(sheet, runId) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  return sheet.getRange(2, 2, last - 1, 1).getValues().some((row) => row[0] === runId);
}

function text(message) {
  return ContentService.createTextOutput(message).setMimeType(ContentService.MimeType.TEXT);
}
