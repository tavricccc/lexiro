import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

/** Sharp square Swiss editorial portrait/monogram. */
export function Avatar({ className, name, src }: { className?: string; name: string; src?: string | null }) {
  return (
    <AvatarPrimitive.Root className={cn("relative inline-flex size-10 shrink-0 overflow-hidden rounded-none border border-line-strong bg-contrast", className)}>
      {src ? <AvatarPrimitive.Image alt={name} className="size-full object-cover" src={src} /> : null}
      <AvatarPrimitive.Fallback className="grid size-full place-items-center font-mono text-sm font-bold text-on-contrast">
        {name.trim().slice(0, 1).toUpperCase() || "?"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
