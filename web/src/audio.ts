// Procedural Web Audio synthesis for the University Registrar & Academic Dossier Desk.
// Implemented strictly as plain exported functions (no class wrapper).

let sharedAudioCtx: AudioContext | null = null;
let acousticsEnabled = true;

function resolveAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!sharedAudioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      sharedAudioCtx = new Ctor();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function isBursarAcousticsActive(): boolean {
  return acousticsEnabled;
}

export function toggleBursarAcoustics(): boolean {
  acousticsEnabled = !acousticsEnabled;
  return acousticsEnabled;
}

/**
 * Fountain-pen nib click: crisp metallic nib contact against archival ledger paper.
 */
export function nibClick(baseFreqHz = 1180): void {
  if (!acousticsEnabled) return;
  try {
    const ctx = resolveAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;

    const nibOsc = ctx.createOscillator();
    const nibFilter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    nibOsc.type = 'triangle';
    nibOsc.frequency.setValueAtTime(baseFreqHz, t0);
    nibOsc.frequency.exponentialRampToValueAtTime(baseFreqHz * 0.42, t0 + 0.024);

    nibFilter.type = 'bandpass';
    nibFilter.frequency.setValueAtTime(1600, t0);
    nibFilter.Q.setValueAtTime(3.2, t0);

    amp.gain.setValueAtTime(0.075, t0);
    amp.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.026);

    nibOsc.connect(nibFilter);
    nibFilter.connect(amp);
    amp.connect(ctx.destination);

    nibOsc.start(t0);
    nibOsc.stop(t0 + 0.028);
  } catch {
    // Ignore browser autoplay restrictions
  }
}

/**
 * Wax seal thud: deep brass signet press into warm sealing wax on parchment.
 */
export function waxSealThud(): void {
  if (!acousticsEnabled) return;
  try {
    const ctx = resolveAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;

    // Low body impact
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(132, t0);
    bodyOsc.frequency.exponentialRampToValueAtTime(46, t0 + 0.19);

    bodyGain.gain.setValueAtTime(0.14, t0);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.21);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyOsc.start(t0);
    bodyOsc.stop(t0 + 0.22);

    // Subtle brass signet overtone
    const overtoneOsc = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtoneOsc.type = 'triangle';
    overtoneOsc.frequency.setValueAtTime(310, t0 + 0.015);
    overtoneOsc.frequency.exponentialRampToValueAtTime(165, t0 + 0.14);

    overtoneGain.gain.setValueAtTime(0.045, t0 + 0.015);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.15);

    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);
    overtoneOsc.start(t0 + 0.015);
    overtoneOsc.stop(t0 + 0.16);
  } catch {
    // Ignore browser autoplay restrictions
  }
}

/**
 * Warm acoustic chord chimes: collegiate bell triad confirming verified proof or grant award.
 */
export function bursarChordChime(rejected = false): void {
  if (!acousticsEnabled) return;
  try {
    const ctx = resolveAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;

    const notesHz = rejected
      ? [293.66, 277.18, 220.0] // Muted descending cadence for threshold rejection
      : [440.0, 554.37, 659.25, 880.0]; // Warm A-major collegiate chime

    notesHz.forEach((hz, idx) => {
      const startAt = t0 + idx * 0.055;
      const duration = rejected ? 0.18 : 0.34;

      const osc = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc.type = rejected ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(hz, startAt);

      toneGain.gain.setValueAtTime(0.001, startAt);
      toneGain.gain.linearRampToValueAtTime(rejected ? 0.04 : 0.058, startAt + 0.012);
      toneGain.gain.exponentialRampToValueAtTime(0.0009, startAt + duration);

      osc.connect(toneGain);
      toneGain.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + duration + 0.01);
    });
  } catch {
    // Ignore browser autoplay restrictions
  }
}
