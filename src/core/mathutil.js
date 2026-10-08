// Mathematische Hilfsfunktionen ohne Three.js-Abhängigkeit (testbar in Node).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const sign = (v) => (v < 0 ? -1 : 1);
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const approach = (cur, target, step) => (cur < target ? Math.min(cur + step, target) : Math.max(cur - step, target));

/** Winkel auf (-PI, PI] normalisieren. */
export function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Kürzeste Winkeldifferenz von a nach b. */
export const angleDiff = (a, b) => wrapAngle(b - a);

/** Exponentielle Glättung unabhängig von der Framerate. */
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

/** Abstand eines Punktes zu einem Segment (2D, xz). Liefert {d, t, x, z}. */
export function pointSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
  const x = ax + dx * t, z = az + dz * t;
  return { d: Math.hypot(px - x, pz - z), t, x, z };
}

/** Formatiert Geld als "$1.234". */
export function formatMoney(v) {
  const s = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-$' : '$') + s;
}

/** Formatiert Sekunden als m:ss. */
export function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
