# LeanPowers

**轻量但不降级的 Agent 工程工作流**

*Essential workflows. Less ceremony.*

[English](README.md) · [与 Superpowers 对比](docs/comparison-superpowers.md) · [基准测试方法](docs/benchmark.md) · [迁移指南](docs/migration.md)

LeanPowers 保留真正影响工程结果的约束：明确需求边界、回归证据、根因调试、独立审查、当前版本验证和安全交付；同时根据风险选择最短的安全路径。它是一个工作流微内核，不是常驻的大提示词，也不是重型编排服务。

> **基准状态：**确定性评分器和测试夹具已经实现，但 LeanPowers 与 Superpowers 的成对 live benchmark 尚未执行。下文的效率与非劣效阈值是发布门槛，不是已经测得的产品结论。

## 为什么是 LeanPowers

- 只有六个职责清晰的 Skill，不强制走完整流程链。
- 使用 `lean`、`standard`、`strict` 三档风险路径。
- 默认单 Agent；只有任务真正独立且可独立验证时才使用少量子 Agent。
- 宣称完成或交付前，必须有当前版本的证据。
- 安装包是静态、零依赖内容，不需要 MCP、守护进程或运行时服务。
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
$leanpowers:build mode=lean 补上缺失的参数校验和回归测试。
$leanpowers:debug 集成测试偶发返回空结果，请找出根因并修复。
$leanpowers:verify 证明当前分支可以交付。

# Claude Code
/leanpowers:shape mode=standard 设计一个向后兼容的分页改造。
/leanpowers:review 按验收标准审查当前 diff。
/leanpowers:ship 推送已验证的分支并创建用户要求的 PR。
```

默认是 `mode=auto`。你也可以指定 `mode=lean`、`mode=standard` 或 `mode=strict`。模式是流程偏好，不能关闭安全、授权、范围和证据门槛；风险更高时会自动升级。

## 六个 Skill 分别做什么

| Skill | 使用场景 | 主要产物 |
| --- | --- | --- |
| `shape` | 需求有实质歧义，范围、架构或验收条件不清楚 | 可执行任务简报和 1–5 个交付切片 |
| `build` | 功能、已知根因修复、重构、配置或文档开发 | 已实现切片、针对性证据和剩余风险 |
| `debug` | 原因未知、间歇性或存在争议的故障 | 复现、可证伪假设、根因和修复证明 |
| `review` | 独立判断正确性、风险、兼容性和复杂度 | Findings-first 结论、严重级别和证据 |
| `verify` | 证明完成、修复、安全、可安装或可交付 | 声明到命令的证据映射和验证缺口 |
| `ship` | commit、push、PR、打包、发布或交接 | 实际目标端的版本回读证据 |

## 路由与模式

LeanPowers 每次只从一个工作流开始，出现可观察的升级条件时才跳转。

| 模式 | 典型信号 | 默认路径 |
| --- | --- | --- |
| `lean` | 清晰、局部、可逆，已有验证路径 | `build → verify` |
| `standard` | 普通功能、多文件行为、有界不确定性 | `shape(light) → build/debug → verify` |
| `strict` | 安全、鉴权、支付、隐私、迁移、并发、生产、不可逆操作 | `shape(full) → build/debug → review → verify → ship` |

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
| 六个共享 Skill | 支持 | 支持 | 支持 |
| 启动注入 | 无 | 精简路由说明 | 默认无 |
| reviewer / verifier | 运行时原生任务提示 | 随包 Agent | 单 Agent 降级执行 |
| 核心质量门槛 | 保留 | 保留 | 保留 |

安装后的 LeanPowers 不需要 Node.js、MCP、守护进程、网络访问或仓库内运行状态。只有开发、校验、基准评测和构建本仓库时需要 Node.js 20+。

## 隐私与安全

- 不包含遥测或分析上报。
- Claude 启动 Hook 不扫描仓库、不访问网络。
- 工作流不存储密钥、环境变量或完整日志。
- 证据默认只存在当前上下文；严格且跨会话的任务可以使用运行时插件数据，但默认不在仓库写状态。
- 完整命令输出保留在本地，只把有界摘要放进模型上下文。

Agent 指令本身不是安全边界。授权破坏性、生产或凭证相关操作前，请检查命令和 diff。详见 [SECURITY.md](SECURITY.md)。

## 与 Superpowers 6.1.1 的区别

LeanPowers 把 Superpowers 的 14 个 Skill 收敛为六个工作流，并把重复规则提取为五份短共享策略。按相同的 `wc -w` 方法，LeanPowers V1 的六个 `SKILL.md` 共 2,196 词，Superpowers 6.1.1 的 14 个主 `SKILL.md` 共 18,516 词。结构缩减已经验证，但真实任务中的质量非劣效和效率收益仍需 live benchmark 证明。

保留能力、刻意差异和逐项证据见 [docs/comparison-superpowers.md](docs/comparison-superpowers.md)。迁移前请先读 [docs/migration.md](docs/migration.md)：**不要在同一会话同时启用两个系统的自动路由。**

## 基准测试

比较器接收符合 [schemas/benchmark-result.schema.json](schemas/benchmark-result.schema.json) 的成对结果：

```bash
node scripts/benchmark.mjs compare \
  --baseline path/to/superpowers-live.json \
  --candidate path/to/leanpowers-live.json \
  --out path/to/report
```

只有完整、live、盲评且条件完全配对的结果才可能通过发布门槛。模拟或不完整数据只能得到 `DIAGNOSTIC_ONLY`，任何硬失败都会阻断发布。场景、指标、阈值和当前证据缺口见 [docs/benchmark.md](docs/benchmark.md)。

## 开发

需要 Git 和 Node.js 20 或 22。安装后的插件本身没有运行时依赖。

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
