import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface, Interface } from "node:readline";
import { z } from "zod";

const CONFIG_DIR = join(homedir(), ".config", "cursor-usage");
const CREDENTIALS_FILE = join(CONFIG_DIR, "credentials.json");

const CredentialSchema = z.object({
  cookie: z.string().min(1),
  teamId: z.number().nullable(),
  userId: z.number(),
  label: z.string().optional(),
  savedAt: z.string(),
});

export type Credential = z.infer<typeof CredentialSchema>;

export function credentialPath(): string {
  return CREDENTIALS_FILE;
}

export function loadCredential(): Credential | null {
  if (!existsSync(CREDENTIALS_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
    return CredentialSchema.parse(raw);
  } catch {
    return null;
  }
}

export function saveCredential(cred: Credential): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(cred, null, 2), {
    mode: 0o600,
  });
}

function ask(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Extract teamId and userId from the cookie string.
 * Cookie format contains: `team_id=<number>` and `workos_id=user_<id>`
 * The numeric userId comes from the API response — we ask the user for it,
 * or try to parse it from the cookie's associated dashboard URL params.
 */
function parseIdsFromCookie(cookie: string): {
  teamId: number | null;
  userId: number | null;
} {
  let teamId: number | null = null;
  let userId: number | null = null;

  const teamMatch = cookie.match(/team_id=(\d+)/);
  if (teamMatch) teamId = Number(teamMatch[1]);

  return { teamId, userId };
}

/** Discovery hook injected by cli.ts to avoid circular imports */
export type IdDiscoverer = (cookie: string) => Promise<{
  userId: number | null;
  teamId: number | null;
}>;

export interface LoginOptions {
  discover?: IdDiscoverer;
  verify?: (cookie: string) => Promise<boolean>;
}

export async function loginInteractive(
  opts: LoginOptions = {},
): Promise<Credential> {
  const C = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m" };

  console.error(`
  ${C.cyan}${C.bold}Cursor Usage — Login${C.reset}

  ${C.dim}只需要 Cookie，teamId 和 userId 会自动识别${C.reset}
  ${C.yellow}1.${C.reset} 浏览器打开 ${C.cyan}https://cursor.com/cn/dashboard/usage${C.reset}
  ${C.yellow}2.${C.reset} F12 → Network → 任选一个 ${C.green}cursor.com/api/...${C.reset} 请求
  ${C.yellow}3.${C.reset} Request Headers 里的 ${C.green}Cookie:${C.reset} 整行复制
`);

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const cookie = await ask(rl, `  ${C.green}?${C.reset} 粘贴完整 Cookie: `);
    if (!cookie) {
      console.error(`  ${C.red}✗ Cookie 不能为空${C.reset}`);
      process.exit(1);
    }
    if (!cookie.includes("WorkosCursorSessionToken=")) {
      console.error(`  ${C.yellow}⚠ Cookie 中未包含 WorkosCursorSessionToken，可能认证会失败${C.reset}`);
    }

    // Verify cookie works
    if (opts.verify) {
      process.stderr.write(`  ${C.dim}· 正在验证 Cookie...${C.reset}`);
      const ok = await opts.verify(cookie);
      if (!ok) {
        console.error(`\r  ${C.red}✗ Cookie 验证失败，请确认已从登录状态的浏览器复制${C.reset}`);
        process.exit(1);
      }
      console.error(`\r  ${C.green}✓${C.reset} Cookie 有效                                    `);
    }

    const parsed = parseIdsFromCookie(cookie);
    let teamId: number | null = parsed.teamId;
    let userId: number | null = null;

    // Auto-discover
    if (opts.discover) {
      process.stderr.write(`  ${C.dim}· 正在自动识别 teamId / userId...${C.reset}`);
      const discovered = await opts.discover(cookie);
      userId = discovered.userId;
      if (teamId === null) teamId = discovered.teamId;
      console.error(`\r                                              `);
    }

    if (teamId !== null) {
      console.error(`  ${C.green}✓${C.reset} teamId: ${C.bold}${teamId}${C.reset}`);
    } else {
      console.error(`  ${C.dim}· 未检测到 teamId（个人账号？）${C.reset}`);
    }

    if (userId !== null) {
      console.error(`  ${C.green}✓${C.reset} userId: ${C.bold}${userId}${C.reset}`);
    } else {
      console.error(`  ${C.yellow}⚠${C.reset} 未能自动识别 userId，请手动填一次`);
      console.error(`    ${C.dim}获取方式：在 Dashboard 页面 F12 → Network → ${C.green}get-filtered-usage-events${C.reset}${C.dim} 请求 → Payload 里的 userId${C.reset}`);
      const rawUserId = await ask(rl, `  ${C.green}?${C.reset} userId: `);
      const n = Number(rawUserId);
      if (!n || Number.isNaN(n)) {
        console.error(`  ${C.red}✗ userId 无效 (收到: "${rawUserId}")${C.reset}`);
        process.exit(1);
      }
      userId = n;
    }

    const label = await ask(rl, `  ${C.green}?${C.reset} 给账号起个名字（可选，回车跳过）: `);

    const cred: Credential = {
      cookie,
      teamId,
      userId: userId as number,
      label: label || undefined,
      savedAt: new Date().toISOString(),
    };

    saveCredential(cred);
    console.error(`
  ${C.green}✓${C.reset} 凭证已保存到 ${C.dim}${CREDENTIALS_FILE}${C.reset}
  ${C.dim}权限 600，仅当前用户可读${C.reset}
`);
    return cred;
  } finally {
    rl.close();
  }
}
