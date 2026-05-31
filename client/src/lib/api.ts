function backendOrigin() {
  if (typeof window === "undefined") return "http://127.0.0.1:1456";
  const { protocol, hostname, port, origin } = window.location;
  const servedByBackend = Boolean(port)
    && (protocol === "http:" || protocol === "https:")
    && (hostname === "127.0.0.1" || hostname === "localhost")
    && port !== "5173"
    && port !== "5174";
  return servedByBackend ? origin : "http://127.0.0.1:1456";
}

export const API_ORIGIN = backendOrigin();
export const WS_ORIGIN = API_ORIGIN.replace(/^http/, "ws");

export function apiUrl(path: string) {
  return `${API_ORIGIN}${path}`;
}

export async function ensureDesktopBackend() {
  const tauri = (window as any).__TAURI_INTERNALS__;
  if (!tauri) return { ok: true, desktop: false };
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("backend_status");
    return { ok: true, desktop: true };
  } catch (error) {
    return { ok: false, desktop: true, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function healthCheck() {
  try {
    const response = await fetch(apiUrl("/api/health"));
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    if (data.app !== "PiAgent" || data.features?.subagents !== true) {
      return { ok: false, error: "Local backend is outdated or incompatible" };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Local backend is not reachable" };
  }
}
