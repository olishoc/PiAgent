import { useCallback, useEffect, useRef, useState } from "react";
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
  const loginInFlightRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const response = await fetch(apiUrl("/api/auth/status"), { signal: controller.signal });
    window.clearTimeout(timeout);
    const data = await response.json();
    setState((current) => ({ ...current, loading: false, loggedIn: Boolean(data.loggedIn), accountId: data.accountId }));
    return data;
  }, []);

  const startLoginPolling = useCallback(() => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(async () => {
      const data = await refresh().catch(() => null);
      if (data?.loggedIn) {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        loginInFlightRef.current = false;
        setState((current) => ({ ...current, loading: false, loggedIn: true, accountId: data.accountId }));
      }
    }, 1000);
  }, [refresh]);

  useEffect(() => {
    refresh().catch(() => setState({ loading: false, loggedIn: false }));
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [refresh]);

  const openAuthUrl = useCallback(async (authUrl: string) => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (tauri) {
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(authUrl);
      } catch {
        window.open(authUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    window.open(authUrl, "_blank", "noopener,noreferrer");
  }, []);

  const login = useCallback(async () => {
    if (state.authUrl) {
      await openAuthUrl(state.authUrl);
      startLoginPolling();
      return;
    }
    if (loginInFlightRef.current || state.loading) return;
    loginInFlightRef.current = true;
    setState((current) => ({ ...current, loading: true, error: undefined, loginMessage: "Opening OpenAI sign in..." }));
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (!tauri) {
      const redirectUrl = apiUrl("/api/auth/login?redirect=1");
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
      setState((current) => ({
        ...current,
        authUrl: redirectUrl,
        loading: false,
        loginMessage: "OpenAI sign in should open. If nothing opened, use the direct link below."
      }));
      startLoginPolling();
      return;
    }
    try {
      const backend = await ensureDesktopBackend();
      if (!backend.ok) throw new Error(backend.error ?? "Backend startup failed");
      const response = await fetch(apiUrl("/api/auth/login"));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.loggedIn) {
        loginInFlightRef.current = false;
        setState((current) => ({
          ...current,
          loading: false,
          loggedIn: true,
          accountId: data.accountId,
          loginMessage: undefined
        }));
        return;
      }
      if (data.authUrl) {
        setState((current) => ({
          ...current,
          authUrl: data.authUrl,
          loginMessage: "OpenAI sign in is ready. If the browser did not open, use the direct link below."
        }));
        await openAuthUrl(data.authUrl);
      }
      setState((current) => ({ ...current, loading: false, loginMessage: "Finish sign in in your browser, then return here." }));
    } catch (error) {
      loginInFlightRef.current = false;
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        loginMessage: undefined
      }));
      return;
    }
    startLoginPolling();
  }, [openAuthUrl, startLoginPolling, state.authUrl, state.loading]);

  const logout = useCallback(async () => {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    loginInFlightRef.current = false;
    setState({ loading: false, loggedIn: false });
  }, []);

  return { ...state, login, logout, refresh };
}
