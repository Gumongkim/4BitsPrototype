// 키 입력. 눌림 이벤트는 발생 시각과 함께 큐에 쌓고, 해당 시각을 포함하는 로직 스텝에서 꺼낸다.
// 렌더 프레임레이트와 상관없이 입력이 같은 스텝에 처리되게 하기 위해서다.

const Input = {
  queue: [],      // { code, time, shift }
  pressedNow: {}, // 이번 스텝의 눌림. code -> 입력 후 경과 초
  shiftNow: {},   // 이번 스텝의 눌림 중 Shift를 누른 채 누른 키. code -> true

  init() {
    const blocked = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    window.addEventListener('keydown', (e) => {
      if (blocked.includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.queue.push({ code: e.code, time: e.timeStamp || performance.now(), shift: e.shiftKey });
    });
  },

  // 로직 스텝 시작 시 호출. stepTime은 이 스텝이 대표하는 performance.now() 시각(ms).
  beginStep(stepTime) {
    this.pressedNow = {};
    this.shiftNow = {};
    while (this.queue.length && this.queue[0].time <= stepTime) {
      const press = this.queue.shift();
      const age = Math.max(0, (stepTime - press.time) / 1000);
      this.pressedNow[press.code] = Math.min(age, CONFIG.MAX_INPUT_AGE);
      if (press.shift) this.shiftNow[press.code] = true;
    }
  },

  wasPressed(code) {
    return this.pressedNow[code] !== undefined;
  },

  // 이번 스텝에 Shift를 누른 채 눌렀는지
  withShift(code) {
    return !!this.shiftNow[code];
  },

  pressAge(code) {
    return this.pressedNow[code] || 0;
  },
};
