'use strict';

// 工作台强制层：预算、front-matter、索引新鲜度、凭据卫生、运行时陈旧引用。
//   node .ai-workspace/tools/ws-lint.cjs
// 有 ERROR 时以非零码退出；WARN 不影响退出码。

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const fm = require('./ws-fm.cjs');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');

// ---- 预算 ----
// 修订（2026-09-24）：本节原以「AGENTS.md + 10 个 `@` 导入文件」之和为「自动加载预算」，
// 该算法建立在**错误前提**上——Kimi Code CLI 不展开 `@`，那些文件从未被自动加载，
// 所以 52,144 B 这个数字在度量一个不存在的机制。
// 现在每任务固定注入成本只算 AGENTS.md 本身（见 checkAutoload 顶部的 AGENTS_MD_* 常量），
// 这里只保留与注入无关的其余预算。
const BUDGET = {
  currentMd: 30000,
  checkpointLines: 40,
  checkpointCjk: 1200,
  coverageWarn: 1.0,
  coverageFail: 0.9,
};

const results = [];
function record(level, area, message) {
  results.push({ level, area, message });
}

function bytes(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function countCjk(text) {
  const m = text.match(/[\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}

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

// ---- 1. 注入成本与规则可达性 ----
// 2026-09-24 实测 + 官方文档确认：Kimi Code CLI 把 AGENTS.md **逐字注入**为 reference data，
// 不展开 Claude Code 的 `@path` 导入语法。因此：
//   · 每任务固定注入成本 = AGENTS.md 自身（旧算法把 11 个文件求和去对标预算，是错的）
//   · core/ 与 agents/ 下的规则文件属**按需读取**，只能由 AGENTS.md 显式指向
// 函数名沿用 checkAutoload（main() 里调用点不变），但语义已按上述事实改写。
const AGENTS_MD_WARN = 12000;
const AGENTS_MD_FAIL = 15000;

function checkAutoload() {
  const agents = path.join(REPO, 'AGENTS.md');
  const text = readText(agents);
  if (text === null) {
    record('ERROR', 'AGENTS.md', 'AGENTS.md 不存在');
    return;
  }

  const size = bytes(agents);
  const detail = `${size} B（上限 fail ${AGENTS_MD_FAIL}，warn ${AGENTS_MD_WARN}）— 每任务固定注入成本`;
  if (size >= AGENTS_MD_FAIL) {
    record('ERROR', 'AGENTS.md', `注入成本超出预算：${detail}`);
  } else if (size >= AGENTS_MD_WARN) {
    record('WARN', 'AGENTS.md', `注入成本接近上限：${detail}`);
  } else {
    record('OK', 'AGENTS.md', detail);
  }

  // `@` 导入在本运行时无效：出现即报错，防止再退回这个不会生效的机制。
  let imports = 0;
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^@(\S+)/);
    if (!m) return;
    imports++;
    record(
      'ERROR',
      'agents-md·import',
      `AGENTS.md:${i + 1} 使用 \`@${m[1]}\` —— Kimi Code 不展开 @，该行带不来任何规则；请改为显式「必须读取」清单`,
    );
  });

  // AGENTS.md 声明「core/ 下的规则必须在任务开始时显式读取」，所以逐个核对 core/ 是否被点名。
  // agents/ 下除 model-routing / team-orchestration 两个规则文件外，还有
  // explorer / implementer / validator 三个按需细节层（其内容与 core/agent-roles.md 的
  // 三角色正文重叠，且不被任何文件点名），由目录指针 `.ai-workspace/agents/` 到达即可。
  // 若对 agents/ 也要求逐个点名，检查会退化成假警报。
  let coreMissing = [];
  try {
    coreMissing = fs
      .readdirSync(path.join(ROOT, 'core'))
      .filter((f) => f.endsWith('.md') && !text.includes(f));
  } catch {
    record('ERROR', 'rules', 'core/ 目录不可读');
  }
  if (coreMissing.length === 0) {
    record('OK', 'rules', 'core/ 下全部规则文件都在 AGENTS.md 中被点名（必须显式读取）');
  } else {
    for (const f of coreMissing) {
      record('ERROR', 'rules·不可达', `AGENTS.md 未点名 core/${f} —— 该规则文件不可达`);
    }
  }
  for (const dir of ['core', 'agents']) {
    if (!text.includes(`.ai-workspace/${dir}/`)) {
      record('ERROR', 'rules·不可达', `AGENTS.md 未指向 .ai-workspace/${dir}/`);
    }
  }
  if (imports === 0) {
    record('OK', 'agents-md·import', '未使用失效的 `@` 导入语法');
  }
}

