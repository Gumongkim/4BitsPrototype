// 유물 비트 메이커. 유물마다 악기 하나로 16박(130BPM 4마디) 비트를 찍고, 최대 5개를 겹쳐 들어 보고,
// 설계서(.md)와 WAV로 내보낸다. 게임 코드와 독립이다. 소리는 Web Audio API로 합성한다.

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------
const TOOL = {
  // 템포와 격자는 전체 설정(state.bpm, state.grid)이다. 칸 수·칸 시간·루프 길이는 gridSteps(), stepSeconds(), loopSeconds()로 계산한다.
  DEFAULT_BPM: 130,             // 4분음표 기준
  BPM_MIN: 60,
  BPM_MAX: 180,
  DEFAULT_GRID: 8,              // 8 = 1칸이 8분음표(32칸), 16 = 1칸이 16분음표(64칸)
  GRIDS: [8, 16],
  BEATS: 16,                    // 루프 = 16박 = 4마디 (4/4), 1박 = 4분음표
  PITCH_ROWS: 8,                // 음높이 악기의 기본 행 수 (스케일 음 8개)
  PITCH_ROW_CHOICES: [8, 15],   // 행 수 선택 (15행이면 스케일 음을 두 옥타브 남짓 쌓는다)
  ROOT_MAX: 11,                 // 키: C에서 올린 반음 수 0~11
  OCTAVE_SHIFT_MIN: -2,         // 유물별 옥타브 이동
  OCTAVE_SHIFT_MAX: 2,
  MIX_SLOTS: 5,                 // 믹스 바 칸 수. 게임의 유물 소지 상한과 같다.
  NAME_MAX: 30,
  DEFAULT_SCALE: 'C 마이너 펜타토닉',
  DEFAULT_PRESET: 'marimba',
  DEFAULT_VOLUME: 1,            // 유물 볼륨, 믹스 칸 볼륨 (1 = 100%)
  VOLUME_MAX: 1.5,
  // 재생 스케줄러: SCHEDULE_MS마다 AudioContext 시간으로 LOOKAHEAD초 앞까지의 노트를 미리 예약한다.
  // 노트 시각은 시작 시각 + 칸 번호 x STEP_SECONDS로 매번 계산하므로 루프를 돌아도 오차가 쌓이지 않는다.
  SCHEDULE_MS: 25,
  LOOKAHEAD: 0.15,
  HIDDEN_LOOKAHEAD: 1.5,        // 탭이 가려지면 브라우저가 타이머를 1초 간격으로 늦추므로 더 멀리 예약한다
  START_DELAY: 0.06,            // 재생 버튼을 누른 뒤 첫 노트까지
  MASTER_GAIN: 0.6,
  LIMITER_THRESHOLD_DB: -3,     // 마스터 끝 리미터. 이보다 큰 순간 피크만 누른다.
  PREVIEW_GAIN: 0.8,            // 칸을 찍을 때 들려주는 소리
  NOISE_SECONDS: 2,             // 노이즈 버퍼 길이
  DISTORTION_CURVE_SIZE: 2048,  // 디스토션 곡선 샘플 수
  VIBRATO_FADE: 0.08,           // 비브라토가 delay 뒤 최대 깊이까지 커지는 시간
  // 노트 벨로시티(세기). 입력 버튼 순서이고 Shift+클릭/우클릭은 이 순서로 돈다.
  VELOCITY_LEVELS: [{ name: '강', value: 1 }, { name: '중', value: 0.7 }, { name: '약', value: 0.4 }],
  VELOCITY_STRONG_MIN: 0.85,    // 설계서 표기: 이상이면 표기 없음(강), VELOCITY_MEDIUM_MIN 이상이면 @m(중), 그 아래는 @w(약)
  VELOCITY_MEDIUM_MIN: 0.55,
  // 노트 길이(칸 수). 음높이 악기만 쓴다. 루프 끝을 넘으면 루프 끝에서 자른다.
  NOTE_LENGTHS: { 8: [1, 2, 4, 8], 16: [1, 2, 4, 8, 16] }, // 격자별 '새 노트 길이' 선택지 (칸)
  // 노트 롤(repeat): 한 칸 안에서 같은 노트를 균등하게 나눠 치는 횟수. 롤 노트는 길이를 쓰지 않는다(1칸).
  NOTE_REPEATS: [1, 2, 3, 4],
  REPEAT_MAX: 4,
  RESIZE_HANDLE_PX: 7,          // 노트 오른쪽 끝에서 이 폭 안을 끌면 길이를 바꾼다
  CELL_MIN_PX_8: 16,            // 편집기 칸 최소 너비 (8분 격자 32칸)
  CELL_MIN_PX_16: 14,           // 편집기 칸 최소 너비 (16분 격자 64칸). 화면이 좁으면 가로 스크롤
  SWEEP_DEFAULT_FROM: 0.8,      // 필터 스윕을 켤 때 시작값 (약 1.5kHz)
  SWEEP_DEFAULT_TO: 0,          // 필터 스윕을 켤 때 끝값 (20kHz, 빌드업처럼 열린다)
  // 데모 드럼(미리듣기 전용, 설계서에 없음)
  DEMO_DRUM_VOLUME_MAX: 1.5,
  // 사이드체인: 데모 드럼 킥마다 유물 소리를 (1 - sidechain)까지 ATTACK초 동안 눌렀다가 RELEASE초 동안 되돌린다
  SIDECHAIN_ATTACK: 0.01,
  SIDECHAIN_RELEASE: 0.2,
  // 스윙: 홀수 칸(뒤 반박) 시작을 swing x 칸 시간만큼 늦춘다
  SWING_MAX: 0.5,
  // 공통 리버브: 감쇠하는 노이즈 임펄스 응답 (시드 고정이라 렌더마다 같다)
  REVERB_SECONDS: 1.6,
  REVERB_DECAY_POWER: 3,        // 임펄스 감쇠 곡선 (1 - t/길이)^이 값
  REVERB_SEED: 20261107,
  // 공통 딜레이: 피드백 딜레이, 피드백 경로에 로우패스. 시간 = 음표 길이(박) x 60 / bpm초.
  DELAY_NOTES: { '1/8': 0.5, '3/16': 0.75, '1/4': 1, '3/8': 1.5 }, // 음표 -> 박 수 (3/16 = 점8분, 3/8 = 점4분)
  DEFAULT_DELAY_NOTE: '3/8',    // 130BPM에서 90/130초 = 이전 고정값과 같다
  DELAY_MAX_SECONDS: 2,         // 딜레이가 1초를 넘을 때의 createDelay 최대 시간 (60BPM 점4분 1.5초보다 크게). 1초 이하면 1
  DELAY_FEEDBACK: 0.35,
  DELAY_FEEDBACK_LOWPASS: 3000,
  // 로파이: 계단 곡선(비트 감소 느낌) + 로우패스. lofi 0~1에 따라 비트와 컷오프가 줄어든다.
  LOFI_BITS_MAX: 12,
  LOFI_BITS_MIN: 3,
  LOFI_CURVE_SIZE: 8192,
  LOFI_CUTOFF_MAX: 18000,
  LOFI_CUTOFF_MIN: 2500,
  // 저음 깎기(하이패스)·고음 깎기(로우패스): 값 v(0~1)를 지수로 대응. v = 1이면 둘 다 CUT_FULL Hz.
  // lowCut: LOW_CUT_MIN x (CUT_FULL / LOW_CUT_MIN)^v,  highCut: HIGH_CUT_MAX x (CUT_FULL / HIGH_CUT_MAX)^v
  LOW_CUT_MIN: 20,
  HIGH_CUT_MAX: 20000,
  CUT_FULL: 800,
  CUT_Q: 0.707,
  // 바이닐 노이즈(재생 전용, 설계서·WAV에 없음)
  VINYL_GAIN: 0.02,
  VINYL_SECONDS: 4,
  VINYL_CRACKLES_PER_SECOND: 5,
  WAV_SAMPLE_RATE: 44100,
  DOWNLOAD_GAP_MS: 400,         // 여러 파일을 내려받을 때 간격
  SAVE_DELAY_MS: 300,
  STORAGE_PREFIX: 'relicBeatTool.',
  SCHEMA: '4bit-prototype-relic-beat-tool/v1',
  SCHEMA_PREFIX: '4bit-prototype-relic-beat-tool/',
};

