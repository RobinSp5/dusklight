// Player settings, persisted in localStorage (falls back to defaults when storage is blocked).
const KEY = 'dusklight.settings.v1';

export const DEFAULTS = {
  master: 80,
  music: 60,
  sfx: 80,
  muted: false,
  shake: true,
  reducedFx: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  showTimer: true,
};

const clampVol = (v, d) => (Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : d);

export function loadSettings() {
  const s = { ...DEFAULTS };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      for (const k of ['master', 'music', 'sfx']) s[k] = clampVol(raw[k], DEFAULTS[k]);
      for (const k of ['muted', 'shake', 'reducedFx', 'showTimer']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
    } else if (localStorage.getItem('zwielicht.mute') === '1') {
      s.muted = true; // carry over the mute flag from the first version
    }
  } catch { /* storage unavailable */ }
  return s;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
