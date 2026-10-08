// Objekt-Pool: vermeidet ständiges Erzeugen/Verwerfen von Objekten
// (Projektile, Partikel, Passanten, Autos) und damit Garbage-Collector-Ruckler.

export class ObjectPool {
  /**
   * @param {() => any} factory  erzeugt ein neues Objekt
   * @param {(obj:any) => void} [reset]  setzt ein Objekt beim Zurückgeben zurück
   * @param {number} [max]  maximale Anzahl aktiver Objekte (Infinity = unbegrenzt)
   */
  constructor(factory, reset = () => {}, max = Infinity) {
    this.factory = factory;
    this.reset = reset;
    this.max = max;
    this.free = [];
    this.active = new Set();
    this.created = 0;
  }

  /** Holt ein Objekt aus dem Pool (oder erzeugt eins). Gibt null zurück, wenn max erreicht. */
  acquire() {
    if (this.active.size >= this.max) return null;
    const obj = this.free.length ? this.free.pop() : (this.created++, this.factory());
    this.active.add(obj);
    return obj;
  }

  /** Gibt ein Objekt zurück in den Pool. */
  release(obj) {
    if (!this.active.has(obj)) return;
    this.active.delete(obj);
    this.reset(obj);
    this.free.push(obj);
  }

  releaseAll() {
    for (const obj of [...this.active]) this.release(obj);
  }

  get activeCount() { return this.active.size; }
  get freeCount() { return this.free.length; }
}
