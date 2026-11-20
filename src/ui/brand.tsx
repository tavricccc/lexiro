import { cn } from "design-kit";
import { Mascot } from "./mascot";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Mascot className="size-10" />
      <span className="font-latin text-2xl font-extrabold tracking-tight text-contrast">Lexiro</span>
    </span>
  );
}
