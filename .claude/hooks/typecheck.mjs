// PostToolUse フック: src 配下の .ts を編集したら自動で typecheck を走らせ、
// 型崩れがあれば Claude にフィードバックする（決定論的な品質ゲート）。
// docs/dev-process.md「継続的改善のトリガ」の一つ。
import { execSync } from 'node:child_process';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let fp = '';
  try { fp = JSON.parse(input)?.tool_input?.file_path ?? ''; } catch { /* noop */ }
  const norm = fp.replace(/\\/g, '/');
  if (!/\/src\/.*\.ts$/.test(norm)) process.exit(0); // src の .ts 以外は無視（docs等で走らせない）
  try {
    execSync('npm run typecheck', { stdio: 'pipe' });
    process.exit(0);
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    console.error('TypeScript 型エラー（直近の編集で型が崩れています）:\n' + out);
    process.exit(2); // 2 = Claude にこの内容を返す
  }
});
