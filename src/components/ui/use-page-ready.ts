import { useNavigation, useRoute } from "expo-router";
import { useLayoutEffect, useState } from "react";

/** In case a transition never reports, the page still fills in. */
const FALLBACK_MS = { transitionStart: 250, transitionEnd: 700 } as const;

type TransitionEvents = {
  addListener: (event: keyof typeof FALLBACK_MS, listener: () => void) => () => void;
};

/**
 * False until the push or sheet that brought this page in has started (or
 * ended), so building the page never delays the answer to the tap. The system
 * runs the transition itself, so a page may fill in while it plays.
 * A tab's first page has no transition and is ready at once.
 */
export function usePageReady(event: keyof typeof FALLBACK_MS = "transitionStart"): boolean {
  const navigation = useNavigation();
  const route = useRoute();
  const parent = navigation.getParent();
  const first = navigation.getState()?.routes[0]?.key === route.key;
  const immediate = first && (!parent || parent.getState()?.type === "tab");
  const [ready, setReady] = useState(immediate);

  useLayoutEffect(() => {
    if (ready) return;
    const finish = () => setReady(true);
    // A sheet's first page arrives with the sheet, which is its parent's transition.
    const source = (first && parent ? parent : navigation) as unknown as TransitionEvents;
    const unsubscribe = source.addListener(event, finish);
    const timer = setTimeout(finish, FALLBACK_MS[event]);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [event, ready, first, navigation, parent]);

  return ready;
}
