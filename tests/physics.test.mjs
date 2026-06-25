import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, TILE } from '../src/level.mjs';
import { PHYS, moveAxis, makePlayer, stepPlayer } from '../src/physics.mjs';

test('moveAxis lands a falling box on the floor', () => {
  const lvl = makeLevel(['    ', '    ', '####']); // floor top at row 2 => y=64
  const box = { x: 32, y: 0, w: 24, h: 24 };
  const hit = moveAxis(box, lvl, 'y', 100);
  assert.equal(hit, true);
  assert.equal(box.y, 64 - 24); // snapped so bottom rests on floor top (y=40)
});

test('moveAxis stops a box moving right into a wall', () => {
  const lvl = makeLevel(['  #', '  #', '###']);
  const box = { x: 0, y: 0, w: 24, h: 24 };
  const hit = moveAxis(box, lvl, 'x', 100);
  assert.equal(hit, true);
  assert.equal(box.x, 2 * TILE - 24); // snapped to left face of wall column 2
});

test('moveAxis with no solid returns false and just moves', () => {
  const lvl = makeLevel(['    ', '    ']);
  const box = { x: 0, y: 0, w: 16, h: 16 };
  assert.equal(moveAxis(box, lvl, 'x', 10), false);
  assert.equal(box.x, 10);
});

test('player falls and lands, becoming grounded with vy 0', () => {
  const lvl = makeLevel(['      ', '      ', '######']);
  const p = makePlayer(1 * TILE, 0);
  const input = { left: false, right: false, jump: false };
  for (let i = 0; i < 30; i++) stepPlayer(p, input, lvl);
  assert.equal(p.onGround, true);
  assert.equal(p.vy, 0);
  assert.equal(p.y, 2 * TILE - p.h); // resting on floor (top of row 2)
});

test('grounded player jumps when jump pressed (vy goes negative)', () => {
  const lvl = makeLevel(['      ', '      ', '######']);
  const p = makePlayer(1 * TILE, 0);
  for (let i = 0; i < 30; i++) stepPlayer(p, { left: false, right: false, jump: false }, lvl);
  assert.equal(p.onGround, true);
  stepPlayer(p, { left: false, right: false, jump: true }, lvl); // press jump
  assert.ok(p.vy < 0, `expected upward velocity, got ${p.vy}`);
});

test('player accelerates right but is capped at maxRun', () => {
  const lvl = makeLevel(['          ', '          ', '##########']);
  const p = makePlayer(1 * TILE, 0);
  for (let i = 0; i < 60; i++) stepPlayer(p, { left: false, right: true, jump: false }, lvl);
  assert.ok(p.vx <= PHYS.maxRun + 1e-9);
  assert.equal(p.facing, 1);
});

test('resting player stays grounded without jitter', () => {
  const lvl = makeLevel(['      ', '      ', '######']);
  const p = makePlayer(1 * TILE, 0);
  for (let i = 0; i < 40; i++) stepPlayer(p, { left: false, right: false, jump: false }, lvl);
  const restY = p.y;
  assert.equal(p.onGround, true);
  for (let i = 0; i < 20; i++) {
    stepPlayer(p, { left: false, right: false, jump: false }, lvl);
    assert.equal(p.onGround, true, `frame ${i}: should stay grounded`);
    assert.equal(p.y, restY, `frame ${i}: y must not drift`);
    assert.equal(p.state, 'idle', `frame ${i}: should be idle`);
  }
});
