"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const { login, register, user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    router.push("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, username, password, displayName || undefined);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            <span className="text-pink-500">Procharacters</span>
            <span className="text-gray-400">.cloud</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Naughty Syntax — 18+ only</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === "login"
                ? "bg-pink-600 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === "register"
                ? "bg-pink-600 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs text-gray-400 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          {mode === "register" && (
            <>
              <div>
                <label htmlFor="username" className="block text-xs text-gray-400 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="^[a-zA-Z0-9_-]+$"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none"
                  placeholder="cool_viewer_69"
                />
              </div>
              <div>
                <label htmlFor="displayName" className="block text-xs text-gray-400 mb-1">
                  Display Name (optional)
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none"
                  placeholder="Your display name"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="password" className="block text-xs text-gray-400 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-800 px-3 py-2">
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-pink-600 py-2.5 text-sm font-medium text-white transition hover:bg-pink-500 disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => setMode("register")} className="text-pink-500 hover:text-pink-400">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")} className="text-pink-500 hover:text-pink-400">
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
