import { TILE } from './level.mjs';

export const BOSS_W = 48;
export const BOSS_H = 60;
export const BOSS_HP = 3;
export const BOSS_SPEED = 1.5;
export const BOSS_INVULN = 30;      // frames of i-frames after a hit
export const BOSS_ARENA_HALF = 4 * TILE;

export function makeBoss(col, row) {
  const x = col * TILE;
  const y = row * TILE + (TILE - BOSS_H); // bottom rests on the ground row below
  return {
    x, y, w: BOSS_W, h: BOSS_H,
    vx: -BOSS_SPEED, dir: -1, hp: BOSS_HP, alive: true, invuln: 0,
    arenaMin: x - BOSS_ARENA_HALF, arenaMax: x + BOSS_ARENA_HALF,
  };
}

// Pace within the arena, turning at bounds; tick down i-frames. Mutates.
export function stepBoss(boss) {
  if (!boss.alive) return boss;
  if (boss.invuln > 0) boss.invuln--;
  boss.x += boss.vx;
  if (boss.x <= boss.arenaMin) { boss.x = boss.arenaMin; boss.vx = Math.abs(boss.vx); }
  else if (boss.x + boss.w >= boss.arenaMax) { boss.x = boss.arenaMax - boss.w; boss.vx = -Math.abs(boss.vx); }
  boss.dir = Math.sign(boss.vx) || boss.dir;
  return boss;
}

// Apply one hit unless invulnerable/dead. Returns true if the hit landed.
export function damageBoss(boss) {
  if (!boss.alive || boss.invuln > 0) return false;
  boss.hp--;
  boss.invuln = BOSS_INVULN;
  if (boss.hp <= 0) boss.alive = false;
  return true;
}
