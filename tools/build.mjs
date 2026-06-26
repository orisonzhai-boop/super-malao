// Inline all src modules + base64 sprites into a single self-contained HTML file.
// Removes `import ... from '...'` lines (everything shares one inline module scope).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['sprites', 'level', 'physics', 'entities', 'state', 'audio', 'input', 'render', 'main'];

let body = '';
for (const name of ORDER) {
  const src = readFileSync(join(ROOT, 'src', `${name}.mjs`), 'utf8');
  const stripped = src.replace(/^[ \t]*import[\s\S]*?;[ \t]*$/gm, '');
  body += `\n// ===== ${name}.mjs =====\n` + stripped + '\n';
}

const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>超级喵拉奥 / Super Cat Bro</title>
<style>
  html, body { margin: 0; height: 100%; background: #1b1b22; }
  .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; font-family: sans-serif; color: #ddd; }
  canvas { background: #9bd6ff; image-rendering: pixelated; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,0.4); max-width: 96vw; height: auto; }
  .hint { font-size: 13px; opacity: 0.7; }
</style>
</head>
<body>
<div class="wrap">
  <canvas id="game" width="800" height="448"></canvas>
  <div class="hint">← → / A D 移动 · 空格 / ↑ / W 跳 · R 重开 · Enter 开始 · M 静音</div>
</div>
<script type="module">
${body}
</script>
</body>
</html>
`;

const out = join(ROOT, 'super-cat-bro.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${html.length} bytes)`);
