import { useEffect, type ComponentType, type ReactNode } from "react";
import {
  matchRoutes,
  Outlet,
  useLocation,
  useParams,
  useSearchParams,
  type RouteObject,
} from "react-router";

import { EmptyState } from "@/components/ui/page-state";
import { readBrowseReturn } from "@/lib/browse-routes";
import { t } from "@/lib/i18n";

type Query = URLSearchParams;
type Params = Readonly<Record<string, string>>;

const param = (query: Query, name: string) => query.get(name) ?? undefined;

/** Loads both modules a screen is drawn from, in parallel. */
const both = async <A, B>(a: Promise<A>, b: Promise<B>) => {
  const [first, second] = await Promise.all([a, b]);
  return { ...first, ...second };
};

/**
 * A screen whose code is fetched the first time it is visited (or hovered in
 * the navigation). `draw` turns the loaded module, the address parameters and
 * the query into the screen.
 */
function screen<M>(
  load: () => Promise<M>,
  draw: (module: M, params: Params, query: Query) => ReactNode,
): () => Promise<{ Component: ComponentType }> {
  let pending: Promise<{ Component: ComponentType }> | null = null;
  return () =>
    (pending ??= load().then(
      (module) => ({
        Component: function Screen() {
          const params = useParams() as Params;
          const [query] = useSearchParams();
          return draw(module, params, query);
        },
      }),
      // A fetch that failed, say offline, is tried again on the next visit.
      (error: unknown) => {
        pending = null;
        throw error;
      },
    ));
}

/**
 * Every screen under /app, by the shape of its address. A literal segment
 * wins over a parameter, so `sets/new` is never read as a set called "new".
 */
const SCREENS: ReadonlyArray<
  readonly [path: string, lazy: ReturnType<typeof screen>]
