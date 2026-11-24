import { useSearchParams } from "react-router";
import { LoadingList } from "design-kit";
import { Page } from "@/ui/page";
import { AddForm, SharedContent, SharedCount, SharedError, useShared } from "./shared-page";

/** A shared set opened by its code, over the library it would be added to. */
export default function SharedSheet() {
  const { code, shared } = useShared();
  const [params] = useSearchParams();
  const folder = params.get("folder");
  const content = shared.data;
  return (
    <Page
      back={{ href: folder ? `/app/library/folder/${folder}` : "/app/library", label: "關閉" }}
      description={content ? <SharedCount content={content} /> : undefined}
      documentTitle={content?.set.name}
      title={content?.set.name ?? "分享的單字集"}
    >
      {content ? <SharedContent content={content}><AddForm code={code} content={content} /></SharedContent>
        : shared.isError ? <SharedError shared={shared} />
        : <LoadingList label="載入中" rows={3} />}
    </Page>
  );
}
