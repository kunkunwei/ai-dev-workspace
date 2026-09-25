# 活动任务

> 本文件只保留**正在做的事**。已结束的 `## TASK-*` 块必须按
> `.ai-workspace/core/context-compaction.md` 的退休流程移入 `tasks/archive/`，不得单调增长。
> 硬上限 30,000 B（由 `tools/ws-lint.cjs` 强制）。

---

## TASK-2026-01-20-EXAMPLE-CONFIG-PATH

- status: in_progress
- scope: `.ai-workspace/known-issues/`、`.ai-workspace/procedures/`
- 目标：把"设备路径硬编码"这一类问题的判据整理成可复用流程
- 已完成：
  - 收集 3 个同类故障的现场判据，抽出共性
  - 确认根因统一为"按总线编号匹配而非物理路径匹配"
- 下一步：
  - 写成 procedure，含 30 秒分层判据
  - 补一条 lint 检查：禁止在配置里出现按编号匹配的写法
- 阻塞：无

---

## TASK-2026-01-18-EXAMPLE-CI-BUDGET

- status: in_progress
- scope: `.ai-workspace/tools/`
- 目标：把"文档体量预算"从口头约定变成可执行检查
- 已完成：
  - `ws-lint.cjs` 增加 4 项带预算的检查（注入成本 / 任务文件 / 检查点 / 覆盖率）
  - 阈值分级：告警与失败两档
- 下一步：
  - 观察一周，确认阈值不会频繁误报
  - 若误报率高，按团队规模调整而非直接放宽
- 阻塞：无
