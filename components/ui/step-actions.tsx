import type { ReactNode } from "react";
export function StepActions({
  children,
  className = "",
}: {
  children: ReactNode;
  aboveNavigation?: boolean;
  width?: "narrow" | "wide";
  className?: string;
}) {
  return (
    <div className={`savebar frost ${className}`} data-step-actions-space>
      {children}
    </div>
  );
}
