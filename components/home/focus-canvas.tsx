import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LearningRows } from "./learning-row";
import { Icons } from "@/components/ui/icons";
import { ActiveRoomCard } from "@/components/rooms/active-room-card";
import { readLastPracticedSetId } from "@/lib/last-practiced";
import { useLibraryStore } from "@/stores/library-store";

const STEPS = [
  {
    title: "加入想記住的單字",
    body: "手動輸入，或請連上 MCP 的 AI 助理幫你整理成詞義。",
  },
  {
    title: "讓 AI 出題",
    body: "透過 MCP 請 AI 助理用你自己的字出學測型式的題目。",
  },
  {
    title: "練一輪、找朋友比",
    body: "自己選題型練習，答錯的題目可以馬上重練；也能開房間和朋友即時對戰。",
  },
];

const POSTER =
  "relative grid gap-1.5 overflow-hidden rounded-[var(--radius-stage)] bg-[#7cc49c] p-[1.375rem] pt-5 text-[#13201a]";
const BUBBLE =
  "pointer-events-none absolute -right-20 -top-[4.375rem] h-[11.25rem] w-[16.875rem] rounded-full bg-[#13201a]";

/** 今天, as in the app: the set to continue with on the answer card's green. */
export function FocusCanvas() {
  const library = useLibraryStore((store) => store.state);
  const [lastPracticedId] = useState(readLastPracticedSetId);

  // 接著練 follows the last set practiced on this device, and otherwise the
  // most recently changed set.
  const latest = useMemo(() => {
    const remembered = lastPracticedId
      ? library.sets.find((set) => set.id === lastPracticedId)
      : undefined;
    return (
      remembered ??
      [...library.sets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    );
  }, [lastPracticedId, library.sets]);
  const senseCount = latest
    ? (library.memberships[latest.id] ?? []).reduce(
        (total, entry) => total + entry.senseIds.length,
        0,
      )
    : 0;
  const latin = latest ? /^[\x20-\x7e]+$/.test(latest.setName) : false;

  return (
    <section className="study-home grid gap-7">
      <ActiveRoomCard />
      {latest ? (
        <div className={POSTER}>
          <span aria-hidden className={BUBBLE} />
          <p className="type-section relative">接著練</p>
          <h2
            className={
              latin
                ? "relative mt-16 truncate text-5xl font-extrabold leading-[3.125rem] tracking-[-0.04em]"
                : "relative mt-16 truncate text-[2.5rem] font-extrabold leading-[2.875rem]"
            }
          >
            {latest.setName}
          </h2>
          <p className="relative flex items-baseline gap-2">
            <span className="text-[5.5rem] font-extrabold leading-none tracking-[-0.045em] tabular-nums">
              {senseCount}
            </span>
            <span className="type-section">個詞義</span>
          </p>
          <div className="relative mt-3.5 flex gap-2.5">
            <Button
              asChild
              size="lg"
              className="flex-1 bg-[#13201a]/10 text-[#13201a] hover:bg-[#13201a]/15"
            >
              <Link href={`/app/sets/${latest.id}`}>看單字</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="flex-[1.4] bg-[#13201a] text-[#f4f8f5] hover:bg-[#13201a]/90"
            >
              <Link href={`/app/practice?set=${latest.id}`}>
                <Icons.start />
                開始練習
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={POSTER}>
            <span aria-hidden className={BUBBLE} />
            <h2 className="relative mt-24 text-[2.5rem] font-extrabold leading-[2.875rem]">
              先加入一組單字
            </h2>
            <p className="relative text-base leading-6">
              手動輸入或透過 MCP 加入，儲存後就能開始練習。
            </p>
          </div>
          <ol className="grid gap-[1.375rem] px-1">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3.5">
                <span
                  aria-hidden
                  className="grid size-[1.625rem] shrink-0 place-items-center rounded-full bg-card text-sm font-bold"
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <div className="grid gap-[3px]">
                  <h3 className="type-section">{step.title}</h3>
                  <p className="text-base leading-6 text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {latest && (
        <div className="desktop-recent hidden md:block">
          <LearningRows />
        </div>
      )}
    </section>
  );
}
