import { useParams } from "react-router";
import { Check, Copy, Crown, Play, SignOut, Stop, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { AppLink, Button, Chip, EmptyState, ListGroup, ListRow, Panel, ProgressBar, Spinner, cn } from "design-kit";
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
  const leave = <Button asChild variant="ghost"><AppLink href="/app/rooms"><SignOut weight="bold" />離開</AppLink></Button>;
  if (connection === "failed" || connection === "replaced")
    return (
      <Shell leave={leave}>
        <EmptyState action={<Button asChild variant="primary"><AppLink href="/app/rooms">回到對戰</AppLink></Button>} description={connection === "replaced" ? "你在另一台裝置進入了這個房間。" : room.error} title="無法留在這個房間" />
      </Shell>
    );
  if (!state)
    return <Shell leave={leave}><div className="grid place-items-center py-24"><Spinner label="正在進入房間" /></div></Shell>;
  const host = state.you === state.hostUid;
  return (
    <Shell leave={leave} state={state} reconnecting={connection === "reconnecting"}>
      {state.phase === "lobby" ? <Lobby host={host} send={room.send} state={state} />
        : state.phase === "ended" ? <Ended state={state} />
        : <div className="card-in grid gap-5" key={state.index}><Live host={host} offset={room.offset} send={room.send} state={state} /></div>}
    </Shell>
  );
}

function Shell({ state, leave, reconnecting, children }: { state?: RoomState; leave: React.ReactNode; reconnecting?: boolean; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl content-start gap-5 px-[var(--gutter)] pb-[calc(var(--safe-bottom)+2rem)] pt-[calc(var(--safe-top)+1rem)]">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{state?.title ?? "對戰"}</p>
          {state ? <p className="font-latin text-sm tracking-[0.2em] text-ink-muted">{state.code}</p> : null}
        </div>
        {reconnecting ? <Chip>重新連線中…</Chip> : null}
        {leave}
      </header>
      {children}
    </div>
  );
}

function Lobby({ state, host, send }: { state: RoomState; host: boolean; send: Send }) {
  const link = `${location.origin}/app/rooms/${state.code}`;
  const copy = () => void navigator.clipboard.writeText(link).then(() => toast.success("已複製邀請連結"), () => toast.error("無法複製，請手動分享代碼。"));
  return (
    <>
      <Panel className="grid justify-items-center gap-3 py-8 text-center">
        <p className="text-sm text-ink-muted">房間代碼</p>
        <p className="font-latin text-5xl font-bold tracking-[0.25em]">{state.code}</p>
        <Button onClick={copy} variant="secondary"><Copy weight="bold" />複製邀請連結</Button>
        <p className="text-sm text-ink-muted">共 {state.total} 題</p>
      </Panel>
      <Scoreboard hostUid={state.hostUid} players={state.players} title={`玩家 ${state.players.length}/8`} you={state.you} />
      {host ? (
        <Button className="justify-self-start" onClick={() => send({ type: "start" })} size="lg" variant="primary"><Play weight="fill" />開始</Button>
      ) : <p className="px-1 text-sm text-ink-muted">等房主開始…</p>}
    </>
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
    <>
      <div className="flex items-center gap-3">
        <Chip>{TASK_LABELS[question.type]}</Chip>
        <span className="text-sm text-ink-muted">第 {state.index + 1} / {state.total} 題</span>
        <span className="ms-auto text-sm tabular-nums text-ink-muted">{reveal ? "看結果" : `${answered}/${state.players.length} 已作答`}</span>
      </div>
      <ProgressBar label={reveal ? "下一題倒數" : "作答倒數"} value={remaining !== null && state.duration ? remaining / state.duration : 0} />
      <Prompt question={question} revealed={state.revealedBlanks} />
      <div className={cn("grid gap-2", question.options.length <= 4 && question.options.every((option) => option.length <= 24) && "sm:grid-cols-2")} role="group" aria-label="選項">
        {question.options.map((option, index) => {
          const right = Boolean(reveal?.accepted.includes(index));
          const picked = chosen === index;
          const wrong = Boolean(reveal) && picked && !right;
          const locked = chosen !== null || Boolean(reveal) || used.has(option);
          return (
            <button
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-tile border px-4 py-3 text-left outline-none transition-[background-color,border-color,transform] duration-[var(--motion-control)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default",
                !locked && "border-line bg-surface hover:bg-surface-raised active:scale-[var(--motion-press-scale)]",
                !reveal && picked && "border-contrast bg-accent-soft",
                reveal && right && "border-positive bg-positive/12",
                wrong && "border-danger bg-danger/12",
                locked && !picked && !(reveal && right) && "border-line bg-surface opacity-55",
              )}
              disabled={locked}
              key={index}
              onClick={() => send({ type: "answer", index: state.index, choice: index })}
              type="button"
            >
              <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold", reveal && right ? "bg-positive text-white" : wrong ? "bg-danger text-white" : "bg-surface-raised text-ink-muted")}>
                {reveal && right ? <Check weight="bold" /> : wrong ? <X weight="bold" /> : index + 1}
              </span>
              <span className={cn("min-w-0 flex-1", /[A-Za-z]/.test(option) && "font-latin")}>{option}</span>
            </button>
          );
        })}
      </div>
      {reveal ? (
        <Panel className="message-in grid gap-1" role="status">
          <p className={cn("font-semibold", gained ? "text-positive" : "text-danger")}>{gained ? `答對了 +${gained}` : chosen === null ? "沒有作答" : "答錯了"}</p>
          {reveal.explanation ? <p className="text-[0.9375rem] text-ink-muted">{reveal.explanation}</p> : null}
        </Panel>
      ) : chosen !== null ? <p className="px-1 text-sm text-ink-muted">已作答，等其他人…</p> : null}
      <Scoreboard hostUid={state.hostUid} players={state.players} title="排名" you={state.you} />
      {host ? <Button className="justify-self-start" onClick={() => send({ type: "end" })} variant="ghost"><Stop weight="fill" />提前結束</Button> : null}
    </>
  );
}

