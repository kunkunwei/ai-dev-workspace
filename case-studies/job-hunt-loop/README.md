# Case Study：求职投递闭环（JD 评估 → 简历定制 → 表单填写 → 台账看板）

> 把求职投递做成一条**可追溯、可复核、不靠记忆**的闭环。核心不是工具，而是**纪律**：
> 单一事实源、AI 有边界（防幻觉）、改动可追溯（git）、隐私不进公开仓。
> 本案例是 [AI Dev Workspace](../../README.md) 方法论在「个人求职」场景的完整落地，内容已脱敏、通用化。

## 30 秒看懂四段结构

```
① JD 评估        ② 简历定制          ③ 在线表单填写       ④ 台账与看板
   ↓                ↓                    ↓                    ↓
 jd/<岗位>.md   tailor/<岗位>.md    填表扩展 + profile    applications.yaml
 AI 对照证据索引  改什么、为什么          → 表单 JSON        → 看板 / 面板
 命中/缺口/红线   每处改动可追溯          确定性填值          状态事实源（git 可追溯）
```

---

## 快速开始（照做即可）

以下命令都在本目录（`case-studies/job-hunt-loop/`）下执行。路径都是相对路径，直接复制即可。

**第 0 步 · 拿到目录**

```bash
# 方式 A：在 feature 分支上直接用
git fetch origin && git checkout feat/job-hunt-loop-case-study
cd case-studies/job-hunt-loop
```

```bash
# 方式 B：拷到自己项目的任意位置
cp -r case-studies/job-hunt-loop <你的项目>/
cd <你的项目>/job-hunt-loop
```

**第 1 步 · 建数据目录**

```bash
mkdir -p data jd tailor resume
```

**第 2 步 · 复制骨架（两份都要）**

```bash
cp examples/profile.example.yaml data/profile.yaml
cp examples/applications.example.yaml data/applications.yaml
```

**第 3 步 · 填 `data/profile.yaml`（⚠️ 隐私红线）**

- 把 `<占位符>` 替换成你自己的值（姓名、邮箱、学校、技能、证据锚点…）
- `data/` 已被本目录 `.gitignore` 排除，`profile.yaml` **永不提交公开仓**（含手机号/邮箱/生日）
- 若你把骨架拷到了没有 `.gitignore` 的目录，先补一行 `data/` 到你的 `.gitignore`

**第 4 步 · 填 `data/applications.yaml`**

- 至少录一条投递（照 `applications.example.yaml` 里「一条虚构示例」的格式）
- `stage` 只是快照；状态事实源是你后续选的看板或这份文件本身

**第 5 步 · 交给 AI：第一个 JD 评估**

```text
读 procedures/job-application-loop.md，然后执行 W1：
评估这个岗位：<把 JD 原文粘在这里>
```

产出：`jd/<日期>-<公司>-<岗位>.md`（命中/缺口/红线三张表 + 匹配度结论）、
`applications.yaml` 追加一条 `stage: 待投递`。

**第 6 步 · 按评估结果改简历**

```text
按这个 JD 改简历，出 <岗位> 版
```

产出：`tailor/<日期>-<公司>-<岗位>.md`（每处改动：原句 → 新句 → 依据）、更新后的 `resume/<岗位>.md`。
要出 PDF 时用自己的排版工具，**验证页数符合目标**。

**第 7 步 · （可选）在线填表 + 记进度**

- 填表：装好填表扩展后，`python tools/to_formfill.py --print`（输出可直接导入扩展的 JSON；需要 `pip install pyyaml`）
- 记进度：收到笔试/面试/拒信时，把邮件正文粘给 AI 触发 W3，更新 `applications.yaml`

> 每次改动记得 `git add && git commit` —— 「可追溯」是本闭环的承重墙。

---

## 前置条件

**必装**（没有就跑不起来）：

| 需要 | 为什么 | 怎么确认 |
|---|---|---|
| 一个 AI 编码 agent 环境 | 本案例的评估/定制/更新都交给 AI 执行，`procedures/` 那份规程就是给它读的 | 你能在命令行里启动 AI agent 即可 |
| Git | 每个岗位的改动要可追溯（`tailor/` 记录 + 提交历史） | `git --version` |

**可选**（用到才装，不装不影响闭环主体）：

