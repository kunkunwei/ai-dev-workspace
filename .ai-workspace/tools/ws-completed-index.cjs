'use strict';

// 把 tasks/completed.md 从「详情堆」改为「纯索引」，详情整体搬到 tasks/archive/completed-detail-YYYY-MM.md。
// 不丢失任何内容：详情是移动而非删除。
//   node .ai-workspace/tools/ws-completed-index.cjs --dry

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'tasks', 'completed.md');
const ARCHIVE_DIR = path.join(ROOT, 'tasks', 'archive');
const DETAIL = path.join(ARCHIVE_DIR, 'completed-detail-2026-09.md');
const EOL = '\r\n';
const DATE_RE = /(20\d{2}-\d{2}-\d{2})/;

function buildIndex(entries) {
  const out = [];
  out.push('# 已完成任务（completed）');
  out.push('');
  out.push('> **本文件只是索引**：一条一行（id · 日期 · 摘要 · 详情位置）。');
  out.push(`> 完整结论与证据在 \`tasks/archive/completed-detail-2026-09.md\`，默认不读。`);
  out.push('> 由 `tools/ws-completed-index.cjs` 生成，禁止手工编辑。');
  out.push('');
  out.push('| 日期 | 任务 | 详情 |');
  out.push('| --- | --- | --- |');
  for (const e of entries) {
    const title = e.heading.replace(/^##\s+/, '').replace(/\|/g, '\\|').trim();
    out.push(`| ${e.date} | ${title} | \`tasks/archive/completed-detail-2026-09.md\` |`);
  }
  out.push('');
  return out.join(EOL);
}

function main() {
  const dry = process.argv.includes('--dry');
  const text = fs.readFileSync(SRC, 'utf8');
  const lines = text.split(/\r?\n/);

  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (cur) blocks.push(cur);
      cur = { heading: line, lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) blocks.push(cur);

  let lastDate = '';
  const entries = blocks.map((b) => {
    const m = b.heading.match(DATE_RE);
    if (m) lastDate = m[1];
    return { heading: b.heading, date: lastDate || '—' };
  });

  const indexText = buildIndex(entries);
  const detailText = [
    '# 已完成任务 · 详情归档（2026-09）',
    '',
    '> 由 `tasks/completed.md` **整体移动**而来（非删除、正文未改）。',
    '> 默认不读取；需要具体结论、证据与备份路径时按标题定位。',
    '',
    ...lines,
  ].join(EOL);

  console.log(`原 completed.md ${Buffer.byteLength(text)} B → 索引 ${Buffer.byteLength(indexText)} B，详情归档 ${Buffer.byteLength(detailText)} B`);
  console.log(`条目 ${entries.length} 条`);

  if (dry) {
    console.log('\n--dry：未写入任何文件');
    return;
  }
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  fs.writeFileSync(DETAIL, detailText, 'utf8');
  fs.writeFileSync(SRC, indexText, 'utf8');
  console.log(`WROTE tasks/archive/completed-detail-2026-09.md`);
  console.log(`WROTE tasks/completed.md`);
}

main();