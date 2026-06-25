import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, reduce } from '../src/state.mjs';

test('initial game starts on TITLE with 3 lives', () => {
  const s = initialGame();
  assert.equal(s.phase, 'TITLE');
  assert.equal(s.lives, 3);
  assert.equal(s.score, 0);
  assert.equal(s.coins, 0);
});

test('start moves TITLE -> PLAYING and resets stats', () => {
  const s = reduce({ phase: 'TITLE', score: 9, coins: 9, lives: 1 }, { type: 'start' });
  assert.equal(s.phase, 'PLAYING');
  assert.equal(s.lives, 3);
  assert.equal(s.score, 0);
});

test('coin and stomp add score while playing', () => {
  let s = initialGame();
  s = reduce(s, { type: 'start' });
  s = reduce(s, { type: 'coin' });
  assert.equal(s.coins, 1);
  assert.equal(s.score, 100);
  s = reduce(s, { type: 'stomp' });
  assert.equal(s.score, 300);
});

test('deaths decrement lives and end on GAMEOVER at zero', () => {
  let s = reduce(initialGame(), { type: 'start' }); // lives 3
  s = reduce(s, { type: 'death' });
  assert.equal(s.lives, 2);
  assert.equal(s.phase, 'DEAD');
  s = reduce(s, { type: 'respawn' });
  assert.equal(s.phase, 'PLAYING');
  s = reduce(s, { type: 'death' }); // lives 1
  s = reduce(s, { type: 'respawn' });
  s = reduce(s, { type: 'death' }); // lives 0
  assert.equal(s.lives, 0);
  assert.equal(s.phase, 'GAMEOVER');
});

test('win moves PLAYING -> WIN', () => {
  const s = reduce(reduce(initialGame(), { type: 'start' }), { type: 'win' });
  assert.equal(s.phase, 'WIN');
});
