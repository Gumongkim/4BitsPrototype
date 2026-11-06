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

- 스크립트 10개: `config.js`, `input.js`, `grid.js`, `telegraph.js`, `player.js`, `enemy.js`, `rewards.js`, `renderer.js`, `game.js`, `main.js`
- `index.html`: 로컬 실행용 페이지
- `timing-grid-web.html`: 웹 링크(Artifact) 게시용 페이지
- 스크립트를 추가·삭제하면 두 HTML의 `<script>` 목록을 함께 고친다.

## 웹 링크 (Artifact)

- 주소: https://claude.ai/artifact/SiCzBWw2wejRL34sd368U6
- 웹 링크는 이 폴더 밖(다른 세션·직접 편집)에서도 수정된다.
  - **수정 전:** Artifact `list`(scope `files`)/`read`로 최신본을 확인하고, 로컬과 다르면 웹 버전을 먼저 로컬로 받아 맞춘다.
  - **수정 후:** 확인을 묻지 않고 바로 다시 게시한다. `file_path`는 `timing-grid-web.html`, 스크립트 10개는 `files`로 함께 올리고 `url`에 위 주소를 넣는다. 게시했다고 답변에 알린다.
- 게임 동작·수치를 바꾸면 `README.md`도 현재 상태에 맞게 고친다.

## 검증

- 동작 확인은 내장 브라우저로 한다. 필요하면 임시 로컬 서버(`.claude/launch.json`)를 만들어 띄우고, 끝나면 정리한다.
- 밸런스 판단은 봇 시뮬레이션 수치를 근거로 한다.