function Prompt({ question, revealed }: { question: LiveQuestion; revealed: Record<number, string> }) {
  if (question.type === "meaning")
    return <p className="py-6 text-center font-latin text-4xl font-bold tracking-tight md:text-5xl" lang="en">{question.prompt}</p>;
  if (question.type === "reverse")
    return <p className="py-6 text-center text-3xl font-bold md:text-4xl">{question.prompt}</p>;
  if (!question.passage)
    return <p className="whitespace-pre-line py-4 font-latin text-xl leading-relaxed md:text-2xl" lang="en">{question.prompt}</p>;
  return (
    <div className="grid gap-3">
      <Panel className="max-h-[45svh] overflow-y-auto">
        {question.passage.title ? <h2 className="mb-2 font-latin text-lg font-semibold" lang="en">{question.passage.title}</h2> : null}
        <p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.8]" lang="en">
          {passageParts(question.passage.text).map((part, index) =>
            typeof part === "string" ? <span key={index}>{part}</span> : (
              <span className={cn("mx-0.5 inline-flex min-w-12 justify-center rounded-chip px-1.5 text-[0.9375rem] font-semibold", part === question.blank ? "bg-contrast text-on-contrast" : revealed[part] ? "bg-positive/12 text-positive" : "bg-surface-raised text-ink-muted")} key={index}>
                {revealed[part] && part !== question.blank ? revealed[part] : `(${part})`}
              </span>
            ),
          )}
        </p>
      </Panel>
      {question.type === "reading" ? <p className="font-latin text-lg font-medium leading-relaxed" lang="en">{question.prompt}</p> : <p className="text-sm text-ink-muted">選出第 {question.blank} 格的答案</p>}
    </div>
  );
}

function Ended({ state }: { state: RoomState }) {
  const place = state.players.findIndex((player) => player.uid === state.you) + 1;
  const review = state.review;
  return (
    <>
      <Panel className="grid justify-items-center gap-1 py-8 text-center">
        <p className="text-sm text-ink-muted">對戰結束</p>
        <p className="text-4xl font-bold">{place ? `第 ${place} 名` : "完成"}</p>
        <p className="text-sm text-ink-muted">{state.players.find((player) => player.uid === state.you)?.score ?? 0} 分</p>
      </Panel>
      <Scoreboard hostUid={state.hostUid} players={state.players} title="最終排名" you={state.you} />
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
      ) : review ? <p className="px-1 text-sm text-positive">全部答對，太強了。</p> : null}
      <Button asChild className="justify-self-start" variant="primary"><AppLink href="/app/rooms">再開一場</AppLink></Button>
    </>
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
            <span className={cn("flex items-center gap-2", !player.connected && "text-ink-faint")}>
              <span className="w-5 tabular-nums text-ink-muted">{index + 1}</span>
              <span className="truncate">{player.name}</span>
              {player.uid === hostUid ? <Crown aria-label="房主" className="text-highlight" weight="fill" /> : null}
              {player.uid === you ? <Chip>你</Chip> : null}
            </span>
          }
          value={<span className="tabular-nums">{player.score}</span>}
        />
      ))}
    </ListGroup>
  );
}
