"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildResumeCodeShareUrl } from "@/lib/share-links";

export type ResumePrintCardProps = {
  resumeCode: string;
  characterId: string;
  characterName: string;
  resumeExpiresAt?: string;
  messageCount?: number;
  dnaTreeLabel?: string;
  dnaTreeNodeId?: string;
  heatDepth?: string;
  onClose: () => void;
};

function formatExpiryLabel(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
  const date = new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (days < 0) return `Expired · ${date}`;
  if (days === 0) return `Expires today · ${date}`;
  if (days === 1) return `Expires tomorrow · ${date}`;
  return `Expires in ${days}d · ${date}`;
}

/**
 * Print-friendly single resume card with QR — for phone handoff / fridge notes.
 */
export function ResumePrintCard({
  resumeCode,
  characterId,
  characterName,
  resumeExpiresAt,
  messageCount,
  dnaTreeLabel,
  dnaTreeNodeId,
  heatDepth,
  onClose,
}: ResumePrintCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const dnaPower = !!(dnaTreeLabel || dnaTreeNodeId);
  const resumeUrl = buildResumeCodeShareUrl(resumeCode, {
    characterId,
    rehydrate: true,
    sessionMode: dnaPower ? "edge_pace" : undefined,
  });
  const expiryLabel = formatExpiryLabel(resumeExpiresAt);

  useEffect(() => {
    let cancelled = false;
    setQrError(null);
    void QRCode.toDataURL(resumeUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError("Could not render QR");
      });
    return () => {
      cancelled = true;
    };
  }, [resumeUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      id="resume-print-root"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-card-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[95dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-brand-border bg-brand-panel shadow-2xl print:max-h-none print:max-w-none print:rounded-none print:border-0 print:shadow-none print:bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-brand-border px-4 py-3 print:hidden">
          <p className="text-sm font-semibold text-brand-text">Resume card</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-medium text-white"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-muted hover:text-brand-text"
            >
              Close
            </button>
          </div>
        </div>

        <article className="space-y-5 p-6 text-center print:p-10">
          <header>
            <p className="text-[10px] uppercase tracking-[0.35em] text-brand-accent print:text-pink-600">
              Naughty Syntax · Procharacters
            </p>
            <h2
              id="resume-card-title"
              className="mt-2 text-2xl font-semibold text-brand-text print:text-black"
            >
              {characterName}
            </h2>
            <p className="mt-1 text-xs text-brand-muted print:text-neutral-600">
              Scan or open to continue this chat on any device
              {typeof messageCount === "number" ? ` · ${messageCount} msgs` : ""}
              {dnaPower
                ? ` · DNA ${dnaTreeLabel || dnaTreeNodeId}${heatDepth ? ` · ${heatDepth}` : ""}`
                : ""}
            </p>
            {dnaPower ? (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-600 print:text-violet-700">
                DNA power · Edge Pace reclaim
              </p>
            ) : null}
          </header>

          <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-xl border border-brand-border bg-white p-3 print:border-neutral-300">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code for resume ${resumeCode}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="text-xs text-brand-muted print:text-neutral-500">
                {qrError ?? "Generating QR…"}
              </p>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-muted print:text-neutral-500">
              Resume code
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-amber-200 print:text-black">
              {resumeCode}
            </p>
            {expiryLabel && (
              <p className="mt-2 text-xs text-brand-muted print:text-neutral-600">{expiryLabel}</p>
            )}
          </div>

          <div className="rounded-xl border border-brand-border/70 bg-brand-bg/50 px-3 py-3 print:border-neutral-200 print:bg-neutral-50">
            <p className="break-all font-mono text-[11px] leading-relaxed text-brand-text print:text-black">
              {resumeUrl}
            </p>
          </div>

          <p className="text-[10px] text-brand-soft print:text-neutral-500">
            Uncensored 21+ · Opening this chat extends the code automatically · KGC Ventures
          </p>
        </article>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden !important; }
              #resume-print-root, #resume-print-root * { visibility: visible !important; }
              #resume-print-root {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                background: white !important;
                display: block !important;
              }
            }
          `,
        }}
      />
    </div>
  );
}
