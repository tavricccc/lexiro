import { t } from "@/lib/i18n";

export interface EntrySense {
  citation?: string;
  id: string;
  leech: boolean;
  meaning: string;
  pos: string;
}

/**
 * One word as a lexicon entry: the headword leads, its senses are numbered when
 * there is more than one, and the example sits under its own sense as a citation.
 * The numbering is real structure — senses are a sequence — not decoration.
 */
export function WordEntry({
  headword,
  senses,
}: {
  headword: string;
  senses: EntrySense[];
}) {
  return (
    <article className="grid gap-x-6 gap-y-2 py-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      <h3 className="entry-headword self-start break-words">{headword}</h3>
      <div className="entry-senses grid gap-4">
        {senses.map((sense) => (
          <div className="entry-sense flex gap-2" key={sense.id}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="entry-pos">{sense.pos}</span>
                <span className="font-medium">{sense.meaning}</span>
                {sense.leech && (
                  <span className="rounded-full bg-warning/12 px-2 py-0.5 text-xs font-medium text-warning">
                    {t("setDetail.leechBadge")}
                  </span>
                )}
              </p>
              {sense.citation && (
                <p className="entry-citation mt-1.5 text-muted-foreground">
                  {sense.citation}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
