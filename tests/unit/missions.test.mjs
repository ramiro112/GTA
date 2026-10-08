import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissionEngine } from '../../src/missions/engine.js';

function host() {
  const log = [];
  let t = 0;
  let state = { hp: 100 };
  return {
    log, state,
    tick: (dt) => { t += dt; },
    now: () => t,
    onStart: (m) => log.push('start:' + m.id),
    onPass: (m, r) => log.push('pass:' + m.id + ':' + (r.money || 0)),
    onFail: (m, reason) => log.push('fail:' + reason),
    onObjective: (o) => log.push('obj:' + o),
    onTimer: () => {},
    onCheckpoint: (m, i) => log.push('cp:' + i),
    snapshot: () => ({ ...state }),
    restore: (s) => { state.hp = s.hp; log.push('restore:' + s.hp); },
    cleanup: (ents, passed) => log.push('cleanup:' + ents.length + ':' + passed),
  };
}

test('Missionen: Stufen der Reihe nach, Belohnung, Voraussetzungen', () => {
  const h = host();
  const e = new MissionEngine(h);
  let counter = 0;
  e.register({ id: 'a', stages: [{ objective: 'Eins', update: () => ++counter >= 3 }, { objective: 'Zwei', start: (c) => c.track({}), update: () => true }], reward: { money: 100 } });
  e.register({ id: 'b', requires: ['a'], stages: [{ update: () => true }] });
  assert.equal(e.isAvailable('b'), false);
  e.start('a');
  for (let i = 0; i < 5; i++) e.update(0.1);
  assert.ok(e.completed.has('a'));
  assert.ok(h.log.includes('pass:a:100'));
  assert.ok(h.log.includes('cleanup:1:true'));
  assert.equal(e.isAvailable('b'), true);
  assert.equal(e.progress, 0.5);
});

test('Missionen: Zeitlimit führt zum Fehlschlag', () => {
  const h = host();
  const e = new MissionEngine(h);
  e.register({ id: 't', stages: [{ timeLimit: 1, timeoutText: 'Zu langsam', update: () => false }] });
  e.start('t');
  for (let i = 0; i < 15; i++) e.update(0.1);
  assert.equal(e.state, 'failed');
  assert.ok(h.log.includes('fail:Zu langsam'));
});

test('Missionen: failIf und Neustart vom Checkpoint mit Zustandswiederherstellung', () => {
  const h = host();
  const e = new MissionEngine(h);
  let broken = false;
  let reachedStage2 = 0;
  e.register({
    id: 'c',
    failIf: () => (broken ? 'Auto kaputt' : null),
    stages: [
      { update: () => true },
      { checkpoint: true, start: () => { reachedStage2++; }, update: () => false },
    ],
  });
  e.start('c');
  e.update(0.1);
  h.state.hp = 30;      // Zustand verändert sich nach dem Checkpoint
  broken = true;
  e.update(0.1);
  assert.equal(e.state, 'failed');
  assert.ok(h.log.includes('fail:Auto kaputt'));
  broken = false;
  assert.ok(e.retryFromCheckpoint());
  assert.equal(e.state, 'running');
  assert.equal(e.active.stage, 1, 'startet an der Checkpoint-Stufe');
  assert.equal(reachedStage2, 2);
  assert.ok(h.log.includes('restore:100'), 'Zustand vom Checkpoint wiederhergestellt');
});

test('Missionen: Stufe meldet Fehlschlag per "fail:"', () => {
  const h = host();
  const e = new MissionEngine(h);
  e.register({ id: 'f', stages: [{ update: () => 'fail:Ziel entkommen' }] });
  e.start('f');
  e.update(0.1);
  assert.ok(h.log.includes('fail:Ziel entkommen'));
  assert.equal(e.stats.f.attempts, 1);
  assert.equal(e.stats.f.passed, 0);
});

test('Story: 12 Missionen mit allen geforderten Typen registrierbar', async () => {
  // Nur Struktur prüfen (ohne Spielwelt): Story-Modul lädt Three.js nicht direkt im Test → dynamisch prüfen, ob Datei existiert
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/missions/story.js', import.meta.url), 'utf8');
  const ids = [...src.matchAll(/reg\(\{\s*id: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.equal(ids.length, 12, ids.join(','));
  for (const kw of ['checkpoints(RACE', 'stealthStage', 'planeProp', 'heliSmall', 'timeLimit: 150', 'loseWanted', 'boss: true', "'fail:Der Spitzel ist entkommen.'"]) assert.ok(src.includes(kw), kw);
});
