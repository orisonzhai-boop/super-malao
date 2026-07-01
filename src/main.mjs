import { TILE, makeLevel, LEVEL, setTile, questionBumpTile } from './level.mjs';
import { makePlayer, stepPlayer } from './physics.mjs';
import { makeEnemy, stepEnemy, stompCheck } from './entities.mjs';
import { initialGame, reduce } from './state.mjs';
import { createInput } from './input.mjs';
import { createAudio } from './audio.mjs';
import { SPRITES, SPRITE_NATURAL } from './sprites.mjs';
import { drawScene, makeWhiteMask, VIEW_W, VIEW_H } from './render.mjs';
import { makeProjectile, stepProjectile, hits, ATTACK_COOLDOWN, PROJECTILE_W, MAX_PROJECTILES } from './projectile.mjs';
import { makeBoss, stepBoss, damageBoss } from './boss.mjs';

const SPAWN = { x: 2 * TILE, y: 0 };
const STEP = 1000 / 60;

function loadImages(map) {
  const names = Object.keys(map);
  return Promise.all(names.map((n) => new Promise((res) => {
    const img = new Image();
    img.onload = () => res([n, img]);
    img.src = map[n];
  }))).then((pairs) => Object.fromEntries(pairs));
}

function freshWorld(level) {
  return {
    player: makePlayer(SPAWN.x, SPAWN.y),
    enemies: level.goombas.map((g) => makeEnemy(g.col * TILE, g.row * TILE)),
    coins: level.coins.map((c) => ({ ...c, taken: false })),
    boss: level.boss ? makeBoss(level.boss.col, level.boss.row) : null,
    projectiles: [],
  };
}

function clampCamera(px, level) {
  const x = px - VIEW_W / 2;
  return { x: Math.max(0, Math.min(level.cols * TILE - VIEW_W, x)) };
}

export async function boot() {
  const canvas = document.getElementById('game');
  canvas.width = VIEW_W; canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;

  const images = await loadImages(SPRITES);
  const masks = Object.fromEntries(Object.keys(images).map((n) => [n, makeWhiteMask(images[n])]));
  const assets = { images, masks, natural: SPRITE_NATURAL };

  const input = createInput();
  const audio = createAudio();
  let level = makeLevel(LEVEL);

  let game = initialGame();
  let world = freshWorld(level);
  let cam = { x: 0 };
  let anim = 0;
  let prevStart = false, prevRestart = false, prevMute = false, prevAttack = false;
  let attackCd = 0;

  // Full restart rebuilds the level from the immutable LEVEL template so spent
  // '?' blocks (mutated to 'U' in place) are restored for a fresh playthrough.
  function resetRun() { level = makeLevel(LEVEL); world = freshWorld(level); cam = { x: 0 }; }
  // Respawn after a death keeps level/world progress (coins, kills, spent blocks); only the player + camera reset.
  function respawn() { world.player = makePlayer(SPAWN.x, SPAWN.y); cam = { x: 0 }; }

  function update() {
    anim++;
    const startEdge = input.start && !prevStart;
    const restartEdge = input.restart && !prevRestart;
    const muteEdge = input.mute && !prevMute;
    const attackEdge = input.attack && !prevAttack;
    prevStart = input.start; prevRestart = input.restart; prevMute = input.mute; prevAttack = input.attack;
    if (muteEdge) audio.toggleMute();

    if (game.phase === 'TITLE' || game.phase === 'GAMEOVER') {
      if (startEdge) { game = reduce(game, { type: 'start' }); resetRun(); }
      return;
    }
    if (game.phase === 'WIN') {
      if (startEdge) { game = reduce(game, { type: 'reset' }); game = reduce(game, { type: 'start' }); resetRun(); }
      return;
    }
    if (game.phase === 'DEAD') {
      if (restartEdge) { game = reduce(game, { type: 'respawn' }); respawn(); }
      return;
    }

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
      audio.throw?.();
    }

    for (const e of world.enemies) stepEnemy(e, level);

    // projectiles: advance, then resolve against boss/enemies/walls
    for (const pr of world.projectiles) stepProjectile(pr, level);
    for (const pr of world.projectiles) {
      if (!pr.alive) continue;
      if (world.boss && world.boss.alive && hits(pr, world.boss)) {
        if (damageBoss(world.boss)) { pr.alive = false; game = reduce(game, { type: 'bossHit' }); audio.bossHit?.(); }
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
  }

  let acc = 0, last = performance.now();
  function frame(now) {
    acc += now - last; last = now;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      update();
      acc -= STEP; steps++;
    }
    drawScene(ctx, cam, level, world, game, assets, anim);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__GAME__ = { get state() { return game; }, get player() { return world.player; }, get world() { return world; }, input };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => { boot(); });
}
