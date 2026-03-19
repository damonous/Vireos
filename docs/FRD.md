# Functional Requirements Document (FRD) 

> Purpose: a concise, complete, and machine-parseable FRD for AI orchestrators and coding agents. Keep prose crisp. Use the provided sub-templates verbatim to ensure consistent IDs and traceability.

---

## 0. Document Info
- Project name: Vireos Platform MVP Phase 1
- Version: 1.0
- Date: 2026-03-11
- Source of truth repo or folder: github.com/vireos-ai/vireos-mvp
- Related artifacts
  - RTM JSON path: /docs/rtm/v1/rtm.json
  - Checklist JSON path: /docs/checklists/mvp_phase1.json
  - Design docs: /docs/design/architecture_v1.md; /docs/design/compliance_workflow.md
  - API schema links: /api/openapi.yaml; /api/events/event-schemas.json

---

## 1. Executive Summary
- Vireos enables financial advisors to generate compliant AI content, manage compliance reviews, publish to social/email, automate LinkedIn outreach, manage Facebook ads and leads, and run a Prospect Finder with data credits, all under strict regulatory, security, and audit controls. Outcome: a launch-ready multi-tenant platform with demonstrable compliance guardrails, end-to-end audit trails, RBAC, encryption, and observability. Definition of done: 14 success criteria in Source §19 met; p95 API latency < 600 ms for core operations; zero critical security findings; complete audit logs for content lifecycle and financial events.
- Business value in 2 bullets.
  - Accelerate compliant content and outreach for advisors, shortening time-to-first-asset (TTFA) and increasing conversion.
  - Provide firm-grade governance (FINRA/SEC alignment) with auditable records, enabling enterprise adoption.

---

## 2. Goals and Non-Goals
- Goals
  - G1: Deliver AI-first compliant content generation and end-to-end compliance workflow with full auditability and role-based access.
  - G2: Provide integrated publishing, LinkedIn messaging, Facebook ads with lead capture, Prospect Finder with data credits, analytics, and Stripe billing.
- Non-goals
  - NG1: CRM integrations (Salesforce/Redtail/Wealthbox) and SMS/VoIP (Phase 2).
  - NG2: Real-time data provider API for Prospect Finder (manual fulfillment in MVP).

---

## 3. Scope
- In scope
  - Multi-tenant, multi-ICP backend; RBAC; OpenAI integration with regulatory guardrails; compliance workflow; LinkedIn/Facebook posting; LinkedIn messaging; Facebook ads + lead forms; Mailgun; Prospect Finder request workflow; credits and Stripe billing; leads pipeline; analytics; marketing site.
- Out of scope
  - SMS/VoIP; CRM sync; real-time Prospect Finder API; advanced analytics; white-label; additional ICPs beyond advisors; meeting ingestion.
- Interfaces in scope
  - External systems, APIs, queues, files
    - OpenAI API; LinkedIn Marketing API; Facebook Graph/Marketing APIs; Mailgun API; Stripe API + webhooks; AWS S3; PostgreSQL; Redis; CSV import/export; Email (SMTP/API via Mailgun).
- Interfaces out of scope
  - Twilio, Salesforce/Redtail/Wealthbox, external CRMs, Phase-2 data provider APIs.

---

## 4. Personas and Key Use Cases
- Persona A: Advisor — needs fast compliant content and outreach; success: approved content published and campaigns generating leads with minimal compliance rework.
- Persona B: Compliance Officer — needs efficient review, edit, approval, export, and immutable audit logs; success: zero violations and complete records for audits.
- Top use cases
  - UC1: Generate compliant multi-channel content
    - Step 1: Advisor submits prompt.
    - Step 2: System generates AI content with guardrails and validations.
    - Step 3: Advisor reviews and submits for compliance.
    - Step 4: Compliance approves and publishes.
    - Success condition: Published content with audit trail and required disclosures.
  - UC2: Prospect Finder with credits
    - Step 1: Advisor submits criteria request.
    - Step 2: Staff fulfills via manual import.
    - Step 3: Credits deducted on acceptance; prospects convert to leads.
    - Success condition: Leads available with source attribution, credits reconciled, and events logged.

---

## 5. System Context and Architecture Overview
- Context description
  - External systems and contracts
    - OpenAI for content; LinkedIn/Facebook for posting/messaging/ads/leads; Mailgun for email; Stripe for billing; S3 for assets; Data provider via CSV; OAuth for social accounts.
  - Data flow from input to output
    - User input -> API -> business services -> validations/guardrails -> persistence (Postgres + S3) -> external calls -> events/logs -> UI updates/notifications.
