// Spielschleife mit festem Physik-Zeitschritt (Akkumulator-Muster).
// fixedUpdate(dt) läuft immer mit FIXED_DT, update(dt, alpha) und render() einmal pro Frame.

export class GameLoop {
  constructor({ fixedDt = 1 / 60, maxSteps = 5, fixedUpdate, update, render }) {
    this.fixedDt = fixedDt;
    this.maxSteps = maxSteps;
    this.fixedUpdate = fixedUpdate;
    this.update = update;
    this.render = render;
    this.accumulator = 0;
    this.last = 0;
    this.running = false;
    this.timeScale = 1;
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this.frameMs = 0;
    this._raf = null;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  /** Ein Frame. Auch manuell aufrufbar (Tests). */
  step(frameDt) {
    const t0 = performance.now();
    // Kappung: nach Tab-Wechsel oder Ruckler nicht hunderte Physikschritte nachholen.
    frameDt = Math.min(frameDt, this.fixedDt * this.maxSteps) * this.timeScale;
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxSteps) {
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps >= this.maxSteps) this.accumulator = 0;
    const alpha = this.accumulator / this.fixedDt;
    this.update(frameDt, alpha);
    this.render(alpha);
    this.frameMs = performance.now() - t0;
  }

  _tick(now) {
    if (!this.running) return;
    const dt = (now - this.last) / 1000;
    this.last = now;
    this._fpsFrames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 0.5) {
      this.fps = this._fpsFrames / this._fpsTime;
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }
    try {
      this.step(dt);
    } catch (err) {
      console.error('[GameLoop] Fehler im Frame:', err);
    }
    this._raf = requestAnimationFrame(this._tick);
  }
}
