import * as React from "react";

import { cn } from "@/lib/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "t-input flex field-sizing-content min-h-28 w-full rounded-md border border-input bg-card px-3.5 py-3 text-base shadow-[var(--shadow-control)] transition-[background-color,color,border-color,box-shadow] duration-[var(--motion-control)] ease-[var(--ease-move)] outline-none placeholder:text-muted-foreground hover:border-foreground/12 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
