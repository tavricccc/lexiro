import { useEffect, useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { Button, ListGroup, ListRow, Panel } from "design-kit";
import { Brand } from "@/ui/brand";
import { Page } from "@/ui/page";

type Update = "checking" | "current" | "ready" | "unsupported";

/** A new version installs in the background and waits; this screen lets it take over. */
function useUpdate() {
  const [state, setState] = useState<Update>("checking");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) { setState("unsupported"); return; }
    let cancelled = false;
    void navigator.serviceWorker.getRegistration().then(async (registration) => {
      if (!registration) { if (!cancelled) setState("unsupported"); return; }
      const settle = () => {
        if (cancelled) return;
        setWaiting(registration.waiting);
        setState(registration.waiting ? "ready" : "current");
      };
      registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", settle));
      await registration.update().catch(() => undefined);
      settle();
    });
    return () => { cancelled = true; };
  }, []);
  const apply = () => {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  };
  return { state, apply };
}

export default function AboutPage() {
  const { state, apply } = useUpdate();
  return (
    <Page back={{ href: "/app/me", label: "我" }} title="關於 Lexiro">
      <Panel className="grid justify-items-center gap-2 py-8 text-center">
        <Brand />
        <p className="text-sm text-ink-muted">把背單字變成每天的小習慣。</p>
        <p className="font-latin text-[0.8125rem] text-ink-faint">版本 {__APP_VERSION__}</p>
      </Panel>
      <ListGroup title="更新">
        <ListRow
          label={{ checking: "正在檢查更新…", current: "已是最新版本", ready: "有新版本可以更新", unsupported: "這個瀏覽器不支援離線更新" }[state]}
          trailing={state === "ready" ? <Button onClick={apply} size="sm" variant="primary"><ArrowsClockwise weight="bold" />更新並重新載入</Button> : undefined}
        />
      </ListGroup>
    </Page>
  );
}
