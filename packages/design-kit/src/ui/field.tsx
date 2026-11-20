import * as React from "react";
import { cn } from "../lib/utils";

const controlClass =
  "w-full rounded-2xl border-2 border-line bg-surface px-4 text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-faint transition-[border-color,box-shadow] duration-[var(--motion-control)] ease-[var(--ease-move)] focus:border-contrast focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-40 aria-invalid:border-danger";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-32 resize-y py-3 leading-relaxed", className)} {...props} />;
}

/** A label, the control it names, and either a hint or the error that replaces it. */
export function Field({ children, error, hint, label }: {
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
  error?: string;
  hint?: string;
  label: string;
}) {
  const id = React.useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className="grid gap-2">
      <label className="px-1 text-sm font-bold text-ink-muted" htmlFor={id}>{label}</label>
      {children({ id, describedBy: message ? messageId : undefined, invalid: Boolean(error) })}
      {message ? (
        <p className={cn("px-1 text-sm", error && "message-in", error ? "text-danger" : "text-ink-faint")} id={messageId} key={error ? `error:${error}` : "hint"} role={error ? "alert" : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
