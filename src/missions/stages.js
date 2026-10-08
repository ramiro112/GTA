// Bausteine für Missionen: Markierungen (Zylinder/Ringe/Pfeile), Dialoge, Standard-Stufen
// (Hinfahren, Einsteigen, Abliefern, Gegner ausschalten, Checkpoints, Halten, Warten, Fahndung abschütteln).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { tr } from '../core/i18n.js';
import { disposeTree } from '../core/dispose.js';

// ------------------------------------------------------------------ Markierungen
const markerMat = (c, o = 0.35) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });

export function makeMarker(game, pos, { color = 0xffd23f, radius = 2.5, kind = 'cylinder', height = 2.5 } = {}) {
  const g = new THREE.Group();
  if (kind === 'ring') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.4, 8, 32), markerMat(color, 0.75));
    g.add(ring);
    g.userData.ring = ring;
  } else {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24, 1, true), markerMat(color));
    cyl.position.y = height / 2;
    g.add(cyl);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), markerMat(color, 0.9));
    arrow.rotation.x = Math.PI;
    arrow.position.y = height + 1.5;
    g.add(arrow);
    g.userData.arrow = arrow;
  }
  const y = pos.y ?? game.collision.groundHeight(pos.x, pos.z, 300, 0).h;
  g.position.set(pos.x, kind === 'ring' ? y : y + 0.05, pos.z);
  g.renderOrder = 3;
  game.scene.add(g);
  const m = { mesh: g, pos: new THREE.Vector3(pos.x, g.position.y, pos.z), radius, kind, color, remove: () => { game.scene.remove(g); disposeTree(g); }, isMarker: true };
  return m;
}

/** Pfeil über einem Ziel (folgt dem Ziel). */
export function makeArrow(game, target, color = 0xff3b30) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), markerMat(color, 0.95));
  mesh.rotation.x = Math.PI;
  game.scene.add(mesh);
  return { mesh, target, isArrow: true, color, remove: () => { game.scene.remove(mesh); disposeTree(mesh); } };
}

