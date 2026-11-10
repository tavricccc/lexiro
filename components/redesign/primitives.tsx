import type { CSSProperties, ReactNode } from "react";
import {
  AirplaneTilt,
  BookOpenText,
  Books,
  BookmarkSimple,
  Briefcase,
  GraduationCap,
  Newspaper,
  SpeakerHigh,
} from "@phosphor-icons/react";
import Link from "@/components/ui/app-link";
import { t } from "@/lib/i18n";
import { familiarity } from "@/src/lib/learning-record";
import { useLearningStore } from "@/stores/learning-store";
import type { LibrarySet, WordEntry } from "@/types";

export const vars = (values: Record<string, string | number>) =>
  values as CSSProperties;
export const setIcons = {
  books: Books,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  "bookmark-simple": BookmarkSimple,
  "airplane-tilt": AirplaneTilt,
  newspaper: Newspaper,
};
export function SetGlyph({ set }: { set: Pick<LibrarySet, "icon" | "hue"> }) {
  const Icon = setIcons[set.icon ?? "books"] ?? Books;
  return (
    <span className={`glyph hue-${set.hue ?? "mint"}`}>
      <Icon weight="regular" />
    </span>
  );
}
export function Dial({
  value,
  label = t("redesign.familiarity"),
}: {
  value: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg
      className="dial"
      data-t={pct >= 67 ? 3 : pct >= 34 ? 2 : pct > 0 ? 1 : 0}
      viewBox="0 0 20 20"
      role="img"
      aria-label={`${label} ${pct}%`}
    >
      <circle cx="10" cy="10" r="7" />
      <circle
        className="arc"
        cx="10"
        cy="10"
        r="7"
        pathLength="100"
        strokeDasharray={`${pct} 100`}
      />
    </svg>
  );
}
export function Ring({
  value,
  children,
  className = "",
}: {
  value: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`ring ${className}`}
      style={vars({ "--v": Math.min(100, Math.max(0, value)) })}
    >
      {children}
    </div>
  );
}
export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
export function SpeakButton({ text }: { text: string }) {
  return (
    <button
      className="btn btn-icon btn-glass"
      aria-label={`${t("setDetail.speak")} ${text}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        speak(text);
      }}
    >
      <SpeakerHigh weight="regular" />
    </button>
  );
}
export function WordRow({ word, setId }: { word: WordEntry; setId: string }) {
  const record = useLearningStore((s) => s.record);
  return (
    <div className="w">
      <Link
        className="head"
        href={`/app/sets/${setId}/words/${encodeURIComponent(word.wordKey)}`}
      >
        <span className="hw font-latin">{word.word}</span>
        <span className="pos">{word.senses[0]?.pos}</span>
        <span className="zh">{word.senses[0]?.meaningZh}</span>
      </Link>
      <Dial
        value={familiarity(
          record,
          word.senses.map((s) => s.id),
        )}
      />
      <SpeakButton text={word.word} />
    </div>
  );
}
export function EmptyLibrary() {
  return (
    <section className="tile empty">
      <BookOpenText size={96} weight="regular" />
      <h2 className="t-section">{t("redesign.empty")}</h2>
      <Link className="btn btn-lg btn-primary" href="/app/sets/new">
        {t("library.newSet")}
      </Link>
    </section>
  );
}
