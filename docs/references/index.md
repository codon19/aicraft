# 第三方参考（references）

本目录用来存放**第三方库、协议、工具的精选参考文档**，给 AI 在本仓库里提供可引用的"标准答案"，不用每次都重新上网搜或依赖其训练截止日期。

## 当前状态

**占位，暂无内容。** 需要时再补。

## 推荐放什么

优先放**单文件 llms.txt 风格**的压缩文档，而不是完整官方文档树：

- 项目用到的核心库的精选 API / 配置速查
  - 例：`zod-llms.txt`（zod 常用 schema 模式）
  - 例：`mcp-sdk-llms.txt`（MCP TypeScript SDK 关键类型）
- 长期要 follow 的规范 / 协议
  - 例：`mcp-protocol-llms.txt`
  - 例：`openapi-3.1-llms.txt`
- 构建 / 发布链路的速查
  - 例：`turbo-llms.txt`、`pnpm-publish-llms.txt`

## 命名约定

- 所有文件都以 `-llms.txt` 或 `-llms.md` 结尾，便于一眼识别
- 文件顶部加 4-6 行 front matter：来源 URL、抓取日期、适用版本、摘取范围
- 超过 500 行的参考文档请拆分或者收紧——这里是给 AI 做上下文的，不是做档案库的

## 取用方式

在 AGENTS.md / product-specs / exec-plan 里直接用相对路径引用即可，例如：

```md
zod schema 写法参考 [docs/references/zod-llms.txt](./zod-llms.txt)
```

## 与 `context7` MCP 的关系

- `context7` 适合**即时拉**最新文档，依赖网络 + MCP 在线
- 本目录适合**长期锚定**项目里反复用到的库版本，离线可用、纳入 PR 审查
- 一般策略：先 context7 查清楚 → 把反复命中的内容蒸馏到这里
