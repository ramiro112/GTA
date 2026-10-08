// Zentraler Event-Bus (Publish/Subscribe).
// Systeme kommunizieren über benannte Events, statt sich direkt zu kennen.
// Beispiele: 'crime', 'vehicle:exploded', 'player:died', 'mission:complete'.

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /** Abonniert ein Event. Gibt eine Funktion zum Abmelden zurück. */
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.off(name, fn);
  }

  /** Abonniert ein Event genau einmal. */
  once(name, fn) {
    const off = this.on(name, (data) => { off(); fn(data); });
    return off;
  }

  off(name, fn) {
    const set = this.listeners.get(name);
    if (set) set.delete(fn);
  }

  emit(name, data) {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(data); } catch (err) { console.error(`[EventBus] Fehler in Listener für "${name}":`, err); }
    }
  }

  clear() { this.listeners.clear(); }
}

/** Globaler Bus für das Spiel. */
export const events = new EventBus();
