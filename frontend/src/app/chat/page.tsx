import { ChatApp } from "@/components/ChatApp";
import { PersonaGate } from "@/components/PersonaGate";
import { ReclaimAutostartGate } from "@/components/ReclaimAutostartGate";

export default function ChatPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PersonaGate allowResume />
      {/* The push hint lives in ChatApp's HintRail, which knows whether a
          session is live. A second sticky copy here rendered the same banner
          twice and pinned it over the avatar. */}
      <ReclaimAutostartGate>
        <ChatApp />
      </ReclaimAutostartGate>
    </div>
  );
}
