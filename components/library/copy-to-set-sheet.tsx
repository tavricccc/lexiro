import { Plus, X, Check } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SetGlyph } from "@/components/redesign/primitives";
import { SwipeableSheetContent } from "@/components/ui/bottom-sheet";
import { t } from "@/lib/i18n";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { useLibraryStore } from "@/stores/library-store";
import type { WordKey } from "@/types";

export function CopyToSetSheet({
  open,
  onClose,
  sourceSetId,
  wordKeys,
  onCopied,
}: {
  open: boolean;
  onClose: () => void;
  sourceSetId: string;
  wordKeys: WordKey[];
  onCopied?: (targetSetId: string) => void;
}) {
  const state = useLibraryStore((s) => s.state);
  const copyWordsToSet = useLibraryStore((s) => s.copyWordsToSet);
  const [newSetName, setNewSetName] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const sourceSet = state.sets.find((s) => s.id === sourceSetId);
  const otherSets = state.sets.filter((s) => s.id !== sourceSetId);

  const handleCopyToExisting = async (targetSetId: string) => {
    if (!wordKeys.length || busy) return;
    setBusy(true);
    try {
      const result = await copyWordsToSet({
        sourceSetId,
        wordKeys,
        targetSetId,
      });
      const targetName =
        state.sets.find((s) => s.id === result.targetSet.id)?.setName ?? "";
      toast.success(
        result.copiedQuestions > 0
          ? t("setDetail.copiedWithQuestionsToast", {
              words: result.copiedWords,
              questions: result.copiedQuestions,
              name: targetName,
            })
          : t("setDetail.copiedToast", {
              words: result.copiedWords,
              name: targetName,
            }),
      );
      onClose();
      onCopied?.(result.targetSet.id);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndCopy = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newSetName.trim();
    if (!trimmed || !wordKeys.length || busy) return;
    setBusy(true);
    try {
      const result = await copyWordsToSet({
        sourceSetId,
        wordKeys,
        newSet: {
          setName: trimmed,
          folderId: sourceSet?.folderId ?? UNCATEGORIZED_FOLDER_ID,
          hue: sourceSet?.hue ?? "mint",
          icon: sourceSet?.icon ?? "books",
        },
      });
      toast.success(
        result.copiedQuestions > 0
          ? t("setDetail.copiedWithQuestionsToast", {
              words: result.copiedWords,
              questions: result.copiedQuestions,
              name: trimmed,
            })
          : t("setDetail.copiedToast", {
              words: result.copiedWords,
              name: trimmed,
            }),
      );
      setNewSetName("");
      onClose();
      onCopied?.(result.targetSet.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim">
          <SwipeableSheetContent
            className="sheet"
            aria-describedby={undefined}
            onDismiss={onClose}
          >
            <div className="sheet-head">
              <Dialog.Title>
                {t("setDetail.copyToSetTitle", { count: wordKeys.length })}
              </Dialog.Title>
              <Dialog.Close
                className="btn btn-icon btn-glass"
                aria-label={t("redesign.close")}
              >
                <X />
              </Dialog.Close>
            </div>

            <form className="stack" onSubmit={handleCreateAndCopy}>
              <label className="field">
                <span>{t("setDetail.copyToNewSet")}</span>
                <div className="rowx">
                  <input
                    className="input"
                    type="text"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    placeholder={t("setDetail.newSetPlaceholder")}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!newSetName.trim() || busy}
                  >
                    <Plus weight="bold" />
                    {t("setDetail.createAndCopy")}
                  </button>
                </div>
              </label>
            </form>

            {otherSets.length > 0 && (
              <div className="stack" style={{ marginTop: 20 }}>
                <p className="label" style={{ margin: 0 }}>
                  {t("setDetail.copyToExistingSet")}
                </p>
                <div className="copy-set-list">
                  {otherSets.map((set) => {
                    const active = selectedSetId === set.id;
                    return (
                      <button
                        key={set.id}
                        type="button"
                        className="copy-set-option"
                        aria-pressed={active}
                        disabled={busy}
                        onClick={() => setSelectedSetId(set.id)}
                      >
                        <span className="rowx min-w-0">
                          <SetGlyph set={set} />
                          <span className="cut">{set.setName}</span>
                        </span>
                        {active && <Check weight="bold" />}
                      </button>
                    );
                  })}
                </div>
                {selectedSetId && (
                  <button
                    type="button"
                    className="btn btn-lg btn-primary"
                    style={{ width: "100%" }}
                    disabled={busy}
                    onClick={() => void handleCopyToExisting(selectedSetId)}
                  >
                    {t("setDetail.copyConfirm", {
                      name:
                        otherSets.find((s) => s.id === selectedSetId)
                          ?.setName ?? "",
                    })}
                  </button>
                )}
              </div>
            )}
          </SwipeableSheetContent>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