> = [
  [
    "",
    screen(
      () =>
        both(
          import("@/components/root-page-header"),
          import("@/components/home/focus-canvas"),
        ),
      ({ RootPageHeader, FocusCanvas }) => (
        <>
          <RootPageHeader title={t("nav.study")} />
          <FocusCanvas />
        </>
      ),
    ),
  ],
  [
    "practice",
    screen(
      () => import("@/components/practice/practice-page"),
      ({ PracticePage }, _, query) => {
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
    ),
  ],
  [
    "library",
    screen(
      () => import("@/components/library/library-page"),
      ({ LibraryPage }, _, query) => (
        <LibraryPage
          key={`${query.get("folderId") ?? ""}:${query.get("q") ?? ""}`}
          initialFolderId={param(query, "folderId")}
          initialQuery={param(query, "q")}
        />
      ),
    ),
  ],
  [
    "sets/new",
    screen(
      () => import("@/components/library/set-editor"),
      ({ SetEditor }, _, query) => (
        <SetEditor initialFolderId={param(query, "folderId")} />
      ),
    ),
  ],
  [
    "sets/:setId",
    screen(
      () => import("@/components/library/set-view"),
      ({ SetView }, { setId }, query) => (
        <SetView
          key={`${setId}:${query.get("tab") ?? "words"}:${query.get("q") ?? ""}`}
          setId={setId}
          returnTo={readBrowseReturn(param(query, "returnTo"))}
          initialTab={param(query, "tab")}
          initialQuery={param(query, "q")}
        />
      ),
    ),
  ],
  [
    "sets/:setId/add",
    screen(
      () =>
        both(
          import("@/components/library/set-tool-page"),
          import("@/components/library/set-word-addition"),
        ),
      ({ SetToolPage, SetWordAddition }, { setId }) => (
        <SetToolPage setId={setId} title={t("setEditor.addWord")}>
          <SetWordAddition setId={setId} />
        </SetToolPage>
      ),
    ),
  ],
  [
    "sets/:setId/settings",
    screen(
      () =>
        both(
          import("@/components/library/set-tool-page"),
          import("@/components/library/set-metadata"),
        ),
      ({ SetToolPage, SetMetadata }, { setId }) => (
        <SetToolPage setId={setId} title={t("wordEdit.metadata")}>
          <SetMetadata setId={setId} />
        </SetToolPage>
      ),
    ),
  ],
  [
    "sets/:setId/questions/:questionId",
    screen(
      () => import("@/components/questions/question-try-page"),
      ({ QuestionTryPage }, { setId, questionId }, query) => (
        <QuestionTryPage
          setId={setId}
          questionId={questionId}
          returnHref={readBrowseReturn(param(query, "returnTo"))}
        />
      ),
    ),
  ],
  [
    "sets/:setId/words/:wordKey",
    screen(
      () => import("@/components/library/word-detail-page"),
      ({ WordDetailPage }, { setId, wordKey }, query) => (
        <WordDetailPage
          setId={setId}
          wordKey={wordKey}
          returnHref={readBrowseReturn(param(query, "returnTo"))}
        />
      ),
    ),
  ],
  [
    "sets/:setId/words/:wordKey/edit",
    screen(
      () =>
        both(
          import("@/components/library/set-tool-page"),
          import("@/components/library/word-edit-page"),
        ),
      ({ SetToolPage, WordEditPage }, { setId, wordKey }, query) => {
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
    ),
  ],
  [
    "shared/:shareId",
    screen(
      () => import("@/components/library/shared-set-page"),
      ({ SharedSetPage }, { shareId }) => (
        <SharedSetPage key={shareId} shareId={shareId} />
      ),
    ),
  ],
  [
    "questions/:questionId/edit",
    screen(
      () => import("@/components/questions/question-editor"),
      ({ QuestionEditor }, { questionId }, query) => (
        <QuestionEditor
          key={questionId}
          questionId={questionId}
          returnHref={readBrowseReturn(param(query, "returnTo"))}
        />
      ),
    ),
  ],
  [
    "questions/reading/:readingId/edit",
    screen(
      () => import("@/components/questions/reading-editor"),
      ({ ReadingEditor }, { readingId }, query) => (
        <ReadingEditor
          key={readingId}
          readingId={readingId}
          returnHref={readBrowseReturn(param(query, "returnTo"))}
        />
      ),
    ),
  ],
  [
    "rooms",
    screen(
      () => import("@/components/rooms/rooms-page"),
      ({ RoomsPage }) => <RoomsPage />,
    ),
  ],
  [
    "rooms/new",
    screen(
      () => import("@/components/rooms/rooms-page"),
      ({ RoomSetupPage }) => <RoomSetupPage />,
    ),
  ],
  [
    "rooms/:code",
    screen(
      () => import("@/components/rooms/room-page"),
      ({ RoomPage }, { code }) => (
        <RoomPage key={code} code={code.toUpperCase()} />
      ),
    ),
  ],
  [
    "sync",
    screen(
      () => import("@/components/sync/sync-page"),
      ({ SyncPage }) => <SyncPage />,
    ),
  ],
  [
    "me",
    screen(
      () => import("@/components/me/me-page"),
      ({ MePage }) => <MePage />,
    ),
  ],
  [
    "admin",
    screen(
      () => import("@/components/admin/admin-page"),
      ({ AdminPage }) => <AdminPage />,
    ),
  ],
  [
    "admin/accounts/:uid",
    screen(
      () => import("@/components/admin/admin-account-page"),
      ({ AdminAccountPage }, { uid }) => (
        <AdminAccountPage key={uid} uid={uid} />
      ),
    ),
  ],
  [
    "me/agents",
    screen(
      () => import("@/components/agent/connections-page"),
      ({ AgentConnectionsPage }) => <AgentConnectionsPage />,
    ),
  ],
  [
    "me/preferences",
    screen(
      () =>
        both(
          import("@/components/me/me-subpage"),
          import("@/components/me/preferences-section"),
        ),
      ({ MeSubpage, PreferencesSection }) => (
        <MeSubpage title={t("me.preferences")}>
          <PreferencesSection />
        </MeSubpage>
      ),
    ),
  ],
  [
    "me/data",
    screen(
      () =>
        both(
          import("@/components/me/me-subpage"),
          import("@/components/me/data-section"),
        ),
      ({ MeSubpage, DataSection }) => (
        <MeSubpage title={t("settings.data")}>
          <DataSection />
        </MeSubpage>
      ),
    ),
  ],
];

export function ScreenNotFound() {
  return (
    <EmptyState
      title={t("common.notFoundTitle")}
      description={t("common.notFoundDescription")}
    />
  );
}

/** The screens under /app, as children of the workspace route. */
export const screenRoutes: RouteObject[] = [
  ...SCREENS.map(([path, lazy]): RouteObject =>
    path ? { path, lazy } : { index: true, lazy },
  ),
  { path: "*", Component: ScreenNotFound },
];

const workspace: RouteObject[] = [{ path: "/app", children: screenRoutes }];

/** Starts fetching the code of the screen at `href`, if it names one. */
export function preloadScreen(href: string) {
  const { pathname } = new URL(href, "http://lexiro.invalid");
  const matches = matchRoutes(workspace, pathname);
  const lazy = matches?.at(-1)?.route.lazy;
  if (typeof lazy === "function") void lazy();
}

/**
 * Hosts the screen at the address bar. Each address is a fresh screen, as a
 * page load was: it starts at the top and keeps no state from the last one.
 */
export function AppViews() {
  const { pathname } = useLocation();

  // Each new screen starts at the top, as a fresh page load did.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div key={pathname} className="contents">
      <Outlet />
    </div>
  );
}