- High-level components
  - Component 1: Core API (Node/Express) — auth, RBAC, tenancy, ICP config, business logic.
  - Component 2: Compliance Service — policy engine, content scanner, validations, audit/eventing.
- Operational constraints
  - Uptime 99.5% MVP; regions: primary US (us-east), data residency US-only; cost caps: infra <$200/month MVP; API keys rotated quarterly.

---

## 6. Functional Requirements
> List each requirement with a stable ID. Keep each FR self-contained and testable. Use the sub-template below per FR.

### FR-001 Multi-tenant RBAC and Access Controls
- Type: feature
- Priority: MUST
- Rationale
  - Enforce organization- and role-based segregation aligned with compliance and least-privilege.
- Description
  - System must isolate org data via organization_id with RLS and enforce RBAC per role matrix.
- Inputs and outputs
  - Inputs: Auth token (JWT) with sub, org_id, role; request payloads.
  - Outputs: Authorized data only; 403/404 on unauthorized.
- Preconditions
  - User authenticated; org exists; role assigned.
- Postconditions
  - Access decisions logged; denied attempts recorded.
- Happy path
  - Step 1: User requests resource within org.
  - Step 2: Policy engine validates role and RLS; returns data.
- Alternative and error paths
  - Case A: Cross-tenant access -> 404 (not found) with SECURITY.DENY log.
  - Case B: Insufficient role -> 403 with REASON code.
- API surface changes (if applicable)
  - Auth: Bearer JWT; claims: sub, org_id, roles[], scopes[].
- Data model changes (if applicable)
  - Tables include organization_id; policies for RLS; roles table; user_org_role map.
- Events and queues (if applicable)
  - Event: authz.decision.v1; payload {sub, org_id, resource, action, effect}.
- Observability
  - Metric: authz_denies_total{reason}; Trace attr: org_id, role; Log: access_decision info.
- Security and privacy
  - Enforce least privilege; block organization_id in client-sent bodies from taking effect (server derives).
- Feature flags and config
  - Flag name: security.strict_rbac; default: on; rollout: all.
- Acceptance criteria
  - Given user in Org A, when requesting Org B resource, then receive 404 and deny logged.
  - Given Advisor role, when calling admin-only endpoint, then 403 and policy trace present.
- Traceability hooks
  - RTM.id: FR-001
  - Checklist.criteria: cross-tenant isolation, RBAC matrix enforced, deny logging.

### FR-002 AI Content Generation with Regulatory Guardrails
- Type: feature
- Priority: MUST
- Rationale
  - Create compliant, personalized content without templates, reducing compliance risk.
- Description
  - Generate multi-channel content via OpenAI with pre/post compliance checks and ICP rules.
- Inputs and outputs
  - Inputs: prompt, channel list, ICP config, advisor context.
  - Outputs: content variants (LinkedIn, Facebook, Email, Ad), violations list, disclaimers added.
- Preconditions
  - Connected OpenAI; ICP rules configured.
- Postconditions
  - Content stored with version, scan report, disclaimers; usage tokens recorded.
- Happy path
  - Step 1: Pre-scan prompt; block prohibited terms.
  - Step 2: Call OpenAI with structured system prompt.
  - Step 3: Post-scan; auto-insert disclosures; mark Draft.
- Alternative and error paths
  - Case A: Violation uncertain -> flag for review; warn user.
  - Case B: OpenAI error -> retry with backoff; if fail, surface 502.
- API surface changes (if applicable)
  - POST /content/generate; Auth: Bearer; Req: {prompt, channels[]}; Resp: {content_versions[], scan}.
- Data model changes (if applicable)
  - content, content_version, compliance_scan, icp_rule tables.
- Events and queues (if applicable)
  - content.generated.v1; producer: content-service; consumers: analytics, billing.
- Observability
  - Metrics: ai_tokens_total, content_gen_failures_total{reason}, compliance_flags_total{type}.
- Security and privacy
  - PII minimized in prompts; redact emails/phones; encrypt prompt logs off by default.
- Feature flags and config
  - Flag: ai.guardrails.enforced=true; rollout 100%.
- Acceptance criteria
  - Given a prompt containing “guaranteed returns”, when generating, then request is blocked with rule id.
  - Given valid prompt, when generated, then content includes required disclaimers per ICP.
- Traceability hooks
  - RTM.id: FR-002
  - Checklist.criteria: pre/post scans, disclaimer insertion, token usage tracking.

### FR-003 Compliance Review and Audit Trail
- Type: feature
- Priority: MUST
- Rationale
  - Satisfy FINRA/SEC approval and recordkeeping requirements.
- Description
  - Provide statuses, inline edits, approvals/rejections, exports, and immutable audit logs.
