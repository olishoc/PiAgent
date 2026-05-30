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
        <span className="login-icon app-icon-mark" aria-hidden="true" />
        <h1>local coding workspace</h1>
        <p>gpt-5.5 thinking mode</p>
        {message ? <p role="status">{message}</p> : null}
        {error ? <p className="inline-error">Sign in failed: {error}</p> : null}
        <button className="login-button" type="button" onClick={onLogin} disabled={loading}>
          {loading ? "opening..." : "sign in with openai"}
        </button>
        <a className="login-link" href={fallbackUrl}>
          open sign in directly
        </a>
      </section>
    </main>
  );
}
