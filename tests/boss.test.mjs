import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/level.mjs';
import { makeBoss, stepBoss, damageBoss, BOSS_HP, BOSS_INVULN, BOSS_H } from '../src/boss.mjs';

test('makeBoss starts at full hp, alive, resting on the ground row below', () => {
  const b = makeBoss(80, 11);
  assert.equal(b.hp, BOSS_HP);
  assert.equal(b.alive, true);
  assert.equal(b.x, 80 * TILE);
  assert.equal(b.y + b.h, 12 * TILE); // bottom sits on top of row 12
});

test('stepBoss paces and turns at the arena bounds', () => {
  const b = makeBoss(80, 11); // starts moving left (vx < 0)
  assert.ok(b.vx < 0);
  for (let i = 0; i < 120; i++) stepBoss(b);
  assert.ok(b.x >= b.arenaMin, 'should not escape left of the arena');
  assert.ok(b.vx > 0, 'should have turned rightward after hitting the left bound');
});

test('damageBoss respects invulnerability and defeats after BOSS_HP hits', () => {
  const b = makeBoss(80, 11);
  assert.equal(damageBoss(b), true);        // first hit lands
  assert.equal(b.hp, BOSS_HP - 1);
  assert.ok(b.invuln > 0);
  assert.equal(damageBoss(b), false);       // still invulnerable -> ignored
  assert.equal(b.hp, BOSS_HP - 1);
  // land the remaining hits, clearing i-frames between each
  let landed = 1;
  for (let guard = 0; guard < 100 && b.alive; guard++) {
    for (let i = 0; i < BOSS_INVULN; i++) stepBoss(b);
    if (damageBoss(b)) landed++;
  }
  assert.equal(b.hp, 0);
  assert.equal(b.alive, false);
  assert.equal(landed, BOSS_HP, 'should take exactly BOSS_HP landed hits');
});
