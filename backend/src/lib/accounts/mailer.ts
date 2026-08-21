/**
 * Optional email delivery for magic links.
 * If RESEND_API_KEY is set, sends via Resend. Otherwise logs and returns delivered=false.
 */

export interface SendMagicLinkResult {
  delivered: boolean;
  provider: "resend" | "none";
  error?: string;
}

export async function sendMagicLinkEmail(options: {
  to: string;
  magicUrl: string;
  expiresAt: string;
}): Promise<SendMagicLinkResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.MAGIC_LINK_FROM?.trim() || "Procharacters <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(
      `[magic-link] No RESEND_API_KEY — link for ${options.to}: ${options.magicUrl}`,
    );
    return { delivered: false, provider: "none" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: "Your Procharacters sign-in link",
        html: [
          `<p>Tap to sign in to <strong>Procharacters.cloud</strong>:</p>`,
          `<p><a href="${options.magicUrl}">${options.magicUrl}</a></p>`,
          `<p style="color:#888;font-size:12px">Expires at ${options.expiresAt}. If you didn't request this, ignore the email.</p>`,
        ].join(""),
        text: `Sign in to Procharacters.cloud:\n\n${options.magicUrl}\n\nExpires at ${options.expiresAt}`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[magic-link] Resend failed:", res.status, body);
      return { delivered: false, provider: "resend", error: body.slice(0, 200) };
    }

    return { delivered: true, provider: "resend" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    console.error("[magic-link] send error:", message);
    return { delivered: false, provider: "resend", error: message };
  }
}

export function buildMagicLinkUrl(token: string, siteBase?: string): string {
  const base =
    siteBase?.replace(/\/$/, "") ||
    process.env.MAGIC_LINK_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://procharacters-web-production-7288.up.railway.app";
  // Magic links open account settings (sign-in + email link confirm).
  const url = new URL(`${base}/account`);
  url.searchParams.set("magic", token);
  return url.toString();
}

export type ResumeLinkItem = {
  characterName: string;
  characterId: string;
  resumeCode: string;
  resumeUrl: string;
  messageCount: number;
  status: string;
  expiresAt?: string;
  recapLine?: string;
  dnaTreeLabel?: string;
};

function resumeLinksEmailBodies(options: {
  handle: string;
  items: ResumeLinkItem[];
}): { html: string; text: string; subject: string } {
  const n = options.items.length;
  const subject = `Your Procharacters resume links (${n})`;
  const rowsHtml = options.items
    .map(
      (i) =>
        `<li style="margin-bottom:12px"><strong>${escapeHtml(i.characterName)}</strong>` +
        ` · ${i.messageCount} msgs · ${escapeHtml(i.status)}` +
        (i.dnaTreeLabel ? ` · DNA ${escapeHtml(i.dnaTreeLabel)}` : "") +
        (i.expiresAt ? ` · expires ${escapeHtml(i.expiresAt)}` : "") +
        (i.recapLine
          ? `<br/><em style="color:#aaa">${escapeHtml(i.recapLine)}</em>`
          : "") +
        `<br/><code>${escapeHtml(i.resumeCode)}</code>` +
        `<br/><a href="${escapeAttr(i.resumeUrl)}">${escapeHtml(i.resumeUrl)}</a></li>`,
    )
    .join("");

  const html = [
    `<p>Hi <strong>@${escapeHtml(options.handle)}</strong> — here are your saved chat resume links:</p>`,
    `<ul>${rowsHtml}</ul>`,
    `<p style="color:#888;font-size:12px">Open a link on any device to continue that chat. Codes expire; refresh them anytime in Account settings.</p>`,
  ].join("");

  const textLines = [
    `Hi @${options.handle} — your Procharacters resume links:`,
    ``,
    ...options.items.flatMap((i) => [
      `${i.characterName} (${i.messageCount} msgs, ${i.status}${i.dnaTreeLabel ? `, DNA ${i.dnaTreeLabel}` : ""})`,
      i.recapLine ? `  Left at: ${i.recapLine}` : "",
      `  Code: ${i.resumeCode}`,
      `  Link: ${i.resumeUrl}`,
      i.expiresAt ? `  Expires: ${i.expiresAt}` : "",
      ``,
    ]),
    `Open a link on any device to continue that chat.`,
  ].filter((l) => l !== undefined);

  return { html, text: textLines.join("\n"), subject };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/** Email resume links to the account holder (Resend when configured). */
export async function sendResumeLinksEmail(options: {
  to: string;
  handle: string;
  items: ResumeLinkItem[];
}): Promise<SendMagicLinkResult & { subject?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.MAGIC_LINK_FROM?.trim() || "Procharacters <onboarding@resend.dev>";
  const { html, text, subject } = resumeLinksEmailBodies(options);

  if (options.items.length === 0) {
    return { delivered: false, provider: "none", error: "No resume links to send" };
  }

  if (!apiKey) {
    console.info(
      `[resume-links] No RESEND_API_KEY — would email ${options.to} (${options.items.length} links)\n${text}`,
    );
    return { delivered: false, provider: "none" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[resume-links] Resend failed:", res.status, body);
      return { delivered: false, provider: "resend", error: body.slice(0, 200) };
    }

    return { delivered: true, provider: "resend", subject };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    console.error("[resume-links] send error:", message);
    return { delivered: false, provider: "resend", error: message };
  }
}
