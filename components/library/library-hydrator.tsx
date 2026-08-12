"use client";

import { useEffect } from "react";

import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";
import { useCloudStore } from "@/stores/cloud-store";

export function LibraryHydrator() {
  const hydrate = useLibraryStore((store) => store.hydrate);
  const hydrateLearning = useLearningStore((store) => store.hydrate);
  const initializeCloud = useCloudStore((store) => store.initialize);
  useEffect(() => { void Promise.all([hydrate(), hydrateLearning(), initializeCloud()]); }, [hydrate, hydrateLearning, initializeCloud]);
  return null;
}
