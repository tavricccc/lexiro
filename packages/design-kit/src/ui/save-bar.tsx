import { AnimatePresence, motion } from "motion/react";
import { useLabels } from "../lib/provider";
import { timing } from "../lib/motion-timing";
import type { DraftStatus } from "../lib/draft";
import { Button } from "./button";

export function SaveBar({ changeCount, disabled = false, error, onDiscard, onReload, onReview, onSave, status }: {
  changeCount: number;
  disabled?: boolean;
  error?: string;
  onDiscard: () => void;
  onReload?: () => void;
  onReview?: () => void;
  onSave: () => void;
  status: DraftStatus;
}) {
  const labels = useLabels();
  const saving = status === "saving";
  const saved = status === "saved";
  const present = changeCount > 0 || saving || saved;
  const hidden = { opacity: 0, y: "100%" };
  return (
    <AnimatePresence initial={false}>
      {present ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          aria-live="polite"
          className="sticky bottom-[calc(var(--bottom-nav-height)+var(--bottom-nav-gap)+0.75rem)] z-30 flex flex-wrap items-center gap-2 rounded-none border-2 border-line-strong bg-surface p-3 pl-4 shadow-float md:bottom-6"
          exit={hidden}
          initial={hidden}
          role="status"
          transition={timing("control")}
        >
          {error ? (
            <div className="flex w-full flex-wrap items-center gap-2 border-b border-line pb-2">
              <p className="flex-1 text-sm font-medium text-danger" role="alert">{error}</p>
              {onReload ? <Button disabled={saving} onClick={onReload} size="sm">{labels.reload}</Button> : null}
            </div>
          ) : null}
          <span className="min-w-28 flex-1 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {saved ? labels.saved : labels.pending(changeCount)}
          </span>
          {onReview && !saving && !saved ? <Button onClick={onReview} size="sm" variant="ghost">{labels.review}</Button> : null}
          <Button disabled={saving || saved} onClick={onDiscard} size="sm">{labels.discard}</Button>
          <Button
            disabled={disabled}
            onClick={onSave}
            size="sm"
            status={saving ? "loading" : saved ? "success" : "idle"}
            variant="primary"
          >
            {labels.save}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
