# LeanPowers

**轻量但不降级的 Agent 工程工作流**

*Essential workflows. Less ceremony.*

[English](README.md) · [与 Superpowers 对比](docs/comparison-superpowers.zh-CN.md) · [基准测试方法](docs/benchmark.md) · [致谢](ACKNOWLEDGMENTS.md) · [迁移指南](docs/migration.md)

LeanPowers 保留真正影响工程结果的约束：明确需求边界、回归证据、根因调试、独立审查、当前版本验证和安全交付；同时根据风险选择最短的安全路径。它是一个工作流微内核，不是常驻的大提示词，也不是重型编排服务。

> **发布状态：**`0.2.0` 是技术预览版，新增了基于显式反馈、按项目主动开启的学习能力。最新冻结的 12-run 确认性对比中，两套工作流的实际任务结果同为 5/6 PASS；LeanPowers 的模型 token 总和为 Superpowers 的 50.03%，通过 `<=60%` 综合 token 门槛。但预注册工程效果门槛仍为 FAIL：双方都在同一组变异回归检查中失败一次，LeanPowers 的质量流程一致性为 0/6，因此总体目标未达成。这是有明确边界的证据，不是完整发布基准，也不能概括为广泛等效。详见[确认性结果](docs/benchmarks/development-effects-confirmatory-2026-07-15.md)、[预注册](docs/benchmarks/development-effects-confirmatory-preregistration-2026-07-15.md)，以及更早的[试验](docs/benchmarks/development-effects-pilot-2026-07-14.md)和 [held-out](docs/benchmarks/development-effects-heldout-2026-07-14.md) 报告。

