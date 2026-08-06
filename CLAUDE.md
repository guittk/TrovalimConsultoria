# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git workflow (read this first)

- **Default working branch is `dev`.** Unless told otherwise, start every session on `dev`, make changes there, and stay there.
- **Never modify `prod` or `main` without asking first.** These two branches are kept in sync with each other and represent what's actually live for the client. If a change seems like it should also apply to `prod` (e.g. a bug fix that isn't tied to a dev-only feature), ask the user before touching that branch — don't assume, don't do it silently.
- **`main` and `prod` are equivalent** — `main` is only updated by fast-forwarding it to `prod` once the user has validated `prod` and explicitly asks for it. Don't merge into `main` on your own initiative.
- **`dev` currently has features that `prod`/`main` intentionally lack**: Mentoria (+ `mentorado` role), Kanban (per-project + general board), the Treinamentos tab, and the Google Calendar integration. These were deliberately excluded from `prod` (see the two "Corrige bugs..." commits' messages for the exact split) — don't assume something missing from `prod` is a bug; it may be an intentional gap awaiting the user's go-ahead to promote it.
- **Auto-commit and auto-deploy**: after making a change on `dev`, commit it and run `npm run deploy:dev` without waiting to be asked, unless the user says otherwise for that turn. Never do the equivalent on `prod`/`main` (commit or `npm run deploy`) without explicit confirmation first.

## Commands

```bash
npm start                  # ng serve, dev server at localhost:4200 (uses environment.ts -> geovana-trovalim-dev)
npm run build               # production build -> dist/trovalim/browser
npm run watch                # build --watch --configuration development
npm test                   # karma/jasmine unit tests (Chrome launcher)
npm run deploy               # ng build --configuration production && firebase deploy --project prod (PROD)
npm run deploy:dev            # ng build --configuration development && firebase deploy --project dev (DEV)
```

Two separate Firebase projects, aliased in `.firebaserc`: `prod` → `geovana-trovalim-prod` (live), `dev` → `geovana-trovalim-dev` (for testing rules/changes safely before they hit prod), plus `legacy` → `ellen-cavalcanti` (old project, kept as a read-only backup after the 2026-08 migration — no longer deployed to). Angular's `environment.ts` (dev) and `environment.prod.ts` (prod) hold each project's `firebaseConfig`, swapped via `fileReplacements` in `angular.json` when building with `--configuration production`. Hosting site is `trovalim` on the old project; the new projects serve on their default `*.web.app` domain (no custom domain configured yet). The `dev` git branch deploys to the `dev` Firebase project; the `prod` (and `main`) git branch deploys to the `prod` Firebase project. Deploy targets can be scoped:

```bash
firebase deploy --only hosting --project prod
firebase deploy --only firestore:rules --project dev   # test a rules change in DEV first
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
