import { expect, it } from "vitest";
import { isAppOrigin } from "../src/agent/origins";

const env = { APP_ORIGIN: "https://lexiro.vercel.app", EXTRA_APP_ORIGINS: "https://lexiro-beta.vercel.app, https://other.test" };

it("accepts the production app origin", () => {
  expect(isAppOrigin(env, "https://lexiro.vercel.app")).toBe(true);
});

it("accepts an extra origin from the list", () => {
  expect(isAppOrigin(env, "https://lexiro-beta.vercel.app")).toBe(true);
});

it("rejects an origin outside the list", () => {
  expect(isAppOrigin(env, "https://evil.test")).toBe(false);
});

it("rejects a missing origin", () => {
  expect(isAppOrigin(env, null)).toBe(false);
});

it("accepts only the production origin when no extras are set", () => {
  expect(isAppOrigin({ APP_ORIGIN: "https://lexiro.vercel.app" }, "https://lexiro-beta.vercel.app")).toBe(false);
});
