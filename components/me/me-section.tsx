import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function MeSection({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="border-t py-7 first:border-t-0 first:pt-0 sm:py-9">
      <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
        <div>
          <div className="flex items-center gap-2.5">
            <Icon className="size-4 text-muted-foreground" />
            <h2 className="font-semibold">{title}</h2>
          </div>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export function MeField({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 sm:grid-cols-[minmax(8rem,0.55fr)_minmax(0,1fr)] sm:items-center sm:gap-5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
