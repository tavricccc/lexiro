import { describe, expect, it, vi } from "vitest";
import {
  createAppUpdateController,
  type AppUpdateSnapshot,
} from "@/lib/app-update";

class Worker extends EventTarget {
  state: ServiceWorkerState = "installed";
  postMessage = vi.fn();
}
class Registration extends EventTarget {
  waiting: Worker | null = new Worker();
  installing: Worker | null = null;
  update = vi.fn(async () => undefined);
}
class Container extends EventTarget {
  controller: Worker | null = new Worker();
}
function setup(firstInstall = false) {
  const registration = new Registration();
  const workers = new Container();
  const state: AppUpdateSnapshot = {
    available: false,
    checked: false,
    phase: null,
    error: "",
  };
  const reload = vi.fn();
  const persist = vi.fn<() => Promise<void>>(async () => undefined);
  const canRestart = vi.fn(() => true);
  const controller = createAppUpdateController({
    registration,
    workers,
    initialController: firstInstall ? null : workers.controller,
    changed: (patch) => Object.assign(state, patch),
    online: () => true,
    canRestart,
    reload,
    persist,
  });
  return {
    controller,
    registration,
    workers,
    state,
    reload,
    persist,
    canRestart,
  };
}

describe("user-controlled app updates", () => {
  it("waits for storage before activation, and for control before reloading exactly once", async () => {
    const app = setup(true);
    let finishSaving!: () => void;
    app.persist.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSaving = resolve;
        }),
    );
    const worker = app.registration.waiting!;
    const updated = app.controller.apply();
    expect(app.state.phase).toBe("saving");
    expect(worker.postMessage).not.toHaveBeenCalled();
    await app.controller.apply();
    expect(app.persist).toHaveBeenCalledOnce();
    finishSaving();
    await updated;
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(app.reload).not.toHaveBeenCalled();
    app.workers.dispatchEvent(new Event("controllerchange"));
    expect(app.reload).not.toHaveBeenCalled();
    app.registration.waiting = null;
    app.workers.controller = worker;
    app.workers.dispatchEvent(new Event("controllerchange"));
    app.workers.dispatchEvent(new Event("controllerchange"));
    expect(app.reload).toHaveBeenCalledOnce();
    app.controller.dispose();
  });
  it("offers restart after another tab activates an update, without interrupting this tab", async () => {
    const app = setup();
    app.registration.waiting = null;
    app.workers.controller = new Worker();
    app.workers.dispatchEvent(new Event("controllerchange"));
    expect(app.state.available).toBe(true);
    expect(app.reload).not.toHaveBeenCalled();
    await app.controller.apply();
    expect(app.persist).toHaveBeenCalledOnce();
    expect(app.reload).toHaveBeenCalledOnce();
    app.controller.dispose();
  });
  it.each(["storage failed", "left update page"])(
    "does not activate or restart when %s",
    async (reason) => {
      const app = setup();
      if (reason === "storage failed")
        app.persist.mockRejectedValueOnce(new Error("儲存失敗"));
      else app.canRestart.mockReturnValue(false);
      await app.controller.apply();
      expect(app.reload).not.toHaveBeenCalled();
      expect(app.registration.waiting!.postMessage).not.toHaveBeenCalled();
      expect(app.state.phase).toBeNull();
      if (reason === "storage failed")
        expect(app.state.error).toContain("儲存失敗");
      app.controller.dispose();
    },
  );
});
