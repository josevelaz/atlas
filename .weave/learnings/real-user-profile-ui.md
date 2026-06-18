# Learnings: real-user-profile-ui

## Task 1: Add Primary Connected Account storage to the schema
- **Discrepancy**: The startup validation warned that `apps/server/src/db/schema.ts` and the generated `apps/server/drizzle/` file path did not exist, but `schema.ts` already existed and the drizzle directory was present.
- **Resolution**: Verified the existing schema file, added the new `is_primary` column and partial unique index there, then generated the migration into the existing drizzle directory.
- **Suggestion**: Re-run file reference validation against the current workspace before emitting missing-file warnings for existing schema and migration paths.

- **Discrepancy**: The plan described migration against `local.db`, but this workspace applies drizzle migrations through a local `sqld` HTTP endpoint configured in `apps/server/drizzle.config.ts`.
- **Resolution**: Ran `bun run migrate` through the configured `sqld` endpoint and verified the schema/index were applied successfully.
- **Suggestion**: Mention the `sqld`-backed local database flow in plan context so migration verification expectations match the actual server setup.

## Task 2: Connected-accounts service (server)
- **Discrepancy**: Importing the server db layer eagerly would trigger env validation via `config.ts`, which conflicts with the plan's requirement that pure helper logic remain unit-testable without a live Better Auth environment.
- **Resolution**: Kept the pure helpers exportable and isolated db access behind lazy dynamic import plus optional injected db clients for the two query functions.
- **Suggestion**: Call out the existing env-validation side effect in the db module when requesting import-pure service code, so the intended lazy/injectable pattern is explicit.

## Task 3: Identity endpoints (server)
- **Discrepancy**: The plan only specified a 404 mapping for unknown or unowned accounts, but the service distinguishes credential rows as a separate forbidden case.
- **Resolution**: Preserved the typed service behavior and mapped credential-row primary changes to HTTP 403 while still returning 404 for unknown or unowned rows.
- **Suggestion**: Explicitly state whether credential rows should collapse into 404 or remain a separate 403 case at the route layer.

- **Discrepancy**: The plan referenced `apps/server/src/server.ts` as missing, but the server already existed with inline `/me` routing and swagger setup.
- **Resolution**: Extended the existing inline server routes in place and verified the new endpoints through live HTTP requests against the running server.
- **Suggestion**: Refresh file-existence validation and note when verification can reuse an already-running local dev server.

## Task 4: Server unit tests (bun:test)
- **Discrepancy**: The plan asked to cover credential-row exclusion as part of the pure logic, but that behavior lives in the query-layer filter rather than a standalone pure helper.
- **Resolution**: Covered the adjacent observable behavior at the service boundary using injected db stubs, including the credential-row rejection path in `setPrimaryConnectedAccount`.
- **Suggestion**: When a behavior lives in SQL filtering instead of a pure helper, specify whether service-boundary stub tests are acceptable.

## Task 13: CONTEXT.md — define Onboarded
- **Discrepancy**: `CONTEXT.md` already contained adjacent uncommitted glossary edits for `User`, `Primary Connected Account`, and relationship bullets, so the new Onboarded entry landed inside a broader in-flight identity terminology section.
- **Resolution**: Added the Onboarded glossary entry and relationship bullet in-place so the terminology stayed coherent with the surrounding identity definitions.
- **Suggestion**: Note when documentation tasks are expected to layer on top of existing local glossary edits so commit-splitting expectations are clear.

## Task 5: Web identity module — types + fetchers
- **Discrepancy**: The route layer currently returns `primaryConnectedAccountId` as an empty string for users with zero connected OAuth accounts rather than `null` or omitting the field.
- **Resolution**: Mirrored the live server contract exactly in the web types and documented the empty-string case in the identity DTOs.
- **Suggestion**: Specify the zero-account sentinel value explicitly in the plan when a field is required but there may be no concrete record to point at.

- **Discrepancy**: The server exposes a 403 for credential-row primary changes in addition to the plan's documented 404 case.
- **Resolution**: Kept the fetchers generic for non-2xx handling so both 403 and 404 propagate as thrown errors for later UI handling.
- **Suggestion**: Keep client-task acceptance criteria aligned with the final route-layer error contract once server behavior is settled.

## Task 6: Web identity module — solid-query hooks
- **Discrepancy**: The plan phrased `connectedAccountsQueryOptions()` as if it alone could enforce the signed-in gate, but the signed-in state is only available inside the consuming hook.
- **Resolution**: Kept the reusable query-options factory pure and applied the `me.data != null` gate in `useConnectedAccounts()` while preserving the requested key and fetcher wiring.
- **Suggestion**: For query-factory tasks, distinguish what belongs in the static options object versus what must be applied in the hook that has access to other query state.

