import { useState } from "react";

import Link from "@/components/ui/app-link";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { SignInRequired } from "@/components/ui/sign-in-required";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { Finished } from "./room-finished";
import { Lobby } from "./room-lobby";
import { QuestionStage } from "./room-question-stage";
import { playerName } from "./rooms-page";
import { useRoom, type RoomConnection } from "./use-room";

/** A live room. Everything on screen comes from the server's latest state. */
export function RoomPage({ code }: { code: string }) {
  const ready = useCloudStore((store) => store.ready);
  const user = useCloudStore((store) => store.user);
  if (!ready) return <LibraryListSkeleton />;
  if (!user)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          back={<BackControl href="/app/rooms" />}
          title={t("rooms.title")}
        />
        <SignInRequired message={t("rooms.signInRequired")} />
      </div>
    );
  return <LiveRoom code={code} name={playerName(user)} />;
}

function LiveRoom({ code, name }: { code: string; name: string }) {
  const { state, connection, error, offset, send, takeBack } = useRoom(
    code,
    name,
    true,
  );
  const [confirmEnd, setConfirmEnd] = useState(false);
  const back = <BackControl href="/app/rooms" label={t("rooms.leave")} />;

  if (connection === "replaced")
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={back} title={state?.title ?? t("rooms.title")} />
        <section className="rounded-[var(--radius-card)] bg-card p-6 text-center">
          <Icons.rooms
            aria-hidden
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3">{t("rooms.replaced")}</p>
          <Button className="mt-5" onClick={takeBack}>
            {t("rooms.takeBack")}
          </Button>
        </section>
      </div>
    );
  if (connection === "closed" && (!state || error))
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={back} title={t("rooms.title")} />
        <section className="rounded-[var(--radius-card)] bg-card p-6 text-center">
          <Icons.error
            aria-hidden
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3">{error || t("rooms.notFound")}</p>
          <Button asChild className="mt-5" variant="secondary">
            <Link href="/app/rooms">{t("rooms.leave")}</Link>
          </Button>
        </section>
      </div>
    );
  if (!state)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={back} title={t("rooms.title")} />
        <p className="text-center text-muted-foreground" role="status">
          {t("rooms.connecting")}
        </p>
      </div>
    );

  const isHost = state.you === state.hostUid;
  return (
    <div className="mx-auto max-w-3xl" data-room-live>
      <PageHeader
        back={back}
        title={state.title}
        actions={
          isHost && state.phase !== "ended" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmEnd(true)}
            >
              <Icons.cancel />
              {t("rooms.endGame")}
            </Button>
          ) : undefined
        }
      />
      <ConnectionNotice connection={connection} />
      <ConfirmDialog
        confirmLabel={t("rooms.endGame")}
        description={t("rooms.endConfirm")}
        onConfirm={() => {
          send({ type: "end" });
          setConfirmEnd(false);
        }}
        onOpenChange={setConfirmEnd}
        open={confirmEnd}
        title={t("rooms.endGame")}
        tone="danger"
      />
      {state.phase === "lobby" && (
        <Lobby
          state={state}
          isHost={isHost}
          onStart={() => send({ type: "start" })}
        />
      )}
      {(state.phase === "question" || state.phase === "reveal") && (
        <QuestionStage
          key={state.index}
          state={state}
          offset={offset}
          onAnswer={(choice) =>
            send({ type: "answer", index: state.index, choice })
          }
        />
      )}
      {state.phase === "ended" && <Finished state={state} />}
    </div>
  );
}

function ConnectionNotice({ connection }: { connection: RoomConnection }) {
  if (connection === "open" || connection === "closed") return null;
  return (
    <p
      className="mb-4 flex items-center justify-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground"
      role="status"
    >
      <Icons.loading aria-hidden className="size-4 animate-spin" />
      {connection === "reconnecting"
        ? t("rooms.reconnecting")
        : t("rooms.connecting")}
    </p>
  );
}
