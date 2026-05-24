import { apiUrl } from "../lib/api";

interface LoginScreenProps {
  onLogin: () => void;
  loading?: boolean;
  authUrl?: string;
  error?: string;
  message?: string;
}

export default function LoginScreen({ onLogin, loading, authUrl, error, message }: LoginScreenProps) {
  const fallbackUrl = authUrl ?? apiUrl("/api/auth/login?redirect=1");
  return (
    <main className="login-screen">
      <section className="login-panel">
        <h1>pi agent</h1>
        <p>powered by gpt-4.5</p>
        {message ? <p role="status">{message}</p> : null}
        {error ? <p className="inline-error">Sign in failed: {error}</p> : null}
        <button onClick={onLogin} disabled={loading}>{loading ? "opening..." : "sign in with openai"}</button>
        <a className="login-link" href={fallbackUrl} target="_blank" rel="noreferrer">
          open sign in directly
        </a>
      </section>
    </main>
  );
}
