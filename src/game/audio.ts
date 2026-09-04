let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  ac();
}

export function setMuted(v: boolean) {
  muted = v;
  if (v && ctx) void ctx.suspend();
  else if (!v) ac();
}

export function blip(freq = 220, dur = 0.08) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.value = 0.04;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

/** Two low harbour blasts — the barge has left. */
export function foghorn() {
  const c = ac();
  if (!c) return;
  const now = c.currentTime;
  const blast = (at: number, freq: number, dur: number) => {
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, at);
    o.frequency.linearRampToValueAtTime(freq * 0.9, at + dur);
    f.type = "lowpass";
    f.frequency.value = 380;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.07, at + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + dur + 0.05);
  };
  blast(now, 124, 0.9);
  blast(now + 1.05, 98, 1.15);
}
