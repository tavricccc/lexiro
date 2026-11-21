import { useParams } from "react-router";
import { Check, Copy, Crown, Play, SignOut, Stop, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { AppLink, Button, Chip, EmptyState, HeaderButton, ListGroup, ListRow, Panel, ProgressBar, Spinner, cn } from "design-kit";
import { useAuth } from "@/data/auth";
import { useRemaining, useRoomSocket } from "@/data/room-socket";
import { TASK_LABELS } from "@/domain/labels";
import { passageParts } from "@/domain/practice";
import type { LiveQuestion, RoomPlayer, RoomState } from "@/domain/room";
import { useDocumentTitle } from "@/ui/title";

type Send = ReturnType<typeof useRoomSocket>["send"];

export default function RoomPage() {
  const { code = "" } = useParams();
  const { account } = useAuth();
  const room = useRoomSocket(code.toUpperCase(), account?.name.slice(0, 40) || "Player");
  useDocumentTitle(room.state?.title ?? "對戰");
  const { state, connection } = room;
  const leave = <HeaderButton aria-label="離開房間" asChild><AppLink href="/app/rooms"><SignOut weight="bold" /></AppLink></HeaderButton>;
  if (connection === "failed" || connection === "replaced")
    return (
      <Shell leave={leave}>
        <div className="mx-auto max-w-xl py-8">
          <EmptyState
            action={<Button asChild variant="primary"><AppLink href="/app/rooms">回到對戰</AppLink></Button>}
            description={connection === "replaced" ? "你在另一台裝置進入了這個房間。" : room.error}
            title="無法留在這個房間"
          />
        </div>
      </Shell>
    );
  if (!state)
    return <Shell leave={leave}><div className="grid place-items-center py-24"><Spinner label="正在進入房間" /></div></Shell>;
  const host = state.you === state.hostUid;
  return (
    <Shell leave={leave} state={state} reconnecting={connection === "reconnecting"}>
      {state.phase === "lobby" ? <Lobby host={host} send={room.send} state={state} />
        : state.phase === "ended" ? <Ended state={state} />
        : <div className="card-in" key={state.index}><Live host={host} offset={room.offset} send={room.send} state={state} /></div>}
    </Shell>
  );
}

function Shell({ state, leave, reconnecting, children }: { state?: RoomState; leave: React.ReactNode; reconnecting?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-canvas">
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b-2 border-line-strong bg-surface px-[var(--gutter)] pb-3 pt-[calc(var(--safe-top)+0.75rem)] md:px-8 md:py-3.5">
        <div className="min-w-0 flex-1 flex items-baseline gap-3">
          <span className="truncate text-base font-extrabold tracking-[-0.02em] md:text-lg">{state?.title ?? "對戰"}</span>
          {state ? <Chip tone="info">{state.code}</Chip> : null}
        </div>
        {reconnecting ? <Chip tone="caution">重新連線中…</Chip> : null}
        {leave}
      </header>
      <div className="mx-auto w-full max-w-[1360px] px-[var(--gutter)] pb-[calc(var(--safe-bottom)+2.5rem)] pt-6 md:px-8 md:pt-8">
        {children}
      </div>
    </div>
  );
}

function Lobby({ state, host, send }: { state: RoomState; host: boolean; send: Send }) {
  const link = `${location.origin}/app/rooms/${state.code}`;
  const copy = () => void navigator.clipboard.writeText(link).then(() => toast.success("已複製邀請連結"), () => toast.error("無法複製，請手動分享代碼。"));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="grid gap-6 border-2 border-line-strong bg-surface p-8 md:p-10 lg:col-span-7">
        <div className="flex items-center justify-between font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          <span>LOBBY // ROOM CODE</span>
          <span>{state.total} QUESTIONS</span>
        </div>
        <p className="font-mono text-[clamp(3rem,9vw,5.5rem)] font-black leading-none tracking-[0.22em] text-contrast">
          {state.code}
        </p>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Button onClick={copy} size="lg" variant="secondary"><Copy weight="bold" />複製邀請連結</Button>
          {host ? (
            <Button onClick={() => send({ type: "start" })} size="lg" variant="primary"><Play weight="fill" />開始對戰</Button>
          ) : <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-muted">WAITING FOR HOST…</span>}
        </div>
      </section>
      <div className="lg:col-span-5">
        <Scoreboard hostUid={state.hostUid} players={state.players} title={`玩家名冊 ${state.players.length}/8`} you={state.you} />
      </div>
    </div>
  );
}

function Live({ state, host, send, offset }: { state: RoomState; host: boolean; send: Send; offset: number }) {
  const remaining = useRemaining(state.endsAt, offset);
  const question = state.question;
  if (!question) return null;
  const reveal = state.reveal;
  const chosen = state.yourChoice;
  const used = new Set(question.sharedBank ? Object.entries(state.revealedBlanks).filter(([blank]) => Number(blank) !== question.blank).map(([, option]) => option) : []);
  const gained = reveal?.gained[state.you];
  const answered = state.players.filter((player) => player.answered).length;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      {/* Left: Arena Question & Options */}
      <div className="grid gap-6">
        <div className="grid gap-3 border-b-2 border-line-strong pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="info">{TASK_LABELS[question.type]}</Chip>
            <span className="font-mono text-sm font-bold tabular-nums">
              {String(state.index + 1).padStart(2, "0")} / {String(state.total).padStart(2, "0")}
            </span>
            <span className="ml-auto font-mono text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {reveal ? "REVEAL" : `${answered}/${state.players.length} 已作答`}
            </span>
          </div>
          <ProgressBar className="h-2.5" label={reveal ? "下一題倒數" : "作答倒數"} value={remaining !== null && state.duration ? remaining / state.duration : 0} />
        </div>

        <Prompt question={question} revealed={state.revealedBlanks} />

        <div className={cn("grid gap-2.5", question.options.length <= 4 && question.options.every((option) => option.length <= 24) && "sm:grid-cols-2")} role="group" aria-label="選項">
          {question.options.map((option, index) => {
            const right = Boolean(reveal?.accepted.includes(index));
            const picked = chosen === index;
            const wrong = Boolean(reveal) && picked && !right;
            const locked = chosen !== null || Boolean(reveal) || used.has(option);
            return (
              <button
                className={cn(
                  "group flex min-h-16 items-stretch border text-left text-base outline-none transition-[background-color,border-color] duration-[var(--motion-control)] focus-visible:ring-2 focus-visible:ring-contrast disabled:cursor-default",
                  !locked && "border-line-strong/30 bg-surface hover:border-line-strong hover:bg-surface-raised",
                  !reveal && picked && "border-contrast bg-accent-soft",
                  reveal && right && "border-positive bg-positive/10",
                  wrong && "border-danger bg-danger/10",
                  locked && !picked && !(reveal && right) && "border-line bg-surface opacity-45",
                )}
                disabled={locked}
                key={index}
                onClick={() => send({ type: "answer", index: state.index, choice: index })}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid w-11 shrink-0 place-items-center border-r font-mono text-xs font-bold",
                    reveal && right ? "border-positive bg-positive text-white"
                      : wrong ? "border-danger bg-danger text-white"
                        : !reveal && picked ? "border-contrast bg-contrast text-on-contrast"
                          : "border-line bg-surface-raised text-ink-muted",
                  )}
                >
                  {reveal && right ? <Check weight="bold" /> : wrong ? <X weight="bold" /> : index + 1}
                </span>
                <span className={cn("flex min-w-0 flex-1 items-center px-4 py-3 font-semibold", /[A-Za-z]/.test(option) && "font-latin")}>{option}</span>
              </button>
            );
          })}
        </div>

        {reveal ? (
          <div className={cn("message-in grid gap-1.5 border border-l-4 bg-surface p-5", gained ? "border-line border-l-positive" : "border-line border-l-danger")} role="status">
            <p className={cn("font-bold", gained ? "text-positive" : "text-danger")}>{gained ? `答對了 +${gained}` : chosen === null ? "沒有作答" : "答錯了"}</p>
            {reveal.explanation ? <p className="text-[0.9375rem] text-ink-muted">{reveal.explanation}</p> : null}
          </div>
        ) : chosen !== null ? <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-muted">LOCKED IN // 等待其他玩家…</p> : null}
      </div>

      {/* Right: Broadcast Scoreboard Sidebar */}
      <aside className="grid gap-4 lg:sticky lg:top-20">
        <Scoreboard hostUid={state.hostUid} players={state.players} title="即時排名" you={state.you} />
        {host ? (
          <Button className="justify-self-start" onClick={() => send({ type: "end" })} size="sm" variant="danger">
            <Stop weight="fill" />提前結束
          </Button>
        ) : null}
      </aside>
    </div>
  );
}

