const WORD_CHAR = /[A-Za-z0-9]/;

/** Whole-word occurrences, including complete multiword answer spans. */
export function wordOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const found: number[] = [];
  const lowerHay = haystack.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  let from = 0;
  for (;;) {
    const at = lowerHay.indexOf(lowerNeedle, from);
    if (at === -1) return found;
    const before = at === 0 ? "" : haystack[at - 1];
    const after = haystack[at + needle.length] ?? "";
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) found.push(at);
    from = at + 1;
  }
}
