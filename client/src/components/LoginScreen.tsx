import { useEffect, useRef } from "react";
import { apiUrl } from "../lib/api";

interface LoginScreenProps {
  onLogin: () => void;
  loading?: boolean;
  authUrl?: string;
  error?: string;
  message?: string;
}

export default function LoginScreen({ onLogin, loading, authUrl, error, message }: LoginScreenProps) {
  const attemptedLoginRef = useRef(false);
  const fallbackUrl = authUrl ?? apiUrl("/api/auth/login?redirect=1");

  useEffect(() => {
    if (attemptedLoginRef.current || loading || authUrl) return;
    attemptedLoginRef.current = true;
    void onLogin();
  }, [authUrl, loading, onLogin]);

  return (
    <main className="login-screen">
      <section className="login-panel">
        <h1>pi agent</h1>
        <p>powered by gpt-5.5</p>
        {message ? <p role="status">{message}</p> : null}
        {error ? <p className="inline-error">Sign in failed: {error}</p> : null}
        <a className="login-button" href={fallbackUrl} aria-disabled={loading ? "true" : "false"}>
          {loading ? "opening..." : "sign in with openai"}
        </a>
        <a className="login-link" href={fallbackUrl}>
          open sign in directly
        </a>
      </section>
    </main>
  );
}