## Task 7: Auth-aware routing
- **Discrepancy**: The plan assumed SPA-shell prerender behavior, but the current web app is running as full SSR, so server-side `beforeLoad` no-ops would not automatically re-run on hydration for direct URL hits.
- **Resolution**: Added the route guards plus a one-time `router.invalidate()` on mount in `routes/__root.tsx` so guarded routes re-evaluate on the client after hydration without fetching during SSR.
- **Suggestion**: Refresh the plan's rendering-mode assumptions before specifying guard behavior, because SPA prerender and live SSR need different initial-load handling.

- **Discrepancy**: `apps/web/src/routes/__root.tsx` had to change even though it was not listed in the task files, because the hydration-time guard re-run was required to make direct-entry redirects work under the current SSR setup.
- **Resolution**: Extended `__root.tsx` minimally to invalidate matched routes once on mount, then verified signed-out and onboarded redirects against live route behavior.
- **Suggestion**: Mention the root route file in future auth-guard tasks when initial-load behavior may depend on router lifecycle wiring.

## Task 8: Avatar image support
- **Discrepancy**: The Shuttle delegation for this task was cancelled twice before any implementation result was returned, even though local working-tree changes to `mail_row.tsx` were already present.
- **Resolution**: Re-inspected the existing file state, verified the `src` + fallback behavior already met the task, then validated and committed that isolated file without further code edits.
- **Suggestion**: When a delegated task is cancelled mid-flight, inspect for unstaged file changes before treating the work as fully blocked.

## Task 11: Settings — real Connected Account rows
- **Discrepancy**: The original prototype row subtitle included sync recency and thread counts, but the live connected-account DTO only exposes provider identity, email, createdAt, and primary state.
- **Resolution**: Replaced the hardcoded sync metadata with provider labels derived from `providerId`, keeping the rest of the settings sections untouched.
- **Suggestion**: Distinguish cosmetic prototype metadata from live data requirements in the plan so implementers know whether invented placeholder sync text should be preserved or removed.

## Task 9: Bind top bar to User
- **Discrepancy**: The top bar can transiently render before `useUser()` resolves even behind the guard, so simply swapping in live data would risk a visible avatar-layout pop.
- **Resolution**: Bound the top-bar avatar to `useUser()` and used a neutral placeholder glyph while loading or signed out so the chip footprint stays stable until real profile data arrives.
- **Suggestion**: When replacing hardcoded identity chrome with async data, specify whether a loading placeholder should preserve layout or can temporarily disappear.

## Task 10: Settings — Profile section (User-bound)
- **Discrepancy**: The plan requested a persisting editable display name, but protected-route browser automation is unavailable in this workflow, so the implementation had to rely on query-layer behavior and non-route validation instead of programmatic end-to-end interaction.
- **Resolution**: Added the profile section against the shared `['identity','me']` cache, wired `useUpdateDisplayName()` for save + reactive invalidation, and validated the screen through typecheck/lint/build without protected-route automation.
- **Suggestion**: Split route-protected UI behavior from pure component/query wiring in future plans so protected-flow validation constraints do not block straightforward settings-surface work.

## Task 14: Verification pass + commits
- **Discrepancy**: The verification/push delegation was interrupted once and cancelled on retry before any verification report was returned.
- **Resolution**: Marked the final verification task blocked rather than assuming any command, push, or PR state.
- **Suggestion**: When the final verification task is likely to include long-running or interactive steps, prefer a narrower delegated scope and explicitly forbid `bun run dev` unless the user has approved it.

- **Discrepancy**: The final verification checklist originally expected `agent-browser` validation of protected routes, but the user clarified that protected-route browser testing must not be attempted because Google OAuth sign-in is a hard requirement.
- **Resolution**: Re-ran verification without protected-route browser automation, recorded the OAuth-dependent route validation as not executable in this environment, and accepted the non-OAuth-dependent command/grep/build/test results.
- **Suggestion**: Split OAuth-dependent browser validation into a separate manual task with explicit credentials/preconditions instead of making it part of automated final verification.

- **Discrepancy**: `apps/web/src/routeTree.gen.ts` became dirty after a verification build, and the generated-file state disagreed with the first pushed verification commit.
- **Resolution**: Re-delegated a focused cleanup; Shuttle reconciled the generated route tree, reran the web build, pushed `fix(web): align generated route tree with build output`, and confirmed PR #31 remained open.
- **Suggestion**: For generated router files, verify post-build dirty state before declaring commits/push complete.
