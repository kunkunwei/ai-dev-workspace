'use strict';

// 一次性迁移：把 tasks/current.md 按时间线拆分为「活动窗口 + 归档」。
// 规则（用户 2026-09-23 指示：按时间顺序判定活/死）：
//   - 日期 >= KEEP_FROM 的块保留在 current.md（近期 Robot-G1 改动与 ROS2 迁移）
//   - 长期生效的约束类 ## 块强制保留，不随日期归档
//   - 其它块整体移入 tasks/archive/tasks-YYYY-MM.md，正文一字不改
//   - current.md 底部生成「已归档索引」，每条一行，指向归档文件
// 不丢失任何内容：归档是移动而非删除。
//   node .ai-workspace/tools/ws-archive-split.cjs
//   node .ai-workspace/tools/ws-archive-split.cjs --dry

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'tasks', 'current.md');
const ARCHIVE_DIR = path.join(ROOT, 'tasks', 'archive');

// 09-17 及更早的视频/固件任务已确认作废（H.264 交接文档自标「不要照它实现」，
// MJPEG 链路已被 Foxglove 取代），因此活动窗口从 09-18 起，
// 这也正好等于 current.md 原本自己维护的头部（09-18 / 09-19 / 09-21）。
const KEEP_FROM = '2026-09-18';
// 长期生效的约束块：不归档。
const KEEP_HEADING_RE = [/^##\s*并行 Agent 占用范围/, /^##\s*新增工作台约束/];
// 散落在被归档块内部的长期规则：提升到活动文件，避免随任务块一起沉底。
const PROMOTE_RE = /^###\s*.*规则增补/;

const EOL = '\r\n';
const DATE_RE = /(20\d{2}-\d{2}-\d{2})/;

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

function monthOf(date) {
  return date.slice(0, 7);
}

function isKeepHeading(heading) {
  if (!heading) return false;
  const m = heading.match(DATE_RE);
  if (m && m[1] >= KEEP_FROM) return true;
  return KEEP_HEADING_RE.some((re) => re.test(heading));
}

function splitBlocks(lines) {
  const preamble = [];
  const blocks = [];
  let cur = null;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (cur) blocks.push(cur);
      cur = { heading: line, lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (cur) blocks.push(cur);
  return { preamble, blocks };
}

// 在归档块内部找出被提升的 ### 规则增补 段落。
function extractPromoted(lines) {
  const promoted = [];
  for (let i = 0; i < lines.length; i++) {
    if (!PROMOTE_RE.test(lines[i])) continue;
    const seg = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{2,3}\s/.test(lines[j])) break;
      seg.push(lines[j]);
    }
    promoted.push(seg.join('\n').replace(/\n+$/, ''));
    i += seg.length - 1;
  }
  return promoted;
}

function main() {
  const dry = process.argv.includes('--dry');
  const { preamble, blocks } = splitBlocks(readLines(SRC));

  const kept = [];
  const archived = [];
  const promoted = [];
  let lastDate = '2026-08-19';

  for (const b of blocks) {
    const m = b.heading.match(DATE_RE);
    if (m) lastDate = m[1];
    const date = m ? m[1] : lastDate;
    if (isKeepHeading(b.heading)) {
      kept.push(b);
    } else {
      archived.push({ ...b, date, month: monthOf(date) });
      promoted.push(...extractPromoted(b.lines));
    }
  }

  // 归档文件按月份聚合，保持原顺序
  const byMonth = new Map();
  for (const b of archived) {
    if (!byMonth.has(b.month)) byMonth.set(b.month, []);
    byMonth.get(b.month).push(b);
  }

  const header = [
    '# 当前任务（current）',
    '',
    `> **本文件只保留活动任务。**保留规则：块日期 ≥ \`${KEEP_FROM}\`，或属于长期生效的约束块。`,
    '> 更早的任务已**整体移动**（非删除）到 `tasks/archive/`，索引见文末；归档正文一字未改。',
    '> 任务结束时按 `.ai-workspace/core/context-compaction.md` 的退休流程把整块移入归档，并在此追加一行索引。',
    `> 归档索引与全部文档索引见 \`.ai-workspace/INDEX.md\`（由 \`tools/ws-index.cjs\` 生成）。`,
    '',
  ];

  const out = [...header];
  for (const b of kept) out.push(...b.lines);

  if (promoted.length) {
    out.push('## 长期生效的规则增补（自历史任务块提升）', '');
    for (const p of promoted) {
      out.push(...p.split('\n'));
      out.push('');
    }
  }

  out.push('## 已归档索引（正文在 tasks/archive/，默认不读）', '');
  for (const b of archived) {
    const clean = b.heading.replace(/^##\s+/, '').replace(DATE_RE, '').replace(/^[：:、\s]+/, '');
    out.push(`- ${b.date} · ${clean} → \`tasks/archive/tasks-${b.month}.md\``);
  }
  out.push('');

  const currentText = out.join(EOL);

  const archiveTexts = new Map();
  for (const [month, list] of byMonth) {
    const lines = [
      `# 任务归档 · ${month}`,
      '',
      '> 由 `tasks/current.md` 按时间线**整体移动**而来（非删除、正文未改）。',
      '> 默认不读取；需要历史细节时按标题定位。',
      '',
    ];
    for (const b of list) lines.push(...b.lines);
    archiveTexts.set(month, lines.join(EOL));
  }

  // 无损校验：原始 ## 标题集合 == 活动 + 归档 的集合
  const origHeadings = new Set(blocks.map((b) => b.heading.trim()));
  const nowHeadings = new Set();
  for (const b of kept) nowHeadings.add(b.heading.trim());
  for (const b of archived) nowHeadings.add(b.heading.trim());
  const lost = [...origHeadings].filter((h) => !nowHeadings.has(h));
  const gained = [...nowHeadings].filter((h) => !origHeadings.has(h));

  console.log(`原始块 ${blocks.length}：保留 ${kept.length}，归档 ${archived.length}`);
  console.log(`current.md  ${Buffer.byteLength(currentText)} B（原 ${fs.statSync(SRC).size} B）`);
  for (const [month, text] of archiveTexts) {
    console.log(`archive/tasks-${month}.md  ${Buffer.byteLength(text)} B`);
  }
  console.log(`提升的规则增补 ${promoted.length} 段`);
  console.log(`无损校验：丢失 ${lost.length}，新增 ${gained.length}`);
  if (lost.length) console.log('  丢失：\n' + lost.map((h) => '    ' + h).join('\n'));
  if (gained.length) console.log('  新增：\n' + gained.map((h) => '    ' + h).join('\n'));

  if (dry) {
    console.log('\n--dry：未写入任何文件');
    return;
  }
  if (lost.length) {
    console.error('\n检测到丢失，拒绝写入');
    process.exit(1);
  }

  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  for (const [month, text] of archiveTexts) {
    fs.writeFileSync(path.join(ARCHIVE_DIR, `tasks-${month}.md`), text, 'utf8');
    console.log(`WROTE tasks/archive/tasks-${month}.md`);
  }
  fs.writeFileSync(SRC, currentText, 'utf8');
  console.log('WROTE tasks/current.md');
}

main();