"use client";

import { BLANK_TOKEN_PATTERN } from "@/src/lib/question-formats";

export interface AnsweredBlank {
  answer: string;
}

/**
 * The passage as it appears on a real paper: the blanks are numbered boxes in
 * the running text, and the one being answered is picked out so the reader can
 * find their place without re-counting from the top.
 */
export function PassageView({
  activeBlank,
  activeBlankId,
  answeredBlanks = {},
  passage,
}: {
  activeBlank?: number;
  activeBlankId?: string;
  answeredBlanks?: Record<number, AnsweredBlank>;
  passage: string;
}) {
  const parts: Array<string | number> = [];
  let cursor = 0;
  for (const match of passage.matchAll(BLANK_TOKEN_PATTERN)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push(passage.slice(cursor, at));
    parts.push(Number(match[1]));
    cursor = at + match[0].length;
  }
  if (cursor < passage.length) parts.push(passage.slice(cursor));

  return (
    <p className="question-text max-w-[72ch] whitespace-pre-line text-base leading-[1.9] text-foreground selection:bg-primary/20 sm:text-[1.0625rem]">
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <span
            className={
              part === activeBlank
                ? "mx-1 inline-flex min-w-14 scroll-mt-6 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-0.5 align-baseline text-sm font-semibold tabular-nums text-primary-foreground"
                : answeredBlanks[part]
                  ? "mx-1 inline-flex items-baseline gap-1.5 border-b border-primary/40 px-1 text-primary"
                  : "mx-1 inline-flex min-w-14 items-center justify-center rounded-md border border-dashed px-2 py-0.5 align-baseline text-sm tabular-nums text-muted-foreground"
            }
            id={part === activeBlank ? activeBlankId : undefined}
            key={index}
          >
            <span
              className={
                answeredBlanks[part] ? "text-xs tabular-nums" : undefined
              }
            >
              {part}
            </span>
            {answeredBlanks[part]?.answer}
          </span>
        ),
      )}
    </p>
  );
}
