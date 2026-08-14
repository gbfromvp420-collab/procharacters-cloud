import { ChatApp } from "@/components/ChatApp";
import { PushEnableHint } from "@/components/PushEnableHint";
import { ReclaimAutostartGate } from "@/components/ReclaimAutostartGate";

export default function ChatPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Sticky top strip so Enable alerts isn't buried under the transcript */}
      <div className="pointer-events-none sticky top-0 z-30 mx-auto w-full max-w-5xl px-3 pt-2 sm:px-4">
        <div className="pointer-events-auto">
          <PushEnableHint className="mb-0 shadow-lg shadow-black/20" />
        </div>
      </div>
      <ReclaimAutostartGate>
        <ChatApp />
      </ReclaimAutostartGate>
    </div>
  );
}
