import { t } from "./i18n";

export interface AppUpdateSnapshot {
  available: boolean;
  checked: boolean;
  phase: "checking" | "saving" | "restarting" | null;
  error: string;
}

interface UpdateWorker extends EventTarget {
  state: ServiceWorkerState;
  postMessage: (message: { type: "SKIP_WAITING" }) => void;
}
interface UpdateRegistration extends EventTarget {
  waiting: UpdateWorker | null;
  installing: UpdateWorker | null;
  update: () => Promise<unknown>;
}
interface UpdateContainer extends EventTarget {
  controller: UpdateWorker | null;
}
interface UpdateHost {
  registration: UpdateRegistration;
  workers: UpdateContainer;
  initialController: UpdateWorker | null;
  online: () => boolean;
  canRestart: () => boolean;
  persist: () => Promise<void>;
  reload: () => void;
  changed: (patch: Partial<AppUpdateSnapshot>) => void;
}

/** Observe updates without reloading a working tab or activating a waiting worker. */
export function createAppUpdateController(host: UpdateHost) {
  const { registration, workers, changed } = host;
  let previousController = host.initialController;
  let restartReady = Boolean(
    previousController &&
    workers.controller &&
    workers.controller !== previousController,
  );
  let checking = false;
  let applying = false;
  let requestedReload = false;
  let requestedWorker: UpdateWorker | null = null;
  let disposed = false;
  let installing: UpdateWorker | null = null;

  const inspect = () =>
    changed({
      available: Boolean(registration.waiting) || restartReady || applying,
    });
  const controlled = () => {
    const newVersion =
      previousController !== null &&
      workers.controller !== null &&
      workers.controller !== previousController;
    if (newVersion) restartReady = true;
    previousController = workers.controller;
    inspect();
    if (
      !requestedReload ||
      (!newVersion && workers.controller !== requestedWorker)
    )
      return;
    requestedReload = false;
    requestedWorker = null;
    if (host.online() && host.canRestart()) host.reload();
    else {
      applying = false;
      changed({ phase: null });
    }
  };
  const installed = () => {
    inspect();
    if (installing?.state === "installed") {
      checking = false;
      changed({
        checked: true,
        ...(!applying ? { phase: null } : {}),
        error: "",
      });
    }
    if (installing?.state === "redundant") {
      checking = false;
      applying = false;
      requestedReload = false;
      requestedWorker = null;
      inspect();
      changed({ phase: null, error: t("appUpdate.installFailed") });
    }
  };
  const found = () => {
    installing?.removeEventListener("statechange", installed);
    installing = registration.installing;
    installing?.addEventListener("statechange", installed);
    if (!applying) {
      checking = true;
      changed({ phase: "checking" });
    }
    installed();
  };
  registration.addEventListener("updatefound", found);
  workers.addEventListener("controllerchange", controlled);
  if (registration.installing) found();
  inspect();

  const check = async () => {
    if (disposed || checking || applying) return;
    if (!host.online()) {
      changed({ error: t("appUpdate.offline") });
      return;
    }
    checking = true;
    changed({ phase: "checking", error: "" });
    try {
      await registration.update();
      if (disposed) return;
      if (registration.installing && registration.installing !== installing)
        found();
      inspect();
      if (!registration.installing) {
        checking = false;
        changed({ checked: true, phase: null });
      }
    } catch {
      if (disposed) return;
      checking = false;
      changed({ phase: null, error: t("appUpdate.checkFailed") });
    }
  };
  const apply = async () => {
    if (disposed || applying || checking) return;
    if (!host.online()) {
      changed({ error: t("appUpdate.offline") });
      return;
    }
    applying = true;
    changed({ phase: "saving", error: "" });
    try {
      await host.persist();
      if (disposed) return;
      if (!host.online() || !host.canRestart()) {
        applying = false;
        changed({ phase: null });
        return;
      }
      changed({ phase: "restarting" });
      if (restartReady) {
        host.reload();
        return;
      }
      if (!registration.waiting) throw new Error(t("appUpdate.installFailed"));
      requestedReload = true;
      requestedWorker = registration.waiting;
      requestedWorker.postMessage({ type: "SKIP_WAITING" });
    } catch (reason) {
      if (disposed) return;
      applying = false;
      requestedReload = false;
      requestedWorker = null;
      inspect();
      changed({
        phase: null,
        error:
          reason instanceof Error ? reason.message : t("appUpdate.applyFailed"),
      });
    }
  };

  return {
    check,
    apply,
    dispose() {
      disposed = true;
      registration.removeEventListener("updatefound", found);
      workers.removeEventListener("controllerchange", controlled);
      installing?.removeEventListener("statechange", installed);
    },
  };
}