// 스케일: 루트 C 기준 반음 간격. 행 0이 가장 낮은 음이고 위로 스케일 음을 차례로 쌓는다.
const SCALES = {
  'C 마이너 펜타토닉': [0, 3, 5, 7, 10],
  'C 메이저 펜타토닉': [0, 2, 4, 7, 9],
  'C 자연 단음계': [0, 2, 3, 5, 7, 8, 10],
  'C 장음계': [0, 2, 4, 5, 7, 9, 11],
  'C 도리안': [0, 2, 3, 5, 7, 9, 10],
  'C 블루스': [0, 3, 5, 6, 7, 10],
  'C 프리지안': [0, 1, 3, 5, 7, 8, 10],
  'C 믹솔리디안': [0, 2, 4, 5, 7, 9, 10],
  'C 하모닉 마이너': [0, 2, 3, 5, 7, 8, 11],
  'C 리디안': [0, 2, 4, 6, 7, 9, 11],
  'C 반음계': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
// 키(root)는 스케일 전체를 C에서 root 반음 올린다. 스케일 이름은 C 기준 그대로 둔다.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// 악기 프리셋. 파라미터는 고정이다. 킥·스네어는 게임 판정 소리와 겹쳐 넣지 않는다.
//   pitched: 음높이 악기(8행) / 타악·노이즈(1행). octave: 음높이 악기의 행 0 옥타브 (C4 = MIDI 60).
//   params.oscs: 오실레이터 [{ type, ratio(음높이 배수), fixed(고정 Hz), detune(센트), gain }]
//   params.noise: 노이즈 { gain, filter? } (filter가 있으면 메인 필터를 거치지 않는다)
//   params.filter: { type, freq, Q, from?, sweep? } from이 있으면 노트 시작에 from Hz에서 sweep초 동안 freq로 간다
//   params.pitchSlide: { semis, time } 노트 시작 음높이가 semis 반음 위(음수면 아래)에서 time초 동안 제 음으로 간다
//   params.env: { attack, decay, sustain(0~1), release } 초. 게이트는 max(1칸, attack + decay, hold)다.
//   params.bursts: 박수처럼 짧은 타격을 여러 번 겹친다 { count, gap }
//   params.gain: 최대 음량
// 아래는 선택 항목이다. 없으면 쓰지 않는다.
//   params.distortion: { drive } 오실레이터 합을 tanh 곡선으로 찌그러뜨린다. 클수록 강하다. 필터는 그 뒤에 온다.
//   params.fm: { ratio, index, decay } 사인 모듈레이터(음높이 x ratio)로 오실레이터 주파수를 변조한다.
//     변조 깊이는 index x 모듈레이터 주파수(Hz)에서 decay초 동안 0으로 줄어든다.
//   params.vibrato: { rate, depth, delay } rate Hz, depth 센트로 음높이를 흔든다. delay초 뒤부터 시작한다.
//   params.hold: 초. 게이트의 하한이다. 게이트 = max(노트 길이, attack + decay, hold).
//   params.filterLfo: { rate, depth } 사인 LFO가 메인 필터 주파수에 ±depth Hz를 더한다 (rate Hz). 메인 필터가 있어야 하고
//     주파수가 0 이하로 내려가지 않게 depth < filter.freq로 정한다.
//   params.spread: 0~1. 오실레이터들을 좌우로 벌린다(첫 오실레이터 -spread, 마지막 +spread, 사이는 고르게).
//   params.formants: [{ freq, Q, gain }] 있으면 메인 필터 대신 병렬 밴드패스들을 지나 합친다(보컬 모음). filter보다 우선한다.
//   category: 프리셋 목록의 묶음 (drums, bass, guitar, keys, synth, fx). 없으면 '기존 악기'.
const PRESETS = [
  { id: 'low_tom', name: '로우 톰', pitched: false, params: {
    oscs: [{ type: 'sine', fixed: 98, gain: 1 }], pitchSlide: { semis: 12, time: 0.12 },
    env: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.05 }, gain: 0.9 } },
  { id: 'hand_clap', name: '핸드 클랩', pitched: false, params: {
    noise: { gain: 1 }, filter: { type: 'bandpass', freq: 1400, Q: 1.5 },
    bursts: { count: 3, gap: 0.011 }, env: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.02 }, gain: 0.8 } },
  { id: 'sub_bass', name: '서브 베이스', pitched: true, octave: 2, params: {
    oscs: [{ type: 'sine', gain: 1 }, { type: 'triangle', ratio: 2, gain: 0.15 }], filter: { type: 'lowpass', freq: 400, Q: 0.7 },
    env: { attack: 0.005, decay: 0.25, sustain: 0.7, release: 0.08 }, gain: 0.9 } },
  { id: 'walking_bass', name: '워킹 베이스', pitched: true, octave: 2, params: {
    oscs: [{ type: 'triangle', gain: 1 }, { type: 'sawtooth', gain: 0.25 }], filter: { type: 'lowpass', freq: 1100, Q: 1 },
    env: { attack: 0.004, decay: 0.18, sustain: 0.45, release: 0.06 }, gain: 0.8 } },
  { id: 'marimba', name: '마림바', pitched: true, octave: 4, params: {
    oscs: [{ type: 'sine', gain: 1 }, { type: 'sine', ratio: 4, gain: 0.25 }],
    env: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.05 }, gain: 0.7 } },
  { id: 'glockenspiel', name: '글로켄슈필', pitched: true, octave: 5, params: {
    oscs: [{ type: 'sine', gain: 1 }, { type: 'sine', ratio: 2.76, gain: 0.3 }, { type: 'sine', ratio: 5.4, gain: 0.12 }],
    env: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.2 }, gain: 0.45 } },
  { id: 'brass_stab', name: '브라스 스탭', pitched: true, octave: 3, params: {
    oscs: [{ type: 'sawtooth', detune: -8, gain: 1 }, { type: 'sawtooth', detune: 8, gain: 1 }],
    filter: { type: 'lowpass', freq: 2200, Q: 2, from: 400, sweep: 0.06 },
    env: { attack: 0.015, decay: 0.15, sustain: 0.45, release: 0.07 }, gain: 0.4 } },
  { id: 'flute_lead', name: '플루트 리드', pitched: true, octave: 5, params: {
    oscs: [{ type: 'sine', gain: 1 }, { type: 'triangle', gain: 0.25 }],
    noise: { gain: 0.05, filter: { type: 'bandpass', freq: 2500, Q: 1 } },
    env: { attack: 0.04, decay: 0.08, sustain: 0.8, release: 0.1 }, gain: 0.5 } },
  { id: 'arp_synth', name: '아르페지오 신스', pitched: true, octave: 4, params: {
    oscs: [{ type: 'square', gain: 1 }], filter: { type: 'lowpass', freq: 2600, Q: 5, from: 5000, sweep: 0.1 },
    env: { attack: 0.002, decay: 0.11, sustain: 0.25, release: 0.04 }, gain: 0.35 } },
  { id: 'rising_strings', name: '상승 스트링', pitched: true, octave: 3, params: {
    oscs: [{ type: 'sawtooth', detune: -10, gain: 1 }, { type: 'sawtooth', gain: 1 }, { type: 'sawtooth', detune: 10, gain: 1 }],
    filter: { type: 'lowpass', freq: 2000, Q: 0.7 }, pitchSlide: { semis: -2, time: 0.12 },
    env: { attack: 0.1, decay: 0.1, sustain: 0.85, release: 0.3 }, gain: 0.28 } },
  { id: 'sustained_pad', name: '지속 패드', pitched: true, octave: 3, params: {
    oscs: [{ type: 'triangle', detune: -6, gain: 1 }, { type: 'sawtooth', detune: 6, gain: 0.4 }],
    filter: { type: 'lowpass', freq: 1300, Q: 0.7 },
    env: { attack: 0.15, decay: 0.2, sustain: 0.9, release: 0.6 }, gain: 0.35 } },
  { id: 'cowbell', name: '카우벨', pitched: false, params: {
    oscs: [{ type: 'square', fixed: 587, gain: 0.6 }, { type: 'square', fixed: 845, gain: 0.6 }],
    filter: { type: 'bandpass', freq: 900, Q: 1.5 },
    env: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.03 }, gain: 0.45 } },
  { id: 'tap_perc', name: '탭 퍼커션', pitched: false, params: {
    oscs: [{ type: 'sine', fixed: 1050, gain: 1 }], pitchSlide: { semis: 5, time: 0.02 },
    noise: { gain: 0.3, filter: { type: 'highpass', freq: 3000, Q: 0.7 } },
    env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }, gain: 0.6 } },
  { id: 'scratch_noise', name: '스크래치 노이즈', pitched: false, params: {
    noise: { gain: 1 }, filter: { type: 'bandpass', freq: 600, Q: 4, from: 3000, sweep: 0.14 },
    env: { attack: 0.005, decay: 0.16, sustain: 0, release: 0.03 }, gain: 0.7 } },
  { id: 'crash_cymbal', name: '크래시 심벌', pitched: false, params: {
    noise: { gain: 1 }, filter: { type: 'highpass', freq: 4500, Q: 0.5 },
    env: { attack: 0.001, decay: 1.3, sustain: 0, release: 0.1 }, gain: 0.35 } },

  // 밴드 악기 (기존 15종 뒤에 붙인다. 기존 프리셋의 id·값은 바꾸지 않는다)
  // 드럼·타악
  { id: 'closed_hat', name: '클로즈드 하이햇', pitched: false, category: 'drums', params: {
    noise: { gain: 1, filter: { type: 'highpass', freq: 7000, Q: 0.7 } },
    env: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 }, gain: 0.35 } },
  { id: 'open_hat', name: '오픈 하이햇', pitched: false, category: 'drums', params: {
    noise: { gain: 1, filter: { type: 'highpass', freq: 6500, Q: 0.7 } },
    env: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.08 }, gain: 0.35 } },
  { id: 'ride_cymbal', name: '라이드 심벌', pitched: false, category: 'drums', params: {
    oscs: [{ type: 'sine', fixed: 3100, gain: 0.3 }],
    noise: { gain: 1, filter: { type: 'bandpass', freq: 7500, Q: 0.6 } },
    env: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.1 }, gain: 0.3 } },
  { id: 'mid_tom', name: '미드 톰', pitched: false, category: 'drums', params: {
    oscs: [{ type: 'sine', fixed: 140, gain: 1 }], pitchSlide: { semis: 10, time: 0.1 },
    env: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.05 }, gain: 0.85 } },
  { id: 'high_tom', name: '하이 톰', pitched: false, category: 'drums', params: {
    oscs: [{ type: 'sine', fixed: 190, gain: 1 }], pitchSlide: { semis: 10, time: 0.08 },
    env: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.05 }, gain: 0.8 } },
  { id: 'tambourine', name: '탬버린', pitched: false, category: 'drums', params: {
    noise: { gain: 1 }, filter: { type: 'highpass', freq: 8000, Q: 0.7 },
    bursts: { count: 2, gap: 0.02 }, env: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 }, gain: 0.3 } },
  { id: 'shaker', name: '셰이커', pitched: false, category: 'drums', params: {
    noise: { gain: 1 }, filter: { type: 'bandpass', freq: 7000, Q: 1 },
    env: { attack: 0.012, decay: 0.07, sustain: 0, release: 0.02 }, gain: 0.3 } },
  // 베이스
  { id: 'electric_bass', name: '일렉 베이스', pitched: true, octave: 2, category: 'bass', params: {
    oscs: [{ type: 'sawtooth', gain: 1 }, { type: 'square', gain: 0.3 }],
    filter: { type: 'lowpass', freq: 700, Q: 1.5, from: 1500, sweep: 0.08 },
    env: { attack: 0.003, decay: 0.2, sustain: 0.6, release: 0.06 }, gain: 0.6 } }, // 요청 시작값 0.75는 피크 1.17이라 낮췄다
  // 기타. 파워코드와 팜뮤트는 근음 + 완전5도(x1.4983) + 옥타브를 겹친다.
  { id: 'power_chord', name: '디스토션 파워코드', pitched: true, octave: 2, category: 'guitar', params: {
    oscs: [
      { type: 'sawtooth', detune: -6, gain: 1 }, { type: 'sawtooth', detune: 6, gain: 1 },
      { type: 'sawtooth', ratio: 1.4983, gain: 0.8 }, { type: 'sawtooth', ratio: 2, gain: 0.6 },
    ],
    distortion: { drive: 12 }, filter: { type: 'lowpass', freq: 3200, Q: 0.8 },
    env: { attack: 0.004, decay: 0.2, sustain: 0.7, release: 0.08 }, hold: 0.3, gain: 0.3 } },
  { id: 'palm_mute', name: '팜뮤트 기타', pitched: true, octave: 2, category: 'guitar', params: {
    oscs: [
      { type: 'sawtooth', detune: -6, gain: 1 }, { type: 'sawtooth', detune: 6, gain: 1 },
      { type: 'sawtooth', ratio: 1.4983, gain: 0.8 }, { type: 'sawtooth', ratio: 2, gain: 0.6 },
    ],
    distortion: { drive: 10 }, filter: { type: 'lowpass', freq: 1400, Q: 0.8 },
    env: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.03 }, gain: 0.35 } },
  { id: 'clean_guitar', name: '클린 기타', pitched: true, octave: 3, category: 'guitar', params: {
    oscs: [{ type: 'triangle', gain: 1 }, { type: 'sine', ratio: 2, gain: 0.4 }, { type: 'sawtooth', gain: 0.15 }],
    filter: { type: 'lowpass', freq: 3500, Q: 0.7, from: 6000, sweep: 0.05 },
    env: { attack: 0.002, decay: 0.45, sustain: 0.05, release: 0.1 }, gain: 0.5 } },
  { id: 'lead_guitar', name: '리드 기타', pitched: true, octave: 4, category: 'guitar', params: {
    oscs: [{ type: 'sawtooth', gain: 1 }, { type: 'square', detune: 7, gain: 0.4 }],
    distortion: { drive: 6 }, filter: { type: 'lowpass', freq: 3800, Q: 1 },
    vibrato: { rate: 5.5, depth: 18, delay: 0.12 },
    env: { attack: 0.01, decay: 0.15, sustain: 0.75, release: 0.12 }, hold: 0.25, gain: 0.3 } },
  // 건반
  // 어쿠스틱 피아노: 배음을 겹치고 필터가 밝게 시작해 닫혀 해머 타격 느낌을 낸다. 긴 울림은 릴리스와 노트 길이로 만든다.
  { id: 'acoustic_piano', name: '어쿠스틱 피아노', pitched: true, octave: 3, category: 'keys', params: {
    oscs: [
      { type: 'triangle', gain: 1 }, { type: 'sine', ratio: 2, gain: 0.5 },
      { type: 'sine', ratio: 3, gain: 0.25 }, { type: 'sine', ratio: 4, gain: 0.12 },
    ],
    filter: { type: 'lowpass', freq: 3500, Q: 0.7, from: 6000, sweep: 0.08 },
    env: { attack: 0.002, decay: 0.9, sustain: 0.15, release: 0.25 }, gain: 0.5 } },
  { id: 'electric_piano', name: '일렉 피아노', pitched: true, octave: 3, category: 'keys', params: {
    oscs: [{ type: 'sine', gain: 1 }], fm: { ratio: 1, index: 2.2, decay: 0.25 },
    env: { attack: 0.002, decay: 0.8, sustain: 0.1, release: 0.2 }, gain: 0.5 } },
  { id: 'organ', name: '오르간', pitched: true, octave: 3, category: 'keys', params: {
    oscs: [
      { type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2, gain: 0.7 }, { type: 'sine', ratio: 3, gain: 0.4 },
      { type: 'sine', ratio: 4, gain: 0.25 }, { type: 'sine', ratio: 0.5, gain: 0.5 },
    ],
    vibrato: { rate: 6, depth: 8, delay: 0.1 },
    env: { attack: 0.008, decay: 0.05, sustain: 0.95, release: 0.06 }, hold: 0.4, gain: 0.3 } },

  // 신스 (일렉트로 댄스 팝, 하우스, 베이스 뮤직)
  // 신스 베이스: 16분 싱코페이션 바운스용. 톱니 + 사각 + 사인 서브, 필터가 열렸다 닫힌다.
  { id: 'synth_bass', name: '신스 베이스', pitched: true, octave: 2, category: 'synth', params: {
    oscs: [{ type: 'sawtooth', gain: 1 }, { type: 'square', detune: -5, gain: 0.4 }, { type: 'sine', gain: 0.8 }],
    filter: { type: 'lowpass', freq: 900, Q: 3, from: 3000, sweep: 0.07 },
    env: { attack: 0.003, decay: 0.14, sustain: 0.55, release: 0.05 }, gain: 0.35 } },
  // 신스 플럭: 아르페지오와 대선율용. 필터가 빠르게 닫히는 짧은 소리.
  { id: 'synth_pluck', name: '신스 플럭', pitched: true, octave: 4, category: 'synth', params: {
    oscs: [{ type: 'sawtooth', gain: 1 }, { type: 'square', detune: 8, gain: 0.5 }, { type: 'sawtooth', detune: -8, gain: 0.5 }],
    filter: { type: 'lowpass', freq: 2800, Q: 2, from: 8000, sweep: 0.09 },
    env: { attack: 0.002, decay: 0.22, sustain: 0.05, release: 0.08 }, gain: 0.3 } },
  // 슈퍼소 리드: 청량한 메인 멜로디용. 톱니파 5개를 ±7, ±14센트 디튠.
  { id: 'supersaw_lead', name: '슈퍼소 리드', pitched: true, octave: 4, category: 'synth', params: {
    oscs: [
      { type: 'sawtooth', detune: -14, gain: 1 }, { type: 'sawtooth', detune: -7, gain: 1 }, { type: 'sawtooth', gain: 1 },
      { type: 'sawtooth', detune: 7, gain: 1 }, { type: 'sawtooth', detune: 14, gain: 1 },
    ],
    filter: { type: 'lowpass', freq: 6000, Q: 0.8 },
    vibrato: { rate: 5.5, depth: 8, delay: 0.15 },
    env: { attack: 0.006, decay: 0.12, sustain: 0.75, release: 0.14 }, gain: 0.17 } },
  // 808 서브: 길게 울리는 무거운 저음. 디스토션으로 배음을 만들어 작은 스피커에서도 들리게 한다.
  // 옥타브 1은 32Hz대라 대부분의 스피커에서 안 들리므로 2로 둔다.
  { id: 'sub_808', name: '808 서브', pitched: true, octave: 2, category: 'synth', params: {
    oscs: [{ type: 'sine', gain: 1 }], pitchSlide: { semis: 7, time: 0.04 },
    distortion: { drive: 2.5 }, filter: { type: 'lowpass', freq: 500, Q: 0.7 },
    env: { attack: 0.004, decay: 0.9, sustain: 0, release: 0.12 }, hold: 0.4, gain: 0.68 } }, // 초안 0.75는 피크 1.03이라 낮췄다
  // 코드 스탭: 하우스 뒷박 스탭용. 디튠 톱니파 3개, 필터가 빠르게 닫힌다 (brass_stab보다 날카롭다).
  { id: 'chord_stab', name: '코드 스탭', pitched: true, octave: 3, category: 'synth', params: {
    oscs: [{ type: 'sawtooth', detune: -10, gain: 1 }, { type: 'sawtooth', gain: 1 }, { type: 'sawtooth', detune: 10, gain: 1 }],
    filter: { type: 'lowpass', freq: 3000, Q: 1.5, from: 6500, sweep: 0.05 },
    env: { attack: 0.003, decay: 0.14, sustain: 0.2, release: 0.06 }, gain: 0.25 } },
  // 워블 베이스: 베이스 뮤직용. 필터 LFO가 1박(130BPM 4분음표)에 한 번(130 / 60 = 약 2.17Hz) 필터를 열고 닫는다.
  { id: 'wobble_bass', name: '워블 베이스', pitched: true, octave: 2, category: 'synth', params: {
    oscs: [{ type: 'sawtooth', detune: -12, gain: 1 }, { type: 'sawtooth', detune: 12, gain: 1 }, { type: 'square', gain: 0.5 }],
    filter: { type: 'lowpass', freq: 700, Q: 5 }, filterLfo: { rate: 130 / 60, depth: 500 },
    distortion: { drive: 4 },
    env: { attack: 0.004, decay: 0.2, sustain: 0.7, release: 0.06 }, hold: 0.3, gain: 0.22 } },
  // 효과음
  // 노이즈 라이저: 빌드업과 드롭 직전용. 노이즈 전용 밴드패스가 300Hz에서 9kHz로 올라가고 어택이 길다.
  // 게이트가 어택 + 디케이(약 0.9초)로 늘어나 칸 길이보다 길게 울린다.
  { id: 'noise_riser', name: '노이즈 라이저', pitched: false, category: 'fx', params: {
    noise: { gain: 1, filter: { type: 'bandpass', freq: 9000, Q: 1.2, from: 300, sweep: 0.9 } },
    env: { attack: 0.85, decay: 0.06, sustain: 0, release: 0.08 }, gain: 0.35 } },
  // 레이저 잽: 하이퍼팝 효과음. 사각파가 36반음 위에서 빠르게 내려온다 (고정 420Hz).
  { id: 'laser_zap', name: '레이저 잽', pitched: false, category: 'fx', params: {
    oscs: [{ type: 'square', fixed: 420, gain: 0.6 }], pitchSlide: { semis: 36, time: 0.14 },
    filter: { type: 'lowpass', freq: 5000, Q: 1 },
    env: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.02 }, gain: 0.3 } },
  // 하우스·딥하우스용 (맨 뒤에 붙인다)
  // 하우스 오르간 스탭: 짧고 밝은 사각파 스탭. 1칸(8분음표)으로 끊어 치면 M1 오르간 스탭 느낌.
  { id: 'house_organ', name: '하우스 오르간', pitched: true, octave: 3, category: 'keys', params: {
    oscs: [{ type: 'square', gain: 1 }, { type: 'square', ratio: 2, gain: 0.45 }, { type: 'triangle', ratio: 0.5, gain: 0.5 }],
    filter: { type: 'lowpass', freq: 3200, Q: 1.2, from: 5200, sweep: 0.05 },
    env: { attack: 0.003, decay: 0.12, sustain: 0.3, release: 0.06 }, gain: 0.2 } },
  // 따뜻한 로즈: 사인에 FM 종소리 어택을 얹고 몸통은 길게 울린다. 딥하우스 코드용.
  { id: 'warm_rhodes', name: '따뜻한 로즈', pitched: true, octave: 3, category: 'keys', params: {
    oscs: [{ type: 'sine', gain: 1 }, { type: 'sine', ratio: 2, gain: 0.18 }],
    fm: { ratio: 14, index: 0.8, decay: 0.07 },
    filter: { type: 'lowpass', freq: 3000, Q: 0.7 },
    env: { attack: 0.004, decay: 0.7, sustain: 0.25, release: 0.3 }, gain: 0.3 } },
  // 딥 베이스: 둥근 삼각파 + 서브. 필터가 살짝 닫히며 앞이 통통하다.
  { id: 'deep_bass', name: '딥 베이스', pitched: true, octave: 2, category: 'bass', params: {
    oscs: [{ type: 'triangle', gain: 1 }, { type: 'sine', ratio: 0.5, gain: 0.7 }],
    filter: { type: 'lowpass', freq: 450, Q: 2, from: 1400, sweep: 0.1 },
    env: { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.08 }, gain: 0.4 } },
  // 콩가 (높은): 짧게 떨어지는 사인과 약한 노이즈.
  { id: 'conga_high', name: '콩가 (높은)', pitched: false, category: 'drums', params: {
    oscs: [{ type: 'sine', fixed: 330, gain: 1 }], pitchSlide: { semis: 3, time: 0.03 },
    noise: { gain: 0.1, filter: { type: 'bandpass', freq: 1200, Q: 1 } },
    env: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.03 }, gain: 0.5 } },
  // 클라베: 짧고 건조한 딱 소리.
  { id: 'clave', name: '클라베', pitched: false, category: 'drums', params: {
    oscs: [{ type: 'sine', fixed: 2400, gain: 1 }, { type: 'triangle', fixed: 3600, gain: 0.3 }],
    env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }, gain: 0.4 } },
  // 하우스·일렉트로닉 팝용 2차 (맨 뒤에 붙인다)
  // 보컬 챱: 톱니파 둘이 '아' 모음 포먼트 밴드패스 3개를 지난다. 짧게 끊어 치면 보컬 샘플 조각처럼 들린다.
  { id: 'vocal_chop', name: '보컬 챱', pitched: true, octave: 3, category: 'synth', params: {
    oscs: [{ type: 'sawtooth', gain: 1 }, { type: 'sawtooth', detune: 6, gain: 0.6 }],
    formants: [{ freq: 730, Q: 8, gain: 1 }, { freq: 1090, Q: 10, gain: 0.7 }, { freq: 2440, Q: 12, gain: 0.3 }],
    vibrato: { rate: 5, depth: 10, delay: 0.1 },
    env: { attack: 0.01, decay: 0.15, sustain: 0.45, release: 0.08 }, gain: 0.7 } }, // 포먼트 밴드패스가 대부분을 깎아 초안 0.3은 피크 0.25라 올렸다
  // 하우스 피아노: M1 계열 피아노 스탭. 밝은 FM 어택과 배음, 필터가 빠르게 닫힌다. 코드로 끊어 친다.
  { id: 'house_piano', name: '하우스 피아노', pitched: true, octave: 3, category: 'keys', params: {
    oscs: [{ type: 'triangle', gain: 1 }, { type: 'sine', ratio: 2, gain: 0.5 }, { type: 'square', ratio: 4, gain: 0.08 }],
    fm: { ratio: 3, index: 1.2, decay: 0.08 },
    filter: { type: 'lowpass', freq: 3500, Q: 0.8, from: 7000, sweep: 0.08 },
    env: { attack: 0.002, decay: 0.45, sustain: 0.15, release: 0.15 }, gain: 0.3 } },
  // 퓨처 코드: 디튠 톱니 3개 + 한 옥타브 아래 사각파. 필터 엔벨로프가 열렸다 닫히고 좌우로 넓다(spread).
  { id: 'future_chord', name: '퓨처 코드', pitched: true, octave: 3, category: 'synth', params: {
    oscs: [{ type: 'sawtooth', detune: -15, gain: 1 }, { type: 'square', ratio: 0.5, gain: 0.3 }, { type: 'sawtooth', gain: 1 }, { type: 'sawtooth', detune: 15, gain: 1 }],
    filter: { type: 'lowpass', freq: 1800, Q: 3, from: 6000, sweep: 0.18 }, spread: 0.6,
    env: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.12 }, gain: 0.2 } },
  // 리스 베이스: 디튠 톱니 2개의 느린 맥놀이(위상 흔들림)와 서브. 드럼앤베이스·딥하우스 저음.
  { id: 'reese_bass', name: '리스 베이스', pitched: true, octave: 2, category: 'bass', params: {
    oscs: [{ type: 'sawtooth', detune: -18, gain: 1 }, { type: 'sawtooth', detune: 18, gain: 1 }, { type: 'sine', ratio: 0.5, gain: 0.6 }],
    filter: { type: 'lowpass', freq: 900, Q: 1 }, distortion: { drive: 2 },
    env: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.1 }, gain: 0.25 } },
  // 핑거 스냅: 밴드패스 노이즈의 짧은 딱 소리와 약한 사인.
  { id: 'finger_snap', name: '핑거 스냅', pitched: false, category: 'drums', params: {
    oscs: [{ type: 'sine', fixed: 1800, gain: 0.2 }],
    noise: { gain: 1, filter: { type: 'bandpass', freq: 2600, Q: 3 } },
    env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }, gain: 1.5 } }, // 초안 0.6은 피크 0.17로 너무 작아 올렸다
  // 노이즈 다운리프터: 노이즈 전용 밴드패스가 9kHz에서 300Hz로 내려간다. 드롭 직후·전환용.
  { id: 'noise_down', name: '노이즈 다운리프터', pitched: false, category: 'fx', params: {
    noise: { gain: 1, filter: { type: 'bandpass', freq: 300, Q: 1.2, from: 9000, sweep: 1 } },
    env: { attack: 0.005, decay: 0.95, sustain: 0, release: 0.1 }, gain: 0.35 } },
  // 슈퍼소 패드: 디튠 톱니 5개를 좌우로 넓게 벌린(spread) 느린 패드.
  { id: 'supersaw_pad', name: '슈퍼소 패드', pitched: true, octave: 3, category: 'synth', params: {
    oscs: [{ type: 'sawtooth', detune: -24, gain: 0.7 }, { type: 'sawtooth', detune: -12, gain: 0.9 }, { type: 'sawtooth', gain: 1 },
      { type: 'sawtooth', detune: 12, gain: 0.9 }, { type: 'sawtooth', detune: 24, gain: 0.7 }],
    filter: { type: 'lowpass', freq: 2500, Q: 0.7 }, spread: 0.9,
    env: { attack: 0.25, decay: 0.5, sustain: 0.7, release: 0.6 }, gain: 0.14 } },
];

// 프리셋 목록의 묶음 순서. category가 없는 프리셋(처음 15종)은 '기존 악기'로 원래 순서대로 맨 뒤에 둔다.
const PRESET_CATEGORIES = [
  { id: 'drums', name: '드럼·타악' },
  { id: 'bass', name: '베이스' },
  { id: 'guitar', name: '기타' },
  { id: 'keys', name: '건반' },
  { id: 'synth', name: '신스' },
  { id: 'fx', name: '효과음' },
  { id: null, name: '기존 악기' },
];

// 데모 드럼 소리. 장르를 판단하려고 미리듣기에만 얹는다. 유물이 쓰지 못하게 PRESETS에 넣지 않는다.
// 게임에서는 킥·스네어를 무기가 낸다.
const DEMO_DRUM_SOUNDS = {
  kick: { name: '데모 킥', pitched: false, params: {
    oscs: [{ type: 'sine', fixed: 50, gain: 1 }], pitchSlide: { semis: 24, time: 0.07 },
    env: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.05 }, gain: 0.95 } },
  snare: { name: '데모 스네어', pitched: false, params: {
    oscs: [{ type: 'triangle', fixed: 185, gain: 0.5 }],
    noise: { gain: 1, filter: { type: 'bandpass', freq: 2000, Q: 0.8 } },
    env: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.03 }, gain: 0.55 } },
  // 909 계열 킥: 더 길고 둥근 몸통, 짧은 고음 클릭 노이즈, 약한 포화. '킥 음색'에서 고른다.
  kick909: { name: '데모 909 킥', pitched: false, params: {
    oscs: [{ type: 'sine', fixed: 55, gain: 1 }], pitchSlide: { semis: 30, time: 0.05 },
    noise: { gain: 0.15, filter: { type: 'highpass', freq: 3000, Q: 0.7 } }, distortion: { drive: 1.5 },
    env: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.05 }, gain: 0.85 } }, // 0.95는 포화 때문에 피크 1.03이라 낮췄다
  clap: { name: '데모 클랩', pitched: false, params: {
    noise: { gain: 1 }, filter: { type: 'bandpass', freq: 1300, Q: 1.2 },
    bursts: { count: 3, gap: 0.01 }, env: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.03 }, gain: 0.7 } },
};