// ---- 2. current.md 预算 ----
function checkCurrentMd() {
  const file = path.join(ROOT, 'tasks', 'current.md');
  const b = bytes(file);
  if (b === null) {
    record('ERROR', 'current.md', 'tasks/current.md 不存在');
    return;
  }
  const detail = `${b} B（上限 ${BUDGET.currentMd}）`;
  if (b > BUDGET.currentMd) {
    record('ERROR', 'current.md', `活动任务文件超出上限：${detail} —— 已结束任务块必须移入 tasks/archive/`);
  } else {
    record('OK', 'current.md', detail);
  }
}

// ---- 3. checkpoint 预算 ----
function checkCheckpoint() {
  const file = path.join(ROOT, 'tasks', 'context-checkpoint.md');
  const text = readText(file);
  if (text === null) {
    record('ERROR', 'checkpoint', 'tasks/context-checkpoint.md 不存在');
    return;
  }
  const lines = text.split(/\r?\n/).length;
  const cjk = countCjk(text);
  const detail = `${lines} 行 / ${cjk} 中文字符（上限 ${BUDGET.checkpointLines} 行 / ${BUDGET.checkpointCjk}）`;
  if (lines > BUDGET.checkpointLines || cjk > BUDGET.checkpointCjk) {
    record('WARN', 'checkpoint', `检查点超出建议上限：${detail}`);
  } else {
    record('OK', 'checkpoint', detail);
  }
}

// ---- 4. front-matter 覆盖与合法性 ----
function checkFrontMatter() {
  const missing = [];
  const invalid = [];
  let tagged = 0;
  let total = 0;

  for (const { dir, recursive } of fm.DOC_DIRS) {
    for (const file of walk(path.join(ROOT, dir), recursive)) {
      const base = path.basename(file);
      if (fm.INDEX_EXEMPT.has(base)) continue;
      total++;
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const parsed = fm.parseFrontMatter(readText(file) || '');
      if (!parsed.has) {
        missing.push(rel);
        continue;
      }
      tagged++;
      const { errors } = fm.validateFrontMatter(parsed.data);
      for (const err of errors) invalid.push(`${rel}: ${err}`);
    }
  }

  const ratio = total === 0 ? 1 : tagged / total;
  const detail = `${tagged}/${total}（${(ratio * 100).toFixed(1)}%）`;
  if (ratio < BUDGET.coverageFail) {
    record('ERROR', 'front-matter', `标注覆盖率过低：${detail}`);
  } else if (ratio < BUDGET.coverageWarn) {
    record('WARN', 'front-matter', `标注覆盖率未达 100%：${detail}`);
  } else {
    record('OK', 'front-matter', detail);
  }

  for (const m of missing.slice(0, 25)) record('WARN', 'front-matter·缺', m);
  if (missing.length > 25) record('WARN', 'front-matter·缺', `…另有 ${missing.length - 25} 篇`);
  for (const i of invalid.slice(0, 25)) record('ERROR', 'front-matter·非法', i);
  if (invalid.length > 25) record('ERROR', 'front-matter·非法', `…另有 ${invalid.length - 25} 条`);
}

// ---- 5. 索引新鲜度 ----
function checkIndexFresh() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'ws-index.cjs'), '--check'], {
    encoding: 'utf8',
  });
  if (r.status === 0) {
    record('OK', 'index', '生成索引与磁盘一致');
  } else {
    record('ERROR', 'index', '生成索引已过期，运行 `node .ai-workspace/tools/ws-index.cjs` 重新生成');
  }
}

// ---- 6. 空占位 README ----
// 有真实内容、只在末尾残留「暂无，待回填」的文档（如 interfaces/rosbridge/README.md，
// 含端口契约表）不算空占位，因此额外要求体积足够小。
const PLACEHOLDER_MAX_BYTES = 1000;

