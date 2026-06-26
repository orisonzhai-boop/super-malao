import { isSolid } from './level.mjs';

export const PHYS = {
  gravity: 0.8, maxFall: 14,
  accel: 0.8, decel: 1.1, maxRun: 4.5,
  jumpVel: -13, jumpCut: -5,
  coyote: 6, buffer: 6,
};

export function makePlayer(x, y) {
  return {
    x, y, w: 24, h: 58, vx: 0, vy: 0,
    onGround: false, facing: 1, coyote: 0, buffer: 0, jumpHeld: false,
    state: 'idle', justJumped: false,
  };
}

// Move box along one axis by delta and resolve against solid tiles.
// Picks the nearest blocking face so tall/wide boxes resolve correctly. Mutates box.
export function moveAxis(box, level, axis, delta) {
  if (delta === 0) return false;
  const t = level.tile;
  const from = box[axis];          // position before the move
  box[axis] += delta;              // tentative position after the move
  const to = box[axis];
  // Sweep: scan every cell the box overlaps anywhere between `from` and `to`,
  // so a large delta that overshoots a tile still resolves against it.
  const lo = Math.min(from, to), hi = Math.max(from, to);
  let c0, c1, r0, r1;
  if (axis === 'x') {
    c0 = Math.floor(lo / t); c1 = Math.floor((hi + box.w - 1) / t);
    r0 = Math.floor(box.y / t); r1 = Math.floor((box.y + box.h - 1) / t);
  } else {
    c0 = Math.floor(box.x / t); c1 = Math.floor((box.x + box.w - 1) / t);
    r0 = Math.floor(lo / t); r1 = Math.floor((hi + box.h - 1) / t);
  }
  let hit = false, best = null;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isSolid(level, c, r)) continue;
      hit = true;
      let edge;
      if (axis === 'x') edge = delta > 0 ? c * t - box.w : (c + 1) * t;
      else edge = delta > 0 ? r * t - box.h : (r + 1) * t;
      if (best === null) best = edge;
      else best = delta > 0 ? Math.min(best, edge) : Math.max(best, edge);
    }
  }
  if (hit) box[axis] = best;
  return hit;
}

// Row of the solid tile the player is resting on, or -1 if airborne.
// Probes the tile row just beneath the feet and requires the feet to be at/near
// that row's top, so a player resting on a tile boundary stays reliably grounded.
export function groundedRow(player, level) {
  if (player.vy < 0) return -1;            // moving up = not grounded
  const t = level.tile;
  const feetY = player.y + player.h;
  const probeRow = Math.floor((feetY + 1) / t);
  if (feetY < probeRow * t - 2) return -1; // feet floating above the row
  const cL = Math.floor((player.x + 1) / t);
  const cR = Math.floor((player.x + player.w - 2) / t);
  for (let c = cL; c <= cR; c++) {
    if (isSolid(level, c, probeRow)) return probeRow;
  }
  return -1;
}

// Advance the player one fixed step. input: {left,right,jump}. Mutates and returns player.
export function stepPlayer(player, input, level) {
  const P = PHYS;
  player.justJumped = false; // one-frame flag: true only on the step a jump launches
  if (input.left && !input.right) { player.vx -= P.accel; player.facing = -1; }
  else if (input.right && !input.left) { player.vx += P.accel; player.facing = 1; }
  else if (player.vx > 0) player.vx = Math.max(0, player.vx - P.decel);
  else if (player.vx < 0) player.vx = Math.min(0, player.vx + P.decel);
  player.vx = Math.max(-P.maxRun, Math.min(P.maxRun, player.vx));

  if (input.jump && !player.jumpHeld) player.buffer = P.buffer; // rising edge = pressed
  player.jumpHeld = input.jump;
  if (player.buffer > 0) player.buffer--;
  if (player.coyote > 0) player.coyote--;

  if (player.buffer > 0 && player.coyote > 0) {
    player.vy = P.jumpVel;
    player.buffer = 0;
    player.coyote = 0;
    player.onGround = false;
    player.justJumped = true;
  }
  if (!input.jump && player.vy < P.jumpCut) player.vy = P.jumpCut; // variable jump height

  player.vy = Math.min(P.maxFall, player.vy + P.gravity);

  moveAxis(player, level, 'x', player.vx);
  const hitY = moveAxis(player, level, 'y', player.vy);
  if (hitY) player.vy = 0; // stopped by floor (landing) or ceiling (head bonk)

  // Sticky ground detection: keeps the player grounded when resting on a tile
  // boundary (no per-frame onGround/y jitter) and refreshes coyote time.
  const gr = groundedRow(player, level);
  if (gr >= 0) {
    player.y = gr * level.tile - player.h; // snap feet to the ground tile's top
    player.vy = 0;
    player.onGround = true;
    player.coyote = P.coyote;
  } else {
    player.onGround = false;
  }

  if (!player.onGround) player.state = 'jump';
  else if (Math.abs(player.vx) > 0.3) player.state = 'run';
  else player.state = 'idle';
  return player;
}
