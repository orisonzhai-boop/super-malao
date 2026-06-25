export const TILE = 32;

const SOLID = new Set(['#', 'B', '?', 'P']);
export function isSolidChar(ch) { return SOLID.has(ch); }

export function makeLevel(rows) {
  const grid = rows.map((r) => r.split(''));
  const coins = [], goombas = [];
  let flagCol = -1;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c];
      if (ch === 'o') { coins.push({ col: c, row: r }); grid[r][c] = ' '; }
      else if (ch === 'g') { goombas.push({ col: c, row: r }); grid[r][c] = ' '; }
      else if (ch === 'F') { if (flagCol < 0) flagCol = c; grid[r][c] = ' '; }
    }
  }
  const stripped = grid.map((r) => r.join(''));
  const cols = Math.max(...stripped.map((r) => r.length));
  return { grid: stripped, rows: stripped.length, cols, tile: TILE, coins, goombas, flagCol };
}

export function tileChar(level, col, row) {
  if (row < 0 || row >= level.grid.length) return ' ';
  if (col < 0) return '#';                       // left edge is a solid wall
  const line = level.grid[row];
  if (col >= line.length) return ' ';            // past right end = open
  return line[col];
}

export function isSolid(level, col, row) { return isSolidChar(tileChar(level, col, row)); }

function buildLevel() {
  const COLS = 88, ROWS = 14;
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
  const set = (r, c, ch) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = ch; };
  const isGap = (c) => (c >= 31 && c <= 33) || (c >= 51 && c <= 52);
  for (let c = 0; c < COLS; c++) { if (!isGap(c)) { set(12, c, '#'); set(13, c, '#'); } }
  set(8, 7, 'B'); set(8, 8, '?'); set(8, 9, '?'); set(8, 10, 'B'); set(8, 20, '?');
  set(7, 8, 'o'); set(7, 9, 'o'); set(6, 25, 'o'); set(6, 26, 'o'); set(6, 27, 'o');
  set(9, 36, 'o'); set(9, 37, 'o');
  set(10, 15, 'P'); set(11, 15, 'P');
  set(9, 40, 'P'); set(10, 40, 'P'); set(11, 40, 'P');
  set(11, 22, 'g'); set(11, 45, 'g'); set(11, 60, 'g');
  set(11, 84, 'F');
  return g.map((row) => row.join(''));
}

export const LEVEL = buildLevel();
