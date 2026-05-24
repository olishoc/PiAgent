export const API_ORIGIN = "http://127.0.0.1:1456";
export const WS_ORIGIN = "ws://127.0.0.1:1456";

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
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, error: "Local backend is not reachable" };
  }
}
