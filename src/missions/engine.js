// Missions-Engine: Missionen bestehen aus Stufen (start/update/end). Die Engine kümmert sich um
// Reihenfolge, Zeitlimits, Fehlschlag (z. B. Tod, Fahrzeug zerstört), Checkpoints mit Neustart,
// Aufräumen gespawnter Objekte, Belohnungen und Fortschritt. Ohne Three.js → testbar.

export const MISSION_STATE = { IDLE: 'idle', RUNNING: 'running', FAILED: 'failed', PASSED: 'passed' };

export class MissionEngine {
  /**
   * @param {object} host Schnittstelle zum Spiel:
   *   onStart(m), onPass(m, reward), onFail(m, reason), onObjective(text), onTimer(sec|null),
   *   snapshot() → Zustand (für Checkpoint), restore(snap), cleanup(entities), now() → Spielzeit
   */
  constructor(host) {
    this.host = host;
    this.missions = new Map();
    this.completed = new Set();
    this.active = null;
    this.state = MISSION_STATE.IDLE;
    this.failReason = null;
    this.stats = {};          // id → {attempts, passed, bestTime}
  }

  register(def) {
    this.missions.set(def.id, def);
    return def;
  }

  /** Verfügbar, wenn alle Voraussetzungen erfüllt und noch nicht erledigt. */
  isAvailable(id) {
    const m = this.missions.get(id);
    if (!m || this.completed.has(id) || this.active) return false;
    return (m.requires || []).every((r) => this.completed.has(r));
  }

  available() { return [...this.missions.values()].filter((m) => this.isAvailable(m.id)); }

  start(id) {
    const def = this.missions.get(id);
    if (!def) throw new Error('Unbekannte Mission ' + id);
    if (this.active) return false;
    const run = {
      def, id, stage: -1, stageObj: null, data: {}, entities: [], timer: null, startTime: this.host.now(),
      checkpoint: 0, checkpointSnap: null, noPolice: !!def.noPolice, noReinforcements: !!def.noReinforcements,
    };
    this.active = run;
    this.state = MISSION_STATE.RUNNING;
    this.failReason = null;
    const st = (this.stats[id] ||= { attempts: 0, passed: 0, bestTime: null });
    st.attempts++;
    this.host.onStart && this.host.onStart(def, run);
    run.checkpointSnap = this.host.snapshot ? this.host.snapshot() : null;
    this._enter(0);
    return true;
  }

  _enter(i) {
    const run = this.active;
    if (!run) return;
    if (run.stageObj && run.stageObj.end) run.stageObj.end(this.ctx());
    run.stage = i;
    if (i >= run.def.stages.length) { this.pass(); return; }
    const stage = run.def.stages[i];
    run.stageObj = stage;
    run.stageTime = 0;
    run.timer = stage.timeLimit ?? (stage.keepTimer ? run.timer : null);
    if (stage.checkpoint) {
      run.checkpoint = i;
      run.checkpointSnap = this.host.snapshot ? this.host.snapshot() : null;
      this.host.onCheckpoint && this.host.onCheckpoint(run.def, i);
    }
    if (stage.objective) this.host.onObjective && this.host.onObjective(stage.objective);
    if (stage.start) stage.start(this.ctx());
  }

  /** Kontext für Stufenfunktionen. */
  ctx() {
    const self = this;
    const run = this.active;
    return {
      run, data: run ? run.data : {}, host: this.host,
      next: () => self._enter(run.stage + 1),
      goto: (i) => self._enter(i),
      fail: (reason) => self.fail(reason),
      pass: () => self.pass(),
      track: (e) => { run.entities.push(e); return e; },
      objective: (text) => self.host.onObjective && self.host.onObjective(text),
      setTimer: (sec) => { run.timer = sec; },
    };
  }

  update(dt) {
    const run = this.active;
    if (!run || this.state !== MISSION_STATE.RUNNING) return;
    run.stageTime += dt;
    // Globale Fehlschlagbedingung der Mission
    if (run.def.failIf) {
      const r = run.def.failIf(this.ctx());
      if (r) { this.fail(r); return; }
    }
    const stage = run.stageObj;
    if (run.timer !== null && run.timer !== undefined) {
      run.timer -= dt;
      this.host.onTimer && this.host.onTimer(Math.max(0, run.timer));
      if (run.timer <= 0) { this.fail(stage.timeoutText || 'Die Zeit ist abgelaufen.'); return; }
    } else this.host.onTimer && this.host.onTimer(null);
    if (stage && stage.update) {
      const r = stage.update(this.ctx(), dt);
      if (this.active !== run || this.state !== MISSION_STATE.RUNNING) return;
      if (r === true || r === 'done') this._enter(run.stage + 1);
      else if (typeof r === 'string' && r.startsWith('fail:')) this.fail(r.slice(5));
    }
  }

  pass() {
    const run = this.active;
    if (!run) return;
    if (run.stageObj && run.stageObj.end) run.stageObj.end(this.ctx());
    const t = this.host.now() - run.startTime;
    const st = this.stats[run.id];
    st.passed++;
    if (st.bestTime === null || t < st.bestTime) st.bestTime = t;
    this.completed.add(run.id);
    this.state = MISSION_STATE.PASSED;
    this.active = null;
    this.host.onTimer && this.host.onTimer(null);
    this.host.cleanup && this.host.cleanup(run.entities, true);
    this.host.onPass && this.host.onPass(run.def, run.def.reward || {}, t);
  }

  fail(reason = 'Mission gescheitert.') {
    const run = this.active;
    if (!run || this.state !== MISSION_STATE.RUNNING) return;
    if (run.stageObj && run.stageObj.end) run.stageObj.end(this.ctx());
    this.state = MISSION_STATE.FAILED;
    this.failReason = reason;
    this.host.onTimer && this.host.onTimer(null);
    this.host.onFail && this.host.onFail(run.def, reason);
    this.failedRun = run;
    this.active = null;
    this.host.cleanup && this.host.cleanup(run.entities, false);
  }

  /** Neustart vom letzten Checkpoint der zuletzt gescheiterten Mission. */
  retryFromCheckpoint() {
    const run = this.failedRun;
    if (!run || this.active) return false;
    this.failedRun = null;
    this.active = { ...run, entities: [], data: run.checkpoint === 0 ? {} : run.data };
    this.state = MISSION_STATE.RUNNING;
    if (run.checkpointSnap && this.host.restore) this.host.restore(run.checkpointSnap);
    this.active.stageObj = null;
    if (run.checkpoint === 0) this.active.startTime = this.host.now();
    this._enter(run.checkpoint);
    return true;
  }

  abort(reason) { if (this.active) this.fail(reason); }

  get progress() { return this.missions.size ? this.completed.size / this.missions.size : 0; }

  toJSON() { return { completed: [...this.completed], stats: this.stats }; }
  load(d) {
    this.completed = new Set((d && d.completed) || []);
    this.stats = (d && d.stats) || {};
  }
}
