# Arkadios Home Office

A complete browser-local internal coordination showcase for the journey **Prospect → Onboarding → Implementation → Training → Relationship**. Built with Next.js App Router, strict TypeScript, Tailwind CSS, Zustand, shadcn-style Radix primitives, Lucide, TanStack Table, React Hook Form/Zod, Recharts, and Papa Parse. Uses system fonts and bundled assets. There are no API routes, Server Actions, databases, authentication services, or live integrations.

## Run

Node.js 22+ and npm are required (verified with Node 24).

```sh
npm install
npm run dev
# http://localhost:3001
```

For the production static export:

```sh
npm run build
npm start
# Serves out/ at http://localhost:3001
# Or deploy out/ to any ordinary static web host.
```

`PORT=4000 npm start` selects another production preview port. For development, `npm run dev -- --port 4000` overrides the default. Stop the development server before starting the production preview on the same port. The small Node preview script only serves static assets; it does not implement an application backend or write records.

```sh
npm run typecheck
npm run lint
npm test
npm run format
```

## Workspace and data

- All twelve workspace areas are implemented: Command Center, firms, contacts, pipeline, tasks, projects, communications, documents, reports, workload, SOPs, and settings.
- Global search covers firms, contacts, tasks, and projects. `⌘/Ctrl K` opens it; Escape closes dialogs. Mobile navigation supports Escape, focus restoration, and keyboard containment.
- The department selector scopes each supported screen. Team Workload always restricts Managers to their own department. Reports label which measures use the reporting period and which are current snapshots.
- Table searches, sorting, pagination, filtered CSV exports, archive/restore, saved firm views, bulk task assignment, and contact CSV mapping/validation/duplicate handling all use live records.
- Contact CSV supports quoted commas, escaped quotes, and configured custom fields. Firm association can be a name or ID. Vendors may have no firm. Imports preview errors and require confirmation before committing; exports escape spreadsheet formulas.
- Seed JSON contains 8 departments, 50 fictional employees, 67 firms, 700 external contacts, and linked tasks, projects, documents, messages, reviews, activities, stage histories, and published SOPs. All emails use example.com.
- The seed stage distribution is 14 / 6 / 5 / 4 / 38. Counts and health indicators are calculated from records, including after edits and imports.
- `src/data/seed.json` is bundled initial data. Browser actions never modify it. `scripts/generate-seed.py` reproducibly regenerates it for development.
- First initialization shifts the seed’s relative dates to the browser’s local calendar date and records that anchor. Due dates use local calendar dates; events use ISO timestamps. Settings provides an explicit demo date and a one-day advance action.

## Personas and permissions

Use the clearly labeled **Viewing as** selector. All active internal employees can be selected; external contacts are never login accounts.

| Persona      | Role                         | Useful demonstration                                     |
| ------------ | ---------------------------- | -------------------------------------------------------- |
| Avery Morgan | Admin                        | Complete journey, SOP publishing, settings, import/reset |
| Jordan Ellis | Manager, Relationship Ops.   | Department firms, handoff approvals, and workload        |
| Olivia Chen  | Member, Business Development | Assigned prospect records and own work                   |
| Sam Rivera   | Read-only                    | Shared records, disabled mutation controls               |

The centralized policy in `src/lib/permissions.ts` is applied both to UI controls and the local command service. **Client-side permissions are not real authorization or security.** Anyone with browser developer tools can inspect or modify local data. This is a single-browser product demonstration, not a production multiuser system. No arbitrary employee-count limit is imposed.

## Demonstrate the connected journey

1. Select **Avery Morgan · Admin**. Add a firm from Firm Partners. It starts in Prospect with the latest published SOP tasks.
2. Open its Contacts tab, add a contact, and designate it primary.
3. In Checklist, update each requirement in dependency order. Set status to Completed, supply the completion note or meeting date as required, and save. The verified-contact step checks the actual primary contact record.
4. Review handoff and approve Onboarding. New tasks and a fictional partner agreement appear automatically.
5. Add a conversation from the firm’s Communications tab. Open it, send a clearly labeled demo reply or internal note, and create a follow-up task.
6. In Documents, open the agreement. Simulate a request, then simulate signer completion twice. The status progresses Sent → Partially signed → Signed. Preview/download uses a real bundled sample document.
7. Complete the onboarding checklist and approve Implementation. Exactly one implementation project is created, reusing its existing workflow tasks. Review its milestones and task-derived progress.
8. Complete the Implementation and Training requirements in dependency order, approving each handoff. Direct stage editing and skipping are rejected.
9. Enter Relationship. Initial quarterly and annual reviews, plus an agreement renewal date, are scheduled. Schedule/edit a review, complete it with outcome notes, and create a follow-up. Completing a recurring review schedules its successor once.
10. In Workflows & SOPs, edit a draft, add/reorder steps, set dependencies/evidence/assignments/offsets, and publish. Version history shows immutable snapshots and instance counts. Create another prospect: it uses the new version. Existing firms retain their original snapshots and stage targets.
11. Reload. Records, configuration, and the active persona persist.
12. In Settings → Demo controls, export the complete JSON dataset. Reset with confirmation, then choose the backup or paste its JSON, validate, and confirm replacement. **View export JSON** also supports inspection/copying in embedded browsers that do not expose native downloads.

