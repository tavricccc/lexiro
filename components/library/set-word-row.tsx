import Link from "@/components/ui/app-link";
import type { WordKey, WordSense } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { withReturnTo } from "@/lib/browse-routes";

export interface ViewWord {
  wordKey: WordKey;
  word: string;
  senses: WordSense[];
}

/** Reads a word aloud with the system voice. */
function speak(word: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

export function SetWordRow({
  entry,
  setId,
  returnTo,
}: {
  entry: ViewWord;
  setId: string;
  returnTo?: string;
}) {
  const editHref = `/app/sets/${setId}/words/${encodeURIComponent(entry.wordKey)}/edit`;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-left text-base font-medium">{entry.word}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("setDetail.speak")}
            onClick={() => speak(entry.word)}
          >
            <Icons.speak />
          </Button>
        </div>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={t("setDetail.edit")}
        >
          <Link href={returnTo ? withReturnTo(editHref, returnTo) : editHref}>
            <Icons.edit />
          </Link>
        </Button>
      </div>
      <dl className="mt-2 grid gap-3">
        {entry.senses.map((sense) => {
          return (
            <div key={sense.id}>
              <dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
                <span className="text-muted-foreground">{sense.pos}</span>
                <span className="font-medium">{sense.meaningZh}</span>
                {sense.supplementary && (
                  <span className="text-xs text-muted-foreground">
                    {t("supplement.badge")}
                  </span>
                )}
              </dt>
              <dd className="mt-1.5 grid gap-1">
                {sense.examples.map((example, index) => (
                  <p className="type-lead" key={index}>
                    {example}
                  </p>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
