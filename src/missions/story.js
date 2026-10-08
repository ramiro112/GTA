// Hauptstory "Schatten der Bucht" – 12 Missionen (eigene Erfindung).
// Protagonist: Mika Varga kehrt nach Port Aurelia zurück, um Onkel Theos Werkstatt vor der
// Bande "Rostschlangen" und ihrem Boss Viktor Rask zu schützen.
// Missionstypen: Fahren/Tutorial, Auto stehlen+abliefern, Bandenkampf, Lieferung mit Zeitlimit,
// Verfolgungsjagd, Flugzeug (Ringe + Landung), Hubschrauber-Rettung, Schleichmission, Rennen,
// Raub (Planung, Ausführung, Flucht), Bosskampf.

import * as THREE from 'three';
import { stageKit, makeMarker } from './stages.js';
import { MILITARY } from '../world/layout.js';
import { events } from '../core/events.js';
import { CombatBrain } from '../ai/brains.js';

export const CONTACTS = {
  mika: { name: 'Mika', pitch: 1.0 },
  theo: { name: 'Theo Varga', pitch: 0.7, desc: { de: 'Dein Onkel, Besitzer der Werkstatt', en: 'Your uncle, garage owner' }, phone: true },
  jules: { name: 'Jules Okafor', pitch: 1.3, desc: { de: 'Pilotin, Flugschule am Flughafen', en: 'Pilot, flight school at the airport' }, phone: true },
  brandt: { name: 'Kommissarin Brandt', pitch: 1.1, desc: { de: 'Polizistin mit eigenen Plänen', en: 'Cop with her own agenda' }, phone: true },
  rami: { name: 'Rami Esteva', pitch: 1.0, desc: { de: 'Hafenarbeiter, alter Freund', en: 'Dock worker, old friend' }, phone: true },
  rask: { name: 'Viktor Rask', pitch: 0.6 },
  funk: { name: 'Polizeifunk', pitch: 1.4 },
};

const THEO = { x: 330, z: 70 };
const HOUSE = { x: 64, z: 73 };
const JULES = { x: -600, z: -612 };
const BRANDT = { x: 366, z: -324 };
const RAMI = { x: 762, z: 300 };

