import { Avatar as AvatarRoot, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
import { cn } from "../lib/utils";

export function Avatar({ className, name, src }: { className?: string; name: string; src?: string | null }) {
  return (
    <AvatarRoot className={cn("relative inline-flex size-10 shrink-0 overflow-hidden rounded-full border-2 border-contrast-edge bg-contrast", className)}>
      {src ? <AvatarImage alt={name} className="size-full object-cover" src={src} /> : null}
      <AvatarFallback className="grid size-full place-items-center font-latin text-lg font-extrabold text-on-contrast">
        {name.trim().slice(0, 1).toUpperCase() || "?"}
      </AvatarFallback>
    </AvatarRoot>
  );
}
