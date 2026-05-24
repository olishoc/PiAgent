import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface AuthState {
  loading: boolean;
  loggedIn: boolean;
  accountId?: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ loading: false, loggedIn: false });

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const response = await fetch(apiUrl("/api/auth/status"), { signal: controller.signal });
    window.clearTimeout(timeout);
    const data = await response.json();
    setState({ loading: false, loggedIn: Boolean(data.loggedIn), accountId: data.accountId });
    return data;
  }, []);

  useEffect(() => {
    refresh().catch(() => setState({ loading: false, loggedIn: false }));
  }, [refresh]);

  const login = useCallback(async () => {
    void fetch(apiUrl("/api/auth/login")).catch(() => {});
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
