// Speicherfreigabe für Three.js-Objekte: Geometrien und Materialien eines entfernten Objekts
// freigeben (GPU-Speicher). Geteilte Ressourcen (Caches) tragen userData.shared und bleiben erhalten.

/** Ressource als geteilt markieren (wird von disposeTree nie freigegeben). */
export function markShared(res) {
  if (res) res.userData.shared = true;
  return res;
}

/** Gibt alle nicht geteilten Geometrien/Materialien (inkl. Texturen) eines Teilbaums frei. */
export function disposeTree(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (m.userData.shared) continue;
        if (m.map && !m.map.userData?.shared) m.map.dispose();
        m.dispose();
      }
    }
    if (o.isLight && o.dispose) o.dispose();
  });
}
