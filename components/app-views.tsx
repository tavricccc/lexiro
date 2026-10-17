"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AgentConnectionsPage } from "@/components/agent/connections-page";
import { FocusCanvas } from "@/components/home/focus-canvas";
import { AiSetOrganizer } from "@/components/library/ai-set-organizer";
import { LibraryPage } from "@/components/library/library-page";
import { SetEditor } from "@/components/library/set-editor";
import { SetMetadata } from "@/components/library/set-metadata";
import { SetSenseSupplement } from "@/components/library/set-sense-supplement";
import { SetToolPage } from "@/components/library/set-tool-page";
import { SetView } from "@/components/library/set-view";
import { SetWordAddition } from "@/components/library/set-word-addition";
import { SharedSetPage } from "@/components/library/shared-set-page";
import { WordEditPage } from "@/components/library/word-edit-page";
import {
  AdminAccountEditor,
  AdminAccountList,
} from "@/components/me/admin-accounts";
import { AdminPanel } from "@/components/me/admin-panel";
import { AdminSettings } from "@/components/me/admin-settings";
import { AdminUsage } from "@/components/me/admin-usage";
import { DataSection } from "@/components/me/data-section";
import { MePage } from "@/components/me/me-page";
import { MeSubpage } from "@/components/me/me-subpage";
import { PlanSection } from "@/components/me/plan-section";
import { PreferencesSection } from "@/components/me/preferences-section";
import { PracticePage } from "@/components/practice/practice-page";
import { QuestionBankPage } from "@/components/questions/question-bank-page";
import { QuestionEditor } from "@/components/questions/question-editor";
import { QuestionGenerator } from "@/components/questions/question-generator";
import { ReadingEditor } from "@/components/questions/reading-editor";
import { RootPageHeader } from "@/components/root-page-header";
import { RoomPage } from "@/components/rooms/room-page";
import { RoomSetupPage, RoomsPage } from "@/components/rooms/rooms-page";
import { SyncPage } from "@/components/sync/sync-page";
import { EmptyState } from "@/components/ui/page-state";
import { setViewHostMounted } from "@/lib/app-navigation";
import { readBrowseReturn } from "@/lib/browse-routes";
import { t } from "@/lib/i18n";

type Query = URLSearchParams;
type Screen = (params: string[], query: Query) => ReactNode;

const param = (query: Query, name: string) => query.get(name) ?? undefined;

/**
 * Every screen under /app, by the shape of its address. A segment written as
 * `*` is a parameter, handed to the screen in order.
 */
