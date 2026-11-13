import { cn } from "design-kit";

/** The Lexiro mark and wordmark. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img alt="" className="size-8 rounded-[22.37%]" src="/icons/lexiro.png" />
      <span className="font-latin text-xl font-bold tracking-tight">Lexiro</span>
    </span>
  );
}
