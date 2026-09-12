"use client";

import { useEffect } from "react";

import { useCloudStore } from "@/stores/cloud-store";

/**
 * Starts the application's data.
 *
 * Loading goes through the cloud store and nowhere else, because which account
 * is signed in decides which namespace everything is read from. Hydrating in
 * parallel with that, as this used to for the Library and then again for the AI
 * settings, read whatever namespace happened to be set — the guest one — and
 * raced the account's own load to decide what the workspace showed.
 */
export function LibraryHydrator() {
  const initializeCloud = useCloudStore((store) => store.initialize);
  useEffect(() => {
    void initializeCloud();
  }, [initializeCloud]);
  return null;
}
