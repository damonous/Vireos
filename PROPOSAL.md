# Vireos Platform MVP — Software Development Proposal

**Prepared by:** Robert Brooks / MVP.dev
**Prepared for:** Shea Werner, CEO & Founder — Vireos (vireos.ai)
**Date:** February 2026
**Engagement Type:** Fixed-Price MVP Build

---

## EXECUTIVE SUMMARY

Vireos is positioned to disrupt a $200M/year legacy market with the first AI-native marketing platform built specifically for U.S. wealth management compliance. The opportunity is real, the timing is right, and Shea Werner has already proven he can execute: Archive Intel reached $2M ARR in its first year under his leadership.

This proposal covers the design and delivery of Vireos's launch-ready MVP — a multi-tenant SaaS platform combining AI content generation, FINRA/SEC compliance workflows, social publishing, LinkedIn outreach automation, Facebook advertising, email sequences, prospect discovery, lead management, and analytics — in **30 days** at a **fixed price of $37,291**.

The platform will be built on production-grade infrastructure with real code, not no-code tools, and will be ready to onboard the 20+ enterprise contacts already waiting for it.

---

## THE OPPORTUNITY

### A Legacy Competitor with No Defense

FMG Suite generates over $200 million in annual revenue selling marketing software to financial advisors. The platform is 20+ years old. Advisors tolerate it because there has been no credible alternative — not because they like it.

The limitations are structural, not cosmetic:
- **Template-based content:** Every advisor on FMG Suite publishes identical "5 reasons to review your portfolio" posts. There is no differentiation, no personalization, and no competitive edge for the advisor.
- **No AI:** The platform was built before AI content generation existed and has no credible path to integration.
- **No built-in compliance:** Advisors manage FINRA/SEC compliance manually or through separate workflows.
- **Poor UX:** The interface reflects two decades of accumulated decisions, not intentional design.

A Canadian competitor has modernized the UI and added LinkedIn automation and Facebook ads, but it lacks AI content generation and has no understanding of U.S. regulatory requirements. It is not a threat in the domestic market.

### The Competitive Landscape

The fintech advisor marketing space is fragmented with a few meaningful players:

- **Finney** (Y Combinator, raised $17M): The closest comparable — offers prospect search, filtering, and AI-assisted outreach sequences. Strong product, limited distribution, and advisors report mixed results. Their data appears to be sourced via third-party API pass-through, not a proprietary database — which means Vireos can implement the same model.
- **Cashmere AI:** Requires firms to bring their own prospect lists or pipe data in via Zapier integrations. No built-in data sourcing.
- **FMG Suite, Advisor Stream, Levitate, Snappy Kraken:** Legacy digital marketing tools focused on templates and social posting. No AI, no prospect discovery, no compliance.
- **Advisor Lead Gen providers:** Sell purchased leads from ad campaigns — indirect competition at best.

**The real gap:** No platform in the market combines AI-generated content, built-in compliance, and integrated prospect discovery in a single workflow. Vireos will be first.

### The Window

AI adoption pressure in financial services has reached a tipping point. Firm leadership is demanding that their teams adopt AI tools. Senior marketing directors at RIA firms are actively looking for compliant AI solutions — and in at least one documented case, willing to pay just to tell their executives they are using AI.

Every conference Shea attends, advisors are asking for this. The question is not whether there is demand. The question is who builds the right product first.

### The Moat

Vireos's defensible position is the combination of things no competitor currently offers together:

1. **AI-generated content** that is unique per advisor — not templates, not evergreen fills
2. **Built-in FINRA/SEC compliance guardrails** that make the content publishable without legal risk
3. **Integrated prospect discovery** — search, filter, and enrich prospect lists without leaving the platform
4. **Multi-ICP architecture** — designed from day one to expand beyond financial advisors into insurance, real estate, and loan officers without requiring platform rebuilds

---

## WHAT WE ARE BUILDING

The MVP is a fully functional, multi-tenant SaaS platform ready to onboard paying customers at launch. It is not a demo, a prototype, or a proof of concept. It is a production system built to survive real advisors and real compliance requirements from day one.

### Platform Architecture

**Multi-tenant SaaS** with tenant isolation via `organization_id` and row-level security. Every firm's data, users, compliance rules, and content are logically separated. No firm can see another firm's data.

**Multi-ICP Architecture:** The backend is architected from day one to support multiple industry verticals. The admin panel will allow Vireos staff to configure ICP-specific settings (compliance rules, content templates, workflow terminology) for financial advisors, insurance agents, loan officers, and real estate professionals — without requiring code changes. This future-proofs the expansion Shea has planned without throwing away the MVP investment.

**Technology Stack:**

