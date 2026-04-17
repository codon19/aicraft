# 执行计划模板

> 用途：中大型改动（新包 / 新 tool / 跨模块重构 / 破坏性变更）开工前的"路线图"，是 AI 编码时的主要路标。
> 复制本文件到 `docs/exec-plans/active/YYYY-MM-DD-<short-kebab>.md`，填完再让 AI 动手。

---

## 元信息

- **计划名**：<一句话点题，例如 "mcp-swagger 新增 call_api 流式返回">
- **创建日期**：YYYY-MM-DD
- **负责人**：@<github-handle>
- **影响包**：`@codon/<pkg-a>`, `@codon/<pkg-b>` …
- **关联 PRD / 产品摘要**：[docs/product-specs/<pkg>.md](../../product-specs/<pkg>.md)
- **状态**：draft / active / blocked / completed

## 1. 目标（Why & What）

用 2-5 句话说清楚：

- 要解决的真实问题是什么？影响了谁？
- 成功后世界变成什么样？（最好能映射到一两条可观察的指标或行为）

## 2. 非目标（Out of scope）

明确列出**这次不做**的事。防止 AI 自行扩写。

- 不做 XXX
- 不改 YYY
- 不引入 ZZZ

## 3. 方案要点

用要点 + 必要的代码 / 目录示意，说明将如何实现。**不追求 100% 细节**，追求"能让下一个 agent 接手不会跑偏"的密度。

- 核心思路：…
- 关键抽象 / 数据结构：…
- 与现有模块的交互边界：…
- 如有需要，附一张 mermaid 流程图或状态图

## 4. 影响范围（文件级）

| 文件 / 目录 | 动作 | 备注 |
| --- | --- | --- |
| `packages/<pkg>/src/...` | 新增 / 修改 / 删除 | 关键改动点 |
| `packages/<pkg>/README.md` | 更新 | 工具表 / env var |
| `docs/product-specs/<pkg>.md` | 更新 | 能力清单同步 |

## 5. 拆解步骤

按可独立验证的小步拆分。每一步应该可以单独提交 / 单独让 AI 执行。

1. [ ] 步骤 1：…
2. [ ] 步骤 2：…
3. [ ] 步骤 3：…

## 6. 验收项（可执行、可引用、可验证）

直接对应 [prd-checklist.md](../../templates/prd-checklist.md) 的"验收清楚"（以本文件被复制到 `docs/exec-plans/active/` 下时的相对路径为准）。

- [ ] 行为 A 可被观察（手测 / snapshot / 日志）
- [ ] 行为 B 不破坏现有契约（schema 向后兼容 / 对旧 caller 透明）
- [ ] 文档已更新：README / product-specs / AGENTS.md（如涉及硬约束变动）
- [ ] `pnpm build` 通过

## 7. 风险与回滚

- **风险**：<识别出的主要风险，例如 "freshness check 性能回退">
- **缓解**：<预防措施，例如 "加 SWAGGER_FRESHNESS_THROTTLE_MS 旁路">
- **回滚**：<万一要 revert，需要回退哪些文件 / 发哪个 patch 版本>

## 8. 追问区（供后续补充）

把执行过程中冒出来的"其实我没想清楚"的点记录下来，不要直接改上面的章节，避免污染初版理解。

- 问题 X：…
- 决策 Y：…

---

## 完成后

1. 把状态改为 `completed`
2. 把本文件从 `docs/exec-plans/active/` 移到 `docs/exec-plans/completed/`
3. 如果最终实现与第 3 节方案要点有出入，在文末追加 "## 实际落地差异" 一节简述
