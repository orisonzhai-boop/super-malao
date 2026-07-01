# Boss 反派 + 投掷攻击 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ranged throw attack for Malao and an end-of-level Boss (defeat = win, replacing the flag), on the existing single-file HTML game.

**Architecture:** Two new pure ES modules — `src/projectile.mjs` (spawn/fly/hit) and `src/boss.mjs` (spawn/pace/damage) — are unit-tested in Node. They wire into the browser-only `main.mjs` (attack input, projectile & boss update/collisions, boss-defeat win) and `render.mjs` (draw projectiles, boss sprite, boss HP HUD). The Boss uses the user's hand-drawn `assets/villain_src.jpg`, sliced into `SPRITES.villain`. The dev-time bundler inlines everything into `super-malao.html` as before.

**Tech Stack:** Vanilla JS (ES modules), HTML5 Canvas 2D, Web Audio, Node built-in test runner (`node --test`), Python 3 + Pillow/numpy (sprite slicing).

---

## Spec refinements (intentional, vs `docs/superpowers/specs/2026-06-27-boss-and-attack-design.md`)
- **Projectile spawn height:** spec said `y = player.y + 18` (chest). Refined to `y = player.y + player.h - 24` (knee height) so projectiles overlap short ground Goombas (top at 360) — a chest-height shot (bottom ~358) would fly 2px over them. Knee height also still overlaps the tall Boss.
- **`makeBoss(col, row)`** (no `level` param — ground rest is computed from `row`, arena from `x`; an unused param would be a smell).

## Shared contract (keep names consistent)
- Projectile: `{ x, y, w:14, h:14, vx, alive }`.
- Boss: `{ x, y, w:48, h:60, vx, dir, hp, alive, invuln, arenaMin, arenaMax }`.
- Level gains `boss: {col,row} | null`.
- Game reducer gains event `'bossHit'` (+300, PLAYING only).
- `hits(a,b)` (AABB overlap) lives in `projectile.mjs` and is imported by `main.mjs` for player-vs-boss and projectile-vs-enemy checks.

## File Structure
```
src/projectile.mjs      NEW  makeProjectile / stepProjectile / hits (pure)
src/boss.mjs            NEW  makeBoss / stepBoss / damageBoss (pure)
tests/projectile.test.mjs NEW
tests/boss.test.mjs     NEW
src/level.mjs           MOD  parse 'V' -> level.boss
src/state.mjs           MOD  'bossHit' event
src/input.mjs           MOD  KeyJ -> attack
src/render.mjs          MOD  draw projectiles, boss, boss HP HUD, title hint
src/main.mjs            MOD  attack input, projectile/boss update+collisions, boss-defeat win, remove flag win
tools/slice_hero.py     MOD  also emit SPRITES.villain from assets/villain_src.jpg
tools/build.mjs         MOD  ORDER += projectile,boss ; HTML hint += 'J 攻击'
super-malao.html        REGEN
```

---

## Task 1: Villain sprite → `SPRITES.villain`

**Files:** Modify `tools/slice_hero.py`; regenerates `src/sprites.mjs`.

- [ ] **Step 1: Append villain processing to the slicer.** Open `tools/slice_hero.py`. It already defines `luminance`, `alpha_from_white`, `autocrop`, `scale_h`, and builds an `entries` list, then writes `src/sprites.mjs`. Immediately BEFORE the block that opens `OUT_MJS` for writing (the `with open(OUT_MJS, "w") as f:` line), insert:

```python
    # Villain (Boss) — a single hand-drawn figure on a light background.
    VILLAIN_SRC = os.path.join(ROOT, "assets", "villain_src.jpg")
    if os.path.exists(VILLAIN_SRC):
        v = Image.open(VILLAIN_SRC).convert("RGB")
        varr = np.asarray(v)
        va = alpha_from_white(luminance(varr))
        vimg = Image.fromarray(np.dstack([varr, va]).astype(np.uint8), "RGBA")
        vimg = autocrop(vimg)
        vimg = scale_h(vimg, TARGET_H)
        vimg.save(os.path.join(FRAMES_DIR, "villain.png"))
        vbuf = io.BytesIO(); vimg.save(vbuf, "PNG")
        vb64 = base64.b64encode(vbuf.getvalue()).decode("ascii")
        entries.append(("villain", vimg.size, f"data:image/png;base64,{vb64}"))
        print(f"villain: size={vimg.size} bytes={len(vb64)}")
```

