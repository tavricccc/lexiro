import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The one label-and-control pairing used across every form in the app.
 *
 * `layout="stacked"` is the default and suits dense editors; `layout="row"`
 * puts the label beside the control and suits settings lists. A field with no
 * label renders the control alone, so callers never invent a label just to
 * satisfy the component.
 */
export function Field({
  children,
  className,
  description,
  error,
  hint,
  label,
  layout = "stacked",
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  error?: string | false;
  hint?: ReactNode;
  label?: string;
  layout?: "stacked" | "row";
}) {
  const message = error && (
    <p className="mt-1.5 text-xs leading-5 text-destructive" role="alert">
      {error}
    </p>
  );

  if (layout === "row") {
    return (
      <label
        className={cn(
          "grid gap-2 sm:grid-cols-[minmax(7rem,0.4fr)_minmax(0,1fr)] sm:items-center sm:gap-5",
          className,
        )}
      >
        <span>
          {label && <span className="block text-sm font-medium">{label}</span>}
          {description && (
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        <span className="block min-w-0">
          {children}
          {message}
        </span>
      </label>
    );
  }

  return (
    <label className={cn("block", className)}>
      {(label || hint) && (
        <span className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && <span className="text-sm font-medium">{label}</span>}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </span>
      )}
      {description && (
        <span className="mb-2 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      )}
      {children}
      {message}
    </label>
  );
}

/** Groups fields on one row, collapsing to a single column on phones. */
export function FieldRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>
  );
}
