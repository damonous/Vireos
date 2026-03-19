# Wire Frontend to Backend — Remove All Mock/Placeholder Code

## Context

The current frontend app contains 36 page components under `frontend/src/app/pages/` and is still running as a Figma-style shell: hardcoded names, static KPI arrays, fake async delays, localStorage role spoofing, and no real API-backed state. The backend already exposes most MVP API domains, but several super-admin/platform surfaces are still missing and a few backend flows are still implemented as stubs.

This plan is the wiring plan for the authenticated product UI. It is only complete when:

- Every visible page is reading and mutating real backend state
- No page relies on hardcoded personas, fake API delays, or bypass auth
- Seed data exists only in `backend/prisma/seed.ts` and is loaded through the real API
- Any backend stub that a wired page depends on is replaced with production logic

Seed data for advisor/admin/compliance/super-admin personas is acceptable. Frontend-side mock data, placeholder API calls, and UI-only fake flows are not.

## Requirements Gates

This plan must satisfy the MVP requirements in [DELIVERABLES.md](/home/rbrooks/code/clients/vireos/DELIVERABLES.md), especially:

- Real email/password auth and RBAC
- Compliance-gated content workflow
- Real publishing, campaign, lead, prospect, billing, and analytics flows
- Multi-tenant org isolation
- No demo-only or prototype behavior in production code

This plan does not cover a public marketing website because there is no separate public-site code in `frontend/src`. If marketing-site pages or forms are added later, they need their own backend wiring plan.

## Current Gaps Found During Review

1. The previous plan treated several pages as if supporting APIs already existed. They do not.
   Files affected: [docs/20260310_frontend_backend_wiring_plan.md](/home/rbrooks/code/clients/vireos/docs/20260310_frontend_backend_wiring_plan.md), [backend/src/routes/org.routes.ts](/home/rbrooks/code/clients/vireos/backend/src/routes/org.routes.ts), [backend/src/routes/index.ts](/home/rbrooks/code/clients/vireos/backend/src/routes/index.ts)

2. The previous plan missed whole integration domains already required by the UI and requirements: social OAuth connections, review submit/edit flows, invoices/plans/credit purchase, lead import/assign/bulk actions, and prospect fulfillment/admin workflows.
   Files affected: [backend/src/routes/oauth.routes.ts](/home/rbrooks/code/clients/vireos/backend/src/routes/oauth.routes.ts), [backend/src/routes/review.routes.ts](/home/rbrooks/code/clients/vireos/backend/src/routes/review.routes.ts), [backend/src/routes/billing.routes.ts](/home/rbrooks/code/clients/vireos/backend/src/routes/billing.routes.ts), [backend/src/routes/lead.routes.ts](/home/rbrooks/code/clients/vireos/backend/src/routes/lead.routes.ts), [backend/src/routes/prospect.routes.ts](/home/rbrooks/code/clients/vireos/backend/src/routes/prospect.routes.ts)

3. The previous plan did not call out backend placeholders that would leave the product incomplete even if the frontend were wired: auth/invite/reset email stubs, missing feature-flags/platform-admin APIs, and the Easy Mode credit-balance placeholder.
   Files affected: [backend/src/services/auth.service.ts](/home/rbrooks/code/clients/vireos/backend/src/services/auth.service.ts), [backend/src/services/organization.service.ts](/home/rbrooks/code/clients/vireos/backend/src/services/organization.service.ts), [backend/src/services/agent/agent.service.ts](/home/rbrooks/code/clients/vireos/backend/src/services/agent/agent.service.ts)

## Phase 1: Infrastructure

### 1.1 Frontend dependencies

```bash
cd frontend && npm install @tanstack/react-query @tanstack/react-query-devtools
```

### 1.2 Dev proxy

**File:** `frontend/vite.config.ts`

Add dev proxy rules for:

- `/api/*`
- `/health*`
- `/metrics`

### 1.3 API client

**New file:** `frontend/src/app/lib/api-client.ts`

Requirements:

- Base API prefix: `/api/v1`
- Support non-versioned health endpoints separately: `/health`, `/health/live`, `/health/ready`, `/metrics`
- Auto-attach `Authorization: Bearer <accessToken>` when present
- On `401`, attempt `POST /api/v1/auth/refresh` using stored refresh token
- On refresh failure, clear auth state and redirect to `/login`
- Handle both response shapes used by the backend:
  - `{ success, data }`
  - `{ success, data, meta }`
