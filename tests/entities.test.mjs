import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, TILE } from '../src/level.mjs';
import { makeEnemy, stepEnemy, stompCheck } from '../src/entities.mjs';

test('enemy turns around at a wall', () => {
  // floor on row 2; a wall block at row 1 col 3
  const lvl = makeLevel(['    ', '   #', '####']);
  const e = makeEnemy(1 * TILE, 1 * TILE); // sitting on floor, row 1
  e.vx = 2; e.dir = 1;
  for (let i = 0; i < 40; i++) stepEnemy(e, lvl);
  assert.ok(e.vx < 0, `expected leftward after hitting wall, got vx=${e.vx}`);
});

test('enemy turns around at a ledge (no ground ahead)', () => {
  // ground only under cols 0-1; col 2+ is a pit
  const lvl = makeLevel(['     ', '     ', '##   ']);
  const e = makeEnemy(0 * TILE, 1 * TILE);
  e.vx = 2; e.dir = 1;
  for (let i = 0; i < 30; i++) stepEnemy(e, lvl);
  assert.ok(e.vx < 0, `expected turn at ledge, got vx=${e.vx}`);
});

test('stompCheck returns stomp when player falls onto enemy top', () => {
  const player = { x: 100, y: 100, w: 24, h: 58, vx: 0, vy: 5 };
  const enemy = { x: 100, y: 150, w: 28, h: 24, alive: true };
  assert.equal(stompCheck(player, enemy), 'stomp');
});

test('stompCheck returns hit on side overlap while not falling onto top', () => {
  const player = { x: 130, y: 150, w: 24, h: 58, vx: 0, vy: 0 };
  const enemy = { x: 120, y: 150, w: 28, h: 24, alive: true };
  assert.equal(stompCheck(player, enemy), 'hit');
});

test('stompCheck returns null when not overlapping or enemy dead', () => {
  const player = { x: 0, y: 0, w: 24, h: 58, vx: 0, vy: 5 };
  const far = { x: 500, y: 500, w: 28, h: 24, alive: true };
  assert.equal(stompCheck(player, far), null);
  const dead = { x: 0, y: 50, w: 28, h: 24, alive: false };
  assert.equal(stompCheck(player, dead), null);
});