- Inputs and outputs
  - Inputs: content_id, reviewer actions, notes.
  - Outputs: updated status, diffed versions, export files, audit events.
- Preconditions
  - Content in Draft/Pending; Compliance/Admin role.
- Postconditions
  - All actions appended to audit_log; content status transitions validated.
- Happy path
  - Step 1: Reviewer opens Pending Review queue.
  - Step 2: Edits inline, adds notes, approves -> status Approved.
- Alternative and error paths
  - Case A: Invalid transition -> 409 with rule.
  - Case B: Export error -> regenerate; if fail, 500 with retry.
- API surface changes (if applicable)
  - PATCH /content/{id}/review; POST /content/{id}/export.
- Data model changes (if applicable)
  - audit_log (immutable, append-only), content_status_history.
- Events and queues (if applicable)
  - compliance.decision.v1; compliance.exported.v1.
- Observability
  - Metrics: approvals_total, rejections_total, exports_total; Log: audit entries with actor, time, before/after hash.
- Security and privacy
  - Only Compliance/Admin may approve; digital signature (hash) of approved content; WORM-like storage for audit logs.
- Feature flags and config
  - Flag: compliance.inline_editing=true.
- Acceptance criteria
  - Given Pending item, when approved, then audit_log entry includes reviewer, timestamp, content hash.
  - Given Draft, when attempted to publish, then 409 and rule cited.
- Traceability hooks
  - RTM.id: FR-003
  - Checklist.criteria: status machine enforced, audit immutability, export available.

### FR-004 Social Publishing (LinkedIn/Facebook) with Approvals
- Type: feature
- Priority: MUST
- Rationale
  - Publish only approved content to social networks under OAuth with scheduling.
- Description
  - Allow OAuth connect, schedule/publish approved content, and track post metadata and metrics.
- Inputs and outputs
  - Inputs: content_id (Approved), schedule_at, account tokens.
  - Outputs: platform post_id, status, metrics snapshot.
- Preconditions
  - Approved status; valid OAuth tokens.
- Postconditions
  - Post record stored; schedule job created; metrics polled.
- Happy path
  - Step 1: User schedules Approved content.
  - Step 2: Scheduler posts via API; saves post_id.
- Alternative and error paths
  - Case A: Token expired -> refresh; if fail, notify user.
  - Case B: Platform rate limit -> retry with backoff; DLQ after max retries.
- API surface changes (if applicable)
  - POST /posts; PATCH /posts/{id}/schedule; OAuth connect endpoints.
- Data model changes (if applicable)
  - social_account, post, post_metrics.
- Events and queues (if applicable)
  - post.published.v1; metric.poll.requested.v1.
- Observability
  - Metrics: publish_success_total, publish_fail_total{platform,code}.
- Security and privacy
  - Encrypt OAuth tokens at rest; least scopes; revoke on disconnect; secrets in KMS.
- Feature flags and config
  - Flag: publishing.enabled=true.
- Acceptance criteria
  - Given Unapproved content, when attempting to schedule, then 403.
  - Given valid token and Approved content, when scheduled, then platform post_id stored.
- Traceability hooks
  - RTM.id: FR-004
  - Checklist.criteria: approval gate, OAuth security, retry policies.

### FR-005 LinkedIn Messaging Campaigns with Rate Limits
- Type: feature
- Priority: SHOULD
- Rationale
  - Automate compliant outreach respecting platform limits and stop conditions.
- Description
  - Build/run sequences, personalize via AI, enforce time windows, stop on reply.
- Inputs and outputs
  - Inputs: sequence steps, delays, audience, stop conditions.
  - Outputs: message sends, statuses, replies detected, campaign metrics.
- Preconditions
  - Connected LinkedIn; valid audience; daily caps configured.
- Postconditions
  - Sends queued; stops on reply; logs per message and campaign.
- Happy path
  - Step 1: Create campaign with steps.
  - Step 2: Execution engine sends within limits; logs outcomes.
- Alternative and error paths
  - Case A: Rate limit hit -> pause and reschedule.
  - Case B: Reply detected -> halt remaining steps for contact.
- API surface changes (if applicable)
  - POST /li/campaigns; POST /li/campaigns/{id}/start; GET metrics.
- Data model changes (if applicable)
  - li_campaign, li_step, li_send_log.
- Events and queues (if applicable)
  - li.message.send.requested.v1; li.reply.detected.v1.
- Observability
  - Metrics: li_sends_total, li_rate_limit_hits_total.
- Security and privacy
  - Respect LinkedIn ToS; store minimal profile data; encrypt tokens.
- Feature flags and config
  - Flag: linkedin.messaging.enabled=true.
