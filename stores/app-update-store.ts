import { create } from "zustand";
import type { AppUpdateSnapshot } from "@/lib/app-update";

interface AppUpdateStore extends AppUpdateSnapshot {
  online: boolean;
  check: (() => Promise<void>) | null;
  apply: (() => Promise<void>) | null;
}

export const useAppUpdateStore = create<AppUpdateStore>(() => ({
  available: false,
  checked: false,
  phase: null,
  error: "",
  online: true,
  check: null,
  apply: null,
}));
