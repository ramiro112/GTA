// Übersetzungen Deutsch / Englisch. t('key', {param}) liefert den Text in der aktuellen Sprache.

const STRINGS = {
  de: {
    'menu.new': 'Neues Spiel', 'menu.continue': 'Fortsetzen', 'menu.load': 'Laden', 'menu.settings': 'Einstellungen',
    'menu.controls': 'Steuerung', 'menu.credits': 'Mitwirkende & Lizenzen', 'menu.resume': 'Weiter', 'menu.save': 'Speichern',
    'menu.quit': 'Hauptmenü', 'menu.back': 'Zurück', 'menu.map': 'Karte', 'menu.stats': 'Statistik', 'menu.missions': 'Missionen',
    'menu.inventory': 'Inventar', 'menu.paused': 'PAUSE', 'menu.clickToPlay': 'Klicken zum Spielen',
    'loading.title': 'Lade Port Aurelia …', 'loading.done': 'Bereit',
    'settings.graphics': 'Grafik', 'settings.quality': 'Qualität', 'settings.low': 'Niedrig', 'settings.medium': 'Mittel', 'settings.high': 'Hoch',
    'settings.drawDistance': 'Sichtweite', 'settings.audio': 'Ton', 'settings.master': 'Gesamt', 'settings.sfx': 'Effekte', 'settings.music': 'Musik/Radio',
    'settings.controls': 'Steuerung', 'settings.sensitivity': 'Mausempfindlichkeit', 'settings.invertY': 'Y-Achse invertieren',
    'settings.autoAim': 'Zielhilfe (Auto-Aim)', 'settings.flightMode': 'Flugmodell', 'settings.arcade': 'Arcade', 'settings.sim': 'Simulation',
    'settings.language': 'Sprache', 'settings.rebind': 'Taste drücken …', 'settings.reset': 'Standard', 'settings.showFps': 'FPS anzeigen',
    'settings.subtitles': 'Untertitel', 'settings.voice': 'Sprachausgabe (TTS)',
    'hud.wanted': 'Fahndung', 'hud.enter': '{key} – Einsteigen', 'hud.steal': '{key} – Auto aufbrechen', 'hud.jack': '{key} – Fahrer herausziehen',
    'hud.interact': '{key} – {what}', 'hud.hotwire': 'Kurzschliessen …', 'hud.wasted': 'SCHWER VERLETZT', 'hud.busted': 'VERHAFTET',
    'hud.missionPassed': 'MISSION ERFÜLLT', 'hud.missionFailed': 'MISSION GESCHEITERT', 'hud.reward': 'Belohnung: {money}',
    'hud.saved': 'Spiel gespeichert', 'hud.fuel': 'Tank', 'hud.alt': 'Höhe', 'hud.spd': 'Tempo', 'hud.vs': 'Steigen', 'hud.hdg': 'Kompass', 'hud.att': 'Nick / Roll', 'hud.cond': 'Zustand', 'hud.refuel': 'Tanken …', 'hud.cockpit': 'Cockpit',
    'hud.gear': 'Fahrwerk', 'hud.flaps': 'Klappen', 'hud.throttle': 'Schub', 'hud.up': 'EIN', 'hud.down': 'AUS', 'hud.reload': 'Nachladen …',
    'hud.restartCheckpoint': '{key} – Vom Checkpoint neu starten', 'hud.stuntJump': 'STUNT-SPRUNG!', 'hud.newArea': '{name}',
    'hud.noMoney': 'Nicht genug Geld', 'hud.bought': 'Gekauft: {item}', 'hud.alarm': 'Autoalarm!', 'hud.locked': 'Abgeschlossen – Scheibe eingeschlagen',
    'phone.title': 'Handy', 'phone.contacts': 'Kontakte', 'phone.missions': 'Missionen', 'phone.taxi': 'Taxi rufen', 'phone.fasttravel': 'Schnellreise',
    'phone.close': 'Schliessen', 'phone.weather': 'Wetter', 'phone.cheats': 'Testmenü',
    'map.title': 'Karte von Port Aurelia', 'map.waypoint': 'Rechtsklick/Klick: Wegpunkt setzen',
    'shop.buy': 'Kaufen', 'shop.close': 'Verlassen', 'shop.owned': 'Besitzt du', 'shop.ammo': 'Munition',
    'tut.move': 'Bewege dich mit {up}{left}{down}{right}, schaue mit der Maus. {sprint} = Sprinten.',
    'tut.jump': '{jump} = Springen / Klettern, {crouch} = Ducken.',
    'tut.car': 'Gehe zu einem Auto und drücke {enter} zum Einsteigen (oder Stehlen).',
    'tut.map': '{map} = Karte, {phone} = Handy, {pause} = Pause/Einstellungen.',
    'tut.mission': 'Gelbe Markierungen auf der Karte sind Missionen. Gehe hin, um sie zu starten.',
    'tut.weapons': '{wheel} = Waffenrad, Maus rechts = Zielen, Maus links = Schiessen.',
  },
  en: {
    'menu.new': 'New Game', 'menu.continue': 'Continue', 'menu.load': 'Load', 'menu.settings': 'Settings',
    'menu.controls': 'Controls', 'menu.credits': 'Credits & Licenses', 'menu.resume': 'Resume', 'menu.save': 'Save',
    'menu.quit': 'Main Menu', 'menu.back': 'Back', 'menu.map': 'Map', 'menu.stats': 'Stats', 'menu.missions': 'Missions',
    'menu.inventory': 'Inventory', 'menu.paused': 'PAUSED', 'menu.clickToPlay': 'Click to play',
    'loading.title': 'Loading Port Aurelia …', 'loading.done': 'Ready',
    'settings.graphics': 'Graphics', 'settings.quality': 'Quality', 'settings.low': 'Low', 'settings.medium': 'Medium', 'settings.high': 'High',
    'settings.drawDistance': 'Draw distance', 'settings.audio': 'Audio', 'settings.master': 'Master', 'settings.sfx': 'Effects', 'settings.music': 'Music/Radio',
    'settings.controls': 'Controls', 'settings.sensitivity': 'Mouse sensitivity', 'settings.invertY': 'Invert Y axis',
    'settings.autoAim': 'Aim assist', 'settings.flightMode': 'Flight model', 'settings.arcade': 'Arcade', 'settings.sim': 'Simulation',
    'settings.language': 'Language', 'settings.rebind': 'Press a key …', 'settings.reset': 'Default', 'settings.showFps': 'Show FPS',
    'settings.subtitles': 'Subtitles', 'settings.voice': 'Voice output (TTS)',
    'hud.wanted': 'Wanted', 'hud.enter': '{key} – Enter', 'hud.steal': '{key} – Break in', 'hud.jack': '{key} – Pull driver out',
    'hud.interact': '{key} – {what}', 'hud.hotwire': 'Hotwiring …', 'hud.wasted': 'WASTED', 'hud.busted': 'BUSTED',
    'hud.missionPassed': 'MISSION PASSED', 'hud.missionFailed': 'MISSION FAILED', 'hud.reward': 'Reward: {money}',
    'hud.saved': 'Game saved', 'hud.fuel': 'Fuel', 'hud.alt': 'Alt', 'hud.spd': 'Speed', 'hud.vs': 'V/S', 'hud.hdg': 'Compass', 'hud.att': 'Pitch / Roll', 'hud.cond': 'Condition', 'hud.refuel': 'Refuelling …', 'hud.cockpit': 'Cockpit',
    'hud.gear': 'Gear', 'hud.flaps': 'Flaps', 'hud.throttle': 'Throttle', 'hud.up': 'UP', 'hud.down': 'DOWN', 'hud.reload': 'Reloading …',
    'hud.restartCheckpoint': '{key} – Restart from checkpoint', 'hud.stuntJump': 'STUNT JUMP!', 'hud.newArea': '{name}',
    'hud.noMoney': 'Not enough money', 'hud.bought': 'Bought: {item}', 'hud.alarm': 'Car alarm!', 'hud.locked': 'Locked – window smashed',
    'phone.title': 'Phone', 'phone.contacts': 'Contacts', 'phone.missions': 'Missions', 'phone.taxi': 'Call taxi', 'phone.fasttravel': 'Fast travel',
    'phone.close': 'Close', 'phone.weather': 'Weather', 'phone.cheats': 'Test menu',
    'map.title': 'Map of Port Aurelia', 'map.waypoint': 'Click: set waypoint',
    'shop.buy': 'Buy', 'shop.close': 'Leave', 'shop.owned': 'Owned', 'shop.ammo': 'Ammo',
    'tut.move': 'Move with {up}{left}{down}{right}, look with the mouse. {sprint} = sprint.',
    'tut.jump': '{jump} = jump / climb, {crouch} = crouch.',
    'tut.car': 'Walk up to a car and press {enter} to get in (or steal it).',
    'tut.map': '{map} = map, {phone} = phone, {pause} = pause/settings.',
    'tut.mission': 'Yellow markers on the map are missions. Walk into one to start it.',
    'tut.weapons': '{wheel} = weapon wheel, right mouse = aim, left mouse = shoot.',
  },
};

let lang = 'de';

export function setLanguage(l) { if (STRINGS[l]) lang = l; }
export function getLanguage() { return lang; }

export function t(key, params = {}) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.de[key] || key;
  for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/** Wählt aus einem {de, en}-Objekt den passenden Text. */
export function tr(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.de ?? '';
}

/** Weitere Texte zur Laufzeit registrieren (z. B. Missionsdialoge). */
export function addStrings(l, dict) { Object.assign(STRINGS[l], dict); }