- [ ] **Step 2: Run it.** `cd /Users/bytedance/rookie && python3 tools/slice_hero.py`
Expected: prints the 4 hero frames, then `villain: size=(W,128) bytes=...`, then `wrote .../src/sprites.mjs`.

- [ ] **Step 3: Verify.**
```bash
cd /Users/bytedance/rookie
node --check src/sprites.mjs && echo "sprites.mjs OK"
node --input-type=module -e "import {SPRITES,SPRITE_NATURAL} from './src/sprites.mjs'; console.log(Object.keys(SPRITES)); console.log('villain nat', SPRITE_NATURAL.villain)"
python3 -c "from PIL import Image; im=Image.open('assets/frames/villain.png'); print(im.mode, im.size, 'alpha', im.getextrema()[3][0]<255)"
```
Expected: keys include `villain`; `SPRITE_NATURAL.villain` has `{w,h}`; villain.png is `RGBA` with `alpha True`.

- [ ] **Step 4: Eyeball.** Use the Read tool to VIEW `assets/frames/villain.png`. Confirm: single villain figure (glasses, no cat ears), transparent background, no heavy white fringe. If the light-gray background survives (not transparent), it's brighter than the default cutoff — the `alpha_from_white` threshold is `WHITE_THRESHOLD=232`; if needed lower it toward 220 (module-level constant) and re-run Steps 2–4. Report what you saw / tuned.

- [ ] **Step 5: Commit.**
```bash
cd /Users/bytedance/rookie
git add tools/slice_hero.py src/sprites.mjs
git commit -m "feat: slice villain art into SPRITES.villain"
```

---

## Task 2: `level.mjs` parses `V` → `level.boss`

**Files:** Modify `src/level.mjs`; Test `tests/level.test.mjs`.

- [ ] **Step 1: Write the failing test.** Append to `tests/level.test.mjs`:
```javascript
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
```

- [ ] **Step 2: Run — expect FAIL.** `cd /Users/bytedance/rookie && node --test tests/level.test.mjs`
Expected: FAIL (`lvl.boss` is undefined).

- [ ] **Step 3: Implement.** In `src/level.mjs`, edit `makeLevel`. Change the entity-stripping loop and the return.

Replace:
```javascript
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
```
with:
```javascript
  const coins = [], goombas = [];
  let flagCol = -1;
  let boss = null;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c];
      if (ch === 'o') { coins.push({ col: c, row: r }); grid[r][c] = ' '; }
      else if (ch === 'g') { goombas.push({ col: c, row: r }); grid[r][c] = ' '; }
      else if (ch === 'F') { if (flagCol < 0) flagCol = c; grid[r][c] = ' '; }
      else if (ch === 'V') { if (!boss) boss = { col: c, row: r }; grid[r][c] = ' '; }
    }
  }
  const stripped = grid.map((r) => r.join(''));
  const cols = Math.max(...stripped.map((r) => r.length));
  return { grid: stripped, rows: stripped.length, cols, tile: TILE, coins, goombas, flagCol, boss };
```

Then in `buildLevel()`, add a boss spawn near the end. After the line `set(11, 84, 'F');` add:
```javascript
  set(11, 80, 'V'); // Boss spawn near the end (arena is the end platform)
```

- [ ] **Step 4: Run — expect PASS.** `cd /Users/bytedance/rookie && node --test tests/level.test.mjs`
Expected: PASS (all level tests, including the 2 new).

- [ ] **Step 5: Commit.**
```bash
cd /Users/bytedance/rookie
git add src/level.mjs tests/level.test.mjs
git commit -m "feat: parse V boss-spawn marker in level"
```

