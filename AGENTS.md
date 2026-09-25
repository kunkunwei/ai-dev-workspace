# Local AI Development Workspace —— 规范入口（脱敏参考实现）

> **关于本文件**：这是「本地 AI 开发工作区」规范入口的**脱敏参考副本**，用于展示这套工作区的组织方式与约束设计。
> 原文中的公司名、产品代号、设备信息与本地路径已替换为占位符；文中引用的 `facts/`、`tasks/`、`knowledge/`、
> `procedures/` 等目录记录的是**本工作区的约定**，其内容因涉及真实项目而不包含在本仓库中。
>
> 换句话说：**这里公开的是"怎么组织"，不是"组织了什么"。** 设计说明见
> [`.ai-workspace/docs/architecture.md`](.ai-workspace/docs/architecture.md)。

本目录是机器人研发的「本地 AI 开发工作区」统一入口。所有 AI 开发规范、事实源、
任务状态、知识、流程与 Agent 角色定义都存放在 `.ai-workspace/`，由 AI 编码工具注入加载。
**本目录不包含业务代码**；各业务仓库保持独立、位于各自路径或远端，绝不合并。

## 首要不变量（任何任务开始前必须逐条确认）

1. **零破坏**：默认只读。不得修改现有业务代码、Ubuntu、ROS、Docker、rosbridge 接口、Git 历史。
2. **ROS1 是当前稳定基线（CURRENT）**。任何 ROS1 → ROS2 迁移都是独立、需人工授权的专项任务（`migration: true`）。
3. **技术栈隔离**：严禁混淆 ROS1 与 ROS2 的命令、launch、参数系统、Topic/Service/Action 模型、依赖。
4. **事实源文件化**：不得靠对话记忆；缺失值标 `UNKNOWN` / `NEEDS_CONFIRMATION` / `TODO`，禁止猜测合理值。
5. **最小权限**：Agent 默认只读；修改必须在任务 scope 内；Jetson 默认 `READ_ONLY`。
6. **可审计可回滚**：改前 `git status`、改后 `git diff` + 摘要；禁止 `--hard` / `clean -fd` / 强 checkout / 改历史。

## 核心规则（**非自动注入，必须在任务开始时显式读取**）

> ⚠️ 本节原用 `@path` 语法，那是 **Claude Code** 的导入约定；**Kimi Code CLI 不展开 `@`**——
> 官方文档说明 AGENTS.md 是逐字注入为 reference data，实测收到的就是原文，`@` 行只是普通文本。
> **规则不读就等于不存在。** 因此下列文件必须由 agent 显式读取，它们是硬约束，不是可选参考。

- `.ai-workspace/core/`：`engineering-rules.md`、`git-safety.md`、`change-policy.md`、`tech-stack-isolation.md`、`system-lifecycle.md`、`testing-rules.md`、`agent-roles.md`、`context-compaction.md`
- `.ai-workspace/agents/`：`model-routing.md`、`team-orchestration.md`

**权限分级（`READ_ONLY` / `BUILD` / `DEPLOY` / `DANGEROUS`）、Git 禁令、事实源规则属硬约束：未读懂不得开始改动类任务。**

## 事实源（唯一可信来源，读取时按需引用，禁止凭记忆改值）

- 仓库清单：`.ai-workspace/facts/repos.yaml`
- 机器人型号：`.ai-workspace/facts/robot_profile.yaml`
- ROS1 导航事实：`.ai-workspace/facts/navigation_ros1_profile.yaml`
- ROS2 导航事实：`.ai-workspace/facts/navigation_ros2_profile.yaml`
- rosbridge 接口：`.ai-workspace/facts/rosbridge_profile.yaml`
- 前端接口：`.ai-workspace/facts/frontend_api.yaml`
- 后端接口：`.ai-workspace/facts/backend_api.yaml`
- Jetson/SSH：`.ai-workspace/facts/jetson_profile.yaml`

## 任务与流程

1. `.ai-workspace/tasks/context-checkpoint.md` —— 最新压缩检查点，**先读这个**
2. `.ai-workspace/tasks/current.md` —— 仅活动任务（已结束任务在 `tasks/archive/`，默认不读）
3. `.ai-workspace/INDEX.md` —— 全部文档的机器生成索引；按 `devices` / `stack` / `status` 过滤后再按需读取
4. 相关 `facts/` 与命中条目指向的具体文档

