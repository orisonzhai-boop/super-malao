# 超级玛拉奥 — Boss 反派 + 投掷攻击 设计规格

- 日期：2026-06-27
- 状态：已与用户对齐设计，待评审后进入实现计划
- 基于：现有单文件 HTML 游戏（`src/*.mjs` 模块 + `tools/build.mjs` 打包 → `super-malao.html`，已上线 GitHub Pages）

## 1. 概述

给主角 Malao 增加**远程投掷攻击**，并在关卡末尾放一个 **Boss 反派**（使用用户新提供的手绘图 `assets/villain_src.jpg`）。**击败 Boss = 通关**，取代当前"碰到旗杆通关"。

## 2. 目标与非目标

### 目标
- Malao 可按键投掷飞行物，命中并消灭小怪、对 Boss 造成伤害。
- 关末一个 Boss：来回踱步、碰到玩家使其掉命、需被投掷物命中 3 次击败；击败即通关。
- Boss 使用用户手绘 `villain_src.jpg`（无猫耳，与 Malao 区分）。
- 沿用现有模块化 + 打包，交付仍是自包含单文件 `super-malao.html`。

### 非目标（YAGNI）
- Boss 多阶段 / 弹幕 / 多种攻击模式
- 瞄准方向（只朝左右两个朝向投掷）
- 弹药上限 / 弹药拾取
- 多个 Boss、多关卡

## 3. 验收标准

1. 按 `J` 朝当前朝向投掷一个飞行物；命中小怪即消灭并加分；撞到实心砖/水管或飞出视野即消失。
2. 投掷有冷却（防连发），屏幕上最多同时 3 个飞行物。
3. 关末出现 Boss：左右踱步、到竞技场边界掉头。
4. 玩家碰到 Boss（任何方向）→ 掉 1 命（踩不死）。
5. 投掷物命中 Boss → 扣 1 血 + 短暂无敌闪白；命中 3 次 → Boss 击败 → 通关结算页。
6. 中途死亡后重生（按 R），Boss 血量与本局进度（金币、已顶问号块、已消灭小怪）保留；整局重开（通关后 Enter / Game Over 后 Enter）→ Boss 满血、问号块复位、全部重置。
7. 操作提示（标题页 + 底部）显示 `J 攻击`。
8. 浏览器控制台无报错；单元测试全绿。

## 4. 玩法：投掷攻击

- 按键 `J` = attack。按下瞬间（上升沿）且冷却结束且当前飞行物数 < 3 时，生成一个飞行物并进入冷却。
- 冷却：`ATTACK_COOLDOWN = 18` 帧（约 0.3s）。
- 飞行物：`{ x, y, w:14, h:14, vx, alive }`。
  - 生成位置：面向侧、胸口高度。`x = facing > 0 ? player.x + player.w : player.x - 14`；`y = player.y + 18`；`vx = facing * PROJECTILE_SPEED`（`PROJECTILE_SPEED = 7`）。
  - 直线飞行（无重力）。每帧 `x += vx`。
  - 消失条件：撞到实心瓦片（`isSolid`）、命中小怪/Boss、或离开视野超过边距（飞出 `[cam.x - 64, cam.x + VIEW_W + 64]`）。
- 命中判定（AABB 重叠）：
  - 命中存活小怪 → 小怪 `alive=false`，计分（复用 `stomp` 事件 = 消灭敌人 +200），飞行物消失。
  - 命中存活且非无敌的 Boss → `damageBoss()`，计分（新事件 `bossHit` +300），飞行物消失。
  - 撞到实心瓦片 → 飞行物消失。

## 5. 玩法：Boss

- 形状：`{ x, y, w:48, h:60, vx, dir, hp:3, alive:true, invuln:0 }`。体型大于小怪。
- 出生：关卡瓦片标记 `V`（约第 80 格、第 11 行），`makeLevel` 解析为 `level.boss = {col,row}`（单个）。生成时贴地，沿用 `makeEnemy` 的公式：`x = col*TILE`，`y = row*TILE + (TILE - h)`（h=60 时 = `row*TILE - 28`，底部正好落在下方地面行顶）。
- 竞技场：以出生点为中心的水平区间 `[spawnX - 4*TILE, spawnX + 4*TILE]`（关末平地，现有地形足够）。踱步速度 `BOSS_SPEED = 1.5`；到区间边界掉头。
- 与玩家接触：Boss 存活且与玩家 AABB 重叠 → 玩家 `death` 事件（掉 1 命）。**不可踩踏**。
- 受击：`damageBoss(boss)` → 若 `invuln>0` 忽略；否则 `hp--`、`invuln = BOSS_INVULN(30)` 帧、轻微击退（`boss.x += dir 反向 8px` 可选），闪白显示。`hp<=0` → `alive=false`。
- 每帧 `invuln` 递减。
- 击败：Boss `hp<=0`（或 `!alive`）且 `phase==='PLAYING'` → `win` 事件 → 通关结算。
- 死亡重生（DEAD→R）保留 Boss 状态（血量/位置）；整局重开经 `resetRun()` 重建 `world`（含满血 Boss）与 `level`（问号块复位）。

## 6. 关卡改动

