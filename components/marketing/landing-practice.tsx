"use client";

import { useState } from "react";

import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

const choices = ["release", "retain", "replace", "reveal"] as const;

export function LandingPractice() {
  const [selected, setSelected] = useState<string | null>(null);
  const correct = selected === "retain";

  return (
    <section className="about-specimen" aria-labelledby="about-demo-title">
      <div className="about-specimen-topline">
        <span>{t("about.demoLabel")}</span>
        <span>{t("about.demoSample")}</span>
      </div>

      <div className="about-specimen-body">
        <div className="about-word-meta">
          <span>{t("about.demoWordType")}</span>
          <span>{t("about.demoWordNo")}</span>
        </div>
        <h2 id="about-demo-title" className="about-headword">
          retain<span className="about-headword-stop">.</span>
        </h2>
        <p className="about-sense">{t("about.demoSense")}</p>

        <div className="about-question-block">
          <div className="about-question-label">
            <Icons.question aria-hidden="true" className="size-4" />
            {t("about.demoQuestionLabel")}
          </div>
          <p className="about-question">
            The container is designed to <span>_____</span> heat for several
            hours.
          </p>
          <div
            className="about-choices"
            aria-label={t("about.demoChoicesLabel")}
          >
            {choices.map((choice, index) => (
              <button
                key={choice}
                type="button"
                className="about-choice"
                data-selected={selected === choice}
                data-correct={selected === choice && correct}
                aria-pressed={selected === choice}
                onClick={() => setSelected(choice)}
              >
                <span className="about-choice-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{choice}</span>
                {selected === choice &&
                  (correct ? (
                    <Icons.success aria-hidden="true" className="size-4" />
                  ) : (
                    <Icons.incorrect aria-hidden="true" className="size-4" />
                  ))}
              </button>
            ))}
          </div>
          <div className="about-demo-feedback" role="status" aria-live="polite">
            {selected ? (
              <>
                <span>
                  {correct ? t("about.demoCorrect") : t("about.demoIncorrect")}
                </span>
                <button type="button" onClick={() => setSelected(null)}>
                  {t("about.demoReset")}
                  <Icons.refresh aria-hidden="true" className="size-4" />
                </button>
              </>
            ) : (
              <span>{t("about.demoPrompt")}</span>
            )}
          </div>
        </div>
      </div>
      <div className="about-specimen-foot">
        <span>{t("about.demoFoot")}</span>
      </div>
    </section>
  );
}
