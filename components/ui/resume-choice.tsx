import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "radix-ui";
import { FocusCanvas } from "@/components/home/focus-canvas";

import { t } from "@/lib/i18n";
import { holdRouteSheet } from "@/lib/navigation-memory";

export function ResumeChoice({
  back,
  description: _description,
  header: _header = true,
  invalid = false,
  onRestart,
  onResume,
}: {
  back?: ReactNode;
  description: string;
  header?: boolean;
  invalid?: boolean;
  onRestart: () => void;
  onResume: () => void;
}) {
  const started = useRef(false);
  useLayoutEffect(holdRouteSheet, []);
  useEffect(() => { if (invalid && !started.current) { started.current = true; onRestart(); } }, [invalid,onRestart]);
  if (invalid) return null;
  return <><div className="resume-background">{back}<FocusCanvas /></div><Dialog.Root open><Dialog.Portal><Dialog.Overlay className="scrim"><Dialog.Content className="sheet resume-dialog" aria-describedby={undefined}><Dialog.Title className="t-section">{t("draft.title")}</Dialog.Title><div className="resume-actions"><Button onClick={onRestart} variant="secondary">{t("draft.restart")}</Button><Button onClick={onResume}>{t("draft.resume")}</Button></div></Dialog.Content></Dialog.Overlay></Dialog.Portal></Dialog.Root></>;
}
