import { TILE, makeLevel, LEVEL, setTile, questionBumpTile } from './level.mjs';
import { makePlayer, stepPlayer } from './physics.mjs';
import { makeEnemy, stepEnemy, stompCheck } from './entities.mjs';
import { initialGame, reduce } from './state.mjs';
import { createInput } from './input.mjs';
import { createAudio } from './audio.mjs';
import { SPRITES, SPRITE_NATURAL } from './sprites.mjs';
import { drawScene, makeWhiteMask, VIEW_W, VIEW_H } from './render.mjs';

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
  const level = makeLevel(LEVEL);

  let game = initialGame();
  let world = freshWorld(level);
  let cam = { x: 0 };
  let anim = 0;
  let prevStart = false, prevRestart = false, prevMute = false;

  function resetRun() { world = freshWorld(level); cam = { x: 0 }; }
  function respawn() { world.player = makePlayer(SPAWN.x, SPAWN.y); cam = { x: 0 }; }

  function update() {
    anim++;
    const startEdge = input.start && !prevStart;
    const restartEdge = input.restart && !prevRestart;
    const muteEdge = input.mute && !prevMute;
    prevStart = input.start; prevRestart = input.restart; prevMute = input.mute;
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

    for (const e of world.enemies) stepEnemy(e, level);

    // player vs enemies
    for (const e of world.enemies) {
      const res = stompCheck(p, e);
      if (res === 'stomp') { e.alive = false; p.vy = -8; game = reduce(game, { type: 'stomp' }); audio.stomp(); }
      else if (res === 'hit') { game = reduce(game, { type: 'death' }); audio.death(); break; }
    }

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

    // win at flag
    if (level.flagCol >= 0 && p.x + p.w / 2 >= level.flagCol * TILE && game.phase === 'PLAYING') {
      game = reduce(game, { type: 'win' }); audio.win();
    }

    cam = clampCamera(p.x + p.w / 2, level);
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

  window.__GAME__ = { get state() { return game; }, get player() { return world.player; }, input };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => { boot(); });
}
