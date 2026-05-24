import { useCallback, useEffect, useState } from "react";
import { apiUrl, ensureDesktopBackend } from "../lib/api";

interface AuthState {
  loading: boolean;
  loggedIn: boolean;
  accountId?: string;
  authUrl?: string;
  error?: string;
  loginMessage?: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ loading: false, loggedIn: false });

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const response = await fetch(apiUrl("/api/auth/status"), { signal: controller.signal });
    window.clearTimeout(timeout);
    const data = await response.json();
    setState((current) => ({ ...current, loading: false, loggedIn: Boolean(data.loggedIn), accountId: data.accountId }));
    return data;
  }, []);

  useEffect(() => {
    refresh().catch(() => setState({ loading: false, loggedIn: false }));
  }, [refresh]);

  const login = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: undefined, loginMessage: "Opening OpenAI sign in..." }));
    try {
      const backend = await ensureDesktopBackend();
      if (!backend.ok) throw new Error(backend.error ?? "Backend startup failed");
      const response = await fetch(apiUrl("/api/auth/login"));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.authUrl) {
        setState((current) => ({
          ...current,
          authUrl: data.authUrl,
          loginMessage: "OpenAI sign in is ready. If the browser did not open, use the direct link below."
        }));
        const tauri = (window as any).__TAURI_INTERNALS__;
        if (tauri) {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(data.authUrl);
        } else {
          window.open(data.authUrl, "_blank", "noopener,noreferrer");
        }
      }
      setState((current) => ({ ...current, loading: false, loginMessage: "Finish sign in in your browser, then return to PiAgent." }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        loginMessage: undefined
      }));
      return;
    }
    const timer = window.setInterval(async () => {
      const data = await refresh().catch(() => null);
      if (data?.loggedIn) {
        window.clearInterval(timer);
        window.location.reload();
      }
    }, 1000);
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
    setState({ loading: false, loggedIn: false });
  }, []);

  return { ...state, login, logout, refresh };
}
