# 产品摘要（product-specs）

这里沉淀每个 `@codon/*` 包的**产品侧**事实：问题定义、目标用户、核心能力清单、边界、验收标准。

它**不是** README 的翻译，也**不是**完整 PRD。定位是：

- 给 AI 一个**比 README 更结构化**、比 PRD 更精炼的上下文入口
- 在规划新能力时，用这份摘要直接对照"该做 / 不该做"

## 当前包

- [mcp-swagger.md](./mcp-swagger.md) —— MCP Server for Swagger/OpenAPI/Knife4j
- [mcporter-bridge-lite.md](./mcporter-bridge-lite.md) —— MCP stdio bridge to the mcporter CLI

## 新增包时

1. 复制现有任一文件作为骨架
2. 保持章节结构统一：问题定义 / 目标用户 / 核心能力 / 边界（含非目标）/ 验收 / 关联文档
3. 在本 index 追加一行条目
4. **不要**把 README 的 setup / env var 细节搬过来——留指针即可
