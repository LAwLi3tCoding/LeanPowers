# LeanPowers 0.2.0 与 Superpowers 6.1.1

[English](comparison-superpowers.md)

## 项目谱系、致谢与对比边界

LeanPowers 是一个受 [Superpowers](https://github.com/obra/superpowers) 启发的独立项目。Superpowers 对证据优先工程、测试驱动开发、系统化调试、独立审查、完成前验证、安全分支交付以及规范使用子 Agent 和 worktree 的实践，是 LeanPowers 的直接思想基础。

感谢 Jesse Vincent 和所有 Superpowers 贡献者创建并开放这个项目、文档与工程方法。LeanPowers 不想和 Superpowers 分高下，也不是为了取代它。它是在认可这些工程原则的前提下，继续探索另一个问题：能否用更小、按风险自适应的控制面，保留影响工程结果的关键保障。

因此，这是一份谱系与取舍对比，不是胜负排名。

## 当前证据边界

对比基线固定为 Superpowers 6.1.1 的 14 个 Skill。当前已经验证的是源码结构、Skill 映射、规则和测试；尚未执行 LeanPowers 与 Superpowers 的成对 live benchmark。

这意味着当前可以说：

- LeanPowers 的指令面在结构上更小；
- LeanPowers 明确保留了八项硬性质量门槛；
- LeanPowers 采用按风险触发的流程，而不是固定完整流程链。

当前还不能说：

- LeanPowers 已经在真实任务中达到与 Superpowers 相同的成功率；
- LeanPowers 已经实测减少了指定比例的 token、时间或 Agent 调用；
- LeanPowers 在所有任务类型上都与 Superpowers 等效。

## 结构对比

| 维度 | Superpowers 6.1.1 | LeanPowers 0.2.0 | 共同保护的结果 |
| --- | --- | --- | --- |
| 用户可见核心 | 14 个 Skill | 6 个工程工作流 + `route`/`adapt` 两个控制 Skill | 从需求到交付的完整覆盖 |
| 主要 Skill 文本 | 18,516 词 | 工程工作流 2,561 词；全部 3,109 词 | 共享规则减少重复，不取消质量门槛 |
| 工作流入口 | 广泛检查并调用相关 Skill | `route` 只选择一个最低安全工作流 | 风险升高时仍然升级流程 |
| 需求与设计 | `brainstorming` 和 `writing-plans` 提供明确设计流程 | `shape` 在存在实质歧义或风险时启用 | 范围、约束、验收和架构决策 |
| 实现 | 独立 TDD 与计划执行 Skill | `build` 内置早期证据和回归约束 | 行为变化需要回归证明 |
| 调试 | `systematic-debugging` | `debug` 的可证伪根因状态机 | 未知原因不能直接宣称修复 |
| 审查 | 请求、接收审查以及 SDD 审查阶段 | 一个 findings-first `review`；高风险必须独立审查 | 正确性、兼容性、安全和范围检查 |
| 验证 | `verification-before-completion` | `verify` 将声明绑定到当前版本证据 | 旧证据和不可用证据不能通过 |
| 隔离与交付 | 专项 worktree 与完成分支流程 | `ship` 在脏工作区、并行冲突或交付风险出现时隔离 | 用户改动保护、授权和远端回读 |
| 子 Agent | 提供并行和 SDD 流程 | 默认单 Agent，仅对独立边界使用少量子 Agent | 高风险独立视角不被取消 |
| 项目学习 | 对比范围内无对应核心 Skill | `adapt` 可选、默认关闭、项目本地 | 经验不能降低任何安全或证据门槛 |

六个工程 `SKILL.md` 共 2,561 词，比 Superpowers 14 个基线文件的 18,516 词减少 86.2%。加入 219 词的 `route` 和 329 词的 `adapt` 后，LeanPowers 八个 Skill 共 3,109 词，结构文本仍减少 83.2%。这些数据只表示源码指令词数，不代表实际 token、延迟或任务质量。

## 谱系与适配映射

| Superpowers Skill 或关注点 | LeanPowers 中的适配位置 |
| --- | --- |
| `using-superpowers` | `route`、风险策略和工作流转换 |
| `brainstorming`、`writing-plans` | `shape` |
| `test-driven-development`、`executing-plans` | `build` |
| `systematic-debugging` | `debug` |
| `requesting-code-review`、`receiving-code-review` | `review`，接受问题后转入 `build` 或 `debug` |
| `verification-before-completion` | `verify` 和证据协议 |
| `using-git-worktrees`、`finishing-a-development-branch` | `ship` |
| `dispatching-parallel-agents`、`subagent-driven-development` | 子 Agent 策略以及按风险触发的 `build`/`review` |
| `writing-skills` | 保留为产品工程核心之外的专项能力 |

## LeanPowers 不降低的门槛

以下八项规则在所有模式下都有效：

1. 没有当前证据，不能宣称完成。
2. 未知故障必须先确定根因，再宣称修复。
3. 行为变化必须有适当回归证据。
4. 工作不能超出已声明范围。
5. 高风险工作必须独立审查。
6. 破坏性、不可逆、凭证相关或生产操作必须获得授权。
7. 新证据与原结论冲突时必须重新判断。
8. 重要验证缺口必须明确报告。

## 不同优化选择

Superpowers 倾向于通过更明确、完整和一致的流程建立工程纪律。它适合用于教学、统一团队习惯、处理陌生任务，或者偏好固定严谨流程的环境。

LeanPowers 将部分流程改为按条件触发，例如：清晰局部任务不强制先做完整设计审批；子 Agent、worktree 和独立审查根据任务边界与风险启用；未受影响的当前证据允许复用。它更适合希望保留结果保障、同时减少常规任务流程负担的环境。

这些是不同的优化选择，不是对 Superpowers 工程严谨性的否定。结构更小是否真的能在真实任务中保持结果，必须通过测试证明，不能从架构直接推断。

## 平衡结论

当前源码证据支持三个结论：

1. **LeanPowers 在结构上更轻。**它使用单一工作流负责人和共享策略，减少重复指令与固定流程链。
2. **影响结果的关键保障在设计上被保留。**范围、回归、根因、独立高风险审查、当前验证、授权和远端交付回读都仍是明确约束。
3. **真实效果是否非劣仍是开放问题。**目前没有 live 成对证据证明 LeanPowers 已达到 Superpowers 的任务成功率、可靠性和安全性，也没有证明目标效率收益已经实现。

两者的关系应当被理解为互补而非对立：

- **Superpowers** 是 LeanPowers 的上游灵感来源和完整工程工作流参考。
- **LeanPowers** 是在致敬这一基础上的轻量、按风险自适应探索。
- **基准测试**要判断的是 LeanPowers 能否在预先声明的非劣边界内保持效果并减少资源，而不是排出谁胜谁负。

未来即使基准测试通过，也只能说明 LeanPowers 在所测试的模型、任务、权限和预算条件下保持了结果；不能据此概括为一个项目普遍优于另一个项目。完整方法和当前证据缺口见 [benchmark.md](benchmark.md)。
