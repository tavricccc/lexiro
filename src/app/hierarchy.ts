import { routeDirection } from "design-kit";

/**
 * Where a screen sits in the app. The five destinations are level 0 and only
 * cross-fade between each other, as tabs do; each step into a set, a word,
 * a question or a subpage of 我 goes one level deeper and is pushed in over
 * the screen it came from.
 */
const TABS = new Set(["library", "progress", "rooms", "me"]);
const KEYED = new Set(["sets", "words", "questions", "rooms"]);

export function screenLevel(pathname: string): number {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "app") parts.shift();
  const units: string[] = [];
  for (let index = 0; index < parts.length; index++) {
    // A collection and its id are one step: /sets/:id is the set's screen.
    if (KEYED.has(parts[index]) && parts[index + 1]) units.push(`${parts[index]}/${parts[++index]}`);
    else units.push(parts[index]);
  }
  if (!units.length) return 0;
  return units.length - 1 + (TABS.has(units[0]) ? 0 : 1);
}

/**
 * 1 when the new screen goes deeper (pushed in from the right), -1 when it
 * goes back up (the parent returns from the left), 0 between screens on the
 * same level, which cross-fade.
 */
export const travelDirection = (from: string, to: string) => routeDirection(screenLevel(from), screenLevel(to));

/**
 * The screen a path is drawn on. A word opens as a sheet over its set, so
 * both paths are one screen and moving between them does not re-enter it.
 */
export const screenKey = (pathname: string) => pathname.replace(/^(\/app\/sets\/[^/]+)\/words\/[^/]+$/, "$1");