- Acceptance criteria
  - Given reply received, when next step scheduled, then contact flow halts and log recorded.
  - Given daily cap 50, when 51st send queued, then rescheduled to next window.
- Traceability hooks
  - RTM.id: FR-005
  - Checklist.criteria: caps enforced, stop-on-reply.

### FR-006 Facebook Ads and Lead Forms
- Type: feature
- Priority: SHOULD
- Rationale
  - Enable compliant ad creation, A/B copy, budget control, and capture leads.
- Description
  - Build/manage campaigns/ad sets/ads, upload creatives, create lead forms, ingest leads via webhook.
- Inputs and outputs
  - Inputs: objective, audience, budget, schedules, ad copy, creatives.
  - Outputs: ids for campaign/adset/ad; performance metrics; lead records.
- Preconditions
  - Connected Facebook Business; permissions granted.
- Postconditions
  - Entities created; leads stored with source attribution.
- Happy path
  - Step 1: Create ad copy via AI and approve.
  - Step 2: Launch after approval; leads flow into Leads.
- Alternative and error paths
  - Case A: App review/permission missing -> informative error.
  - Case B: Lead webhook failure -> retry + DLQ with reconciliation job.
- API surface changes (if applicable)
  - POST /fb/ads; POST /fb/leadforms; POST /webhooks/fb/leads.
- Data model changes (if applicable)
  - fb_campaign, fb_adset, fb_ad, fb_lead_form, incoming_leads.
- Events and queues (if applicable)
  - fb.lead.received.v1; fb.metrics.poll.requested.v1.
- Observability
  - Metrics: leads_received_total, webhook_failures_total.
- Security and privacy
  - Verify webhook signatures; encrypt PII; consent flags for leads.
- Feature flags and config
  - Flag: fb.ads.enabled=true.
- Acceptance criteria
  - Given valid webhook, when lead arrives, then lead stored with consent and trace id.
  - Given unapproved ad copy, when launching, then 403 with compliance rule.
- Traceability hooks
  - RTM.id: FR-006
  - Checklist.criteria: webhook verification, compliance gate on ads.

### FR-007 Prospect Finder Requests and Credits
- Type: feature
- Priority: MUST
- Rationale
  - Provide targeted prospect lists with controlled costs and auditability.
- Description
  - Capture criteria, notify staff, import results, preview, deduct credits on accept, convert to leads.
- Inputs and outputs
  - Inputs: criteria payload, credit balance, imported CSV.
  - Outputs: prospect list items, credit transactions, notifications.
- Preconditions
  - Positive credit balance; criteria valid.
- Postconditions
  - Credits deducted; list tagged “Prospect Finder”; audit of transaction.
- Happy path
  - Step 1: Advisor submits criteria.
  - Step 2: Staff imports list; advisor accepts and consumes credits.
- Alternative and error paths
  - Case A: Insufficient credits -> prompt to purchase via Stripe.
  - Case B: CSV validation fail -> reject with error report.
- API surface changes (if applicable)
  - POST /prospects/requests; POST /prospects/import; POST /credits/charge.
- Data model changes (if applicable)
  - prospect_request, prospect_item, credit_ledger.
- Events and queues (if applicable)
  - prospects.list.fulfilled.v1; credits.debited.v1.
- Observability
  - Metrics: credits_debited_total, imports_failed_total.
- Security and privacy
  - Validate and sanitize CSV; encrypt PII; least-privileged staff access.
- Feature flags and config
  - Flag: prospects.manual_fulfillment=true.
- Acceptance criteria
  - Given 100 credits and 60 standard records, when accepted, then 60 credits debited and ledger entry created.
  - Given invalid CSV, when importing, then import rejected with line-level errors.
- Traceability hooks
  - RTM.id: FR-007
  - Checklist.criteria: debit accuracy, CSV validation, audit entries.

### FR-008 Lead Management and Sequences
- Type: feature
- Priority: MUST
- Rationale
  - Centralize leads from all sources with pipeline and outreach hooks.
- Description
  - Store leads with statuses, assign advisors, trigger sequences (email/LinkedIn), log activities.
- Inputs and outputs
  - Inputs: lead payloads from sources; status updates; notes.
  - Outputs: lead records; sequence enrollments; activity logs.
- Preconditions
  - Valid source; dedupe strategy configured.
- Postconditions
  - Leads persisted; events emitted; PII encrypted.
- Happy path
  - Step 1: Lead captured.
  - Step 2: Assigned and enrolled to sequence; status transitions logged.
- Alternative and error paths
  - Case A: Duplicate email -> merge or reject per policy.
  - Case B: Unsubscribe -> stop sequences and mark consent.
- API surface changes (if applicable)
  - POST /leads; PATCH /leads/{id}/status; POST /leads/{id}/enroll.
