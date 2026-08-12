import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink shadow-[0_1px_0_rgb(38_48_45/0.03)] outline-none placeholder:text-ink-muted/65 focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-50", className)}
      {...props}
    />
  );
}
