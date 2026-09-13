/**
 * Offline guard: overflowing the live message window must fold dropped
 * turns into sessionNotes instead of silently discarding them.
 *
 * Usage: npm run test:memory-window
 */

import {
  SessionMemory,
  foldDroppedIntoNotes,
} from "../src/lib/memory/session-memory.js";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function main(): void {
  const mem = new SessionMemory(4);
  mem.addTurn("hey keep it slow", "slow it is, sheer still on");
  mem.addTurn("call me marcus", "alright marcus, closer");
  assert(mem.getRecentContext().messageCount === 4, "window should hold 4");
  assert(!mem.getSessionNotes(), "no roll-off notes before overflow");

  mem.addTurn("what are you wearing", "sheer thong, same as when we started");
  const notes = mem.getSessionNotes();
  const ctx = mem.getRecentContext();
  assert(ctx.messageCount === 4, `window should stay 4, got ${ctx.messageCount}`);
  assert(notes && notes.includes("rolled off the live window"), `missing roll-off: ${notes}`);
  assert(notes.includes("hey keep it slow") || notes.includes("Scene lock"), `dropped beat missing: ${notes}`);
  assert(
    ctx.messages.some((m) => m.content.includes("wearing")),
    "latest turn must remain in the live window",
  );
  assert(
    !ctx.messages.some((m) => m.content === "hey keep it slow"),
    "oldest user beat must leave the live window",
  );

  const folded = foldDroppedIntoNotes("prior note", [
    { id: "1", role: "user", content: "gym after work", createdAt: new Date().toISOString() },
  ]);
  assert(folded?.includes("prior note"), "must keep existing notes");
  assert(folded?.includes("gym after work"), "must keep dropped user beat");

  console.log("  ✓ memory window folds overflow into sessionNotes");
  console.log("  ✓ latest turns stay in the live window");
  console.log("  ✓ existing notes are preserved on roll-off");
}

try {
  main();
} catch (error) {
  console.error("✗ memory window smoke failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
