import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n";

describe("translations", () => {
  it("interpolates values", () => {
    expect(t("home.wordCount", { count: 12 })).toBe("12 個單字");
  });
});
