'use strict';

// 把 tmp/fm-backfill/*.json 的分类结果写成文档 front-matter。
// 由分类子代理只读产出（不碰文档），本脚本统一写入，保证格式与行尾一致。
//   node .ai-workspace/tools/ws-fm-backfill.cjs --dry
//   node .ai-workspace/tools/ws-fm-backfill.cjs

const fs = require('fs');
const path = require('path');
const fm = require('./ws-fm.cjs');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const SRC_DIR = path.join(REPO, 'tmp', 'fm-backfill');

const CANONICAL = ['id', 'title', 'date', 'updated', 'status', 'superseded_by', 'devices', 'stack', 'summary'];
const EOL = '\r\n';

function sanitize(value) {
  return String(value).replace(/[\r\n]+/g, ' ').replace(/"/g, "'").trim();
}

// 需要引号时才引号：含 YAML 元字符或首字符有歧义。
function scalar(value) {
  const v = sanitize(value);
  if (v === '') return '""';
  if (/[:#\[\]{}]/.test(v) || /^[-?*&!|>%@`'"]/.test(v)) return `"${v}"`;
  return v;
}

function list(values) {
  return `[${values.map((v) => sanitize(v)).join(', ')}]`;
}

function buildBlock(entry, legacyExtras) {
  const lines = ['---'];
  lines.push(`id: ${scalar(entry.id)}`);
  lines.push(`title: ${scalar(entry.title)}`);
  lines.push(`date: ${scalar(entry.date)}`);
  lines.push(`updated: ${scalar(entry.updated)}`);
  lines.push(`status: ${scalar(entry.status)}`);
  if (entry.status === 'superseded' && entry.superseded_by) {
    lines.push(`superseded_by: ${scalar(entry.superseded_by)}`);
  }
  lines.push(`devices: ${list(entry.devices || [])}`);
  lines.push(`stack: ${scalar(entry.stack)}`);
  lines.push(`summary: ${scalar(entry.summary)}`);
  for (const [key, raw] of legacyExtras) lines.push(`${key}:${raw}`);
  lines.push('---');
  return lines.join(EOL);
}

function serializeExtra(key, value) {
  if (Array.isArray(value)) {
    return EOL + value.map((v) => `  - ${sanitize(v)}`).join(EOL);
  }
  return ` ${sanitize(value)}`;
}

function main() {
  const dry = process.argv.includes('--dry');
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`缺少分类结果目录：${SRC_DIR}`);
    process.exit(1);
  }

  const entries = [];
  for (const file of fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.json'))) {
    const arr = JSON.parse(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'));
    for (const e of arr) entries.push(e);
  }
  console.log(`载入 ${entries.length} 条分类结果`);

  const seen = new Set();
  let applied = 0;
  let normalized = 0;
  const skipped = [];

  for (const entry of entries) {
    const abs = path.join(REPO, entry.path);
    if (!fs.existsSync(abs)) {
      skipped.push(`${entry.path}（文件不存在）`);
      continue;
    }
    if (seen.has(entry.path)) {
      skipped.push(`${entry.path}（重复条目）`);
      continue;
    }
    seen.add(entry.path);

    const raw = fs.readFileSync(abs, 'utf8');
    const parsed = fm.parseFrontMatter(raw);
    const body = parsed.has
      ? raw.replace(/^\uFEFF/, '').split(/\r?\n/).slice(parsed.endLine).join(EOL)
      : raw.split(/\r?\n/).join(EOL);

    const legacyExtras = [];
    if (parsed.has) {
      normalized++;
      for (const [key, value] of Object.entries(parsed.data)) {
        if (CANONICAL.includes(key)) continue;
        legacyExtras.push([key, serializeExtra(key, value)]);
      }
    }

    const block = buildBlock(entry, legacyExtras);
    const out = `${block}${EOL}${body.startsWith(EOL) ? '' : EOL}${body}`.replace(/\r?\n$/, '') + EOL;

    if (!dry) fs.writeFileSync(abs, out, 'utf8');
    applied++;
  }

  console.log(`应用 ${applied} 篇（其中已存在 front-matter 被归一化 ${normalized} 篇）`);
  if (skipped.length) {
    console.log(`跳过 ${skipped.length} 条：`);
    for (const s of skipped) console.log('  ' + s);
  }
  if (dry) console.log('\n--dry：未写入任何文件');
}

main();