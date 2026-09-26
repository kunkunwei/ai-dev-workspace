# Case Study：求职投递闭环（JD 评估 → 简历定制 → 表单填写 → 台账看板）

> 用「文件化事实源 + AI 执行」把求职投递做成一条**可追溯、可复核、不靠记忆**的闭环。
> 本案例是 [AI Dev Workspace](../../README.md) 方法论在「个人求职」场景的一次完整落地，所有内容已脱敏、通用化。

**一句话**：把「JD 评估 → 简历定制 → 在线表单填写 → 投递进度看板」串成一个闭环，
核心不是工具，而是**纪律**——单一事实源、AI 有边界（防幻觉）、改动可追溯（git）、隐私不进公开仓。

**30 秒看懂四段结构**：

```
① JD 评估        ② 简历定制          ③ 在线表单填写       ④ 台账与看板
   ↓                ↓                    ↓                    ↓
 jd/<岗位>.md   tailor/<岗位>.md    填表扩展 + profile    applications.yaml
 AI 对照证据索引  改什么、为什么          → 表单 JSON        → 看板 / 面板
 命中/缺口/红线   每处改动可追溯          确定性填值          状态事实源（git 可追溯）
```

---

## 这个案例解决什么问题

求职季的典型痛点：几十家公司官网、每家的在线表单字段不一样、简历要按 JD 反复改、
投到哪一步靠记忆。最容易出问题的不是"填表"，而是**改简历时的自我美化**——AI 会写出
没有证据支撑的内容。本案例用一张「证据索引 + 红线清单」把 AI 的改写边界框死：

- **能说什么**：简历每一条都能指到源文件（证据锚点 `文件:行号`）
- **不能说什么**：`boundaries` 红线清单，AI 改写后必须自检，命中即回退
- **改了什么**：每个岗位一份 `tailor/` 记录（原句 → 新句 → 依据）

## 目录

```
case-studies/job-hunt-loop/
├── README.md                     ← 本文件：这是什么、怎么跑
├── LICENSE                       ← MIT
├── .gitignore                    ← 排除非 example 的 yaml、out/、data/、jd/、tailor/
├── docs/
│   ├── 01-闭环设计.md             ← 四段结构 + 数据流 + 架构取舍
│   ├── 02-防幻觉评估机制.md       ← ★ 最有原创性：证据索引 + boundaries 红线
│   ├── 03-踩坑记录.md             ← ★ 4 条真实技术坑
│   └── 04-工具选型与许可.md       ← 调研结论 + 许可注意事项
├── procedures/
│   └── job-application-loop.md   ← 给 AI 读的规程（相对路径，通用化）
├── examples/
│   ├── profile.example.yaml      ← 结构化简历空骨架（schema + 注释，无真实内容）
│   └── applications.example.yaml ← 投递台账空骨架 + 一条虚构示例
└── tools/
    └── to_formfill.py            ← 通用化：profile.yaml → 填表扩展 JSON（无个人默认值）
```

## 快速开始

1. 复制 `examples/` 两份骨架为 `data/profile.yaml`、`data/applications.yaml`，填自己的字段
   （`profile.yaml` 含手机号/邮箱/生日等个人信息，**永远不要提交公开仓库**）
2. 给 AI 读 `procedures/job-application-loop.md`，从「W1 · 投递前评估」开始跑
3. 有在线表单要填时，`python tools/to_formfill.py --print` 输出填表扩展可导入的 JSON
4. 看板用现成单页面板（如 [Echo6v9o/job-tracker](https://github.com/Echo6v9o/job-tracker)，MIT），
   数据放私有仓，git 可追溯、AI 可读写

**最值得借鉴的不是工具，是这两份文档**：
[`docs/02-防幻觉评估机制.md`](docs/02-防幻觉评估机制.md)（AI 改写边界怎么框死）与
[`docs/03-踩坑记录.md`](docs/03-踩坑记录.md)（4 条真实的工程坑）。

## 许可

- 本目录（README / docs / procedures / examples / tools）为原创内容，**MIT** 许可，见 `LICENSE`
- `tools/to_formfill.py` 是独立实现（读 YAML → 输出 JSON），**不包含任何第三方代码**
- 文档中提及的第三方项目仅给链接、不 vendor 代码：
  - [Echo6v9o/job-tracker](https://github.com/Echo6v9o/job-tracker) —— **MIT**，可引用/托管，保留 LICENSE 与署名
  - [1lck/AI-Resume-Form-Filling-Assistant](https://github.com/1lck/AI-Resume-Form-Filling-Assistant) —— **GPL-3.0**，**不能把代码复制进本仓**（传染 GPL），只给链接
- 详细许可分析见 [`docs/04-工具选型与许可.md`](docs/04-工具选型与许可.md)
