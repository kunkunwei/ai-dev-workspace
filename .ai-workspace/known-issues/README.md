# 已知问题索引

> 本文件由 `.ai-workspace/tools/ws-index.cjs` 从文档 front-matter 机器生成，**禁止手工编辑**。
> 重新生成：`node .ai-workspace/tools/ws-index.cjs`

本目录共 3 篇：active 1，其它 2。

## active（1）

| id | status | devices | stack | updated | title | path |
| --- | --- | --- | --- | --- | --- | --- |
| retry-vs-respawn-semantics | active | robot-a robot-b | n/a | 2026-01-20 | respawn 不是健康检查——进程卡死时永远不会被救 | `known-issues/retry-vs-respawn-semantics.md` |

## 其它状态（2）

| id | status | devices | stack | updated | title | path |
| --- | --- | --- | --- | --- | --- | --- |
| config-device-path-hardcoded | resolved | robot-a | n/a | 2026-01-20 | 别名规则硬编码设备路径，换 USB 端口后静默失效 | `known-issues/config-device-path-hardcoded.md` |
| timeline-clock-jump | resolved | robot-a | n/a | 2026-01-20 | 无保电 RTC 设备的时间线不能信墙钟，必须用单调时钟 | `known-issues/timeline-clock-jump.md` |
