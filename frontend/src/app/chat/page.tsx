import { ChatApp } from "@/components/ChatApp";
import { ReclaimAutostartGate } from "@/components/ReclaimAutostartGate";

export default function ChatPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ReclaimAutostartGate>
        <ChatApp />
      </ReclaimAutostartGate>
    </div>
  );
}