// ------------------------------------------------------------------ Stufen
/** Erstellt Stufen-Fabriken für ein Spiel. */
export function stageKit(game) {
  const M = game.missions;
  const pl = () => game.player;
  const ppos = () => (pl().vehicle ? pl().vehicle.pos : pl().pos);
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  return {
    /** Dialog abspielen (blockiert bis zum Ende). */
    dialog(lines, extra = {}) {
      return { ...extra, start(c) { if (extra.onStart) extra.onStart(c); c.data._dlg = M.dialog.play(lines); }, update(c) { return M.dialog.done(c.data._dlg); } };
    },

    /** Zu einem Ort gehen/fahren. opts: {target, radius, vehicle (bool|fn), stop (langsam ankommen), objective} */
    goto(o) {
      return {
        ...o,
        start(c) {
          const t = typeof o.target === 'function' ? o.target(c) : o.target;
          c.data._t = t;
          c.data._m = c.track(makeMarker(game, t, { radius: o.radius || 3, color: o.color || 0xffd23f, kind: o.ring ? 'ring' : 'cylinder' }));
          M.setWaypoint(t);
          if (o.onStart) o.onStart(c);
        },
        update(c, dt) {
          const t = c.data._t;
          if (o.vehicle) {
            const v = pl().vehicle;
            const need = typeof o.vehicle === 'function' ? o.vehicle(c) : null;
            if (!v || (need && v !== need)) { M.hint(o.vehicleHint || 'Steig in das Fahrzeug.'); return false; }
            if (o.stop && Math.abs(v.speed || 0) > 4 && dist2(v.pos, t) < (o.radius || 3) + 4) { M.hint('Halte an der Markierung.'); }
          }
          const p = ppos();
          const r = o.radius || 3;
          const inside = o.ring ? p.distanceTo(new THREE.Vector3(t.x, t.y ?? p.y, t.z)) < r + 1 : dist2(p, t) < r;
          if (inside && (!o.stop || !pl().vehicle || Math.abs(pl().vehicle.speed || 0) < 4)) { M.clearWaypoint(); if (o.onArrive) o.onArrive(c); return true; }
          if (o.check) return o.check(c, dt);
          return false;
        },
      };
    },

    /** In ein bestimmtes Fahrzeug steigen. getVeh(c) liefert das Fahrzeug. */
    enter(getVeh, o = {}) {
      return {
        ...o,
        start(c) { const v = getVeh(c); c.data._arrow = c.track(makeArrow(game, v, 0x4cd964)); v.blip = { color: '#4cd964', size: 8 }; M.setWaypoint(v.pos); },
        update(c) {
          const v = getVeh(c);
          if (!v || v.destroyed) return 'fail:Das Fahrzeug wurde zerstört.';
          if (pl().vehicle === v) { v.blip = null; c.data._arrow.remove(); M.clearWaypoint(); return true; }
          return false;
        },
      };
    },

    /** Alle Gegner einer Liste ausschalten. getList(c) → NPCs. */
    killAll(getList, o = {}) {
      return {
        ...o,
        start(c) { if (o.onStart) o.onStart(c); },
        update(c, dt) {
          const list = getList(c).filter((n) => !n.dead && !n.removed);
          if (o.check) { const r = o.check(c, dt); if (r) return r; }
          if (o.objectiveFn) M.objective(o.objectiveFn(list.length));
          return list.length === 0;
        },
      };
    },

    /** Warten (z. B. Zwischensequenz). */
    wait(sec, o = {}) { return { ...o, update(c) { return c.run.stageTime >= sec; } }; },

    /** Checkpoint-Rennen / Flug-Ringe. points: [{x,z,y?}] */
    checkpoints(points, o = {}) {
      return {
        ...o,
        start(c) {
          c.data._cp = 0;
          c.data._cpm = null;
          this._show(c);
          if (o.onStart) o.onStart(c);
        },
        _show(c) {
          if (c.data._cpm) c.data._cpm.remove();
          const p = points[c.data._cp];
          if (!p) return;
          c.data._cpm = c.track(makeMarker(game, p, { kind: o.ring ? 'ring' : 'cylinder', radius: o.radius || 6, color: c.data._cp === points.length - 1 ? 0x4cd964 : 0xffd23f, height: 6 }));
          if (o.ring) {
            const nxt = points[c.data._cp + 1] || p;
            c.data._cpm.mesh.lookAt(nxt.x, nxt.y ?? p.y, nxt.z);
          }
          M.setWaypoint(p);
        },
        update(c, dt) {
          if (o.needVehicle && !o.needVehicle(c)) { M.hint(o.vehicleHint || 'Steig wieder ein!'); }
          const p = points[c.data._cp];
          const pp = ppos();
          const r = (o.radius || 6) + (o.ring ? 2 : 0);
          const hit = o.ring ? pp.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) < r : dist2(pp, p) < r;
          M.objective(`${o.label || 'Checkpoint'} ${c.data._cp + 1}/${points.length}`);
          if (hit) {
            c.data._cp++;
            game.events.emit('mission:checkpointHit', { i: c.data._cp });
            if (o.bonusTime && c.run.timer !== null) c.run.timer += o.bonusTime;
            if (c.data._cp >= points.length) { if (c.data._cpm) c.data._cpm.remove(); M.clearWaypoint(); return true; }
            this._show(c);
          }
          if (o.check) return o.check(c, dt);
          return false;
        },
      };
    },

    /** An einem Ort eine Zeit lang halten (z. B. Tresor knacken). */
    hold(o) {
      return {
        ...o,
        start(c) { c.data._h = 0; c.data._hm = c.track(makeMarker(game, o.target, { radius: o.radius || 1.5, color: 0x5ac8fa })); },
        update(c, dt) {
          const inside = dist2(pl().pos, o.target) < (o.radius || 1.5) + 0.5 && !pl().vehicle;
          if (inside && game.input.down('interact')) c.data._h += dt; else c.data._h = Math.max(0, c.data._h - dt * 0.5);
          game.hud.progress(inside ? (o.label || 'Halten …') + ` (${game.input.labelFor('interact')} gedrückt halten)` : null, c.data._h / o.duration);
          if (o.check) { const r = o.check(c, dt); if (r) return r; }
          if (c.data._h >= o.duration) { game.hud.progress(null); return true; }
          return false;
        },
        end() { game.hud.progress(null); },
      };
    },

    /** Fahndung loswerden. */
    loseWanted(o = {}) {
      return { objective: 'Schüttle die Polizei ab.', ...o, update(c) { return game.police.stars === 0; } };
    },

    /** Freie Stufe. */
    custom(o) { return o; },
  };
}

export { CONFIG, tr };
