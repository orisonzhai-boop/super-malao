import { isSolid, TILE } from './level.mjs';

export function makeEnemy(x, y) {
  // y is the top of the tile the enemy stands in; rest it on the tile floor below.
  const h = 24, w = 28;
  return { x, y: y + (TILE - h), w, h, vx: -1.2, dir: -1, alive: true };
}

// Patrol horizontally; reverse at walls and at ledges (no ground ahead). Mutates enemy.
export function stepEnemy(enemy, level) {
  if (!enemy.alive) return enemy;
  const t = level.tile;
  enemy.x += enemy.vx;

  const aheadX = enemy.vx > 0 ? enemy.x + enemy.w : enemy.x;
  const col = Math.floor(aheadX / t);
  const rowMid = Math.floor((enemy.y + enemy.h / 2) / t);
  if (isSolid(level, col, rowMid)) {
    enemy.x -= enemy.vx;        // back out of the wall
    enemy.vx = -enemy.vx;
  }

  const footCol = enemy.vx > 0 ? Math.floor((enemy.x + enemy.w) / t) : Math.floor(enemy.x / t);
  const belowRow = Math.floor((enemy.y + enemy.h + 1) / t);
  if (!isSolid(level, footCol, belowRow)) enemy.vx = -enemy.vx;

  enemy.dir = Math.sign(enemy.vx) || enemy.dir;
  return enemy;
}

// Returns 'stomp' | 'hit' | null.
export function stompCheck(player, enemy) {
  if (!enemy.alive) return null;
  const overlap =
    player.x < enemy.x + enemy.w && player.x + player.w > enemy.x &&
    player.y < enemy.y + enemy.h && player.y + player.h > enemy.y;
  if (!overlap) return null;
  const playerFeet = player.y + player.h;
  if (player.vy > 0 && playerFeet - enemy.y < enemy.h * 0.7) return 'stomp';
  return 'hit';
}
