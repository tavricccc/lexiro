import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, DownloadSimple, GoogleLogo } from "@phosphor-icons/react";
import { toast } from "sonner";
import { parseShareCode, type SetContent } from "@lexiro/contract";
import { AppLink, Button, EmptyState, ListGroup, ListRow, Panel, type ActionStatus } from "design-kit";
import { ApiError, errorMessage } from "@/data/api";
import { signIn, useAuth } from "@/data/auth";
import { addShared, sharedSet } from "@/data/library";
import { keys, useLibrary } from "@/data/queries";
import { KIND_LABELS } from "@/domain/labels";
import { meaningLine } from "@/features/library/set-page";
import { Brand } from "@/ui/brand";
import { LabeledSelect } from "@/ui/labeled-select";
import { Page } from "@/ui/page";
import { ScrollMore } from "@/ui/scroll-more";
import { SetIcon } from "@/ui/set-icon";

const gone = (error: unknown) => error instanceof ApiError && error.status === 404;

/** Anyone with the link or code can look; adding it copies the set into the visitor's own account. */
export default function SharedPage() {
  const { shareId = "" } = useParams();
  const code = parseShareCode(shareId) ?? shareId;
  const { ready, account } = useAuth();
  const shared = useQuery({ queryKey: keys.shared(code), queryFn: () => sharedSet(code), retry: (count, error) => !gone(error) && count < 2 });
  const content = shared.data;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6 px-[var(--gutter)] pb-12 pt-[calc(var(--safe-top)+1.5rem)]">
      <ScrollMore className="fixed bottom-[calc(var(--safe-bottom)+1rem)] left-1/2 -translate-x-1/2" />
      <AppLink className="justify-self-start" href={account ? "/app/library" : "/"}><Brand /></AppLink>
      {content ? (
        <Page description={`${content.words.length} 個單字 · ${content.questions.length} 題`} documentTitle={content.set.name} title={<span className="flex items-center gap-3"><SetIcon icon={content.set.icon} />{content.set.name}</span>}>
          <Panel className="grid gap-4">
            <p className="text-[0.9375rem] text-ink-muted">加入後會複製一份到你的帳號，之後可以自由修改和練習。</p>
            {!ready ? null : account ? (
              <AddForm code={code} content={content} />
            ) : (
              <Button className="justify-self-start" onClick={() => void signIn().catch((error) => toast.error(errorMessage(error)))} size="lg" variant="primary"><GoogleLogo weight="bold" />用 Google 登入後加入</Button>
            )}
          </Panel>
          {content.words.length ? (
            <ListGroup title="單字">
              {content.words.slice(0, 200).map((word) => <ListRow detail={meaningLine(word)} key={word.id} label={<span className="font-latin" lang="en">{word.word}</span>} />)}
            </ListGroup>
          ) : null}
          {content.words.length > 200 ? <p className="text-center text-sm text-ink-muted">還有 {content.words.length - 200} 個單字，加入後可以看到全部。</p> : null}
          {content.questions.length ? (
            <ListGroup title="題目">
              {Object.entries(Object.groupBy(content.questions, (question) => question.kind)).map(([kind, list]) => <ListRow key={kind} label={KIND_LABELS[kind as keyof typeof KIND_LABELS]} value={`${list?.length ?? 0} 題`} />)}
            </ListGroup>
          ) : null}
        </Page>
      ) : shared.isError ? (
        <EmptyState
          action={gone(shared.error) ? undefined : <Button onClick={() => void shared.refetch()}>再試一次</Button>}
          description={errorMessage(shared.error)}
          title="無法開啟這個分享"
        />
      ) : (
        <Page title="載入中…" />
      )}
    </div>
  );
}

const NO_FOLDER = "none";

function AddForm({ code, content }: { code: string; content: SetContent }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const library = useLibrary();
  const folders = library.data?.folders ?? [];
  const [picked, setPicked] = useState(params.get("folder") ?? NO_FOLDER);
  const folder = folders.some((entry) => entry.id === picked) ? picked : NO_FOLDER;
  const [status, setStatus] = useState<ActionStatus>("idle");
  if (library.data?.sets.some((set) => set.id === content.set.id))
    return <Button asChild className="justify-self-start" size="lg" variant="primary"><AppLink href={`/app/sets/${content.set.id}`}>開啟你的單字集<ArrowRight weight="bold" /></AppLink></Button>;
  const add = async () => {
    setStatus("loading");
    try {
      const set = await addShared(code, folder === NO_FOLDER ? null : folder);
      toast.success(`已加入「${set.name}」`);
      navigate(`/app/sets/${set.id}`, { replace: true });
    } catch (error) {
      setStatus("idle");
      toast.error(errorMessage(error));
    }
  };
  return (
    <>
      {folders.length ? (
        <LabeledSelect label="資料夾" onChange={setPicked} options={[{ value: NO_FOLDER, label: "不放資料夾" }, ...folders.map((entry) => ({ value: entry.id, label: entry.name }))]} value={folder} />
      ) : null}
      <Button className="justify-self-start" disabled={library.isPending} onClick={() => void add()} size="lg" status={status} variant="primary"><DownloadSimple weight="bold" />加入我的單字</Button>
    </>
  );
}
