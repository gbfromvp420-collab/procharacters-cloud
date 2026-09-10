/**
 * Grok replies end with an `avatar_intent` block — either a ```json fence or a
 * bare trailing object. `parseGrokReply` strips it before the text is stored,
 * but a live stream has no such luxury: whatever we forward is already on the
 * user's screen.
 *
 * This gate forwards prose and withholds anything that could be the beginning
 * of that block. Withheld text is not lost — the turn's `assistant_complete`
 * carries the authoritative parsed text and the client replaces the bubble.
 */

/** Index up to which `buf` is safe to show. */
function visibleBoundary(buf: string): number {
  let bound = buf.length;

  const fence = buf.indexOf("```");
  if (fence >= 0) bound = Math.min(bound, fence);

  const brace = buf.indexOf("{");
  if (brace >= 0) bound = Math.min(bound, brace);

  // A trailing run of backticks may be a fence that is still arriving.
  if (fence < 0) {
    const partial = buf.match(/`{1,2}$/);
    if (partial) bound = Math.min(bound, buf.length - partial[0].length);
  }

  return bound;
}

export interface VisibleTextGate {
  /** Feed one raw provider delta. */
  push(delta: string): void;
  /** How many characters have actually been shown to the user. */
  emittedLength(): number;
}

export function createVisibleTextGate(emit: (text: string) => void): VisibleTextGate {
  let buffer = "";
  let emitted = 0;

  return {
    push(delta: string): void {
      buffer += delta;
      const bound = visibleBoundary(buffer);
      if (bound > emitted) {
        emit(buffer.slice(emitted, bound));
        emitted = bound;
      }
    },
    emittedLength(): number {
      return emitted;
    },
  };
}
