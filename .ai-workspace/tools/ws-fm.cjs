'use strict';

// 工作台文档 front-matter 契约。
// 唯一 authority：本文件的常量同时被 ws-index.cjs（生成索引）与 ws-lint.cjs（校验预算）引用。

const STATUS = ['active', 'superseded', 'resolved', 'partial', 'archived'];

const STATUS_ALIASES = {
  active: 'active',
  open: 'active',
  pending: 'active',
  superseded: 'superseded',
  obsolete: 'superseded',
  partial: 'partial',
  partial_fix_applied: 'partial',
  partially_resolved: 'partial',
  resolved: 'resolved',
  fixed: 'resolved',
  closed: 'resolved',
  completed: 'resolved',
  archived: 'archived',
  historical: 'archived',
};

const STACKS = ['ros1', 'ros2', 'both', 'n/a'];

const REQUIRED = ['id', 'title', 'date', 'updated', 'status', 'devices', 'stack', 'summary'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 文档目录 → 是否递归扫描。README.md / 索引类文件不参与元数据校验。
// 只管「检索型」语料：这些目录是 agent 按 devices/stack/status 过滤的主要对象。
// decisions/、interfaces/、projects/ 不在此列——它们各有自己的约定（ADR 格式、接口契约、
// project.md 模板字段），强行套用文档 front-matter 会与既有结构冲突。
const DOC_DIRS = [
  { dir: 'known-issues', recursive: false },
  { dir: 'handoff', recursive: true },
  { dir: 'procedures', recursive: false },
  { dir: 'knowledge', recursive: true },
  { dir: 'tasks', recursive: false },
];

const INDEX_EXEMPT = new Set([
  'README.md',
  'INDEX.md',
  'current.md',
  'completed.md',
  'context-checkpoint.md',
  'backlog.md',
]);

function normalizeStatus(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return STATUS_ALIASES[key] || null;
}

function parseList(value) {
  return String(value)
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 解析 YAML 子集：标量、`[a, b]` 行内数组、`- item` 块数组。
function parseFrontMatter(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  if (!text.startsWith('---')) return { has: false, data: null, body: text, endLine: 0 };

  const lines = text.split(/\r?\n/);
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      close = i;
      break;
    }
  }
  if (close === -1) return { has: false, data: null, body: text, endLine: 0 };

  const data = {};
  let pendingKey = null;
  for (let i = 1; i < close; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && pendingKey) {
      if (!Array.isArray(data[pendingKey])) data[pendingKey] = [];
      data[pendingKey].push(item[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const rest = kv[2].trim();
    if (rest === '') {
      data[key] = [];
      pendingKey = key;
    } else if (rest.startsWith('[')) {
      data[key] = parseList(rest);
      pendingKey = null;
    } else {
      data[key] = rest.replace(/^["']|["']$/g, '');
      pendingKey = null;
    }
  }

  return { has: true, data, body: lines.slice(close + 1).join('\n'), endLine: close + 1 };
}

function validateFrontMatter(data) {
  const errors = [];
  const warnings = [];

  for (const key of REQUIRED) {
    const v = data[key];
    const missing =
      v === undefined || v === null || (Array.isArray(v) && v.length === 0 && key !== 'devices');
    if (missing) errors.push(`缺少必填字段 \`${key}\``);
  }

  for (const key of ['date', 'updated']) {
    if (data[key] && !DATE_RE.test(String(data[key]))) {
      errors.push(`\`${key}\` 必须是 YYYY-MM-DD，实际为 \`${data[key]}\``);
    }
  }

  if (data.status) {
    const norm = normalizeStatus(data.status);
    if (!norm) {
      errors.push(`\`status\` 非法：\`${data.status}\`（应属于 ${STATUS.join(' | ')}）`);
    } else if (String(data.status).trim() !== norm) {
      warnings.push(`\`status\` 建议归一化为 \`${norm}\`（现为 \`${data.status}\`）`);
    }
  }

  if (data.stack && !STACKS.includes(String(data.stack).trim().toLowerCase())) {
    errors.push(`\`stack\` 非法：\`${data.stack}\`（应属于 ${STACKS.join(' | ')}）`);
  }

  if (normalizeStatus(data.status) === 'superseded') {
    const sb = data.superseded_by;
    if (!sb || (Array.isArray(sb) && sb.length === 0)) {
      errors.push('`status: superseded` 必须给出 `superseded_by`');
    }
  }

  if (data.devices && !Array.isArray(data.devices)) {
    data.devices = parseList(data.devices);
  }

  return { errors, warnings };
}

module.exports = {
  STATUS,
  STATUS_ALIASES,
  STACKS,
  REQUIRED,
  DATE_RE,
  DOC_DIRS,
  INDEX_EXEMPT,
  normalizeStatus,
  parseList,
  parseFrontMatter,
  validateFrontMatter,
};