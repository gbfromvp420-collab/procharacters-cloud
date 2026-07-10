/** Trigger a browser download of a JSON document. */
export function downloadJson(filename: string, data: unknown): void {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([text.endsWith("\n") ? text : `${text}\n`], {
    type: "application/json;charset=utf-8",
  });
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
