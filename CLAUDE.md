# 4Bit_Prototype — Claude 작업 안내

리듬 + 로그라이트 + 아케이드 웹 게임 프로토타입. 탑다운 8x4 그리드에서 실시간으로 진행된다.
게임 규칙, 무기·적 수치, 파일별 역할은 `README.md`에 정리되어 있다. 작업 전에 먼저 읽는다.

## 대화 규칙

- 답변은 항상 한국어로 쓴다.
- 요구사항에 애매한 점이 있으면 구현 전에 질문한다. 질문 없이 정한 기본값은 답변에 적는다.

## 기술 제약

- 바닐라 JS + HTML5 Canvas, 클래식 `<script>` 태그. 빌드 도구·외부 라이브러리·모듈 없음.
- `index.html` 더블클릭으로 실행되어야 한다 (file:// 에서 동작).
- 내부 해상도 320x180, 정수배 스케일. 로직은 60Hz 고정 타임스텝. 타이머 감소는 `tickDown` 사용.
- 수치 상수는 모두 `config.js`에 둔다.

## 파일

- 스크립트 12개: `config.js`, `input.js`, `grid.js`, `telegraph.js`, `player.js`, `enemy.js`, `rewards.js`, `relics.js`, `logger.js`, `renderer.js`, `game.js`, `main.js`
- `index.html`: 로컬 실행용 페이지
- `timing-grid-web.html`: 웹 링크(Artifact) 게시용 페이지
- 스크립트를 추가·삭제하면 두 HTML의 `<script>` 목록을 함께 고친다.
- `tools/log-webhook.gs`: 로그 웹훅용 구글 시트 Apps Script 예시. 게임 스크립트가 아니므로 HTML과 웹 링크(Artifact)에 넣지 않는다.
- `weapon-tool/`: 무기 제작 웹 툴 (`index.html`, `tool.css`, `tool.js`). 게임과 독립이며 웹 링크(Artifact)에 포함하지 않는다. 같은 기술 제약(바닐라 JS, file:// 실행)을 따른다. 툴에서 내보낸 JSON을 받으면 `howToRead`와 `gameConfig`를 보고 `config.js` `WEAPONS`에 옮긴다.
- `relic-beat-tool/`: 유물 비트 메이커 웹 툴 (`index.html`, `tool.css`, `tool.js`). **유물과 BGM을 연동하는 작업은 구현이 어려워 폐기했다(2026-11-08). 툴과 설계서는 보존만 하고 게임 코드에 옮기지 않는다. 사용자가 다시 요청하기 전에는 연동 작업을 제안하거나 진행하지 않는다.** 사용법·조정 값·설계서 양식·수정 규칙은 `relic-beat-tool/CLAUDE.md` 지침서에 있다. 이 툴이나 설계서를 다루기 전에 먼저 읽고, 툴을 바꾸면 지침서도 고친다. 유물별 16박(4마디, 템포 60~180BPM 기본 130, 격자 8분 32칸 또는 16분 64칸) 비트(악기 1종)를 찍고 믹스로 들어 보며(유물 악기 모드), 또는 믹스 바 5칸(슬롯)이 악기를 정하고 유물은 리듬과 코드 기준 높낮이만 정하는 슬롯 악기 모드로 설계서(.md)와 WAV로 내보낸다. 게임과 독립이며 웹 링크(Artifact)에 포함하지 않는다. 같은 기술 제약을 따르고 소리는 Web Audio API로 합성한다(오디오 파일 없음). 상수는 `tool.js` 맨 위 `TOOL`에 있다. 설계서(`relic-beats-*.md`)를 받으면 맨 아래 JSON(스키마 `4bit-prototype-relic-beat-tool/v1`)을 원본으로 읽는다. 노트 세기·길이·롤, 유물별 사이드체인·리버브/딜레이 센드·로파이·저음/고음 깎기, 유물별 스윙·옥타브 이동·팬·필터 스윕(모양)·등장 루프·코러스·홀 리버브 센드·테이프, 전체 스윙·템포(`bpm`)·격자(`grid`)·키(`root`)·행 수(`pitchRows`)·사이클(`cycleLoops`)·딜레이 음표(`delayNote`)는 선택 항목(없으면 기본값)이고, 데모 드럼(딥 킥 포함)·펌핑 기준·바이닐 노이즈·WAV 길이는 미리듣기·내보내기 설정이라 설계서에 없다.

## 웹 링크 (Artifact)

- 주소: https://claude.ai/artifact/SiCzBWw2wejRL34sd368U6
- 웹 링크는 이 폴더 밖(다른 세션·직접 편집)에서도 수정된다.
  - **수정 전:** Artifact `list`(scope `files`)/`read`로 최신본을 확인하고, 로컬과 다르면 웹 버전을 먼저 로컬로 받아 맞춘다.
  - **수정 후:** 확인을 묻지 않고 바로 다시 게시한다. `file_path`는 `timing-grid-web.html`, 스크립트 12개는 `files`로 함께 올리고 `url`에 위 주소를 넣는다. `capabilities`는 생략해 기존 선언(`downloads: true`, 로그 내보내기용)을 유지한다. 게시했다고 답변에 알린다.
- 게임 동작·수치를 바꾸면 `README.md`도 현재 상태에 맞게 고친다.

## 검증

- 동작 확인은 내장 브라우저로 한다. 필요하면 임시 로컬 서버(`.claude/launch.json`)를 만들어 띄우고, 끝나면 정리한다.
- 밸런스 판단은 봇 시뮬레이션 수치를 근거로 한다.
