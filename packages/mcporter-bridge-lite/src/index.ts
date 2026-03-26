#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const execFileAsync = promisify(execFile)
const MCPORTER_BIN = process.env.MCPORTER_BIN || 'mcporter'
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_BUFFER = 10 * 1024 * 1024

interface McporterResult {
  [key: string]: unknown
  ok: boolean
  command: string
  timeout_ms: number
  returncode: number | string
  stdout: string
  stderr: string
  parsed_json: unknown
}

const server = new McpServer({
  name: 'mcporter-bridge-lite',
  version: '0.1.0',
})

function safeJsonParse(text: string | undefined): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  }
  catch {
    return null
  }
}

async function runMcporter(args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<McporterResult> {
  try {
    const { stdout, stderr } = await execFileAsync(MCPORTER_BIN, args, {
      env: process.env,
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
    })

    return {
      ok: true,
      command: `${MCPORTER_BIN} ${args.join(' ')}`,
      timeout_ms: timeoutMs,
      returncode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      parsed_json: safeJsonParse(stdout.trim()),
    }
  }
  catch (err: unknown) {
    const error = err as { code?: number | string, stdout?: string, stderr?: string, message?: string }
    return {
      ok: false,
      command: `${MCPORTER_BIN} ${args.join(' ')}`,
      timeout_ms: timeoutMs,
      returncode: error.code ?? 1,
      stdout: String(error.stdout ?? '').trim(),
      stderr: String(error.stderr ?? error.message ?? '').trim(),
      parsed_json: safeJsonParse(String(error.stdout ?? '').trim()),
    }
  }
}

function toMcpResponse(result: McporterResult) {
  return {
    content: [{ type: 'text' as const, text: result.stdout || result.stderr || 'No output' }],
    structuredContent: result,
  }
}

server.registerTool(
  'mcporter_list_servers',
  {
    description: 'List MCP servers known to mcporter.',
    inputSchema: z.object({
      timeoutMs: z.number().int().positive().optional().describe('Command timeout in milliseconds'),
    }),
  },
  async ({ timeoutMs }) => toMcpResponse(await runMcporter(['list', '--json'], timeoutMs)),
)

server.registerTool(
  'mcporter_help',
  {
    description: 'Show tool schema/docs for one MCP server.',
    inputSchema: z.object({
      server: z.string().describe('MCP server name, e.g. dingtalk-ai-table'),
      timeoutMs: z.number().int().positive().optional().describe('Command timeout in milliseconds'),
    }),
  },
  async ({ server: serverName, timeoutMs }) =>
    toMcpResponse(await runMcporter(['list', serverName, '--schema'], timeoutMs)),
)

server.registerTool(
  'mcporter_call_tool',
  {
    description: 'Call one mcporter-backed MCP tool.',
    inputSchema: z.object({
      server: z.string().describe('MCP server name, e.g. dingtalk-ai-table'),
      tool: z.string().describe('Tool name inside the MCP server'),
      argsJson: z.string().optional().describe('JSON string passed to mcporter --args'),
      timeoutMs: z.number().int().positive().optional().describe('Command timeout in milliseconds'),
    }),
  },
  async ({ server: serverName, tool, argsJson, timeoutMs }) => {
    const args = ['call', `${serverName}.${tool}`]
    if (argsJson) args.push('--args', argsJson)
    args.push('--output', 'json')
    return toMcpResponse(await runMcporter(args, timeoutMs))
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('mcporter-bridge-lite running on stdio')
}

main().catch((error) => {
  console.error('Fatal error in mcporter-bridge-lite:', error)
  process.exit(1)
})
