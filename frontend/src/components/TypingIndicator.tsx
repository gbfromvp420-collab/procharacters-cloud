export function TypingIndicator({ name }: { name?: string | null }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl border border-brand-border bg-brand-bg px-4 py-3">
        <span className="flex gap-1">
          <span className="typing-dot" />
          <span className="typing-dot animation-delay-150" />
          <span className="typing-dot animation-delay-300" />
        </span>
        {name && (
          <span className="text-xs text-brand-muted">{name} is typing…</span>
        )}
      </div>
    </div>
  );
}