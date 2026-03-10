# Vireos Platform MVP — Deliverables Summary

**Client:** Shea Werner, CEO & Founder — Vireos (vireos.ai)
**Vendor:** Robert Brooks / MVP.dev
**Engagement:** Fixed-Price MVP Build
**Delivery Timeline:** 30 days from contract execution

---

## Deliverables Overview

The following 13 modules constitute the full scope of the Vireos Platform MVP. All deliverables are production-ready; no prototypes, no placeholders, no no-code tooling.

---

### 1. Platform Architecture & Multi-Tenant Foundation

- Multi-tenant PostgreSQL database with `organization_id` isolation and row-level security
- Multi-ICP admin backend: data-driven configuration for industry verticals (financial advisors at launch; insurance, loan, real estate in Phase 2 via config — no code changes required)
- React.js + TypeScript frontend, Node.js + Express backend
- AWS S3 file storage, GitHub Actions CI/CD pipeline
- Low-cost infrastructure at launch; no vendor lock-in; full source code ownership

### 2. User Authentication & Role-Based Access Control

- Email/password authentication with secure session management and password reset
- Four roles: Super Admin (Vireos staff), Admin (org owner), Advisor, Compliance Officer
- Permission enforcement: advisors cannot publish without compliance approval; compliance cannot access billing; Super Admin manages ICP configuration
- Encrypted tokens, TLS in transit, data encryption at rest

### 3. AI Content Generation Engine

- OpenAI API integration generating fresh, unique content per advisor prompt — no templates
- Single prompt generates four channel-specific outputs: LinkedIn post, Facebook post, email, ad copy
- Pre-generation guardrails: blocks prohibited language (return guarantees, promissory statements) before reaching the model
- Post-generation validation: scans output for FINRA/SEC violations, auto-inserts required disclaimers, flags uncertain content for human review
- Configurable per firm: custom disclosure language, prohibited word lists, required footer text
- Usage tracking: tokens consumed per request, cost tracking per user/organization, audit trail linkage

### 4. Compliance Workflow

- Content lifecycle: Draft → Pending Review → Approved / Rejected / Needs Changes → Published → Archived
- Compliance team capabilities: review queue, inline editing, return with notes, approve, reject, export to PDF or Word for recordkeeping
- Full audit trail on every content item: creation, all edits, status changes, approval/rejection, publication — timestamped and attributed to user
- Email + in-app notifications for all status transitions
- Advisors cannot publish without an Approved status

### 5. Social Publishing

- **LinkedIn:** Post text and image content, schedule posts, OAuth 2.0 per-user authentication, engagement metrics
- **Facebook:** Post to Facebook Pages, schedule posts, track reach and engagement
- Content calendar view with scheduled vs. published status
- Edit and delete scheduled posts before publication

### 6. LinkedIn Messaging Automation

- AI-generated multi-step outreach sequences: retirement planning, wealth transfer, small business owners, referral requests, insurance introduction
- Campaign builder: configurable sequence steps, delays between steps, stop conditions (reply received, connection dropped)
- Execution engine: respects LinkedIn rate limits, daily sending limits, business-hours-only option, auto-stop on reply
- Analytics: invitations sent/accepted, message open rates, reply rates, campaign performance by stage, pipeline value attributed

### 7. Facebook Ads Management & Lead Capture

- AI-generated compliant ad copy for: retirement planning, portfolio review offers, educational content, event registration, lead magnet downloads
- Ad builder: objective and audience input → AI generates copy variations → image upload → budget/schedule → compliance approval → launch
- Facebook Lead Form integration with real-time webhook for lead capture
- Lead follow-up automation: auto-enroll captured leads in email sequences with configurable timing
- Ad performance metrics: impressions, reach, CTR, CPC, CPL, ROI

### 8. Prospect Finder Module

- Criteria builder UI: geography (zip/area code), net worth range, employer/industry, professional designation, LinkedIn profile required toggle, validated email required toggle
- Request submission workflow: advisor submits criteria → Vireos staff notified → Vireos sources data from third-party provider → list imported and advisor notified
- Data credit system: advisors purchase credit bundles via Stripe; each record deducts credits at configurable rates; balance visible in billing dashboard with low-balance alerts
- List management: preview before credits consumed, enroll selected records in outreach sequences, push to Lead Management with status "New," export to CSV
- Architecture ready for Phase 2 direct API integration with data provider (no frontend changes required)

