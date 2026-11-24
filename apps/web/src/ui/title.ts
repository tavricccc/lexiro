import { useEffect } from "react";
import { useScreen } from "./screen";

/** The tab's title follows the screen in use: "單字 · Lexiro". */
export function useDocumentTitle(title: string | undefined) {
  const { active } = useScreen();
  useEffect(() => {
    if (active) document.title = title ? `${title} · Lexiro` : "Lexiro";
  }, [title, active]);
}