const SCREENS: ReadonlyArray<readonly [pattern: string, screen: Screen]> = [
  [
    "",
    () => (
      <>
        <RootPageHeader title={t("nav.study")} />
        <FocusCanvas />
      </>
    ),
  ],
  [
    "practice",
    (_, query) => {
      const track = query.get("track");
      return (
        <PracticePage
          initialSet={query.get("set") ?? ""}
          initialTrack={
            track === "words" || track === "questions" ? track : undefined
          }
        />
      );
    },
  ],
  [
    "library",
    (_, query) => (
      <LibraryPage
        key={`${query.get("folderId") ?? ""}:${query.get("q") ?? ""}`}
        initialFolderId={param(query, "folderId")}
        initialQuery={param(query, "q")}
      />
    ),
  ],
  [
    "sets/new",
    (_, query) => <SetEditor initialFolderId={param(query, "folderId")} />,
  ],
  [
    "sets/new/organize",
    (_, query) => <AiSetOrganizer initialFolderId={param(query, "folderId")} />,
  ],
  [
    "sets/*",
    ([setId], query) => (
      <SetView
        key={`${setId}:${query.get("tab") ?? "words"}:${query.get("q") ?? ""}`}
        setId={setId}
        returnTo={readBrowseReturn(param(query, "returnTo"))}
        initialTab={param(query, "tab")}
        initialQuery={param(query, "q")}
      />
    ),
  ],
  [
    "sets/*/add",
    ([setId]) => (
      <SetToolPage setId={setId} title={t("setEditor.addWord")}>
        <SetWordAddition setId={setId} />
      </SetToolPage>
    ),
  ],
  [
    "sets/*/settings",
    ([setId]) => (
      <SetToolPage setId={setId} title={t("wordEdit.metadata")}>
        <SetMetadata setId={setId} />
      </SetToolPage>
    ),
  ],
  [
    "sets/*/supplement",
    ([setId]) => (
      <SetToolPage setId={setId} title={t("supplement.title")}>
        <SetSenseSupplement setId={setId} />
      </SetToolPage>
    ),
  ],
  [
    "sets/*/words/*/edit",
    ([setId, wordKey], query) => {
      const returnHref = readBrowseReturn(param(query, "returnTo"));
      return (
        <SetToolPage
          setId={setId}
          title={t("setDetail.editWord")}
          returnHref={returnHref}
        >
          <WordEditPage
            setId={setId}
            wordKey={wordKey}
            returnHref={returnHref}
          />
        </SetToolPage>
      );
    },
  ],
  [
    "shared/*",
    ([shareId]) => <SharedSetPage key={shareId} shareId={shareId} />,
  ],
  [
    "questions",
    (_, query) => {
      const filters = {
        q: param(query, "q"),
        kind: param(query, "kind"),
        difficulty: param(query, "difficulty"),
      };
      return (
        <QuestionBankPage
          key={`${filters.q ?? ""}:${filters.kind ?? ""}:${filters.difficulty ?? ""}`}
          initialFilters={filters}
        />
      );
    },
  ],
  [
    "questions/generate",
    (_, query) => <QuestionGenerator setId={param(query, "set")} />,
  ],
  [
    "questions/*/edit",
    ([questionId], query) => (
      <QuestionEditor
        key={questionId}
        questionId={questionId}
        returnHref={readBrowseReturn(param(query, "returnTo"))}
      />
    ),
  ],
  [
    "questions/reading/*/edit",
    ([readingId], query) => (
      <ReadingEditor
        key={readingId}
        readingId={readingId}
        returnHref={readBrowseReturn(param(query, "returnTo"))}
      />
    ),
  ],
  ["rooms", () => <RoomsPage />],
  ["rooms/new", () => <RoomSetupPage />],
  ["rooms/*", ([code]) => <RoomPage key={code} code={code.toUpperCase()} />],
  ["sync", () => <SyncPage />],
  ["me", () => <MePage />],
  ["me/agents", () => <AgentConnectionsPage />],
  [
    "me/preferences",
    () => (
      <MeSubpage title={t("me.preferences")}>
        <PreferencesSection />
      </MeSubpage>
    ),
  ],
  [
    "me/plan",
    () => (
      <MeSubpage title={t("managed.planTitle")}>
        <PlanSection />
      </MeSubpage>
    ),
  ],
  [
    "me/data",
    () => (
      <MeSubpage title={t("settings.data")}>
        <DataSection />
      </MeSubpage>
    ),
  ],
  [
    "me/admin",
    () => (
      <MeSubpage title={t("managed.admin")}>
        <AdminPanel />
      </MeSubpage>
    ),
  ],
  [
    "me/admin/accounts",
    () => (
      <MeSubpage
        parentHref="/app/me/admin"
        parentLabel={t("managed.admin")}
        title={t("admin.accounts")}
      >
        <AdminAccountList />
      </MeSubpage>
    ),
  ],
  [
    "me/admin/accounts/*",
    ([uid]) => (
      <MeSubpage
        parentHref="/app/me/admin/accounts"
        parentLabel={t("admin.accounts")}
        title={t("admin.editAccount")}
      >
        <AdminAccountEditor key={uid} accountUid={uid} />
      </MeSubpage>
    ),
  ],
  [
    "me/admin/settings",
    () => (
      <MeSubpage
        parentHref="/app/me/admin"
        parentLabel={t("managed.admin")}
        title={t("admin.settings")}
      >
        <AdminSettings />
      </MeSubpage>
    ),
  ],
  [
    "me/admin/usage",
    () => (
      <MeSubpage
        parentHref="/app/me/admin"
        parentLabel={t("managed.admin")}
        title={t("admin.usage")}
      >
        <AdminUsage />
      </MeSubpage>
    ),
  ],
];

/** Finds the screen for a pathname; literal segments win over parameters. */
export function matchScreen(pathname: string) {
  const segments = pathname
    .replace(/^\/app\/?/u, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  let best: { screen: Screen; params: string[]; score: number } | null = null;
  for (const [pattern, screen] of SCREENS) {
    const parts = pattern ? pattern.split("/") : [];
    if (parts.length !== segments.length) continue;
    const params: string[] = [];
    let score = 0;
    const matches = parts.every((part, index) => {
      if (part === "*") {
        params.push(segments[index]);
        return true;
      }
      score += 1;
      return part === segments[index];
    });
    if (matches && (!best || score > best.score))
      best = { screen, params, score };
  }
  return best && { screen: best.screen, params: best.params };
}

/**
 * Every screen under /app, drawn from the address bar. Links inside change
 * the address in place, so moving between screens never waits on the server.
 */
export function AppViews() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    setViewHostMounted(true);
    return () => setViewHostMounted(false);
  }, []);

  // Each new screen starts at the top, as a fresh page load did.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const match = matchScreen(pathname);
  if (!match)
    return (
      <EmptyState
        title={t("common.notFoundTitle")}
        description={t("common.notFoundDescription")}
      />
    );
  return (
    <div key={pathname} className="contents">
      {match.screen(match.params, new URLSearchParams(search.toString()))}
    </div>
  );
}