export function registerStory(game, M) {
  const S = stageKit(game);
  const E = M.engine;
  const pl = () => game.player;
  const reg = (def) => E.register(def);

  // ======================================================================= 1
  reg({
    id: 'heimkehr', title: { de: 'Heimkehr', en: 'Homecoming' }, giver: 'theo', start: HOUSE,
    reward: { money: 500, weapons: ['pistol'] },
    stages: [
      S.dialog([
        ['theo', 'Mika! Fünf Jahre war ich allein mit der Werkstatt. Gut, dass du wieder in Port Aurelia bist.', 'Mika! Five years I ran the garage alone. Good to have you back in Port Aurelia.'],
        ['theo', 'Ich hab dir meinen alten Corvan vor die Tür gestellt. Komm rüber zur Werkstatt, wir müssen reden.', 'I left my old Corvan outside. Come over to the garage, we need to talk.'],
      ], { checkpoint: true }),
      S.custom({ start(c) { c.data.car = M.spawnVehicle(c, 'sedan', 76, 62, Math.PI / 2, { mission: true, color: 0x5b1f24 }); c.data.car.owned = true; c.data.car.keepAfter = true; c.next(); } }),
      S.enter((c) => c.data.car, { objective: 'Steig in Theos Auto (F).' }),
      S.goto({ target: { x: 330, z: 66 }, radius: 4, vehicle: true, stop: true, objective: 'Fahr zu Theos Werkstatt (folge der lila Route auf der Minimap).' }),
      S.dialog([
        ['theo', 'Die Rostschlangen wollen Schutzgeld. Viktor Rask persönlich war hier. Ich zahle nicht!', 'The Rust Snakes want protection money. Viktor Rask himself came by. I won\'t pay!'],
        ['mika', 'Dann sorgen wir dafür, dass er es sich anders überlegt.', 'Then we make sure he changes his mind.'],
        ['theo', 'Nimm die Pistole aus der Schublade. Für alle Fälle.', 'Take the pistol from the drawer. Just in case.'],
      ]),
    ],
  });

  // ======================================================================= 2
  reg({
    id: 'ersatzteile', title: { de: 'Ersatzteile', en: 'Spare Parts' }, giver: 'theo', start: THEO, requires: ['heimkehr'],
    reward: { money: 2000 },
    failIf: (c) => (c.data.car && c.data.car.destroyed ? 'Der Velox wurde zerstört.' : null),
    stages: [
      S.dialog([
        ['theo', 'Ein Kunde zahlt gut für den Motor eines Velox GT. Auf dem Dach vom Parkhaus Zentrum steht einer.', 'A customer pays well for a Velox GT engine. There is one on the roof of the Central Car Park.'],
        ['theo', 'Bring ihn heil her. Mit einem Schrotthaufen kann ich nichts anfangen.', 'Bring it here in one piece. I can\'t use a wreck.'],
      ], { checkpoint: true }),
      S.custom({ start(c) { c.data.car = M.spawnVehicle(c, 'sports', 100, -128, Math.PI, { y: 6, locked: true, color: 0xffd000 }); c.data.car.hasAlarm = true; c.next(); } }),
      S.goto({ target: { x: 90, z: -98 }, radius: 5, objective: 'Fahr oder lauf zur Rampe des Parkhauses.' }),
      S.enter((c) => c.data.car, { objective: 'Brich den Velox GT auf und schliess ihn kurz (F).' }),
      S.goto({ target: { x: 330, z: 66 }, radius: 4, vehicle: (c) => c.data.car, vehicleHint: 'Steig wieder in den Velox!', stop: true, objective: 'Bring den Velox zu Theos Werkstatt – möglichst ohne Kratzer.',
        onArrive: (c) => { c.data.ok = c.data.car.health > c.data.car.maxHealth * 0.5; } }),
      S.custom({ update: (c) => (c.data.ok ? true : 'fail:Der Wagen ist Schrott – Theo kann ihn nicht gebrauchen.') }),
      S.custom({ start(c) { game.vehicles.exitVehicle(pl()); c.next(); } }),
      S.dialog([['theo', 'Wunderschön. Der Kunde wird begeistert sein. Hier, dein Anteil.', 'Beautiful. The customer will be thrilled. Here is your share.']]),
    ],
  });

  // ======================================================================= 3
  reg({
    id: 'schutzgeld', title: { de: 'Schutzgeld', en: 'Protection Money' }, giver: 'theo', start: THEO, requires: ['ersatzteile'],
    reward: { money: 3000, weapons: ['smg'] }, noPolice: true,
    failIf: (c) => (c.data.theo && c.data.theo.dead ? 'Theo wurde getötet.' : null),
    stages: [
      S.dialog([
        ['rask', 'Letzte Chance, alter Mann. Zahl – oder meine Jungs zerlegen deine Bude.', 'Last chance, old man. Pay – or my boys will tear your place apart.'],
        ['theo', 'Verschwinde von meinem Grundstück, Rask!', 'Get off my property, Rask!'],
        ['theo', 'Mika, sie kommen! Hier, nimm Munition und die Weste!', 'Mika, they are coming! Here, take ammo and the vest!'],
      ], { checkpoint: true }),
      S.custom({
        objective: 'Verteidige die Werkstatt gegen die Rostschlangen!',
        start(c) {
          pl().inventory.give('pistol', 72);
          pl().armor = 100; pl().model.setVest(true);
          const th = M.spawnNPC(c, 'keeper', 332, 80, { heading: Math.PI });
          th.missionFriend = true;
          th.health = th.maxHealth = 250;
          c.data.theo = th;
          c.data.wave = 0;
          c.data.enemies = [];
          this._wave(c);
        },
        _wave(c) {
          c.data.wave++;
          const n = 3 + c.data.wave;
          const spots = [[270, 60], [395, 60], [330, 15], [300, 40], [370, 40]];
          for (let i = 0; i < n; i++) {
            const [x, z] = spots[i % spots.length];
            c.data.enemies.push(M.spawnEnemy(c, 'rust', x + (Math.random() - 0.5) * 8, z + (Math.random() - 0.5) * 6, { weapon: i % 3 === 0 ? 'bat' : 'pistol' }));
          }
          game.hud.notify(`Welle ${c.data.wave}/3`);
        },
        update(c) {
          const alive = c.data.enemies.filter((n) => !n.dead && !n.removed).length;
          M.objective(`Welle ${c.data.wave}/3 – Rostschlangen übrig: ${alive}`);
          if (alive === 0) { if (c.data.wave >= 3) return true; this._wave(c); }
          return false;
        },
      }),
      S.dialog([
        ['theo', 'Die kommen so schnell nicht wieder. Du hast was drauf, Kleiner.', 'They won\'t be back any time soon. You\'ve got skills, kid.'],
        ['theo', 'Nimm die MP von dem Kerl da. Du wirst sie brauchen.', 'Take that guy\'s SMG. You\'ll need it.'],
      ]),
    ],
  });
  // ======================================================================= 4
  reg({
    id: 'eilzustellung', title: { de: 'Eilzustellung', en: 'Rush Delivery' }, giver: 'theo', start: THEO, requires: ['schutzgeld'],
    reward: { money: 2500 },
    failIf: (c) => (c.data.truck && c.data.truck.destroyed ? 'Der Lastwagen wurde zerstört.' : null),
    stages: [
      S.dialog([
        ['theo', 'Die Teile müssen auf die "Meridian" am Hafen. Das Schiff legt bald ab!', 'The parts have to go onto the "Meridian" at the harbor. The ship leaves soon!'],
        ['theo', 'Fahr vorsichtig, die Ladung ist empfindlich.', 'Drive carefully, the cargo is fragile.'],
      ], { checkpoint: true }),
      S.custom({ start(c) { c.data.truck = M.spawnVehicle(c, 'truck', 350, 63, Math.PI / 2, { mission: true, color: 0x2e6fd8 }); c.next(); } }),
      S.enter((c) => c.data.truck, { objective: 'Steig in den Lastwagen.' }),
      S.goto({
        target: { x: 850, z: 300 }, radius: 6, vehicle: (c) => c.data.truck, stop: true, timeLimit: 150,
        objective: 'Liefere die Teile zum Hafen, bevor das Schiff ablegt!',
        check: (c) => (c.data.truck.health < c.data.truck.maxHealth * 0.45 ? 'fail:Die Ladung ist beschädigt.' : false),
      }),
      S.custom({ start(c) { game.vehicles.exitVehicle(pl()); c.next(); } }),
      S.dialog([
        ['rami', 'Mika? Mika Varga! Ich hab dich ja ewig nicht gesehen!', 'Mika? Mika Varga! I haven\'t seen you in ages!'],
        ['rami', 'Ich arbeite jetzt hier am Hafen. Wenn du mal Hilfe brauchst – du findest mich bei den Containern.', 'I work here at the docks now. If you ever need help – you\'ll find me by the containers.'],
      ]),
    ],
  });

  // ======================================================================= 5
  reg({
    id: 'spitzel', title: { de: 'Der Spitzel', en: 'The Snitch' }, giver: 'rami', start: RAMI, requires: ['eilzustellung'],
    reward: { money: 3500 },
    stages: [
      S.dialog([
        ['rami', 'Ein Spitzel der Rostschlangen hat herausgefunden, wo Theo wohnt. Er will es Rask erzählen!', 'A Rust Snakes snitch found out where Theo lives. He wants to tell Rask!'],
        ['rami', 'Er sitzt gerade in einem grauen Corvan bei der Grillstation. Halt ihn auf! Nimm den Wagen da.', 'He\'s in a grey Corvan by the Seagull Grill right now. Stop him! Take that car.'],
      ], { checkpoint: true }),
      S.custom({ start(c) { c.data.myCar = M.spawnVehicle(c, 'sports', 752, 318, Math.PI, { color: 0x00a0ff }); c.data.myCar.locked = false; c.data.myCar.owned = true; c.next(); } }),
      S.enter((c) => c.data.myCar, { objective: 'Steig in den Sportwagen.' }),
      S.custom({
        start(c) {
          // Spitzel wartet im Auto an der Grillstation
          const v = M.spawnVehicle(c, 'sedan', 205, 186, -Math.PI / 2, { color: 0x8a8f99 });
          const d = M.spawnNPC(c, 'gang_rust', 205, 186);
          d.give('pistol', 99); d.equip('fist');
          d.vehicle = v; v.driver = d;
          d.missionTarget = true;
          c.data.target = v; c.data.driver = d;
          v.blip = { color: '#ff3b30', size: 9 };
          c.track(makeArrowFor(game, v));
          c.next();
        },
      }),
      S.goto({ target: { x: 205, z: 186 }, radius: 100, vehicle: true, objective: 'Fahr zur Grillstation – der graue Corvan ist der Spitzel.' }),
      S.custom({
        objective: 'Stoppe den Spitzel, bevor er das Revier der Rostschlangen erreicht!',
        checkpoint: true,
        start(c) {
          const v = c.data.target;
          c.data.escape = new THREE.Vector3(690, 0, -300);
          v.ai = { mode: 'direct', goal: c.data.escape, maxSpeed: 22, arriveDist: 20 };
          game.traffic.cars.push(v);
          c.data.driver.say('Mist, das ist Varga!', 2);
          c.track(makeMarker(game, { x: 690, z: -300 }, { radius: 20, color: 0xff3b30, height: 1 }));
          c.data.stopT = 0;
          c.data.farT = 0;
        },
        update(c, dt) {
          const v = c.data.target, d = c.data.driver;
          if (v.destroyed || d.dead) return true;
          const pp = pl().vehicle ? pl().vehicle.pos : pl().pos;
          const dist = pp.distanceTo(v.pos);
          if (dist > 260) c.data.farT += dt; else c.data.farT = 0;
          if (c.data.farT > 12) return 'fail:Der Spitzel ist entkommen.';
          if (v.pos.distanceTo(c.data.escape) < 25) return 'fail:Der Spitzel hat Rask erreicht.';
          if (Math.abs(v.speed) < 1.5 && dist < 14) c.data.stopT += dt; else c.data.stopT = 0;
          if (c.data.stopT > 2) {
            // Gestellt: Spitzel steigt aus und flieht
            if (v.driver === d) game.traffic.driverExit(v, 'flee');
            return true;
          }
          return false;
        },
        end(c) { if (c.data.target) c.data.target.blip = null; },
      }),
      S.dialog([
        ['mika', 'Der erzählt so schnell niemandem mehr was.', 'He won\'t be telling anyone anything soon.'],
        ['rami', 'Gute Arbeit! Ich ruf Theo an, dass er für ein paar Tage untertauchen soll.', 'Good work! I\'ll call Theo and tell him to lie low for a few days.'],
      ]),
    ],
  });

  // ======================================================================= 6
  const RINGS = [
    { x: -620, z: -770, y: 14 }, { x: -380, z: -700, y: 45 }, { x: -210, z: -420, y: 60 }, { x: -200, z: -100, y: 55 },
    { x: -160, z: 250, y: 45 }, { x: 150, z: 600, y: 35 }, { x: 550, z: 620, y: 35 }, { x: 960, z: 250, y: 50 },
    { x: 900, z: -300, y: 70 }, { x: 600, z: -650, y: 90 }, { x: -150, z: -980, y: 120 }, { x: -700, z: -840, y: 50 },
  ];
  reg({
    id: 'flugstunde', title: { de: 'Flugstunde', en: 'Flying Lesson' }, giver: 'jules', start: JULES, requires: ['ersatzteile'],
    reward: { money: 3000, unlock: 'pilotLicense' }, noPolice: true,
    failIf: (c) => (c.data.plane && c.data.plane.destroyed ? 'Das Flugzeug ist abgestürzt.' : null),
    stages: [
      S.dialog([
        ['jules', 'Theo sagt, du willst fliegen lernen? Dann zeig mal, was du kannst.', 'Theo says you want to learn to fly? Show me what you\'ve got.'],
        ['jules', 'Schub mit Shift/Strg, W/S zum Nicken, A/D zum Rollen, Q/E fürs Seitenruder. G fährt das Fahrwerk ein.', 'Throttle with Shift/Ctrl, W/S to pitch, A/D to roll, Q/E for rudder. G retracts the gear.'],
        ['jules', 'Flieg durch alle Ringe und lande wieder auf der Piste.', 'Fly through every ring and land back on the runway.'],
      ], { checkpoint: true }),
      S.custom({ start(c) { c.data.plane = M.spawnVehicle(c, 'planeProp', -880, -770, Math.PI / 2, { mission: true }); c.next(); } }),
      S.enter((c) => c.data.plane, { objective: 'Steig in die "Möwe" am Anfang der Startbahn.' }),
      S.checkpoints(RINGS, { ring: true, radius: 9, label: 'Ring', timeLimit: 420, bonusTime: 0, objective: 'Flieg durch die Ringe.',
        needVehicle: (c) => pl().vehicle === c.data.plane, vehicleHint: 'Zurück ins Flugzeug!' }),
      S.custom({
        objective: 'Lande auf der Startbahn (Fahrwerk ausfahren: G).',
        start(c) { c.data.lm = c.track(makeMarker(game, { x: -600, z: -770 }, { radius: 22, color: 0x4cd964, height: 1 })); M.setWaypoint({ x: -600, z: -770 }); },
        update(c) {
          const p = c.data.plane;
          if (pl().vehicle !== p) return false;
          const onRunway = p.pos.x > -900 && p.pos.x < -320 && Math.abs(p.pos.z + 770) < 22;
          if (p.onGround && !onRunway && p.vel.length() < 3) return 'fail:Nicht auf der Startbahn gelandet.';
          return p.onGround && onRunway && p.vel.length() < 3 && p.gearDown;
        },
      }),
      S.dialog([
        ['jules', 'Nicht schlecht für den ersten Flug! Du hast deinen Pilotenschein.', 'Not bad for a first flight! You\'ve earned your pilot\'s license.'],
      ]),
    ],
  });

  // ======================================================================= 7
  reg({
    id: 'luftrettung', title: { de: 'Luftrettung', en: 'Air Rescue' }, giver: 'jules', start: JULES, requires: ['flugstunde', 'spitzel'],
    reward: { money: 5000 },
    failIf: (c) => (c.data.heli && c.data.heli.destroyed ? 'Der Helikopter wurde zerstört.' : c.data.rami && c.data.rami.dead ? 'Rami ist tot.' : null),
    stages: [
      S.dialog([
        ['jules', 'Rami hat angerufen – er sitzt auf dem Dach der Zentralbank fest. Die Rostschlangen sind hinter ihm her!', 'Rami called – he\'s stuck on the roof of the Central Bank. The Rust Snakes are after him!'],
        ['jules', 'Nimm den Helikopter. Lande auf dem Dach, hol ihn ab und flieg ihn zur Klinik.', 'Take the helicopter. Land on the roof, pick him up and fly him to the hospital.'],
      ], { checkpoint: true }),
      S.custom({ start(c) { c.data.heli = M.spawnVehicle(c, 'heliSmall', -495, -700, 0, { mission: true }); c.next(); } }),
      S.enter((c) => c.data.heli, { objective: 'Steig in den Helikopter. (Shift = steigen, Strg = sinken)' }),
      S.custom({
        objective: 'Lande auf dem Dach der Zentralbank.',
        start(c) {
          const ry = 22;
          c.data.rami = M.spawnNPC(c, 'ped', 214, -352, { look: { skin: 0x8d5524, shirt: 0xf39c12, pants: 0x2c3e50, hair: 0x111111 } });
          c.data.rami.pos.set(214, ry, -352); c.data.rami.prevPos.copy(c.data.rami.pos);
          c.data.rami.missionFriend = true; c.data.rami.health = c.data.rami.maxHealth = 400;
          c.data.rami.forcedAnim = 'hands';
          c.track(makeMarker(game, { x: 210, z: -355, y: ry }, { radius: 7, color: 0x4cd964, height: 1.5 }));
          for (let i = 0; i < 3; i++) {
            const e = M.spawnEnemy(c, 'rust', 195 + i * 6, -340, { weapon: 'pistol' });
            e.pos.set(196 + i * 8, ry, -340); e.prevPos.copy(e.pos);
          }
          game.police.wanted.ensureStars(2, pl().pos);
          M.setWaypoint({ x: 210, z: -355 });
        },
        update(c) {
          const h = c.data.heli;
          if (pl().vehicle !== h) { M.hint('Steig in den Helikopter!'); return false; }
          return h.onGround && Math.hypot(h.pos.x - 210, h.pos.z + 355) < 16 && h.pos.y > 18;
        },
      }),
      S.custom({
        objective: 'Warte, bis Rami eingestiegen ist.',
        start(c) { c.data.rami.forcedAnim = null; c.data.rami.say('Endlich! Nichts wie weg hier!', 2); },
        update(c) {
          const r = c.data.rami, h = c.data.heli;
          r.goTo(h.pos.x, h.pos.z, 4);
          if (r.pos.distanceTo(h.pos) < 4 || c.run.stageTime > 5) { r.vehicle = h; r.seat = 1; r.model.root.visible = false; h.passengers.push(r); return true; }
          return false;
        },
      }),
      S.goto({ target: { x: -30, z: -245, y: 28 }, radius: 10, objective: 'Flieg Rami zum Helipad auf der St.-Aurelia-Klinik.', check: (c) => {
        const h = c.data.heli;
        if (Math.hypot(h.pos.x + 30, h.pos.z + 245) < 14 && h.onGround && h.pos.y > 24) return true;
        return false;
      } }),
      S.dialog([
        ['rami', 'Danke, Mika. Ich schulde dir was. Und ich weiss, wie wir Rask richtig wehtun können …', 'Thanks, Mika. I owe you. And I know how we can really hurt Rask …'],
      ], { onStart(c) { const r = c.data.rami; r.vehicle = null; r.model.root.visible = true; r.pos.set(-25, 28, -240); r.prevPos.copy(r.pos); } }),
    ],
  });

  // ======================================================================= 8 Schleichmission
  reg({
    id: 'unsichtbar', title: { de: 'Unsichtbar', en: 'Invisible' }, giver: 'brandt', start: BRANDT, requires: ['spitzel'],
    reward: { money: 4000, weapons: ['sniper'] }, noPolice: true,
    stages: [
      S.dialog([
        ['brandt', 'Varga. Ich weiss, was Sie für Rask auf dem Kerbholz haben. Und ich weiss, dass er Waffen aus Fort Kessel bezieht.', 'Varga. I know what you have against Rask. And I know he gets weapons from Fort Kessel.'],
        ['brandt', 'In der Kaserne liegen die Lieferlisten. Holen Sie sie – aber niemand darf Sie sehen.', 'The delivery lists are in the barracks. Get them – but nobody may see you.'],
        ['brandt', 'Ducken (C) macht Sie schwerer zu entdecken. Die Wachen sehen nur, was vor ihnen liegt.', 'Crouching (C) makes you harder to spot. Guards only see what is in front of them.'],
      ], { checkpoint: true, onStart() { game.tod.hour = 23.2; game.weather.set('fog', true); game.weather.locked = true; } }),
      S.goto({ target: { x: 372, z: -690 }, radius: 4, objective: 'Geh zur Westseite des Militärzauns (Loch im Zaun).', checkpoint: true,
        onStart: () => { game.gangs.guardsDisabled = true; } }),
      stealthStage(game, M, { docs: { x: 470, z: -640 }, exitTest: (p) => p.x < 376 || p.z > -598 || p.x > 872 || p.z < -898 }),
      S.goto({ target: BRANDT, radius: 3, objective: 'Bring die Listen zu Kommissarin Brandt.', onStart: () => { game.gangs.guardsDisabled = false; game.weather.locked = false; } }),
      S.dialog([
        ['brandt', 'Ausgezeichnet. Mit diesen Listen kann ich Rasks Freunde im Militär festnageln. Nehmen Sie das hier – für später.', 'Excellent. With these lists I can nail Rask\'s friends in the military. Take this – for later.'],
      ]),
    ],
  });

  // ======================================================================= 9 Rennen
  const RACE = [
    { x: 500, z: 500 }, { x: 150, z: 500 }, { x: -200, z: 500 }, { x: -450, z: 500 }, { x: -680, z: 300 }, { x: -680, z: 0 },
    { x: -680, z: -300 }, { x: -440, z: -540 }, { x: -90, z: -540 }, { x: 300, z: -540 }, { x: 630, z: -540 }, { x: 840, z: -300 }, { x: 840, z: 0 }, { x: 840, z: 300 },
  ];
  reg({
    id: 'strassenkoenig', title: { de: 'Strassenkönig', en: 'King of the Streets' }, giver: 'rami', start: RAMI, requires: ['eilzustellung'],
    reward: { money: 5000, vehicle: 'sports', color: 0x3dff7a }, noPolice: true,
    stages: [
      S.dialog([
        ['rami', 'Heute Nacht ist das Ringrennen. Drei Fahrer, einmal um die ganze Stadt auf dem Autobahnring.', 'Tonight is the ring race. Three drivers, once around the whole city on the ring road.'],
        ['rami', 'Gewinn, und der Siegerwagen gehört dir. Dein Wagen steht an der Startlinie.', 'Win, and the winner\'s car is yours. Your car is waiting at the start line.'],
      ], { checkpoint: true }),
      S.custom({
        start(c) {
          c.data.car = M.spawnVehicle(c, 'sports', 760, 497, -Math.PI / 2, { mission: true, color: 0xff3b1f });
          c.data.racers = [];
          for (let i = 0; i < 3; i++) {
            const v = M.spawnVehicle(c, 'sports', 768 + i * 9, 503 - (i % 2) * 6, -Math.PI / 2, { color: [0xffd000, 0x111111, 0x00a0ff][i] });
            const d = M.spawnNPC(c, 'ped', v.pos.x, v.pos.z);
            d.vehicle = v; v.driver = d;
            v.racer = { cp: 0, skill: 0.88 + i * 0.05 };
            v.blip = { color: '#ff9500', size: 6 };
            c.data.racers.push(v);
          }
          c.next();
        },
      }),
      S.enter((c) => c.data.car, { objective: 'Steig in deinen Rennwagen.' }),
      S.custom({
        objective: 'Mach dich bereit …',
        update(c) {
          const t = c.run.stageTime;
          const n = 3 - Math.floor(t);
          game.hud.center(n > 0 ? String(n) : 'LOS!', 'passed', '', 0.9);
          c.data.car.controls.throttle = 0;
          return t >= 3;
        },
      }),
      S.checkpoints(RACE, { radius: 14, label: 'Checkpoint',
        onStart(c) {
          for (const v of c.data.racers) {
            v.ai = { mode: 'direct', maxSpeed: 40 * v.racer.skill, arriveDist: 0, targetFn: () => { const p = RACE[v.racer.cp]; return p ? { pos: new THREE.Vector3(p.x, 0, p.z) } : null; } };
            game.traffic.cars.push(v);
          }
        },
        check(c) {
          // Gegner: Checkpoints abhaken, Gummiband gegen zu grosse Abstände
          let place = 1;
          for (const v of c.data.racers) {
            const p = RACE[v.racer.cp];
            if (p && Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 18) v.racer.cp++;
            if (v.racer.cp >= RACE.length) return 'fail:Ein Gegner war schneller im Ziel.';
            if (v.racer.cp > c.data._cp) place++;
            const gap = (v.racer.cp - c.data._cp);
            if (v.ai) v.ai.maxSpeed = 40 * v.racer.skill * (gap > 1 ? 0.85 : gap < -1 ? 1.1 : 1);
          }
          M.objective(`Platz ${place}/4 – Checkpoint ${c.data._cp + 1}/${RACE.length}`);
          if (pl().vehicle !== c.data.car) M.hint('Zurück in deinen Wagen!');
          return false;
        },
      }),
      S.dialog([
        ['rami', 'Wahnsinn! Der Wagen gehört dir – er steht ab sofort in deiner Garage.', 'Incredible! The car is yours – it\'s in your garage now.'],
      ]),
    ],
  });

  // ======================================================================= 10 Raub: Planung
  reg({
    id: 'der_plan', title: { de: 'Der Plan', en: 'The Plan' }, giver: 'rami', start: RAMI, requires: ['luftrettung', 'unsichtbar', 'strassenkoenig'],
    reward: { money: 2000, weapons: ['rifle'] },
    failIf: (c) => (c.data.suv && c.data.suv.destroyed ? 'Der Fluchtwagen wurde zerstört.' : null),
    stages: [
      S.dialog([
        ['rami', 'Rask bunkert sein ganzes Geld in der Zentralbank. Wir holen es uns.', 'Rask stashes all his money in the Central Bank. We are taking it.'],
        ['rami', 'Erst kundschaften wir die Bank aus, dann brauchen wir einen Fluchtwagen und Thermit für den Tresor.', 'First we scout the bank, then we need a getaway car and thermite for the vault.'],
      ], { checkpoint: true }),
      S.goto({ target: { x: 210, z: -338 }, radius: 2.5, objective: 'Geh in die Schalterhalle der Zentralbank.' }),
      S.hold({ target: { x: 210, z: -338 }, radius: 2.5, duration: 3, label: 'Kameras und Wachen zählen', objective: 'Präg dir die Kameras ein.' }),
      S.custom({ start(c) { c.data.suv = M.spawnVehicle(c, 'suv', -395, -60, Math.PI / 2, { locked: true, color: 0x1c1c1c }); c.data.suv.hasAlarm = true; c.data.suv.tuning.engine = 2; c.next(); }, checkpoint: true }),
      S.enter((c) => c.data.suv, { objective: 'Stiehl den schwarzen Ranger beim Autohaus Glanz.' }),
      S.goto({ target: { x: 96, z: 72 }, radius: 4, vehicle: (c) => c.data.suv, stop: true, objective: 'Stell den Fluchtwagen vor deiner Garage ab.' }),
      S.custom({ start(c) { game.vehicles.exitVehicle(pl()); c.data.suv.keepAfter = true; c.data.suv.owned = true; c.next(); } }),
      S.custom({
        objective: 'Hol das Thermit aus dem Lager der Kaiwölfe am Hafen.', checkpoint: true,
        start(c) {
          c.data.wolves = [];
          for (let i = 0; i < 5; i++) c.data.wolves.push(M.spawnEnemy(c, 'wolves', 615 + (i % 3) * 5, 115 + Math.floor(i / 3) * 6, { weapon: i % 2 ? 'smg' : 'pistol' }));
          c.data.crate = c.track(makeMarker(game, { x: 620, z: 125 }, { radius: 1.5, color: 0x5ac8fa }));
          M.setWaypoint({ x: 620, z: 125 });
        },
        update(c) {
          const alive = c.data.wolves.filter((n) => !n.dead).length;
          M.objective(alive ? `Kaiwölfe beim Lager: ${alive}` : 'Nimm die Kiste mit dem Thermit.');
          if (!alive && Math.hypot(pl().pos.x - 620, pl().pos.z - 125) < 2.5) return true;
          return false;
        },
      }),
      S.dialog([
        ['rami', 'Thermit, Fluchtwagen, Grundriss. Morgen holen wir uns, was Rask gehört.', 'Thermite, getaway car, floor plan. Tomorrow we take what belongs to Rask.'],
      ]),
    ],
  });

  // ======================================================================= 11 Raub: Ausführung + Flucht
  reg({
    id: 'der_coup', title: { de: 'Der grosse Coup', en: 'The Big Score' }, giver: 'rami', start: { x: 96, z: 70 }, requires: ['der_plan'],
    reward: { money: 25000 },
    failIf: (c) => (c.data.suv && c.data.suv.destroyed && !c.data.escaped ? 'Der Fluchtwagen wurde zerstört.' : null),
    stages: [
      S.dialog([
        ['rami', 'Masken auf. Ich warte im Wagen. Du gehst rein, legst das Thermit an den Tresor und holst das Geld.', 'Masks on. I\'ll wait in the car. You go in, put the thermite on the vault and grab the money.'],
      ], { checkpoint: true }),
      S.custom({ start(c) { c.data.suv = M.spawnVehicle(c, 'suv', 96, 64, Math.PI / 2, { mission: true, color: 0x1c1c1c }); c.data.suv.tuning.engine = 2; c.next(); } }),
      S.enter((c) => c.data.suv, { objective: 'Steig in den Fluchtwagen.' }),
      S.goto({ target: { x: 210, z: -326 }, radius: 4, vehicle: true, stop: true, objective: 'Fahr zur Zentralbank.' }),
      S.custom({ start(c) { game.vehicles.exitVehicle(pl()); c.next(); } }),
      S.goto({ target: { x: 210, z: -362 }, radius: 2, objective: 'Geh zum Tresor im hinteren Teil der Bank.', checkpoint: true,
        onStart: (c) => {
          for (const [x, z] of [[200, -350], [220, -350]]) {
            const gd = M.spawnNPC(c, 'cop', x, z);
            gd.give('pistol', 999);
            gd.missionTarget = true;
            gd.brain = new CombatBrain({ target: () => pl(), accuracy: 0.25, range: [4, 16], useCover: true });
          }
          game.police.wanted.ensureStars(3, pl().pos);
          game.hud.notify('Stiller Alarm ausgelöst!');
        } }),
      S.hold({ target: { x: 210, z: -362 }, radius: 2, duration: 8, label: 'Thermit brennt sich durch den Tresor', objective: 'Halte die Stellung, bis der Tresor offen ist.' }),
      S.custom({
        objective: 'Schnapp dir das Geld!',
        start(c) { if (game.fx) game.fx.explosion(new THREE.Vector3(210, 1, -364), 0.4); c.data.cash = c.track(makeMarker(game, { x: 210, z: -365 }, { radius: 1.2, color: 0x7ee787 })); },
        update() { return Math.hypot(pl().pos.x - 210, pl().pos.z + 365) < 1.8; },
      }),
      S.custom({ start(c) { game.police.wanted.ensureStars(4, pl().pos); game.hud.notify('Die SEK ist unterwegs!'); c.next(); } }),
      S.enter((c) => c.data.suv, { objective: 'Zurück in den Fluchtwagen!', checkpoint: true }),
      S.loseWanted({ objective: 'Hänge die Polizei ab (Autowechsel unbeobachtet hilft).' }),
      S.goto({ target: HOUSE, radius: 4, objective: 'Bring die Beute zu deinem Haus.', onStart: (c) => { c.data.escaped = true; } }),
      S.dialog([
        ['rami', 'Wir haben es geschafft! Rask wird toben.', 'We made it! Rask is going to be furious.'],
        ['theo', 'Er wird kommen. Wir sollten ihm zuvorkommen.', 'He will come. We should strike first.'],
      ]),
    ],
  });

  // ======================================================================= 12 Bosskampf
  reg({
    id: 'abrechnung', title: { de: 'Abrechnung', en: 'Reckoning' }, giver: 'theo', start: THEO, requires: ['der_coup'],
    reward: { money: 50000 }, noPolice: true,
    onPassed: (g) => setTimeout(() => g.hud.center('ENDE', 'passed', 'Danke fürs Spielen! Port Aurelia gehört dir – die Stadt bleibt offen für freies Spiel.', 8), 6000),
    stages: [
      S.dialog([
        ['theo', 'Rask hat sich mit seinen Leuten im Rostfeld verschanzt, beim grossen Schornstein. Nimm das Gewehr und die Weste.', 'Rask has holed up with his people in Rustfield, by the big chimney. Take the rifle and the vest.'],
        ['mika', 'Dann beenden wir es heute.', 'Then we end it today.'],
      ], { checkpoint: true, onStart() { pl().inventory.give('rifle', 180); pl().armor = 100; pl().model.setVest(true); } }),
      S.goto({ target: { x: 680, z: -310 }, radius: 6, objective: 'Fahr zum Hauptquartier der Rostschlangen im Rostfeld.' }),
      S.killAll((c) => c.data.guards, {
        checkpoint: true,
        onStart(c) {
          c.data.guards = [];
          const spots = [[660, -350], [700, -350], [720, -370], [650, -380], [690, -395], [710, -400], [670, -410], [640, -360]];
          for (const [x, z] of spots) c.data.guards.push(M.spawnEnemy(c, 'rust', x, z, { weapon: Math.random() < 0.5 ? 'smg' : 'shotgun' }));
        },
        objectiveFn: (n) => `Schalte Rasks Leibwache aus (${n} übrig).`,
      }),
      S.dialog([['rask', 'Varga! Du hast mein Geld genommen. Jetzt nehme ich dir alles!', 'Varga! You took my money. Now I\'ll take everything from you!']]),
      S.killAll((c) => [c.data.boss], {
        checkpoint: true,
        onStart(c) {
          const b = M.spawnEnemy(c, 'rust', 700, -420, { weapon: 'rifle', health: 1200, accuracyMul: 1.4, boss: true });
          b.armor = 100;
          b.boss = true;
          b.model.root.scale.setScalar(1.15);
          b.model.setShirt(0x111111);
          c.data.boss = b;
          c.data.phase = 1;
          c.track(makeArrowFor(game, b));
          for (let i = 0; i < 3; i++) c.data.guards.push(M.spawnEnemy(c, 'rust', 690 + i * 8, -430, { weapon: 'pistol' }));
        },
        check(c) {
          const b = c.data.boss;
          M.objective(`Besiege Viktor Rask – ${Math.max(0, Math.round(b.health / b.maxHealth * 100))}%`);
          if (c.data.phase === 1 && b.health < b.maxHealth * 0.5) {
            c.data.phase = 2;
            b.say('Genug gespielt! Holt den Raketenwerfer!', 3);
            b.give('rocket', 99);
            for (let i = 0; i < 4; i++) M.spawnEnemy(c, 'rust', 640 + i * 20, -440, { weapon: 'smg' });
          }
          return false;
        },
      }),
      S.dialog([
        ['theo', 'Es ist vorbei, Mika. Die Rostschlangen sind Geschichte.', 'It\'s over, Mika. The Rust Snakes are history.'],
        ['rami', 'Port Aurelia gehört jetzt dir. Was machst du als Nächstes?', 'Port Aurelia is yours now. What are you going to do next?'],
        ['mika', 'Erst mal … eine Runde mit dem Velox an den Strand.', 'First … a ride to the beach in the Velox.'],
      ]),
    ],
  });
}