- 工作流程：`.ai-workspace/procedures/`
- Agent 角色：`.ai-workspace/agents/`
- 已知问题：`.ai-workspace/known-issues/`
- 架构决策：`.ai-workspace/decisions/`
- 已归档任务：`.ai-workspace/tasks/archive/`（默认不读）

## 快速开始

阅读 `.ai-workspace/README.md` 了解如何接入仓库、创建任务、连接 Jetson、撤回修改。

账号/Provider 切换、Kimi Code 重启或聊天上下文丢失时，优先读取：.ai-workspace/knowledge/codex-claude-mcp-handoff.md。

## 主代理与执行子代理协作（当前运行时：Kimi Code CLI）

本节补充执行分工，不放宽上述任何安全、事实源、技术栈隔离或变更授权规则；如有冲突，以更严格的既有规则为准。

> **运行时事实（2026-09-23 核对）**：本工作区当前由 **Kimi Code CLI** 驱动，不再使用 Codex 或 Claude Code CLI。
> 因此 `mcp__claude_code__delegate` 在本运行时**不存在**，`.ai-workspace/mcp/*.cjs` 两个服务器**未注册**，
> 历史文档中的 `custom/gpt-5.6-sol` / `custom/gpt-5.6-luna` 别名**已失效**。不要按上述任何一项执行；
> 详见 `.ai-workspace/knowledge/codex-claude-mcp-handoff.md`。

### 角色分工

- 主代理负责理解需求、读取事实源、制定方案、拆分任务、确定授权范围以及最终验收。
- 边界明确的执行支线（文件/日志/Git 扫描、长输出压缩、独立检索、机械检查、明确范围内的实施）优先委派执行子代理；只读分析、规划和极小的低风险操作由主代理直接完成。
- 子代理的 `cwd` 必须是本次任务明确授权的实际仓库或测试目录，不得因为会话位于本 AI 工作区就扩大到其他业务仓库、Jetson 或远程环境。
- 主代理不得仅依据子代理的完成声明判断成功；必须独立检查 `git diff`、事实源约束和用户要求。
- 测试仅在用户明确要求或任务属于高风险范围时执行。

### 委派要件（每次委派必须显式给出）

1. 目标与验收标准
2. `cwd`
3. 允许读取 / 允许修改的路径范围
4. 禁止事项
5. 测试策略（普通小改默认 `SKIP`）

只读任务不得授予写入权限；写入权限只给当前任务明确需要的最小范围。

### 模型路由（真实模型池）

创建子代理时必须使用池中**真实存在**的别名：

- `custom/deepseek-v4.1-flash` —— 默认执行子代理：文件扫描、日志整理、Git 检查、明确范围内实施
- `custom/deepseek-v4-pro` —— 确需独立复杂推理的高风险或跨层任务
- `custom/muse-spark-1.3-contributor` —— 长上下文、工具调用密集任务
- `primary` —— 继承主代理当前模型与思考等级

- 只需 1–2 次简单工具调用时由主代理直接完成；预计超过约 3 次搜索/读取、需要读取长文件或会产生大量日志时，优先委派子代理，避免把中间输出灌入主代理上下文。
- 子代理不解释模糊需求、不裁决接口、不自行扩大 scope，只返回结论、关键证据和修改摘要。
- 复杂耦合、protected 接口、高风险迁移/部署/数据操作、证据冲突等判断由主代理直接处理；不得为重复审查或增加 UI 显示而消耗第二份高成本模型 Token。
- 多 lane 且修改完全独立时可并行创建子代理；模型切换**不扩大**文件、Git、SSH、Docker、ROS 或 Jetson 权限。
- **模型池未暴露或别名不匹配时，不得声称已切换模型，应如实报告模型池未生效。**

### 子代理失败降级 —— 当前未实现（KNOWN GAP）

