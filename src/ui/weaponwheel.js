// Waffenrad: Tab gedrückt halten, mit der Maus (oder Stick) eine Waffe wählen, loslassen.

import { tr } from '../core/i18n.js';
import { SLOT_COUNT } from '../weapons/weapondata.js';

export class WeaponWheel {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'wheel';
    this.el.className = 'hidden';
    root.appendChild(this.el);
    this.sel = 0;
    this.vx = 0; this.vy = 0;
  }

  open() {
    const inv = this.game.player.inventory;
    this.sel = inv.currentSlot;
    this.vx = 0; this.vy = 0;
    const R = 175;
    let html = '';
    for (let i = 0; i < SLOT_COUNT; i++) {
      const a = (i / SLOT_COUNT) * Math.PI * 2 - Math.PI / 2;
      const x = 230 + Math.cos(a) * R, y = 230 + Math.sin(a) * R;
      const w = inv.slots[i];
      html += `<div class="seg ${w ? '' : 'none'} ${i === this.sel ? 'sel' : ''}" data-i="${i}" style="left:${x}px;top:${y}px"><span class="ic">${w ? w.def.icon : '·'}</span>${w ? tr(w.def.name) : ''}${w && w.def.type !== 'melee' ? `<br>${w.mag}/${w.ammo}` : ''}</div>`;
    }
    html += `<div class="center">${tr(inv.slots[this.sel]?.def.name || '')}</div>`;
    this.el.innerHTML = html;
    this.el.classList.remove('hidden');
    this.game.timeScaleBefore = this.game.loop.timeScale;
    this.game.loop.timeScale = 0.25; // Zeitlupe wie im Vorbild
  }

  update(input) {
    // Mausbewegung bestimmt die Richtung
    this.vx += input.mouseDX; this.vy += input.mouseDY;
    if (input.pad) { this.vx += input.padAxes[2] * 30; this.vy += input.padAxes[3] * 30; }
    input.mouseDX = input.mouseDY = 0;
    const len = Math.hypot(this.vx, this.vy);
    if (len > 40) {
      const a = Math.atan2(this.vy, this.vx) + Math.PI / 2;
      let i = Math.round((a / (Math.PI * 2)) * SLOT_COUNT);
      i = ((i % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT;
      if (this.game.player.inventory.slots[i]) this.sel = i;
      if (len > 120) { this.vx *= 120 / len; this.vy *= 120 / len; }
    }
    [...this.el.querySelectorAll('.seg')].forEach((s) => s.classList.toggle('sel', +s.dataset.i === this.sel));
    const w = this.game.player.inventory.slots[this.sel];
    this.el.querySelector('.center').textContent = w ? tr(w.def.name) : '';
  }

  close() {
    this.el.classList.add('hidden');
    this.game.loop.timeScale = this.game.timeScaleBefore || 1;
    return this.sel;
  }
}
