import { TILE, tileChar } from './level.mjs';

export const VIEW_W = 800;
export const VIEW_H = 448;

const C = {
  sky: '#9bd6ff', hill: '#62b545', cloud: '#ffffff',
  dirt: '#c77b3a', grass: '#6abe30', dirtLine: '#9c5a26',
  brick: '#b5651d', brickLine: '#7c4310',
  qblock: '#f4b400', qStroke: '#a06f00', qText: '#7a5300',
  used: '#b08a5a', usedLine: '#7c5a30',
  pipe: '#2ea44f', pipeStroke: '#1b7a37',
  coin: '#ffd23f', coinStroke: '#c79400',
  goomba: '#9c5a2c', goombaFoot: '#6b3b18',
  pole: '#bdbdbd', flag: '#e24b4a', flagStroke: '#a32d2d',
  hud: 'rgba(0,0,0,0.55)', hudText: '#ffffff', hudCoin: '#ffd23f', hudLife: '#ff8a8a',
  overlay: 'rgba(0,0,0,0.6)', overlayText: '#ffffff',
};

// Build a solid-white silhouette of an image (for the outline halo).
export function makeWhiteMask(img) {
  const o = document.createElement('canvas');
  o.width = img.width; o.height = img.height;
  const x = o.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, o.width, o.height);
  return o;
}

function drawHero(ctx, img, mask, dx, dy, dw, dh, facing) {
  ctx.save();
  ctx.translate(dx + dw / 2, 0);
  ctx.scale(facing < 0 ? -1 : 1, 1);
  const ox = -dw / 2;
  const offs = [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2]];
  for (const [a, b] of offs) ctx.drawImage(mask, ox + a, dy + b, dw, dh);
  ctx.drawImage(img, ox, dy, dw, dh);
  ctx.restore();
}

