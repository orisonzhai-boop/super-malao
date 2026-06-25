// Web Audio SFX synthesized at runtime — no audio asset files.
export function createAudio() {
  let ctx = null;
  let muted = false;
  const ensure = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function beep(freq, dur, type = 'square', slideTo = null) {
    if (muted) return;
    const ac = ensure();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(0.08, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }
  return {
    jump: () => beep(300, 0.18, 'square', 720),
    coin: () => { beep(880, 0.07, 'square'); setTimeout(() => beep(1320, 0.12, 'square'), 70); },
    stomp: () => beep(180, 0.12, 'sawtooth', 70),
    death: () => beep(520, 0.5, 'triangle', 70),
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'square'), i * 140)),
    toggleMute: () => { muted = !muted; return muted; },
    isMuted: () => muted,
  };
}
