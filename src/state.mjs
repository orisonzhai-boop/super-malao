export function initialGame() {
  return { phase: 'TITLE', score: 0, coins: 0, lives: 3 };
}

// Pure reducer. event: { type: 'start'|'coin'|'stomp'|'death'|'respawn'|'win'|'reset' }
export function reduce(state, event) {
  const s = { ...state };
  switch (event.type) {
    case 'start':
      if (s.phase === 'TITLE' || s.phase === 'GAMEOVER') {
        return { ...initialGame(), phase: 'PLAYING' };
      }
      break;
    case 'coin':
      if (s.phase === 'PLAYING') { s.coins += 1; s.score += 100; }
      break;
    case 'stomp':
      if (s.phase === 'PLAYING') { s.score += 200; }
      break;
    case 'bossHit':
      if (s.phase === 'PLAYING') { s.score += 300; }
      break;
    case 'death':
      if (s.phase === 'PLAYING') {
        s.lives -= 1;
        s.phase = s.lives <= 0 ? 'GAMEOVER' : 'DEAD';
      }
      break;
    case 'respawn':
      if (s.phase === 'DEAD') s.phase = 'PLAYING';
      break;
    case 'win':
      if (s.phase === 'PLAYING') s.phase = 'WIN';
      break;
    case 'reset':
      return initialGame();
  }
  return s;
}
