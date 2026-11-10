import { useState } from "react";
import { Check, Fire, Play, Target } from "@phosphor-icons/react";
import { RootPageHeader } from "@/components/root-page-header";
import Link from "@/components/ui/app-link";
import { t } from "@/lib/i18n";
import {
  calendarDay,
  heatMap,
  mostMissed,
  recentAccuracy,
  streak,
} from "@/src/lib/learning-record";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { KindAccuracy } from "./learning-summary";
import { Ring, WordRow } from "./primitives";
import { PracticeLaunch } from "./practice-launch";
export function ProgressPage() {
  const record = useLearningStore((s) => s.record);
  const library = useLibraryStore((s) => s.state);
  const [launch, setLaunch] = useState(false);
  const today = calendarDay(new Date());
  const levels = [0, 0, 0, 0];
  Object.values(library.words).forEach((word) =>
    word.senses.forEach(
      (sense) => levels[record.senses[sense.id]?.level ?? 0]++,
    ),
  );
  const answered = record.days[today]?.answered ?? 0;
  return (
    <>
      <RootPageHeader title={t("redesign.progress")} />
      <div className="trio pop-in" style={{ marginBottom: 20 }}>
        {[
          [streak(record, today), t("redesign.dayUnit"), "amber", Fire],
          [levels[3], t("redesign.known"), "mint", Check],
          [
            recentAccuracy(record, today) + "%",
            t("redesign.weekly"),
            "sky",
            Target,
          ],
        ].map(([value, label, hue, Glyph]) => {
          const Icon = Glyph as typeof Fire;
          return (
            <section className={`tile tile-hue hue-${hue}`} key={String(label)}>
              <span className="glyph">
                <Icon />
              </span>
              <p className="fig">{String(value)}</p>
              <p>{String(label)}</p>
            </section>
          );
        })}
      </div>
      <div className="cols-3 stack">
        <section className="tile span-2 stack">
          <b>{t("redesign.heat")}</b>
          <div className="heat">
            {heatMap(record, today, 26).map((day) => (
              <i
                key={day.day}
                data-v={day.intensity}
                title={`${day.day}: ${day.count}`}
                aria-label={`${day.day}: ${day.count}`}
              />
            ))}
          </div>
        </section>
        <section className="tile stack">
          <div className="between">
            <b>{t("redesign.goal")}</b>
            <Link
              className="btn btn-secondary btn-compact"
              href="/app/me/preferences"
            >
              {record.goal}
            </Link>
          </div>
          <div className="rowx">
            <Ring className="ring-paper" value={(answered / record.goal) * 100}>
              <b className="latin">
                {Math.round((answered / record.goal) * 100)}%
              </b>
            </Ring>
            <p className="fig">
              {answered}
              <small>/ {record.goal}</small>
            </p>
          </div>
        </section>
        <section className="tile span-2 stack">
          <b>{t("redesign.kinds")}</b>
          <KindAccuracy />
        </section>
        <section className="tile stack">
          <b>{t("redesign.distribution")}</b>
          <div className="dist">
            {[3, 2, 1, 0].map((level, i) => (
              <i
                key={level}
                style={{
                  flex: levels[level],
                  background: [
                    "var(--hue-mint)",
                    "var(--hue-sky)",
                    "var(--hue-amber)",
                    "var(--fill-pressed)",
                  ][i],
                }}
              />
            ))}
          </div>
          <div className="stack">
            {["unpractised", "wrong", "nearly", "known"].map((key, i) => (
              <div className="between" key={key}>
                <span>{t(`redesign.${key}` as "redesign.known")}</span>
                <b className="latin">{levels[i]}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="sec">
        <h2>{t("redesign.mostMissed")}</h2>
        <button
          className="btn btn-secondary btn-compact"
          onClick={() => setLaunch(true)}
        >
          <Play />
          {t("redesign.review")}
        </button>
      </div>
      <div className="sheet-list cols">
        {mostMissed(record).map((entry) => {
          const word =
            library.words[entry.wordKey as keyof typeof library.words];
          const set = library.sets.find((s) =>
            library.memberships[s.id]?.some((m) => m.wordKey === entry.wordKey),
          );
          return word && set ? (
            <WordRow key={entry.wordKey} word={word} setId={set.id} />
          ) : null;
        })}
      </div>
      <PracticeLaunch open={launch} onClose={() => setLaunch(false)} review />
    </>
  );
}
