"use server";

/**
 * Next.js 15 Server Action — Studio Forge expand proxy.
 * Keeps API base server-side; client can also call REST directly.
 */

export type ForgeExpandActionInput = {
  fantasy: string;
  baseModelId?: string;
  displayNameHint?: string;
  audience?: "gay" | "bi" | "straight" | "any";
};

export type ForgeExpandActionResult =
  | { ok: true; data: unknown; expandMs?: number | null; source?: string }
  | { ok: false; error: string; status?: number };

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.API_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

export async function forgeExpandAction(
  input: ForgeExpandActionInput,
): Promise<ForgeExpandActionResult> {
  const fantasy = input.fantasy?.trim() ?? "";
  if (fantasy.length < 8) {
    return { ok: false, error: "Describe your fantasy (min 8 characters)" };
  }

  try {
    const res = await fetch(`${apiBase()}/api/v1/characters/forge/expand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fantasy,
        baseModelId: input.baseModelId,
        displayNameHint: input.displayNameHint,
        audience: input.audience,
      }),
      // Server action → backend; no browser CORS issues
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: text || `Forge failed (${res.status})`,
        status: res.status,
      };
    }

    const data = await res.json();
    return {
      ok: true,
      data,
      expandMs: data.expandMs ?? data.dna?.expandMs ?? null,
      source: data.source ?? data.dna?.source,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Forge network error",
    };
  }
}