- 新瓦片标记 `V`（非实心，解析后从碰撞网格剔除，同 `o`/`g`/`F`）。在关末约 (row 11, col 80) 放一个 `V`。
- 旗杆保留绘制作为背景装饰；**通关条件由"碰旗杆"改为"击败 Boss"**——移除 `main.mjs` 中碰旗杆触发 `win` 的逻辑（旗杆仅渲染）。
- 其余关卡不变。

## 7. 美术 / 渲染

- Boss sprite：切图脚本额外处理 `assets/villain_src.jpg`（整图去近白底→透明→按内容裁切→缩放到 ~72px 高），base64 内嵌，输出 `SPRITES.villain` + `SPRITE_NATURAL.villain`。朝向用 `ctx.scale` 翻转；`invuln>0` 时叠加半透明白色闪光表示受击。
- 飞行物：代码绘制的小"能量团"（实心圆 + 高光点 + 短尾迹），描边风格与世界一致。
- 血条 HUD：Boss 存活且在屏幕内时，屏幕顶部中间显示 `BOSS` 文字 + 3 颗心（按 `hp` 显示实心/空心）。
- 主角投掷时可复用现有 run/idle 帧（不强制新增攻击帧；姿态帧沿用）。

## 8. 音效 & 操作

- 新音效（WebAudio 合成，无素材）：投掷 `throw`（短促上滑）、Boss 中弹 `bossHit`（闷响）、Boss 击败复用/加强 `win` 琶音。
- `M` 静音仍覆盖全部。
- 操作：新增 `J`=攻击。标题页 overlay 与页面底部提示加入 `J 攻击`。

## 9. 代码结构

新增纯逻辑模块（Node 可单测）：
- `src/projectile.mjs`：`makeProjectile(x,y,dir)`、`stepProjectile(proj, level)`（移动 + 撞实心瓦片判定，返回是否命中墙）、`hits(a,b)` AABB 重叠helper。
- `src/boss.mjs`：`makeBoss(col,row,level)`、`stepBoss(boss)`（竞技场踱步 + 掉头 + invuln 递减）、`damageBoss(boss)`（扣血/无敌/击败）。

改动：
- `src/level.mjs`：解析 `V` → `level.boss`；`setTile`/`isSolid` 不变（`V` 非实心）。
- `src/state.mjs`：新增 `case 'bossHit': score += 300`（仅 PLAYING）。
- `src/input.mjs`：`KeyJ` → `attack`。
- `src/render.mjs`：绘制飞行物、Boss（sprite+翻转+闪白）、Boss 血条 HUD；标题 overlay 提示加 `J 攻击`。
- `src/main.mjs`：`freshWorld` 增加 `boss`（从 `level.boss`）与 `projectiles:[]`；`update()` 处理攻击输入→生成飞行物、飞行物步进与命中、Boss 步进/接触/击败→win；移除碰旗杆 win；攻击冷却计数；HUD 数据。
- `tools/slice_hero.py`（或新增处理段）：额外产出 `villain` 帧到 `src/sprites.mjs`。
- `tools/build.mjs`：`ORDER` 增加 `projectile`、`boss`（在 `main` 之前、依赖 `level` 之后）；HTML 底部提示加 `J 攻击`。

## 10. 参数默认值（实现期可调）

- `ATTACK_COOLDOWN = 18`、`PROJECTILE_SPEED = 7`、最多 3 个飞行物、飞行物 14×14。
- Boss `hp = 3`、`w=48 h=60`、`BOSS_SPEED = 1.5`、`BOSS_INVULN = 30`、竞技场半宽 `4*TILE`。
- `bossHit` 计分 +300；投掷杀小怪复用 `stomp` +200。
- Boss 出生 `V` 位于 (row 11, col 80)。

## 11. 测试与验收证据

- 单测：
  - `projectile.mjs`：朝右/朝左生成方向正确；`stepProjectile` 按 `vx` 移动；撞实心瓦片返回命中；`hits` 重叠判定。
  - `boss.mjs`：`makeBoss` hp=3 且贴地；`stepBoss` 在竞技场边界掉头；`damageBoss` 扣血 + 设无敌 + 无敌期内二次命中被忽略 + 归零 `alive=false`。
  - `level.mjs`：`V` 解析为 `level.boss`（且从碰撞网格剔除）。
  - `state.mjs`：`bossHit` 加分且仅 PLAYING。
- 浏览器冒烟（Claude Preview MCP，若标签可见）：投掷消灭小怪；走到 Boss；命中 3 次→通关；碰 Boss 掉命；整局重开后 Boss 满血且问号块复位。控制台无报错。若预览标签被浏览器隐藏导致 rAF 暂停，则以 Node 确定性测试 + 打包产物核验为主，如实说明。

## 12. 风险与缓解

- "碰 Boss 掉整条命"偏硬 → 先按 3 血 + 死亡重生保留 Boss 血量做；手感不对再调（如加受击后短暂无敌帧、或改为扣血而非直接掉命）。
- 重生回到关卡起点、需走回 Boss → v1 接受（Boss 在关末，走回是惩罚）；如嫌繁琐后续可加就近检查点。
- 投掷物直线无重力可能显得单调 → v1 直线优先（好瞄准、易实现）；后续可选加轻微抛物线。
