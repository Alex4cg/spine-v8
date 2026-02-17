/**
 * Процедурные звуки для slot_5 через Web Audio API.
 * Без файлов, разблокировка контекста по первому клику.
 */
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

let _ctx = null;

function getContext() {
  if (!_ctx && AudioContextClass) {
    _ctx = new AudioContextClass();
  }
  return _ctx;
}

function ensureUnlocked() {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Воспроизводит короткий тон.
 * @param {number} frequency - Частота в Гц
 * @param {number} duration - Длительность в секундах
 * @param {string} type - Тип осциллятора: 'sine' | 'square' | 'sawtooth' | 'triangle'
 * @param {number} volume - Громкость 0..1
 * @param {number} startOffset - Задержка старта в секундах
 */
function playTone(frequency, duration, type = 'sine', volume = 0.15, startOffset = 0) {
  if (!SoundManager.enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

export const SoundManager = {
  enabled: true,

  playClick() {
    ensureUnlocked();
    playTone(900, 0.05, 'sine', 0.12);
  },

  playSpin() {
    ensureUnlocked();
    playTone(350, 0.12, 'sawtooth', 0.1);
    playTone(180, 0.14, 'sine', 0.08, 0.02);
  },

  playWin() {
    ensureUnlocked();
    playTone(523, 0.1, 'sine', 0.15);
    playTone(659, 0.1, 'sine', 0.14, 0.08);
    playTone(784, 0.12, 'sine', 0.13, 0.16);
  },

  playBomb() {
    ensureUnlocked();
    playTone(80, 0.25, 'sine', 0.2);
    playTone(60, 0.2, 'sawtooth', 0.08, 0.02);
  },

  playCascade() {
    ensureUnlocked();
    playTone(220, 0.08, 'sine', 0.1);
    playTone(180, 0.06, 'sine', 0.06, 0.04);
  },

  /** Тихий короткий стук при приземлении символа */
  playLanding() {
    ensureUnlocked();
    playTone(120, 0.03, 'sine', 0.06);
  },
};
