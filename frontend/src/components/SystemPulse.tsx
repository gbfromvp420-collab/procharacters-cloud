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

type MetricsPayload = {
  uptimeSec?: number;
  httpRequests?: number;
  httpErrors5xx?: number;
  httpErrors4xx?: number;
  wsConnections?: number;
  sessionsCreated?: number;
  chatTurns?: number;
  chatLlmErrors?: number;
  customCharactersCreated?: number;
  authLogin?: number;
  authFailures?: number;
  pushTestSent?: number;
  pushSubscribe?: number;
  pushExpirySent?: number;
  startedAt?: string;
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

function formatUptime(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 60) return `${Math.floor(sec)}s`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

function formatCount(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Compact live ops strip for Account — deploy SHA, push, DB, LiveKit, Stripe,
 * plus product counters from /metrics (process lifetime).
 */
export function SystemPulse({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, mRes] = await Promise.all([
        fetch(`${API_BASE}/health`, { cache: "no-store" }),
        fetch(`${API_BASE}/metrics`, { cache: "no-store" }).catch(() => null),
      ]);
      if (!hRes.ok) throw new Error(`Health ${hRes.status}`);
      setHealth((await hRes.json()) as HealthPayload);
      if (mRes?.ok) {
        setMetrics((await mRes.json()) as MetricsPayload);
      } else {
        setMetrics(null);
      }
    } catch (err) {
      setHealth(null);
      setMetrics(null);
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

    const dbOk =
      health.accounts?.provider === "prisma" ? !!health.accounts.database?.ok : true;
    chips.push({
      key: "db",
      label:
        health.accounts?.provider === "prisma"
          ? `DB ${dbOk ? "ok" : "down"}${
              health.accounts.database?.latencyMs != null
                ? ` ${health.accounts.database.latencyMs}ms`
                : ""
            }`
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
        ? `Free chat always works; mode=${stripeMode}; webhook=${
            health.billing?.webhook ? "on" : "off"
          }`
        : "Billing",
    });
    if (stripeOn) {
      chips.push({
        key: "stripeWebhook",
        label: health.billing?.webhook ? "Pay webhook on" : "Pay webhook off",
        ok: health.billing?.webhook ? true : "warn",
        title:
          "STRIPE_WEBHOOK_SECRET — checkout.session.completed on API /billing/webhook",
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

  if (metrics) {
    chips.push({
      key: "uptime",
      label: `Up ${formatUptime(metrics.uptimeSec)}`,
      ok: true,
      title: metrics.startedAt
        ? `Process started ${metrics.startedAt}`
        : "API process uptime",
    });
    chips.push({
      key: "http",
      label: `${formatCount(metrics.httpRequests)} req`,
      ok:
        (metrics.httpErrors5xx ?? 0) > 0
          ? "warn"
          : true,
      title: `HTTP requests this process · 4xx ${metrics.httpErrors4xx ?? 0} · 5xx ${
        metrics.httpErrors5xx ?? 0
      }`,
    });
    chips.push({
      key: "sessions",
      label: `${formatCount(metrics.sessionsCreated)} sessions`,
      ok: "info",
      title: "Sessions created this process lifetime",
    });
    chips.push({
      key: "turns",
      label: `${formatCount(metrics.chatTurns)} turns`,
      ok: (metrics.chatLlmErrors ?? 0) > 0 ? "warn" : "info",
      title: `Chat turns · LLM errors ${metrics.chatLlmErrors ?? 0}`,
    });
    chips.push({
      key: "ws",
      label: `${formatCount(metrics.wsConnections)} WS`,
      ok: "info",
      title: "WebSocket connections opened this process",
    });
    if ((metrics.customCharactersCreated ?? 0) > 0) {
      chips.push({
        key: "customs",
        label: `${formatCount(metrics.customCharactersCreated)} customs`,
        ok: true,
        title: "My Characters created this process",
      });
    }
    if ((metrics.pushSubscribe ?? 0) + (metrics.pushTestSent ?? 0) > 0) {
      chips.push({
        key: "pushOps",
        label: `Push sub ${formatCount(metrics.pushSubscribe)} · test ${formatCount(
          metrics.pushTestSent,
        )}`,
        ok: "info",
        title: "Push subscribe + test send counters",
      });
    }
  }

  const chipCls = (ok: Chip["ok"]) =>
    ok === true
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : ok === "warn"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
        : "border-brand-border bg-brand-bg/60 text-brand-muted";

  return (
    <section
      className={`rounded-2xl border border-brand-border/80 bg-brand-panel/60 ${
        compact ? "p-3" : "p-4"
      }`}
      aria-label="Live system status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-brand-muted">
            System pulse
          </p>
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
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${chipCls(
                  c.ok,
                )}`}
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
        Live from API <code className="text-brand-muted/90">/health</code>
        {metrics ? (
          <>
            {" "}
            + <code className="text-brand-muted/90">/metrics</code> (process lifetime)
          </>
        ) : null}{" "}
        · no secrets shown
      </p>
    </section>
  );
}
