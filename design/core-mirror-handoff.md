# Core mirror handoff

The sibling repository required by AGENTS.md, `C:/Users/Tavric/projects/lexiro-app`, is absent in this workspace. No mirror destination was invented or created. When that checkout is available, run its documented `scripts/sync-core.mjs` workflow and review these changed platform-free sources:

- `src/lib/learning-record.ts` (new pure learning functions/types)
- `src/types/library.ts` (optional set hue/icon)
- `src/lib/share.ts` and `src/lib/set-share.ts` (appearance survives normalization and copies)
- `components/practice/use-practice-session-actions.ts` now has a web store integration; mirror the pure learning module and adapt the host integration in the app rather than copying its Zustand import blindly.
- Formatting-only changes in other `components/practice` files do not change their domain behavior.

Device-local learning records intentionally have no Worker API or cross-device synchronization contract. Set appearance travels in existing set records. Live Worker acceptance of optional set payload properties was not exercised against a deployed server.
