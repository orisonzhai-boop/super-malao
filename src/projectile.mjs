import { isSolid } from './level.mjs';

export const PROJECTILE_SPEED = 11;
export const PROJECTILE_W = 16;
export const PROJECTILE_H = 16;
export const ATTACK_COOLDOWN = 10; // frames between shots (~0.17s) — snappy rapid fire
export const MAX_PROJECTILES = 5;

export function makeProjectile(x, y, dir) {
  return { x, y, w: PROJECTILE_W, h: PROJECTILE_H, vx: (dir < 0 ? -1 : 1) * PROJECTILE_SPEED, alive: true };
}

// Advance one step; despawn (alive=false) if the center enters a solid tile. Mutates.
export function stepProjectile(proj, level) {
  if (!proj.alive) return proj;
  proj.x += proj.vx;
  const t = level.tile;
  const cc = Math.floor((proj.x + proj.w / 2) / t);
  const cr = Math.floor((proj.y + proj.h / 2) / t);
  if (isSolid(level, cc, cr)) proj.alive = false;
  return proj;
}

// AABB overlap of two {x,y,w,h} boxes.
export function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
