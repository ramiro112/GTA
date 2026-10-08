// Zentrale Eingabeverwaltung.
// Spiel-Code fragt AKTIONEN ab (z. B. 'jump'), nie konkrete Tasten. Die Belegung ist frei
// änderbar (Einstellungen → Steuerung) und wird gespeichert. Gamepad (Standard-Mapping) wird
// zusätzlich auf dieselben Aktionen abgebildet.

/** Standardbelegung: Aktion → Liste von Codes (KeyboardEvent.code, 'Mouse0/1/2', 'WheelUp/Down'). */
export const DEFAULT_BINDINGS = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft'],
  jump: ['Space'],
  crouch: ['KeyC'],
  enterVehicle: ['KeyF'],
  interact: ['KeyE'],
  attack: ['Mouse0'],
  aim: ['Mouse2'],
  reload: ['KeyR'],
  cover: ['KeyQ'],
  weaponWheel: ['Tab'],
  weaponNext: ['WheelDown'],
  weaponPrev: ['WheelUp'],
  handbrake: ['Space'],
  horn: ['KeyH'],
  lights: ['KeyL'],
  siren: ['KeyK'],
  radio: ['KeyN'],
  camera: ['KeyV'],
  lookBehind: ['KeyB'],
  resetVehicle: ['KeyX'],
  // Luftfahrzeuge
  throttleUp: ['ShiftLeft'],
  throttleDown: ['ControlLeft'],
  yawLeft: ['KeyQ'],
  yawRight: ['KeyE'],
  gear: ['KeyG'],
  flaps: ['KeyJ'],
  fireSecondary: ['Mouse2'],
  parachute: ['Space'],
  // Menüs
  map: ['KeyM'],
  phone: ['KeyP'],
  inventory: ['KeyI'],
  pause: ['Escape'],
  missionLog: ['KeyO'],
  debugFps: ['F3'],
};

for (let i = 1; i <= 10; i++) DEFAULT_BINDINGS['weapon' + (i % 10)] = ['Digit' + (i % 10)];

/** Gamepad-Standard-Mapping (feste Zuordnung, in README dokumentiert). */
const PAD_BUTTONS = {
  0: ['jump', 'handbrake', 'parachute'], // A
  1: ['crouch', 'reload'],               // B
  2: ['interact'],                       // X
  3: ['enterVehicle'],                   // Y
  4: ['weaponPrev', 'cover', 'yawLeft'],  // LB
  5: ['weaponNext', 'horn', 'yawRight'],  // RB
  6: ['aim', 'fireSecondary'],           // LT
  7: ['attack'],                         // RT
  8: ['map'],                            // Back/View
  9: ['pause'],                          // Start/Menu
  10: ['sprint'],                        // L3
  11: ['camera'],                        // R3
  12: ['phone'],                         // D-Pad hoch
  13: ['weaponWheel'],                   // D-Pad runter
  14: ['radio'],                         // D-Pad links
  15: ['lights', 'gear'],                // D-Pad rechts
};

