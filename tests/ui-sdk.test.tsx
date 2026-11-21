import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createAgent } from "@ui-sdk/react/agent";
import { OTPInput, OTPInputGroup, OTPInputSlot } from "@ui-sdk/react/otp-input";
import { afterEach, expect, test, vi } from "vitest";
import { Segmented, Select, Switch } from "design-kit";

vi.mock("@/data/queries", () => ({
  useLibrary: () => ({
    data: {
      folders: [],
      sets: [{ id: "set-1", name: "TOEFL Core", wordCount: 40, questionCount: 4, hue: "sky", icon: "books", folderId: null, order: 0, updatedAt: "2026-11-21T00:00:00Z" }],
    },
  }),
}));
vi.mock("@/data/prefs", () => ({ savePrefs: vi.fn(async () => {}) }));

const agent = createAgent();

afterEach(cleanup);

function ControlsFixture() {
  const [goal, setGoal] = useState("20");
  const [showMeanings, setShowMeanings] = useState(true);
  const [pos, setPos] = useState("n.");
  const [code, setCode] = useState("");
  return (
    <div>
      <Segmented
        label="每日目標"
        onChange={setGoal}
        options={[{ value: "10", label: "10 題" }, { value: "20", label: "20 題" }, { value: "30", label: "30 題" }]}
        value={goal}
      />
      <Switch aria-label="顯示中文意思" checked={showMeanings} onCheckedChange={setShowMeanings} />
      <Select
        label="詞性"
        onChange={setPos}
        options={[{ value: "n.", label: "名詞 n." }, { value: "v.", label: "動詞 v." }]}
        value={pos}
      />
      <OTPInput aria-label="房間代碼" maxLength={6} onValueChange={setCode} pattern="alphanumeric" value={code}>
        <OTPInputGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => <OTPInputSlot index={index} key={index} />)}
        </OTPInputGroup>
      </OTPInput>
      <output data-testid="state">{`${goal}|${showMeanings}|${pos}|${code}`}</output>
    </div>
  );
}

test("agent bridge discovers and operates ui-sdk controls", async () => {
  render(<ControlsFixture />);

  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
  const labels = entries.map((entry) => entry.label);
  for (const label of ["每日目標", "顯示中文意思", "詞性", "房間代碼"]) {
    expect(labels, `${label} missing from agent snapshot`).toContain(label);
  }

  const result = await agent.act({
    steps: [
      { ref: "每日目標", action: "setValue", args: ["30 題"] },
      { ref: "顯示中文意思", action: "toggle" },
      { ref: "詞性", action: "setValue", args: ["動詞 v."] },
      { ref: "房間代碼", action: "setValue", args: ["AB12CD"] },
    ],
  });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByTestId("state")).toHaveTextContent("30|false|v.|AB12CD");
});

test("command palette opens, filters user sets, and navigates on selection", async () => {
  const { CommandPalette } = await import("@/ui/command-palette");
  const router = createMemoryRouter(
    [
      { path: "/app", element: <CommandPalette /> },
      { path: "/app/sets/:setId", element: <div>set destination</div> },
    ],
    { initialEntries: ["/app"] },
  );
  render(<RouterProvider router={router} />);

  fireEvent.click(screen.getByRole("button", { name: "開啟快速指令" }));
  const search = await screen.findByRole("combobox", { name: "搜尋指令或單字集" });
  fireEvent.change(search, { target: { value: "TOEFL" } });
  const item = await screen.findByRole("option", { name: /TOEFL Core/ });
  fireEvent.click(item);
  await waitFor(() => expect(router.state.location.pathname).toBe("/app/sets/set-1"));
});
