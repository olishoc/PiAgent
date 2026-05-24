import { apiUrl } from "../lib/api";

interface LoginScreenProps {
  loading?: boolean;
  authUrl?: string;
  error?: string;
  message?: string;
}

export default function LoginScreen({ loading, authUrl, error, message }: LoginScreenProps) {
  const fallbackUrl = authUrl ?? apiUrl("/api/auth/login?redirect=1");
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
