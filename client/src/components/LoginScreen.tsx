interface LoginScreenProps {
  onLogin: () => void;
  loading?: boolean;
}

export default function LoginScreen({ onLogin, loading }: LoginScreenProps) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <h1>pi agent</h1>
        <p>powered by gpt-4.5</p>
        <button onClick={onLogin} disabled={loading}>{loading ? "opening..." : "sign in with openai"}</button>
      </section>
    </main>
  );
}