| 需要 | 什么时候才需要 | 怎么装 |
|---|---|---|
| 在线表单填表扩展（[`1lck/AI-Resume-Form-Filling-Assistant`](https://github.com/1lck/AI-Resume-Form-Filling-Assistant)，GPL-3.0） | 想一键填公司官网的在线简历时 | 浏览器扩展页加载源码目录；**只给链接，本仓不 vendor 它的代码**（GPL 传染） |
| 可视化看板（如 [`Echo6v9o/job-tracker`](https://github.com/Echo6v9o/job-tracker)，MIT） | 想要拖拽式看板 + 私有仓云同步时 | 单独下载该 HTML；**保留它的 LICENSE 与署名** |
| Python 3 + PyYAML | 用 `tools/to_formfill.py` 生成确定性表单 JSON 时（不装的话，填表走扩展自带的「粘贴文本 → AI 导入」） | `pip install pyyaml` |
| Markdown → PDF 排版工具 | 简历要出定页数 PDF 时（本目录不含排版器，用你自己的） | 任意 |

> 不用装数据库、不用搭 Web 服务。整个闭环就是「文件 + Git + AI agent」。

---

## 目录导览（每份文件什么时候读）

| 文件 | 是什么 | 什么时候读 |
|---|---|---|
| `README.md` | 本文件 | 开始之前读一遍 |
| `LICENSE` | MIT 许可文本 | 分发/引用本目录内容时 |
| `.gitignore` | 隐私红线配置（排除 data/ jd/ tailor/ out/） | 建 `data/` 之前确认它就位 |
| `docs/01-闭环设计.md` | 四段结构 + 数据流 + 架构取舍 | 想理解「为什么这么设计」、或要改结构时 |
| `docs/02-防幻觉评估机制.md` | ★ 证据索引 + boundaries 红线（AI 改写边界怎么框死） | **跑 W1 评估之前**（AI 的判据来源） |
| `docs/03-踩坑记录.md` | ★ 4 条真实工程坑（file:// 丢数据 / Contents API / savedAt / last-write-wins） | **配看板 + 私有仓云同步时**（坑全在那） |
| `docs/04-工具选型与许可.md` | 工具调研结论 + 许可注意事项 | **选工具 / 装填表扩展之前** |
| `procedures/job-application-loop.md` | 给 AI 读的规程（W1/W2/W3） | **每次会话开始**，让 AI 先读它 |
| `examples/profile.example.yaml` | 结构化简历空骨架（schema + 注释） | 首次建 `data/profile.yaml` 时复制 |
| `examples/applications.example.yaml` | 投递台账空骨架 + 一条虚构示例 | 首次建 `data/applications.yaml` 时复制 |
| `tools/to_formfill.py` | `profile.yaml` → 填表扩展 JSON 的转换脚本 | 在线填表需要确定性 JSON 时（可选） |

---

## 日常怎么用（三条触发语）

| 触发语 | 干什么 | 产出 |
|---|---|---|
| 「评估这个岗位：<粘 JD>」 | W1：AI 对照证据索引输出命中/缺口/红线三张表 + 匹配度结论 | `jd/<岗位>.md`、`applications.yaml` 追加待投递 |
| 「按这个 JD 改简历，出 <岗位> 版」 | W2：以最接近的现存简历为基线，只改取舍/排序/措辞，数字必须回源核 | `tailor/<岗位>.md`（原句→新句→依据）、`resume/<岗位>.md` |
| 「XX 公司笔试通知了，11 月 3 号」 | W3：更新 stage / next_action / next_due，往 events 追加一条 | `applications.yaml` 更新（或同步到看板） |

完整流程与纪律见 `procedures/job-application-loop.md`。

---

## 分支说明

本 case study 放在独立分支，与工作区规范主体（`main`）分开：

| 分支 | 内容 | 怎么看 |
|---|---|---|
| `main`（默认） | 工作区规范与强制校验工具链（本仓主体） | `git checkout main` |
| `feat/job-hunt-loop-case-study` | 本 case study（防幻觉评估机制 + 4 条工程踩坑 + 通用化转换脚本） | `git fetch origin && git checkout feat/job-hunt-loop-case-study`，然后看 `case-studies/job-hunt-loop/` |

---

## 使用边界 / 不做什么

| 不做 | 为什么 |
|---|---|
| IMAP 自动抓邮件 | 要存邮箱授权、规则维护成本高、收益半年归零；半自动（粘邮件正文给 AI）足够 |
| 自动提交网申表单 | 填表扩展只填值，提交永远人工；填错比填慢惨 |
| 自动投递脚本 | 只覆盖招聘平台（渠道是公司官网），且违反平台协议有封号风险 |

---

## 许可与致谢

- 本目录（README / docs / procedures / examples / tools）为原创内容，**MIT** 许可，见 `LICENSE`
- `tools/to_formfill.py` 是独立实现（读 YAML → 输出 JSON），**不包含任何第三方代码**
- 文档中提及的第三方项目仅给链接、不 vendor 代码：
  - [`Echo6v9o/job-tracker`](https://github.com/Echo6v9o/job-tracker) —— **MIT**，可引用/托管，保留 LICENSE 与署名
  - [`1lck/AI-Resume-Form-Filling-Assistant`](https://github.com/1lck/AI-Resume-Form-Filling-Assistant) —— **GPL-3.0**，**不能把代码复制进本仓**（传染 GPL），只给链接
- 详细许可分析见 `docs/04-工具选型与许可.md`
