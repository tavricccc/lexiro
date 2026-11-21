import { Avatar as UIAvatar, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
import { cn } from "../lib/utils";

export function Avatar({ className, name, src }: { className?: string; name: string; src?: string | null }) {
  return (
    <UIAvatar aria-label={name} className={cn("relative inline-flex size-10 shrink-0 overflow-hidden rounded-none border border-line-strong bg-contrast", className)} role="img">
      {src ? <AvatarImage alt={name} className="size-full object-cover" src={src} /> : null}
      <AvatarFallback className="grid size-full place-items-center font-mono text-sm font-bold text-on-contrast">
        {name.trim().slice(0, 1).toUpperCase() || "?"}
      </AvatarFallback>
    </UIAvatar>
  );
}