- Data model changes (if applicable)
  - lead, lead_activity, consent.
- Events and queues (if applicable)
  - lead.created.v1; lead.status.changed.v1.
- Observability
  - Metrics: leads_created_total{source}, dedupe_hits_total.
- Security and privacy
  - Consent tracking; right-to-delete workflow; PII encryption.
- Feature flags and config
  - Flag: leads.sequences.enabled=true.
- Acceptance criteria
  - Given duplicate email, when creating, then merge per org policy and log decision.
  - Given unsubscribe, when sequence pending, then halted with audit log.
- Traceability hooks
  - RTM.id: FR-008
  - Checklist.criteria: dedupe, consent, status audit.

### FR-009 Email Delivery and Sequences (Mailgun)
- Type: feature
- Priority: SHOULD
- Rationale
  - Support compliant email sequences with analytics and stop conditions.
- Description
  - Create templates, send marketing/transactional emails, manage sequences, track opens/clicks/bounces.
- Inputs and outputs
  - Inputs: template content, recipients, schedule.
  - Outputs: send status, analytics.
- Preconditions
  - Verified sender domain; unsubscribe link configured.
- Postconditions
  - Events stored; sequence state updated.
- Happy path
  - Step 1: Create sequence; approve content.
  - Step 2: Sends occur per schedule; analytics reported.
- Alternative and error paths
  - Case A: Bounce -> mark and suppress future sends.
  - Case B: API error -> retry with backoff; DLQ.
- API surface changes (if applicable)
  - POST /email/sequences; POST /webhooks/mailgun.
- Data model changes (if applicable)
  - email_sequence, email_send, email_event.
- Events and queues (if applicable)
  - email.event.received.v1.
- Observability
  - Metrics: email_sends_total, bounce_rate, open_rate, click_rate.
- Security and privacy
  - Enforce unsubscribe; suppress lists; PII encryption; webhook signature validation.
- Feature flags and config
  - Flag: email.marketing.enabled=true.
- Acceptance criteria
  - Given bounce event, when received, then contact suppressed and logged.
  - Given unapproved template, when sending, then 403 with compliance rule.
- Traceability hooks
  - RTM.id: FR-009
  - Checklist.criteria: unsubscribe, bounce handling, compliance gate.

### FR-010 Analytics Dashboard
- Type: feature
- Priority: SHOULD
- Rationale
  - Provide cross-channel visibility for performance and compliance KPIs.
- Description
  - Aggregate metrics for social, ads, email, leads, Prospect Finder, credits.
- Inputs and outputs
  - Inputs: event streams, platform APIs.
  - Outputs: dashboard widgets with filters and time ranges.
- Preconditions
  - Data pipelines active.
- Postconditions
  - Cached metrics; access controlled per org.
- Happy path
  - Step 1: User selects time range.
  - Step 2: System returns aggregated KPIs.
- Alternative and error paths
  - Case A: Partial external metrics -> show last-known with staleness banner.
  - Case B: Permission mismatch -> 403.
- API surface changes (if applicable)
  - GET /analytics/overview?range=...
- Data model changes (if applicable)
  - kpi_aggregates cache.
- Events and queues (if applicable)
  - analytics.kpi.updated.v1.
- Observability
  - Metrics: analytics_query_latency_ms_p95.
- Security and privacy
  - No cross-tenant leakage; metrics anonymized where needed.
- Feature flags and config
  - Flag: analytics.enabled=true.
- Acceptance criteria
  - Given Org A, when fetching analytics, then only Org A data is present.
  - Given stale external metrics, when loaded, then staleness indicator shown.
- Traceability hooks
  - RTM.id: FR-010
  - Checklist.criteria: tenancy, staleness handling.

### FR-011 Stripe Subscriptions and Credit Purchases
- Type: feature
- Priority: MUST
- Rationale
  - Monetize subscriptions and credit bundles with reconciled ledger and webhooks.
- Description
  - Manage plans, invoices, payments; purchase credits; sync via Stripe webhooks.
- Inputs and outputs
  - Inputs: plan selection, payment method, credit bundle.
  - Outputs: subscription status, invoices, credit ledger entries.
- Preconditions
  - Stripe account configured; webhook secrets set.
- Postconditions
  - Subscription state persisted; credits updated.
- Happy path
  - Step 1: User subscribes via Checkout/Portal.
  - Step 2: Webhook updates local state; credits issued.
- Alternative and error paths
  - Case A: Payment failed -> dunning and email notice.
  - Case B: Webhook missed -> reconciliation job queries Stripe.
- API surface changes (if applicable)
  - POST /billing/checkout; POST /webhooks/stripe.
