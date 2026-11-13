import { Star } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { starWords } from "@/data/library";

export function StarButton({ setId, wordId, starred, word }: { setId: string; wordId: string; starred: boolean; word: string }) {
  return (
    <Button
      aria-label={starred ? `取消標星 ${word}` : `標星 ${word}`}
      aria-pressed={starred}
      className={cn(starred && "text-highlight hover:text-highlight")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        starWords(setId, [wordId], !starred).catch((reason) => toast.error(errorMessage(reason)));
      }}
      size="icon-sm"
      variant="ghost"
    >
      <Star weight={starred ? "fill" : "regular"} />
    </Button>
  );
}
