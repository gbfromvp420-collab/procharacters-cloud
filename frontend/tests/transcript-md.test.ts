import { describe, expect, it } from "vitest";
import { buildLocalTranscriptMarkdown } from "@/lib/transcript-md";

describe("buildLocalTranscriptMarkdown", () => {
  it("renders a header, metadata, and each message", () => {
    const md = buildLocalTranscriptMarkdown({
      characterName: "Liam",
      characterId: "liam",
      sessionId: "sess-1",
      resumeCode: "ABC123",
      messages: [
        { role: "user", content: "hey", createdAt: "2026-01-01T00:00:00.000Z" },
        { role: "assistant", content: "hi back", createdAt: "2026-01-01T00:00:05.000Z" },
      ],
    });
    expect(md).toContain("# Liam");
    expect(md).toContain("2 messages");
    expect(md).toContain("| Character | Liam (`liam`) |");
    expect(md).toContain("| Session | `sess-1` |");
    expect(md).toContain("| Resume code | `ABC123` |");
    expect(md).toContain("### You");
    expect(md).toContain("### Liam");
    expect(md).toContain("hi back");
  });

  it("shows an empty-state line when there are no messages", () => {
    const md = buildLocalTranscriptMarkdown({ characterName: "Emma", messages: [] });
    expect(md).toContain("# Emma");
    expect(md).toContain("_No messages yet._");
  });

  it("neutralizes triple backticks in message content", () => {
    const md = buildLocalTranscriptMarkdown({
      characterName: "X",
      messages: [{ role: "user", content: "```danger```" }],
    });
    expect(md).not.toContain("```danger```");
    expect(md).toContain("'''danger'''");
  });
});
