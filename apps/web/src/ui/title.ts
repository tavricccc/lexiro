import { useEffect } from "react";

/** The tab's title follows the screen: "單字 · Lexiro". */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Lexiro` : "Lexiro";
  }, [title]);
}