- Throw a typed `ApiError` for `{ success: false, error }`

Token storage keys:

- `vireos_access_token`
- `vireos_refresh_token`
- `vireos_user`

### 1.4 Auth context

**New file:** `frontend/src/app/contexts/AuthContext.tsx`

```ts
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

Behavior:

- On mount, load tokens and validate with `GET /api/v1/auth/me`
- Persist the normalized user object returned by backend auth
- Remove all frontend-only role spoofing

Role normalization from backend app-layer JWT/user payload:

- `super_admin` -> `super-admin`
- `org_admin` -> `admin`
- `advisor` -> `advisor`
- `viewer` -> `compliance-officer`

### 1.5 Query provider

**File:** `frontend/src/main.tsx`

Wrap app with `QueryClientProvider` and `AuthProvider`.

### 1.6 Shared API types

**New file:** `frontend/src/app/types/api.ts`

Include exact response types for:

- Auth user and organization
- Drafts and review queue entries
- Leads, activities, assignments, imports
- LinkedIn campaigns and enrollments
- Facebook ad campaigns
- Email templates, sequences, steps, enrollments
- Publish jobs
- Prospect requests and previews
- Billing plans, bundles, subscription, invoices, credit balance
- OAuth/social connections
- Audit entries
- Feature flags
- Agent conversations and messages
- Health and metrics

### 1.7 Shared async UI states

**New files:**

- `frontend/src/app/components/ui/empty-state.tsx`
- `frontend/src/app/components/ui/loading-state.tsx`
- `frontend/src/app/components/ui/error-state.tsx`

### 1.8 Route guards

**Files:**

- `frontend/src/app/components/ProtectedLayout.tsx`
- `frontend/src/app/components/Layout.tsx` if retained

Replace all `localStorage.getItem('vireos_role')` routing with `useAuth()`.

### 1.9 Backend contract snapshot

Before wiring pages, document the actual route surface in code comments or a local reference table so frontend hooks are built against real endpoints, not inferred ones.

## Phase 2: Auth and Identity

### 2.1 Login page

**File:** `frontend/src/app/pages/Login.tsx`

- Remove `roles` arrays, quick-login bypass buttons, and any direct role writes to localStorage
- Wire submit to `POST /api/v1/auth/login`
- Hydrate user with `GET /api/v1/auth/me`
- Keep demo-account shortcuts only as credential prefills:
  - `advisor@vireos-demo.com / Password123!`
  - `admin@vireos-demo.com / Password123!`
  - `compliance@vireos-demo.com / Password123!`
  - `super_admin@vireos.ai / Password123!`

### 2.2 Sidebar and shell

**Files:**

- `frontend/src/app/components/Sidebar.tsx`
- `frontend/src/app/components/Layout.tsx` if still used anywhere

- Replace `Sarah Mitchell`, `Pinnacle Financial`, initials, and role strings with `useAuth().user`
- Wire sign-out to `POST /api/v1/auth/logout`
- Build nav visibility from the authenticated role, not hardcoded sections

### 2.3 Password and account flows

**Pages impacted:** `Settings.tsx`, `Login.tsx`

Wire:

- `PATCH /api/v1/auth/change-password`
- `POST /api/v1/auth/forgot-password` when a reset screen is added
- `POST /api/v1/auth/reset-password` when a reset screen is added

Backend follow-up required:

- Replace `EMAIL_STUB` implementations for verification, reset, and invite emails before those flows are called production-ready

## Phase 3: Seed Data and Demo Personas

**File:** `backend/prisma/seed.ts`

Expand seed data so the UI can demonstrate real end-to-end states via backend records only.

Required seeded records:

- 1 demo organization with realistic org settings, disclosures, prohibited terms, billing state
- 4 demo users: super admin, admin, advisor, compliance
- Feature flags needed by the UI and agent:
  - `ai_guardrails`
  - `easy_mode`
  - `linkedin_enabled`
  - `facebook_enabled`
  - `prospect_finder_enabled`
  - `email_sequences_enabled`
- Leads across all lifecycle stages
- Lead activities and assignments
- Drafts across draft/review/approved/rejected/published states
- Review queue and audit history
- LinkedIn campaigns plus enrollments
- Facebook campaigns
- Email templates, sequences, steps, enrollments, sends
- Publish jobs across queued/published/failed/cancelled
- Prospect requests in pending/processing/fulfilled states
- Subscription, invoices if supported locally, credit balance, credit transactions
- OAuth/social connection records where pages need “connected” states
- Agent conversations and messages
- Notifications if the UI exposes them later

Important:

- Seeded data must mirror real Prisma shapes
- No page may carry its own copy of persona data once API wiring starts

## Phase 4: Hooks and API Domains

**New directory:** `frontend/src/app/hooks/`

Required hook groups:

- `useAuth.ts`
- `useAnalytics.ts`
- `useContent.ts`
- `useReviews.ts`
- `useLeads.ts`
- `useLinkedIn.ts`
- `useFacebook.ts`
- `useEmail.ts`
- `usePublishing.ts`
- `useBilling.ts`
- `useOrganizations.ts`
- `useProspects.ts`
- `useOAuth.ts`
- `useAudit.ts`
- `useAgent.ts`
- `useHealth.ts`
- `useFeatureFlags.ts`

Hook coverage must match actual backend routes, including:

- Auth: `/api/v1/auth/*`
- Organizations: `/api/v1/organizations/:orgId*`
- Content drafts: `/api/v1/content/drafts*`
- Reviews: `/api/v1/reviews/*`
- Leads: `/api/v1/leads*`
- Analytics: `/api/v1/analytics/*`
- Publish jobs: `/api/v1/publish*`
- Billing: `/api/v1/billing/*`
- Prospects: `/api/v1/prospects/*` and `/api/v1/admin/prospect-requests/*`
- Email: `/api/v1/email/*`
- Facebook: `/api/v1/facebook/campaigns*`
- LinkedIn: `/api/v1/linkedin/campaigns*`
- OAuth/social connections: `/api/v1/oauth/*`
- Agent: `/api/v1/agent/*`
- Audit: `/api/v1/audit` and `/api/v1/audit-trail`
- Health: `/health*`, `/metrics`

## Phase 5: Page-by-Page Wiring

### Batch 1: Advisor dashboard and analytics

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `Dashboard.tsx` | `GET /api/v1/analytics/overview?preset=7d` | Replace chart/activity/post arrays and hardcoded greeting/org |
| `Analytics.tsx` | `GET /api/v1/analytics/overview`, `/linkedin`, `/facebook`, `/email`, `/leads`, `/prospects` | Replace every static KPI/chart/table with real analytics payloads |
| `AdminHome.tsx` | `GET /api/v1/analytics/overview?preset=30d`, `GET /api/v1/organizations/:orgId/members` | Replace KPI, team, feed, invite success toasts based on real mutation results |
| `TeamReports.tsx` | `GET /api/v1/analytics/overview`, `GET /api/v1/organizations/:orgId/members` | Replace advisor-by-advisor arrays and line/bar chart seeds |
| `ComplianceOfficerHome.tsx` | `GET /api/v1/reviews`, `GET /api/v1/analytics/overview` | Replace queue counts, audit snippets, prohibited-term widgets |
| `ComplianceReports.tsx` | `GET /api/v1/analytics/overview`, plus derived review metrics if available | Replace all static reports; add backend gap if current analytics payload is insufficient |

### Batch 2: Content and compliance workflow

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `AIContent.tsx` | `POST /api/v1/content/generate`, `GET /api/v1/content/drafts`, `PUT /api/v1/content/drafts/:id`, `PATCH /api/v1/reviews/:draftId/submit` | Remove `setTimeout`, sample generated content, static warnings; support generate, edit, submit for review |
| `ComplianceQueue.tsx` | `GET /api/v1/reviews` | Replace hardcoded queue rows |
| `ContentReview.tsx` | `GET /api/v1/reviews/:draftId`, `PATCH /api/v1/reviews/:draftId/approve`, `/reject`, `/request-changes`, `/edit` | Remove demo state matrix and hardcoded review content |
| `PublishingCalendar.tsx` | `GET /api/v1/publish`, `POST /api/v1/publish`, `DELETE /api/v1/publish/:jobId`, `GET /api/v1/content/drafts?status=APPROVED` | Replace calendar/event/content slot arrays; schedule only approved content |

### Batch 3: Leads and prospects

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `LeadManagement.tsx` | `GET /api/v1/leads`, `GET /api/v1/leads/:id`, `POST /api/v1/leads`, `PUT /api/v1/leads/:id`, `PATCH /api/v1/leads/:id/status`, `PATCH /api/v1/leads/:id/assign`, `POST /api/v1/leads/bulk/status`, `POST /api/v1/leads/import` | Remove kanban arrays, random scores, fake toasts; support real CRUD/import/bulk actions |
| `ProspectFinder.tsx` | `GET /api/v1/prospects/requests`, `POST /api/v1/prospects/requests`, `GET /api/v1/billing/credits/balance`, optional `GET /api/v1/analytics/prospects` | Replace fake request list and credit banner |

Super-admin/admin fulfillment coverage required by requirements:

- Prospect fulfillment queue UI must wire to:
  - `GET /api/v1/admin/prospect-requests`
  - `POST /api/v1/admin/prospect-requests/:id/upload`
  - `GET /api/v1/admin/prospect-requests/:id/preview`
  - `POST /api/v1/admin/prospect-requests/:id/confirm`

If no frontend page exists for fulfillment yet, add one or explicitly scope a follow-up task. Requirements treat fulfillment as part of the MVP.

### Batch 4: LinkedIn and social connections

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `LinkedInOutreach.tsx` | `GET /api/v1/linkedin/campaigns`, `POST /api/v1/linkedin/campaigns/:campaignId/activate`, `POST /api/v1/linkedin/campaigns/:campaignId/pause`, `POST /api/v1/linkedin/campaigns/:campaignId/enrollments` | Replace campaign/contact arrays and aggregate stats |
| `LinkedInCampaignBuilder.tsx` | `POST /api/v1/linkedin/campaigns`, `PUT /api/v1/linkedin/campaigns/:campaignId`, `GET /api/v1/leads` | Replace hardcoded defaults and message steps with editable real form state |
| `Settings.tsx` or `OrgSettings.tsx` integrations tab | `GET /api/v1/oauth/connections`, `GET /api/v1/oauth/linkedin`, `GET /api/v1/oauth/facebook`, `DELETE /api/v1/oauth/:platform` | Wire connect/disconnect state instead of static integration toggles |

Important:

- OAuth callback handling must be planned for the frontend redirect flow, even though callbacks terminate on backend routes

### Batch 5: Facebook ads

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `FacebookAds.tsx` | `GET /api/v1/facebook/campaigns`, `POST /api/v1/facebook/campaigns/:campaignId/pause` | Replace campaign arrays and summary cards |
| `FacebookAdWizard.tsx` | `POST /api/v1/facebook/campaigns`, `PUT /api/v1/facebook/campaigns/:campaignId`, `GET /api/v1/email/sequences`, `GET /api/v1/oauth/connections` | Replace defaults, fake preview names, static sequence options |
| `FacebookSubmitted.tsx` | `GET /api/v1/facebook/campaigns/:campaignId` | Replace hardcoded campaign title/status |
| `FacebookCampaignDetail.tsx` | `GET /api/v1/facebook/campaigns/:campaignId`, `POST /api/v1/facebook/campaigns/:campaignId/launch`, `POST /api/v1/facebook/campaigns/:campaignId/pause` | Replace hardcoded metrics/timeline/owner blocks |

### Batch 6: Email marketing

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `EmailCampaigns.tsx` | `GET /api/v1/email/sequences`, `GET /api/v1/email/templates`, `GET /api/v1/analytics/email` | Replace sequences arrays and KPI cards |
| `EmailSequenceBuilder.tsx` | `POST /api/v1/email/sequences`, `PUT /api/v1/email/sequences/:id`, `POST /api/v1/email/sequences/:id/steps`, `POST /api/v1/email/sequences/:id/enroll`, `GET /api/v1/email/templates`, `POST /api/v1/email/templates`, `PUT /api/v1/email/templates/:id` | Replace hardcoded sender name, content, disclaimer examples, template/step defaults |

### Batch 7: Billing and organization settings

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `Billing.tsx` | `GET /api/v1/billing/subscription`, `GET /api/v1/billing/credits/balance`, `GET /api/v1/billing/invoices`, `GET /api/v1/billing/plans`, `POST /api/v1/billing/checkout`, `POST /api/v1/billing/credits/purchase`, `POST /api/v1/billing/portal` | Replace static invoices, plan features, and price copy |
| `Settings.tsx` | `GET /api/v1/auth/me`, `PATCH /api/v1/auth/change-password`, `GET /api/v1/oauth/connections` | Replace hardcoded profile/org/integration/notification values |
| `OrgSettings.tsx` | `GET /api/v1/organizations/:orgId`, `PUT /api/v1/organizations/:orgId` | Replace hardcoded org settings and prohibited terms |
| `ComplianceSettings.tsx` | `GET /api/v1/organizations/:orgId`, `PUT /api/v1/organizations/:orgId` | Use org compliance rules and disclosures from real org data |
| `UserManagement.tsx` | `GET /api/v1/organizations/:orgId/members`, `POST /api/v1/organizations/:orgId/members/invite`, `PUT /api/v1/organizations/:orgId/members/:userId/role`, `DELETE /api/v1/organizations/:orgId/members/:userId` | Replace static user table and fake invite flow |

### Batch 8: Audit and admin

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `AuditTrail.tsx` | `GET /api/v1/audit` or `GET /api/v1/audit-trail` depending on final role/filter model | Replace static entries and advisor filters |
| `SuperAdminHome.tsx` | `GET /api/v1/analytics/overview`, `GET /metrics` | Replace KPI, org list, health blocks; verify analytics supports super-admin scope |
| `SystemHealth.tsx` | `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /metrics` | Replace services arrays and response-time seeds |

Backend gaps to unblock these pages:

- `GET /api/v1/organizations` does not currently exist for a super-admin org list page
- `GET /api/v1/admin/users` does not currently exist for a cross-org user list page

### Batch 9: Super-admin platform pages

| Page | Required backend support | Status |
|------|--------------------------|--------|
| `Organizations.tsx` | Need `GET /api/v1/organizations` list endpoint plus optional create/update actions | Missing backend route |
| `PlatformUsers.tsx` | Need cross-org user listing endpoint with filters/pagination | Missing backend route |
| `PlatformBilling.tsx` | Need cross-org billing summary endpoint or an explicit decision to remove/merge page | Missing backend route |
| `FeatureFlags.tsx` | Need `GET /api/v1/feature-flags` and `PUT/PATCH /api/v1/feature-flags/:id` or org-scoped equivalent | Missing backend route |
| `PlatformSettings.tsx` | Need platform/system settings API, not org settings | Missing backend route |

These pages cannot be honestly marked “wired” until the supporting backend is built or the pages are removed from scope.

### Batch 10: AI agent

| Page | Real endpoints | Required wiring |
|------|----------------|-----------------|
| `Easy.tsx` | `GET /api/v1/agent/conversations`, `GET /api/v1/agent/conversations/:id`, `POST /api/v1/agent/command`, `PATCH /api/v1/agent/conversations/:id/archive` | Remove full mock conversation/message corpus and localStorage user spoofing |

Backend follow-up required:

- `backend/src/services/agent/agent.service.ts` currently uses a placeholder credit-balance fallback and the seed does not currently enable `easy_mode`

## Phase 6: Cleanup Rules

### 6.1 Remove dead mock-only code

- Delete `frontend/src/app/pages/PlaceholderPage.tsx`
- Remove any remaining role-spoofing helpers
- Remove any unused mock-only layout/component utilities

### 6.2 Repository-wide mock hunt

Use `rg`, not `grep`:

```bash
rg -n "localStorage\\.getItem\\('vireos_role'|vireos_user_name|vireos_user_initials" frontend/src
rg -n "setTimeout\\(" frontend/src/app/pages frontend/src/app/components
rg -n "Math\\.random\\(" frontend/src/app/pages frontend/src/app/components
rg -n "Sarah Mitchell|Pinnacle Financial|Firm Admin|Alex Advisor|Casey Compliance" frontend/src
rg -n "const .* = \\[" frontend/src/app/pages
rg -n "demoState|demoNotes|Quick Login|roles = \\[" frontend/src/app/pages
rg -n "EMAIL_STUB|placeholder|stub" backend/src
```

### 6.3 No-placeholder definition

The plan is not complete if any of the following remain in a production path:

- Hardcoded UI records standing in for API data
- `setTimeout` used to simulate backend latency
- Randomly generated stats in place of persisted metrics
- Direct localStorage writes used to impersonate roles or users
- Backend service methods logging “stub” behavior for flows the UI depends on
- Pages whose data model is invented because a real API has not been defined

## Phase 7: Verification and Acceptance

### 7.1 Page-level checks

For every wired page:

- Loads with backend running and authenticated user present
- Renders seeded API data correctly
- Renders proper empty state when no records exist
- Renders loading state during fetch
- Renders backend error state on failure
- All write actions persist and survive page reload
- Role-based restrictions are enforced by both UI and API
- Org scoping is correct for non-super-admin users

### 7.2 End-to-end requirement checks

Before calling this work complete, verify:

- Advisor can log in, generate content, edit it, and submit it for review
- Compliance can review, edit, approve/reject/request changes
- Approved content can be scheduled/published through real publish jobs
- Leads can be created/imported/updated/assigned without fake UI data
- Prospect requests can be submitted and fulfilled through real backend records
- LinkedIn and Facebook pages show real campaign state, not static examples
- Billing pages read real plan/subscription/invoice/credit data
- Super-admin pages are either backed by real APIs or explicitly removed from scope
- Easy Mode chat loads stored conversations and uses the real agent endpoint

### 7.3 Backend gaps that must be resolved before sign-off

- Organization list endpoint for super admin
- Cross-org platform users endpoint
- Platform billing summary endpoint or page removal
- Feature flags API
- Platform settings API
- Invite/reset/verification email delivery implementation
- Agent credit balance placeholder removal

## Execution Order

| Step | Workstream |
|------|------------|
| 1 | Infrastructure, auth context, route guards, API client |
| 2 | Seed data expansion including `easy_mode` and realistic cross-module records |
| 3 | Advisor dashboard, analytics, content, review, publishing |
| 4 | Leads, prospects, LinkedIn, Facebook, email |
| 5 | Billing, org settings, member management, OAuth integrations |
| 6 | Audit, compliance reporting, system health |
| 7 | Super-admin backend gaps and corresponding page wiring |
| 8 | AI agent wiring |
| 9 | Mock/stub sweep and verification |

## Files Expected to Change

Frontend infrastructure:

- `frontend/vite.config.ts`
- `frontend/src/main.tsx`
- `frontend/src/app/routes.tsx`
- `frontend/src/app/components/ProtectedLayout.tsx`
- `frontend/src/app/components/Layout.tsx` if kept
- `frontend/src/app/components/Sidebar.tsx`
- `frontend/src/app/lib/api-client.ts`
- `frontend/src/app/contexts/AuthContext.tsx`
- `frontend/src/app/types/api.ts`
- `frontend/src/app/hooks/*`

Frontend pages:

- All 36 page components under `frontend/src/app/pages/`

Backend:

- `backend/prisma/seed.ts`
- New backend routes/services for missing super-admin/platform APIs
- Existing backend services that still contain frontend-blocking stubs

## Execution Status (2026-03-10)

Status: Completed

Completed workstreams:

- Infrastructure/auth wiring complete (`api-client`, `AuthContext`, route guards, Query provider, shared async states)
- Super-admin backend gaps implemented for organizations/users/billing-summary/feature-flags route support
- Frontend pages converted from hardcoded/mock data to live backend reads/mutations across advisor/admin/compliance/super-admin routes
- Easy Mode page converted to real agent conversation + command endpoints
- Backend email stubs removed for register/invite/reset flows by using Mailgun-backed `emailService`
- Repository mock/stub sweep completed for production page/backend paths

Verification evidence:

- `frontend`: `npm run build` passed
- `backend`: `npm run typecheck` passed
- `backend`: `npm test -- tests/integration/auth/auth.test.ts tests/integration/review/review.test.ts --runInBand` passed (86/86)
- `backend` full-suite note: existing `tests/integration/content/content.test.ts` OpenAI mock failure remains outside this wiring change set