- Data model changes (if applicable)
  - subscription, invoice, credit_ledger (double-entry).
- Events and queues (if applicable)
  - billing.subscription.updated.v1; credits.credited.v1.
- Observability
  - Metrics: webhook_failures_total{event}, credit_balance_gauge.
- Security and privacy
  - Do not store PAN; use Stripe tokens; verify signatures; encrypt customer IDs.
- Feature flags and config
  - Flag: billing.enabled=true.
- Acceptance criteria
  - Given paid invoice for 1,000 credits, when webhook processed, then credit_ledger increases by 1,000 with trace to invoice.
  - Given failed payment, when webhook received, then subscription set to past_due and email sent.
- Traceability hooks
  - RTM.id: FR-011
  - Checklist.criteria: webhook verification, credit ledger integrity.

### FR-012 Security Baseline and Secret Management
- Type: chore
- Priority: MUST
- Rationale
  - Protect customer data and meet regulatory expectations.
- Description
  - Enforce TLS, encryption at rest, secret storage, key rotation, rate limits, secure headers, and CIS-aligned configurations.
- Inputs and outputs
  - Inputs: none (infra/config).
  - Outputs: enforced controls, security posture reports.
- Preconditions
  - KMS available; CI/CD configured.
- Postconditions
  - Secrets rotated; scans pass; controls measurable.
- Happy path
  - Step 1: Deploy with TLS and HSTS.
  - Step 2: Secrets in KMS; rotation policy applied.
- Alternative and error paths
  - Case A: Secret exposure detected -> revoke and rotate; incident log.
  - Case B: Rate limit exceeded -> 429 and alert.
- API surface changes (if applicable)
  - N/A
- Data model changes (if applicable)
  - N/A
- Events and queues (if applicable)
  - security.incident.v1; throttling.triggered.v1.
- Observability
  - Metrics: 4xx_429_total, security_incidents_total.
- Security and privacy
  - AES-256 at rest; TLS1.2+; JWT signed and rotated; CSP, X-Frame-Options, X-Content-Type-Options; OWASP ASVS L2.
- Feature flags and config
  - Flag: security.strict_headers=true.
- Acceptance criteria
  - Given API call over HTTP, when attempted, then redirect to HTTPS with HSTS present.
  - Given leaked token simulation, when rotated, then old token invalidated and audit logged.
- Traceability hooks
  - RTM.id: FR-012
  - Checklist.criteria: TLS/HSTS, KMS, rotation, rate limiting.

### FR-013 Audit Logging and Export
- Type: feature
- Priority: MUST
- Rationale
  - Provide immutable, comprehensive audit trails for regulators and clients.
- Description
  - Capture append-only logs for auth, access, content lifecycle, billing, and data changes; exportable to PDF/CSV.
- Inputs and outputs
  - Inputs: system events.
  - Outputs: audit_log entries; signed exports.
- Preconditions
  - Centralized logging configured.
- Postconditions
  - Tamper-evident logs persisted; retention policy applied.
- Happy path
  - Step 1: Action occurs.
  - Step 2: Log written with hash chain and stored.
- Alternative and error paths
  - Case A: Log write fail -> retry + buffer; alert if backlog.
  - Case B: Export too large -> paginate with cursor.
- API surface changes (if applicable)
  - GET /audit/logs?filters; POST /audit/export.
- Data model changes (if applicable)
  - audit_log(hash, prev_hash), audit_export.
- Events and queues (if applicable)
  - audit.entry.created.v1.
- Observability
  - Metrics: audit_write_failures_total; backlog_queue_depth.
- Security and privacy
  - Access to logs restricted to Super Admin and Compliance; PII masked where appropriate; exports signed and expiring URLs.
- Feature flags and config
  - Flag: audit.tamper_evident=true.
- Acceptance criteria
  - Given sequence of actions, when exporting logs, then hash chain validates and includes all required fields.
  - Given user without permission, when accessing logs, then 403 and event logged.
- Traceability hooks
  - RTM.id: FR-013
  - Checklist.criteria: hash chain, access controls, export signing.

---

## 7. Non-Functional Requirements
- Performance and scalability
  - Targets: p95 latency < 600 ms for CRUD; content generation end-to-end < 8 s p95; 200 RPS sustained API; 10 concurrent content generations per org.
  - Load profile and test approach: k6 for API; replay tests for webhooks; chaos tests for external API slowness.
- Reliability and resilience
  - Retries with jittered backoff; timeouts 3–10 s by integration; idempotent webhooks; DLQs for publishing and webhooks; recovery runbooks and replay tools.
- Security and compliance
  - Standards: OWASP ASVS L2; SOC 2 readiness controls; CIS Benchmarks for cloud; encryption at rest (AES-256) and in transit (TLS1.2+).
