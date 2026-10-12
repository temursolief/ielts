"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    // Redirect based on role — middleware handles the exact path
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBF8]">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="block w-2.5 h-2.5 rounded-full bg-[#176B4D]" />
            <span className="text-[#176B4D] font-bold text-lg tracking-tight">
              IELTS Platform
            </span>
          </div>
          <h1 className="text-xl font-semibold text-[#202923]">Sign in</h1>
          <p className="mt-1 text-sm text-[#5C6E62]">
            Enter your credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="border border-[#DCE6DE] bg-white rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[#DCE6DE]">
              <label className="block text-xs font-medium text-[#5C6E62] mb-1">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm text-[#202923] bg-transparent outline-none placeholder:text-[#9CB0A3]"
                placeholder="you@example.com"
              />
            </div>
            <div className="px-4 py-3">
              <label className="block text-xs font-medium text-[#5C6E62] mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm text-[#202923] bg-transparent outline-none placeholder:text-[#9CB0A3]"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-[#B84242]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-[#176B4D] hover:bg-[#123D30] disabled:opacity-60 text-white text-sm font-medium py-2.5 px-4 rounded-md transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
