import { useIsAdministrator } from "@/components/me/use-is-administrator";
import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import {
  CloudCheck,
  ArrowsClockwise,
  Database,
  Info,
  Moon,
  Palette,
  PlugsConnected,
  ShieldCheck,
  SignOut,
  Stack,
  Target,
  Trash,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { useLearningStore } from "@/stores/learning-store";
import { syncStatusLabel } from "@/lib/sync-status";
import { DataSection } from "@/components/me/data-section";
import { AgentConnectionsPage } from "@/components/agent/connections-page";
import { AdminPage } from "@/components/me/admin-page";
import { AppUpdateSection } from "@/components/me/app-update-section";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const groups = [
  ["account", "redesign.account", UserCircle],
  ["study", "redesign.study", Target],
  ["look", "redesign.appearance", Palette],
  ["agent", "redesign.agents", PlugsConnected],
  ["data", "redesign.data", Database],
  ["about", "redesign.about", Info],
  ["admin", "redesign.admin", ShieldCheck],
] as const;
export function SettingsDialog({
  open,
  onClose,
  initialGroup = "account",
}: {
  open: boolean;
  onClose: () => void;
  initialGroup?: string;
}) {
  const admin = useIsAdministrator();
  const [group, setGroup] = useState(initialGroup);
  const [confirm, setConfirm] = useState(false);
  const [failure, setFailure] = useState("");
  const cloud = useCloudStore();
  const learning = useLearningStore();
  const { theme, setTheme } = useTheme();
  const [oneSense, setOneSense] = useState(
    () => localStorage.getItem("lexiro:one-sense") !== "0",
  );
  useEffect(() => {
    if (open) setGroup(initialGroup);
  }, [open, initialGroup]);
  const name = cloud.user?.displayName || t("me.guestName");
  const run = (action: () => Promise<void>) => {
    setFailure("");
    void action().catch((e) =>
      setFailure(e instanceof Error ? e.message : String(e)),
    );
  };
  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="scrim">
            <Dialog.Content
              className="sheet settings"
              aria-describedby={undefined}
            >
              <Dialog.Title className="sr-only">
                {t("redesign.settings")}
              </Dialog.Title>
              <div className="settings-nav" role="tablist">
                <div className="rowx" style={{ padding: 12 }}>
                  <span className="avatar">{name[0]}</span>
                  <b>{name}</b>
                </div>
                {groups.filter(([id]) => id !== "admin" || admin).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={group === id}
                    onClick={() => setGroup(id)}
                  >
                    <Icon weight="regular" />
                    {t(label)}
                  </button>
                ))}
              </div>
              <Dialog.Close
                className="btn btn-icon btn-glass settings-close only-wide"
                aria-label={t("redesign.close")}
              >
                <X weight="bold" />
              </Dialog.Close>
              <div className="settings-body">
                <div className="sheet-head">
                  <h2>{t("redesign.settings")}</h2>
                  <Dialog.Close
                    className="btn btn-icon btn-glass"
                    aria-label={t("redesign.close")}
                  >
                    <X weight="bold" />
                  </Dialog.Close>
                </div>
                <section
                  className="group"
                  data-on={group === "account" ? "" : undefined}
                >
                  <h3>{t("redesign.account")}</h3>
                  <div className="paper account">
                    <span className="avatar">{name[0]}</span>
                    <b className="grow">{name}</b>
                  </div>
                  <div className="paper">
                    {cloud.user ? (
                      <>
                        <button
                          className="srow"
                          onClick={() => run(cloud.signOut)}
                        >
                          <span className="sicon">
                            <SignOut />
                          </span>
                          {t("redesign.signOut")}
                        </button>
                        <button
                          className="srow"
                          style={{ color: "var(--wrong)" }}
                          onClick={() => setConfirm(true)}
                        >
                          <span className="sicon">
                            <Trash />
                          </span>
                          {t("redesign.deleteAccount")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="srow"
                        onClick={() => run(cloud.signIn)}
                      >
                        <span className="sicon">
                          <UserCircle />
                        </span>
                        {t("redesign.signIn")}
                      </button>
                    )}
                  </div>
                  <h3>{t("redesign.sync")}</h3>
                  <div className="paper">
                    <div className="srow">
                      <span className="sicon">
                        <CloudCheck />
                      </span>
                      {t("redesign.cloud")}
                      <span className="v">
                        {syncStatusLabel(cloud.status, cloud.pending)}
                      </span>
                    </div>
                    <button
                      className="srow"
                      onClick={() =>
                        run(() => cloud.sync({ reconcileAccount: true }))
                      }
                    >
                      <span className="sicon">
                        <ArrowsClockwise />
                      </span>
                      {t("redesign.syncNow")}
                    </button>
                  </div>
                </section>
                <section
                  className="group"
                  data-on={group === "study" ? "" : undefined}
                >
                  <h3>{t("redesign.study")}</h3>
                  <div className="paper">
                    <div className="srow">
                      <span className="sicon">
                        <Target />
                      </span>
                      {t("redesign.goal")}
                      <span className="tabs">
                        {([10, 20, 30] as const).map((goal) => (
                          <button
                            className="latin"
                            key={goal}
                            aria-selected={learning.record.goal === goal}
                            onClick={() => learning.setGoal(goal)}
                          >
                            {goal}
                          </button>
                        ))}
                      </span>
                    </div>
                    <div className="srow">
                      <span className="sicon">
                        <Stack />
                      </span>
                      {t("redesign.oneSense")}
                      <button
                        className="switch"
                        role="switch"
                        aria-label={t("redesign.oneSense")}
                        aria-checked={oneSense}
                        onClick={() => {
                          localStorage.setItem(
                            "lexiro:one-sense",
                            oneSense ? "0" : "1",
                          );
                          setOneSense(!oneSense);
                        }}
                      />
                    </div>
                  </div>
                  {learning.error && <p role="alert">{learning.error}</p>}
                </section>
                <section
                  className="group"
                  data-on={group === "look" ? "" : undefined}
                >
                  <h3>{t("redesign.appearance")}</h3>
                  <div className="paper">
                    <div className="srow">
                      <span className="sicon">
                        <Moon />
                      </span>
                      {t("redesign.theme")}
                      <span className="tabs">
                        {(["system", "light", "dark"] as const).map((value) => (
                          <button
                            key={value}
                            aria-selected={theme === value}
                            onClick={() => setTheme(value)}
                          >
                            {t(`redesign.${value}`)}
                          </button>
                        ))}
                      </span>
                    </div>
                  </div>
                </section>
                <section
                  className="group"
                  data-on={group === "agent" ? "" : undefined}
                >
                  <h3>{t("redesign.agents")}</h3>
                  <div className="settings-content">
                    <AgentConnectionsPage />
                  </div>
                </section>
                <section
                  className="group"
                  data-on={group === "data" ? "" : undefined}
                >
                  <h3>{t("redesign.data")}</h3>
                  <DataSection />
                </section>
                <section
                  className="group"
                  data-on={group === "about" ? "" : undefined}
                >
                  <h3>{t("redesign.about")}</h3>
                  <div className="paper">
                    <div className="srow">
                      <span className="sicon">
                        <Info />
                      </span>
                      {t("redesign.version")}
                      <span className="v latin">2.0.0</span>
                    </div>
                  </div>
                  <AppUpdateSection />
                </section>
                <section
                  className="group"
                  data-on={group === "admin" ? "" : undefined}
                >
                  <h3>{t("redesign.admin")}</h3>
                  {admin && <AdminPage />}
                </section>
                {failure && <p role="alert">{failure}</p>}
              </div>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("redesign.deleteAccount")}
        description={t("redesign.deleteConfirm")}
        onConfirm={cloud.deleteAccount}
      />
    </>
  );
}
