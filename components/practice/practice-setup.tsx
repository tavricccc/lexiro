import { Dialog } from "radix-ui";
import { X } from "@phosphor-icons/react";
import type { LibrarySet, PracticeTask, WorkspaceQuestionDifficulty } from "@/types";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { SetupBody } from "@/components/redesign/practice-launch";
import { useAppRouter } from "@/lib/use-app-router";
import { EmptyState } from "@/components/ui/page-state";
import { t } from "@/lib/i18n";
import { FocusCanvas } from "@/components/home/focus-canvas";
import { holdRouteSheet } from "@/lib/navigation-memory";
import { useLayoutEffect } from "react";
export function PracticeSetup(props: {
  amount: number;
  availableQuestionCount: number;
  backHref: string;
  counts: Record<PracticeTask, number>;
  difficulty: WorkspaceQuestionDifficulty;
  draftPersistence?: DraftPersistence;
  hasWords: boolean;
  hasQuestionContent: boolean;
  oneSensePerWord: boolean;
  onAmountChange: (amount: number) => void;
  onBegin: () => void;
  onDifficultyChange: (difficulty: WorkspaceQuestionDifficulty) => void;
  onOneSenseChange: (oneSensePerWord: boolean) => void;
  onSetsChange: (setIds: string[]) => void;
  onTasksChange: (tasks: PracticeTask[]) => void;
  queueLength: number;
  setIds: string[];
  sets: LibrarySet[];
  tasks: PracticeTask[];
  /** A live room reuses this screen to pick its questions. */
  title?: string;
  beginLabel?: (count: number) => string;
  busy?: boolean;
  /** Rooms cap how many questions one game can hold. */
  maxAmount?: number;
  showDraftStatus?: boolean;
  /** Extra controls under the amount slider, e.g. a room's seconds per question. */
  extraScope?: React.ReactNode;
}) {
 const router = useAppRouter();
 useLayoutEffect(holdRouteSheet, []);
 const { amount, onAmountChange, tasks, onTasksChange, sets, setIds, onSetsChange, maxAmount, extraScope, onBegin, queueLength, busy, hasWords, hasQuestionContent } = props;
 const empty = !hasWords && !hasQuestionContent;
 return <>{props.backHref === "/app" && <div className="resume-background"><FocusCanvas /></div>}<Dialog.Root open onOpenChange={open => { if (!open) router.push(props.backHref); }}><Dialog.Portal><Dialog.Overlay className="scrim"><Dialog.Content className="sheet setup-sheet" aria-describedby={undefined}>
 <div className="sheet-head"><Dialog.Title>{t("redesign.titleSetup")}</Dialog.Title><Dialog.Close className="btn btn-icon btn-glass" aria-label={t("redesign.close")}><X /></Dialog.Close></div>
 {empty ? <EmptyState title={t("practice.noContent")} /> : <>
 <SetupBody {...{amount,onAmountChange,tasks,onTasksChange,sets,setIds,onSetsChange,maxAmount}} difficulty={props.difficulty} onDifficultyChange={props.onDifficultyChange} oneSensePerWord={props.oneSensePerWord} onOneSenseChange={props.onOneSenseChange} />
 {extraScope}
 <button className="btn btn-lg btn-primary setup-start" disabled={!tasks.length || !queueLength || busy} onClick={onBegin}>{props.beginLabel ? props.beginLabel(queueLength) : t("practice.beginCount",{count:queueLength})}</button>
 </>}
 </Dialog.Content></Dialog.Overlay></Dialog.Portal></Dialog.Root></>;
}