const KEY_LABELS = {
  Space: 'Leertaste', ShiftLeft: 'Shift', ShiftRight: 'Shift R', ControlLeft: 'Strg', ControlRight: 'Strg R',
  AltLeft: 'Alt', Tab: 'Tab', Escape: 'Esc', Enter: 'Enter', Backspace: '⌫',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'Maus L', Mouse1: 'Maus M', Mouse2: 'Maus R', WheelUp: 'Rad ↑', WheelDown: 'Rad ↓',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

export class InputManager {
  constructor() {
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.codesDown = new Set();
    this.codesPressed = new Set();
    this.codesReleased = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.pointerLocked = false;
    this.enabled = true;          // false = Menü offen, Spiel ignoriert Eingaben
    this.pad = null;              // aktueller Gamepad-Snapshot
    this.padPrev = new Set();
    this.padDown = new Set();
    this.padPressed = new Set();
    this.padAxes = [0, 0, 0, 0];
    this.padTriggers = [0, 0];
    this.sensitivity = 1;
    this.invertY = false;
    this.onAnyKey = null;          // Callback für Tastenbelegung (Rebind)
    this._rebuildLookup();
  }

  attach(target = window, canvas = null) {
    this.canvas = canvas;
    target.addEventListener('keydown', (e) => {
      if (this.onAnyKey) { e.preventDefault(); this.onAnyKey(e.code); return; }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F3'].includes(e.code)) e.preventDefault();
      if (e.ctrlKey && e.code === 'KeyW') e.preventDefault();
      if (!this.codesDown.has(e.code)) this.codesPressed.add(e.code);
      this.codesDown.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.codesDown.delete(e.code);
      this.codesReleased.add(e.code);
    });
    target.addEventListener('blur', () => this.codesDown.clear());
    const mouseTarget = canvas || target;
    mouseTarget.addEventListener('mousedown', (e) => {
      const code = 'Mouse' + e.button;
      if (this.onAnyKey) { this.onAnyKey(code); return; }
      this.codesDown.add(code);
      this.codesPressed.add(code);
    });
    target.addEventListener('mouseup', (e) => {
      const code = 'Mouse' + e.button;
      this.codesDown.delete(code);
      this.codesReleased.add(code);
    });
    target.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      // Sehr grosse Sprünge (Pointer-Lock-Wechsel, Browser-Fehler) ignorieren
      if (this.pointerLocked && Math.abs(e.movementX) < 300 && Math.abs(e.movementY) < 300) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    target.addEventListener('wheel', (e) => {
      const code = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
      if (this.onAnyKey) { this.onAnyKey(code); return; }
      this.codesPressed.add(code);
    }, { passive: true });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      this.mouseDX = this.mouseDY = 0;
      if (this.onPointerLockChange) this.onPointerLockChange(this.pointerLocked);
    });
  }

  requestPointerLock() {
    if (this.canvas && document.pointerLockElement !== this.canvas) {
      try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* ignorieren */ }
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setBindings(b) {
    this.bindings = { ...structuredClone(DEFAULT_BINDINGS), ...structuredClone(b || {}) };
    this._rebuildLookup();
  }

  rebind(action, code, slot = 0) {
    const list = this.bindings[action] ? [...this.bindings[action]] : [];
    list[slot] = code;
    this.bindings[action] = list.filter(Boolean);
    this._rebuildLookup();
  }

  resetBindings() { this.setBindings({}); }

  _rebuildLookup() {
    this.actionCodes = new Map();
    for (const [action, codes] of Object.entries(this.bindings)) this.actionCodes.set(action, codes);
  }

  /** Gamepad pro Frame einlesen. */
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.pad = pad;
    this.padPressed.clear();
    const now = new Set();
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      this.padAxes = [dz(pad.axes[0] || 0), dz(pad.axes[1] || 0), dz(pad.axes[2] || 0), dz(pad.axes[3] || 0)];
      this.padTriggers = [pad.buttons[6]?.value || 0, pad.buttons[7]?.value || 0];
      pad.buttons.forEach((b, i) => {
        if (b.pressed && PAD_BUTTONS[i]) for (const a of PAD_BUTTONS[i]) now.add(a);
      });
    } else {
      this.padAxes = [0, 0, 0, 0];
      this.padTriggers = [0, 0];
    }
    for (const a of now) if (!this.padPrev.has(a)) this.padPressed.add(a);
    this.padDown = now;
    this.padPrev = now;
  }

  get hasGamepad() { return !!this.pad; }

  down(action) {
    if (!this.enabled) return false;
    const codes = this.actionCodes.get(action);
    if (codes) for (const c of codes) if (this.codesDown.has(c)) return true;
    return this.padDown.has(action);
  }

  pressed(action) {
    if (!this.enabled) return false;
    const codes = this.actionCodes.get(action);
    if (codes) for (const c of codes) if (this.codesPressed.has(c)) return true;
    return this.padPressed.has(action);
  }

  /** Taste gedrückt – auch wenn das Spiel pausiert ist (für Menüs). */
  pressedRaw(action) {
    const codes = this.actionCodes.get(action);
    if (codes) for (const c of codes) if (this.codesPressed.has(c)) return true;
    return this.padPressed.has(action);
  }

  released(action) {
    if (!this.enabled) return false;
    const codes = this.actionCodes.get(action);
    if (codes) for (const c of codes) if (this.codesReleased.has(c)) return true;
    return false;
  }

  /** Bewegungsachsen (-1..1): x = rechts, y = vorwärts. */
  moveAxes() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = (this.down('moveRight') ? 1 : 0) - (this.down('moveLeft') ? 1 : 0);
    let y = (this.down('moveForward') ? 1 : 0) - (this.down('moveBack') ? 1 : 0);
    if (this.pad) {
      if (Math.abs(this.padAxes[0]) > Math.abs(x)) x = this.padAxes[0];
      if (Math.abs(this.padAxes[1]) > Math.abs(y)) y = -this.padAxes[1];
    }
    return { x, y };
  }

  /** Kamera-Drehung seit letztem Frame (Maus + rechter Stick). */
  lookDelta(dt) {
    if (!this.enabled) { this.mouseDX = this.mouseDY = 0; return { x: 0, y: 0 }; }
    const s = 0.0025 * this.sensitivity;
    let x = this.mouseDX * s;
    let y = this.mouseDY * s;
    if (this.pad) { x += this.padAxes[2] * 2.6 * dt * this.sensitivity; y += this.padAxes[3] * 2.0 * dt * this.sensitivity; }
    if (this.invertY) y = -y;
    this.mouseDX = this.mouseDY = 0;
    return { x, y };
  }

  /** Analoge Werte für Fahrzeuge: Gas/Bremse 0..1 (Trigger oder Tasten). */
  analog(action) {
    if (!this.enabled) return 0;
    let v = this.down(action) ? 1 : 0;
    if (this.pad) {
      if (action === 'attack') v = Math.max(v, this.padTriggers[1]);
      if (action === 'aim') v = Math.max(v, this.padTriggers[0]);
    }
    return v;
  }

  /** Am Frame-Ende aufrufen. */
  endFrame() {
    this.codesPressed.clear();
    this.codesReleased.clear();
  }

  labelFor(action) {
    const codes = this.bindings[action] || [];
    return codes.length ? keyLabel(codes[0]) : '—';
  }
}

export const input = new InputManager();
