import type { ModelSummary, EventsSummary, UsageSummary } from "./cursor-api.js";

// ─── Colors ───
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  // Backgrounds (256-color)
  bg: "\x1b[48;5;235m",      // main panel bg
  bgAlt: "\x1b[48;5;237m",   // alternate row / subtle stripe
  bgHead: "\x1b[48;5;24m",   // header bar (dark teal)
  bgDeep: "\x1b[48;5;233m",  // page bg (slightly darker)
  // Foregrounds
  green: "\x1b[38;5;114m",
  yellow: "\x1b[38;5;221m",
  red: "\x1b[38;5;203m",
  white: "\x1b[38;5;255m",
  muted: "\x1b[38;5;250m",
  dimFg: "\x1b[38;5;244m",
  border: "\x1b[38;5;240m",
  accent: "\x1b[38;5;75m",
};

// ─── Helpers ───

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function isWideChar(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x2fffd) ||
    (code >= 0x30000 && code <= 0x3fffd)
  );
}

function visibleLen(s: string): number {
  const stripped = stripAnsi(s);
  let w = 0;
  for (const ch of stripped) w += isWideChar(ch.codePointAt(0) || 0) ? 2 : 1;
  return w;
}

function pad(s: string, width: number, align: "left" | "right" = "left"): string {
  const diff = width - visibleLen(s);
  if (diff <= 0) return s;
  return align === "right" ? " ".repeat(diff) + s : s + " ".repeat(diff);
}

/**
 * Wrap a line with a background color, re-applying bg after every reset
 * so embedded foreground resets don't tear the background.
 */