### 9. Lead Management

- Lead capture from: Prospect Finder, Facebook Lead Forms, manual CSV import, LinkedIn connection sync
- Lead properties: name, email, phone, source, campaign, status, assigned advisor, custom fields
- Lead lifecycle: New → Contacted → Engaged → Meeting Scheduled → Client → Lost
- Actions: assign to advisor, enroll in email sequence, enroll in LinkedIn campaign, log activities and notes, update status

### 10. Email Marketing (SendGrid)

- SendGrid v3 API integration for transactional and marketing email delivery
- WYSIWYG email template editor with variable insertion and mobile-responsive designs
- AI-generated email content from advisor prompts, through same compliance guardrails as all content
- Automated sequences: configurable delays, trigger conditions (signup, form submission, prospect import), stop conditions (unsubscribe, reply)
- Analytics: send/delivery/bounce rates, open rate, click rate, unsubscribe tracking

### 11. Analytics Dashboard

Cross-channel performance in a single view with 7-day, 14-day, 30-day, and custom time range filters:

| Channel | Metrics Tracked |
|---|---|
| LinkedIn | Posts published, engagement, invitation sent/accepted rate, message response rates, campaign performance, top posts |
| Facebook | Posts published, engagement, reach/impressions, ad CTR, CPC, CPL, ROI |
| Email | Send/delivery/bounce rates, open and click rates, best-performing emails, unsubscribe rate |
| Leads | Source breakdown, conversion funnel, pipeline value |
| Prospect Finder | Lists requested/fulfilled, credits consumed, records imported, prospect→lead→client conversion rate |

### 12. Stripe Billing & Subscription Management

- Subscription tiers: Individual (1 advisor), Team (custom, 2–10 users), Enterprise (custom, unlimited)
- Data credit bundles: one-time purchase via Stripe, tied to organization account, balance tracked and displayed
- Self-serve billing management: view current plan, credit balance and usage history, payment history, update payment method, upgrade/downgrade, cancel
- Stripe webhook handling for all subscription lifecycle events

### 13. Marketing Website (vireos.ai)

- **Landing page:** Hero with primary CTA, problem/solution sections, feature highlights, competitive differentiation, pricing tiers, testimonials placeholder, footer CTA
- **About page:** Founder story, company mission, team (Shea + Lauren)
- Responsive design (desktop-primary, mobile-functional), Lighthouse score > 90, contact/demo request form with email notification
- DNS configuration by client; site delivered ready to deploy

---

### Testing & QA

- End-to-end test coverage for all 14 launch success criteria (see below)
- Security testing: authentication, RBAC enforcement, data isolation between tenants, API key storage
- Performance baseline testing

---

## Launch Success Criteria

The engagement is complete when all 14 criteria pass:

1. Organization can sign up and subscribe via Stripe
2. Advisor can generate AI content with compliance guardrails active
3. Compliance team can review, edit, approve/reject, and export content
4. Approved content can be published to LinkedIn, Facebook, and email
5. LinkedIn messaging campaigns can be created and executed
6. Facebook ads can be created with lead form capture functioning
7. Advisor can submit a Prospect Finder request with criteria
8. Vireos staff can fulfill request and import list into platform
9. Imported prospects flow into lead management and outreach sequences
10. Data credits are tracked, deducted, and visible in billing dashboard
11. Analytics are visible for all channels including Prospect Finder
12. Marketing website is live at vireos.ai
13. Platform is stable for pilot customer onboarding
14. All security requirements met (encryption, access controls, audit logging)

---

## What Is Not Included

Intentionally deferred to Phase 2 to protect the 30-day delivery window:

- Meeting data ingestion and analysis
- CRM integrations (Salesforce, Redtail, Wealthbox)
- SMS marketing and VoIP / second phone number for advisors
- Real-time direct data provider API for Prospect Finder (MVP uses managed import)
- Advanced analytics and custom reporting
- White-label capabilities
- Additional social channels (Twitter/X, Instagram)
- Insurance agent and real estate agent ICP content configurations

All deferred features are accounted for in the architecture; Phase 2 additions require no platform rework.

