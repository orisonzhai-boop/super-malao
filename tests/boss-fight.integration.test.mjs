// Integration test: composes the real modules the way main.mjs's PLAYING loop does,
// to verify the boss fight end-to-end without the browser (main.mjs is browser-only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel, LEVEL, TILE } from '../src/level.mjs';
import { makeProjectile, stepProjectile, hits } from '../src/projectile.mjs';
import { makeBoss, stepBoss, damageBoss, BOSS_INVULN, BOSS_HP } from '../src/boss.mjs';
import { initialGame, reduce } from '../src/state.mjs';

test('BOSS_HP projectile hits defeat the boss and win the level', () => {
  const level = makeLevel(LEVEL);
  assert.ok(level.boss, 'LEVEL must define a boss spawn');
  const boss = makeBoss(level.boss.col, level.boss.row);
  let game = reduce(initialGame(), { type: 'start' }); // PLAYING, score 0

  let rounds = 0;
  while (boss.alive && rounds < BOSS_HP + 5) {
    // Spawn a projectile just left of the boss, aimed right (as main does at the player's facing side).
    const pr = makeProjectile(boss.x - 30, boss.y + 10, 1);
    // Fly it and resolve against the boss exactly like main.mjs's projectile loop.
    for (let i = 0; i < 40 && pr.alive; i++) {
      stepProjectile(pr, level);
      if (hits(pr, boss)) {
        if (damageBoss(boss)) game = reduce(game, { type: 'bossHit' });
        pr.alive = false;
      }
    }
    // Advance the boss past its i-frames (stepBoss runs every loop frame in main).
    for (let i = 0; i < BOSS_INVULN + 1; i++) stepBoss(boss);
    rounds++;
  }

  assert.equal(boss.alive, false, 'boss should be defeated');
  assert.equal(boss.hp, 0);
  // main fires 'win' when the boss is defeated during PLAYING.
  if (!boss.alive && game.phase === 'PLAYING') game = reduce(game, { type: 'win' });
  assert.equal(game.phase, 'WIN');
  assert.equal(game.score, BOSS_HP * 300); // BOSS_HP landed hits x bossHit(+300)
});

test('touching the boss costs a life (death), not a stomp', () => {
  const level = makeLevel(LEVEL);
  const boss = makeBoss(level.boss.col, level.boss.row);
  const player = { x: boss.x, y: boss.y, w: 24, h: 58, vy: 5 }; // overlapping, even falling
  let game = reduce(initialGame(), { type: 'start' }); // lives 3
  assert.equal(hits(player, boss), true);
  if (hits(player, boss) && game.phase === 'PLAYING') game = reduce(game, { type: 'death' });
  assert.equal(game.lives, 2);
  assert.equal(game.phase, 'DEAD');
});

test('knee-height projectile overlaps a ground goomba', () => {
  // Player rests at y=326 on ground row 12; knee-height shot y = 326 + 58 - 24 = 360.
  const proj = makeProjectile(700, 326 + 58 - 24, 1);
  const goomba = { x: 700, y: 11 * TILE + (TILE - 24), w: 28, h: 24 }; // rests on ground, top = 360
  assert.equal(hits(proj, goomba), true);
});
