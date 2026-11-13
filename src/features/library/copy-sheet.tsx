import { useState } from "react";
import { toast } from "sonner";
import { ListGroup, ListRow, Sheet } from "design-kit";
import { errorMessage } from "@/data/api";
import { copyWords } from "@/data/library";
import { useLibrary } from "@/data/queries";
import { SetIcon } from "@/ui/set-icon";
import { orderedSets } from "./library-page";

/** Picks the set the selected words are copied into. */
export function CopySheet({ fromSetId, ids, open, onOpenChange, onDone }: {
  fromSetId: string;
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const library = useLibrary();
  const [busy, setBusy] = useState(false);
  const targets = orderedSets((library.data?.sets ?? []).filter((set) => set.id !== fromSetId));
  return (
    <Sheet description="同樣拼法的單字會合併，補上缺少的意思。" onOpenChange={onOpenChange} open={open} title={`複製 ${ids.length} 個單字到…`}>
      {targets.length ? (
        <ListGroup label="單字集">
          {targets.map((set) => (
            <ListRow
              detail={`${set.wordCount} 個單字`}
              disabled={busy}
              icon={<SetIcon className="size-8 [&_svg]:size-4" hue={set.hue} icon={set.icon} />}
              key={set.id}
              label={set.name}
              onClick={async () => {
                setBusy(true);
                try {
                  await copyWords(fromSetId, ids, set.id);
                  toast.success(`已複製到「${set.name}」`);
                  onOpenChange(false);
                  onDone();
                } catch (reason) {
                  toast.error(errorMessage(reason));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ))}
        </ListGroup>
      ) : <p className="py-6 text-center text-ink-muted">沒有其他單字集，先建立一個吧。</p>}
    </Sheet>
  );
}
