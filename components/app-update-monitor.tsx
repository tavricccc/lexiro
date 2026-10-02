"use client";

import { useEffect } from "react";
import { createAppUpdateController } from "@/lib/app-update";
import { useAppUpdateStore } from "@/stores/app-update-store";
import { useCloudStore } from "@/stores/cloud-store";
import { flushAccountDataActions } from "@/src/lib/account-data-queue";
import { flushLibraryMutations } from "@/stores/library-store";
import { flushLearningMutations } from "@/stores/learning-store";
import { flushAiPreferenceMutations } from "@/stores/ai-preferences-store";

const UPDATE_CHECK_INTERVAL = 5 * 60_000;

export function AppUpdateMonitor() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    const workers = navigator.serviceWorker;
    const initialController = workers.controller;
    let disposed = false;
    let controller: ReturnType<typeof createAppUpdateController> | null = null;
    let lastCheck = 0;
    const check = () => {
      if (
        !navigator.onLine ||
        !controller ||
        useAppUpdateStore.getState().available
      )
        return;
      lastCheck = Date.now();
      void controller.check();
    };
    const connection = () => {
      useAppUpdateStore.setState({ online: navigator.onLine });
      if (navigator.onLine) check();
    };
    const returned = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastCheck >= UPDATE_CHECK_INTERVAL
      )
        check();
    };
    void workers.ready.then((registration) => {
      if (disposed) return;
      controller = createAppUpdateController({
        registration,
        workers,
        initialController,
        online: () => navigator.onLine,
        canRestart: () =>
          window.location.pathname === "/app/me" &&
          useCloudStore.getState().ready,
        persist: async () => {
          await flushAccountDataActions();
          await flushLibraryMutations();
          await flushLearningMutations();
          await flushAiPreferenceMutations();
        },
        reload: () => window.location.reload(),
        changed: (patch) => useAppUpdateStore.setState(patch),
      });
      useAppUpdateStore.setState({
        online: navigator.onLine,
        check: controller.check,
        apply: controller.apply,
      });
      check();
    });
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    document.addEventListener("visibilitychange", returned);
    return () => {
      disposed = true;
      controller?.dispose();
      useAppUpdateStore.setState({ check: null, apply: null, phase: null });
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      document.removeEventListener("visibilitychange", returned);
    };
  }, []);
  return null;
}
