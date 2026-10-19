import { useState } from "react";
import type { AccountStatus } from "../../preload/index";

/**
 * The six-digit sign-in (spec §11, §12.1), shared by the account page and by
 * activation (addendum 41 §10): one way to sign in, wherever it is asked for.
 */
export function SignInForm({ onSignedIn }: { onSignedIn(status: AccountStatus): void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    const result = await window.vcwriter.requestSignInCode(email.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That code could not be sent");
      return;
    }
    setStage("code");
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const result = await window.vcwriter.verifySignInCode({
      email: email.trim(),
      code: code.trim(),
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "That code was not accepted");
      return;
    }
    onSignedIn(result.data);
  };

  return (
    <>
      {stage === "email" ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void requestCode();
          }}
        >
          <input
            type="email"
            required
            value={email}
            placeholder="you@example.com"
            aria-label="Email address"
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="submit"
            className="primary"
            disabled={busy || email.trim().length === 0}
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
        >
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            placeholder="6-digit code"
            aria-label="Sign-in code"
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            type="submit"
            className="primary"
            disabled={busy || code.trim().length === 0}
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => setStage("email")}
          >
            Use a different address
          </button>
        </form>
      )}

      {stage === "code" ? (
        <p className="muted">
          We sent a code to {email}. It expires shortly.
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
