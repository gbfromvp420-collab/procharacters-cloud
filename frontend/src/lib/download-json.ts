/** Trigger a browser download of a JSON document. */
export function downloadJson(filename: string, data: unknown): void {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  downloadText(filename, text.endsWith("\n") ? text : `${text}\n`, "application/json;charset=utf-8");
}

/** Trigger a browser download of plain text / markdown. */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([text.endsWith("\n") ? text : `${text}\n`], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w.\-]+/g, "_");
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMarkdown(filename: string, markdown: string): void {
  downloadText(filename, markdown, "text/markdown;charset=utf-8");
}

export function dispositionFilename(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(header);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1].replace(/"/g, "").trim());
  } catch {
    return match[1].replace(/"/g, "").trim() || fallback;
  }
}
