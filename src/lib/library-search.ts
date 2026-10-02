import type { LibraryState } from "@/types";

/** Search only the senses that a set actually displays and exports. */
export function setMatchesQuery(
  state: LibraryState,
  setId: string,
  needle: string,
) {
  return (state.memberships[setId] ?? []).some((membership) => {
    const word = state.words[membership.wordKey];
    return (
      word?.word.toLocaleLowerCase().includes(needle) ||
      word?.senses.some(
        (sense) =>
          membership.senseIds.includes(sense.id) &&
          (sense.meaningZh.toLocaleLowerCase().includes(needle) ||
            sense.examples.some((example) =>
              example.toLocaleLowerCase().includes(needle),
            )),
      )
    );
  });
}
