import type { MouseEvent } from "react";

import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { speak } from "@/lib/speech";

/** The app's speak button: a green bubble beside the word it reads aloud. */
export function SpeakPill({
  text,
  label,
  size = "md",
}: {
  text: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event: MouseEvent) => {
        // A pill inside a row link speaks without opening the row.
        event.preventDefault();
        event.stopPropagation();
        speak(text);
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#7cc49c] text-[#13201a] transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "md" ? "h-[2.375rem] w-14" : "h-[2.125rem] w-[3.125rem]",
      )}
    >
      <Icons.speak className="size-[1.0625rem]" weight="fill" />
    </button>
  );
}
