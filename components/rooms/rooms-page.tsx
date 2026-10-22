import type { PracticeTask, WorkspaceQuestionDifficulty } from "@/types";
import Link from "@/components/ui/app-link";
import { useAppRouter as useRouter } from "@/lib/use-app-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  buildPracticeQueue,
  countQuestionAvailability,
  countTaskAvailability,
} from "@/components/practice/practice-queue";
import { PracticeSetup } from "@/components/practice/practice-setup";
import {
  liveSetIds,
  practiceScopeLabel,
  usePracticePool,
} from "@/components/practice/use-practice-pool";
import { ActiveRoomCard } from "@/components/rooms/active-room-card";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SignInRequired } from "@/components/ui/sign-in-required";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { DEFAULT_QUESTION_TASKS } from "@/constants";
import { t } from "@/lib/i18n";
import {
  createRoom,
  normalizeRoomCode,
  ROOM_CODE_PATTERN,
  ROOM_MAX_QUESTIONS,
  toRoomQuestions,
} from "@/lib/room-client";
import { useCloudStore } from "@/stores/cloud-store";
import { useLibraryStore } from "@/stores/library-store";
import { isWordTask } from "@/components/practice/meaning-questions";

export function playerName(
  user: { displayName: string | null; email: string | null } | null,
) {
  return (user?.displayName || user?.email?.split("@")[0] || "Player").slice(
    0,
    40,
  );
}

/** Join a friend's room by its code, or open one with questions from your own bank. */
export function RoomsPage() {
  const router = useRouter();
  const ready = useCloudStore((store) => store.ready);
  const user = useCloudStore((store) => store.user);
  const libraryStatus = useLibraryStore((store) => store.status);
  const [code, setCode] = useState("");

  if (!ready) return <LibraryListSkeleton />;
  if (!user)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={t("rooms.title")} />
        <SignInRequired message={t("rooms.signInRequired")} />
      </div>
    );

  const normalized = normalizeRoomCode(code);
  const join = () => {
    if (ROOM_CODE_PATTERN.test(normalized))
      router.push(`/app/rooms/${normalized}`);
  };
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("rooms.title")} />
      <ActiveRoomCard className="mb-4" />
      <section className="rounded-[var(--radius-card)] bg-card p-5">
        <h2 className="type-section">{t("rooms.joinHeader")}</h2>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            join();
          }}
        >
          <label className="sr-only" htmlFor="room-code">
            {t("rooms.codeLabel")}
          </label>
          <Input
            id="room-code"
            autoCapitalize="characters"
            autoComplete="off"
            className="flex-1 text-center font-mono text-lg tracking-[0.3em] uppercase"
            maxLength={6}
            placeholder={t("rooms.codePlaceholder")}
            value={normalized}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            type="submit"
            size="lg"
            disabled={!ROOM_CODE_PATTERN.test(normalized)}
          >
            {t("rooms.join")}
          </Button>
        </form>
      </section>
      <section className="mt-4 rounded-[var(--radius-card)] bg-card p-5">
        <h2 className="type-section">{t("rooms.createHeader")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("rooms.createHint")}
        </p>
        <Button
          asChild
          className="mt-4"
          size="lg"
          variant="secondary"
          disabled={libraryStatus !== "ready"}
        >
          <Link href="/app/rooms/new">
            <Icons.create />
            {t("rooms.create")}
          </Link>
        </Button>
      </section>
    </div>
  );
}

/** The host picks questions from their own bank, the same way solo practice does. */
export function RoomSetupPage() {
  const ready = useCloudStore((store) => store.ready);
  const user = useCloudStore((store) => store.user);
  const libraryStatus = useLibraryStore((store) => store.status);
  if (!ready || libraryStatus !== "ready") return <LibraryListSkeleton />;
  if (!user)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          back={<BackControl href="/app/rooms" />}
          title={t("rooms.setupTitle")}
        />
        <SignInRequired message={t("rooms.signInRequired")} />
      </div>
    );
  return <RoomSetup />;
}

function RoomSetup() {
  const router = useRouter();
  const user = useCloudStore((store) => store.user);
  const state = useLibraryStore((store) => store.state);
  const [chosenSetIds, setSetIds] = useState<string[]>([]);
  const setIds = useMemo(
    () => liveSetIds(state.sets, chosenSetIds),
    [chosenSetIds, state.sets],
  );
  const [tasks, setTasks] = useState<PracticeTask[]>([
    ...DEFAULT_QUESTION_TASKS,
  ]);
  const [amount, setAmount] = useState(10);
  const [seconds, setSeconds] = useState(20);
  const [difficulty, setDifficulty] =
    useState<WorkspaceQuestionDifficulty>("all");
  const [oneSensePerWord, setOneSensePerWord] = useState(true);
  const [busy, setBusy] = useState(false);
  const { allowedSenseIds, studyItems, questionGroups } = usePracticePool(
    state,
    setIds,
  );
  const pool = { allowedSenseIds, difficulty, questionGroups, studyItems };
  const counts = useMemo(
    () => countTaskAvailability(pool),
    [allowedSenseIds, difficulty, questionGroups, studyItems],
  );
  const available = useMemo(
    () => countQuestionAvailability({ ...pool, tasks, oneSensePerWord }),
    [
      allowedSenseIds,
      difficulty,
      questionGroups,
      studyItems,
      tasks,
      oneSensePerWord,
    ],
  );
  const queue = useMemo(
    () =>
      buildPracticeQueue({
        ...pool,
        amount: Math.min(amount, ROOM_MAX_QUESTIONS),
        oneSensePerWord,
        tasks,
      }),
    [
      allowedSenseIds,
      amount,
      difficulty,
      oneSensePerWord,
      questionGroups,
      studyItems,
      tasks,
    ],
  );

  const open = async () => {
    setBusy(true);
    try {
      const { code } = await createRoom({
        name: playerName(user),
        title: practiceScopeLabel(state.sets, setIds),
        seconds,
        questions: toRoomQuestions(queue),
      });
      router.push(`/app/rooms/${code}`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  };

  return (
    <PracticeSetup
      amount={amount}
      availableQuestionCount={available}
      backHref="/app/rooms"
      beginLabel={(count) =>
        busy ? t("rooms.creating") : t("rooms.open", { count })
      }
      busy={busy}
      counts={counts}
      difficulty={difficulty}
      hasQuestionContent={questionGroups.some(
        (group) => !isWordTask(group[0]?.type) && group.length > 0,
      )}
      hasWords={Object.keys(state.words).length > 0}
      maxAmount={ROOM_MAX_QUESTIONS}
      oneSensePerWord={oneSensePerWord}
      onAmountChange={setAmount}
      onBegin={() => void open()}
      onDifficultyChange={setDifficulty}
      onOneSenseChange={setOneSensePerWord}
      onSetsChange={setSetIds}
      onTasksChange={setTasks}
      queueLength={queue.length}
      setIds={setIds}
      sets={state.sets}
      showDraftStatus={false}
      extraScope={
        <div className="py-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label className="type-row" htmlFor="room-seconds">
              {t("rooms.secondsLabel")}
            </label>
            <strong className="text-lg tabular-nums">
              {t("rooms.secondsLeft", { seconds })}
            </strong>
          </div>
          <input
            className="practice-amount-slider"
            id="room-seconds"
            max={40}
            min={10}
            onChange={(event) => setSeconds(Number(event.target.value))}
            step={5}
            type="range"
            value={seconds}
          />
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>10</span>
            <span>40</span>
          </div>
        </div>
      }
      tasks={tasks}
      title={t("rooms.setupTitle")}
    />
  );
}
