import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, TILE } from '../src/level.mjs';
import { makeProjectile, stepProjectile, hits, PROJECTILE_SPEED } from '../src/projectile.mjs';

test('makeProjectile flies in the facing direction', () => {
  assert.equal(makeProjectile(0, 0, 1).vx, PROJECTILE_SPEED);
  assert.equal(makeProjectile(0, 0, -1).vx, -PROJECTILE_SPEED);
});

test('stepProjectile moves by vx over open space and stays alive', () => {
  const lvl = makeLevel(['      ', '      ']);
  const p = makeProjectile(0, 8, 1);
  stepProjectile(p, lvl);
  assert.equal(p.x, PROJECTILE_SPEED);
  assert.equal(p.alive, true);
});

test('stepProjectile dies when it enters a solid tile', () => {
  const lvl = makeLevel(['   #']); // wall at col 3 (x 96..128), row 0
  const p = makeProjectile(0, 8, 1);
  let steps = 0;
  while (p.alive && steps < 40) { stepProjectile(p, lvl); steps++; }
  assert.equal(p.alive, false);
  assert.ok(p.x < 4 * TILE, 'should die at/before the wall');
});

test('hits detects AABB overlap', () => {
  const a = { x: 0, y: 0, w: 14, h: 14 };
  assert.equal(hits(a, { x: 10, y: 10, w: 20, h: 20 }), true);
  assert.equal(hits(a, { x: 20, y: 0, w: 10, h: 10 }), false);
});
