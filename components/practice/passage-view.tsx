"use client";

import { BLANK_TOKEN_PATTERN } from "@/src/lib/question-formats";

/**
 * The passage as it appears on a real paper: the blanks are numbered boxes in
 * the running text, and the one being answered is picked out so the reader can
 * find their place without re-counting from the top.
 */
export function PassageView({
  activeBlank,
  passage,
}: {
  activeBlank?: number;
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
    <p className="whitespace-pre-line text-[1.0625rem] leading-[2] text-foreground">
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <span
            className={
              part === activeBlank
                ? "mx-1 inline-flex min-w-14 items-center justify-center rounded-md bg-brand-600 px-2 py-0.5 align-middle font-sans text-xs font-semibold tabular-nums text-[var(--primary-foreground)]"
                : "mx-1 inline-flex min-w-14 items-center justify-center rounded-md border border-dashed px-2 py-0.5 align-middle font-sans text-xs tabular-nums text-muted-foreground"
            }
            key={index}
          >
            {part}
          </span>
        ),
      )}
    </p>
  );
}
