import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { login, signup } from "../api/auth";
import { useAuthStore } from "../store/auth";
import { buttonClass, ErrorBanner, FullPageSpinner, inputClass, Spinner } from "../components/ui";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { ready, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const isSignup = mode === "signup";

  if (!ready) return <FullPageSpinner />;
  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSignup && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await (isSignup ? signup : login)(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">CR</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-slate-500">AI code reviews with severity, line numbers and fixes.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
          {error && <ErrorBanner message={error} />}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
            {isSignup && <span className="mt-1 block text-xs text-slate-500">At least 8 characters.</span>}
          </label>
          <button type="submit" disabled={submitting || !email || !password} className={`${buttonClass} w-full`}>
            {submitting && <Spinner className="h-4 w-4 text-white" />}
            {isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link to={isSignup ? "/login" : "/signup"} state={location.state} className="font-medium text-indigo-600 hover:underline">
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
