import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DownloadSimple, GoogleLogo } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { LibraryIndex } from "@lexiro/contract";
import { AppLink, Button, EmptyState, ListGroup, ListRow, Panel, type ActionStatus } from "design-kit";
import { api, ApiError, errorMessage } from "@/data/api";
import { signIn, useAuth } from "@/data/auth";
import { sharedSet } from "@/data/library";
import { invalidate, keys, queryClient } from "@/data/queries";
import { KIND_LABELS } from "@/domain/labels";
import { meaningLine } from "@/features/library/set-page";
import { Brand } from "@/ui/brand";
import { Page } from "@/ui/page";
import { SetIcon } from "@/ui/set-icon";

/** Anyone with the link can look; adding it copies the set into the visitor's own account. */
export default function SharedPage() {
  const { shareId = "" } = useParams();
  const { ready, account } = useAuth();
  const navigate = useNavigate();
  const shared = useQuery({ queryKey: ["shared", shareId], queryFn: () => sharedSet(shareId), retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2 });
  const [status, setStatus] = useState<ActionStatus>("idle");
  const add = async () => {
    if (!shared.data) return;
    setStatus("loading");
    try {
      const before = new Set((await api<LibraryIndex>("/library")).sets.map((set) => set.id));
      await api("/backup", { method: "POST", json: { version: 1, folders: [], sets: [{ ...shared.data, set: { ...shared.data.set, folderId: null, order: null } }] } });
      await invalidate();
      const after = await queryClient.fetchQuery({ queryKey: keys.library, queryFn: () => api<LibraryIndex>("/library") });
      const created = after.sets.find((set) => !before.has(set.id));
      toast.success(`已加入「${shared.data.set.name}」`);
      navigate(created ? `/app/sets/${created.id}` : "/app/sets");
    } catch (error) {
      setStatus("idle");
      toast.error(errorMessage(error));
    }
  };
  const content = shared.data;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6 px-[var(--gutter)] pb-12 pt-[calc(var(--safe-top)+1.5rem)]">
      <AppLink className="justify-self-start" href={account ? "/app" : "/"}><Brand /></AppLink>
      {shared.isError ? (
        <EmptyState description={errorMessage(shared.error)} title="無法開啟這個分享" />
      ) : !content ? (
        <Page title="載入中…" />
      ) : (
        <Page description={`${content.words.length} 個單字 · ${content.questions.length} 題`} documentTitle={content.set.name} title={<span className="flex items-center gap-3"><SetIcon hue={content.set.hue} icon={content.set.icon} />{content.set.name}</span>}>
          <Panel className="grid gap-3">
            <p className="text-[0.9375rem] text-ink-muted">有人分享了這個單字集給你。加入後會複製一份到你的帳號，之後可以自由修改和練習。</p>
            {!ready ? null : account ? (
              <Button className="justify-self-start" onClick={() => void add()} size="lg" status={status} variant="primary"><DownloadSimple weight="bold" />加入我的單字</Button>
            ) : (
              <Button className="justify-self-start" onClick={() => void signIn().catch((error) => toast.error(errorMessage(error)))} size="lg" variant="primary"><GoogleLogo weight="bold" />用 Google 登入後加入</Button>
            )}
          </Panel>
          <ListGroup title="單字">
            {content.words.slice(0, 200).map((word) => <ListRow detail={meaningLine(word)} key={word.id} label={<span className="font-latin" lang="en">{word.word}</span>} />)}
          </ListGroup>
          {content.words.length > 200 ? <p className="text-center text-sm text-ink-muted">還有 {content.words.length - 200} 個單字，加入後可以看到全部。</p> : null}
          {content.questions.length ? (
            <ListGroup title="題目">
              {Object.entries(Object.groupBy(content.questions, (question) => question.kind)).map(([kind, list]) => <ListRow key={kind} label={KIND_LABELS[kind as keyof typeof KIND_LABELS]} value={`${list?.length ?? 0} 題`} />)}
            </ListGroup>
          ) : null}
        </Page>
      )}
    </div>
  );
}
