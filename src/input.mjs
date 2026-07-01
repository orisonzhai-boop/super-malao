// Returns a live keys object mutated by keyboard events.
export function createInput() {
  const keys = { left: false, right: false, jump: false, start: false, restart: false, mute: false, attack: false };
  const map = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
    Enter: 'start', KeyR: 'restart', KeyM: 'mute', KeyJ: 'attack',
  };
  const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  window.addEventListener('keydown', (e) => {
    const k = map[e.code];
    if (k) { keys[k] = true; if (prevent.has(e.code)) e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { const k = map[e.code]; if (k) keys[k] = false; });
  return keys;
}
