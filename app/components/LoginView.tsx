"use client";

type LoginViewProps = {
  onLogin: () => void;
  isLoggingIn: boolean;
  supportsPasskeys: boolean;
};

export function LoginView({ onLogin, isLoggingIn, supportsPasskeys }: LoginViewProps) {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">◇</span>
          <h1>Vault</h1>
        </div>
        <p className="login-desc">
          End-to-end encrypted personal data vault.
          <br />
          Your data never leaves your device unencrypted.
        </p>
        <button
          className="login-btn"
          onClick={onLogin}
          disabled={!supportsPasskeys || isLoggingIn}
        >
          {isLoggingIn ? "Signing in..." : "Sign in with Passkey"}
        </button>
        {!supportsPasskeys && (
          <p className="login-warning">
            Your browser doesn't support passkeys.
          </p>
        )}
        <p className="login-hint">
          First time? A new entity will be created automatically.
        </p>
      </div>
    </main>
  );
}