---

## Task 3: `state.mjs` — `bossHit` scoring event

**Files:** Modify `src/state.mjs`; Test `tests/state.test.mjs`.

- [ ] **Step 1: Write the failing test.** Append to `tests/state.test.mjs`:
```javascript
test('bossHit adds score only while PLAYING', () => {
  let s = reduce(initialGame(), { type: 'start' });
  s = reduce(s, { type: 'bossHit' });
  assert.equal(s.score, 300);
  const title = reduce(initialGame(), { type: 'bossHit' }); // TITLE -> no-op
  assert.equal(title.score, 0);
});
```

- [ ] **Step 2: Run — expect FAIL.** `cd /Users/bytedance/rookie && node --test tests/state.test.mjs`
Expected: FAIL (score is 0, not 300).

- [ ] **Step 3: Implement.** In `src/state.mjs`, inside `reduce`'s switch, add a case after the `stomp` case:
```javascript
    case 'bossHit':
      if (s.phase === 'PLAYING') { s.score += 300; }
      break;
```

- [ ] **Step 4: Run — expect PASS.** `cd /Users/bytedance/rookie && node --test tests/state.test.mjs`

- [ ] **Step 5: Commit.**
```bash
cd /Users/bytedance/rookie
git add src/state.mjs tests/state.test.mjs
git commit -m "feat: bossHit scoring event"
```

---

## Task 4: `projectile.mjs` (+ tests)

**Files:** Create `src/projectile.mjs`; Test `tests/projectile.test.mjs`.

- [ ] **Step 1: Write the failing test — create `tests/projectile.test.mjs`:**
```javascript
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
```

- [ ] **Step 2: Run — expect FAIL** (module missing).
`cd /Users/bytedance/rookie && node --test tests/projectile.test.mjs`

- [ ] **Step 3: Implement — create `src/projectile.mjs`:**
```javascript
import { isSolid } from './level.mjs';

export const PROJECTILE_SPEED = 7;
export const PROJECTILE_W = 14;
export const PROJECTILE_H = 14;
export const ATTACK_COOLDOWN = 18; // frames between shots (~0.3s)
export const MAX_PROJECTILES = 3;

export function makeProjectile(x, y, dir) {
  return { x, y, w: PROJECTILE_W, h: PROJECTILE_H, vx: (dir < 0 ? -1 : 1) * PROJECTILE_SPEED, alive: true };
}

// Advance one step; despawn (alive=false) if the center enters a solid tile. Mutates.
export function stepProjectile(proj, level) {
  if (!proj.alive) return proj;
  proj.x += proj.vx;
  const t = level.tile;
  const cc = Math.floor((proj.x + proj.w / 2) / t);
  const cr = Math.floor((proj.y + proj.h / 2) / t);
  if (isSolid(level, cc, cr)) proj.alive = false;
  return proj;
}

// AABB overlap of two {x,y,w,h} boxes.
export function hits(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```

- [ ] **Step 4: Run — expect PASS.** `cd /Users/bytedance/rookie && node --test tests/projectile.test.mjs`

- [ ] **Step 5: Commit.**
```bash
cd /Users/bytedance/rookie
git add src/projectile.mjs tests/projectile.test.mjs
git commit -m "feat: projectile module (spawn, fly, hit)"
```

---

## Task 5: `boss.mjs` (+ tests)

**Files:** Create `src/boss.mjs`; Test `tests/boss.test.mjs`.