For a quick seeded demo: **Harborline Advisors** is ready for an approval; **Northgate Wealth** has a partially signed agreement; **Ironwood Trust** is blocked and retains onboarding v1; **Vantage Point Capital** has an implementation project; **Larkspur Advisory** has upcoming relationship work.

## Persistence, recovery, and automation

Zustand persist uses the versioned `arkadios-home-office-v1` localStorage key. Explicit hydration renders a consistent loading screen until saved records are validated; it does not flash seed totals first. Saved state and imported JSON receive runtime schema and reference validation. Invalid imports are transactional and leave the current dataset unchanged. The importer limits dataset size, validates IDs, stages, statuses, assignments, dependency references/cycles, and immutable workflow snapshots, and requires confirmation before replacing data.

Malformed saved data is preserved while a recovery screen offers recovery download, backup import, or confirmed reset. Storage write failures show a visible warning and retain changes in memory; export a backup before leaving and retry saving when storage is available. No browser-local data syncs to other devices or coworkers.

Rules run on hydration, demo date advancement, and relevant mutations. They notify managers about overdue tasks, notify owners about stage targets and approaching renewals, request human handoff approval, and create implementation projects. Notifications, projects, workflow tasks, and recurring reviews use stable deduplication keys. **Rules and report schedules do not run while the browser is closed.** Report-delivery configuration is a local simulation.

Selected document bytes are kept only in a session `Map`; localStorage and exports contain metadata only. After reload, the UI explicitly requests the original file again. Four bundled, non-sensitive HTML sample files remain available offline after their assets load. Signature controls only change local status and timestamps; they do not create binding signatures. Salesforce, Zendesk, and the e-signature provider show simulated references and sync activity; no third-party request or email is sent.

## Structure

```text
src/app/                 Static App Router routes and global styles
src/components/          Workspace shell, tables, forms, drawers, confirmations
src/components/ui/       Accessible shadcn-style Radix primitives
src/features/            Domain screens, SOP editor, settings, backup controls
src/lib/model.ts         Strict domain types and Zod schemas
src/lib/repository.ts    Typed transactional local command boundary
src/lib/engine.ts        Stage entry, assignments, handoffs, deduplicated rules
src/lib/permissions.ts   Shared permission policy
src/lib/selectors.ts     Health, readiness, checklist progress, totals
src/lib/validation.ts    Dataset/workflow/reference validation
src/lib/store.ts         Explicit hydration, versioned persistence, recovery
src/lib/dates.ts         Shared local calendar/demo clock utilities
src/data/seed.json       Normalized fictional initial records
public/samples/          Previewable/downloadable fictional documents
tests/domain.test.ts     Focused domain invariants and connected journey
scripts/serve-static.mjs Static export preview only
```

The local repository boundary can be replaced by a future API implementation. A real deployment would require server-enforced authorization, durable shared storage, validated file handling, background processing, and actual integration contracts.

## Verification

Domain tests cover seed integrity, stage gating/evidence/dependencies, service-level permission enforcement, complete lifecycle/signature/review flow, task/project deduplication, SOP snapshots, dependency cycles/assignments, invalid-import preservation, local-rule idempotence, and future-only target changes.

The implementation was also exercised in the browser through the full five-stage journey, simulated signatures and document preview, review completion/follow-up, a persisted demo reply, SOP publishing/new-version selection, JSON export/reset/reimport, role controls, keyboard/Escape behavior, and responsive desktop/mobile views. No normal-use browser errors were observed. Native download-event monitoring in the embedded test browser was unavailable; the full JSON text export/import path was verified instead.

No reference PDF was attached, so visual implementation follows the supplied brief.