// 데모 드럼 패턴. 한 마디의 16분 칸(0~15, 0 = 1박, 4 = 2박, 8 = 3박, 12 = 4박)이고 4마디에 반복한다.
// 8분 격자에서는 짝수 16분 칸만 울린다(홀수 16분 칸 타격은 빠진다). snareSounds는 겹쳐 내는 소리들이다.
const DEMO_DRUMS = {
  none: { name: '없음' },
  rock: { name: '록/J-pop', kick: [0, 7, 8, 10], snare: [4, 12], snareSounds: ['snare'] },
  boombap: { name: '붐뱁', kick: [0, 7, 10], snare: [4, 12], snareSounds: ['snare'] },
  house: { name: '하우스/EDM', kick: [0, 4, 8, 12], snare: [4, 12], snareSounds: ['clap'] },
  electropop: { name: '일렉트로닉 팝', kick: [0, 6, 8, 11], snare: [4, 12], snareSounds: ['clap', 'snare'] },
  twostep: { name: '투스텝/UK 개러지', kick: [0, 7, 10], snare: [4, 12], snareSounds: ['snare'] },
};
for (const p of Object.values(DEMO_DRUMS)) {
  p.kickSet = new Set(p.kick || []);
  p.snareSet = new Set(p.snare || []);
}
const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// 음높이
// ---------------------------------------------------------------------------
function midiName(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 음높이 악기 row행의 MIDI 번호. 타악은 null.
// 키(state.root 반음)와 유물의 옥타브 이동(relic.octaveShift x 12)을 더한다. 0~127을 벗어나면 옥타브 단위로 안으로 접는다.
function rowMidi(preset, row, scaleName, relic = null) {
  if (!preset.pitched) return null;
  const scale = SCALES[scaleName];
  let midi = 12 * (preset.octave + 1) + scale[row % scale.length] + 12 * Math.floor(row / scale.length);
  midi += state.root + 12 * octaveShift(relic);
  while (midi > 127) midi -= 12;
  while (midi < 0) midi += 12;
  return midi;
}
// 키를 반영한 스케일 이름. root 0이면 스케일 이름 그대로, 아니면 "A 자연 단음계 (C 자연 단음계 + root 9)".
const keyScaleName = (scale = state.scale, root = state.root) => (root ? `${NOTE_NAMES[root]}${scale.slice(1)} (${scale} + root ${root})` : scale);
const octaveShift = (relic) => (relic && Number.isInteger(relic.octaveShift) ? clamp(relic.octaveShift, TOOL.OCTAVE_SHIFT_MIN, TOOL.OCTAVE_SHIFT_MAX) : 0);

// 음높이 악기의 행 수는 전체 설정 pitchRows(8 또는 15)다. 타악은 1행.
function rowCount(preset, pitchRows = state.pitchRows) {
  return preset.pitched ? pitchRows : 1;
}

// 칸 번호 -> "박.위치". 8분 격자: 0 -> 1.0, 1 -> 1.5. 16분 격자: 0 -> 1.0, 1 -> 1.25, 2 -> 1.5, 3 -> 1.75.
const STEP_FRACTIONS = { 8: ['0', '5'], 16: ['0', '25', '5', '75'] };
function stepLabel(step, grid = state.grid) {
  const per = grid / 4;
  return `${Math.floor(step / per) + 1}.${STEP_FRACTIONS[grid][step % per]}`;
}

// 격자와 템포에서 계산하는 시간 값. 루프는 항상 16박(4마디)이다.
const gridSteps = (grid = state.grid) => (grid === 16 ? 64 : 32);
const stepsPerBeat = (grid = state.grid) => grid / 4;
// 1칸 시간(초). 8분 격자 30 / bpm, 16분 격자 15 / bpm (나눗셈 한 번이라 130BPM 8분은 이전 상수 30 / 130과 같다)
const stepSeconds = () => (state.grid === 16 ? 15 : 30) / state.bpm;
const loopSeconds = () => gridSteps() * stepSeconds();
const delaySeconds = () => TOOL.DELAY_NOTES[state.delayNote] * 60 / state.bpm;
const noteLengthChoices = () => TOOL.NOTE_LENGTHS[state.grid];
// 칸의 한 마디 안 16분 위치(0~15). 데모 드럼 패턴을 찾을 때 쓴다.
const sixteenthInBar = (step) => (state.grid === 16 ? step % 16 : (step % 8) * 2);

// ---------------------------------------------------------------------------
// 상태와 저장
// ---------------------------------------------------------------------------
// relic: { id, name, preset, notes: [{ step, row, velocity?, length? }], volume, checked,
//          sidechain?, reverbSend?, delaySend?, lofi?, lowCut?, highCut?,   (?는 없으면 기본값: velocity 1, length 1, 나머지 0)
//          swing?(없으면 전체 스윙), octaveShift?(0), pan?(0), filterSweep?({ from, to }, 없으면 없음) }
// mix: 칸마다 { relicId, volume } 또는 null
function defaultState() {
  return {
    scale: TOOL.DEFAULT_SCALE,
    relics: [],
    selectedId: null,
    mix: Array(TOOL.MIX_SLOTS).fill(null),
    nextId: 1,
    bpm: TOOL.DEFAULT_BPM, // 템포 (4분음표 기준, 정수 BPM_MIN ~ BPM_MAX)
    grid: TOOL.DEFAULT_GRID, // 8 (32칸) 또는 16 (64칸)
    delayNote: TOOL.DEFAULT_DELAY_NOTE, // 공통 딜레이 음표 (DELAY_NOTES 키)
    root: 0,               // 키: C에서 올린 반음 수 (0~11)
    pitchRows: TOOL.PITCH_ROWS, // 음높이 악기 행 수 (8 또는 15)
    drum: 'none',          // 데모 드럼 패턴 (DEMO_DRUMS 키)
    drumKick: true,        // 데모 드럼 킥 소리 켜기
    kickSound: 'kick',     // 데모 드럼 킥 음색 ('kick' 기본 / 'kick909')
    chordMode: 'none',     // 코드 찍기 도우미 (CHORD_SHAPES 키)
    drumSnare: true,       // 데모 드럼 스네어·클랩 소리 켜기
    pumpSource: 'demo',    // 사이드체인 기준: 'demo'(데모 드럼 킥) 또는 'quarter'(소리 없이 4분음표마다)
    drumVolume: 1,
    swing: 0,              // 0 ~ SWING_MAX
    vinyl: false,          // 바이닐 노이즈 (재생 전용)
    wavDrums: false,       // WAV 내보내기에 데모 드럼 소리 포함
    inputVelocity: 1,      // 새로 찍는 노트의 세기
    newLength: 1,          // 새로 찍는 노트의 길이 (칸)
    newRepeat: 1,          // 새로 찍는 노트의 롤 (한 칸 안 타격 수)
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clampBpm = (v) => clamp(Math.round(num(v, TOOL.DEFAULT_BPM)), TOOL.BPM_MIN, TOOL.BPM_MAX);
const clampRoot = (v) => clamp(Math.round(num(v, 0)), 0, TOOL.ROOT_MAX);

// 코드 찍기 도우미: 누른 행을 근음으로 스케일 위에 쌓는 행 간격 (행 = 스케일 음 한 칸)
const CHORD_SHAPES = {
  none: { name: '없음', rows: [0] },
  triad: { name: '3화음', rows: [0, 2, 4] },
  seventh: { name: '7화음', rows: [0, 2, 4, 6] },
  sus4: { name: 'sus4', rows: [0, 3, 4] },
  add9: { name: 'add9', rows: [0, 2, 4, 8] },
};

// 유물의 단계 2·3 선택 항목을 정리한다. 기본값이면 지운다(없으면 기본값으로 읽는다).
//   swing: 0~SWING_MAX (없으면 전체 스윙), octaveShift: 정수 -2~2, pan: -1~1, filterSweep: { from, to } 각 0~1
const RELIC_EXTRA_FIELDS = ['swing', 'octaveShift', 'pan', 'filterSweep'];
function normalizeRelicExtras(r) {
  if (typeof r.swing === 'number' && Number.isFinite(r.swing)) r.swing = clamp(r.swing, 0, TOOL.SWING_MAX);
  else delete r.swing;
  const shift = clamp(Math.round(num(r.octaveShift, 0)), TOOL.OCTAVE_SHIFT_MIN, TOOL.OCTAVE_SHIFT_MAX);
  if (shift) r.octaveShift = shift;
  else delete r.octaveShift;
  const pan = clamp(num(r.pan, 0), -1, 1);
  if (pan) r.pan = pan;
  else delete r.pan;
  const fs = r.filterSweep;
  if (fs && typeof fs === 'object' && (num(fs.from, 0) > 0 || num(fs.to, 0) > 0)) {
    r.filterSweep = { from: clamp(num(fs.from, 0), 0, 1), to: clamp(num(fs.to, 0), 0, 1) };
  } else {
    delete r.filterSweep;
  }
  return r;
}
// 유물이 쓰는 스윙: 자기 값이 있으면 그 값, 없으면 전체 스윙
const relicSwing = (relic) => (relic && typeof relic.swing === 'number' ? relic.swing : state.swing);

// 이전 버전에서 저장한 작업도 열리도록 없는 항목은 기본값으로 채우고 범위를 맞춘다
function loadState() {
  try {
    const raw = localStorage.getItem(TOOL.STORAGE_PREFIX + 'state');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.relics) || !SCALES[s.scale]) return null;
    const base = defaultState();
    for (const key of Object.keys(base)) if (s[key] === undefined) s[key] = base[key];
    s.mix = Array.from({ length: TOOL.MIX_SLOTS }, (_, i) => (s.mix && s.mix[i]) || null);
    s.relics = s.relics.filter((r) => r && typeof r.name === 'string' && PRESET_BY_ID[r.preset]);
    if (!DEMO_DRUMS[s.drum]) s.drum = 'none';
    if (!TOOL.GRIDS.includes(s.grid)) s.grid = TOOL.DEFAULT_GRID;
    s.bpm = clampBpm(s.bpm);
    if (!TOOL.DELAY_NOTES[s.delayNote]) s.delayNote = TOOL.DEFAULT_DELAY_NOTE;
    if (s.pumpSource !== 'quarter') s.pumpSource = 'demo';
    s.drumKick = s.drumKick !== false;
    s.drumSnare = s.drumSnare !== false;
    s.drumVolume = clamp(num(s.drumVolume, 1), 0, TOOL.DEMO_DRUM_VOLUME_MAX);
    s.swing = clamp(num(s.swing, 0), 0, TOOL.SWING_MAX);
    s.inputVelocity = clamp(num(s.inputVelocity, 1), 0, 1);
    if (!TOOL.NOTE_LENGTHS[s.grid].includes(s.newLength)) s.newLength = 1;
    if (!TOOL.NOTE_REPEATS.includes(s.newRepeat)) s.newRepeat = 1;
    s.root = clampRoot(s.root);
    if (!TOOL.PITCH_ROW_CHOICES.includes(s.pitchRows)) s.pitchRows = TOOL.PITCH_ROWS;
    if (s.kickSound !== 'kick909') s.kickSound = 'kick';
    if (!CHORD_SHAPES[s.chordMode]) s.chordMode = 'none';
    // 여기서는 아직 전역 state가 없으므로 칸 수와 행 수를 저장된 값으로 넘긴다
    for (const r of s.relics) {
      normalizeRelicExtras(r);
      normalizeNotes(r, gridSteps(s.grid), s.pitchRows);
    }
    return s;
  } catch (e) {
    return null;
  }
}

// 노트와 유물의 새 항목. 없으면 기본값이다.
const noteVelocity = (n) => (n.velocity === undefined ? 1 : n.velocity);
function noteLength(n, preset) {
  return preset.pitched && n.length && !(n.repeat > 1) ? n.length : 1;
}
const noteRepeat = (n) => (n.repeat > 1 ? n.repeat : 1);
const MIX_FIELDS = ['sidechain', 'reverbSend', 'delaySend', 'lofi', 'lowCut', 'highCut'];
function relicMix(relic) {
  const m = {};
  for (const k of MIX_FIELDS) m[k] = clamp(num(relic[k], 0), 0, 1);
  return m;
}
// 저음 깎기·고음 깎기 값(0~1)의 필터 주파수(Hz)
const lowCutFreq = (v) => TOOL.LOW_CUT_MIN * Math.pow(TOOL.CUT_FULL / TOOL.LOW_CUT_MIN, v);
const highCutFreq = (v) => TOOL.HIGH_CUT_MAX * Math.pow(TOOL.CUT_FULL / TOOL.HIGH_CUT_MAX, v);
// 체인 구조를 정하는 값(로파이 값, 필터·센드·팬·필터 스윕 유무). 바뀌면 실시간 재생에서 체인을 새로 만든다.
const chainKey = (m, relic) => `${m.lofi}|${m.lowCut > 0}|${m.highCut > 0}|${m.reverbSend > 0}|${m.delaySend > 0}|${!!relic.pan}|${!!relic.filterSweep}`;

// 필터 스윕: 루프 머리 t에서 로우패스 컷오프를 from에서 to로 한 바퀴 동안 지수 램프로 움직인다 (0~1 -> Hz는 고음 깎기와 같다)
function sweepAt(chain, relic, t) {
  if (!chain.sweep || !relic.filterSweep) return;
  const f = chain.sweep.frequency;
  f.setValueAtTime(highCutFreq(relic.filterSweep.from), t);
  f.exponentialRampToValueAtTime(highCutFreq(relic.filterSweep.to), t + loopSeconds());
}

// 노트를 정리한다: 기본값 항목은 지우고, 같은 칸·행 중복을 지우고, 음높이 악기는 같은 행에서 겹치지 않게
// 길이를 다음 노트 직전과 루프 끝까지로 자른다. 타악은 길이를 쓰지 않는다. 칸 범위(0 ~ steps-1)를 벗어난 노트는 지운다.
function normalizeNotes(relic, steps = gridSteps(), pitchRows = state.pitchRows) {
  const preset = PRESET_BY_ID[relic.preset];
  const rows = rowCount(preset, pitchRows);
  const seen = new Set();
  const notes = [];
  for (const n of relic.notes) {
    if (!Number.isInteger(n.step) || n.step < 0 || n.step >= steps) continue;
    const note = { step: n.step, row: Math.min(n.row, rows - 1) };
    const key = `${note.step},${note.row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const v = clamp(num(n.velocity, 1), 0, 1);
    if (v !== 1) note.velocity = v;
    // 롤(repeat)은 정수 1~REPEAT_MAX로 맞추고, 롤 노트는 길이를 쓰지 않는다
    const repeat = clamp(Math.round(num(n.repeat, 1)), 1, TOOL.REPEAT_MAX);
    if (repeat > 1) note.repeat = repeat;
    else if (preset.pitched && Number.isInteger(n.length) && n.length > 1) note.length = n.length;
    notes.push(note);
  }
  notes.sort((a, b) => a.step - b.step || a.row - b.row);
  if (preset.pitched) {
    for (const n of notes) {
      if (!n.length) continue;
      const next = notes.find((o) => o.row === n.row && o.step > n.step);
      const limit = (next ? next.step : steps) - n.step;
      n.length = Math.min(n.length, limit);
      if (n.length <= 1) delete n.length;
    }
  }
  relic.notes = notes;
}

// 격자를 바꿀 때 유물 하나의 노트를 옮긴다. 시각(소리)이 같게 유지된다.
// 8 -> 16: step과 length를 2배. 16 -> 8: 홀수 칸에서 시작하는 노트는 지우고, 나머지는 반으로(length는 올림).
// 롤(repeat)은 그대로 둔다. 지운 노트 수를 돌려준다.
function convertRelicGrid(relic, from, to) {
  if (from === to) return 0;
  let dropped = 0;
  const notes = [];
  for (const n of relic.notes) {
    const note = { ...n };
    if (to === 16) {
      note.step = n.step * 2;
      if (n.length > 1) note.length = n.length * 2;
    } else {
      if (n.step % 2) { dropped++; continue; }
      note.step = n.step / 2;
      if (n.length > 1) note.length = Math.ceil(n.length / 2);
    }
    notes.push(note);
  }
  relic.notes = notes;
  normalizeNotes(relic, gridSteps(to));
  return dropped;
}
const oddStepNotes = (relics) => relics.reduce((sum, r) => sum + r.notes.filter((n) => n.step % 2).length, 0);

let state = loadState() || defaultState();
let saveTimer = null;
let saveWarned = false;

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, TOOL.SAVE_DELAY_MS);
}

// 저장에 실패해도(저장 공간 부족, 차단) 안내만 하고 툴은 그대로 쓴다
function saveNow() {
  try {
    localStorage.setItem(TOOL.STORAGE_PREFIX + 'state', JSON.stringify(state));
    saveWarned = false;
  } catch (e) {
    if (!saveWarned) {
      saveWarned = true;
      const why = e && e.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족하다' : '브라우저가 저장을 막았다';
      setStatus(`자동 저장 실패: ${why}. 작업은 계속할 수 있지만 새로 고치면 사라지니 설계서로 내보내 두세요.`, true);
    }
  }
}

function relicById(id) {
  return state.relics.find((r) => r.id === id) || null;
}

function selectedRelic() {
  return relicById(state.selectedId);
}

// 악기를 바꾸면 행 수에 맞춘다. 타악(1행)이 되면 모든 노트를 행 0으로 모으고 같은 칸의 중복과 길이를 지운다.
function fitNotesToPreset(relic) {
  normalizeNotes(relic);
}

// (step, row)를 덮는 노트. 음높이 악기는 길이만큼 덮는다.
function coveringNote(relic, step, row) {
  const preset = PRESET_BY_ID[relic.preset];
  return relic.notes.find((n) => n.row === row && n.step <= step && step < n.step + noteLength(n, preset)) || null;
}

// ---------------------------------------------------------------------------
// 소리 합성
// ---------------------------------------------------------------------------
const noiseBuffers = new WeakMap();

function noiseBuffer(ctx) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * TOOL.NOISE_SECONDS), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

function makeFilter(ctx, f, t) {
  const filter = ctx.createBiquadFilter();
  filter.type = f.type;
  filter.Q.value = f.Q ?? 1;
  if (f.from) {
    filter.frequency.setValueAtTime(f.from, t);
    filter.frequency.exponentialRampToValueAtTime(f.freq, t + f.sweep);
  } else {
    filter.frequency.value = f.freq;
  }
  return filter;
}

// drive별 tanh 곡선. 한 번 만들어 재사용한다.
const distortionCurves = new Map();

function distortionCurve(drive) {
  let curve = distortionCurves.get(drive);
  if (!curve) {
    const n = TOOL.DISTORTION_CURVE_SIZE;
    curve = new Float32Array(n);
    const norm = Math.tanh(drive);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(drive * x) / norm;
    }
    distortionCurves.set(drive, curve);
  }
  return curve;
}

// 노트 하나를 t초에 예약한다. midi는 음높이 악기만 쓴다. 노트가 끝나는 시각을 돌려준다.
// volume은 노트 게인 배율(벨로시티 등), gate는 노트 길이(초)다. 게이트 = max(gate, attack + decay, hold).
// 노트마다 만든 노드는 소리가 끝나면 연결을 끊어 쌓이지 않게 한다.
function scheduleNote(ctx, out, preset, midi, t, volume = 1, gate = stepSeconds()) {
  const p = preset.params;
  const env = p.env;
  const peak = p.gain * volume;
  if (peak <= 0) return t;
  const nodes = [];
  const track = (node) => { nodes.push(node); return node; };
  const amp = track(ctx.createGain());
  // 디케이 끝과 게이트 끝을 한 번만 계산해 게이트 끝이 디케이 끝보다 앞서지 않게 한다.
  // (따로 더하면 t가 클 때 반올림으로 게이트 끝이 아주 조금 앞서, 감쇠 램프가 무시되고 소리가 최대 음량으로 남는다)
  const decayEnd = t + (env.attack + env.decay);
  const gateEnd = Math.max(t + Math.max(gate, p.hold || 0), decayEnd);
  const end = gateEnd + env.release;
  const floor = 0.0001;
  amp.gain.setValueAtTime(0, t);
  if (p.bursts) {
    // 짧은 타격을 gap 간격으로 겹친 뒤 마지막 타격이 decay 동안 사라진다
    for (let i = 0; i < p.bursts.count; i++) {
      const tb = t + i * p.bursts.gap;
      amp.gain.setValueAtTime(peak, tb);
      amp.gain.exponentialRampToValueAtTime(peak * 0.15, tb + p.bursts.gap * 0.9);
    }
    const last = t + (p.bursts.count - 1) * p.bursts.gap;
    amp.gain.setValueAtTime(peak, last + p.bursts.gap);
    amp.gain.exponentialRampToValueAtTime(floor, last + p.bursts.gap + env.decay);
  } else {
    const sustainLevel = Math.max(floor, peak * env.sustain);
    amp.gain.linearRampToValueAtTime(peak, t + env.attack);
    amp.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);
    amp.gain.setValueAtTime(sustainLevel, gateEnd);
    amp.gain.exponentialRampToValueAtTime(floor, end);
  }
  amp.connect(out);

  // 포먼트(보컬 챱): 있으면 메인 필터 대신 병렬 밴드패스 여러 개를 지나 합친다 (formants가 filter보다 우선)
  let formantBank = null;
  if (p.formants) {
    formantBank = track(ctx.createGain());
    for (const fm of p.formants) {
      const bp = track(ctx.createBiquadFilter());
      bp.type = 'bandpass';
      bp.frequency.value = fm.freq;
      bp.Q.value = fm.Q;
      const g = track(ctx.createGain());
      g.gain.value = fm.gain;
      formantBank.connect(bp);
      bp.connect(g);
      g.connect(amp);
    }
  }
  const main = p.filter && !formantBank ? track(makeFilter(ctx, p.filter, t)) : null;
  if (main) main.connect(amp);
  const into = formantBank || main || amp;
  const sources = [];

  // 필터 LFO: 사인 LFO가 메인 필터 주파수에 ±depth Hz를 더한다 (from/sweep 스윕 위에 얹힌다).
  // 노트 시작 시각에 위상 0으로 시작하고 다른 소스와 함께 멈춘다. 메인 필터가 없으면 쓰지 않는다.
  if (p.filterLfo && main) {
    const lfo = track(ctx.createOscillator());
    lfo.type = 'sine';
    lfo.frequency.value = p.filterLfo.rate;
    const lfoGain = track(ctx.createGain());
    lfoGain.gain.value = p.filterLfo.depth;
    lfo.connect(lfoGain);
    lfoGain.connect(main.frequency);
    sources.push(lfo);
  }

  // 오실레이터 경로: 오실레이터들 -> (디스토션) -> 메인 필터
  let oscInto = into;
  if (p.distortion && p.oscs) {
    const shaper = track(ctx.createWaveShaper());
    shaper.curve = distortionCurve(p.distortion.drive);
    shaper.oversample = '2x';
    shaper.connect(into);
    oscInto = shaper;
  }
  // FM: 사인 모듈레이터 하나가 모든 오실레이터의 주파수를 흔든다
  let fmGain = null;
  if (p.fm && p.oscs) {
    const modFreq = midiToFreq(midi) * p.fm.ratio;
    const mod = track(ctx.createOscillator());
    mod.type = 'sine';
    mod.frequency.value = modFreq;
    fmGain = track(ctx.createGain());
    fmGain.gain.setValueAtTime(p.fm.index * modFreq, t);
    fmGain.gain.linearRampToValueAtTime(0, t + p.fm.decay);
    mod.connect(fmGain);
    sources.push(mod);
  }
  // 비브라토: LFO가 모든 오실레이터의 detune(센트)을 흔든다
  let vibGain = null;
  if (p.vibrato && p.oscs) {
    const lfo = track(ctx.createOscillator());
    lfo.type = 'sine';
    lfo.frequency.value = p.vibrato.rate;
    vibGain = track(ctx.createGain());
    vibGain.gain.setValueAtTime(0, t);
    vibGain.gain.setValueAtTime(0, t + p.vibrato.delay);
    vibGain.gain.linearRampToValueAtTime(p.vibrato.depth, t + p.vibrato.delay + TOOL.VIBRATO_FADE);
    lfo.connect(vibGain);
    sources.push(lfo);
  }

  // spread: 오실레이터들을 좌우로 벌린다 (첫 오실레이터 -spread, 마지막 +spread, 사이는 고르게)
  const oscCount = (p.oscs || []).length;
  let oscIndex = 0;
  for (const o of p.oscs || []) {
    const osc = track(ctx.createOscillator());
    osc.type = o.type;
    const freq = o.fixed ?? midiToFreq(midi) * (o.ratio ?? 1);
    if (p.pitchSlide) {
      osc.frequency.setValueAtTime(freq * Math.pow(2, p.pitchSlide.semis / 12), t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + p.pitchSlide.time);
    } else {
      osc.frequency.value = freq;
    }
    if (o.detune) osc.detune.value = o.detune;
    if (fmGain) fmGain.connect(osc.frequency);
    if (vibGain) vibGain.connect(osc.detune);
    const g = track(ctx.createGain());
    g.gain.value = o.gain ?? 1;
    osc.connect(g);
    if (p.spread && oscCount > 1) {
      const pan = track(ctx.createStereoPanner());
      pan.pan.value = p.spread * (-1 + (2 * oscIndex) / (oscCount - 1));
      g.connect(pan);
      pan.connect(oscInto);
    } else {
      g.connect(oscInto);
    }
    oscIndex++;
    sources.push(osc);
  }
  if (p.noise) {
    const src = track(ctx.createBufferSource());
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const g = track(ctx.createGain());
    g.gain.value = p.noise.gain;
    src.connect(g);
    if (p.noise.filter) {
      const nf = track(makeFilter(ctx, p.noise.filter, t));
      g.connect(nf);
      nf.connect(amp);
    } else {
      g.connect(into);
    }
    sources.push(src);
  }
  for (const s of sources) {
    s.start(t);
    s.stop(end + 0.02);
  }
  // 모든 소스가 같은 시각에 멈추므로 첫 소스가 끝나면 노트의 노드를 모두 끊는다
  if (sources.length) {
    sources[0].onended = () => { for (const node of nodes) node.disconnect(); };
  }
  return end;
}

// 시드 고정 난수 (리버브 임펄스처럼 렌더마다 같아야 하는 곳에 쓴다)
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 리버브 임펄스 응답: 스테레오, 감쇠하는 노이즈. 컨텍스트마다 한 번 만든다.
const reverbBuffers = new WeakMap();
function reverbImpulse(ctx) {
  let buffer = reverbBuffers.get(ctx);
  if (!buffer) {
    const length = Math.floor(ctx.sampleRate * TOOL.REVERB_SECONDS);
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    const rand = seededRandom(TOOL.REVERB_SEED);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (rand() * 2 - 1) * Math.pow(1 - i / length, TOOL.REVERB_DECAY_POWER);
    }
    reverbBuffers.set(ctx, buffer);
  }
  return buffer;
}

// 로파이 계단 곡선: lofi가 클수록 단계(비트)가 적다
const lofiCurves = new Map();
function lofiCurve(lofi) {
  const key = Math.round(lofi * 1000);
  let curve = lofiCurves.get(key);
  if (!curve) {
    const bits = TOOL.LOFI_BITS_MAX - (TOOL.LOFI_BITS_MAX - TOOL.LOFI_BITS_MIN) * lofi;
    const levels = Math.pow(2, bits - 1);
    const n = TOOL.LOFI_CURVE_SIZE;
    curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    lofiCurves.set(key, curve);
  }
  return curve;
}

// 마스터 버스: 입력 게인 -> 압축기 -> 리미터 -> 출력. 리버브와 딜레이 버스의 출력은 입력 게인에 합친다(리미터 앞).
// 리버브·딜레이 버스는 보내는 소리가 없으면 아무 소리도 내지 않는다.
// dynamics가 false면 압축기·리미터 없이 입력 게인을 바로 출력에 잇는다 (WAV 렌더의 첫 단계).
function makeBus(ctx, dynamics = true) {
  const gain = ctx.createGain();
  gain.gain.value = TOOL.MASTER_GAIN;
  gain.connect(dynamics ? makeDynamics(ctx) : ctx.destination);
  const reverb = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = reverbImpulse(ctx);
  reverb.connect(convolver);
  convolver.connect(gain);

  const delayIn = ctx.createGain();
  // 최대 지연 시간이 달라지면 렌더가 아주 조금(상대 5e-5) 달라지므로, 1초 이하면 이전과 같은 1초로 만든다
  const delayMax = delaySeconds() <= 1 ? 1 : TOOL.DELAY_MAX_SECONDS;
  const delay = ctx.createDelay(delayMax);
  delay.delayTime.value = delaySeconds();
  const feedbackFilter = ctx.createBiquadFilter();
  feedbackFilter.type = 'lowpass';
  feedbackFilter.frequency.value = TOOL.DELAY_FEEDBACK_LOWPASS;
  const feedback = ctx.createGain();
  feedback.gain.value = TOOL.DELAY_FEEDBACK;
  delayIn.connect(delay);
  delay.connect(feedbackFilter);
  feedbackFilter.connect(feedback);
  feedback.connect(delay);
  delay.connect(gain);

  return { input: gain, reverb, delay: delayIn, delayNode: delay, delayMax };
}

// 압축기 -> 리미터 -> 출력. 들어갈 노드를 돌려준다.
function makeDynamics(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  // 리미터: 여러 층이 같은 박에 겹쳐도 1.0을 넘지 않게 마지막에 순간 피크만 누른다
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = TOOL.LIMITER_THRESHOLD_DB;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0;
  limiter.release.value = 0.05;
  comp.connect(limiter);
  limiter.connect(ctx.destination);
  return comp;
}

// 유물 하나의 출력 체인: 볼륨 -> 사이드체인 덕킹 -> (하이패스) -> (로우패스) -> (로파이) -> 마스터,
// 그리고 필터를 지난 소리에서 리버브·딜레이 센드.
// 새 항목이 기본값(0)이면 필터·로파이·센드 노드를 만들지 않아 소리가 이전과 같다.
function makeChain(ctx, bus, relic, volume) {
  const m = relicMix(relic);
  const nodes = [];
  const input = ctx.createGain();
  input.gain.value = volume;
  const duck = ctx.createGain();
  input.connect(duck);
  nodes.push(input, duck);
  let out = duck;
  const cut = (amount, type, freq) => {
    if (amount <= 0) return null;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = TOOL.CUT_Q;
    out.connect(f);
    nodes.push(f);
    out = f;
    return f;
  };
  const lowCut = cut(m.lowCut, 'highpass', lowCutFreq(m.lowCut));
  const highCut = cut(m.highCut, 'lowpass', highCutFreq(m.highCut));
  // 필터 스윕: 고음 깎기와 따로(직렬로) 거는 로우패스. 루프 머리마다 sweepAt이 from -> to 램프를 건다.
  const fs = relic.filterSweep;
  const sweep = fs ? cut(1, 'lowpass', highCutFreq(fs.from)) : null;
  if (m.lofi > 0) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = lofiCurve(m.lofi);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = TOOL.LOFI_CUTOFF_MAX * Math.pow(TOOL.LOFI_CUTOFF_MIN / TOOL.LOFI_CUTOFF_MAX, m.lofi);
    out.connect(shaper);
    shaper.connect(lowpass);
    nodes.push(shaper, lowpass);
    out = lowpass;
  }
  // 팬: 0이 아니면 마스터로 가는 소리만 좌우로 보낸다. 리버브·딜레이 센드는 팬 앞(가운데)에서 뽑는다.
  let panner = null;
  if (relic.pan) {
    panner = ctx.createStereoPanner();
    panner.pan.value = relic.pan;
    out.connect(panner);
    panner.connect(bus.input);
    nodes.push(panner);
  } else {
    out.connect(bus.input);
  }
  const send = (amount, target) => {
    if (amount <= 0) return null;
    const g = ctx.createGain();
    g.gain.value = amount;
    out.connect(g);
    g.connect(target);
    nodes.push(g);
    return g;
  };
  return {
    input, duck, nodes, lowCut, highCut, sweep, panner,
    sidechain: m.sidechain,
    reverbSend: send(m.reverbSend, bus.reverb),
    delaySend: send(m.delaySend, bus.delay),
    key: chainKey(m, relic),
  };
}

// 재생 시작부터 센 g번째 칸(루프를 돌아도 계속 증가)의 시각(초). 홀수 칸은 스윙만큼 늦다.
// 부동소수 반올림까지 같게 하려고 곱셈 하나로 계산한다 (g x 칸 시간).
// swing을 넘기면 그 값(유물별 스윙)을, 없으면 전체 스윙을 쓴다.
function stepTime(g, swing = state.swing) {
  const s = stepSeconds();
  return g * s + (g % 2 ? swing * s : 0);
}

// 칸 step에서 시작해 length칸 이어지는 노트의 게이트(초). 끝 칸 경계도 스윙 규칙을 따른다.
function noteGate(step, length, swing = state.swing) {
  const s = stepSeconds();
  const sw = swing * s;
  return length * s + ((step + length) % 2 ? sw : 0) - (step % 2 ? sw : 0);
}

// 유물 하나의 g번째 칸(재생 시작부터 센 칸, step = g % 칸 수) 노트를 base + stepTime(g, 유물 스윙)초에 예약한다.
// 길이는 루프 끝에서 자른다. 롤 노트(repeat k)는 그 칸(스윙 반영)을 k등분해 같은 세기로 k번 치고, 한 번의 게이트는 그 간격이다.
function scheduleRelicStep(ctx, out, relic, step, base, g) {
  const preset = PRESET_BY_ID[relic.preset];
  const steps = gridSteps();
  const swing = relicSwing(relic);
  const t = base + stepTime(g, swing);
  for (const n of relic.notes) {
    if (n.step !== step) continue;
    const midi = rowMidi(preset, n.row, state.scale, relic);
    const repeat = noteRepeat(n);
    if (repeat > 1) {
      const interval = noteGate(step, 1, swing) / repeat;
      for (let i = 0; i < repeat; i++) scheduleNote(ctx, out, preset, midi, t + i * interval, noteVelocity(n), interval);
      continue;
    }
    const length = Math.min(noteLength(n, preset), steps - step);
    scheduleNote(ctx, out, preset, midi, t, noteVelocity(n), noteGate(step, length, swing));
  }
}

// 사이드체인: 킥 시각 t에 덕킹 게인을 눌렀다가 되돌린다 (램프라 클릭이 나지 않는다)
function duckAt(chain, t) {
  if (!(chain.sidechain > 0)) return;
  const g = chain.duck.gain;
  g.setValueAtTime(1, t);
  g.linearRampToValueAtTime(1 - chain.sidechain, t + TOOL.SIDECHAIN_ATTACK);
  g.linearRampToValueAtTime(1, t + TOOL.SIDECHAIN_ATTACK + TOOL.SIDECHAIN_RELEASE);
}

// 데모 드럼의 step칸이 울리는 소리. 꺼 둔 소리(drumKick/drumSnare)는 빠진다.
function drumHits(step) {
  const pattern = state.drum !== 'none' && DEMO_DRUMS[state.drum];
  if (!pattern) return { kick: false, snares: [] };
  const pos = sixteenthInBar(step);
  return {
    kick: state.drumKick && pattern.kickSet.has(pos),
    snares: state.drumSnare && pattern.snareSet.has(pos) ? pattern.snareSounds : [],
  };
}

// 사이드체인을 거는 칸인가. 'demo'는 데모 드럼 킥이 울리는 칸, 'quarter'는 매 박 머리(소리 없음)다.
// 'quarter'일 때는 데모 드럼 킥 칸이어도 박 머리에서 한 번만 건다.
function pumpsAt(step) {
  if (state.pumpSource === 'quarter') return step % stepsPerBeat() === 0;
  return drumHits(step).kick;
}

// 데모 드럼의 step칸. drumOut이 있으면 소리를 내고, 펌핑 기준 칸이면 체인들을 덕킹한다.
function scheduleDrumStep(ctx, drumOut, chains, step, t) {
  const hits = drumHits(step);
  if (drumOut) {
    if (hits.kick) scheduleNote(ctx, drumOut, DEMO_DRUM_SOUNDS[state.kickSound] || DEMO_DRUM_SOUNDS.kick, null, t);
    for (const sound of hits.snares) scheduleNote(ctx, drumOut, DEMO_DRUM_SOUNDS[sound], null, t);
  }
  if (pumpsAt(step)) for (const chain of chains) duckAt(chain, t);
}

// ---------------------------------------------------------------------------
// 실시간 재생
// ---------------------------------------------------------------------------
const Player = {
  ctx: null,
  bus: null,
  mode: null,        // 'single' | 'mix' | null
  startTime: 0,
  nextStep: 0,       // 다음에 예약할 칸 (루프를 돌아도 계속 증가)
  timer: null,
  tracks: new Map(), // 유물 id -> 그 유물의 출력 체인 (makeChain)
  drumGain: null,    // 데모 드럼 볼륨
  vinyl: null,       // 바이닐 노이즈 소스
  stats: { scheduled: 0, late: 0, firstTimes: [] }, // 검증용: 예약 수, 늦게 예약된 노트 수, 루프별 첫 칸 시각

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.bus = makeBus(this.ctx);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // 지금 재생할 유물과 칸별 볼륨. 단일 재생은 선택한 유물을 따라간다.
  layers() {
    if (this.mode === 'single') {
      const r = selectedRelic();
      return r ? [{ relic: r, volume: r.volume }] : [];
    }
    if (this.mode === 'mix') {
      return state.mix.filter(Boolean)
        .map((slot) => ({ relic: relicById(slot.relicId), volume: slot.volume }))
        .filter((l) => l.relic)
        .map((l) => ({ relic: l.relic, volume: l.relic.volume * l.volume }));
    }
    return [];
  },

  // 공통 딜레이 시간을 지금 템포·딜레이 음표에 맞춘다
  // 딜레이 노드의 최대 시간을 넘으면 버스를 새로 만든다 (재생 중이면 다시 시작한다).
  syncDelay() {
    if (!this.bus) return;
    if (delaySeconds() > this.bus.delayMax) {
      const mode = this.mode;
      this.stop();
      this.bus = makeBus(this.ctx);
      if (mode) this.start(mode);
      return;
    }
    this.bus.delayNode.delayTime.setTargetAtTime(delaySeconds(), this.ctx.currentTime, 0.02);
  },

  // 체인을 없애기 전에 소리를 빠르게 줄이고 잠시 뒤 끊는다
  dropChain(chain) {
    chain.input.gain.cancelScheduledValues(this.ctx.currentTime);
    chain.input.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    setTimeout(() => { for (const n of chain.nodes) n.disconnect(); }, 300);
  },

  // 유물의 체인. 로파이 값·필터·센드 유무가 바뀌었으면 새로 만들고, 볼륨·센드 양·필터 주파수·사이드체인은 바로 반영한다.
  chain(relic, volume) {
    let chain = this.tracks.get(relic.id);
    const m = relicMix(relic);
    const key = chainKey(m, relic);
    if (chain && chain.key !== key) {
      this.dropChain(chain);
      chain = null;
    }
    if (!chain) {
      chain = makeChain(this.ctx, this.bus, relic, volume);
      this.tracks.set(relic.id, chain);
    }
    chain.input.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.01);
    if (chain.reverbSend) chain.reverbSend.gain.setTargetAtTime(m.reverbSend, this.ctx.currentTime, 0.01);
    if (chain.delaySend) chain.delaySend.gain.setTargetAtTime(m.delaySend, this.ctx.currentTime, 0.01);
    if (chain.lowCut) chain.lowCut.frequency.setTargetAtTime(lowCutFreq(m.lowCut), this.ctx.currentTime, 0.01);
    if (chain.highCut) chain.highCut.frequency.setTargetAtTime(highCutFreq(m.highCut), this.ctx.currentTime, 0.01);
    if (chain.panner) chain.panner.pan.setTargetAtTime(relic.pan || 0, this.ctx.currentTime, 0.01);
    chain.sidechain = m.sidechain;
    return chain;
  },

  start(mode) {
    this.stop();
    const ctx = this.ensure();
    this.mode = mode;
    this.startTime = ctx.currentTime + TOOL.START_DELAY;
    this.nextStep = 0;
    this.stats = { scheduled: 0, late: 0, firstTimes: [] };
    this.drumGain = ctx.createGain();
    this.drumGain.connect(this.bus.input);
    this.tick();
    this.timer = setInterval(() => this.tick(), TOOL.SCHEDULE_MS);
    renderPlayButtons();
    requestAnimationFrame(drawPlayhead);
  },

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const chain of this.tracks.values()) this.dropChain(chain);
    this.tracks.clear();
    if (this.drumGain) {
      const g = this.drumGain;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      setTimeout(() => g.disconnect(), 300);
      this.drumGain = null;
    }
    this.setVinyl(false);
    this.mode = null;
    renderPlayButtons();
  },

  toggle(mode) {
    if (this.mode === mode) this.stop();
    else this.start(mode);
  },

  // 바이닐 노이즈: 아주 작은 노이즈와 가끔 튀는 크랙을 반복한다. 재생에만 쓴다.
  setVinyl(on) {
    if (on && !this.vinyl) {
      const ctx = this.ctx;
      const length = Math.floor(ctx.sampleRate * TOOL.VINYL_SECONDS);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
      const crackles = Math.round(TOOL.VINYL_SECONDS * TOOL.VINYL_CRACKLES_PER_SECOND);
      for (let c = 0; c < crackles; c++) {
        const at = Math.floor(Math.random() * (length - 60));
        const amp = 0.5 + Math.random() * 0.5;
        for (let i = 0; i < 40; i++) data[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / 40);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = TOOL.VINYL_GAIN;
      src.connect(g);
      g.connect(this.bus.input);
      src.start();
      this.vinyl = { src, g };
    } else if (!on && this.vinyl) {
      this.vinyl.src.stop();
      this.vinyl.g.disconnect();
      this.vinyl = null;
    }
  },

  tick() {
    const ctx = this.ctx;
    const until = ctx.currentTime + (document.hidden ? TOOL.HIDDEN_LOOKAHEAD : TOOL.LOOKAHEAD);
    const layers = this.layers();
    const live = new Set(layers.map((l) => l.relic.id));
    for (const [id, chain] of this.tracks) {
      if (!live.has(id)) {
        this.dropChain(chain);
        this.tracks.delete(id);
      }
    }
    const chains = layers.map((l) => this.chain(l.relic, l.volume));
    this.drumGain.gain.setTargetAtTime(state.drumVolume, ctx.currentTime, 0.01);
    this.setVinyl(state.vinyl);
    const steps = gridSteps();
    const stepLen = stepSeconds();
    while (true) {
      // 시작 시각 + 칸 시각(스윙 포함). 예약 범위는 스윙 전 시각으로 판단한다.
      const step = this.nextStep % steps;
      if (this.startTime + this.nextStep * stepLen >= until) break;
      const t = this.startTime + stepTime(this.nextStep);
      if (step === 0) {
        this.stats.firstTimes.push(t);
        layers.forEach((l, i) => sweepAt(chains[i], l.relic, t));
      }
      if (t < ctx.currentTime) this.stats.late++;
      layers.forEach((l, i) => {
        scheduleRelicStep(ctx, chains[i].input, l.relic, step, this.startTime, this.nextStep);
        this.stats.scheduled += l.relic.notes.filter((n) => n.step === step).length;
      });
      scheduleDrumStep(ctx, this.drumGain, chains, step, t);
      this.nextStep++;
    }
  },

  // 루프 안 재생 위치 0~1. 재생 중이 아니면 null.
  position() {
    if (!this.mode) return null;
    const elapsed = this.ctx.currentTime - this.startTime;
    if (elapsed < 0) return 0;
    const loop = loopSeconds();
    return (elapsed % loop) / loop;
  },

  // 칸을 찍을 때 그 음을 한 번 들려준다
  preview(relic, row, velocity = 1) {
    const ctx = this.ensure();
    const preset = PRESET_BY_ID[relic.preset];
    scheduleNote(ctx, this.bus.input, preset, rowMidi(preset, row, state.scale, relic), ctx.currentTime + 0.01, TOOL.PREVIEW_GAIN * relic.volume * velocity);
  },
};

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function setStatus(text, error = false) {
  const s = $('status');
  s.textContent = text;
  s.classList.toggle('error', error);
}

function changed() {
  saveSoon();
  render();
}

function render() {
  renderScale();
  renderGlobals();
  renderList();
  renderPresets();
  renderTools();
  renderEditor();
  renderMix();
  renderRight();
  renderPlayButtons();
}

// 상단 전역 설정: 데모 드럼, 드럼 볼륨, 스윙, 바이닐 노이즈. WAV 데모 드럼 포함 체크도 여기서 맞춘다.
function renderGlobals() {
  const drum = $('demo-drum');
  if (!drum.options.length) {
    for (const [id, p] of Object.entries(DEMO_DRUMS)) drum.append(new Option(p.name, id));
  }
  drum.value = state.drum;
  if (document.activeElement !== $('bpm')) $('bpm').value = state.bpm;
  $('grid').value = state.grid;
  $('delay-note').value = state.delayNote;
  $('pump-source').value = state.pumpSource;
  $('drum-kick').checked = state.drumKick;
  $('kick-sound').value = state.kickSound;
  $('drum-snare').checked = state.drumSnare;
  $('drum-volume').value = Math.round(state.drumVolume * 100);
  $('drum-volume-label').textContent = `${Math.round(state.drumVolume * 100)}%`;
  $('swing').value = Math.round(state.swing * 100);
  $('swing-label').textContent = `${Math.round(state.swing * 100)}%`;
  $('vinyl').checked = state.vinyl;
  $('wav-drums').checked = state.wavDrums;
}

// 템포·격자를 바꾸면 칸 시각이 모두 바뀌므로 재생 중이면 처음부터 다시 재생한다 (박이 밀리지 않는다).
function timingChanged() {
  Player.syncDelay();
  if (Player.mode) Player.start(Player.mode);
  changed();
}

function setBpm(value) {
  const bpm = clampBpm(Number(value));
  if (bpm === state.bpm) { $('bpm').value = bpm; return; }
  state.bpm = bpm;
  $('bpm').value = bpm;
  timingChanged();
}

// 격자 바꾸기. 8 -> 16은 바로, 16 -> 8은 홀수 칸 노트가 있으면 확인 창을 거쳐 지운다.
function setGrid(grid) {
  const from = state.grid;
  if (grid === from || !TOOL.GRIDS.includes(grid)) return;
  const apply = () => {
    for (const r of state.relics) convertRelicGrid(r, from, grid);
    state.grid = grid;
    timingChanged();
  };
  const odd = grid === 8 ? oddStepNotes(state.relics) : 0;
  if (odd) {
    confirmModal('8분 격자로 바꾸기', `16분 홀수 칸(e·a 위치)에서 시작하는 노트 ${odd}개가 지워진다. 나머지 노트는 같은 시각에 남는다.`, apply, '바꾸기');
    $('grid').value = from; // 취소하면 그대로. 확인하면 apply가 다시 그린다.
  } else {
    apply();
  }
}

function setupGlobals() {
  $('bpm').addEventListener('change', (e) => setBpm(e.target.value));
  $('grid').addEventListener('change', (e) => setGrid(+e.target.value));
  $('delay-note').addEventListener('change', (e) => {
    if (TOOL.DELAY_NOTES[e.target.value]) state.delayNote = e.target.value;
    Player.syncDelay();
    changed();
  });
  $('pump-source').addEventListener('change', (e) => { state.pumpSource = e.target.value === 'quarter' ? 'quarter' : 'demo'; changed(); });
  $('drum-kick').addEventListener('change', (e) => { state.drumKick = e.target.checked; saveSoon(); });
  $('kick-sound').addEventListener('change', (e) => { state.kickSound = e.target.value === 'kick909' ? 'kick909' : 'kick'; saveSoon(); });
  $('drum-snare').addEventListener('change', (e) => { state.drumSnare = e.target.checked; saveSoon(); });
  $('demo-drum').addEventListener('change', (e) => { state.drum = e.target.value; changed(); });
  $('drum-volume').addEventListener('input', (e) => {
    state.drumVolume = e.target.value / 100;
    $('drum-volume-label').textContent = `${e.target.value}%`;
    saveSoon();
  });
  $('swing').addEventListener('input', (e) => {
    state.swing = clamp(e.target.value / 100, 0, TOOL.SWING_MAX);
    $('swing-label').textContent = `${e.target.value}%`;
    saveSoon();
  });
  $('vinyl').addEventListener('change', (e) => { state.vinyl = e.target.checked; saveSoon(); });
  $('wav-drums').addEventListener('change', (e) => { state.wavDrums = e.target.checked; saveSoon(); });
}

// 오른쪽 믹스 설정: 유물별 사이드체인, 리버브 센드, 딜레이 센드, 로파이, 저음 깎기, 고음 깎기 (0~100%)
const MIX_SETTING_LABELS = {
  sidechain: '사이드체인', reverbSend: '리버브 센드', delaySend: '딜레이 센드', lofi: '로파이',
  lowCut: '저음 깎기', highCut: '고음 깎기',
};
// 슬라이더 옆 값 표시. 저음·고음 깎기는 필터 주파수도 보여 준다.
function mixValueText(key, v) {
  const pct = `${Math.round(v * 100)}%`;
  if (!(v > 0)) return pct;
  if (key === 'lowCut') return `${pct} (${Math.round(lowCutFreq(v))}Hz)`;
  if (key === 'highCut') return `${pct} (${Math.round(highCutFreq(v))}Hz)`;
  return pct;
}

function renderMixSettings(relic) {
  const box = $('mix-settings');
  box.innerHTML = '';
  if (!relic) return;
  const m = relicMix(relic);
  for (const key of MIX_FIELDS) {
    const row = el('label', 'mix-setting');
    const value = el('span', 'value', mixValueText(key, m[key]));
    const range = el('input');
    range.type = 'range';
    range.min = 0;
    range.max = 100;
    range.step = 1;
    range.value = Math.round(m[key] * 100);
    range.dataset.mix = key;
    range.addEventListener('input', () => {
      const v = range.value / 100;
      if (v > 0) relic[key] = v;
      else delete relic[key];
      value.textContent = mixValueText(key, v);
      saveSoon();
    });
    range.addEventListener('change', () => renderRight());
    row.append(el('span', '', MIX_SETTING_LABELS[key]), value, range);
    if (key === 'sidechain' && state.pumpSource === 'demo' && state.drum === 'none') {
      row.append(el('span', 'warn', '데모 드럼 필요 (킥 시각에 맞춰 누른다)'));
    }
    box.append(row);
  }
}

function renderScale() {
  const select = $('scale');
  if (!select.options.length) {
    for (const name of Object.keys(SCALES)) select.append(new Option(name, name));
  }
  select.value = state.scale;
  const root = $('root');
  if (!root.options.length) NOTE_NAMES.forEach((n, i) => root.append(new Option(n, i)));
  root.value = state.root;
  $('pitch-rows').value = state.pitchRows;
}

// 행 수 바꾸기. 15 -> 8은 행 8 이상 노트가 있으면 확인 창을 거쳐 지운다.
function setPitchRows(rows) {
  if (rows === state.pitchRows || !TOOL.PITCH_ROW_CHOICES.includes(rows)) return;
  const apply = () => {
    if (rows < state.pitchRows) for (const r of state.relics) dropHighRows(r, rows);
    state.pitchRows = rows;
    for (const r of state.relics) normalizeNotes(r);
    changed();
  };
  const high = rows < state.pitchRows ? highRowNotes(state.relics, rows) : 0;
  if (high) {
    confirmModal('8행으로 바꾸기', `행 ${rows} 이상에 있는 노트 ${high}개가 지워진다.`, apply, '바꾸기');
    $('pitch-rows').value = state.pitchRows;
  } else {
    apply();
  }
}
// 음높이 악기에서 행 rows 이상인 노트 수 / 지우기
const highRowNotes = (relics, rows) => relics.reduce((sum, r) => sum + (PRESET_BY_ID[r.preset].pitched ? r.notes.filter((n) => n.row >= rows).length : 0), 0);
function dropHighRows(relic, rows) {
  if (PRESET_BY_ID[relic.preset].pitched) relic.notes = relic.notes.filter((n) => n.row < rows);
}

// 오른쪽 '유물 설정': 유물별 스윙(전체 따름), 팬, 옥타브 이동, 필터 스윕
function renderRelicSettings(relic) {
  const box = $('relic-settings');
  box.innerHTML = '';
  if (!relic) return;
  const slider = (label, min, max, value, text, onInput) => {
    const row = el('label', 'mix-setting');
    const v = el('span', 'value', text(value));
    const range = el('input');
    range.type = 'range';
    range.min = min;
    range.max = max;
    range.step = 1;
    range.value = value;
    range.addEventListener('input', () => { onInput(+range.value); v.textContent = text(+range.value); saveSoon(); });
    range.addEventListener('change', () => renderRight());
    row.append(el('span', '', label), v, range);
    return { row, range };
  };
  // 스윙: '전체 따름'이면 relic.swing이 없다
  const follows = typeof relic.swing !== 'number';
  const swing = slider('스윙', 0, TOOL.SWING_MAX * 100, Math.round(relicSwing(relic) * 100),
    (x) => (follows ? `전체 따름 (${x}%)` : `${x}%`), (x) => { relic.swing = x / 100; });
  swing.range.disabled = follows;
  swing.range.dataset.relic = 'swing';
  const follow = el('label', 'small-check');
  const check = el('input');
  check.type = 'checkbox';
  check.checked = follows;
  check.dataset.relic = 'swing-follow';
  check.addEventListener('change', () => {
    if (check.checked) delete relic.swing;
    else relic.swing = state.swing;
    changed();
  });
  follow.append(check, ' 전체 스윙 따름');
  swing.row.append(follow);
  box.append(swing.row);
  // 팬 (-100 ~ +100)
  const pan = slider('팬', -100, 100, Math.round((relic.pan || 0) * 100),
    (x) => (x === 0 ? '가운데' : x < 0 ? `왼쪽 ${-x}` : `오른쪽 ${x}`), (x) => { if (x) relic.pan = x / 100; else delete relic.pan; });
  pan.range.dataset.relic = 'pan';
  box.append(pan.row);
  // 옥타브 이동
  const oct = el('label', 'mix-setting');
  const select = el('select');
  select.dataset.relic = 'octave';
  for (let o = TOOL.OCTAVE_SHIFT_MIN; o <= TOOL.OCTAVE_SHIFT_MAX; o++) select.append(new Option(o > 0 ? `+${o}` : String(o), o));
  select.value = octaveShift(relic);
  select.disabled = !PRESET_BY_ID[relic.preset].pitched;
  select.addEventListener('change', () => {
    const v = +select.value;
    if (v) relic.octaveShift = v;
    else delete relic.octaveShift;
    changed();
  });
  oct.append(el('span', '', '옥타브'), select);
  box.append(oct);
  // 필터 스윕: 켜면 루프 머리에서 끝까지 로우패스가 시작 -> 끝 값으로 움직인다 (0% = 20kHz, 100% = 800Hz)
  const fs = relic.filterSweep;
  const sweepRow = el('label', 'small-check');
  const sweepOn = el('input');
  sweepOn.type = 'checkbox';
  sweepOn.checked = !!fs;
  sweepOn.dataset.relic = 'sweep-on';
  sweepOn.addEventListener('change', () => {
    if (sweepOn.checked) relic.filterSweep = { from: TOOL.SWEEP_DEFAULT_FROM, to: TOOL.SWEEP_DEFAULT_TO };
    else delete relic.filterSweep;
    changed();
  });
  sweepRow.append(sweepOn, ' 필터 스윕 (루프마다 로우패스가 움직임)');
  box.append(sweepRow);
  if (fs) {
    const hz = (x) => `${x}% (${Math.round(highCutFreq(x / 100))}Hz)`;
    const from = slider('스윕 시작', 0, 100, Math.round(fs.from * 100), hz, (x) => { fs.from = x / 100; });
    const to = slider('스윕 끝', 0, 100, Math.round(fs.to * 100), hz, (x) => { fs.to = x / 100; });
    from.range.dataset.relic = 'sweep-from';
    to.range.dataset.relic = 'sweep-to';
    box.append(from.row, to.row);
  }
}

// 유물 이름 검사. 문제가 없으면 null, 있으면 이유.
function nameProblem(name, exceptId = null) {
  if (!name) return '이름을 입력하세요.';
  if (name.length > TOOL.NAME_MAX) return `이름은 ${TOOL.NAME_MAX}자까지입니다.`;
  if (state.relics.some((r) => r.name === name && r.id !== exceptId)) return '같은 이름의 유물이 이미 있습니다.';
  return null;
}

let renamingId = null;

function renderList() {
  const list = $('relic-list');
  list.innerHTML = '';
  if (!state.relics.length) {
    list.append(el('li', 'hint', '+ 를 눌러 유물을 추가하세요.'));
  }
  for (const relic of state.relics) {
    const li = el('li', 'relic-item' + (relic.id === state.selectedId ? ' active' : ''));
    li.dataset.id = relic.id;
    if (renamingId === relic.id) {
      li.append(renameForm(relic));
      list.append(li);
      continue;
    }
    const check = el('input');
    check.type = 'checkbox';
    check.checked = !!relic.checked;
    check.title = '내보내기에 포함';
    check.addEventListener('click', (e) => e.stopPropagation());
    check.addEventListener('change', () => { relic.checked = check.checked; changed(); });
    const rename = el('button', 'act', '✎');
    rename.title = '이름 변경';
    rename.addEventListener('click', (e) => { e.stopPropagation(); renamingId = relic.id; renderList(); });
    const del = el('button', 'act del', '×');
    del.title = '삭제';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteRelic(relic); });
    const preset = PRESET_BY_ID[relic.preset];
    li.append(check, el('span', 'name', relic.name), rename, del,
      el('span', 'meta', `${preset.name} · 노트 ${relic.notes.length}`), miniPattern(relic));
    li.addEventListener('click', () => selectRelic(relic.id));
    list.append(li);
  }
  const all = $('check-all');
  all.checked = state.relics.length > 0 && state.relics.every((r) => r.checked);
  all.indeterminate = !all.checked && state.relics.some((r) => r.checked);
  $('delete-checked').disabled = !state.relics.some((r) => r.checked);
  $('mix-random').disabled = !state.relics.length;
}

function miniPattern(relic) {
  const mini = el('div', 'mini');
  const used = new Set(relic.notes.map((n) => n.step));
  const steps = gridSteps();
  mini.style.gridTemplateColumns = `repeat(${steps}, 1fr)`;
  for (let s = 0; s < steps; s++) mini.append(el('span', used.has(s) ? 'on' : ''));
  return mini;
}

function renameForm(relic) {
  const form = el('form', 'name-form');
  const input = el('input');
  input.type = 'text';
  input.maxLength = TOOL.NAME_MAX;
  input.value = relic.name;
  const ok = el('button', 'primary', '확인');
  ok.type = 'submit';
  const cancel = el('button', '', '취소');
  cancel.type = 'button';
  const error = el('p', 'form-error');
  form.append(input, ok, cancel, error);
  form.addEventListener('click', (e) => e.stopPropagation());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    const problem = nameProblem(name, relic.id);
    if (problem) { error.textContent = problem; return; }
    relic.name = name;
    renamingId = null;
    changed();
  });
  cancel.addEventListener('click', () => { renamingId = null; renderList(); });
  setTimeout(() => { input.focus(); input.select(); }, 0);
  return form;
}

function renderPresets() {
  const list = $('preset-list');
  const relic = selectedRelic();
  if (!list.children.length) {
    // 카테고리 머리글로 묶는다. 묶음 안에서는 PRESETS 순서다.
    for (const category of PRESET_CATEGORIES) {
      const presets = PRESETS.filter((p) => (p.category || null) === category.id);
      if (!presets.length) continue;
      list.append(el('li', 'preset-group', category.name));
      for (const preset of presets) {
        const li = el('li');
        const b = el('button');
        b.dataset.preset = preset.id;
        b.append(preset.name, el('span', 'kind', preset.pitched ? '' : '타악'));
        b.title = preset.pitched ? `음높이 악기 (행 0 = ${midiName(rowMidi(preset, 0, state.scale))})` : '타악·노이즈 (1행)';
        b.addEventListener('click', () => applyPreset(preset.id));
        li.append(b);
        list.append(li);
      }
    }
  }
  for (const b of list.querySelectorAll('button')) {
    b.classList.toggle('on', !!relic && relic.preset === b.dataset.preset);
    b.disabled = !relic;
  }
}

function applyPreset(presetId) {
  const relic = selectedRelic();
  if (!relic) return;
  relic.preset = presetId;
  fitNotesToPreset(relic);
  changed();
}

// 16박 편집기: 위쪽이 높은 음이다. 박 경계는 굵게, 그 사이 칸 경계는 얇게, 마디(4박)마다 더 굵게 긋는다.
let editorKey = '';

function renderEditor() {
  const relic = selectedRelic();
  const editor = $('editor');
  $('editor-empty').hidden = !!relic;
  $('editor-wrap').hidden = !relic;
  if (!relic) {
    $('editor-title').textContent = '';
    $('editor-meta').textContent = '';
    editorKey = '';
    return;
  }
  const preset = PRESET_BY_ID[relic.preset];
  const rows = rowCount(preset);
  $('editor-title').textContent = relic.name;
  $('editor-meta').textContent = `${preset.name} · ${preset.pitched ? `${keyScaleName()}${octaveShift(relic) ? ` · 옥타브 ${octaveShift(relic) > 0 ? '+' : ''}${octaveShift(relic)}` : ''}` : '타악 1행'}`;
  // 구조(유물, 행 수, 스케일)가 같으면 칸의 on 표시만 바꾼다. 드래그 중 칸이 새로 만들어지지 않게 하기 위해서다.
  // 격자(8분 32칸 / 16분 64칸)도 구조에 들어간다. 마디(4박) 경계가 가장 굵고, 박 경계가 굵고,
  // 16분 격자에서는 8분 경계(eighth)를 중간 굵기로 긋는다.
  const key = `${relic.id}|${relic.preset}|${state.scale}|${state.grid}|${state.root}|${state.pitchRows}|${octaveShift(relic)}`;
  if (key !== editorKey) {
    editorKey = key;
    const steps = gridSteps();
    const per = stepsPerBeat();
    editor.innerHTML = '';
    editor.classList.toggle('perc', !preset.pitched);
    editor.classList.toggle('grid16', state.grid === 16);
    editor.classList.toggle('rows15', preset.pitched && state.pitchRows === 15);
    editor.style.gridTemplateColumns = `44px repeat(${steps}, minmax(${state.grid === 16 ? TOOL.CELL_MIN_PX_16 : TOOL.CELL_MIN_PX_8}px, 1fr))`;
    editor.append(el('div', 'corner'));
    for (let s = 0; s < steps; s++) {
      editor.append(el('div', 'beat-num' + (s % per ? ' half' : ''), s % per ? '' : String(s / per + 1)));
    }
    for (let r = rows - 1; r >= 0; r--) {
      const last = r === 0 ? ' last' : '';
      const midi = rowMidi(preset, r, state.scale, relic);
      editor.append(el('div', 'row-label' + last, midi === null ? '타격' : midiName(midi)));
      for (let s = 0; s < steps; s++) {
        let cls = 'cell' + last;
        if (s % (per * 4) === 0) cls += ' bar';
        else if (s % per === 0) cls += ' beat';
        else if (per === 4 && s % 2 === 0) cls += ' eighth';
        if (Math.floor(s / per) % 2) cls += ' alt';
        const cell = el('div', cls);
        cell.dataset.step = s;
        cell.dataset.row = r;
        editor.append(cell);
      }
    }
  }
  paintNotes(relic);
}

// 칸 표시: on(노트 시작), tail(길이로 이어지는 칸), end(음높이 노트의 마지막 칸, 길이 손잡이), v-m/v-w(세기)
function paintNotes(relic) {
  const preset = PRESET_BY_ID[relic.preset];
  const velClass = (v) => (v >= TOOL.VELOCITY_STRONG_MIN ? '' : v >= TOOL.VELOCITY_MEDIUM_MIN ? 'v-m' : 'v-w');
  for (const cell of $('editor').querySelectorAll('.cell')) {
    const step = +cell.dataset.step;
    const n = coveringNote(relic, step, +cell.dataset.row);
    const len = n ? noteLength(n, preset) : 0;
    cell.classList.toggle('on', !!n && n.step === step);
    cell.classList.toggle('tail', !!n && n.step !== step);
    cell.classList.toggle('long', !!n && n.step === step && len > 1);
    // 롤 노트는 길이를 쓰지 않으므로 길이 손잡이(end)가 없고, 칸 안에 롤 수 - 1개의 세로 선(r2~r4)을 그린다
    cell.classList.toggle('end', !!n && preset.pitched && noteRepeat(n) === 1 && step === n.step + len - 1);
    cell.classList.remove('v-m', 'v-w', 'r2', 'r3', 'r4');
    if (n && velClass(noteVelocity(n))) cell.classList.add(velClass(noteVelocity(n)));
    if (n && n.step === step && noteRepeat(n) > 1) cell.classList.add(`r${noteRepeat(n)}`);
  }
}

// 다음 세기 (강 -> 중 -> 약 -> 강)
function nextVelocity(v) {
  const levels = TOOL.VELOCITY_LEVELS.map((l) => l.value);
  let i = 0;
  levels.forEach((lv, j) => { if (Math.abs(lv - v) < Math.abs(levels[i] - v)) i = j; });
  return levels[(i + 1) % levels.length];
}

function setVelocity(note, v) {
  if (v === 1) delete note.velocity;
  else note.velocity = v;
}

// (step, row)에 새 노트를 찍는다. 길이는 '새 노트 길이'이고 같은 행의 다음 노트 직전과 루프 끝에서 자른다.
// '롤'이 2 이상이면 롤 노트(1칸)를 찍는다. 길이를 가진 앞 노트가 이 칸을 덮고 있으면 앞 노트를 이 칸 직전까지 줄인다.
// '코드'가 없음이 아니고 음높이 악기면 그 행을 근음으로 스케일 위에 쌓은 행들(CHORD_SHAPES)을 한 번에 찍는다.
// 행 범위를 넘는 음은 뺀다. 데이터는 노트 여러 개라 설계서 형식은 그대로다.
function addNote(relic, step, row) {
  const preset = PRESET_BY_ID[relic.preset];
  const shape = preset.pitched ? CHORD_SHAPES[state.chordMode] || CHORD_SHAPES.none : CHORD_SHAPES.none;
  // 이미 그 칸에서 시작하는 노트가 있는 행은 건드리지 않는다
  const rows = shape.rows.map((d) => row + d)
    .filter((r) => r < rowCount(preset) && (r === row || !relic.notes.some((n) => n.step === step && n.row === r)));
  for (const r of rows) addOneNote(relic, step, r);
}

function addOneNote(relic, step, row) {
  const preset = PRESET_BY_ID[relic.preset];
  const before = coveringNote(relic, step, row);
  if (before) before.length = step - before.step;
  const next = relic.notes.filter((o) => o.row === row && o.step > step).reduce((m, o) => Math.min(m, o.step), gridSteps());
  const note = { step, row };
  setVelocity(note, state.inputVelocity);
  if (state.newRepeat > 1) {
    note.repeat = state.newRepeat;
  } else if (preset.pitched) {
    const length = Math.min(state.newLength, next - step);
    if (length > 1) note.length = length;
  }
  relic.notes.push(note);
  normalizeNotes(relic);
  Player.preview(relic, row, state.inputVelocity);
}

// 드래그 입력: 빈 칸(또는 긴 노트가 이어지는 칸)을 누르면 찍기, 노트 시작 칸을 누르면 지우기를 드래그 내내 유지한다.
// 음높이 노트의 마지막 칸 오른쪽 끝을 누르면 길이 바꾸기다.
let paint = null;   // 'add' | 'erase' | null
let resizing = null; // 길이를 바꾸는 노트

function noteEdited(relic) {
  saveSoon();
  paintNotes(relic);
  renderList();
  renderRight();
}

function paintCell(cell) {
  const relic = selectedRelic();
  if (!relic || !cell || !cell.classList.contains('cell')) return;
  const step = +cell.dataset.step;
  const row = +cell.dataset.row;
  const n = coveringNote(relic, step, row);
  if (paint === 'add' && !n) {
    addNote(relic, step, row);
  } else if (paint === 'erase' && n) {
    relic.notes = relic.notes.filter((o) => o !== n);
  } else {
    return;
  }
  noteEdited(relic);
}

// 셀의 오른쪽 끝 RESIZE_HANDLE_PX 안이고 그 칸이 음높이 노트의 마지막 칸이면 그 노트
function resizeTarget(relic, cell, clientX) {
  if (!cell || !cell.classList.contains('end')) return null;
  const rect = cell.getBoundingClientRect();
  if (clientX < rect.right - TOOL.RESIZE_HANDLE_PX) return null;
  return coveringNote(relic, +cell.dataset.step, +cell.dataset.row);
}

function resizeTo(relic, cell) {
  if (!cell || !cell.classList.contains('cell') || +cell.dataset.row !== resizing.row) return;
  const next = relic.notes.filter((o) => o.row === resizing.row && o.step > resizing.step)
    .reduce((m, o) => Math.min(m, o.step), gridSteps());
  const length = clamp(+cell.dataset.step - resizing.step + 1, 1, next - resizing.step);
  if (length > 1) resizing.length = length;
  else delete resizing.length;
  noteEdited(relic);
}

function setupEditorInput() {
  const editor = $('editor');
  editor.addEventListener('contextmenu', (e) => { if (e.target.closest('.cell')) e.preventDefault(); });
  editor.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('.cell');
    const relic = selectedRelic();
    if (!cell || !relic) return;
    e.preventDefault();
    const step = +cell.dataset.step;
    const row = +cell.dataset.row;
    const n = coveringNote(relic, step, row);
    // Shift+클릭 또는 우클릭: 세기를 강 -> 중 -> 약 순서로 바꾼다
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
      if (n) {
        setVelocity(n, nextVelocity(noteVelocity(n)));
        Player.preview(relic, row, noteVelocity(n));
        noteEdited(relic);
      }
      return;
    }
    if (e.button !== 0) return;
    const target = resizeTarget(relic, cell, e.clientX);
    if (target) {
      resizing = target;
      return;
    }
    if (n && n.step === step) paint = 'erase';
    else if (n) {
      // 긴 노트가 이어지는 칸에 새 노트를 찍으면 앞 노트가 이 칸 직전까지 줄어든다
      addNote(relic, step, row);
      noteEdited(relic);
      paint = 'add';
      return;
    } else paint = 'add';
    paintCell(cell);
  });
  editor.addEventListener('mouseover', (e) => {
    const relic = selectedRelic();
    if (resizing && relic) resizeTo(relic, e.target.closest('.cell'));
    else if (paint) paintCell(e.target.closest('.cell'));
  });
  editor.addEventListener('mousemove', (e) => {
    const relic = selectedRelic();
    editor.classList.toggle('resize-cursor', !!resizing || (!!relic && !paint && !!resizeTarget(relic, e.target.closest('.cell'), e.clientX)));
  });
  window.addEventListener('mouseup', () => { paint = null; resizing = null; });
}

// 편집기 위 도구: 입력 세기, 새 노트 길이 (타악은 길이를 쓰지 않는다)
function renderTools() {
  const buttons = $('velocity-buttons');
  if (!buttons.children.length) {
    for (const level of TOOL.VELOCITY_LEVELS) {
      const b = el('button', '', level.name);
      b.dataset.value = level.value;
      b.title = `새 노트 세기 ${Math.round(level.value * 100)}%`;
      b.addEventListener('click', () => { state.inputVelocity = level.value; changed(); });
      buttons.append(b);
    }
    const select = $('new-length');
    select.addEventListener('change', () => { state.newLength = +select.value; changed(); });
    const repeat = $('new-repeat');
    for (const n of TOOL.NOTE_REPEATS) repeat.append(new Option(n === 1 ? '없음' : `${n}번`, n));
    repeat.addEventListener('change', () => { state.newRepeat = +repeat.value; changed(); });
    const chord = $('chord-mode');
    for (const [id, c] of Object.entries(CHORD_SHAPES)) chord.append(new Option(c.name, id));
    chord.addEventListener('change', () => { state.chordMode = CHORD_SHAPES[chord.value] ? chord.value : 'none'; changed(); });
  }
  for (const b of buttons.children) b.classList.toggle('on', +b.dataset.value === state.inputVelocity);
  // 길이 선택지는 격자에 따라 다르다 (8분 [1, 2, 4, 8], 16분 [1, 2, 4, 8, 16]칸)
  const lengthSelect = $('new-length');
  const choices = noteLengthChoices();
  if (lengthSelect.dataset.grid !== String(state.grid)) {
    lengthSelect.dataset.grid = state.grid;
    lengthSelect.innerHTML = '';
    for (const n of choices) lengthSelect.append(new Option(`${n}칸`, n));
  }
  if (!choices.includes(state.newLength)) state.newLength = 1;
  lengthSelect.value = state.newLength;
  $('step-hint').textContent = `1칸 = ${state.grid}분음표 (${state.bpm}BPM, 약 ${stepSeconds().toFixed(3)}초)`;
  $('new-repeat').value = state.newRepeat;
  $('chord-mode').value = state.chordMode;
  const relic = selectedRelic();
  const perc = relic && !PRESET_BY_ID[relic.preset].pitched;
  // 롤 노트는 1칸이므로 롤을 고르면 길이 선택이 쓰이지 않는다
  $('new-length').disabled = !!perc || state.newRepeat > 1;
  $('chord-mode').disabled = !!perc;
  $('length-note').textContent = perc ? '타악은 길이를 쓰지 않는다' : state.newRepeat > 1 ? '롤 노트는 1칸이다' : '';
}

// 재생 위치 표시선. 단일 재생은 선택한 유물일 때, 믹스 재생은 선택한 유물이 믹스에 있을 때 보인다.
function drawPlayhead() {
  const head = $('playhead');
  const pos = Player.position();
  const relic = selectedRelic();
  const showing = pos !== null && relic
    && (Player.mode === 'single' || state.mix.some((s) => s && s.relicId === relic.id));
  head.hidden = !showing;
  if (showing) {
    const cells = $('editor').querySelectorAll('.cell');
    const wrap = $('editor-wrap').getBoundingClientRect();
    const first = cells[0].getBoundingClientRect();
    const last = cells[gridSteps() - 1].getBoundingClientRect();
    // 편집기가 가로 스크롤되면 표시선은 내용과 함께 움직이므로 스크롤 양을 더한다
    head.style.left = `${first.left - wrap.left + $('editor-wrap').scrollLeft + (last.right - first.left) * pos - 1}px`;
  }
  if (Player.mode) requestAnimationFrame(drawPlayhead);
  else head.hidden = true;
}

// 상단 믹스 바: 칸 5개. 빈 칸의 + 로 유물을 고르고, 찬 칸에는 이름, 제거, 볼륨이 있다.
function renderMix() {
  const bar = $('mix-bar');
  bar.innerHTML = '';
  state.mix.forEach((slot, i) => {
    const relic = slot && relicById(slot.relicId);
    const box = el('div', 'mix-slot' + (relic ? ' filled' : ''));
    box.append(el('span', 'num', String(i + 1)));
    if (!relic) {
      const add = el('button', 'add small', '+ 유물 넣기');
      add.addEventListener('click', (e) => { e.stopPropagation(); openMixPopup(i, add); });
      box.append(add);
    } else {
      const remove = el('button', 'remove', '×');
      remove.title = '믹스에서 빼기';
      remove.addEventListener('click', () => { state.mix[i] = null; changed(); });
      const vol = el('label', 'vol');
      const range = el('input');
      range.type = 'range';
      range.min = 0;
      range.max = TOOL.VOLUME_MAX * 100;
      range.step = 5;
      range.value = Math.round(slot.volume * 100);
      const label = el('span', '', `${range.value}%`);
      range.addEventListener('input', () => {
        slot.volume = range.value / 100;
        label.textContent = `${range.value}%`;
        saveSoon();
      });
      vol.append('볼륨', range, label);
      box.append(el('span', 'name', relic.name), remove, vol);
      box.title = relic.name;
    }
    bar.append(box);
  });
}

function openMixPopup(index, anchor) {
  const popup = $('mix-popup');
  popup.innerHTML = '';
  const used = new Set(state.mix.filter(Boolean).map((s) => s.relicId));
  if (!state.relics.length) popup.append(el('div', 'empty', '먼저 왼쪽에서 유물을 추가하세요.'));
  for (const relic of state.relics) {
    const b = el('button', '', relic.name + (used.has(relic.id) ? ' (믹스에 있음)' : ''));
    b.disabled = used.has(relic.id);
    b.addEventListener('click', () => {
      state.mix[index] = { relicId: relic.id, volume: TOOL.DEFAULT_VOLUME };
      popup.hidden = true;
      changed();
    });
    popup.append(b);
  }
  const rect = anchor.getBoundingClientRect();
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom + 4}px`;
  popup.hidden = false;
}

function renderRight() {
  const relic = selectedRelic();
  $('right-name').textContent = relic ? relic.name : '선택한 유물 없음';
  $('single-play').disabled = !relic;
  $('clear-notes').disabled = !relic || !relic.notes.length;
  const volume = $('volume');
  volume.disabled = !relic;
  volume.max = TOOL.VOLUME_MAX * 100;
  volume.value = relic ? Math.round(relic.volume * 100) : 100;
  $('volume-label').textContent = `${volume.value}%`;
  renderMixSettings(relic);
  renderRelicSettings(relic);
  const info = $('info');
  info.innerHTML = '';
  if (!relic) return;
  const s = relicSummary(relic);
  for (const [k, v] of [['악기', s.preset], ['음높이 범위', s.range], ['노트 수', String(s.noteCount)], ['특징', s.feature]]) {
    info.append(el('dt', '', k), el('dd', '', v));
  }
}

function renderPlayButtons() {
  const single = $('single-play');
  const mix = $('mix-play');
  single.classList.toggle('playing', Player.mode === 'single');
  single.textContent = Player.mode === 'single' ? '■ 정지' : '▶ 이 유물 재생';
  mix.classList.toggle('playing', Player.mode === 'mix');
  mix.textContent = Player.mode === 'mix' ? '■ 믹스 정지' : '▶ 믹스 재생';
  mix.disabled = !state.mix.some((s) => s && relicById(s.relicId));
}

// ---------------------------------------------------------------------------
// 유물 추가·선택·삭제
// ---------------------------------------------------------------------------
function newRelic(name) {
  return { id: `relic_${state.nextId++}`, name, preset: TOOL.DEFAULT_PRESET, notes: [], volume: TOOL.DEFAULT_VOLUME, checked: true };
}

function selectRelic(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  changed();
}

function deleteRelic(relic) {
  const inMix = state.mix.some((s) => s && s.relicId === relic.id);
  confirmModal(`'${relic.name}' 삭제`, `노트 ${relic.notes.length}개가 사라진다.${inMix ? ' 믹스 바에서도 빠진다.' : ''} 되돌릴 수 없다.`, () => {
    state.relics = state.relics.filter((r) => r !== relic);
    state.mix = state.mix.map((s) => (s && s.relicId === relic.id ? null : s));
    if (state.selectedId === relic.id) state.selectedId = state.relics[0] ? state.relics[0].id : null;
    changed();
  });
}

// 체크한 유물을 한 번에 지운다. 믹스 바에서도 빠진다.
function deleteChecked() {
  const targets = checkedRelics();
  if (!targets.length) return;
  const body = el('div');
  body.append(el('div', '', `체크한 유물 ${targets.length}개를 삭제한다. 되돌릴 수 없다.`));
  const ul = el('ul');
  for (const r of targets) ul.append(el('li', '', `${r.name} (노트 ${r.notes.length})`));
  body.append(ul);
  confirmModal('체크한 유물 삭제', body, () => {
    const gone = new Set(targets.map((r) => r.id));
    state.relics = state.relics.filter((r) => !gone.has(r.id));
    state.mix = state.mix.map((s) => (s && gone.has(s.relicId) ? null : s));
    if (gone.has(state.selectedId)) state.selectedId = state.relics[0] ? state.relics[0].id : null;
    changed();
    setStatus(`유물 ${targets.length}개 삭제`);
  }, '삭제');
}

// 전체 유물 중 서로 다른 유물을 무작위로 골라 믹스 바를 새로 채운다. 유물이 5개보다 적으면 있는 만큼 앞 칸부터 채운다.
// 칸 볼륨은 기본값(100%)으로 돌린다. 믹스 재생 중이면 다음 칸부터 새 조합으로 들린다.
function randomMix() {
  const ids = state.relics.map((r) => r.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.mix = Array.from({ length: TOOL.MIX_SLOTS }, (_, i) => (ids[i] ? { relicId: ids[i], volume: TOOL.DEFAULT_VOLUME } : null));
  changed();
}

function setupLeft() {
  const form = $('add-form');
  const input = $('add-name');
  $('add-relic').addEventListener('click', () => {
    form.hidden = false;
    $('add-error').textContent = '';
    input.value = '';
    input.focus();
  });
  $('add-cancel').addEventListener('click', () => { form.hidden = true; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    const problem = nameProblem(name);
    if (problem) { $('add-error').textContent = problem; return; }
    const relic = newRelic(name);
    state.relics.push(relic);
    state.selectedId = relic.id;
    form.hidden = true;
    changed();
  });
  $('delete-checked').addEventListener('click', deleteChecked);
  $('mix-random').addEventListener('click', randomMix);
  $('check-all').addEventListener('change', (e) => {
    for (const r of state.relics) r.checked = e.target.checked;
    changed();
  });
}

// ---------------------------------------------------------------------------
// 확인 창
// ---------------------------------------------------------------------------
function confirmModal(title, body, onOk, okLabel = '확인') {
  $('modal-title').textContent = title;
  const b = $('modal-body');
  b.innerHTML = '';
  if (typeof body === 'string') b.textContent = body;
  else b.append(body);
  $('modal-ok').textContent = okLabel;
  $('modal-cancel').hidden = !onOk;
  $('modal').hidden = false;
  const close = () => { $('modal').hidden = true; $('modal-ok').onclick = null; $('modal-cancel').onclick = null; };
  $('modal-ok').onclick = () => { close(); if (onOk) onOk(); };
  $('modal-cancel').onclick = close;
}

function alertModal(title, body) {
  confirmModal(title, body, null);
}

// ---------------------------------------------------------------------------
// 설계서
// ---------------------------------------------------------------------------
function relicSummary(relic) {
  const preset = PRESET_BY_ID[relic.preset];
  const midis = relic.notes.map((n) => rowMidi(preset, n.row, state.scale, relic)).filter((m) => m !== null);
  const steps = new Set(relic.notes.map((n) => n.step));
  let range = '타격음 (음높이 없음)';
  if (preset.pitched) {
    range = midis.length ? `${midiName(Math.min(...midis))} ~ ${midiName(Math.max(...midis))}` : '-';
  }
  return { preset: preset.name, range, noteCount: relic.notes.length, feature: featureText(relic, steps, midis, preset) };
}

// 한 줄 특징: 박 밀도, 정박/엇박, 음역
function featureText(relic, steps, midis, preset) {
  if (!relic.notes.length) return '빈 비트';
  const density = steps.size / gridSteps();
  const parts = [`${steps.size}/${gridSteps()}칸 ${density >= 0.5 ? '빽빽함' : density >= 0.25 ? '보통' : '성김'}`];
  const onbeat = relic.notes.filter((n) => n.step % stepsPerBeat() === 0).length / relic.notes.length;
  parts.push(onbeat >= 0.7 ? '정박 위주' : onbeat <= 0.3 ? '엇박 위주' : '정박·엇박 섞임');
  if (preset.pitched) {
    const distinct = new Set(midis).size;
    parts.push(`음 ${distinct}종, 폭 ${Math.max(...midis) - Math.min(...midis)}반음`);
  } else {
    parts.push('타악');
  }
  if (relic.notes.length > steps.size) parts.push('화음 있음');
  if (relic.notes.some((n) => n.velocity !== undefined && n.velocity < 1)) parts.push('강약 있음');
  if (preset.pitched && relic.notes.some((n) => n.length > 1)) parts.push('긴 노트 있음');
  if (relic.notes.some((n) => n.repeat > 1)) parts.push('롤 있음');
  if (MIX_FIELDS.some((k) => relic[k] > 0)) parts.push('믹스 설정 있음');
  if (RELIC_EXTRA_FIELDS.some((k) => relic[k] !== undefined)) parts.push('유물 설정 있음');
  return parts.join(', ');
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// 설계서의 기계용 데이터. 사람이 읽는 표는 모두 이 데이터에서 만든다.
// 새 항목(velocity, length, sidechain, reverbSend, delaySend, lofi, lowCut, highCut, swing, octaveShift, pan, filterSweep,
// groove, bpm, grid, root, pitchRows, delayNote)은
// 기본값이면 넣지 않는다. timing은 참고값(불러올 때 쓰지 않음)이고 최상위 bpm·grid가 원본이다.
function designData(relics) {
  const data = {
    schema: TOOL.SCHEMA,
    exportedAt: new Date().toISOString(),
    timing: {
      bpm: state.bpm, grid: state.grid, beatSeconds: 60 / state.bpm, stepSeconds: stepSeconds(),
      beats: TOOL.BEATS, steps: gridSteps(), loopSeconds: loopSeconds(),
    },
    scale: { name: state.scale, root: NOTE_NAMES[state.root], intervals: SCALES[state.scale] },
  };
  if (state.bpm !== TOOL.DEFAULT_BPM) data.bpm = state.bpm;
  if (state.grid !== TOOL.DEFAULT_GRID) data.grid = state.grid;
  if (state.root) data.root = state.root;
  if (state.pitchRows !== TOOL.PITCH_ROWS) data.pitchRows = state.pitchRows;
  if (state.delayNote !== TOOL.DEFAULT_DELAY_NOTE) data.delayNote = state.delayNote;
  if (state.swing > 0) data.groove = { swing: state.swing };
  data.relics = relics.map((relic) => {
    const preset = PRESET_BY_ID[relic.preset];
    const slotIndex = state.mix.findIndex((s) => s && s.relicId === relic.id);
    const out = {
      id: relic.id,
      name: relic.name,
      preset: { id: preset.id, name: preset.name, pitched: preset.pitched, octave: preset.pitched ? preset.octave : null, params: preset.params },
      volume: relic.volume,
      mixSlot: slotIndex >= 0 ? slotIndex + 1 : null,
      mixVolume: slotIndex >= 0 ? state.mix[slotIndex].volume : null,
    };
    const m = relicMix(relic);
    for (const k of MIX_FIELDS) if (m[k] > 0) out[k] = m[k];
    // 단계 2·3 유물 항목 (기본값이면 넣지 않는다)
    const extras = normalizeRelicExtras({ swing: relic.swing, octaveShift: relic.octaveShift, pan: relic.pan, filterSweep: relic.filterSweep });
    for (const k of RELIC_EXTRA_FIELDS) if (extras[k] !== undefined) out[k] = extras[k];
    out.notes = relic.notes.map((n) => {
      const midi = rowMidi(preset, n.row, state.scale, relic);
      const note = { step: n.step, row: n.row, midi, pitch: midi === null ? null : midiName(midi) };
      if (noteVelocity(n) !== 1) note.velocity = noteVelocity(n);
      const length = noteLength(n, preset);
      if (length > 1) note.length = length;
      if (noteRepeat(n) > 1) note.repeat = noteRepeat(n);
      return note;
    });
    return out;
  });
  return data;
}

// 딜레이 음표 이름 (설계서·화면 표기)
const DELAY_NOTE_NAMES = { '1/8': '8분', '3/16': '점8분', '1/4': '4분', '3/8': '점4분' };

// 세기 표기: 강(표기 없음), 중 @m, 약 @w
function velocitySuffix(v) {
  if (v === undefined || v >= TOOL.VELOCITY_STRONG_MIN) return '';
  return v >= TOOL.VELOCITY_MEDIUM_MIN ? '@m' : '@w';
}

// step칸의 음 표기. 쉼은 '-', 타악은 'X', 화음은 '+'로 잇는다. 세기는 @m/@w, 2칸 이상 노트는 시작 칸에 *길이,
// 롤 노트는 /횟수, 그 노트가 이어지는 칸(시작하는 노트가 없을 때)은 '='다. 순서: 음, 길이, 롤, 세기 (예: C3/2@m).
function stepText(relicData, step) {
  const pitched = relicData.preset.pitched;
  const heads = relicData.notes.filter((n) => n.step === step);
  if (heads.length) {
    return heads.map((n) => (pitched ? n.pitch : 'X') + (pitched && n.length > 1 ? `*${n.length}` : '')
      + (n.repeat > 1 ? `/${n.repeat}` : '') + velocitySuffix(n.velocity)).join('+');
  }
  if (pitched && relicData.notes.some((n) => n.length > 1 && n.step < step && step < n.step + n.length)) return '=';
  return '-';
}

// 유물 상세의 믹스 설정 한 줄. 모두 기본값(0)이면 null.
function mixSettingsText(r) {
  if (!MIX_FIELDS.some((k) => r[k] > 0)) return null;
  return MIX_FIELDS.map((k) => `${MIX_SETTING_LABELS[k]} ${mixValueText(k, r[k] || 0)}`).join(', ');
}

// 유물 상세의 유물 설정 한 줄(스윙, 옥타브, 팬, 필터 스윕). 모두 기본이면 null.
function relicSettingsText(r) {
  const parts = [];
  if (typeof r.swing === 'number') parts.push(`스윙 ${Math.round(r.swing * 100)}% (전체와 따로)`);
  if (r.octaveShift) parts.push(`옥타브 ${r.octaveShift > 0 ? '+' : ''}${r.octaveShift}`);
  if (r.pan) parts.push(`팬 ${r.pan < 0 ? `왼쪽 ${Math.round(-r.pan * 100)}` : `오른쪽 ${Math.round(r.pan * 100)}`}`);
  if (r.filterSweep) {
    const hz = (v) => `${Math.round(v * 100)}% (${Math.round(highCutFreq(v))}Hz)`;
    parts.push(`필터 스윕 ${hz(r.filterSweep.from)} -> ${hz(r.filterSweep.to)}`);
  }
  return parts.length ? parts.join(', ') : null;
}

function paramsText(params) {
  const lines = [];
  for (const o of params.oscs || []) {
    const pitch = o.fixed ? `고정 ${o.fixed}Hz` : `음높이 x${o.ratio ?? 1}`;
    lines.push(`오실레이터 ${o.type}, ${pitch}${o.detune ? `, 디튠 ${o.detune}센트` : ''}, 게인 ${o.gain ?? 1}`);
  }
  if (params.noise) {
    const f = params.noise.filter;
    lines.push(`노이즈 게인 ${params.noise.gain}${f ? ` (자체 필터 ${f.type} ${f.freq}Hz Q${f.Q})` : ''}`);
  }
  if (params.filter) {
    const f = params.filter;
    lines.push(`필터 ${f.type} ${f.freq}Hz Q${f.Q}${f.from ? `, 시작 ${f.from}Hz에서 ${f.sweep}초 동안 이동` : ''}`);
  }
  if (params.pitchSlide) lines.push(`음높이 슬라이드: ${params.pitchSlide.semis > 0 ? '+' : ''}${params.pitchSlide.semis}반음에서 ${params.pitchSlide.time}초 동안 제 음으로`);
  if (params.bursts) lines.push(`타격 ${params.bursts.count}회 겹침, 간격 ${params.bursts.gap}초`);
  if (params.distortion) lines.push(`디스토션: drive ${params.distortion.drive} (오실레이터 합을 tanh 곡선으로 찌그러뜨린 뒤 필터)`);
  if (params.fm) lines.push(`FM: 사인 모듈레이터 음높이 x${params.fm.ratio}, 깊이 index ${params.fm.index} (index x 모듈레이터 Hz)에서 ${params.fm.decay}초 동안 0으로`);
  if (params.vibrato) lines.push(`비브라토: ${params.vibrato.rate}Hz, 깊이 ±${params.vibrato.depth}센트, ${params.vibrato.delay}초 뒤 시작`);
  if (params.hold) lines.push(`홀드: ${params.hold}초 (노트를 이만큼 이상 길게 울린다)`);
  if (params.spread) lines.push(`좌우 벌림(spread): ${params.spread} (오실레이터를 -${params.spread} ~ +${params.spread}에 고르게)`);
  if (params.formants) lines.push(`포먼트: 메인 필터 대신 병렬 밴드패스 ${params.formants.map((f) => `${f.freq}Hz Q${f.Q} 게인 ${f.gain}`).join(' / ')}`);
  if (params.filterLfo) lines.push(`필터 LFO: ${+params.filterLfo.rate.toFixed(3)}Hz, 폭 ±${params.filterLfo.depth}Hz (메인 필터 주파수에 더함)`);
  const e = params.env;
  lines.push(`엔벨로프: 어택 ${e.attack}초, 디케이 ${e.decay}초, 서스테인 ${e.sustain}, 릴리스 ${e.release}초 (게이트 = max(노트 길이(기본 1칸), 어택+디케이, 홀드))`);
  lines.push(`최대 게인 ${params.gain}`);
  return lines.map((l) => `- ${l}`).join('\n');
}

function designMarkdown(data) {
  // 사람이 읽는 시간 값은 소수 4자리로 줄인다 (JSON의 timing은 그대로)
  const r4 = (v) => +v.toFixed(4);
  const t = { ...data.timing, grid: data.grid || TOOL.DEFAULT_GRID, bpm: data.bpm || TOOL.DEFAULT_BPM, beatSeconds: r4(data.timing.beatSeconds), stepSeconds: r4(data.timing.stepSeconds), loopSeconds: r4(data.timing.loopSeconds) };
  const out = [];
  out.push('# 유물 비트 설계서');
  out.push('');
  out.push('4Bit_Prototype 유물 비트 메이커(`relic-beat-tool/`)에서 내보낸 파일이다. 유물마다 악기 하나로 찍은 16박(4마디) 루프다.');
  out.push('');
  out.push('## 읽는 법');
  out.push('');
  const grid16 = t.grid === 16;
  const per = stepsPerBeat(t.grid);
  out.push(`- **시간 기준:** ${t.bpm}BPM(4분음표 기준, JSON \`bpm\`, 없으면 ${TOOL.DEFAULT_BPM}). 1박 = 4분음표 = ${t.beatSeconds}초, 격자 ${t.grid}분(JSON \`grid\`, 없으면 8): 칸 하나 = ${grid16 ? '0.25박 = 16분음표' : '0.5박 = 8분음표'} = ${t.stepSeconds}초, 16박 = 4마디 = ${t.steps}칸, 루프 = ${t.loopSeconds}초. 루프는 이음매 없이 반복한다. 표의 초는 반올림한 값이고 정확한 칸 시간은 ${grid16 ? 15 : 30} / ${t.bpm}초다.`);
  out.push(`- **칸 번호:** 0~${t.steps - 1}. 칸 i는 루프 시작 후 i x ${t.stepSeconds}초에 울린다. "박.위치" 표기로 ${grid16 ? '칸 0 = 1.0, 칸 1 = 1.25, 칸 2 = 1.5, 칸 3 = 1.75, 칸 4 = 2.0 … 칸 63 = 16.75' : '칸 0 = 1.0, 칸 1 = 1.5, 칸 2 = 2.0 … 칸 31 = 16.5'}다.`);
  out.push('- **음 표기:** 과학적 음이름(C4 = MIDI 60, 샵 표기). 쉬는 칸은 `-`, 음높이 없는 타악은 `X`, 같은 칸의 여러 음(화음)은 `+`로 잇는다.');
  out.push('- **세기:** 음 뒤 `@m`은 중(0.7), `@w`는 약(0.4)이고 표기가 없으면 강(1.0)이다 (타악은 `X@m`). JSON `velocity`는 노트 게인 배율이고 없으면 1이다.');
  out.push(`- **노트 길이:** 기본 1칸이다. \`C3*4\`처럼 \`*칸 수\`가 붙은 음높이 노트는 그만큼 이어지고 표에서 이어지는 칸은 \`=\`다(JSON \`length\`, 없으면 1, 타악은 쓰지 않음). 게이트 = max(길이 x ${t.stepSeconds}초, 어택+디케이, 홀드)이고 루프 끝을 넘는 길이는 루프 끝에서 자른다. 악기의 릴리스는 게이트 뒤로 이어진다.`);
  out.push(`- **롤:** \`X/3\`처럼 \`/N\`이 붙은 노트는 그 칸에서 N번 나눠 친다 (JSON \`repeat\` 2~${TOOL.REPEAT_MAX}, 없으면 1). 칸(스윙 반영)을 N등분한 간격으로 같은 세기로 치고, 한 번의 게이트는 그 간격이다. 롤 노트는 길이를 쓰지 않는다(1칸). 표기 순서는 음, 길이, 롤, 세기다 (예: \`C3/2@m\`).`);
  if (data.groove && data.groove.swing > 0) {
    out.push(`- **스윙:** ${Math.round(data.groove.swing * 100)}% (JSON \`groove.swing\`). 칸 i의 시각 = i x ${t.stepSeconds}초 + (i가 홀수면 swing x ${t.stepSeconds}초). 노트의 끝 경계도 같은 규칙을 따른다.`);
  } else {
    out.push(`- **스윙:** 없음. JSON에 \`groove.swing\`이 있으면 칸 i의 시각 = i x ${t.stepSeconds}초 + (i가 홀수면 swing x ${t.stepSeconds}초)다.`);
  }
  const delayNote = data.delayNote || TOOL.DEFAULT_DELAY_NOTE;
  const delaySec = +(TOOL.DELAY_NOTES[delayNote] * 60 / t.bpm).toFixed(4);
  out.push(`- **믹스 설정 (유물별, 없으면 0):** \`sidechain\`은 킥마다 유물 소리를 (1 - 값)까지 ${TOOL.SIDECHAIN_ATTACK}초에 눌렀다가 ${TOOL.SIDECHAIN_RELEASE}초에 되돌린다. 4분 정박 킥(매 박 머리) 기준으로 설계했다. \`reverbSend\`·\`delaySend\`는 공통 리버브(감쇠 노이즈 임펄스 ${TOOL.REVERB_SECONDS}초)와 공통 딜레이(${DELAY_NOTE_NAMES[delayNote]} = ${TOOL.DELAY_NOTES[delayNote]}박 = ${delaySec}초, JSON \`delayNote\`, 없으면 ${TOOL.DEFAULT_DELAY_NOTE}, 피드백 ${TOOL.DELAY_FEEDBACK}, 피드백 로우패스 ${TOOL.DELAY_FEEDBACK_LOWPASS}Hz)로 보내는 양이다. \`lofi\`는 계단 곡선(${TOOL.LOFI_BITS_MAX}비트에서 ${TOOL.LOFI_BITS_MIN}비트로)과 로우패스(${TOOL.LOFI_CUTOFF_MAX}Hz에서 ${TOOL.LOFI_CUTOFF_MIN}Hz로)를 값에 따라 건다. \`lowCut\`(저음 깎기)은 하이패스 ${TOOL.LOW_CUT_MIN} x (${TOOL.CUT_FULL} / ${TOOL.LOW_CUT_MIN})^값 Hz, \`highCut\`(고음 깎기)은 로우패스 ${TOOL.HIGH_CUT_MAX} x (${TOOL.CUT_FULL} / ${TOOL.HIGH_CUT_MAX})^값 Hz다 (값 1이면 둘 다 ${TOOL.CUT_FULL}Hz, Q ${TOOL.CUT_Q}, 12dB/oct). 소리 경로는 볼륨, 사이드체인, 하이패스, 로우패스, 로파이 순이고 센드는 그 뒤에서 뽑는다.`);
  out.push('- **데모 드럼:** 툴의 데모 드럼(킥·스네어)은 미리듣기 전용이며 이 데이터에 없다.');
  const root = data.root || 0;
  out.push(`- **스케일:** ${keyScaleName(data.scale.name, root)} (반음 간격 ${data.scale.intervals.join(' ')}). 음높이는 C 기준 스케일 음에 키 \`root\`(${root}) 반음을 더한다(JSON \`root\` 0~11, 없으면 0). 음높이 악기는 스케일 음 ${data.pitchRows || TOOL.PITCH_ROWS}행(JSON \`pitchRows\` 8 또는 15, 없으면 8, 행 0이 가장 낮다), 타악은 행 1개다. 노트의 \`midi\`·\`pitch\`는 키와 유물의 옥타브 이동을 반영한 실제 음이다.`);
  out.push(`- **유물 설정 (유물별, 없으면 기본):** \`swing\`(0~${TOOL.SWING_MAX})이 있으면 그 유물만 이 스윙을 쓰고 없으면 전체 스윙을 따른다. \`octaveShift\`(${TOOL.OCTAVE_SHIFT_MIN}~+${TOOL.OCTAVE_SHIFT_MAX})는 음을 옥타브 단위로 옮긴다(MIDI 0~127을 넘으면 옥타브 단위로 안으로 접는다). \`pan\`(-1 왼쪽 ~ 1 오른쪽)은 마스터로 가는 소리만 좌우로 보내고 리버브·딜레이 센드는 가운데에서 뽑는다. \`filterSweep\`({ from, to }, 각 0~1)은 루프 머리에서 끝까지 로우패스를 ${TOOL.HIGH_CUT_MAX} x (${TOOL.CUT_FULL} / ${TOOL.HIGH_CUT_MAX})^from Hz에서 ^to Hz로 지수 램프로 움직이고 루프마다 처음으로 돌아간다(고음 깎기와 따로 직렬로 건다).`);
  out.push('- **원본 데이터:** 맨 아래 JSON이 원본이고 위의 표는 JSON에서 만든 것이다. 둘이 다르면 JSON을 따른다. 툴의 불러오기도 JSON만 읽는다.');
  out.push('- **게임 반영 시 주의:** 게임의 쿵(A)·짝(S) 판정 소리와 겹치지 않게 킥·스네어 음색은 쓰지 않았다. 템포와 격자는 위 시간 기준을 따르며 게임 링 박자(0.3초)와 묶여 있지 않다. 볼륨(`volume` x `mixVolume`)은 상대값이다. 합성 파라미터는 Web Audio API 기준(오실레이터 파형, BiquadFilter, 게인 엔벨로프)이다.');
  out.push('- **선택 파라미터:** `distortion`(WaveShaper tanh 곡선, drive가 클수록 강함, 필터 앞), `fm`(사인 모듈레이터가 주파수를 변조, 깊이 = index x 모듈레이터 Hz가 decay초 동안 0으로), `vibrato`(LFO로 detune을 ±depth센트 흔듦, delay초 뒤 시작), `hold`(게이트를 max(1칸, 어택+디케이, hold)로 늘림), `filterLfo`(사인 LFO가 메인 필터 주파수에 ±depth Hz를 rate Hz로 더함, 노트 시작에 위상 0), `spread`(오실레이터를 좌우로 -spread ~ +spread에 고르게 벌림), `formants`(메인 필터 대신 병렬 밴드패스 [{ freq, Q, gain }]를 지나 합침, 보컬 모음)는 있는 프리셋에만 쓴다. 없으면 그 처리를 하지 않는다.');
  out.push('');
  out.push('## 요약');
  out.push('');
  out.push('| 유물 | 악기 | 음높이 범위 | 노트 수 | 특징 |');
  out.push('|---|---|---|---|---|');
  for (const r of data.relics) {
    const midis = r.notes.map((n) => n.midi).filter((m) => m !== null);
    const steps = new Set(r.notes.map((n) => n.step));
    const range = !r.preset.pitched ? '타격음' : midis.length ? `${midiName(Math.min(...midis))} ~ ${midiName(Math.max(...midis))}` : '-';
    out.push(`| ${r.name} | ${r.preset.name} | ${range} | ${r.notes.length} | ${featureText(r, steps, midis, r.preset)} |`);
  }
  const mix = data.relics.filter((r) => r.mixSlot).sort((a, b) => a.mixSlot - b.mixSlot);
  if (mix.length) {
    out.push('');
    out.push(`믹스 바: ${mix.map((r) => `${r.mixSlot}번 ${r.name} (${Math.round(r.mixVolume * 100)}%)`).join(', ')}`);
  }
  for (const r of data.relics) {
    out.push('');
    out.push(`## ${r.name}`);
    out.push('');
    out.push(`- **악기:** ${r.preset.name} (\`${r.preset.id}\`, ${r.preset.pitched ? `음높이 악기, 행 0 옥타브 ${r.preset.octave}` : '타악·노이즈'})`);
    out.push(`- **볼륨:** ${Math.round(r.volume * 100)}%${r.mixSlot ? `, 믹스 ${r.mixSlot}번 칸 ${Math.round(r.mixVolume * 100)}%` : ''}`);
    out.push(`- **노트 수:** ${r.notes.length}`);
    const mixText = mixSettingsText(r);
    if (mixText) out.push(`- **믹스 설정:** ${mixText}`);
    const relicText = relicSettingsText(r);
    if (relicText) out.push(`- **유물 설정:** ${relicText}`);
    out.push('');
    out.push('합성 파라미터:');
    out.push('');
    out.push(paramsText(r.preset.params));
    out.push('');
    // 박 단위 표: 행 = 박(4분음표) 16개, 열 = 박 안의 칸 (8분 .0 .5 / 16분 .0 .25 .5 .75)
    const cols = STEP_FRACTIONS[t.grid].map((f) => `.${f}`);
    out.push(`| 박 | ${cols.join(' | ')} |`);
    out.push(`|---|${cols.map(() => '---').join('|')}|`);
    for (let b = 0; b < t.beats; b++) {
      out.push(`| ${b + 1} | ${cols.map((_, k) => stepText(r, b * per + k)).join(' | ')} |`);
    }
    out.push('');
    out.push('한 줄 패턴:');
    out.push('');
    out.push('```');
    out.push(Array.from({ length: t.steps }, (_, s) => `${stepLabel(s, t.grid)}:${stepText(r, s)}`).join(' '));
    out.push('```');
  }
  out.push('');
  out.push('## 데이터 (JSON)');
  out.push('');
  out.push(`최상위 선택 항목: \`bpm\`(${TOOL.BPM_MIN}~${TOOL.BPM_MAX} 정수, 없으면 ${TOOL.DEFAULT_BPM}), \`grid\`(8 또는 16, 없으면 8), \`root\`(0~11, 없으면 0), \`pitchRows\`(8 또는 15, 없으면 8), \`delayNote\`(${Object.keys(TOOL.DELAY_NOTES).join(', ')}, 없으면 ${TOOL.DEFAULT_DELAY_NOTE}). \`timing\`은 참고값이라 불러올 때 쓰지 않는다.`);
  out.push('');
  out.push('`notes`의 `step`은 칸 번호(8분 격자 0~31, 16분 격자 0~63), `row`는 음높이 행(스케일 기준, 행 0이 가장 낮음), `midi`와 `pitch`는 그 행의 실제 음(타악은 null)이다. 선택 항목: 노트의 `velocity`(0~1, 없으면 1), `length`(칸 수, 없으면 1), `repeat`(한 칸 안 타격 수 1~4, 없으면 1, 2 이상이면 length는 1), 유물의 `sidechain`·`reverbSend`·`delaySend`·`lofi`·`lowCut`·`highCut`(0~1, 없으면 0)·`swing`(없으면 전체 스윙)·`octaveShift`(-2~2, 없으면 0)·`pan`(-1~1, 없으면 0)·`filterSweep`({ from, to }, 없으면 없음), 전체의 `groove.swing`(0~0.5, 없으면 0).');
  out.push('');
  out.push('```json');
  out.push(JSON.stringify(data, null, 2));
  out.push('```');
  out.push('');
  return out.join('\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function checkedRelics() {
  return state.relics.filter((r) => r.checked);
}

function exportDesign() {
  const relics = checkedRelics();
  if (!relics.length) { setStatus('체크한 유물이 없습니다.', true); return; }
  const filename = `relic-beats-${timestamp()}.md`;
  const md = designMarkdown(designData(relics));
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename);
  setStatus(`설계서 저장: ${filename} (유물 ${relics.length}개)`);
  return md;
}

// ---------------------------------------------------------------------------
// 불러오기
// ---------------------------------------------------------------------------
// 설계서에서 JSON 코드블록만 읽는다. 문제가 있으면 이유를 담아 throw한다.
function parseDesign(text) {
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (!blocks.length) throw new Error('JSON 코드블록(```json)이 없습니다. 이 툴에서 내보낸 설계서인지 확인하세요.');
  let data;
  try {
    data = JSON.parse(blocks[blocks.length - 1][1]);
  } catch (e) {
    throw new Error(`JSON을 읽을 수 없습니다: ${e.message}`);
  }
  if (!data || typeof data.schema !== 'string' || !data.schema.startsWith(TOOL.SCHEMA_PREFIX)) {
    throw new Error(`스키마가 다릅니다. "${TOOL.SCHEMA}" 파일이 필요합니다 (파일: ${data && data.schema ? `"${data.schema}"` : '스키마 없음'}).`);
  }
  if (data.schema !== TOOL.SCHEMA) {
    throw new Error(`지원하지 않는 버전입니다: "${data.schema}". 이 툴은 "${TOOL.SCHEMA}"를 읽습니다.`);
  }
  if (data.scale && data.scale.name && !SCALES[data.scale.name]) {
    throw new Error(`알 수 없는 스케일입니다: "${data.scale.name}"`);
  }
  if (!Array.isArray(data.relics) || !data.relics.length) throw new Error('유물(relics)이 없습니다.');
  // 최상위 선택 항목. grid는 16만 16분 격자이고 그 밖은 8, bpm은 범위로 맞추고, 모르는 delayNote는 기본값이다.
  const grid = data.grid === 16 ? 16 : 8;
  const steps = gridSteps(grid);
  const bpm = clampBpm(data.bpm);
  const delayNote = TOOL.DELAY_NOTES[data.delayNote] ? data.delayNote : TOOL.DEFAULT_DELAY_NOTE;
  const root = clampRoot(data.root);
  const pitchRows = data.pitchRows === 15 ? 15 : TOOL.PITCH_ROWS;
  const names = new Set();
  const relics = data.relics.map((r, i) => {
    const where = `${i + 1}번째 유물`;
    if (!r || typeof r.name !== 'string' || !r.name.trim()) throw new Error(`${where}: 이름이 없습니다.`);
    const name = r.name.trim().slice(0, TOOL.NAME_MAX);
    if (names.has(name)) throw new Error(`이름이 겹칩니다: "${name}"`);
    names.add(name);
    const presetId = r.preset && r.preset.id;
    const preset = PRESET_BY_ID[presetId];
    if (!preset) throw new Error(`"${name}": 알 수 없는 악기 프리셋입니다 (${presetId}).`);
    if (!Array.isArray(r.notes)) throw new Error(`"${name}": 노트(notes)가 없습니다.`);
    const notes = r.notes.map((n, j) => {
      if (!Number.isInteger(n.step) || n.step < 0 || n.step >= steps) throw new Error(`"${name}" ${j + 1}번째 노트: 칸 번호(step)가 0~${steps - 1}(격자 ${grid}분)이 아닙니다.`);
      if (!Number.isInteger(n.row) || n.row < 0 || n.row >= rowCount(preset, pitchRows)) throw new Error(`"${name}" ${j + 1}번째 노트: 행(row)이 악기 범위를 벗어납니다.`);
      // 새 항목은 범위 밖이면 범위 안으로 맞춘다
      const note = { step: n.step, row: n.row };
      if (typeof n.velocity === 'number' && Number.isFinite(n.velocity)) note.velocity = clamp(n.velocity, 0, 1);
      if (typeof n.length === 'number' && Number.isFinite(n.length)) note.length = clamp(Math.round(n.length), 1, steps - n.step);
      if (typeof n.repeat === 'number' && Number.isFinite(n.repeat)) note.repeat = clamp(Math.round(n.repeat), 1, TOOL.REPEAT_MAX);
      return note;
    });
    const volume = typeof r.volume === 'number' ? Math.min(TOOL.VOLUME_MAX, Math.max(0, r.volume)) : TOOL.DEFAULT_VOLUME;
    const relic = { name, preset: preset.id, notes, volume };
    for (const k of MIX_FIELDS) relic[k] = clamp(num(r[k], 0), 0, 1);
    for (const k of RELIC_EXTRA_FIELDS) if (r[k] !== undefined) relic[k] = r[k];
    normalizeRelicExtras(relic);
    return relic;
  });
  const swing = clamp(num(data.groove && data.groove.swing, 0), 0, TOOL.SWING_MAX);
  return { scale: data.scale && data.scale.name, swing, relics, grid, bpm, delayNote, root, pitchRows };
}

function importText(text, filename) {
  let parsed;
  try {
    parsed = parseDesign(text);
  } catch (e) {
    alertModal('불러올 수 없는 파일', `${filename}\n\n${e.message}`);
    setStatus(`불러오기 실패: ${e.message}`, true);
    return;
  }
  const existing = new Map(state.relics.map((r) => [r.name, r]));
  const overwrite = parsed.relics.filter((r) => existing.has(r.name));
  const added = parsed.relics.filter((r) => !existing.has(r.name));
  const body = el('div');
  body.append(el('div', '', `${filename}에서 유물 ${parsed.relics.length}개를 불러온다.`));
  const section = (title, list) => {
    if (!list.length) return;
    body.append(el('div', '', title));
    const ul = el('ul');
    for (const r of list) ul.append(el('li', '', `${r.name} (${PRESET_BY_ID[r.preset].name}, 노트 ${r.notes.length})`));
    body.append(ul);
  };
  section('덮어쓰는 유물 (악기, 노트, 볼륨, 믹스 설정이 파일 내용으로 바뀐다):', overwrite);
  section('새로 추가하는 유물:', added);
  const scaleChange = parsed.scale && parsed.scale !== state.scale;
  if (scaleChange) body.append(el('div', '', `스케일이 "${state.scale}"에서 "${parsed.scale}"로 바뀐다 (모든 유물의 음높이 행에 적용).`));
  const swingChange = Math.round(parsed.swing * 100) !== Math.round(state.swing * 100);
  if (swingChange) body.append(el('div', '', `스윙이 ${Math.round(state.swing * 100)}%에서 ${Math.round(parsed.swing * 100)}%로 바뀐다 (모든 유물에 적용).`));
  const bpmChange = parsed.bpm !== state.bpm;
  if (bpmChange) body.append(el('div', '', `템포가 ${state.bpm}BPM에서 ${parsed.bpm}BPM으로 바뀐다 (모든 유물에 적용).`));
  const delayChange = parsed.delayNote !== state.delayNote;
  if (delayChange) body.append(el('div', '', `딜레이가 ${DELAY_NOTE_NAMES[state.delayNote]}에서 ${DELAY_NOTE_NAMES[parsed.delayNote]}로 바뀐다.`));
  // 격자가 다르면 파일의 격자를 툴 전체에 적용하고, 파일에 없는 유물은 같은 시각을 유지하도록 옮긴다
  const gridChange = parsed.grid !== state.grid;
  const others = state.relics.filter((r) => !parsed.relics.some((p) => p.name === r.name));
  const dropped = gridChange && parsed.grid === 8 ? oddStepNotes(others) : 0;
  if (gridChange) {
    body.append(el('div', '', `격자가 ${state.grid}분에서 ${parsed.grid}분으로 바뀐다. 파일에 없는 유물의 노트는 같은 시각으로 옮긴다${dropped ? ` (16분 홀수 칸 노트 ${dropped}개는 지워진다)` : ''}.`));
  }
  const rootChange = parsed.root !== state.root;
  if (rootChange) body.append(el('div', '', `키가 ${NOTE_NAMES[state.root]}에서 ${NOTE_NAMES[parsed.root]}로 바뀐다 (모든 유물의 음높이에 적용).`));
  const rowsChange = parsed.pitchRows !== state.pitchRows;
  const highDropped = rowsChange && parsed.pitchRows < state.pitchRows ? highRowNotes(others, parsed.pitchRows) : 0;
  if (rowsChange) body.append(el('div', '', `행 수가 ${state.pitchRows}행에서 ${parsed.pitchRows}행으로 바뀐다${highDropped ? ` (파일에 없는 유물의 행 ${parsed.pitchRows} 이상 노트 ${highDropped}개는 지워진다)` : ''}.`));
  body.append(el('div', 'hint', '목록에만 있는 유물과 믹스 바는 그대로다.'));
  // 덮어쓰기는 파일 내용이 곧 그 유물이다: 파일에 없는 새 항목은 기본값으로 돌아간다
  const fill = (target, r) => {
    target.preset = r.preset;
    target.notes = r.notes;
    target.volume = r.volume;
    for (const k of MIX_FIELDS) {
      if (r[k] > 0) target[k] = r[k];
      else delete target[k];
    }
    for (const k of RELIC_EXTRA_FIELDS) {
      if (r[k] !== undefined) target[k] = r[k];
      else delete target[k];
    }
    fitNotesToPreset(target);
  };
  const apply = () => {
    if (scaleChange) state.scale = parsed.scale;
    state.swing = parsed.swing;
    state.root = parsed.root;
    if (rowsChange) {
      if (parsed.pitchRows < state.pitchRows) for (const r of others) dropHighRows(r, parsed.pitchRows);
      state.pitchRows = parsed.pitchRows;
    }
    if (gridChange) {
      for (const r of others) convertRelicGrid(r, state.grid, parsed.grid);
      state.grid = parsed.grid;
    }
    state.bpm = parsed.bpm;
    state.delayNote = parsed.delayNote;
    if (gridChange || bpmChange || delayChange) {
      Player.syncDelay();
      if (Player.mode) Player.start(Player.mode);
    }
    for (const r of parsed.relics) {
      const target = existing.get(r.name);
      if (target) {
        fill(target, r);
      } else {
        const relic = newRelic(r.name);
        fill(relic, r);
        state.relics.push(relic);
      }
    }
    if (!selectedRelic() && state.relics.length) state.selectedId = state.relics[0].id;
    changed();
    setStatus(`불러옴: 덮어쓰기 ${overwrite.length}, 추가 ${added.length}`);
  };
  if (overwrite.length || scaleChange || swingChange || bpmChange || delayChange || gridChange || rootChange || rowsChange) confirmModal('설계서 불러오기', body, apply, '불러오기');
  else apply();
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => importText(String(reader.result), file.name);
  reader.onerror = () => setStatus(`파일을 읽을 수 없습니다: ${file.name}`, true);
  reader.readAsText(file, 'utf-8');
}

function setupImport() {
  const input = $('import-file');
  $('import').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files[0]) readFile(input.files[0]);
    input.value = '';
  });
  // 파일을 화면에 끌어다 놓기
  let depth = 0;
  const overlay = $('drop-overlay');
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; overlay.hidden = false; } });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) overlay.hidden = true; });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });
}