function Prompt({ question, revealed }: { question: LiveQuestion; revealed: Record<number, string> }) {
  if (question.type === "meaning")
    return <p className="py-4 font-latin text-[clamp(2.5rem,7vw,4.5rem)] font-black leading-[1.02] tracking-[-0.045em]" lang="en">{question.prompt}</p>;
  if (question.type === "reverse")
    return <p className="py-4 text-[clamp(2rem,5.5vw,3.5rem)] font-black leading-[1.1] tracking-[-0.03em]">{question.prompt}</p>;
  if (!question.passage)
    return <p className="whitespace-pre-line py-2 font-latin text-2xl font-medium leading-relaxed" lang="en">{question.prompt}</p>;
  return (
    <div className="grid gap-4">
      <Panel className="max-h-[42svh] overflow-y-auto border-t-2 border-t-line-strong">
        {question.passage.title ? <h2 className="mb-2 font-latin text-xl font-extrabold" lang="en">{question.passage.title}</h2> : null}
        <p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.85]" lang="en">
          {passageParts(question.passage.text).map((part, index) =>
            typeof part === "string" ? <span key={index}>{part}</span> : (
              <span className={cn("mx-0.5 inline-flex min-w-12 justify-center border px-1.5 font-mono text-[0.9375rem] font-bold", part === question.blank ? "border-contrast bg-contrast text-on-contrast" : revealed[part] ? "border-positive bg-positive/12 text-positive" : "border-line bg-surface-raised text-ink-muted")} key={index}>
                {revealed[part] && part !== question.blank ? revealed[part] : `(${part})`}
              </span>
            ),
          )}
        </p>
      </Panel>
      {question.type === "reading" ? <p className="font-latin text-xl font-bold leading-snug" lang="en">{question.prompt}</p> : <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">選出第 {question.blank} 格的答案</p>}
    </div>
  );
}

