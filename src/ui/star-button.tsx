import { useState } from "react";
import { Star } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, HeaderButton, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { starWords } from "@/data/library";

/** The star itself: it pops when its state changes, not when it first shows. */
export function StarMark({ starred }: { starred: boolean }) {
  const [first] = useState(starred);
  const [changed, setChanged] = useState(false);
  if (!changed && starred !== first) setChanged(true);
  return <Star className={cn(changed && "mark-in")} key={String(starred)} weight={starred ? "fill" : "regular"} />;
}

/** Stars a word; `inHeader` makes it one of the page toolbar's round buttons. */
export function StarButton({ inHeader, setId, wordId, starred, word }: { inHeader?: boolean; setId: string; wordId: string; starred: boolean; word: string }) {
  const Control = inHeader ? HeaderButton : Button;
  return (
    <Control
      aria-label={starred ? `取消標星 ${word}` : `標星 ${word}`}
      aria-pressed={starred}
      className={cn(starred && "text-highlight hover:text-highlight")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        starWords(setId, [wordId], !starred).catch((reason) => toast.error(errorMessage(reason)));
      }}
      {...(inHeader ? {} : { size: "icon-sm", variant: "ghost" } as const)}
    >
      <StarMark starred={starred} />
    </Control>
  );
}
