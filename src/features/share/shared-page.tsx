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
      navigate(created ? `/app/sets/${created.id}` : "/app/library");
    } catch (error) {
      setStatus("idle");
      toast.error(errorMessage(error));
    }
  };
  const content = shared.data;
  return (
    <div className="min-h-svh bg-canvas">
      <header className="border-b-2 border-line-strong bg-surface px-[var(--gutter)] py-4 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <AppLink href={account ? "/app" : "/"}><Brand compact /></AppLink>
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">SHARED LEXICON</span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-[var(--gutter)] py-8 md:px-10 md:py-12">
        {shared.isError ? (
          <EmptyState description={errorMessage(shared.error)} title="無法開啟這個分享" />
        ) : !content ? (
          <Page kicker="SHARED // LOADING" title="載入中…" />
        ) : (
          <Page
            documentTitle={content.set.name}
            kicker={`SHARED SET // ${content.words.length} WORDS · ${content.questions.length} QUESTIONS`}
            title={<span className="inline-flex items-center gap-3.5"><SetIcon hue={content.set.hue} icon={content.set.icon} /><span>{content.set.name}</span></span>}
          >
            <div className="grid items-start gap-8 lg:grid-cols-12">
              <div className="grid gap-6 lg:sticky lg:top-8 lg:col-span-4">
                <Panel className="grid gap-5 border-2 border-line-strong">
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">IMPORT TO ACCOUNT</span>
                  <p className="text-sm leading-relaxed text-ink-muted">加入後會複製一份到你的帳號，可自由修改、出題與練習。</p>
                  {!ready ? null : account ? (
                    <Button className="w-full" onClick={() => void add()} size="lg" status={status} variant="primary"><DownloadSimple weight="bold" />加入我的單字</Button>
                  ) : (
                    <Button className="w-full" onClick={() => void signIn().catch((error) => toast.error(errorMessage(error)))} size="lg" variant="primary"><GoogleLogo weight="bold" />用 Google 登入後加入</Button>
                  )}
                </Panel>
                {content.questions.length ? (
                  <ListGroup title="包含題目">
                    {Object.entries(Object.groupBy(content.questions, (question) => question.kind)).map(([kind, list]) => (
                      <ListRow key={kind} label={KIND_LABELS[kind as keyof typeof KIND_LABELS]} value={`${list?.length ?? 0} 題`} />
                    ))}
                  </ListGroup>
                ) : null}
              </div>

              <div className="grid gap-4 lg:col-span-8">
                <ListGroup title={`單字預覽 (${Math.min(200, content.words.length)}/${content.words.length})`}>
                  {content.words.slice(0, 200).map((word) => (
                    <ListRow detail={meaningLine(word)} key={word.id} label={<span className="font-latin" lang="en">{word.word}</span>} />
                  ))}
                </ListGroup>
                {content.words.length > 200 ? <p className="font-mono text-xs text-ink-muted">還有 {content.words.length - 200} 個單字，加入後可查看全部。</p> : null}
              </div>
            </div>
          </Page>
        )}
      </div>
    </div>
  );
}