function Ended({ state }: { state: RoomState }) {
  const place = state.players.findIndex((player) => player.uid === state.you) + 1;
  const score = state.players.find((player) => player.uid === state.you)?.score ?? 0;
  const review = state.review;
  return (
    <div className="grid gap-8">
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="grid content-between gap-6 border-2 border-line-strong bg-surface p-8 lg:col-span-5">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">FINAL STANDING // 對戰結束</span>
          <div>
            <p className="font-latin text-6xl font-black tracking-[-0.04em] text-contrast md:text-7xl">{place ? `#${place}` : "FIN"}</p>
            <p className="mt-2 font-mono text-sm font-bold text-ink">{place ? `第 ${place} 名` : "完成"} · {score} 分</p>
          </div>
          <Button asChild size="lg" variant="primary"><AppLink href="/app/rooms">再開一場</AppLink></Button>
        </section>
        <div className="lg:col-span-7">
          <Scoreboard hostUid={state.hostUid} players={state.players} title="最終排名" you={state.you} />
        </div>
      </div>

      {review?.items.length ? (
        <ListGroup title={`答錯或沒答的 ${review.items.length} 題`}>
          {review.items.map((item) => {
            const passage = item.question.passageId ? review.passages[item.question.passageId] : undefined;
            const prompt = item.question.prompt || (passage ? `${passage.title || "短文"} 第 ${item.question.blank} 格` : "");
            return (
              <ListRow
                detail={<>正解：{item.accepted.map((index) => item.question.options[index]).join(" / ")}{item.choice !== null ? ` · 你選：${item.question.options[item.choice]}` : " · 沒有作答"}{item.explanation ? <span className="mt-1 block">{item.explanation}</span> : null}</>}
                key={item.index}
                label={<span className="font-latin" lang="en">{prompt}</span>}
              />
            );
          })}
        </ListGroup>
      ) : review ? <p className="border-l-4 border-positive pl-4 font-bold text-positive">全部答對，太強了。</p> : null}
    </div>
  );
}

function Scoreboard({ players, you, hostUid, title }: { players: RoomPlayer[]; you: string; hostUid: string; title: string }) {
  return (
    <ListGroup title={title}>
      {players.map((player, index) => (
        <ListRow
          detail={!player.connected ? "離線" : player.answered ? "已作答" : undefined}
          key={player.uid}
          label={
            <span className={cn("flex items-center gap-2.5", !player.connected && "text-ink-faint")}>
              <span className="w-6 font-mono text-xs font-bold tabular-nums text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
              <span className="truncate font-bold">{player.name}</span>
              {player.uid === hostUid ? <Crown aria-label="房主" className="text-highlight" weight="fill" /> : null}
              {player.uid === you ? <Chip tone="info">YOU</Chip> : null}
            </span>
          }
          value={<span className="font-mono font-bold tabular-nums text-ink">{player.score}</span>}
        />
      ))}
    </ListGroup>
  );
}