// ---------------------------------------------------------------------------
// 오디오 내보내기 (WAV)
// ---------------------------------------------------------------------------
// 이음매 없는 한 바퀴(16박 = loopSeconds(), 130BPM이면 약 7.385초)를 렌더한다. 재생과 같은 체인·스윙·사이드체인을 쓰고 바이닐 노이즈는 넣지 않는다.
//  1) 한 바퀴의 노트를 압축기 앞까지 두 바퀴 길이로 렌더한다. 루프 끝을 넘는 릴리스·리버브·딜레이 꼬리가 두 번째 바퀴 자리에 남는다.
//     사이드체인은 두 번째 바퀴 자리의 킥에도 걸어, 반복할 때 다음 바퀴 킥이 앞 바퀴 꼬리를 누르는 것까지 넣는다.
//  2) 그 꼬리를 앞으로 접어 더한다. 이음매 앞뒤가 같은 노트에서 나오므로 반복해도 끊기지 않는다.
//     (음높이 슬라이드·FM·비브라토처럼 주파수가 움직이는 소리는 브라우저가 렌더 시각마다 조금씩 다르게 만들어,
//      두 바퀴를 렌더해 두 번째를 자르는 방식으로는 이음매에서 어긋날 수 있다)
//  3) 접은 한 바퀴를 두 번 반복 재생하며 압축기·리미터를 거치고 두 번째 바퀴를 쓴다.
// opts.drums: 데모 드럼 소리를 넣을지. 데모 드럼이 선택되어 있으면 사이드체인은 이 값과 상관없이 적용한다.
async function renderLoop(layers, opts = {}) {
  const sr = TOOL.WAV_SAMPLE_RATE;
  const L = Math.round(loopSeconds() * sr);
  const ctx = new OfflineAudioContext(2, L * 2, sr);
  const bus = makeBus(ctx, false);
  const chains = layers.map(({ relic, volume }) => makeChain(ctx, bus, relic, volume));
  let drumOut = null;
  if (opts.drums && state.drum !== 'none') {
    drumOut = ctx.createGain();
    drumOut.gain.value = state.drumVolume;
    drumOut.connect(bus.input);
  }
  const steps = gridSteps();
  for (let g = 0; g < steps * 2; g++) {
    const step = g % steps;
    const t = stepTime(g);
    // 필터 스윕은 두 번째 바퀴 자리에도 걸어 접은 꼬리가 다음 바퀴 머리와 같은 필터를 지나게 한다
    if (step === 0) layers.forEach(({ relic }, i) => sweepAt(chains[i], relic, t));
    if (g < steps) layers.forEach(({ relic }, i) => scheduleRelicStep(ctx, chains[i].input, relic, step, 0, g));
    scheduleDrumStep(ctx, g < steps ? drumOut : null, chains, step, t);
  }
  const pre = await ctx.startRendering();

  const ctx2 = new OfflineAudioContext(2, L * 2, sr);
  const loop = ctx2.createBuffer(2, L, sr);
  for (let ch = 0; ch < 2; ch++) {
    const src = pre.getChannelData(ch);
    const dst = loop.getChannelData(ch);
    for (let i = 0; i < L; i++) dst[i] = src[i] + src[L + i];
  }
  const player = ctx2.createBufferSource();
  player.buffer = loop;
  player.loop = true;
  player.connect(makeDynamics(ctx2));
  player.start(0);
  const rendered = await ctx2.startRendering();
  return [0, 1].map((ch) => rendered.getChannelData(ch).slice(L, L * 2));
}

