"use client";

import { useEffect } from "react";

import { useCloudStore } from "@/stores/cloud-store";
import { loadAiSettingsState } from "@/src/lib/ai-provider";

/**
 * Starts the application's data.
 *
 * Loading goes through the cloud store and nowhere else, because which account
 * is signed in decides which namespace the Library is read from. Hydrating in
 * parallel with that, as this used to, read whatever namespace happened to be
 * set — the guest one — and raced the account's own load to decide what the
 * workspace showed.
 */
export function LibraryHydrator() {
  const initializeCloud = useCloudStore((store) => store.initialize);
  useEffect(() => {
    void Promise.all([initializeCloud(), loadAiSettingsState()]);
  }, [initializeCloud]);
  return null;
}
