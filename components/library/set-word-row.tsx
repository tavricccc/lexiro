import Link from "@/components/ui/app-link";
import type { WordKey, WordSense } from "@/types";
import { SpeakPill } from "@/components/ui/speak-pill";
import { t } from "@/lib/i18n";
import { withReturnTo } from "@/lib/browse-routes";

export interface ViewWord {
  wordKey: WordKey;
  word: string;
  senses: WordSense[];
}

export function wordDetailHref(setId: string, wordKey: WordKey): string {
  return `/app/sets/${setId}/words/${encodeURIComponent(wordKey)}`;
}

/** One word as in the app's list: its meanings, their notes, a first example, and a way to hear it. */
export function SetWordRow({
  entry,
  setId,
  returnTo,
}: {
  entry: ViewWord;
  setId: string;
  returnTo?: string;
}) {
  const href = wordDetailHref(setId, entry.wordKey);
  return (
    <Link
      className="t-row flex items-center gap-3 py-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      href={returnTo ? withReturnTo(href, returnTo) : href}
    >
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-[1.375rem] font-bold leading-7 tracking-[-0.02em]">
          {entry.word}
        </span>
        {entry.senses.map((sense) => (
          <span key={sense.id} className="grid gap-px">
            <span className="text-base leading-6">
              <span className="font-semibold text-brand">{sense.pos} </span>
              {sense.meaningZh}
            </span>
            {sense.description && (
              <span className="mt-1 mb-0.5 justify-self-start rounded-[var(--radius-segment)] bg-[var(--brand-50)] px-3 py-1.5 type-hint line-clamp-2 text-foreground">
                {sense.description}
              </span>
            )}
            {sense.examples[0] && (
              <span className="type-hint line-clamp-2 text-muted-foreground">
                {sense.examples[0]}
              </span>
            )}
          </span>
        ))}
      </span>
      <SpeakPill text={entry.word} label={t("setDetail.speak")} size="sm" />
    </Link>
  );
}

/** Every meaning of a word in this set, read in full. */
export function WordSenseCard({ sense }: { sense: WordSense }) {
  return (
    <section className="grid gap-2 rounded-[var(--radius-card)] bg-card p-5">
      <p className="type-section">
        <span className="font-semibold text-brand">{sense.pos} </span>
        {sense.meaningZh}
      </p>
      {sense.description && (
        <div className="rounded-[var(--radius-segment)] bg-[var(--brand-50)] px-4 py-3">
          <p className="text-[0.8125rem] font-semibold text-[#3f7c5a]">
            {t("setEditor.description")}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-base leading-6 text-foreground">
            {sense.description}
          </p>
        </div>
      )}
      {sense.examples
        .filter((example) => example.trim())
        .map((example, index) => (
          <p key={index} className="text-base leading-6 text-muted-foreground">
            {example}
          </p>
        ))}
      {sense.supplementary && (
        <p className="type-hint text-muted-foreground">
          {t("wordEdit.supplementaryHint")}
        </p>
      )}
    </section>
  );
}
