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
  // Magic links open the chat app (account panel / session restore lives there).
  const url = new URL(`${base}/chat`);
  url.searchParams.set("magic", token);
  return url.toString();
}
