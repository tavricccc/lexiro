import { useState } from "react";
import { Dialog } from "radix-ui";
import { Play, X, Cards, Exam } from "@phosphor-icons/react";
import { t } from "@/lib/i18n";
import { practiceTaskLabel } from "@/lib/practice-tasks";
import { useAppRouter } from "@/lib/use-app-router";
import { useLibraryStore } from "@/stores/library-store";
import type { PracticeTask } from "@/types";
import { learningKinds } from "./learning-summary";
export function PracticeLaunch({
  open,
  onClose,
  setId = "",
  review = false,
}: {
  open: boolean;
  onClose: () => void;
  setId?: string;
  review?: boolean;
}) {
  const router = useAppRouter();
  const [tasks, setTasks] = useState<PracticeTask[]>(["meaning"]);
  const [amount, setAmount] = useState(20);
  const [scope, setScope] = useState(setId);
  const sets = useLibraryStore((s) => s.state.sets);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim">
          <Dialog.Content className="sheet" aria-describedby={undefined}>
            <div className="sheet-head">
              <Dialog.Title>{t("redesign.titleSetup")}</Dialog.Title>
              <Dialog.Close
                className="btn btn-icon btn-glass"
                aria-label={t("redesign.close")}
              >
                <X />
              </Dialog.Close>
            </div>
            <div className="modes">
              <button
                className="mode"
                aria-pressed={tasks.includes("meaning")}
                onClick={() => setTasks(["meaning"])}
              >
                <Cards size={28} />
                <b>{t("practice.wordReview")}</b>
              </button>
              <button
                className="mode"
                aria-pressed={!tasks.includes("meaning")}
                onClick={() => setTasks(["vocabulary"])}
              >
                <Exam size={28} />
                <b>{t("practice.examFormats")}</b>
              </button>
            </div>
            <p className="label">{t("redesign.task")}</p>
            <div className="chips">
              {learningKinds.map((kind) => (
                <button
                  className="chip"
                  key={kind}
                  aria-pressed={tasks.includes(kind)}
                  onClick={() =>
                    setTasks(
                      tasks.includes(kind)
                        ? tasks.filter((k) => k !== kind)
                        : [...tasks, kind],
                    )
                  }
                >
                  {practiceTaskLabel(kind)}
                </button>
              ))}
            </div>
            <p className="label">{t("redesign.scope")}</p>
            <select
              className="input"
              aria-label={t("redesign.scope")}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="">{t("redesign.all")}</option>
              {sets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.setName}
                </option>
              ))}
            </select>
            <p className="label">{t("redesign.amount")}</p>
            <div className="tabs">
              {[10, 20, 30, 50].map((n) => (
                <button
                  className="latin"
                  key={n}
                  aria-selected={amount === n}
                  onClick={() => setAmount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              className="btn btn-lg btn-primary"
              style={{ width: "100%", marginTop: 24 }}
              disabled={!tasks.length}
              onClick={() => {
                onClose();
                const q = new URLSearchParams({
                  run: "1",
                  tasks: tasks.join(","),
                  amount: String(amount),
                });
                if (scope) q.set("set", scope);
                if (review) q.set("review", "1");
                router.push(`/app/practice?${q}`);
              }}
            >
              <Play />
              {t("practice.beginCount", { count: amount })}
            </button>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
