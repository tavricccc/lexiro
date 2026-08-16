import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-4 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] font-semibold tracking-[-0.02em] md:text-2xl lg:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">{actions}</div>}
    </header>
  );
}
