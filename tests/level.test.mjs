import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, isSolidChar, makeLevel, tileChar, isSolid, LEVEL } from '../src/level.mjs';

test('TILE is 32', () => assert.equal(TILE, 32));

test('isSolidChar classifies tiles', () => {
  for (const ch of ['#', 'B', '?', 'P']) assert.equal(isSolidChar(ch), true, ch);
  for (const ch of [' ', 'o', 'g', 'F']) assert.equal(isSolidChar(ch), false, ch);
});

test('makeLevel strips entities into lists', () => {
  const lvl = makeLevel(['o g ', '####', '   F']);
  assert.equal(lvl.coins.length, 1);
  assert.deepEqual(lvl.coins[0], { col: 0, row: 0 });
  assert.equal(lvl.goombas.length, 1);
  assert.deepEqual(lvl.goombas[0], { col: 2, row: 0 });
  assert.equal(lvl.flagCol, 3);
  assert.equal(tileChar(lvl, 0, 0), ' '); // coin stripped from collision grid
  assert.equal(tileChar(lvl, 0, 1), '#'); // ground intact
});

test('tileChar bounds: left wall solid, below-bottom empty', () => {
  const lvl = makeLevel(['####']);
  assert.equal(tileChar(lvl, -1, 0), '#');   // left wall
  assert.equal(tileChar(lvl, 0, 99), ' ');   // below bottom = pit
  assert.equal(tileChar(lvl, 99, 0), ' ');   // past right end = open
  assert.equal(isSolid(lvl, 0, 0), true);
});

test('LEVEL is a non-empty array of equal-length rows', () => {
  assert.ok(Array.isArray(LEVEL) && LEVEL.length === 14);
  const len = LEVEL[0].length;
  for (const row of LEVEL) assert.equal(row.length, len);
});
