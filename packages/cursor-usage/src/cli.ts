#!/usr/bin/env node

import { loadCredential, loginInteractive, credentialPath } from "./credential.js";
import {
  aggregateByModel,
  discoverIdsFromCookie,
  fetchAllEvents,
  fetchUsageSummary,
  summarizeEvents,
  verifyCookie,
} from "./cursor-api.js";
import { renderBillingSummary, renderModelTable } from "./format.js";

// ─── ANSI ───

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
};

// ─── Version ───

const VERSION = "0.1.2";

// ─── Date helpers ───

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

function parseDateRange(args: string[]): DateRange {
  const now = new Date();
  const today = startOfDay(now);

  if (args.includes("--today")) {
    return { start: today, end: endOfDay(now), label: "今日" };
  }
  if (args.includes("--week")) {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { start: startOfDay(weekAgo), end: endOfDay(now), label: "最近 7 天" };
  }
  if (args.includes("--month")) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: startOfDay(monthStart),
      end: endOfDay(now),
      label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")} 月`,
    };
  }

  const sinceIdx = args.indexOf("--since");
  const untilIdx = args.indexOf("--until");
  if (sinceIdx !== -1 && untilIdx !== -1) {
    const s = new Date(args[sinceIdx + 1]);
    const e = new Date(args[untilIdx + 1]);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      console.error(`${c.yellow}日期格式无效，请使用 YYYY-MM-DD${c.reset}`);
      process.exit(1);
    }
    return {
      start: startOfDay(s),
      end: endOfDay(e),
      label: `${args[sinceIdx + 1]} ~ ${args[untilIdx + 1]}`,
    };
  }

  return { start: today, end: endOfDay(now), label: "今日" };
}

// ─── Help ───

function printHelp(): void {
  console.log(`
  ${c.cyan}${c.bold}cursor-usage${c.reset} ${c.dim}v${VERSION}${c.reset}
  ${c.dim}查看 Cursor IDE token 用量与费用${c.reset}

  ${c.white}${c.bold}USAGE${c.reset}
    ${c.green}cursor-usage${c.reset} ${c.dim}[command] [options]${c.reset}

  ${c.white}${c.bold}COMMANDS${c.reset}
    ${c.green}login${c.reset}              配置 Cursor session 凭证
    ${c.green}status${c.reset}             查看账单摘要（订阅额度 / On-Demand）
    ${c.green}models${c.reset}             按模型查看用量明细 ${c.dim}(默认)${c.reset}

  ${c.white}${c.bold}OPTIONS${c.reset}
    ${c.yellow}--today${c.reset}            今日用量 ${c.dim}(默认)${c.reset}
    ${c.yellow}--week${c.reset}             最近 7 天
    ${c.yellow}--month${c.reset}            本月
    ${c.yellow}--since${c.reset} <date>     起始日期 (YYYY-MM-DD)
    ${c.yellow}--until${c.reset} <date>     结束日期 (YYYY-MM-DD)
    ${c.yellow}--json${c.reset}             JSON 输出
    ${c.yellow}-h, --help${c.reset}         帮助
    ${c.yellow}-v, --version${c.reset}      版本号

  ${c.white}${c.bold}EXAMPLES${c.reset}
    ${c.dim}$${c.reset} cursor-usage                    ${c.dim}# 今日用量${c.reset}
    ${c.dim}$${c.reset} cursor-usage --month            ${c.dim}# 本月用量${c.reset}
    ${c.dim}$${c.reset} cursor-usage status             ${c.dim}# 只看账单摘要${c.reset}
    ${c.dim}$${c.reset} cursor-usage --week --json      ${c.dim}# 最近 7 天 JSON 输出${c.reset}
    ${c.dim}$${c.reset} cursor-usage --since 2026-04-01 --until 2026-04-15
    ${c.dim}$${c.reset} cursor-usage --month ${c.dim}| less -RS${c.reset}      ${c.dim}# 窄屏横向滚动 (←→ 方向键)${c.reset}

  ${c.white}${c.bold}TIPS${c.reset}
    ${c.dim}· 终端过窄时自动切换为卡片视图${c.reset}
    ${c.dim}· 管道输出可用 ${c.reset}COLUMNS=140 cursor-usage${c.dim} 强制宽度${c.reset}
`);
}

// ─── Ensure credential ───

const loginOpts = {
  discover: discoverIdsFromCookie,
  verify: verifyCookie,
};

async function ensureCredential() {
  const cred = loadCredential();
  if (cred) return cred;
  console.error(`${c.yellow}未找到凭证，开始首次配置...${c.reset}\n`);
  return loginInteractive(loginOpts);
}

// ─── Commands ───

async function cmdLogin(): Promise<void> {
  await loginInteractive(loginOpts);
}

async function cmdStatus(): Promise<void> {
  const cred = await ensureCredential();
  const summary = await fetchUsageSummary(cred);
  console.log(renderBillingSummary(summary));
}

async function cmdModels(args: string[]): Promise<void> {
  const cred = await ensureCredential();
  const range = parseDateRange(args);
  const jsonMode = args.includes("--json");

  console.error(`${c.dim}正在获取 ${range.label} 的数据...${c.reset}\n`);

  const [billingSummary, events] = await Promise.all([
    fetchUsageSummary(cred),
    fetchAllEvents(cred, { startDate: range.start, endDate: range.end }),
  ]);

  const models = aggregateByModel(events);
  const eventsSummary = summarizeEvents(events);

  if (jsonMode) {
    console.log(JSON.stringify({
      billing: {
        cycleStart: billingSummary.billingCycleStart,
        cycleEnd: billingSummary.billingCycleEnd,
        membership: billingSummary.membershipType,
        includedUsedCents: billingSummary.individualUsage.plan.used,
        includedLimitCents: billingSummary.individualUsage.plan.limit,
        onDemandUsedCents: billingSummary.individualUsage.onDemand.used,
      },
      dateRange: range.label,
      events: eventsSummary,
      models,
    }, null, 2));
    return;
  }

  console.log(renderBillingSummary(billingSummary));

  if (events.length === 0) {
    console.log(`  ${c.dim}${range.label} 无使用记录${c.reset}\n`);
    return;
  }

  console.log(renderModelTable(models, eventsSummary, range.label));
}

// ─── Main router ───

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith("-") ? args[0] : null;
  const flags = command ? args.slice(1) : args;

  if (flags.includes("--help") || flags.includes("-h")) {
    printHelp();
    return;
  }

  if (flags.includes("--version") || flags.includes("-v")) {
    console.log(`cursor-usage v${VERSION}`);
    return;
  }

  try {
    switch (command) {
      case "login":
        await cmdLogin();
        break;
      case "status":
        await cmdStatus();
        break;
      case "models":
        await cmdModels(flags);
        break;
      case "help":
        printHelp();
        break;
      case null:
        await cmdModels(flags);
        break;
      default:
        console.error(`${c.yellow}未知命令: ${command}${c.reset}\n`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("401") || err.message.includes("403")) {
        console.error(`\n${c.yellow}认证失败${c.reset}，Cookie 可能已过期。`);
        console.error(`请运行 ${c.green}cursor-usage login${c.reset} 重新配置凭证。`);
        console.error(`${c.dim}凭证路径: ${credentialPath()}${c.reset}\n`);
        process.exit(1);
      }
      throw err;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(`${c.yellow}错误:${c.reset}`, err instanceof Error ? err.message : err);
  process.exit(1);
});