- [ ] **Step 1: Write the failing test — create `tests/boss.test.mjs`:**
```javascript
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

test('damageBoss respects invulnerability and defeats at 0 hp', () => {
  const b = makeBoss(80, 11);
  assert.equal(damageBoss(b), true);   // hp 3 -> 2
  assert.equal(b.hp, BOSS_HP - 1);
  assert.ok(b.invuln > 0);
  assert.equal(damageBoss(b), false);  // still invulnerable -> ignored
  assert.equal(b.hp, BOSS_HP - 1);
  for (let i = 0; i < BOSS_INVULN; i++) stepBoss(b); // clear invuln
  assert.equal(damageBoss(b), true);   // hp -> 1
  for (let i = 0; i < BOSS_INVULN; i++) stepBoss(b);
  assert.equal(damageBoss(b), true);   // hp -> 0
  assert.equal(b.hp, 0);
  assert.equal(b.alive, false);
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing).
`cd /Users/bytedance/rookie && node --test tests/boss.test.mjs`

- [ ] **Step 3: Implement — create `src/boss.mjs`:**
```javascript
import { TILE } from './level.mjs';

export const BOSS_W = 48;
export const BOSS_H = 60;
export const BOSS_HP = 3;
export const BOSS_SPEED = 1.5;
export const BOSS_INVULN = 30;      // frames of i-frames after a hit
export const BOSS_ARENA_HALF = 4 * TILE;

export function makeBoss(col, row) {
  const x = col * TILE;
  const y = row * TILE + (TILE - BOSS_H); // bottom rests on the ground row below
  return {
    x, y, w: BOSS_W, h: BOSS_H,
    vx: -BOSS_SPEED, dir: -1, hp: BOSS_HP, alive: true, invuln: 0,
    arenaMin: x - BOSS_ARENA_HALF, arenaMax: x + BOSS_ARENA_HALF,
  };
}

// Pace within the arena, turning at bounds; tick down i-frames. Mutates.
export function stepBoss(boss) {
  if (!boss.alive) return boss;
  if (boss.invuln > 0) boss.invuln--;
  boss.x += boss.vx;
  if (boss.x <= boss.arenaMin) { boss.x = boss.arenaMin; boss.vx = Math.abs(boss.vx); }
  else if (boss.x + boss.w >= boss.arenaMax) { boss.x = boss.arenaMax - boss.w; boss.vx = -Math.abs(boss.vx); }
  boss.dir = Math.sign(boss.vx) || boss.dir;
  return boss;
}

// Apply one hit unless invulnerable/dead. Returns true if the hit landed.
export function damageBoss(boss) {
  if (!boss.alive || boss.invuln > 0) return false;
  boss.hp--;
  boss.invuln = BOSS_INVULN;
  if (boss.hp <= 0) boss.alive = false;
  return true;
}
```

- [ ] **Step 4: Run — expect PASS.** `cd /Users/bytedance/rookie && node --test tests/boss.test.mjs`

- [ ] **Step 5: Run full suite + commit.**
```bash
cd /Users/bytedance/rookie
node --test        # all suites green
git add src/boss.mjs tests/boss.test.mjs
git commit -m "feat: boss module (spawn, pace, damage)"
```

---

## Task 6: `input.mjs` — attack key `J`

**Files:** Modify `src/input.mjs`.

- [ ] **Step 1: Implement.** In `src/input.mjs`:
  - Add `attack: false` to the `keys` object literal.
  - Add `KeyJ: 'attack',` to the `map` object.

The `keys` line becomes:
```javascript
  const keys = { left: false, right: false, jump: false, start: false, restart: false, mute: false, attack: false };
