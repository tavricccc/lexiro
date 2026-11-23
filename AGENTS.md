This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Lexiro specifics (learned the hard way)

- After pulling any of the three repos (`lexiro-app`, `../lexiro`, `../lexiro-worker`), run `npm ci` there before checks.
- `src/core` mirrors the web repo's pure contract and domain logic (`../lexiro/packages/contract/src` → `src/core/contract`, `../lexiro/src/domain` → `src/core/domain`) via `scripts/sync-core.mjs`. Change the web file first, then run `node scripts/sync-core.mjs`.
- Data layer lives in `src/data/` (Worker REST API, Firebase Auth with PKCE `/app-auth`, TanStack Query + AsyncStorage cache, `expo-network` offline awareness, offline learning answer queue, prefs sync, WebSocket room client).
- This repo has no test runner. Checks: `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform ios` (bundle smoke test).
- Distribution: `.github/workflows/ios-ipa.yml` builds an unsigned .ipa for sideloading; `.github/workflows/eas-update.yml` publishes every push to main as an EAS Update on channel `production` (needs the `EXPO_TOKEN` repo secret). `runtimeVersion` uses the fingerprint policy, so a change to native code or native config only reaches the phone through a new .ipa; JS-only changes arrive over the air. expo-updates is off in development and Expo Go. `src/lib/app-updates.ts` checks on foreground and applies a downloaded update after ten minutes away.
- A sense `description` holds one point per line (`\n`), with no bullets or numbers typed in; screens render it with `DescriptionPoints` (`src/components/ui/description-points.tsx`) and `descriptionPoints()` from `@/core/contract`. `meaning` is only the Chinese meaning, because it is shown as an answer option.
- A set lists its words A to Z with `compareWords()` from `@/core/contract`; membership order carries no meaning.
- iPad: phones stay portrait, while the iPad may rotate (`UISupportedInterfaceOrientations~ipad` in `app.json`; changing it is native config, so it ships only in a new .ipa). Pages keep a reading column through `Screen` (`CONTENT_MAX_WIDTH`); a screen that is not a `Screen`, such as the practice session or live rooms, constrains itself the same way. `useSplitView()` (a window at least 960pt wide) puts a reading passage beside its question.
- Speech (`src/lib/speech.ts`) runs only from a speak button, never on its own, and uses its own iOS audio session (`useApplicationAudioSession: false`) so it is heard with the ring switch on silent.
- Haptics (`src/lib/haptics.ts`) centralizes tactile feedback across buttons, segmented controls, starring, swipes, practice answers, and room countdowns.
- Sync (`src/data/queries.ts`, mirrored in the web's `src/data/queries.ts`): every library index read goes through `fetchLibrary`, which refetches only the cached sets whose `updatedAt` moved. Writes go through `write()` in `src/data/library.ts`, which patches the cache from the Worker's answer; the `Lexiro-Revision-Before`/`Lexiro-Revision` headers tell a device's own write from another's, so its own changes are never downloaded again. Starred words come from `GET /starred`. Never call `queryClient.clear()` while screens are mounted: it cancels their reads silently and leaves them spinning; reset the cache as `resetCache()` does.
- Sheets: in a `formSheet` route the scroll view must be the screen's first native view (a fragment of `SheetHeader` and `Screen`, footers after it and absolute, `KeyboardScreen mode="layout"`). Nested in a `View`, react-native-screens moves it out of sight while the sheet is dragged. `modal` routes have no such rule.
- Sharing: the share code is the last part of the link. Read it from any input with `parseShareCode()` from `@/core/contract`; adding goes through `POST /shared/:code/add`, and `openSet()` puts the sheets away and opens the result.
- Scroll hint: a vertically scrolling page shows `ScrollMore` (native glass down arrow) while content is left below. `Screen`/`KeyboardScreen` include it; a bare `ScrollView` page uses `useScrollMore()` (`src/components/ui/scroll-more.tsx`). The practice session splits question and options at 700pt.
- Controls are native on iOS: `Button`/`IconButton` (`src/components/ui/button.tsx`) and `Segmented` are SwiftUI through `@expo/ui`, menus and pickers come from `list.tsx`. A hidden React Native sizer gives a SwiftUI button its size, because `matchContents` reports a size only after the first frame. Pass `ignoreSafeArea="all"` to a `Host` laid out by React Native. Content that is the product (answer tiles, cards, heatmap, word rows) stays React Native.
- Motion: durations, curves and entrances come from `src/components/ui/motion.ts`; never write a duration inline. A tile's state colours fade with `Tone` (`tone.tsx`), since `DynamicColorIOS` colours cannot be interpolated. List rows press through `PressableRow`.
