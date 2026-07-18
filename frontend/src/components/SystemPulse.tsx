"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type HealthPayload = {
  status?: string;
  deploy?: {
    gitShaShort?: string | null;
    environment?: string | null;
    serviceName?: string | null;
  };
  accounts?: {
    provider?: string;
    database?: { ok?: boolean; latencyMs?: number };
  };
  livekit?: { configured?: boolean; badge?: string };
  observability?: {
    errorWebhook?: boolean;
    webPush?: boolean;
    lastExpiryCron?: { at?: string; accounts?: number; sent?: number } | null;
  };
  billing?: {
    stripe?: boolean;
    webhook?: boolean;
    mode?: "test" | "live" | "off";
    freePath?: boolean;
  };
  avatar?: { dedicatedReady?: string[] };
};

type Chip = {
  key: string;
  label: string;
  ok: boolean | "warn" | "info";
  title: string;
};

function formatCronAge(iso: string | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "…";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Compact live ops strip for Account — shows deploy SHA, push, DB, LiveKit, Stripe, webhook.
 * Read-only against public GET /health (no secrets).
 */
export function SystemPulse({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Health ${res.status}`);
      const data = (await res.json()) as HealthPayload;
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : "Could not reach API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const chips: Chip[] = [];
  if (health) {
    const sha = health.deploy?.gitShaShort || "—";
    chips.push({
      key: "deploy",
      label: `API ${sha}`,
      ok: health.status === "ok" ? true : "warn",
      title: [
        health.deploy?.serviceName,
        health.deploy?.environment,
        health.deploy?.gitShaShort,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    const dbOk = health.accounts?.provider === "prisma" ? !!health.accounts.database?.ok : true;
    chips.push({
      key: "db",
      label:
        health.accounts?.provider === "prisma"
          ? `DB ${dbOk ? "ok" : "down"}${health.accounts.database?.latencyMs != null ? ` ${health.accounts.database.latencyMs}ms` : ""}`
          : "DB json",
      ok: dbOk,
      title: `Accounts provider: ${health.accounts?.provider ?? "?"}`,
    });

    chips.push({
      key: "push",
      label: health.observability?.webPush ? "Push on" : "Push off",
      ok: !!health.observability?.webPush,
      title: "VAPID web push configured on API",
    });

    const cron = health.observability?.lastExpiryCron;
    chips.push({
      key: "cron",
      label: `Expiry ${formatCronAge(cron?.at)}`,
      ok: cron?.at ? true : "warn",
      title: cron?.at
        ? `Last expiry cron ${cron.at} · accounts ${cron.accounts ?? "?"} · sent ${cron.sent ?? 0}`
        : "No expiry cron tick yet this process",
    });

    chips.push({
      key: "livekit",
      label: health.livekit?.configured ? "LiveKit ready" : "LiveKit off",
      ok: health.livekit?.configured ? true : "info",
      title: "LiveKit room metadata for avatar layer",
    });

    const stripeOn = !!health.billing?.stripe;
    const stripeMode = health.billing?.mode ?? (stripeOn ? "live" : "off");
    chips.push({
      key: "stripe",
      label: stripeOn
        ? stripeMode === "test"
          ? "Stripe test"
          : "Stripe live"
        : "Stripe off",
      ok: stripeOn ? true : "info",
      title: health.billing?.freePath
        ? `Free chat always works; mode=${stripeMode}; webhook=${health.billing?.webhook ? "on" : "off"}`
        : "Billing",
    });
    if (stripeOn) {
      chips.push({
        key: "stripeWebhook",
        label: health.billing?.webhook ? "Pay webhook on" : "Pay webhook off",
        ok: health.billing?.webhook ? true : "warn",
        title: "STRIPE_WEBHOOK_SECRET — checkout.session.completed on API /billing/webhook",
      });
    }

    chips.push({
      key: "webhook",
      label: health.observability?.errorWebhook ? "Alerts on" : "No error webhook",
      ok: health.observability?.errorWebhook ? true : "info",
      title: "Set ERROR_WEBHOOK_URL on Railway API for Slack/Discord 5xx pings",
    });

    const ready = health.avatar?.dedicatedReady?.length ?? 0;
    chips.push({
      key: "packs",
      label: ready > 0 ? `${ready} 4K packs` : "Interim avatars",
      ok: ready > 0 ? true : "info",
      title: "Dedicated Phase 4 MP4 packs (DROP_IN.md) when footage is ready",
    });
  }

  const chipCls = (ok: Chip["ok"]) =>
    ok === true
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : ok === "warn"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
        : "border-brand-border bg-brand-bg/60 text-brand-muted";

  return (
    <section
      className={`rounded-2xl border border-brand-border/80 bg-brand-panel/60 ${compact ? "p-3" : "p-4"}`}
      aria-label="Live system status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-brand-muted">System pulse</p>
          <p className="mt-0.5 text-sm font-medium text-brand-text">
            {loading && !health
              ? "Checking API…"
              : error
                ? "API unreachable"
                : health?.status === "ok"
                  ? "Production healthy"
                  : "Check status"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-ghost min-h-0 px-2.5 py-1 text-[11px]"
          disabled={loading}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-200/90" role="status">
          {error}
        </p>
      )}
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <li key={c.key}>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${chipCls(c.ok)}`}
                title={c.title}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    c.ok === true
                      ? "bg-emerald-300"
                      : c.ok === "warn"
                        ? "bg-amber-300"
                        : "bg-brand-muted"
                  }`}
                />
                {c.label}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-brand-muted">
        Live from API <code className="text-brand-muted/90">/health</code> · no secrets shown
      </p>
    </section>
  );
}
