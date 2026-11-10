import { useState } from "react";
import { Dialog } from "radix-ui";
import { Play, X, Cards, Exam } from "@phosphor-icons/react";
import { t } from "@/lib/i18n";
import { practiceTaskLabel } from "@/lib/practice-tasks";
import { useAppRouter } from "@/lib/use-app-router";
import { useLibraryStore } from "@/stores/library-store";
import type { PracticeTask, WorkspaceQuestionDifficulty } from "@/types";
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
  const [scope, setScope] = useState<string[]>(setId ? [setId] : []);
  const [difficulty, setDifficulty] = useState<WorkspaceQuestionDifficulty>("all");
  const [oneSense, setOneSense] = useState(localStorage.getItem("lexiro:one-sense") !== "0");
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
            <SetupBody tasks={tasks} onTasksChange={setTasks} amount={amount} onAmountChange={setAmount} sets={sets} setIds={scope} onSetsChange={setScope} difficulty={difficulty} onDifficultyChange={setDifficulty} oneSensePerWord={oneSense} onOneSenseChange={setOneSense} />
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
                if (scope.length) q.set("set", scope.join(","));
                q.set("difficulty",difficulty);
                q.set("oneSense",oneSense ? "1" : "0");
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

export function SetupBody({ tasks, onTasksChange, amount, onAmountChange, sets, setIds, onSetsChange, maxAmount = Infinity, difficulty = "all", onDifficultyChange, oneSensePerWord = true, onOneSenseChange }: {
 tasks: PracticeTask[]; onTasksChange: (tasks: PracticeTask[]) => void; amount: number; onAmountChange: (amount: number) => void;
 sets: { id: string; setName: string }[]; setIds: string[]; onSetsChange: (ids: string[]) => void; maxAmount?: number; difficulty?: WorkspaceQuestionDifficulty; onDifficultyChange?: (d:WorkspaceQuestionDifficulty) => void; oneSensePerWord?: boolean; onOneSenseChange?: (value:boolean) => void;
}) {
 return <>
  <div className="modes">
   <button className="mode" aria-pressed={tasks.some(k => k === "meaning" || k === "reverse")} onClick={() => onTasksChange(["meaning"])}><Cards size={28}/><b>{t("practice.wordReview")}</b></button>
   <button className="mode" aria-pressed={tasks.some(k => k !== "meaning" && k !== "reverse")} onClick={() => onTasksChange(["vocabulary"])}><Exam size={28}/><b>{t("practice.examFormats")}</b></button>
  </div>
  <p className="label">{t("redesign.task")}</p><div className="chips">{learningKinds.map(kind => <button className="chip" key={kind} aria-pressed={tasks.includes(kind)} onClick={() => onTasksChange(tasks.includes(kind) ? tasks.filter(k => k !== kind) : [...tasks,kind])}>{practiceTaskLabel(kind)}</button>)}</div>
  <p className="label">{t("redesign.scope")}</p><div className="chips" aria-label={t("redesign.scope")}><button className="chip" aria-pressed={!setIds.length} onClick={() => onSetsChange([])}>{t("redesign.all")}</button>{sets.map(set => <button key={set.id} className="chip" aria-pressed={setIds.includes(set.id)} onClick={() => onSetsChange(setIds.includes(set.id) ? setIds.filter(id => id !== set.id) : [...setIds,set.id])}>{set.setName}</button>)}</div>
  <p className="label">{t("redesign.amount")}</p><div className="tabs">{[...new Set([10,20,30,50].map(n => Math.min(n,maxAmount)))].map(n => <button key={n} className="latin" aria-selected={Math.min(amount,maxAmount) === n} onClick={() => onAmountChange(n)}>{n}</button>)}</div>
  <p className="label">{t("practice.difficulty")}</p><div className="chips">{(["all","1","2","3"] as const).map(level => <button key={level} className="chip" aria-pressed={difficulty === level} onClick={() => onDifficultyChange?.(level)}>{level === "all" ? t("redesign.all") : t("questions.difficulty",{level})}</button>)}</div>
 <div className="chips setup-extra"><button className="chip" aria-pressed={oneSensePerWord} onClick={() => onOneSenseChange?.(!oneSensePerWord)}>{t("practice.oneSensePerWord")}</button></div>
 </>;
}