| Layer | Technology |
|---|---|
| Frontend | React.js with TypeScript |
| Backend API | Node.js with Express |
| Database | PostgreSQL |
| File Storage | AWS S3 |
| Hosting | AWS / GCP / Azure (scalable) |
| CI/CD | GitHub Actions |
| AI | OpenAI API |
| Social | LinkedIn Marketing API, Facebook Graph API |
| Email | SendGrid v3 |
| Billing | Stripe |

Infrastructure cost at launch: **$20–$50/month**, scaling with customer volume. No platform lock-in. The codebase is owned by Vireos.

---

## FEATURE SCOPE

### 1. AI Content Generation Engine

The core of the platform. An advisor inputs a prompt — "Write about Roth conversions for tech executives in their 50s" — and the system generates fresh, unique content optimized for each publishing channel.

**How it works:**
- Pre-generation constraints block prohibited language before the prompt reaches the model: no guarantees, no promises of returns, required risk disclosures enforced
- AI generates channel-specific variations: LinkedIn post, Facebook post, email, and ad copy — all from one prompt
- Post-generation validation scans output for violations, auto-inserts required disclaimers, and flags anything uncertain for human review
- Compliance rules are configurable per firm: custom disclosure language, prohibited word lists, required footer text

**The output is not a template. It is fresh content, unique to that advisor, that prompt, and that moment.**

### 2. Compliance Workflow

Financial advisors cannot publish marketing content without compliance review. The platform encodes this workflow, not just supports it.

**Three roles:**
- **Admin** — Full platform access, user management, billing
- **Advisor** — Create content, submit for review; cannot publish directly
- **Compliance** — Review queue, inline editing, approve/reject/request changes, export to PDF or Word for recordkeeping

**Content lifecycle:** Draft → Pending Review → [Approved / Rejected / Needs Changes] → Published

Full audit trail at every step: who created it, who edited it, who approved it, when it was published. Every status change is logged and timestamped. Firms can demonstrate compliance to regulators from within the platform.

### 3. Social Publishing

- **LinkedIn:** Post text and image content, schedule posts, OAuth authentication, engagement metrics
- **Facebook:** Post to Facebook Pages, schedule, track reach and engagement
- Content calendar view with scheduled vs. published status
- Edit and delete scheduled posts before they go out

### 4. LinkedIn Messaging Automation

- AI-generated multi-step outreach sequences for: retirement planning, wealth transfer, small business owners, referral requests, insurance introduction
- Configurable delays between steps
- Campaign builder with per-contact personalization
- Automation engine respects LinkedIn rate limits
- Analytics: invitations sent/accepted, message open rates, reply rates, pipeline value attributed

### 5. Facebook Ads Management

- AI-generated compliant ad copy for: retirement planning, portfolio review offers, educational content, event registration, lead magnet downloads
- Ad builder flows through the same compliance approval workflow as content
- Facebook Lead Form integration with real-time webhook for lead capture
- Lead follow-up automation sequences
- Budget management and audience targeting

### 6. Prospect Finder (ICP Search & Discovery)

This is a key differentiator over legacy platforms — the ability to build a targeted prospect list from within the platform without managing a separate data provider relationship.

**How it works in MVP:**
- Advisor specifies prospect criteria: geography (zip code, area code), net worth range, employer/industry, professional designation
- Criteria request is submitted through the platform
- Vireos sources the list from a third-party data provider (cost is passed through to the advisor as a usage charge)
- Verified list (with LinkedIn profiles and validated emails) is imported directly into the platform
- Prospects feed into the lead pipeline and outreach sequence workflow immediately

**Usage-based pricing model:** Advisors purchase data credits. Each list pull draws from their credit balance. Credits can be bundled with subscription tiers or purchased à la carte. This model keeps Vireos's data cost at zero until revenue justifies a direct data provider subscription.

**Future (Phase 2):** Direct API integration with a data provider for real-time search results — the same model Finney appears to use. No workflow changes required; it's a back-end upgrade only.

### 7. Lead Management

**Capture sources:** Prospect Finder lists, Facebook Lead Forms, manual CSV import, LinkedIn connection sync

**Lead properties:** Name, email, phone, source, campaign, status, assigned advisor

**Lead lifecycle:** New → Contacted → Engaged → Meeting Scheduled → Client → Lost

Assign leads to advisors, enroll in email sequences, log activities and notes.

### 8. Email Marketing

- SendGrid integration for transactional and marketing delivery
- WYSIWYG email template editor
- AI-generated email content from advisor prompts, through the same compliance guardrails
- Automated sequences with configurable delays and trigger conditions
- Analytics: deliveries, bounces, opens, clicks, unsubscribes per campaign

### 9. Analytics Dashboard

Cross-channel performance in one view:

