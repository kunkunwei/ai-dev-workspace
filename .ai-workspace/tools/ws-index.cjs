'use strict';

// 从文档 front-matter 生成索引。默认写入；`--check` 只校验索引是否与磁盘一致。
//   node .ai-workspace/tools/ws-index.cjs
//   node .ai-workspace/tools/ws-index.cjs --check

const fs = require('fs');
const path = require('path');
const fm = require('./ws-fm.cjs');

const ROOT = path.resolve(__dirname, '..');
const INDEX_MD = path.join(ROOT, 'INDEX.md');
const KNOWN_ISSUES_README = path.join(ROOT, 'known-issues', 'README.md');
const GENERATED_NOTE =
  '> 本文件由 `.ai-workspace/tools/ws-index.cjs` 从文档 front-matter 机器生成，**禁止手工编辑**。\n' +
  '> 重新生成：`node .ai-workspace/tools/ws-index.cjs`';

function walk(dir, recursive) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive) out.push(...walk(p, true));
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

function scan() {
  const docs = [];
  const untagged = [];

  for (const { dir, recursive } of fm.DOC_DIRS) {
    for (const file of walk(path.join(ROOT, dir), recursive)) {
      const base = path.basename(file);
      if (fm.INDEX_EXEMPT.has(base)) continue;
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const parsed = fm.parseFrontMatter(fs.readFileSync(file, 'utf8'));
      if (!parsed.has) {
        untagged.push(rel);
        continue;
      }
      const d = parsed.data;
      docs.push({
        rel,
        top: rel.split('/')[0],
        id: String(d.id || ''),
        title: String(d.title || ''),
        status: fm.normalizeStatus(d.status) || 'unknown',
        rawStatus: String(d.status || ''),
        devices: (fm.parseList(d.devices || '')).map((s) => s.toLowerCase()),
        stack: String(d.stack || '').toLowerCase(),
        updated: String(d.updated || d.date || ''),
        supersededBy: fm.parseList(d.superseded_by || '').join(', '),
        summary: String(d.summary || ''),
      });
    }
  }

  docs.sort((a, b) => a.rel.localeCompare(b.rel));
  untagged.sort();
  return { docs, untagged };
}

function esc(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function row(d, withTop) {
  const cells = [
    d.id || '—',
    d.status,
    d.devices.length ? d.devices.join(' ') : '—',
    d.stack || '—',
    d.updated || '—',
    d.title || d.summary || '—',
    withTop ? d.rel : `\`${d.rel}\``,
  ];
  return `| ${cells.map(esc).join(' | ')} |`;
}

const HEADER = '| id | status | devices | stack | updated | title | path |\n| --- | --- | --- | --- | --- | --- | --- |';

function tableFor(docs) {
  return [HEADER, ...docs.map((d) => row(d))].join('\n');
}

function buildIndex() {
  const { docs, untagged } = scan();
  const byStatus = {};
  for (const d of docs) byStatus[d.status] = (byStatus[d.status] || 0) + 1;

  const active = docs.filter((d) => d.status === 'active');
  const rest = docs.filter((d) => d.status !== 'active');

  const out = [];
  out.push('# 工作台索引（INDEX）', '');
  out.push(GENERATED_NOTE, '');
  out.push(`文档总数 **${docs.length}**，已标注 **${docs.length}**，未标注 **${untagged.length}**。`, '');

  out.push('## 状态统计', '');
  out.push('| status | 数量 |');
  out.push('| --- | --- |');
  for (const s of [...fm.STATUS, 'unknown']) {
    if (byStatus[s]) out.push(`| ${s} | ${byStatus[s]} |`);
  }
  out.push('');

  out.push(`## active（${active.length} 篇，优先读取）`, '');
  out.push(active.length ? tableFor(active) : '（无）', '');

  // 设备/栈的明细已经在表格的 devices / stack 列里，这里只给计数，避免把全部路径再列一遍
  // （那样会让 INDEX 翻倍，而它的作用是「过滤」而不是「复述」）。
  const countBy = (keyFn) => {
    const acc = new Map();
    for (const d of active) {
      for (const k of keyFn(d)) acc.set(k, (acc.get(k) || 0) + 1);
    }
    return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };
  const devCounts = countBy((d) => (d.devices.length ? d.devices : ['(未标注设备)']));
  const stackCounts = countBy((d) => [d.stack || '(未标注栈)']);
  if (devCounts.length) {
    out.push('## active · 过滤速查', '');
    out.push('- 按设备：' + devCounts.map(([k, n]) => `\`${k}\` ${n}`).join(' · '));
    out.push('- 按技术栈：' + stackCounts.map(([k, n]) => `\`${k}\` ${n}`).join(' · '));
    out.push('');
  }

  out.push(`## 其它状态（${rest.length} 篇，按需查阅）`, '');
  out.push(rest.length ? tableFor(rest) : '（无）', '');

  out.push(`## 未标注 front-matter（${untagged.length} 篇，需回填）`, '');
  if (untagged.length) {
    for (const rel of untagged) out.push(`- \`${rel}\``);
  } else {
    out.push('（无）');
  }
  out.push('');

  return out.join('\n');
}

function buildKnownIssuesReadme() {
  const { docs } = scan();
  const mine = docs.filter((d) => d.top === 'known-issues');
  const active = mine.filter((d) => d.status === 'active');
  const rest = mine.filter((d) => d.status !== 'active');

  const out = [];
  out.push('# 已知问题索引', '');
  out.push(GENERATED_NOTE, '');
  out.push(`本目录共 ${mine.length} 篇：active ${active.length}，其它 ${rest.length}。`, '');
  out.push(`## active（${active.length}）`, '');
  out.push(active.length ? tableFor(active) : '（无）', '');
  out.push(`## 其它状态（${rest.length}）`, '');
  out.push(rest.length ? tableFor(rest) : '（无）', '');
  return out.join('\n');
}

// 仓库工作树约定为 CRLF：统一在此转换，避免生成文件与既有文件行尾不一致。
function writeOrCheck(file, content, check) {
  const normalized = content.replace(/\r?\n/g, '\r\n');
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  if (check) {
    if (existing === normalized) {
      console.log(`OK    ${rel}`);
      return 0;
    }
    console.log(`STALE ${rel} —— 索引与磁盘不一致，请运行 ws-index.cjs 重新生成`);
    return 1;
  }
  fs.writeFileSync(file, normalized, 'utf8');
  const action = existing === normalized ? 'UNCHANGED' : existing === null ? 'CREATED' : 'UPDATED';
  console.log(`${action} ${rel} (${Buffer.byteLength(normalized)} bytes)`);
  return 0;
}

function main() {
  const check = process.argv.includes('--check');
  let rc = 0;
  rc |= writeOrCheck(INDEX_MD, buildIndex(), check);
  rc |= writeOrCheck(KNOWN_ISSUES_README, buildKnownIssuesReadme(), check);
  process.exit(rc);
}

main();