function checkPlaceholders() {
  const hits = [];
  for (const { dir, recursive } of fm.DOC_DIRS) {
    for (const file of walk(path.join(ROOT, dir), recursive)) {
      if (path.basename(file) !== 'README.md') continue;
      const text = readText(file) || '';
      const size = Buffer.byteLength(text);
      if (text.includes('暂无，待回填') && size < PLACEHOLDER_MAX_BYTES) {
        hits.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}（${size} B）`);
      }
    }
  }
  if (hits.length === 0) {
    record('OK', 'placeholder', '无空占位 README');
  } else {
    // 删除属 DANGEROUS 操作，必须由用户逐次确认；此处只报告，绝不自动删除。
    for (const h of hits) {
      record('WARN', 'placeholder', `空占位 README（读了不返回信息，建议删除；删除需授权）：${h}`);
    }
  }
}

// ---- 7. 凭据卫生（只查 git 索引中的路径，不读取内容）----
// 刻意不对文件名匹配 /credential/i：仓库已实测并记录，该宽泛通配会误伤
// `device-credential-audit-*.md`、`VOICE-CREDENTIAL-TEST-HANDOFF-*.md`
// 这类**应当留档**的审计与交接文档（见 .gitignore 内注释）。只检查真正的凭据存储。
function checkSecrets() {
  const r = spawnSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' });
  if (r.status !== 0) {
    record('WARN', 'secrets', '无法读取 git 索引，跳过凭据检查');
    return;
  }
  const tracked = r.stdout.split(/\r?\n/).filter(Boolean);
  const patterns = [
    /(^|\/)secrets?\//i,
    /(^|\/)CREDENTIALS\.(md|txt)$/i,
    /(^|\/)id_rsa$/,
    /\.pem$/i,
    /\.key\.txt$/i,
  ];
  const hits = tracked.filter((f) => patterns.some((p) => p.test(f)));
  if (hits.length === 0) {
    record('OK', 'secrets', '无凭据类文件被 git 跟踪');
  } else {
    for (const h of hits) record('ERROR', 'secrets', `凭据类文件被 git 跟踪：${h}`);
  }

  const gi = readText(path.join(REPO, '.gitignore')) || '';
  if (gi.includes('.ai-workspace/secrets/')) {
    record('OK', 'secrets·gitignore', '.ai-workspace/secrets/ 已被忽略');
  } else {
    record('ERROR', 'secrets·gitignore', '.gitignore 未忽略 .ai-workspace/secrets/');
  }
}

// ---- 8. 陈旧运行时引用（P0 回归护栏）----
// 放过「点名其已失效」的行：运行时事实说明块必须能写出这些失效项本身。
const INVALIDATION_MARK = /已失效|不存在|未注册|不要按|已作废|不再使用/;

function checkStaleRuntime() {
  const files = [path.join(REPO, 'AGENTS.md')];
  for (const f of walk(path.join(ROOT, 'agents'), false)) files.push(f);
  const stale = /mcp__claude_code|gpt-5\.6|mcp__claude\b/;
  let hits = 0;
  for (const f of files) {
    const text = readText(f);
    if (text === null) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      if (!stale.test(line)) return;
      if (INVALIDATION_MARK.test(line)) return;
      hits++;
      record(
        'ERROR',
        'stale-runtime',
        `${path.relative(REPO, f).replace(/\\/g, '/')}:${i + 1} 引用了已失效的运行时（${line.trim().slice(0, 70)}）`,
      );
    });
  }
  if (hits === 0) record('OK', 'stale-runtime', 'AGENTS.md 与 agents/ 无失效运行时引用');
}

// ---- 9. 遗留入口提醒 ----
// CLAUDE.md 是旧 CLI 的入口，但**仍被多篇文档引用**（2026-09-23 实测 7 处），
// 不能当垃圾处理；只有它不再被任何文档引用时才提示归档。
function checkLegacyEntry() {
  const claude = path.join(REPO, 'CLAUDE.md');
  if (!fs.existsSync(claude)) return;
  const r = spawnSync('git', ['grep', '-l', '-F', 'CLAUDE.md'], { cwd: REPO, encoding: 'utf8' });
  const refs = (r.stdout || '')
    .split(/\r?\n/)
    .filter((f) => f && f !== 'CLAUDE.md' && !f.startsWith('tmp/'));
  if (refs.length === 0) {
    record('WARN', 'legacy', 'CLAUDE.md 已无任何文档引用，可归档');
  } else {
    record('OK', 'legacy', `CLAUDE.md 仍被 ${refs.length} 个文件引用，保留`);
  }
}

function main() {
  checkAutoload();
  checkCurrentMd();
  checkCheckpoint();
  checkFrontMatter();
  checkIndexFresh();
  checkPlaceholders();
  checkSecrets();
  checkStaleRuntime();
  checkLegacyEntry();

  const order = { ERROR: 0, WARN: 1, OK: 2 };
  results.sort((a, b) => order[a.level] - order[b.level]);

  const errors = results.filter((r) => r.level === 'ERROR').length;
  const warns = results.filter((r) => r.level === 'WARN').length;

  console.log('工作台校验 · ws-lint');
  console.log(`目录：${ROOT}`);
  console.log('');
  for (const r of results) {
    const tag = r.level === 'OK' ? '  OK ' : r.level === 'WARN' ? ' WARN' : ' ERR ';
    console.log(`${tag} [${r.area}] ${r.message}`);
  }
  console.log('');
  console.log(`汇总：${errors} 个 ERROR，${warns} 个 WARN，共 ${results.length} 项检查结果`);
  process.exit(errors > 0 ? 1 : 0);
}

main();