| Channel | Metrics |
|---|---|
| LinkedIn | Invitations sent/accepted, message response rates, campaign performance, top posts |
| Facebook | Impressions, reach, CTR, CPC, CPL, ROI |
| Email | Send/delivery/bounce rates, open and click rates |
| Leads | Source breakdown, conversion funnel, pipeline value |
| Prospect Finder | Lists generated, credits used, conversion from prospect to lead |

Time range filters: 7 days, 14 days, 30 days, custom range.

### 10. Billing & Subscriptions

Stripe-powered subscription management supporting all pricing tiers. Usage tracking (AI tokens, data credits), invoice generation, and payment method management handled within the platform. Firms self-serve; no manual billing.

### 11. Marketing Website

A professional two-page marketing website for Vireos (vireos.ai):
- **Landing page:** Hero section, value proposition, feature highlights, competitive differentiation, pricing tiers, CTA to sign up or request a demo
- **About page:** Founder story, company mission, team

Clean, modern design aligned with the Vireos brand identity. Built to convert inbound traffic from outreach campaigns and conference leads.

---

## PRICING MODEL (Vireos SaaS Tiers)

| Tier | Price | Users | Target Segment |
|---|---|---|---|
| Individual | $299/month | 1 advisor | Solo advisors |
| Team | Custom | 2–10 | Small RIA teams |
| Enterprise | Custom | Unlimited | Large firms, broker-dealers |

**Additional revenue streams:**
- Data credits for Prospect Finder (cost pass-through + margin)
- AI token overage charges
- Premium compliance configurations
- White-label partnerships (Phase 2)

**Year 1 target:** 100 advisors × $300/month = **$360,000 ARR**

Target acquisition rate: 10 new advisors per week from launch.

---

## WHAT IS NOT IN MVP

These features are intentionally deferred to Phase 2 to protect the 30-day timeline and launch window:

- Meeting data ingestion and analysis
- CRM integrations (Salesforce, Redtail, Wealthbox)
- SMS marketing and VoIP/second phone number for advisors (deferred — significant carrier and regulatory complexity)
- Real-time direct data provider API integration for Prospect Finder (MVP uses manual import)
- Advanced analytics and custom reporting
- White-label capabilities
- Additional social channels (Twitter/X, Instagram)
- Insurance agent and real estate agent ICP configurations (admin architecture supports it; content tuned for Phase 2)

All of these are designed and accounted for in the architecture. Adding them in Phase 2 will not require rework.

---

## INVESTMENT

### Fixed-Price Breakdown

| Component | Investment |
|---|---|
| Platform architecture & multi-tenant setup (multi-ICP) | $2,500 |
| User authentication & role-based access control | $2,200 |
| AI content generation engine (core feature) | $4,500 |
| Compliance workflow (review, approve, export, audit) | $3,200 |
| Social publishing (LinkedIn, Facebook) | $3,300 |
| LinkedIn messaging automation | $3,200 |
| Facebook ads management & lead capture | $2,700 |
| Prospect Finder module (criteria builder, import, sequence integration) | $2,800 |
| Lead management module | $1,700 |
| Email integration (SendGrid) | $2,200 |
| Analytics dashboard | $2,200 |
| Stripe billing & subscription management (with data credit tracking) | $1,700 |
| Marketing website (landing page + about) | $2,500 |
| Testing & QA | $2,591 |
| **Total** | **$37,291** |

**This is a fixed price.** No hourly overruns, no scope creep surprises.

### What the Investment Gets You

- A production-grade, multi-tenant SaaS platform — not a prototype
- Full source code ownership; no vendor lock-in
- Architecture designed for Phase 2 features and additional ICPs without rework
- Infrastructure that scales: $20–$50/month at launch, cost-efficient to $500+ customers
- A Prospect Finder workflow that lets you sell immediately while keeping data costs at zero
- A marketing website ready to convert the traffic you'll be driving at launch
- A team that includes Robert Brooks at the architecture and schema level — not an outsourced shop operating without oversight

---

## THE TEAM

**Robert Brooks — Architect & Engagement Lead**
Senior architect with direct involvement in data schema design, back-end architecture, and build oversight throughout the engagement. This is not a handoff to a remote team. Robert is present from spec through delivery.

**Development Team — 10 Full-Time Engineers (Philippines)**
Full-time dedicated development team under Robert's technical direction, executing against the specification defined in this proposal.

This model delivers enterprise-quality architecture at a price point that makes sense for an MVP. The team has delivered production SaaS platforms on this structure before.

---

## TIMELINE

**30 days to launch-ready product.**

**Note on API Approvals:** LinkedIn Marketing API and Facebook Marketing API approvals typically take 2–6 weeks. These applications should be submitted at contract signing, running in parallel with development. All other platform features are independent of API approval status and will be complete within the 30-day window.

