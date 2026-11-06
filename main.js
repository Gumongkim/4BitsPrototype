// 고정 타임스텝 메인 루프.

const Loop = {
  paused: false,  // 디버깅용: true면 로직을 멈춘다
  fps: 0,
};

const game = new Game();
const renderer = new Renderer(document.getElementById('screen'));

(function start() {
  Input.init();
  Sfx.init();
  const step = 1 / CONFIG.LOGIC_HZ;
  let last = performance.now();
  let accumulator = 0;
  let fpsTime = 0;
  let fpsFrames = 0;

  function frame() {
    const now = performance.now();
    const delta = Math.min((now - last) / 1000, CONFIG.MAX_FRAME_DELTA);
    last = now;

    fpsTime += delta;
    fpsFrames++;
    if (fpsTime >= 0.5) {
      Loop.fps = fpsFrames / fpsTime;
      fpsTime = 0;
      fpsFrames = 0;
    }

    if (!Loop.paused) {
      accumulator += delta;
      while (accumulator >= step) {
        accumulator -= step;
        Input.beginStep(now - accumulator * 1000);
        game.update(step);
      }
    }
    renderer.draw(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
