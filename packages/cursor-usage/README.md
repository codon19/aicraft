# @codon/cursor-usage

> 终端查看 Cursor IDE token 用量与费用的 CLI 工具

基于 Cursor 官方 Dashboard 使用的 API（`/api/dashboard/get-filtered-usage-events` 和 `/api/usage-summary`），在终端里直接看到订阅额度、On-Demand 消费、团队配额、按模型分组的明细，无需打开浏览器。

![preview](https://raw.githubusercontent.com/codon19/aicraft/main/packages/cursor-usage/docs/preview.png)

## 特性

- 实时拉取当日 / 本周 / 本月 / 任意区间的用量
- 订阅额度 / On-Demand / 团队配额三条进度条一眼看全
- 按模型分组：请求数、On-Demand 次数、总 tokens、输入/输出、费用
- 响应式布局：宽屏表格 / 窄屏自动切卡片视图
- 凭证本地存储（`~/.config/cursor-usage/credentials.json`，`0600` 权限）
- ESM + TypeScript，Zod 校验所有 API 响应

## 安装

```bash
npm install -g @codon/cursor-usage
# 或
pnpm add -g @codon/cursor-usage
```

Node.js ≥ 18。

## 快速开始

```bash
# 首次配置凭证
cursor-usage login

# 查看今日用量（默认）
cursor-usage

# 本月
cursor-usage --month

# 最近 7 天
cursor-usage --week

# 自定义区间
cursor-usage --since 2026-04-01 --until 2026-04-15

# 只看账单摘要
cursor-usage status
```

## 获取凭证

Cursor 的 API 使用浏览器 cookie + CSRF 保护。首次 `cursor-usage login` 时按提示操作：

1. 浏览器打开 <https://cursor.com/cn/dashboard/usage>
2. 打开 DevTools → Network 面板
3. 找到 `get-filtered-usage-events` 请求
4. 从 **Request Headers** 复制完整 `Cookie` 字符串
5. 从 **Request Payload** 复制 `teamId` 和 `userId`

凭证会被写到 `~/.config/cursor-usage/credentials.json`，权限 `0600`，**不会**上传到任何地方。

## 命令

| 命令 | 说明 |
|---|---|
| `cursor-usage login` | 配置/更新凭证 |
| `cursor-usage status` | 只显示账单摘要（订阅 / On-Demand / 团队） |
| `cursor-usage models` | 按模型显示用量明细（默认命令） |
| `cursor-usage --help` | 查看所有参数 |

## 选项

| 参数 | 说明 |
|---|---|
| `--today` | 今日（默认） |
| `--week` | 最近 7 天 |
| `--month` | 本月 |
| `--since <YYYY-MM-DD>` | 起始日期 |
| `--until <YYYY-MM-DD>` | 结束日期 |
| `--json` | JSON 输出（方便脚本化） |
| `-h, --help` | 帮助 |
| `-v, --version` | 版本号 |

## 进阶

### 窄屏横向滚动

终端窄时默认会切卡片视图。如果你想强制用完整表格并横向滚动：

```bash
cursor-usage --month | less -RS
# ← → 键滚动，q 退出
```

### 强制宽度

管道输出时终端宽度获取不到，可以手动指定：

```bash
COLUMNS=140 cursor-usage --month
```

### 脚本集成

```bash
cursor-usage --month --json | jq '.totalChargedCents'
```

## 数据与安全

- **数据来源**：调用 Cursor 官方 Dashboard 所用的同一组 API 端点，**非逆向、非破解**。任何 Cursor 账号登录 <https://cursor.com/cn/dashboard/usage> 打开 DevTools 都能看到这些请求。
- **凭证存储**：本地明文保存在 `~/.config/cursor-usage/credentials.json`，权限 `0600`，**从不**上传、**从不**打印到 stdout。
- **非官方工具**：本工具与 Anysphere / Cursor 官方无关。API 可能随时变更。
- **Cost ~ 估算**：表格里的 `Cost` 列是按事件级 `chargedCents` 字段逐条累加得出的估算；顶部的 `On-Demand` 才是 Cursor 官方账单口径，以此为准。

## 开发

```bash
git clone https://github.com/codon19/aicraft.git
cd aicraft/packages/cursor-usage
pnpm install
pnpm dev -- --today   # tsx 直跑源码
pnpm build            # 编译到 dist/
```

## License

MIT © codon19