- Privacy
  - Data minimization in prompts and logs; retention: audit 7 years, operational 18 months, leads per org policy; DSR support: export/delete upon verified request.
- Observability
  - Metrics: RED + business KPIs; logs structured JSON with trace ids; traces via OpenTelemetry; alerts for error rate > 2% 5m, p95 latency > 1s 10m, webhook failures > 5% 10m.
- Usability and accessibility
  - A11y: WCAG 2.1 AA for core flows; keyboard navigation; color contrast.
- Maintainability and operability
  - Code standards (TS strict); modular services; CI with unit > 80% and critical paths e2e; runbooks; SLO availability 99.5%.

---

## 8. API Surface Summary (optional)
| Method | Path | Purpose | Auth | Request schema | Response schema | Errors |
|---|---|---|---|---|---|---|
| POST | /content/generate | AI content with guardrails | Bearer | GenerateRequest | GenerateResponse | 400, 409, 502 |
| PATCH | /content/{id}/review | Compliance review | Bearer | ReviewRequest | Content | 400, 403, 409 |
| POST | /posts | Schedule/publish | Bearer | PostRequest | Post | 400, 403, 429, 502 |
| POST | /prospects/requests | Create PF request | Bearer | ProspectCriteria | ProspectRequest | 400, 402 |
| POST | /prospects/import | Staff import CSV | Bearer | Multipart CSV | ImportResult | 400, 409 |
| POST | /credits/charge | Deduct credits | Bearer | CreditCharge | CreditLedger | 400, 402 |
| POST | /webhooks/stripe | Billing sync | Signed | StripeEvent | 200 OK | 400, 401 |
| POST | /webhooks/mailgun | Email events | Signed | MailgunEvent | 200 OK | 400, 401 |
| POST | /webhooks/fb/leads | Lead ingest | Signed | FBLeadEvent | 200 OK | 400, 401 |
| GET | /audit/logs | Fetch audit logs | Bearer | Query params | AuditPage | 400, 403 |

---

## 9. Data Model Summary (optional)
- Entities
  - organization: id, name, icp_type, settings, created_at
  - user: id, email, password_hash, status, created_at
  - user_org_role: user_id, org_id, role
  - content: id, org_id, owner_id, current_version_id, status
  - content_version: id, content_id, channel, body, disclaimers, scan_report, created_at
  - compliance_scan: id, content_version_id, findings(jsonb), score
  - audit_log: id, org_id, actor_id, action, resource, before_hash, after_hash, ts
  - social_account: id, org_id, platform, oauth_encrypted
  - post: id, org_id, content_id, platform, schedule_at, status, platform_post_id
  - li_campaign/li_send_log
  - fb_campaign/fb_adset/fb_ad/fb_lead_form
  - lead: id, org_id, email, phone, source, status, consent, assigned_id, pii_encrypted
  - email_sequence/email_send/email_event
  - prospect_request/prospect_item
  - credit_ledger: id, org_id, type(debit/credit), amount, balance_after, ref
  - subscription/invoice
- Relationships
  - org 1—* users (via user_org_role), content, leads, posts, credits; content 1—* versions; version 1—1 scan; prospect_request 1—* items.
- Migrations
  - Add RLS and policies for all org_id tables; backfill hashes for audit_log; add indexes on org_id, status, created_at.

---

## 10. Events and Integration Contracts (optional)
- Event name, version, schema, producer, consumers
  - content.generated.v1 — content-service — analytics, billing
  - compliance.decision.v1 — compliance-service — posts-service, analytics
  - post.published.v1 — posts-service — analytics
  - fb.lead.received.v1 — ingestion — leads-service, analytics
  - credits.debited.v1 — billing — analytics
- External API contracts with version and SLAs
  - OpenAI: latest stable; no SLA; implement timeouts/retries.
  - LinkedIn/Facebook: Marketing APIs; rate limited; OAuth 2.0.
  - Stripe/Mailgun: signed webhooks; expected 99.9% availability.

---

## 11. Security, Privacy, Compliance
- Threat model summary and mitigations
  - Multi-tenant data leakage: RLS + RBAC + tenant-scoped queries + tests.
  - Token/key compromise: KMS encryption, short-lived scoped tokens, rotation, IP allowlist for admin.
  - Injection/XSS/CSRF: parameterized queries, output encoding, CSP, CSRF tokens.
  - Supply chain: pinned dependencies, SCA scans, Dependabot, signed images.
- Secrets and key management
  - All secrets in cloud KMS/Secrets Manager; no secrets in repo; rotation every 90 days; audit accesses.