function drawBackground(ctx, camX) {
  ctx.fillStyle = C.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = C.hill;
  const px = -((camX * 0.4) % 400);
  for (let i = -1; i < 4; i++) {
    const hx = px + i * 400;
    ctx.beginPath();
    ctx.ellipse(hx + 120, VIEW_H - 64, 150, 90, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = C.cloud;
  const cx = -((camX * 0.25) % 360);
  for (let i = -1; i < 4; i++) {
    const x = cx + i * 360 + 80, y = 70 + (i % 2) * 30;
    ctx.beginPath();
    ctx.ellipse(x, y, 34, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 24, y + 6, 22, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26, y + 6, 24, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTile(ctx, ch, sx, sy) {
  if (ch === '#') {
    ctx.fillStyle = C.dirt; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.fillStyle = C.grass; ctx.fillRect(sx, sy, TILE, 8);
    ctx.strokeStyle = C.dirtLine; ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
  } else if (ch === 'B') {
    ctx.fillStyle = C.brick; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = C.brickLine; ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
    ctx.beginPath(); ctx.moveTo(sx, sy + TILE / 2); ctx.lineTo(sx + TILE, sy + TILE / 2);
    ctx.moveTo(sx + TILE / 2, sy); ctx.lineTo(sx + TILE / 2, sy + TILE); ctx.stroke();
  } else if (ch === '?') {
    ctx.fillStyle = C.qblock; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = C.qStroke; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = C.qText; ctx.font = '20px monospace'; ctx.textAlign = 'center';
    ctx.fillText('?', sx + TILE / 2, sy + TILE / 2 + 7);
  } else if (ch === 'P') {
    ctx.fillStyle = C.pipe; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = C.pipeStroke; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
  } else if (ch === 'U') {
    ctx.fillStyle = C.used; ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = C.usedLine; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = C.usedLine; ctx.fillRect(sx + TILE / 2 - 5, sy + TILE / 2 - 1, 10, 3);
  }
}

function drawTiles(ctx, level, cam) {
  const startCol = Math.max(0, Math.floor(cam.x / TILE));
  const endCol = Math.min(level.cols - 1, Math.floor((cam.x + VIEW_W) / TILE) + 1);
  for (let r = 0; r < level.rows; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const ch = tileChar(level, c, r);
      if (ch !== ' ') drawTile(ctx, ch, c * TILE - cam.x, r * TILE);
    }
  }
}

function drawCoins(ctx, coins, cam, spin) {
  ctx.lineWidth = 2;
  for (const co of coins) {
    if (co.taken) continue;
    const x = co.col * TILE + TILE / 2 - cam.x;
    const y = co.row * TILE + TILE / 2;
    if (x < -16 || x > VIEW_W + 16) continue;
    const rx = 8 * Math.abs(Math.cos(spin * 0.1 + co.col));
    ctx.fillStyle = C.coin; ctx.strokeStyle = C.coinStroke;
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(2, rx), 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function drawEnemies(ctx, enemies, cam) {
  for (const e of enemies) {
    if (!e.alive) continue;
    const x = e.x - cam.x, y = e.y;
    if (x < -40 || x > VIEW_W + 40) continue;
    ctx.fillStyle = C.goomba;
    ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + 8, e.w / 2, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x + 2, y + 6, e.w - 4, e.h - 6);
    ctx.fillStyle = C.goombaFoot;
    ctx.fillRect(x + 1, y + e.h - 5, 9, 5); ctx.fillRect(x + e.w - 10, y + e.h - 5, 9, 5);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + e.w / 2 - 6, y + 6, 4, 0, Math.PI * 2); ctx.arc(x + e.w / 2 + 6, y + 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(x + e.w / 2 - 6, y + 7, 2, 0, Math.PI * 2); ctx.arc(x + e.w / 2 + 6, y + 7, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFlag(ctx, level, cam) {
  if (level.flagCol < 0) return;
  const x = level.flagCol * TILE + TILE / 2 - cam.x;
  if (x < -40 || x > VIEW_W + 40) return;
  ctx.strokeStyle = C.pole; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x, 2 * TILE); ctx.lineTo(x, 12 * TILE); ctx.stroke();
  ctx.fillStyle = C.flag; ctx.strokeStyle = C.flagStroke; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, 2 * TILE + 4); ctx.lineTo(x + 40, 2 * TILE + 16);
  ctx.lineTo(x, 2 * TILE + 28); ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawHUD(ctx, game) {
  ctx.fillStyle = C.hud; ctx.fillRect(16, 14, 300, 34);
  ctx.font = '16px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = C.hudText; ctx.fillText(`Score ${game.score}`, 28, 37);
  ctx.fillStyle = C.hudCoin; ctx.fillText(`Coins ${game.coins}`, 140, 37);
  ctx.fillStyle = C.hudLife; ctx.fillText(`Lives ${game.lives}`, 240, 37);
}

function drawOverlay(ctx, lines) {
  ctx.fillStyle = C.overlay; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = C.overlayText; ctx.textAlign = 'center';
  ctx.font = '36px sans-serif';
  ctx.fillText(lines[0], VIEW_W / 2, VIEW_H / 2 - 20);
  ctx.font = '18px sans-serif';
  for (let i = 1; i < lines.length; i++) ctx.fillText(lines[i], VIEW_W / 2, VIEW_H / 2 + 20 + (i - 1) * 28);
}

// Main draw entry. world={player,enemies,coins}; assets={images,masks,natural}; anim=frame counter.
export function drawScene(ctx, cam, level, world, game, assets, anim) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawBackground(ctx, cam.x);
  drawTiles(ctx, level, cam);
  drawCoins(ctx, world.coins, cam, anim);
  drawFlag(ctx, level, cam);
  drawEnemies(ctx, world.enemies, cam);

  const p = world.player;
  let frame = 'idle';
  if (p.state === 'jump') frame = 'jump';
  else if (p.state === 'run') frame = (Math.floor(anim / 8) % 2 === 0) ? 'runA' : 'runB';
  const img = assets.images[frame], mask = assets.masks[frame], nat = assets.natural[frame];
  const dh = 64, dw = dh * (nat.w / nat.h);
  const dx = p.x + p.w / 2 - dw / 2 - cam.x;
  const dy = p.y + p.h - dh + 4;
  ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(p.x + p.w / 2 - cam.x, p.y + p.h, 16, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  drawHero(ctx, img, mask, dx, dy, dw, dh, p.facing);

  drawHUD(ctx, game);

  if (game.phase === 'TITLE') drawOverlay(ctx, ['超级喵拉奥 / Super Cat Bro', '按 Enter 开始', '← → 移动 · 空格跳 · M 静音']);
  else if (game.phase === 'DEAD') drawOverlay(ctx, ['你挂了', `按 R 继续 (剩 ${game.lives} 命)`]);
  else if (game.phase === 'GAMEOVER') drawOverlay(ctx, ['Game Over', '按 Enter 重来']);
  else if (game.phase === 'WIN') drawOverlay(ctx, ['通关！', `得分 ${game.score} · 按 Enter 重来`]);
}
