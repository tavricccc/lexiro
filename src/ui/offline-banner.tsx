import { useSyncExternalStore } from "react";
import { CloudSlash } from "@phosphor-icons/react";
import { usePendingAnswers } from "@/data/learning";

const subscribe = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

/** Offline status bar: stark Swiss warning strip. */
export function OfflineBanner() {
  const online = useOnline();
  const pending = usePendingAnswers();
  if (online) return null;
  return (
    <div className="bar-in sticky top-0 z-30 flex items-center gap-2.5 border-b-2 border-caution bg-caution/12 px-5 py-2.5 pt-[calc(var(--safe-top)+0.625rem)] font-mono text-xs font-semibold text-caution md:pt-2.5" role="status">
      <CloudSlash aria-hidden className="size-4 shrink-0" weight="bold" />
      <span>OFFLINE // 可瀏覽與練習，編輯於連線後恢復{pending ? ` · ${pending} 筆待同步` : ""}</span>
    </div>
  );
}
