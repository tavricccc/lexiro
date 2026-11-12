import { Check } from "@phosphor-icons/react";
import { SpeakButton } from "@/components/redesign/primitives";
import { StarButton } from "@/components/ui/star-button";
import Link from "@/components/ui/app-link";
import type { WordKey, WordSense } from "@/types";
import { DescriptionPoints } from "@/components/library/description-points";
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
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  entry: ViewWord;
  setId: string;
  returnTo?: string;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (wordKey: WordKey) => void;
}) {
  const href = wordDetailHref(setId, entry.wordKey);
  const body = (
    <>
      <span className="hw set-word-heading font-latin">{entry.word}</span>
      <div className="set-word-senses">
        {entry.senses.map((sense) => {
          const example = sense.examples.find((text) => text.trim());
          return (
            <div className="set-word-sense" key={sense.id}>
              <p>
                <span className="set-word-pos font-latin">{sense.pos}</span>{" "}
                {sense.meaningZh}
              </p>
              {sense.description?.trim() && (
                <DescriptionPoints
                  text={sense.description}
                  max={3}
                  className="set-word-note"
                  pointClassName="line-clamp-2"
                />
              )}
              {example && (
                <p
                  className="set-word-example font-latin line-clamp-2"
                  lang="en"
                >
                  {example}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
  if (selectable)
    return (
      <div
        aria-pressed={selected}
        className="w set-word-preview w-selectable"
        data-selected={selected}
        onClick={() => onToggleSelect?.(entry.wordKey)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onToggleSelect?.(entry.wordKey);
        }}
        role="button"
        tabIndex={0}
      >
        <div aria-label={entry.word} className="set-word-link">
          {body}
        </div>
        <span aria-hidden className="w-select-indicator">
          <Check weight="bold" />
        </span>
      </div>
    );
  return (
    <div className="w set-word-preview">
      <Link
        aria-label={entry.word}
        className="set-word-link"
        href={returnTo ? withReturnTo(href, returnTo) : href}
      >
        {body}
      </Link>
      <StarButton wordKey={entry.wordKey} />
      <SpeakButton text={entry.word} />
    </div>
  );
}

/** Every meaning of a word in this set, read in full. */
export function WordSenseCard({ sense }: { sense: WordSense }) {
  return (
    <section className="tile sense">
      <p className="type-section">
        <span className="font-semibold text-brand">{sense.pos} </span>
        {sense.meaningZh}
      </p>
      {sense.description && (
        <div className="rounded-[var(--radius-segment)] bg-[var(--brand-50)] px-4 py-3">
          <p className="text-[0.8125rem] font-semibold text-[#3f7c5a]">
            {t("setEditor.description")}
          </p>
          <DescriptionPoints
            text={sense.description}
            className="mt-0.5 text-base leading-6 text-foreground"
          />
        </div>
      )}
      {sense.examples
        .filter((example) => example.trim())
        .map((example, index) => (
          <p key={index} className="ex font-latin">
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
