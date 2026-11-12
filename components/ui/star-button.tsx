import { Star } from "@phosphor-icons/react";
import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import type { WordKey } from "@/types";

export function StarButton({
  wordKey,
  className,
  size = "md",
}: {
  wordKey: WordKey;
  className?: string;
  size?: "sm" | "md";
}) {
  const starred = useLibraryStore((s) =>
    Boolean(s.state.words[wordKey]?.starred),
  );
  const toggleWordStar = useLibraryStore((s) => s.toggleWordStar);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void toggleWordStar(wordKey);
  };

  return (
    <button
      type="button"
      className={cn(
        "star-btn",
        size === "sm" && "star-btn-sm",
        starred && "is-starred",
        className,
      )}
      aria-label={starred ? t("setDetail.unstarWord") : t("setDetail.starWord")}
      aria-pressed={starred}
      data-no-sheet-drag=""
      onPointerDown={(e) => e.stopPropagation()}
      onClick={handleClick}
    >
      <Star weight={starred ? "fill" : "regular"} />
    </button>
  );
}
