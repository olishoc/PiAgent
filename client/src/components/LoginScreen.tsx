interface LoginScreenProps {
  onLogin: () => void;
  loading?: boolean;
  error?: string;
  message?: string;
}

export default function LoginScreen({ onLogin, loading, error, message }: LoginScreenProps) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <h1>pi agent</h1>
        <p>powered by gpt-4.5</p>
        {message ? <p>{message}</p> : null}
        {error ? <p className="inline-error">Sign in failed: {error}</p> : null}
        <button onClick={onLogin} disabled={loading}>{loading ? "opening..." : "sign in with openai"}</button>
      </section>
    </main>
  );
}