// 16비트 PCM 스테레오 WAV
function encodeWav(channels, sampleRate) {
  const frames = channels[0].length;
  const buffer = new ArrayBuffer(44 + frames * channels.length * 2);
  const view = new DataView(buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  const bytesPerFrame = channels.length * 2;
  str(0, 'RIFF');
  view.setUint32(4, 36 + frames * bytesPerFrame, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, frames * bytesPerFrame, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (const ch of channels) {
      const v = Math.max(-1, Math.min(1, ch[i]));
      view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 체크한 유물마다 WAV 1개 + 체크한 유물을 모두 합친 믹스 WAV 1개
async function exportAudio() {
  const relics = checkedRelics();
  if (!relics.length) { setStatus('체크한 유물이 없습니다.', true); return []; }
  const button = $('export-audio');
  button.disabled = true;
  const stamp = timestamp();
  const files = [];
  try {
    for (const relic of relics) {
      setStatus(`렌더링 중: ${relic.name}`);
      const channels = await renderLoop([{ relic, volume: relic.volume }], { drums: state.wavDrums });
      files.push({ name: `relic-${safeFileName(relic.name)}-${stamp}.wav`, blob: encodeWav(channels, TOOL.WAV_SAMPLE_RATE) });
    }
    setStatus('렌더링 중: 믹스');
    const mix = await renderLoop(relics.map((r) => ({ relic: r, volume: r.volume })), { drums: state.wavDrums });
    files.push({ name: `relic-mix-${stamp}.wav`, blob: encodeWav(mix, TOOL.WAV_SAMPLE_RATE) });
    for (const f of files) {
      downloadBlob(f.blob, f.name);
      await sleep(TOOL.DOWNLOAD_GAP_MS);
    }
    setStatus(`WAV ${files.length}개 저장 (유물 ${relics.length}개 + 믹스 1개)\n여러 파일 다운로드를 브라우저가 물으면 허용하세요.`);
  } catch (e) {
    setStatus(`오디오 내보내기 실패: ${e.message}`, true);
  } finally {
    button.disabled = false;
  }
  return files;
}

// ---------------------------------------------------------------------------
// 시작
// ---------------------------------------------------------------------------
function setup() {
  setupLeft();
  setupGlobals();
  setupEditorInput();
  setupImport();
  $('scale').addEventListener('change', (e) => { state.scale = e.target.value; changed(); });
  $('root').addEventListener('change', (e) => { state.root = clampRoot(+e.target.value); changed(); });
  $('pitch-rows').addEventListener('change', (e) => setPitchRows(+e.target.value));
  $('mix-play').addEventListener('click', () => Player.toggle('mix'));
  $('single-play').addEventListener('click', () => Player.toggle('single'));
  $('volume').addEventListener('input', (e) => {
    const relic = selectedRelic();
    if (!relic) return;
    relic.volume = e.target.value / 100;
    $('volume-label').textContent = `${e.target.value}%`;
    saveSoon();
  });
  $('clear-notes').addEventListener('click', () => {
    const relic = selectedRelic();
    if (!relic) return;
    confirmModal(`'${relic.name}' 노트 지우기`, `노트 ${relic.notes.length}개를 모두 지운다.`, () => { relic.notes = []; changed(); });
  });
  $('export-doc').addEventListener('click', exportDesign);
  $('export-audio').addEventListener('click', exportAudio);
  // 믹스 팝업은 바깥을 누르면 닫는다
  window.addEventListener('click', (e) => {
    const popup = $('mix-popup');
    if (!popup.hidden && !popup.contains(e.target)) popup.hidden = true;
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('mix-popup').hidden = true;
      if (!$('modal').hidden) $('modal-cancel').click();
    }
  });
  if (!selectedRelic() && state.relics.length) state.selectedId = state.relics[0].id;
  render();
}

setup();
