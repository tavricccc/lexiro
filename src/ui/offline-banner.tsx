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

/** Offline the app still reads and practises; editing waits for the network. */
export function OfflineBanner() {
  const online = useOnline();
  const pending = usePendingAnswers();
  if (online) return null;
  return (
    <div className="bar-in sticky top-0 z-30 flex items-center justify-center gap-2 bg-caution/15 px-4 py-2 pt-[calc(var(--safe-top)+0.5rem)] text-sm text-caution md:pt-2" role="status">
      <CloudSlash aria-hidden className="size-4" weight="bold" />
      <span>離線中：可以瀏覽和練習，編輯要等連線{pending ? `；${pending} 筆作答待上傳` : ""}</span>
    </div>
  );
}