| Week | Milestones |
|---|---|
| Week 1 | Architecture setup, database schema, authentication, RBAC, multi-tenant foundation, multi-ICP admin backend |
| Week 2 | AI content generation engine, compliance workflow, billing integration (with data credit model) |
| Week 3 | Social publishing, LinkedIn automation, Facebook ads, Prospect Finder module, lead management |
| Week 4 | Email integration, analytics dashboard, marketing website, QA, hardening, delivery |

**Launch criteria — all 12 must pass:**

1. Organization can sign up and subscribe via Stripe
2. Advisor can generate AI content with compliance guardrails active
3. Compliance team can review, edit, approve/reject, and export content
4. Approved content can be published to LinkedIn, Facebook, and email
5. LinkedIn messaging campaigns can be created and executed
6. Facebook ads can be created with lead form capture functioning
7. Prospect Finder criteria builder submits requests and imports returned lists
8. Imported prospects flow into lead management and outreach sequences
9. Leads are captured, assigned, and tracked in the system
10. Analytics are visible for all channels including Prospect Finder
11. Platform is stable for pilot customer onboarding
12. All security requirements met (encryption, access controls, audit logging)

---

## POST-MVP ROADMAP

The MVP is the foundation. Here is what Phase 2 looks like:

**Months 2–3: AI Enhancement + Data**
- Meeting notes ingestion and analysis for content topic suggestions
- Firm profile-based hyper-personalization
- Real-time Prospect Finder via direct data provider API (replacing manual import)
- Advanced content variation and A/B testing

**Months 4–6: SMS, VoIP & Integrations**
- SMS marketing campaigns (AI-generated, compliance-reviewed)
- Second phone number / VoIP app for advisors (compliant texting and calling — addressing SEC/FINRA off-channel communication requirements)
- CRM integrations: Salesforce, Redtail, Wealthbox
- Calendar integrations for meeting data ingestion
- Twitter/X and Instagram publishing

**Months 6–12: Enterprise & Additional ICPs**
- Enterprise super-admin dashboard: distribution tree, firm-wide analytics, compliance oversight
- White-label capabilities for broker-dealer partnerships
- Insurance agent ICP configuration
- Loan officer and real estate professional ICP configurations
- Advanced compliance reporting and archiving
- Multi-brand management

**Phase 3: Data Intelligence**
- Aggregated advisor behavioral data (what advisors are prompting, writing about, distributing)
- AI-enriched intelligence layer sold to asset managers and distribution firms
- Lead gen platform for asset managers built on Vireos's unique data position

---

## WHY NOW

### The Timing Argument

Every year FMG Suite doesn't modernize, the gap Shea can fill gets wider. But every year that passes without a credible AI-compliant alternative, advisors normalize the status quo. The window is open now because:

- The 2023 SEC Marketing Rule created new compliance complexity that legacy platforms haven't adapted to
- AI has reached mainstream awareness and leadership-level adoption pressure in the industry
- FMG Suite shows no signs of credible AI product development
- Finney is growing but lacks Shea's distribution network and U.S. compliance depth
- The Canadian competitor is not a U.S. regulatory expert and cannot easily become one

A product that ships in 30 days, with 20 pilot-ready enterprise connections, with a founder who spent 15 years earning the credibility to sell it — that is a first-mover position worth protecting.

### The Shea Werner Variable

Shea brings what most technical founders lack: distribution. Archive Intel's $2M ARR in year one didn't happen because the product was perfect. It happened because Shea knew how to sell it and had the relationships to get in front of the right buyers.

Vireos has the same dynamic. The technology enables the sale. Shea closes it. Lauren, the incoming COO with deep client success experience from Oppenheimer Funds, scales retention and onboarding. That sequencing — distribution first, scale second — is exactly right.

---

## NEXT STEPS

To move from proposal to build:

1. **Sign the engagement agreement** — fixed price, 30-day timeline, success criteria defined above
2. **Submit LinkedIn and Facebook API applications** — do this the same day; approval runs in parallel with development
3. **Identify initial data provider for Prospect Finder** — we will integrate the import workflow; Shea to confirm vendor (e.g., DataDiscovery, AdvisorPro, or equivalent)
4. **Provide initial access and credentials** — OpenAI API key, SendGrid account, Stripe account, AWS/GCP credentials
5. **Kickoff call with Robert** — review architecture decisions, confirm any open specification questions
6. **Week 1 development begins**

---

*This proposal is based on the Vireos MVP Specification, the Executive Summary, and the founding discussion between Shea Werner and Robert Brooks, February 2026. All features described reflect the agreed-upon MVP scope. Phase 2 and Phase 3 features are referenced for context only and are not included in this engagement.*
