import { describe, expect, it } from "vitest";
import { isAppRedirect } from "@/components/agent/native-app-sign-in";

describe("native app sign-in redirect", () => {
  it("accepts only the app and Expo Go schemes", () => {
    expect(isAppRedirect("lexiroapp://auth")).toBe(true);
    expect(isAppRedirect("exp://192.168.1.5:8081/--/auth")).toBe(true);
    expect(isAppRedirect("https://evil.example/auth")).toBe(false);
    expect(isAppRedirect("javascript:alert(1)")).toBe(false);
    expect(isAppRedirect("not a url")).toBe(false);
  });
});
