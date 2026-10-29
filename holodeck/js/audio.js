// Original WebAudio chirps — no samples, no franchise sounds.

let ctx = null;

export function ensureAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.08, when = 0) {
  const a = ensureAudio(); if (!a) return;
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/** Soft acknowledge chirp */
export function chirpOk() {
  tone(880, 0.06, 'sine', 0.07);
  tone(1320, 0.08, 'sine', 0.05, 0.07);
}

/** Error / unable */
export function chirpNo() {
  tone(220, 0.12, 'triangle', 0.08);
  tone(180, 0.14, 'triangle', 0.06, 0.1);
}

/** Program start / dissolve */
export function chirpLoad() {
  tone(440, 0.05, 'sine', 0.05);
  tone(660, 0.05, 'sine', 0.05, 0.06);
  tone(990, 0.1, 'sine', 0.06, 0.12);
}

/** Soft ambient tick for freeze */
export function chirpFreeze() {
  tone(520, 0.15, 'sine', 0.04);
}

export function speak(text, enabled = true) {
  if (!enabled || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 140));
    u.rate = 1.05;
    u.pitch = 0.9;
    u.volume = 0.85;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
