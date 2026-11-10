import Link from "@/components/ui/app-link";
import { useState } from "react";
import {
  ArrowCounterClockwise,
  Check,
  Fire,
  Lightning,
  Play,
  Target,
} from "@phosphor-icons/react";
import { t } from "@/lib/i18n";
import {
  calendarDay,
  mostMissed,
  recentAccuracy,
  shiftDay,
  streak,
} from "@/src/lib/learning-record";
import { readPracticeDraft } from "@/src/lib/practice-storage";
import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";
import { SetRow } from "@/components/library/library-rows";
import { useSetActions } from "@/components/library/set-actions";
import {
  EmptyLibrary,
  Ring,
  SpeakButton,
  vars,
} from "@/components/redesign/primitives";
import { KindAccuracy } from "@/components/redesign/learning-summary";
import { PracticeLaunch } from "@/components/redesign/practice-launch";
export function FocusCanvas() {
  const library = useLibraryStore((s) => s.state);
  const record = useLearningStore((s) => s.record);
  const [launch, setLaunch] = useState(false);
  const [review, setReview] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const { actionsFor, dialogs } = useSetActions();
  const today = calendarDay(new Date());
  const answered = record.days[today]?.answered ?? 0;
  const missed = mostMissed(record, 30).filter(
    (w) => library.words[w.wordKey as keyof typeof library.words],
  );
  const random = Object.values(library.words)[
    Math.floor(
      new Date().getDate() % Math.max(1, Object.keys(library.words).length),
    )
  ];
  let resume = false;
  try {
    resume = Boolean(readPracticeDraft());
  } catch {
    /* Unavailable storage leaves a fresh session. */
  }
  const monday = shiftDay(
    today,
    -((new Date(`${today}T12:00:00`).getDay() + 6) % 7),
  );
  if (!library.sets.length) return <EmptyLibrary />;
  return (
    <>
      <div className="bento b4 pop-in">
        <section
          className="hero wide"
          style={vars({ "--span": 7, "--rows": 2 })}
        >
          <div className="hero-top">
            <div>
              <p className="muted">{t("redesign.dailyGoal")}</p>
              <p className="fig">
                {answered}
                <small>
                  / {record.goal} {t("redesign.countUnit")}
                </small>
              </p>
            </div>
            <Ring value={(answered / record.goal) * 100} className="ring-xl">
              <Target color="var(--mint)" />
            </Ring>
          </div>
          <div className="hero-acts">
            <button
              className="btn btn-lg btn-mint"
              onClick={() => {
                setReview(false);
                setLaunch(true);
              }}
            >
              <Play />
              {t("redesign.practise")}
            </button>
            {resume && (
              <Link className="btn btn-lg btn-onforest" href="/app/practice">
                {t("redesign.continue")}
              </Link>
            )}
          </div>
        </section>
        <Link
          className="tile tile-hue hue-amber"
          style={vars({ "--span": 5 })}
          href="/app/progress"
        >
          <div className="stack">
            <div className="between">
              <span className="glyph">
                <Fire />
              </span>
              <p className="fig">
                {streak(record, today)}
                <small>{t("redesign.dayUnit")}</small>
              </p>
            </div>
            <div className="week hue-amber">
              {["一", "二", "三", "四", "五", "六", "日"].map((label, i) => (
                <span
                  key={label}
                  className={
                    record.days[shiftDay(monday, i)]?.answered
                      ? "on"
                      : shiftDay(monday, i) === today
                        ? "now"
                        : ""
                  }
                >
                  <b>
                    {record.days[shiftDay(monday, i)]?.answered ? (
                      <Check size={16} weight="bold" />
                    ) : null}
                  </b>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Link>
        <button
          className="tile tile-hue hue-rose"
          style={vars({ "--span": 5 })}
          onClick={() => {
            setReview(true);
            setLaunch(true);
          }}
        >
          <div className="stack">
            <div className="between">
              <span className="glyph">
                <ArrowCounterClockwise />
              </span>
              <p className="fig">
                {missed.length}
                <small>{t("redesign.reviewUnit")}</small>
              </p>
            </div>
            <div className="words-peek">
              {missed.slice(0, 3).map((w) => (
                <span key={w.wordKey}>
                  {library.words[w.wordKey as keyof typeof library.words]?.word}
                </span>
              ))}
            </div>
          </div>
        </button>
      </div>
      <div className="sec">
        <h2>{t("redesign.recent")}</h2>
        <Link href="/app/library">{t("redesign.all")}</Link>
      </div>
      <div className="scroller">
        {library.sets.slice(0, 4).map((set) => (
          <SetRow
            key={set.id}
            id={set.id}
            name={set.setName}
            questionCount={0}
            senseCount={0}
            actions={actionsFor(set.id, { practice: true })}
          />
        ))}
      </div>
      <div className="sec">
        <h2>{t("redesign.ways")}</h2>
      </div>
      <div className="bento b4">
        {random && (
          <div
            className="tile flip half"
            style={vars({ "--span": 4 })}
            data-open={flipped ? "" : undefined}
            role="button"
            tabIndex={0}
            onClick={() => setFlipped(!flipped)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped(!flipped);
              }
            }}
          >
            <div className="between">
              <span className="chip">{t("redesign.random")}</span>
              <SpeakButton text={random.word} />
            </div>
            <div>
              <p className="word">{random.word}</p>
              <p className="back">{random.senses[0]?.meaningZh}</p>
            </div>
          </div>
        )}
        <Link
          className="tile tile-hue hue-violet half"
          href="/app/rooms"
          style={vars({ "--span": 4 })}
        >
          <div
            className="stack"
            style={{ minHeight: 148, alignContent: "space-between" }}
          >
            <span className="glyph">
              <Lightning />
            </span>
            <b className="t-section">{t("redesign.friends")}</b>
          </div>
        </Link>
        <section className="tile wide" style={vars({ "--span": 4 })}>
          <div className="stack">
            <div className="between">
              <b>{t("redesign.weekly")}</b>
              <span className="fig" style={{ fontSize: 28 }}>
                {recentAccuracy(record, today)}
                <small>%</small>
              </span>
            </div>
            <KindAccuracy compact />
          </div>
        </section>
      </div>
      <PracticeLaunch
        open={launch}
        review={review}
        onClose={() => setLaunch(false)}
      />
      {dialogs}
    </>
  );
}
