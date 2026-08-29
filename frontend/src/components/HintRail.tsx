import type { ReactNode } from "react";

/**
 * One promotional / status hint at a time.
 * Children that return null drop out of the DOM, so the first real banner wins.
 */
export function HintRail({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`hint-rail ${className}`}>{children}</div>;
}
