import type { FullBackupPayload } from "@/types";
import { useLibraryStore, flushLibraryMutations } from "@/stores/library-store";
import {
  useLearningStore,
  flushLearningMutations,
} from "@/stores/learning-store";
import { serializeAccountDataAction } from "@/src/lib/account-data-queue";
import { createFullBackup } from "@/src/lib/full-backup";
import { getStorageNamespace } from "@/src/lib/persist";
import { t } from "./i18n";

function checkAccount(namespace: string, action: "import" | "export") {
  if (namespace !== getStorageNamespace())
    throw new Error(
      t(
        action === "import"
          ? "settings.backupAccountChanged"
          : "settings.backupExportAccountChanged",
      ),
    );
}

export const importFullBackup = serializeAccountDataAction(
  async (backup: FullBackupPayload, namespace: string) => {
    checkAccount(namespace, "import");
    await useLibraryStore.getState().importState(backup.library);
    try {
      await useLearningStore
        .getState()
        .importBackup(backup.learning, backup.stats);
    } catch (reason) {
      throw new Error(
        t("settings.importLearningFailed", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
        { cause: reason },
      );
    }
  },
);

export const prepareFullBackup = serializeAccountDataAction(
  async (namespace: string) => {
    checkAccount(namespace, "export");
    await flushLibraryMutations();
    await flushLearningMutations();
    const library = useLibraryStore.getState();
    const learning = useLearningStore.getState();
    return createFullBackup(library.state, learning.progress, learning.stats);
  },
);