- Access control matrix at a high level
  - Super Admin: all tenants via back-office; Admin: org-wide; Advisor: own content/leads; Compliance: review and publish authority.
- Compliance notes: SOC 2, GDPR, HIPAA, or internal policies
  - SOC 2-aligned controls; GDPR principles for data minimization and DSR; not HIPAA-covered; FINRA 2210 and SEC Marketing Rule alignment with approval and recordkeeping.

---

## 12. Observability Plan
- Metrics: http_requests_total{route,code}; http_request_duration_ms{p95}; ai_tokens_total; publish_fail_total{platform}; webhook_failures_total{source}; approvals_total; credits_balance{org}; leads_created_total{source}.
- Logs: structured JSON at info/error; security events at warn/error; audit logs at info with hash chain; correlation_id and org_id on all entries.
- Traces: OpenTelemetry spans for API, DB, external calls; attributes: org_id, role, resource_id; sampling 10% prod, 100% errors.
- Dashboards and alerts: API latency/availability; external integration health; webhook DLQ depth; compliance queue aging; security incident count; alert thresholds as in NFRs.

---

## 13. Environments and Deployment
- Environments: dev, staging, prod
- Config by environment
  - Separate OpenAI/Stripe/FB/LI/Mailgun credentials; lower rate limits in dev; dummy webhooks; staging mirrors prod settings.
- Dependencies: PostgreSQL (with RLS), Redis (jobs/cache), S3 (assets/exports), KMS, CI/CD GitHub Actions.
- Deployment strategy: blue-green for API; feature flags; manual approval gates; database migrations with safe online strategy.

---

## 14. Rollout and Safeguards
- Feature flags and kill switches
  - ai.guardrails.enforced, publishing.enabled, linkedin.messaging.enabled, fb.ads.enabled, audit.tamper_evident.
- Rollout plan by cohort or percentage
  - Internal staff -> pilot orgs (5) -> general availability; progressive % for messaging/ads.
- Guardrails and auto-rollback criteria
  - Error rate > 5% or authz_denies anomaly -> auto-rollback; integration-specific kill switches; DLQ depth > threshold triggers pause.

---

## 15. Testing and Acceptance Plan
- Strategy: unit (80%+), integration for external APIs with mocks, e2e for core flows (content→approval→publish), contract tests for webhooks, performance tests for p95 targets, security tests (SAST/DAST).
- Test data and fixtures: synthetic prompts, compliant/non-compliant cases, webhook payloads, CSV samples, Stripe events.
- Coverage targets and gating rules: unit 80%, critical services 90%; zero critical vulnerabilities; e2e pass required for deploy.
- Mapping to acceptance criteria and RTM test cases: RTM JSON links FR-001..FR-013 to automated tests; CI enforces mapping completeness.

---

## 16. Milestones and Deliverables
- M0: scope and acceptance for milestone 0
  - Architecture baseline, RBAC/RLS, security baseline, CI/CD, audit log scaffolding.
- M1: scope and acceptance for milestone 1
  - AI content with guardrails, compliance workflow with exports, social publishing, Mailgun, Stripe subscriptions/credits.
- M2: scope and acceptance for milestone 2
  - LinkedIn messaging, Facebook ads + lead forms, Prospect Finder with credits, analytics dashboard, marketing site live.

---

## 17. Success Metrics and KPIs
- Engineering metrics: lead time < 3 days PR-to-prod; change failure rate < 10%; MTTR < 2 hours.
- Product metrics: advisor activation (first approved post) > 70% in 7 days; time-to-first-approved-content < 24 hours; TTFA (time to first asset) median < 21 days.

---

## 18. Risks and Mitigations
- Risk 1 and mitigation
  - Social API approval delays: develop against sandboxes; parallel manual posting fallback; decouple UI; feature flags.
- Risk 2 and mitigation
  - Compliance violations slipping through AI: conservative ruleset; human review mandated; continuous rule tuning; blocklists and post-scan classifiers.

---

## 19. Assumptions and Open Questions
- Assumptions that must hold true
  - Advisors have authority to connect social accounts; US data residency required; Stripe supported regions for customers.
- Open questions that block design or implementation
  - Final firm-specific disclosure texts per ICP; data provider credit pricing and categorization; required audit log retention by customers beyond default 7 years.

---

## 20. Glossary
- ICP: Ideal Customer Profile (industry vertical configuration).
- RLS: Row-Level Security in PostgreSQL.
- DLQ: Dead Letter Queue for failed async jobs.
- DSR: Data Subject Request (export/delete under privacy laws).

---

## 21. Change Log
- v1.0 2026-03-11: Initial FRD for Vireos MVP Phase 1 with emphasis on compliance, security, audit, and access controls.
