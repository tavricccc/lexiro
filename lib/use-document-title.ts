import { useEffect } from "react";

/** Names the tab after the page while it is shown, as "Page · Lexiro". */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Lexiro`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