- **现状：已接入多个 Provider，但自动切换失败子代理尚未实现。子代理失败就如实报告失败，不得声称已降级。**
- 待实现时的设计意图（按此执行，不得放宽）：用另一模型别名**原样继承**原委派的 `prompt`、`cwd`、允许/禁止路径、测试策略与安全边界重新执行；每个委派**最多降级一次**，不递归回退。
- 降级必须逐条保留原授权范围；`edit` 仅在原授权范围内写入，只读任务继续只读。
- 不得用降级绕过用户或权限策略拒绝、scope/cwd 校验失败、参数错误、危险操作确认或 protected 边界。
- 降级若发生，最终报告必须标注 `fallback: <原模型> -> <降级模型>`、原始失败类别、改动内容与主代理的独立验证结果。

### 权限边界

- `BUILD`、`DEPLOY` 必须在当前任务中明确授权后执行。`DANGEROUS`（删除、prune、改系统、重启、磁盘清理等）**永远逐次人工确认**。
- 删除、覆盖、迁移数据、修改 Git 历史、连接 Jetson、远程执行、发布或推送等高风险操作，不得因委派而扩大授权。
- 只读检查只走白名单命令，禁止任意远端命令。
- **每台设备的开关机状态与 SSH 可用性一律以 `facts/jetson_profile.yaml` 为准**，不要在本文件里写死设备状态快照（历史快照会过期）；入口命令、sudoers 配置与回滚顺序见 `procedures/jetson-ssh-connection.md`。无论哪台设备，连接后仍默认从只读白名单验证开始。
- 配置变更（模型池、MCP、启动环境变量）不会自动改变已绑定的会话；变更后应 `/reload`、新建任务或重启客户端再验证。

## 小任务完成后自动压缩与同步

完整规则见 `.ai-workspace/core/context-compaction.md`（触发时机、收尾动作、写锁与 Token 控制）。要点：

- 每个边界明确的小任务结束时，覆盖更新 `tasks/context-checkpoint.md`（≤40 行 / 约 1200 中文字符），不得追加历史全文。
- 任务状态实质变化时同步 `tasks/current.md`（活动任务）或 `tasks/completed.md`（完成索引）。
- **已结束的 `## TASK-*` 块必须按 `context-compaction.md` 的退休流程移入 `tasks/archive/`**，不得让 `current.md` 单调增长。
- 恢复时先读检查点，再按需读 `current.md` 与相关事实源，不重放完整聊天。
- 运行时提供原生 compaction 工具时落盘后调用一次；没有工具时只声明“工作区逻辑压缩已完成”，不得声称触发了底层压缩。

## 快速开发默认模式（用户偏好）

- 普通、小范围、可直接理解的代码修改默认走快速路径：一次分析 → 一次修改 → 检查 `git diff` → 提交并安全上传；不做多轮自我回环。
- 默认不运行单元测试、构建、仿真或真机验证；只有用户明确要求，或任务涉及 protected 接口、ROS/Docker 基础设施、迁移、发布等高风险范围时才测试。
- Git 仓库中的普通修改默认不制作额外时间戳备份；Git 提交和远端分支承担版本留存。历史改写、批量删除、非 Git 配置覆盖等危险操作仍必须备份并单独授权。
- 用户已对“及时上传 GitHub”给出常规授权：仅提交任务 scope 内文件，禁止 force push；当前分支为受保护分支或远端/分支不明确时，创建并推送 `codex/*` 安全分支，不擅自合并。
- **单一云端源**：禁止用 copy / scp / 复制粘贴在设备之间传源码或版本化配置；任何设备改完就提交并推云端，其他设备从云端拉。在 Robot-G1 / Robot-G2 上部署代码时禁止随意开辟分支、禁止另做源码备份（详见 `.ai-workspace/core/change-policy.md` 的「单一云端源同步规则」）。
- 即使跳过测试，也必须明确报告 `tests: SKIPPED (user fast mode)`；“已上传”只表示代码已保存到远端，不等同于功能已验证。

## 三项目轻量并行与直接联调

规则见 `.ai-workspace/agents/team-orchestration.md`。要点：只启动本次涉及的 lane；最多三个分析 lane、两个实施任务并行；各 lane 完成并做任务范围 `git diff` 后直接进入联调，不做重型阶段汇总；稳定且本次未修改的接口不重复检查；用户提供的现象、时间、截图、抓包和日志是定位的首要输入。
