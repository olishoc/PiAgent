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
      <div className="environment-backdrop" aria-hidden="true">
        <div className="sky-layer" />
        <div className="horizon-glow" />
        <div className="sea-layer sea-layer-a" />
        <div className="sea-layer sea-layer-b" />
        <div className="light-rain" />
      </div>
      <section className="login-panel">
        <img className="login-icon piagent-icon-img" src="/piagent-icon.png" alt="" aria-hidden="true" />
        <h1>local coding workspace</h1>
        <p>gpt-5.5</p>
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