> **项目谱系与致谢：**LeanPowers 是一个受 [Superpowers](https://github.com/obra/superpowers) 启发的独立项目。Superpowers 对证据优先工程、TDD、系统化调试、审查、验证和安全交付的实践，为本项目提供了基础。LeanPowers 探索的是另一个优化点：让完整流程按风险选择，同时保留工程严谨性。LeanPowers 不是为了和 Superpowers 分高下，也不打算取代它。详见[致谢](ACKNOWLEDGMENTS.md)。

## 为什么是 LeanPowers

- 只有六个职责清晰的工程工作流，不强制走完整流程链。
- 500 词的 `route` 入口 Skill 提高发现率，并执行一个最低安全工作流。
- 事件驱动的 `adapt` 控制 Skill 提供可选项目学习；两个控制 Skill 都不属于工程阶段。
- 使用 `lean`、`standard`、`strict` 三档风险路径。
- 默认单 Agent；只有任务真正独立且可独立验证时才使用少量子 Agent。
- 宣称完成或交付前，必须有当前版本的证据。
- 安装包不需要 MCP、守护进程、遥测服务或额外安装依赖。
- Codex 与 Claude Code 都有原生插件包，同时保留通用 Agent Skills 兼容性。

## 从 GitHub 直接安装

仓库本身就是 Marketplace，不需要先 clone。

### Codex

```bash
codex plugin marketplace add LAwLi3tCoding/LeanPowers
codex plugin add leanpowers@leanpowers
```

Codex 使用原生 Skill 发现，不注入启动提示词。

### Claude Code

```bash
claude plugin marketplace add LAwLi3tCoding/LeanPowers
claude plugin install leanpowers@leanpowers
```

也可以在 Claude Code 交互会话中执行：

```text
/plugin marketplace add LAwLi3tCoding/LeanPowers
/plugin install leanpowers@leanpowers
```

Claude Code 只会在 `SessionStart` 注入一段精简、只读的路由说明。这个 Hook 不扫描或修改仓库，不访问网络，也不会派发 Agent。

## 快速开始

LeanPowers 可以根据任务自动选择入口，也支持显式调用。

```text
# Codex
$leanpowers:route 为这个工程任务选择最轻且安全的工作流。
$leanpowers:build mode=lean 补上缺失的参数校验和回归测试。
$leanpowers:debug 集成测试偶发返回空结果，请找出根因并修复。
$leanpowers:verify 证明当前分支可以交付。
$leanpowers:adapt 为当前项目启用 LeanPowers 学习。

# Claude Code
/leanpowers:route 为这个工程任务选择最轻且安全的工作流。
/leanpowers:shape mode=standard 设计一个向后兼容的分页改造。
/leanpowers:review 按验收标准审查当前 diff。
/leanpowers:ship 推送已验证的分支并创建用户要求的 PR。
/leanpowers:adapt 查看 LeanPowers 在当前项目学到了什么。
```

默认是 `mode=auto`。你也可以指定 `mode=lean`、`mode=standard` 或 `mode=strict`。模式是流程偏好，不能关闭安全、授权、范围和证据门槛；风险更高时会自动升级。

## 六个工程工作流分别做什么

| Skill | 使用场景 | 主要产物 |
| --- | --- | --- |
| `shape` | 需求有实质歧义，范围、架构或验收条件不清楚 | 可执行任务简报和 1–5 个交付切片 |
| `build` | 功能、已知根因修复、重构、配置或文档开发 | 已实现切片、针对性证据和剩余风险 |
| `debug` | 原因未知、间歇性或存在争议的故障 | 复现、可证伪假设、根因和修复证明 |
| `review` | 独立判断正确性、风险、兼容性和复杂度 | Findings-first 结论、严重级别和证据 |
| `verify` | 证明完成、修复、安全、可安装或可交付 | 声明到命令的证据映射和验证缺口 |
| `ship` | commit、push、PR、打包、发布或交接 | 实际目标端的版本回读证据 |

`route` 是一个 500 词的控制面入口 Skill。它通过匹配工程工作的开始阶段提高自动发现率，尤其补强 Codex；随后只执行一个最低安全工作流。明确的构建任务和有界的确定性单组件故障使用紧凑胶囊，其他任务只加载并执行选中的已安装 Skill，不会预加载完整流程链。严格风险专用的审查说明只会在严格验证通过后加载。

`adapt` 是另一个控制面 Skill，不是第七个工程工作流。它的名称表示“根据已验证反馈改变后续行为”。它处理显式结果反馈和学习数据维护，不会在 `shape? → build/debug → review? → verify? → ship?` 中增加一个必经阶段。

## 可选的项目学习

学习默认关闭。安装、Codex 启动、Claude `SessionStart` 和普通工作流都不会读取或创建学习状态。只有以下这类明确的项目级指令才会启用或维护学习：

```text
为当前项目启用 LeanPowers 学习。
为当前项目停用 LeanPowers 学习。
LeanPowers 在当前项目学到了什么？
忘记 tenant-filter 这条经验。
清空当前项目的已学习经验。
永久删除当前项目的 LeanPowers 学习数据。
```

启用后，随包 Node.js helper 会把数据保存在当前项目的 `.leanpowers/`，并将 `.leanpowers/` 写入 Git 本地 `info/exclude`，不会修改受版本控制的 `.gitignore`。它只根据显式纠正、确认、实际结果或持久项目偏好，保存归一化规则和有界证据摘要；不会保存原始对话、完整提示词、命令日志、堆栈、密钥、凭证或无关仓库内容。

检索结果只是建议，严格限制在当前项目，且最多返回三条相关经验。经验不能降低授权、范围、风险、根因定位、回归证据、独立审查或完成证据门槛。没有后台活动、网络访问、遥测、全局用户画像或跨项目共享。只有明确启用项目学习后才需要 Node.js 20+；学习关闭时，六个工程工作流仍然零运行时依赖。

停用学习会保留本地 ledger，便于之后检查或删除。忘记和清空会保留可审计事件历史；永久删除会实际重写本地学习树，与“清空并停用”一样，都需要明确的破坏性操作确认。

## 路由与模式

LeanPowers 每次只从一个工作流开始，出现可观察的升级条件时才跳转。

| 模式 | 典型信号 | 默认路径 |
| --- | --- | --- |
| `lean` | 清晰、局部、可逆，已有验证路径 | 当前适用证据完整时 `build → complete`；否则 `verify` |
| `standard` | 普通功能、多文件行为、有界不确定性 | 仅边界不清时 `shape(light)`，随后 `build/debug → complete`；证据不完整时 `verify` |
| `strict` | 安全（含认证、凭证/secret、密码学、签名验证）、鉴权、支付、隐私、迁移、并发、生产、不可逆操作 | 仅边界不清时 `shape(full)`，随后 `build/debug → 独立 review → complete`；仅在证据失效、明确要求验证/交付或跨产物声明时进入 `verify → ship（按需）` |

多个信号冲突时采用最高风险；无法判断时回退到 `standard`。验证失败、范围扩大、根因未知、公开边界变化或审查发现高危问题，都会升级流程。

示例：

- 有现成测试的私有方法重命名：`lean`。
- 普通多文件功能：`standard`，边界或不确定性较高时增加 `review`。
- 原因未知的生产鉴权故障：`strict`，从 `debug` 开始。
- 只要求审查：只执行 `review`，除非用户继续授权修复。
- 交付 PR：先取得当前 `verify` 证据，再由 `ship` 执行并回读远端状态。

## 轻流程不等于降低质量

以下规则在任何模式下都有效：

1. 没有当前证据，不能宣称完成。
2. 未知故障必须先定位根因，再宣称修复。
3. 行为变化必须有合适的回归证据。
4. 不超出用户声明的范围。
5. 高风险变更必须独立审查。
6. 破坏性、不可逆、凭证相关或生产操作必须获得授权。
7. 新证据推翻旧结论时必须重新判断。
8. 所有重要验证缺口都要明确报告。

证据与版本和作用范围绑定。未受影响的证据可以复用；代码、配置、依赖、生成物或环境变化后，只失效受影响的部分。

## 不同运行时的行为

| 能力 | Codex | Claude Code | 其他 Agent Skills 运行时 |
| --- | --- | --- | --- |
| 六个工程工作流 + `route`/`adapt` 控制 Skill | 支持 | 支持 | 支持 |
| 启动注入 | 无 | 精简路由说明 | 默认无 |
| reviewer / verifier | 运行时原生任务提示 | 随包 Agent | 单 Agent 执行；严格审查必须来自外部独立视角 |
| 核心质量门槛 | 保留 | 保留 | 保留 |

Codex 保持零启动注入，通过原生 metadata 发现 500 词的 `route` Skill。Claude Code 接收一段 111 词的只读路由提示，并在启动、清空或上下文压缩后恢复；它不会检查 `.leanpowers/`、扫描或修改仓库、访问网络或派发 Agent。六个工程工作流不需要 Node.js；只有用户明确启用项目学习后，可选学习 helper 才需要 Node.js 20+。

## 隐私与安全

- 不包含遥测或分析上报。
- Claude 启动 Hook 不扫描仓库、不访问网络。
- 学习默认关闭，启用后的数据也不会离开当前项目。
- 只保存归一化规则和有界证据摘要，不保存原始对话、密钥、环境变量值或完整日志。
- 完整命令输出保留在本地，只把有界摘要放进模型上下文。

Agent 指令本身不是安全边界。授权破坏性、生产或凭证相关操作前，请检查命令和 diff。详见 [SECURITY.md](SECURITY.md)。

## 与 Superpowers 6.1.1 的区别

LeanPowers 的比较范围包含 Superpowers 6.1.1 的全部 14 个 Skill。其中 13 个工程流程关注点被收敛为六个工程工作流，`writing-skills` 则保留为外部专项能力。六个工程 `SKILL.md` 共 2,882 词，比 14 个基线文件合计的 18,516 词减少 84.4%。`route` 和 `adapt` 两个控制 Skill 分别为 500 和 329 词，全部八个 LeanPowers Skill 共 3,711 词，仍减少 80.0%。这些数字使用相同的 `wc -w` 方法；以全部 14 个基线文件计算会明确包含外部的 Skill 编写能力。结构缩减已经验证。最新冻结的 12-run 对比中，双方实际通过数同为 5/6，LeanPowers 以 50.03% 的综合 token 占比通过效率目标；但双方都没有达到 6/6，且 LeanPowers 流程一致性为 0/6，因此工程效果门槛仍未通过。更广泛的质量非劣仍未得到证明。

这是一份谱系与取舍对比，不是胜负排名。Superpowers 仍是 LeanPowers 的上游灵感来源和完整工作流参考；LeanPowers 要验证的是：能否用更小、按风险自适应的控制面保留影响工程结果的关键保障。保留能力、不同优化选择、证据边界和完整结论见[中文对比文档](docs/comparison-superpowers.zh-CN.md)。迁移前请先读 [docs/migration.md](docs/migration.md)：**不要在同一会话同时启用两个系统的自动路由。**

## 基准测试

比较器接收符合 [schemas/benchmark-result.schema.json](schemas/benchmark-result.schema.json) 的成对结果：

```bash
node scripts/benchmark.mjs compare \
  --baseline path/to/superpowers-live.json \
  --candidate path/to/leanpowers-live.json \
  --out path/to/report
```

只有完整、live、盲评且条件完全配对的结果才可能通过发布门槛。模拟或不完整数据只能得到 `DIAGNOSTIC_ONLY`，任何硬失败都会阻断发布。场景、指标、阈值和当前证据缺口见 [docs/benchmark.md](docs/benchmark.md)。

真实开发效果见 [2026-07-14 成对开发试验](docs/benchmarks/development-effects-pilot-2026-07-14.md)：3 类任务 × 2 次重复 × 2 套工作流。双方都是 5/6 PASS；LeanPowers 的模型 token 中位数低 19.8%，耗时中位数低 9.5%。该结果属于试验性证据，尚未满足完整发布基准的覆盖范围和效率门槛。

另一份[冻结 held-out 检查](docs/benchmarks/development-effects-heldout-2026-07-14.md)只覆盖一例标准风险调试任务。两套工作流的实际任务都是 2/2 PASS，但 LeanPowers 流程一致性为 1/2，因此预注册工程效果门槛 FAIL；LeanPowers 的模型 token 中位占比为 Superpowers 的 79.6%，两组都未达到 `<=60%`。这一例不能证明广泛等效。

最新的[多任务确认性结果](docs/benchmarks/development-effects-confirmatory-2026-07-15.md)采用 3 个新冻结的标准风险任务，各做 2 次反向顺序重复。双方实际任务同为 5/6 PASS，并在同一次构建选项变异门槛上失败。LeanPowers 的模型 token 总和为 Superpowers 的 50.03%，通过综合 token 目标；但质量流程一致性为 0/6，因此工程效果门槛和总体目标仍为 FAIL，冻结结果不做事后改判。

多任务验证采用综合 token 目标：在完整配对矩阵上，LeanPowers 的模型 token 总和应约为 Superpowers 总和的 60% 或更低；质量仍是独立硬门槛。每组占比会完整公开，但不要求每个任务都单独低于 60%。旧 held-out 结果保留其更严格的冻结规则，不做事后改判。

## 开发

开发需要 Git 和 Node.js 20 或 22。安装后的工程工作流没有运行时依赖；只有用户明确启用项目学习时才使用 Node.js 20+。

```bash
npm run generate         # 重新生成两个运行时安装包
npm run generate:check   # 检查生成物是否漂移
npm test                 # 运行 Node 测试
npm run validate         # 校验同步、结构、预算和测试
npm run build            # 在 dist/ 生成已验证的发布产物
```

`metadata/`、`skills/`、`references/`、`agent-specs/` 和 `adapters/` 是规范源。不要手工修改 `plugins/`，应运行生成器。贡献规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
