# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                  # ng serve, dev server at localhost:4200 (uses environment.ts + local Firebase Emulator Suite)
npm run emulators             # firebase emulators:start (Auth/Firestore/Storage/Functions) — run alongside `npm start`
npm run build               # production build -> dist/trovalim/browser
npm run watch                # build --watch --configuration development
npm test                   # karma/jasmine unit tests (Chrome launcher)
npm run deploy               # ng build --configuration production && firebase deploy --project prod (live)
npm run deploy:preview          # ng build --configuration development && deploy to a Firebase Hosting preview channel on prod (temp URL, expires in 7d)
```

**Single live Firebase project** (`geovana-trovalim-prod`, aliased as `prod`/`default` in `.firebaserc`), plus `legacy` → `ellen-cavalcanti` (old project, kept as a read-only backup after the 2026-08 migration — no longer deployed to). There used to be a second cloud project (`geovana-trovalim-dev`) for testing changes safely; that was replaced by the local **Firebase Emulator Suite** (`npm run emulators`, config in `firebase.json`'s `emulators` block) for day-to-day dev, and by **Hosting preview channels** (`npm run deploy:preview`) for sharing a live-URL preview before merging to prod. Both `environment.ts` and `environment.prod.ts` now point at the same `geovana-trovalim-prod` Firebase config — `environment.ts` additionally sets `useEmulators: true`, which `firebase.providers.ts` only honors when running on `localhost`/`127.0.0.1`, so any deployed build (including preview channels) always talks to the real prod backend. **Important:** a preview-channel deploy is hosting-only isolation — Firestore/Storage/Functions behind it are the real prod data, since it's the same project. Don't use preview channels to test destructive or data-mutating changes; use the emulator for that. Hosting site is `trovalim` on the old legacy project; the current project serves on its default `*.web.app` domain (no custom domain configured yet). Deploy targets can be scoped:

```bash
firebase deploy --only hosting --project prod
firebase deploy --only firestore:rules --project prod
firebase deploy --only functions --project prod   # requires Blaze plan
```

Cloud Functions live in `functions/` as a **separate npm package** (own `package.json`, plain CommonJS, no build step) — run `npm install` inside `functions/` before deploying or editing. It uses `firebase-admin` + `firebase-functions` v2 (`onCall`).

There is no lint script configured. No test files exist beyond the default `app.spec.ts` scaffold.

## Architecture

Angular 20 standalone-components app (no NgModules) backed entirely by Firebase (Auth, Firestore, Storage, Cloud Functions). No custom backend server — all business logic is either client-side (guarded by Firestore Security Rules) or in the small set of Cloud Functions under `functions/` for operations that require the Admin SDK (currently: deleting a user from Firebase Authentication, since the client SDK can only delete the signed-in user).

### Roles and routing

Three roles, stored as a string on the account doc: `owner`, `manager`, `client` (see `normRole`/`isStaffRole` in `src/app/core/auth.service.ts`). Routes are gated by `staffGuard` (owner/manager) or `portalGuard` (client) in `src/app/core/guards.ts`:

- `/` — public marketing site (`home/`)
- `/login`
- `/portal`, `/portal/:id` — client-facing project portal (`portal/portal-home`, `portal/portal-project`)
- `/admin`, `/admin/projeto/:id`, `/admin/clientes`, `/admin/clientes/:id`, `/admin/contas`, `/admin/config` — staff admin area
- `/404` (wildcard `**` redirects here)

### Data model (Firestore)

- `/users/{uid}` — `UserAccount`. Role, and for clients an optional `companyId` pointing at `/empresas/{id}`. A client account with no `companyId` is an "unlinked" account waiting to be attached to a company.
- `/empresas/{id}` — `Empresa` (a client company). Owns `branding` (name/color/logo) and a `storageLimitMb`/`storageUsageBytes` pair. Multiple `/users` accounts (collaborators) can share one `companyId`, all inheriting that company's branding/storage limits at runtime via `AuthService.withCompanyData$`.
- `/projects/{id}` — `Project`. `ownerId` points at an `Empresa` id (or is `null` if unassigned). Has `steps: TimelineStep[]` embedded (no per-step id — matched by array index, so reordering matters) and subcollections `messages/`, `files/`, `internal/notes` (internal notes are a separate doc specifically so client-side reads of the project doc never leak staff-only content).
- `/settings/{platformSettings|projectStatusSettings|storageSettings|storageUsage}` — global platform config (branding color, configurable project status list, per-type file-size limits, running total storage usage counter).

Storage usage is maintained as an **incremental counter** (`increment()` on upload/delete in `ProjectsService.bumpUsage`), not computed on read — both a per-company counter (`empresas/{id}.storageUsageBytes`) and a global one (`settings/storageUsage`).

### Security model

`firestore.rules` mirrors the role/ownership logic that also exists in TypeScript (`isStaffRole`, `managerCanAccessProject`, etc.) — when changing access rules, both places need to agree. Key rules to know:
- Only `owner` can create/delete `/users` docs or change `role`/`projectAccess`; managers can otherwise edit accounts.
- A manager's `projectAccess` field (if set, non-null) restricts which projects they can read/write.
- A client can read/write a project's `messages`/`files` only if they own it (`ownerId` matches their `companyId`) and the project isn't `hidden`; they may only **delete** files where `uploadedByRole == 'client'` (i.e. their own uploads), never staff-uploaded files.
- Storage rules (`storage.rules`) are a separate file and must be kept consistent with the Firestore-side upload/size-limit logic in `StorageSettingsService`.

### Cross-cutting patterns

- **Firebase DI**: all Firebase SDK handles (`Auth`, `Firestore`, `Storage`, `Functions`) are provided as injection tokens in `src/app/core/firebase.providers.ts` via `provideFirebase()`, not imported ad hoc.
- **RxJS↔Signals**: components read Firestore data via `*.service.ts` observables (thin wrappers in `firestore-rx.ts` around `onSnapshot`), converted to signals with `toSignal(...)` at the component level; mutations are plain `async` methods that call the service directly (no NgRx/store).
- **Best-effort Cloud Function calls**: client code that depends on a Cloud Function (e.g. `AccountsService.deleteAccount` calling `deleteAccountAuth`) treats the function call as best-effort — Firestore state changes proceed even if the function call fails, since Cloud Functions may not be deployed/billable in every environment. Follow this pattern for new Cloud Functions rather than making the client hard-depend on them.
- **Branding propagation**: a company's `branding` (color/logo) is looked up live and threaded through to whatever it's displayed on (project header, portal, message bubbles) rather than duplicated — see `AuthService.withCompanyData$` and the `ownerAccount`/`empresa` signals in the admin project/client components.
- **Company/project deletion cascades**: deleting an `Empresa` or a `Project` is destructive and cascades (deletes Storage files, subcollections, etc.) — see `ProjectsService.deleteProject` and the delete flow in `admin-client.component.ts`, which lets the operator choose per-linked-item whether to delete or just unlink before removing the parent.

## Known issues / pitfalls

- **`AccountsService.createAccount()` leaks into real prod Auth even when testing against the emulator.** It opens a *secondary* Firebase app (`initializeApp(environment.firebase, 'Secondary-...')`) so creating a new account doesn't swap out the admin's own session — but that secondary app's `Auth` instance is built with a bare `getAuth(secondaryApp)` and never gets `connectAuthEmulator(...)` called on it, unlike the primary app's `FIREBASE_AUTH` token in `firebase.providers.ts`. Net effect: clicking "Nova Conta" while running `npm start` + `npm run emulators` creates the Firestore `/users` doc in the emulator (fine), but calls `createUserWithEmailAndPassword` against the **real** `geovana-trovalim-prod` Authentication — a real login gets created in production every time this is tested locally.
  - Confirmed while testing on 2026-08-25: created a `mentorado@trovalim.local` test account through the UI against the emulator, and it could not be found when logging into the emulator afterward — consistent with the account having actually landed in real Auth instead.
  - **Action needed, not yet done**: check the [Firebase Console → Authentication](https://console.firebase.google.com/project/geovana-trovalim-prod/authentication/users) for stray test accounts (at minimum `mentorado@trovalim.local`) and delete them by hand.
  - **Fix, not yet applied**: the secondary app's `Auth` instance needs the same `shouldUseEmulators()` / `connectAuthEmulator(...)` treatment as the primary one in `firebase.providers.ts` — pull that emulator-detection logic into a small shared helper both call.
  - This same secondary-app pattern is also used for anything else in `accounts.service.ts` that spins up a throwaway Firebase app — audit for the same gap before relying on emulator isolation for those paths too.

- **`npm install` needs `--legacy-peer-deps`.** `@angular/service-worker@20.3.29` (added for PWA support) pins an exact peer on `@angular/core@20.3.29`, while the rest of the `@angular/*` packages resolve to `20.3.27` — a real, harmless patch-version skew, but npm's default resolver refuses to install over it (ERESOLVE loop). Run `npm install --legacy-peer-deps` instead of a bare `npm install` until the `@angular/*` versions catch up to each other.

- **`computer{action:"left_click", ref:...}` can silently no-op on this app's buttons in the sandboxed preview browser**, even with a fresh `read_page` ref and correct coordinates (no error thrown, click just doesn't reach the Angular handler — confirmed 2026-08-25 clicking "Excluir dado" in `/admin/lgpd` twice with no effect). Dispatching a real DOM click via `javascript_tool` (`document.querySelectorAll('button')` → find by text → `.click()`) worked reliably every time in the same session. When a `computer` click on this app seems to do nothing, don't assume the app is broken — retry with a scripted `.click()` before concluding there's a bug.

- **Service Worker registration can't be verified from a sandboxed preview/proxy browser.** `fetch('/ngsw-worker.js')` succeeds (200, correct MIME) but `navigator.serviceWorker.register(...)` itself fails with a generic `TypeError: ... An unknown error occurred when fetching the script` when the app is opened through an embedded/proxied preview browser (observed 2026-08-25 testing PWA support via a local static server through Claude Code's Browser pane). This reproduces even registering the exact same URL that `fetch` just proved reachable, so it's a limitation of that browser sandbox's networking (SW registration uses a different network path than page `fetch`), not an app bug. Verify PWA installability/offline behavior in a real browser tab (or `ng serve`'s production-equivalent build served normally) instead of relying on an embedded preview for this specific check.