function bgLine(content: string, width: number, bg: string = c.bg): string {
  const inner = content.replace(/\x1b\[0m/g, `\x1b[0m${bg}`);
  const diff = Math.max(0, width - visibleLen(content));
  return `${bg}${inner}${" ".repeat(diff)}${c.reset}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function termWidth(): number {
  const envW = process.env.COLUMNS ? parseInt(process.env.COLUMNS, 10) : 0;
  const w = process.stdout.columns || envW || 80;
  return Math.max(40, Math.min(w, 140));
}

function progressBar(used: number, limit: number, width: number): string {
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const filled = Math.round(pct * width);
  const color = pct >= 1 ? c.red : pct >= 0.8 ? c.yellow : c.green;
  return `${color}${"█".repeat(filled)}${c.dimFg}${"░".repeat(width - filled)}${c.reset}`;
}

// ─── Billing Summary ───

export function renderBillingSummary(summary: UsageSummary): string {
  const plan = summary.individualUsage.plan;
  const od = summary.individualUsage.onDemand;
  const team = summary.teamUsage;

  const cycleStart = new Date(summary.billingCycleStart).toLocaleDateString("zh-CN");
  const cycleEnd = new Date(summary.billingCycleEnd).toLocaleDateString("zh-CN");

  const W = termWidth();
  const lines: string[] = [];

  // Empty top padding
  lines.push(bgLine("", W, c.bgDeep));

  // Header bar
  const headTxt = ` ${c.bold}${c.white}◆ Cursor Usage${c.reset}   ${c.white}${cycleStart} ~ ${cycleEnd}${c.reset}   ${c.dimFg}${summary.membershipType}${c.reset} `;
  lines.push(bgLine(headTxt, W, c.bgHead));
  lines.push(bgLine("", W, c.bgDeep));

  // Plan row
  const planBar = progressBar(plan.used, plan.limit, 22);
  const planPct = plan.limit > 0 ? Math.min(plan.used / plan.limit, 1) : 0;
  lines.push(
    bgLine(
      `  ${c.white}订阅额度${c.reset}   ${planBar}  ` +
        `${c.bold}${c.white}${pad(fmtCents(plan.used), 8, "right")}${c.reset}` +
        `${c.dimFg} / ${fmtCents(plan.limit)}  (${(planPct * 100).toFixed(0)}%)${c.reset}`,
      W,
      c.bgDeep,
    ),
  );

  // On-demand row
  const odColor = od.used > 0 ? c.yellow : c.green;
  lines.push(
    bgLine(
      `  ${c.white}On-Demand${c.reset}  ${odColor}${c.bold}${pad(fmtCents(od.used), 8, "right")}${c.reset}` +
        `${c.dimFg}  （本周期外额外计费）${c.reset}`,
      W,
      c.bgDeep,
    ),
  );

  // Team row
  if (team && team.onDemand.limit && team.onDemand.limit > 0) {
    const teamBar = progressBar(team.onDemand.used, team.onDemand.limit, 22);
    const teamPct = Math.min(team.onDemand.used / team.onDemand.limit, 1);
    lines.push(
      bgLine(
        `  ${c.white}团队额度${c.reset}   ${teamBar}  ` +
          `${c.bold}${c.white}${pad(fmtCents(team.onDemand.used), 8, "right")}${c.reset}` +
          `${c.dimFg} / ${fmtCents(team.onDemand.limit)}  (${(teamPct * 100).toFixed(0)}%)${c.reset}`,
        W,
        c.bgDeep,
      ),
    );
  }

  lines.push(bgLine("", W, c.bgDeep));
  return lines.join("\n");
}

// ─── Model Table ───

export function renderModelTable(
  models: ModelSummary[],
  events: EventsSummary,
  dateLabel: string,
): string {
  const W = termWidth();
  const lines: string[] = [];

  // Section title (on page bg)
  lines.push(
    bgLine(
      `  ${c.accent}${c.bold}${dateLabel}${c.reset}  ${c.dimFg}按模型分组${c.reset}`,
      W,
      c.bgDeep,
    ),
  );
  lines.push(bgLine("", W, c.bgDeep));

  // Compute natural widths
  const headers = ["Model", "Reqs", "OD", "Total", "Input", "Output", "Cost"];
  const rows = models.map((m) => [
    m.model,
    String(m.requests),
    String(m.onDemandRequests),
    fmtTokens(m.totalTokens),
    fmtTokens(m.inputTokens),
    fmtTokens(m.outputTokens),
    fmtCents(m.chargedCents),
  ]);
  const totalRow = [
    "Total",
    String(events.totalRequests),
    String(events.onDemandRequests),
    fmtTokens(events.totalTokens),
    fmtTokens(events.totalInputTokens),
    fmtTokens(events.totalOutputTokens),
    fmtCents(events.totalChargedCents),
  ];

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length), totalRow[i].length),
  );

  // natural width = 2 (outer pad) + sum(col+2) + (n-1) separators + 2 (borders)
  const naturalWidth =
    2 + colWidths.reduce((a, b) => a + b + 2, 0) + (colWidths.length - 1) + 2;

  if (naturalWidth > W) {
    // ── Narrow mode: card layout ──
    lines.push(...renderCards(models, W));
  } else {
    // ── Wide mode: table with dark bg ──
    lines.push(...renderTable(headers, rows, totalRow, colWidths, W));
  }

  // Footer summary
  lines.push(bgLine("", W, c.bgDeep));
  lines.push(
    bgLine(
      `  ${c.muted}Total: ${c.white}${c.bold}${events.totalRequests}${c.reset}${c.muted} msgs  ·  ` +
        `${c.white}${c.bold}${fmtTokens(events.totalTokens)}${c.reset}${c.muted} tokens  ·  ` +
        `订阅内 ${c.white}${events.includedRequests}${c.reset}${c.muted}  ·  ` +
        `OD ${c.yellow}${c.bold}${events.onDemandRequests}${c.reset}${c.muted}  ·  ` +
        `${c.green}${c.bold}${fmtCents(events.totalChargedCents)}${c.reset}`,
      W,
      c.bgDeep,
    ),
  );
  lines.push(
    bgLine(
      `  ${c.dim}${c.dimFg}* Cost 为按事件估算，以上方账单汇总为准  ·  窄屏自动切换卡片视图${c.reset}`,
      W,
      c.bgDeep,
    ),
  );
  lines.push(bgLine("", W, c.bgDeep));

  return lines.join("\n");
}

// ─── Wide: classic table with alternating row bg ───

function renderTable(
  headers: string[],
  rows: string[][],
  totalRow: string[],
  colWidths: number[],
  W: number,
): string[] {
  const out: string[] = [];
  const aligns: ("left" | "right")[] = [
    "left", "right", "right", "right", "right", "right", "right",
  ];

  const renderRow = (
    cells: string[],
    bg: string,
    stylers: ((v: string, i: number) => string)[],
  ): string => {
    const styled = cells.map((v, i) => {
      const s = stylers[i](v, i);
      return pad(s, colWidths[i], aligns[i]);
    });
    const line = `  ${c.border}│${c.reset} ${styled.join(` ${c.border}│${c.reset} `)} ${c.border}│${c.reset}`;
    return bgLine(line, W, bg);
  };

  const borderLine = (left: string, mid: string, right: string): string => {
    const seg = colWidths.map((w) => "─".repeat(w + 2));
    return bgLine(`  ${c.border}${left}${seg.join(mid)}${right}${c.reset}`, W, c.bg);
  };

  out.push(borderLine("┌", "┬", "┐"));

  // Header row
  const headStylers = headers.map(() => (v: string) => `${c.bold}${c.white}${v}${c.reset}`);
  out.push(renderRow(headers, c.bg, headStylers));

  out.push(borderLine("├", "┼", "┤"));

  // Data rows with alternating bg
  rows.forEach((row, idx) => {
    const stylers = [
      (v: string) => `${c.white}${v}${c.reset}`,
      (v: string) => `${c.muted}${v}${c.reset}`,
      (v: string) => (v !== "0" ? `${c.yellow}${v}${c.reset}` : `${c.dimFg}${v}${c.reset}`),
      (v: string) => `${c.muted}${v}${c.reset}`,
      (v: string) => `${c.muted}${v}${c.reset}`,
      (v: string) => `${c.muted}${v}${c.reset}`,
      (v: string) => `${c.green}${v}${c.reset}`,
    ];
    out.push(renderRow(row, idx % 2 === 0 ? c.bg : c.bgAlt, stylers));
  });

  out.push(borderLine("├", "┼", "┤"));

  // Total row
  const totalStylers = [
    (v: string) => `${c.bold}${c.white}${v}${c.reset}`,
    (v: string) => `${c.bold}${c.white}${v}${c.reset}`,
    (v: string) => `${c.bold}${c.yellow}${v}${c.reset}`,
    (v: string) => `${c.bold}${c.white}${v}${c.reset}`,
    (v: string) => `${c.bold}${c.white}${v}${c.reset}`,
    (v: string) => `${c.bold}${c.white}${v}${c.reset}`,
    (v: string) => `${c.bold}${c.green}${v}${c.reset}`,
  ];
  out.push(renderRow(totalRow, c.bg, totalStylers));
  out.push(borderLine("└", "┴", "┘"));

  return out;
}

// ─── Narrow: card layout ───

function renderCards(models: ModelSummary[], W: number): string[] {
  const out: string[] = [];

  models.forEach((m, idx) => {
    const bg = idx % 2 === 0 ? c.bg : c.bgAlt;

    const name = m.model.length > W - 18 ? m.model.slice(0, W - 21) + "…" : m.model;
    const cost = fmtCents(m.chargedCents);
    const costPad = W - 4 - visibleLen(name) - visibleLen(cost);

    // Line 1: name ... cost
    out.push(
      bgLine(
        `  ${c.bold}${c.white}${name}${c.reset}${" ".repeat(Math.max(1, costPad))}${c.bold}${c.green}${cost}${c.reset}`,
        W,
        bg,
      ),
    );

    // Line 2: stats
    const odTxt = m.onDemandRequests > 0
      ? `${c.yellow}${m.onDemandRequests}${c.reset}`
      : `${c.dimFg}0${c.reset}`;
    out.push(
      bgLine(
        `  ${c.dimFg}Reqs${c.reset} ${c.muted}${m.requests}${c.reset}  ` +
          `${c.dimFg}OD${c.reset} ${odTxt}  ` +
          `${c.dimFg}Total${c.reset} ${c.muted}${fmtTokens(m.totalTokens)}${c.reset}  ` +
          `${c.dimFg}In${c.reset} ${c.muted}${fmtTokens(m.inputTokens)}${c.reset}  ` +
          `${c.dimFg}Out${c.reset} ${c.muted}${fmtTokens(m.outputTokens)}${c.reset}`,
        W,
        bg,
      ),
    );
  });

  return out;
}
