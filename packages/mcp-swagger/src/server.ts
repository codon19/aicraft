import type { JsonRpcMessage } from "./types.js";
import { TOOLS, handleToolCall } from "./tools/index.js";

function send(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

export function handleMessage(msg: JsonRpcMessage): void {
  if (msg.id === undefined) return;

  switch (msg.method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "mcp-swagger", version: "0.1.0" },
        },
      });
      break;

    case "tools/list":
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: { tools: TOOLS },
      });
      break;

    case "tools/call": {
      const params = msg.params as
        | { name: string; arguments: Record<string, unknown> }
        | undefined;
      if (!params) {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32602, message: "Missing params" },
        });
        return;
      }
      handleToolCall(params.name, params.arguments ?? {}).then((text) => {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          result: { content: [{ type: "text", text }] },
        });
      });
      break;
    }

    default:
      send({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: -32601,
          message: `Method not found: ${msg.method}`,
        },
      });
  }
}