/** Pfeil über einem Ziel als Missions-Entität. */
function makeArrowFor(game, target) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9, depthWrite: false }));
  mesh.rotation.x = Math.PI;
  game.scene.add(mesh);
  return { mesh, target, isArrow: true, remove: () => game.scene.remove(mesh) };
}

// ---------------------------------------------------------------------- Schleichstufe
function stealthStage(game, M, { docs, exitTest }) {
  const PATROLS = [
    [[400, -620], [560, -620]], [[440, -700], [440, -780]], [[520, -660], [600, -660], [600, -720]], [[470, -610], [470, -690]],
    [[650, -640], [760, -640]], [[540, -820], [700, -820]], [[400, -760], [520, -760]],
  ];
  const coneMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  return {
    objective: 'Hol die Lieferlisten aus der Kaserne – unentdeckt!',
    checkpoint: true,
    start(c) {
      c.data.guards = [];
      c.data.phase = 'in';
      c.data.sus = 0;
      PATROLS.forEach((route, i) => {
        const [x, z] = route[0];
        const g = M.spawnNPC(c, 'soldier', x, z);
        g.give('rifle', 999);
        g.route = route; g.wp = 1; g.missionTarget = true;
        const cone = new THREE.Mesh(new THREE.CircleGeometry(20, 16, -0.45, 0.9), coneMat(0xffd23f));
        cone.rotation.x = -Math.PI / 2;
        game.scene.add(cone);
        g.cone = cone;
        c.track({ isMarker: true, mesh: cone, remove: () => game.scene.remove(cone) });
        g.brain = { update: (n) => {
          if (c.data.alarm) return;
          const t = n.route[n.wp];
          if (Math.hypot(t[0] - n.pos.x, t[1] - n.pos.z) < 1) n.wp = (n.wp + 1) % n.route.length;
          n.goTo(t[0], t[1], 1.3);
        } };
        c.data.guards.push(g);
        void i;
      });
      c.data.docM = c.track(makeMarker(game, docs, { radius: 1.2, color: 0x5ac8fa }));
      M.setWaypoint(docs);
      c.data.offShot = events.on('weapon:fired', (e) => { if (e.shooter && e.shooter.isPlayer && e.weapon !== 'knife') c.data.loud = true; });
    },
    update(c, dt) {
      const p = game.player;
      const night = game.tod.night;
      let maxSus = 0;
      for (const g of c.data.guards) {
        if (g.dead) { g.cone.visible = false; continue; }
        g.cone.position.set(g.pos.x, g.pos.y + 0.15, g.pos.z);
        g.cone.rotation.z = g.heading - Math.PI / 2;
        const range = 20 * (p.crouch ? 0.55 : 1) * (1 - night * 0.3) * ((p.speed || 0) > 6 ? 1.3 : 1);
        const dx = p.pos.x - g.pos.x, dz = p.pos.z - g.pos.z;
        const d = Math.hypot(dx, dz);
        const ang = Math.abs(((Math.atan2(dx, dz) - g.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        let seeing = d < range && ang < 0.5 && g.canSee(p.pos, range);
        if (d < 2.2) seeing = true; // zu nah: bemerkt
        if (seeing) g.sus = (g.sus || 0) + dt * (1.2 + (range - d) / range * 2.5); else g.sus = Math.max(0, (g.sus || 0) - dt * 0.5);
        maxSus = Math.max(maxSus, g.sus);
        g.cone.material.color.setHex(g.sus > 0.5 ? 0xff3b30 : g.sus > 0.05 ? 0xff9500 : 0xffd23f);
        if (g.sus >= 1) { c.data.alarm = true; g.say('Eindringling!', 2); }
      }
      game.hud.progress(maxSus > 0.02 ? 'Entdeckung' : null, Math.min(1, maxSus));
      if (c.data.loud) return 'fail:Ein Schuss hat die Wachen alarmiert.';
      if (c.data.alarm) return 'fail:Du wurdest entdeckt!';
      if (c.data.phase === 'in') {
        M.objective('Hol die Lieferlisten aus der Kaserne – unentdeckt! (Ducken: C)');
        if (Math.hypot(p.pos.x - docs.x, p.pos.z - docs.z) < 1.8) { c.data.phase = 'out'; c.data.docM.remove(); game.hud.notify('Lieferlisten eingesteckt'); M.setWaypoint({ x: 372, z: -690 }); }
      } else {
        M.objective('Verlass die Basis, ohne gesehen zu werden.');
        if (exitTest(p.pos)) return true;
      }
      return false;
    },
    end(c) { game.hud.progress(null); if (c.data.offShot) c.data.offShot(); },
  };
}

export { MILITARY };
