import { exec } from "node:child_process";
import { state, buildDocUrl } from "../state.js";

export function openApiDoc(path: string, method?: string): string {
  if (state.loadError)
    return JSON.stringify({
      error: `Failed to load spec: ${state.loadError}`,
    });

  const matches = state.endpoints.filter((ep) => {
    const pathMatch = ep.path === path || ep.path.endsWith(path);
    if (!method) return pathMatch;
    return pathMatch && ep.method === method.toUpperCase();
  });

  if (matches.length === 0) {
    return JSON.stringify({
      error: `No endpoint found for path: ${path}`,
    });
  }

  const ep = matches[0];
  const url = buildDocUrl(ep);

  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} "${url}"`);

  return JSON.stringify({
    opened: true,
    method: ep.method,
    path: ep.path,
    summary: ep.summary,
    doc_url: url,
  });
}