```
And add to `map` (e.g. after `KeyM: 'mute',`): `KeyJ: 'attack',`.

- [ ] **Step 2: Verify.** `cd /Users/bytedance/rookie && node --check src/input.mjs && echo OK`

- [ ] **Step 3: Commit.**
```bash
cd /Users/bytedance/rookie
git add src/input.mjs
git commit -m "feat: J attack key"
```

---

## Task 7: `render.mjs` — draw projectiles, boss, boss HP HUD

**Files:** Modify `src/render.mjs`. (Browser-only; verified by smoke.)

- [ ] **Step 1: Add draw helpers.** In `src/render.mjs`, immediately BEFORE the `export function drawScene(` line, insert these three functions:
```javascript
function drawProjectiles(ctx, projectiles, cam) {
  for (const pr of projectiles) {
    if (!pr.alive) continue;
    const x = pr.x + pr.w / 2 - cam.x, y = pr.y + pr.h / 2;
    ctx.strokeStyle = 'rgba(255,207,63,0.55)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sign(pr.vx) * 12, y); ctx.stroke();
    ctx.fillStyle = '#ffcf3f'; ctx.strokeStyle = '#c77b00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, pr.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath(); ctx.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBoss(ctx, boss, cam, assets) {
  if (!boss || !boss.alive) return;
  const img = assets.images.villain, mask = assets.masks.villain, nat = assets.natural.villain;
  const dh = boss.h + 18, dw = dh * (nat.w / nat.h);
  const dx = boss.x + boss.w / 2 - dw / 2 - cam.x;
  const dy = boss.y + boss.h - dh + 4;
  ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(boss.x + boss.w / 2 - cam.x, boss.y + boss.h, 22, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  drawHero(ctx, img, mask, dx, dy, dw, dh, boss.dir); // reuse outline+flip sprite drawing
  if (boss.invuln > 0 && Math.floor(boss.invuln / 4) % 2 === 0) { // blink white when hit
    ctx.save();
    ctx.translate(dx + dw / 2, 0); ctx.scale(boss.dir < 0 ? -1 : 1, 1);
    ctx.globalAlpha = 0.7; ctx.drawImage(mask, -dw / 2, dy, dw, dh);
    ctx.restore();
  }
}

function drawBossHUD(ctx, boss, cam) {
  if (!boss || !boss.alive) return;
  if (!(boss.x + boss.w > cam.x && boss.x < cam.x + VIEW_W)) return; // only when on screen
  const cx = VIEW_W / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 74, 12, 148, 34);
  ctx.fillStyle = '#ffffff'; ctx.font = '14px monospace'; ctx.textAlign = 'left';
  ctx.fillText('BOSS', cx - 62, 34);
  for (let i = 0; i < 3; i++) {
    const hx = cx - 10 + i * 24;
    ctx.fillStyle = i < boss.hp ? '#e24b4a' : 'rgba(255,255,255,0.22)';
    ctx.fillRect(hx, 22, 18, 14);
    ctx.strokeStyle = '#a32d2d'; ctx.lineWidth = 1; ctx.strokeRect(hx + 0.5, 22.5, 17, 13);
  }
}
```

- [ ] **Step 2: Call them in `drawScene`.** In `drawScene`, after the line `drawEnemies(ctx, world.enemies, cam);` add:
```javascript
  drawBoss(ctx, world.boss, cam, assets);
```
After the hero-drawing block (right before `drawHUD(ctx, game);`) add:
```javascript
  drawProjectiles(ctx, world.projectiles || [], cam);
```
Immediately after `drawHUD(ctx, game);` add:
```javascript
  drawBossHUD(ctx, world.boss, cam);
```

- [ ] **Step 3: Add the attack key to the title hint.** In `drawScene`, change the TITLE overlay line from:
```javascript
  if (game.phase === 'TITLE') drawOverlay(ctx, ['超级玛拉奥 / Super Malao', '按 Enter 开始', '← → 移动 · 空格跳 · M 静音']);
```
to:
```javascript
  if (game.phase === 'TITLE') drawOverlay(ctx, ['超级玛拉奥 / Super Malao', '按 Enter 开始', '← → 移动 · 空格跳 · J 攻击 · M 静音']);
```

- [ ] **Step 4: Verify.** `cd /Users/bytedance/rookie && node --check src/render.mjs && echo OK`

- [ ] **Step 5: Commit.**
```bash
cd /Users/bytedance/rookie
git add src/render.mjs
git commit -m "feat: render projectiles, boss sprite, boss HP HUD"
```

---

## Task 8: `main.mjs` — wire attack + boss

**Files:** Modify `src/main.mjs`. (Browser-only; verified by smoke.)

- [ ] **Step 1: Imports.** Add after the existing imports at the top of `src/main.mjs`:
```javascript
import { makeProjectile, stepProjectile, hits, ATTACK_COOLDOWN, PROJECTILE_W, MAX_PROJECTILES } from './projectile.mjs';
import { makeBoss, stepBoss, damageBoss } from './boss.mjs';
```

- [ ] **Step 2: `freshWorld` includes boss + projectiles.** Replace the `freshWorld` function:
```javascript
function freshWorld(level) {
  return {
    player: makePlayer(SPAWN.x, SPAWN.y),
    enemies: level.goombas.map((g) => makeEnemy(g.col * TILE, g.row * TILE)),
    coins: level.coins.map((c) => ({ ...c, taken: false })),
    boss: level.boss ? makeBoss(level.boss.col, level.boss.row) : null,
    projectiles: [],
  };
}
```

- [ ] **Step 3: Attack state + edge.** In `boot()`, find the line `let prevStart = false, prevRestart = false, prevMute = false;` and replace with:
```javascript
  let prevStart = false, prevRestart = false, prevMute = false, prevAttack = false;
  let attackCd = 0;
```
Then in `update()`, find the edge block:
```javascript
    prevStart = input.start; prevRestart = input.restart; prevMute = input.mute;
    if (muteEdge) audio.toggleMute();
```
and replace with:
```javascript
    const attackEdge = input.attack && !prevAttack;
    prevStart = input.start; prevRestart = input.restart; prevMute = input.mute; prevAttack = input.attack;
    if (muteEdge) audio.toggleMute();
```

- [ ] **Step 4: Replace the whole PLAYING body.** In `update()`, replace everything from `// PLAYING` down to (and including) the `cam = clampCamera(p.x + p.w / 2, level);` line with:
```javascript
    // PLAYING
    if (attackCd > 0) attackCd--;
    const p = world.player;
    const vyBefore = p.vy;
    stepPlayer(p, { left: input.left, right: input.right, jump: input.jump }, level);
    if (p.justJumped) audio.jump(); // covers ground, coyote, and buffered jumps

    // '?' block bump: an upward move stopped this frame (head bonk) over a '?' tile pops a coin
    if (vyBefore < 0 && p.vy === 0) {
      const bumped = questionBumpTile(p, level);
      if (bumped) {
        setTile(level, bumped.col, bumped.row, 'U');
        game = reduce(game, { type: 'coin' });
        audio.coin();
      }
    }

    // throw attack
    if (attackEdge && attackCd === 0 && world.projectiles.length < MAX_PROJECTILES) {
      const dir = p.facing;
      const px = dir > 0 ? p.x + p.w : p.x - PROJECTILE_W;
      const py = p.y + p.h - 24; // knee height so shots hit ground enemies and the tall boss
      world.projectiles.push(makeProjectile(px, py, dir));
      attackCd = ATTACK_COOLDOWN;
      audio.throw();
    }

    for (const e of world.enemies) stepEnemy(e, level);

    // projectiles: advance, then resolve against boss/enemies/walls
    for (const pr of world.projectiles) stepProjectile(pr, level);
    for (const pr of world.projectiles) {
      if (!pr.alive) continue;
      if (world.boss && world.boss.alive && hits(pr, world.boss)) {
        if (damageBoss(world.boss)) { pr.alive = false; game = reduce(game, { type: 'bossHit' }); audio.bossHit(); }
        continue;
      }
      for (const e of world.enemies) {
        if (e.alive && hits(pr, e)) { e.alive = false; pr.alive = false; game = reduce(game, { type: 'stomp' }); audio.stomp(); break; }
      }
    }

    // player vs enemies
    for (const e of world.enemies) {
      const res = stompCheck(p, e);
      if (res === 'stomp') { e.alive = false; p.vy = -8; game = reduce(game, { type: 'stomp' }); audio.stomp(); }
      else if (res === 'hit') { game = reduce(game, { type: 'death' }); audio.death(); break; }
    }

    // boss: pace, contact damages the player, defeat wins the level
    if (world.boss && world.boss.alive) {
      stepBoss(world.boss);
      if (hits(p, world.boss) && game.phase === 'PLAYING') { game = reduce(game, { type: 'death' }); audio.death(); }
    }
    if (world.boss && !world.boss.alive && game.phase === 'PLAYING') { game = reduce(game, { type: 'win' }); audio.win(); }

    // coins
    for (const co of world.coins) {
      if (co.taken) continue;
      const cx = co.col * TILE, cy = co.row * TILE;
      if (p.x < cx + TILE && p.x + p.w > cx && p.y < cy + TILE && p.y + p.h > cy) {
        co.taken = true; game = reduce(game, { type: 'coin' }); audio.coin();
      }
    }

    // pit death
    if (p.y > level.rows * TILE + 32 && game.phase === 'PLAYING') { game = reduce(game, { type: 'death' }); audio.death(); }

    cam = clampCamera(p.x + p.w / 2, level);
    world.projectiles = world.projectiles.filter((pr) => pr.alive && pr.x > cam.x - 64 && pr.x < cam.x + VIEW_W + 64);
```
(Note: the old `// win at flag` block is intentionally dropped — winning is now boss defeat.)

- [ ] **Step 5: Verify.** `cd /Users/bytedance/rookie && node --check src/main.mjs && echo OK`

- [ ] **Step 6: Commit.**
```bash
cd /Users/bytedance/rookie
git add src/main.mjs
git commit -m "feat: wire throw attack and boss fight into the loop"
```

---

## Task 9: `audio.mjs` + bundler

**Files:** Modify `src/audio.mjs`, `tools/build.mjs`; regenerate `super-malao.html`.

- [ ] **Step 1: Add SFX.** In `src/audio.mjs`, in the returned object (after the `win:` entry), add:
```javascript
    throw: () => beep(420, 0.12, 'square', 900),
    bossHit: () => beep(140, 0.16, 'sawtooth', 60),
```
Verify: `cd /Users/bytedance/rookie && node --check src/audio.mjs && echo OK`

- [ ] **Step 2: Bundler ORDER + hint.** In `tools/build.mjs`:
  - Change the `ORDER` array from:
    ```javascript
    const ORDER = ['sprites', 'level', 'physics', 'entities', 'state', 'audio', 'input', 'render', 'main'];
    ```
    to:
    ```javascript
    const ORDER = ['sprites', 'level', 'physics', 'entities', 'projectile', 'boss', 'state', 'audio', 'input', 'render', 'main'];
    ```
  - Update the HTML hint line from `... 空格 / ↑ / W 跳 · R 重开 ...` to include `· J 攻击`:
    ```html
      <div class="hint">← → / A D 移动 · 空格 / ↑ / W 跳 · J 攻击 · R 重开 · Enter 开始 · M 静音</div>
    ```

- [ ] **Step 3: Rebuild + verify self-contained.**
```bash
cd /Users/bytedance/rookie
node tools/build.mjs
grep -c 'data:image/png;base64' super-malao.html   # expect 5 now (4 hero + villain)
grep -cE '^\s*import\s' super-malao.html            # expect 0
node --input-type=module -e "import {readFileSync,writeFileSync} from 'node:fs'; const m=readFileSync('super-malao.html','utf8').match(/<script type=\"module\">([\s\S]*?)<\/script>/); writeFileSync('/tmp/b.mjs', m[1]);" && node --check /tmp/b.mjs && echo "BUNDLE JS OK" && rm -f /tmp/b.mjs
```
Expected: 5 data URIs, 0 imports, `BUNDLE JS OK`.

- [ ] **Step 4: Commit.**
```bash
cd /Users/bytedance/rookie
git add src/audio.mjs tools/build.mjs super-malao.html
git commit -m "feat: throw/bossHit SFX; bundle projectile+boss into single file"
```

---

## Task 10: Browser smoke + final verification

> Acceptance gate. Use Claude Preview MCP (serve dir via `.claude/launch.json` name `scb`, port 8099; navigate to `http://localhost:8099/super-malao.html`). NOTE: if the preview tab is hidden, `requestAnimationFrame` is throttled and the loop won't run — in that case rely on the Node suite + bundle checks and say so honestly. Use `window.__GAME__` (`state`, `player`) for assertions.

- [ ] **Step 1: Full suite.** `cd /Users/bytedance/rookie && node --test` → all suites (level, physics, entities, state, projectile, boss) pass, 0 fail.

- [ ] **Step 2: Serve + load.** `preview_start` name `scb`; navigate to `http://localhost:8099/super-malao.html?v=boss`; confirm `window.__GAME__` exists, phase `TITLE`, console clean; screenshot title (hint shows `J 攻击`).

- [ ] **Step 3: Throw kills a goomba.** Start (Enter). Position player just left of a goomba (`window.__GAME__.player.x = 22*32 - 60; player.y` near ground), face right, dispatch `keydown/keyup` `KeyJ`; over ~1s confirm score increased by 200 (goomba killed by projectile). Screenshot.

- [ ] **Step 4: Boss fight → win.** Move player to the boss arena (`player.x = 78*32`). Confirm the Boss + HP HUD render (screenshot). Throw 3 times (with gaps > cooldown+invuln, i.e. ~0.6s apart) OR assert programmatically: read `window.__GAME__.state.phase` transitions to `WIN` after 3 landed hits. Confirm the `通关！` overlay and that touching the boss (`player.x = boss.x`) before defeat triggers a life loss (phase `DEAD` / lives decremented). Screenshot the win.

- [ ] **Step 5: Replay resets boss + blocks.** From WIN press Enter; confirm phase `PLAYING`, `window.__GAME__` fresh (score 0). (Boss hp resets via freshWorld; `?` blocks reset via the existing level rebuild.)

- [ ] **Step 6: Stop server, rebuild, commit evidence.**
```bash
cd /Users/bytedance/rookie
node --test && node tools/build.mjs
git add super-malao.html
git commit -m "test: browser smoke — throw, boss fight, win, replay reset" || echo "nothing to recommit"
```

---

## Self-Review (plan author)

**1. Spec coverage:**
- §4 throw attack (key J, cooldown, max 3, spawn, fly, hit enemy/boss/wall, despawn) → Tasks 4, 6, 8. Spawn height refined to knee (documented above).
- §5 boss (shape, spawn 'V', arena pace, contact=death, damage+invuln+flash, defeat=win, progress on respawn / reset) → Tasks 2, 5, 8; reset relies on the existing `resetRun()` rebuild (freshWorld now includes boss).
- §6 level 'V' + flag→scenery + win=boss-defeat → Tasks 2, 8 (flag win block removed; flag still drawn by existing `drawFlag`).
- §7 render (villain sprite, projectiles, flash, HP HUD) → Tasks 1, 7.
- §8 audio (throw/bossHit) + control hint → Tasks 9, 7 (+ build hint).
- §9 code structure (new modules, edits, bundler order) → Tasks 4, 5, 2, 3, 6, 7, 8, 9.
- §11 tests → Tasks 2–5 (Node), Task 10 (smoke).

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**3. Type consistency:** Names verified across tasks: `makeProjectile/stepProjectile/hits/ATTACK_COOLDOWN/PROJECTILE_W/MAX_PROJECTILES` (projectile), `makeBoss/stepBoss/damageBoss/BOSS_*` (boss), `level.boss`, `'bossHit'` event, `world.boss`/`world.projectiles`, `SPRITES.villain`/`SPRITE_NATURAL.villain`, `assets.images/masks/natural.villain`, `audio.throw/bossHit`. `drawBoss` reuses existing `drawHero` (defined in render.mjs). Bundler ORDER places `projectile`/`boss` after `level` (their dependency) and before `render`/`main` (their consumers).

**Known follow-ups (non-blocking):** villain cutout threshold and boss/attack feel (hp, cooldown, contact=death harshness) are tuned by eye in Tasks 1 & 10; all flagged in the spec as tunable.
