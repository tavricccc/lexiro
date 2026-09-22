"use client";

import { useState } from "react";

export function useAdminPagination() {
  const [history, setHistory] = useState<string[]>([]);
  return {
    cursor: history.at(-1),
    hasPrevious: history.length > 0,
    next: (cursor: string) => setHistory((entries) => [...entries, cursor]),
    previous: () => setHistory((entries) => entries.slice(0, -1)),
  };
}
