import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, isSolidChar, makeLevel, tileChar, isSolid, setTile, LEVEL } from '../src/level.mjs';

test("makeLevel parses 'V' into a single boss spawn and strips it", () => {
  const lvl = makeLevel(['  V ', '####']);
  assert.deepEqual(lvl.boss, { col: 2, row: 0 });
  assert.equal(tileChar(lvl, 2, 0), ' ');   // stripped from collision grid
  assert.equal(isSolid(lvl, 2, 0), false);
  const none = makeLevel(['###']);
  assert.equal(none.boss, null);             // no 'V' -> null
});

test('LEVEL contains exactly one boss spawn near the end', () => {
  const lvl = makeLevel(LEVEL);
  assert.ok(lvl.boss, 'LEVEL should define a boss spawn');
  assert.ok(lvl.boss.col >= 70, `boss should be near the end, got col ${lvl.boss?.col}`);
});

test('TILE is 32', () => assert.equal(TILE, 32));

test('isSolidChar classifies tiles', () => {
  for (const ch of ['#', 'B', '?', 'P', 'U']) assert.equal(isSolidChar(ch), true, ch);
  for (const ch of [' ', 'o', 'g', 'F']) assert.equal(isSolidChar(ch), false, ch);
});

test('setTile spends a ? block in place, staying solid', () => {
  const lvl = makeLevel(['?#', '##']);
  assert.equal(tileChar(lvl, 0, 0), '?');
  setTile(lvl, 0, 0, 'U');
  assert.equal(tileChar(lvl, 0, 0), 'U');
  assert.equal(isSolid(lvl, 0, 0), true);       // spent block still solid
  assert.equal(tileChar(lvl, 1, 0), '#');        // neighbor untouched
  setTile(lvl, 99, 99, 'U');                      // out of range = no-op, no throw
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

test('LEVEL places its key features where the design expects', () => {
  const lvl = makeLevel(LEVEL);
  assert.equal(lvl.cols, 88);
  assert.equal(isSolid(lvl, 10, 12), true);   // ground present near start
  assert.equal(isSolid(lvl, 32, 12), false);  // gap at cols 31-33
  assert.equal(isSolid(lvl, 51, 12), false);  // gap at cols 51-52
  assert.equal(isSolid(lvl, 40, 9), true);    // top of 3-tall pipe at col 40
  assert.equal(isSolid(lvl, 40, 11), true);   // base of that pipe
  assert.equal(lvl.flagCol, 84);              // flag near the end
  assert.equal(lvl.goombas.length, 3);
});

test('rebuilding makeLevel(LEVEL) restores spent ? blocks (replay reset)', () => {
  const a = makeLevel(LEVEL);
  let q = null;
  for (let r = 0; r < a.rows && !q; r++) {
    for (let c = 0; c < a.cols; c++) {
      if (tileChar(a, c, r) === '?') { q = { c, r }; break; }
    }
  }
  assert.ok(q, 'LEVEL should contain at least one ? block');
  setTile(a, q.c, q.r, 'U');                 // spend it, as a bump would
  assert.equal(tileChar(a, q.c, q.r), 'U');
  const b = makeLevel(LEVEL);                 // what resetRun() does on a full restart
  assert.equal(tileChar(b, q.c, q.r), '?');  // restored — not carried over from the spent run
});
