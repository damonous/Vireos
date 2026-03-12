# Vireos Platform
## MVP Phase 1 - Technical Specification

---

## Document Purpose

This document provides the precise technical specification for building the Vireos MVP with a $37,291 budget and AI-first content generation approach.

**Target Timeline:** 30 days to launch-ready product
**Budget:** $37,291
**Core Focus:** AI-generated personalized content (NOT templates) + integrated prospect discovery

---

## 1. Platform Architecture

### 1.1 Technology Stack
- **Frontend:** React.js with TypeScript
- **Backend:** Node.js with Express
- **Database:** PostgreSQL
- **Cache:** Redis (optional for MVP)
- **File Storage:** AWS S3 or equivalent
- **Hosting:** AWS/GCP/Azure (scalable)
- **CI/CD:** GitHub Actions

### 1.2 Multi-Tenant Architecture
- Single database with tenant isolation via organization_id
- Row-level security for data access
- Tenant-specific compliance rules

### 1.3 Multi-ICP Architecture
The backend admin panel supports configuring ICP-specific settings per vertical:
- **ICP types:** Financial advisors (MVP), Insurance agents, Loan officers, Real estate professionals (Phase 2)
- Admins configure compliance rules, content guardrails, workflow terminology, and outreach templates per ICP type
- No code changes required to add a new ICP vertical — data-driven configuration only
- This allows Vireos to serve new industries without rebuilding the platform

### 1.4 Initial Infrastructure
- Cost-effective: $20-50/month servers
- Scalable when needed
- No vendor lock-in (real code, not no-code)

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| **Super Admin** | Vireos internal staff | All organizations, ICP configuration, system health |
| **Admin** | Organization owner | Full access, user management, billing |
| **Advisor** | Financial advisor | Create content, submit for approval, use Prospect Finder |
| **Compliance** | Compliance officer | Review, approve/reject, edit content |

### 2.2 Permission Matrix

| Feature | Super Admin | Admin | Advisor | Compliance |
|---------|-------------|-------|---------|------------|
| Create Content | Yes | Yes | Yes | Yes |
| Edit Any Content | Yes | Yes | Own only | Yes |
| Publish Content | Yes | Yes | No* | Yes |
| Approve/Reject | Yes | Yes | No | Yes |
| View Analytics | All | All | Own only | All |
| Manage Users | Yes | Yes | No | No |
| Manage Billing | Yes | Yes | No | No |
| Prospect Finder | Yes | Yes | Yes | No |
| Configure ICP Settings | Yes | No | No | No |

*Advisors can only publish after compliance approval

---

## 3. AI Content Generation (Core Feature)

### 3.1 Core Functionality

**User Flow:**
1. Advisor enters topic/prompt: "Write about Roth conversions for tech executives in their 50s"
2. System generates compliant content using AI
3. Output includes variations for: LinkedIn post, Facebook post, Email, Ad copy
4. Advisor reviews and submits for compliance approval

**Key Point:** NO TEMPLATES. All content is AI-generated fresh based on prompts.

### 3.2 OpenAI Integration

**API Configuration:**
- Model: Latest OpenAI model (configured via environment variable)
- Max tokens: Appropriate per output type

**Prompt Engineering:**
```
System Prompt Structure:
- Role: Financial marketing copywriter specializing in wealth management
- Constraints: FINRA Rule 2210, SEC Marketing Rule compliance
- Required elements: Appropriate disclaimers, no promissory language
- Output format: Optimized per channel (LinkedIn, Facebook, Email, Ad)
- Personalization: Based on advisor's prompt and context
- ICP context: Injected from organization's ICP configuration
```

### 3.3 Regulatory Guardrails (FINRA/SEC)

**Pre-Generation Constraints:**
- Block prohibited terms (guarantees, promises of returns)
- Require risk disclosures for investment content
- Enforce fair and balanced presentation

**Post-Generation Validation:**
- Scan for compliance violations
- Auto-insert required disclaimers
- Flag content for human review if uncertain

**Configurable Compliance Rules:**
- Firm-specific disclosure language
- Custom prohibited word lists
- Required footer text per content type

### 3.4 Usage Tracking
- Tokens consumed per request
- Cost tracking per user/organization
- Content ID correlation for audit trail

---

## 4. Compliance Workflow

### 4.1 Content Status States

```
Draft -> Pending Review -> [Approved | Rejected | Needs Changes] -> Published
```

| Status | Description |
|--------|-------------|
| Draft | Created but not submitted |
| Pending Review | Submitted, awaiting compliance |
| Needs Changes | Returned to advisor with notes |
| Approved | Ready to publish |
| Rejected | Cannot be published |
| Published | Live on channel |
| Archived | Historical record |

### 4.2 Compliance User Capabilities

1. **Review Queue** - View all pending content
2. **Inline Editing** - Make direct edits
3. **Return with Notes** - Send back with feedback
4. **Approve** - Mark ready for publishing
5. **Reject** - Block content with reason
6. **Export** - Generate PDF/Word for records

### 4.3 Notifications

| Event | Recipient | Channel |
|-------|-----------|---------|
| Content submitted | Compliance | Email + In-app |
| Content approved | Advisor | Email + In-app |
| Content rejected | Advisor | Email + In-app |
| Changes needed | Advisor | Email + In-app |

### 4.4 Audit Trail

Every content item tracks:
- Creation timestamp and user
- All edits with timestamp and user
- Status changes with timestamp and user
- Approval/rejection with timestamp and user
- Publication timestamp and channel

---

## 5. Social Publishing

### 5.1 LinkedIn Integration

**API:** LinkedIn Marketing API

**Features:**
- Post text content with images
- Schedule posts for future publication
- Track basic performance metrics
- OAuth 2.0 authentication per user

**Required Permissions:**
- w_member_social (post on behalf of user)
- r_liteprofile (basic profile info)

### 5.2 Facebook Integration

**API:** Facebook Graph API

**Features:**
- Post to Facebook Pages
- Schedule posts
- Track engagement metrics
- OAuth authentication

**Required Permissions:**
- pages_manage_posts
- pages_read_engagement

### 5.3 Post Management UI

- Content calendar view
- Scheduled vs. Published status
- Edit/Delete scheduled posts
- Basic performance metrics per post

---

## 6. LinkedIn Messaging Automation

### 6.1 Campaign Library

**AI-Generated Campaign Templates:**
- Retirement planning outreach
- Wealth transfer/estate planning
- Small business owner targeting
- Referral request sequences
- Insurance product introduction

**Campaign Structure:**
- Multi-step sequences (1st, 2nd, 3rd message)
- Configurable delays between steps
- AI-generated personalization based on prospect data

### 6.2 Campaign Builder

**User can configure:**
- Sequence steps and timing
- AI generates message templates with personalization
- Stop conditions (reply received, connection dropped)
- Target audience criteria

### 6.3 Execution Engine

**Automation Rules:**
- Respect LinkedIn rate limits
- Daily sending limits per user
- Business hours only (configurable)
- Auto-stop on reply

### 6.4 Analytics

- Invitations sent/accepted
- Messages sent/opened/replied
- Conversion by campaign stage
- Pipeline value tracking

---

## 7. Facebook Ads Management

### 7.1 AI-Generated Ads Library

**AI-Generated Ad Templates:**
- Retirement planning
- Portfolio review offers
- Educational content promotion
- Event registration
- Lead magnet downloads

**AI generates:**
- Title, Primary Text, Headline, Description
- Multiple variations for A/B testing
- Compliance-checked copy

### 7.2 Ad Builder

**Ad Creation Flow:**
1. Provide AI with campaign objective and target audience
2. AI generates compliant ad copy variations
3. Upload/select images (carousel support)
4. Set budget and schedule
5. Define targeting (demographics, interests)
6. Select placements (Facebook Feed, Instagram)
7. Preview ad appearance
8. Submit for compliance approval
9. Launch after approval

### 7.3 Facebook Marketing API Integration

**API:** Facebook Marketing API

**Required Features:**
- Create/manage ad campaigns
- Create/manage ad sets
- Create/manage ads
- Upload ad creatives
- Configure audiences
- Budget management

**Lead Form Integration:**
- Create Facebook Lead Forms
- Retrieve lead submissions
- Webhook for real-time leads

### 7.4 Lead Capture Configuration

**Options:**
1. **Landing Page** - Redirect to external URL
2. **Facebook Lead Form** - Native form capture

**Lead Follow-up Automation:**
- Auto-add to email sequence
- Configure response timing
- AI-generated follow-up messages

---

## 8. Prospect Finder (ICP Search & Discovery)

### 8.1 Overview

The Prospect Finder allows advisors to build targeted prospect lists within the platform by specifying search criteria. In MVP, list fulfillment is handled manually by Vireos using a third-party data provider; the architecture supports a future direct API integration without any frontend changes.

### 8.2 Criteria Builder UI

**Search Parameters:**
| Parameter | Type | Example |
|-----------|------|---------|
| Geography | Zip code / area code | 80202, 802 |
| Net Worth | Range | $500K–$2M |
| Employer | Company name | Lockheed Martin, U.S. Government |
| Industry / Occupation | Select | Technology, Healthcare, Government |
| Professional Designation | Select | 401(k) participant, business owner |
| LinkedIn Profile Required | Boolean | Yes/No |
| Validated Email Required | Boolean | Yes/No |

**Request Submission:**
- Advisor submits criteria as a "Prospect List Request"
- Platform notifies Vireos staff of new request
- Vireos sources data and imports returned list
- Advisor is notified when list is ready

### 8.3 Data Credit System

**Credit model:**
- Advisors purchase credit bundles (e.g., 1,000 credits, 5,000 credits)
- Each record in a returned list costs credits (based on data provider cost + margin)
- Credits are tracked per organization and per advisor
- Credit balance visible in billing dashboard
- Alerts when credits fall below threshold

**Credit pricing tiers (placeholder — finalized with data provider):**
- Standard records: ~1 credit/record
- LinkedIn-verified records: ~2 credits/record
- Email-validated records: ~1.5 credits/record

### 8.4 List Management

**Returned List Properties:**
- First name, last name
- Email (validated)
- LinkedIn profile URL
- Phone (if available)
- Employer
- Geography
- Source tag: "Prospect Finder"

**Actions on Imported List:**
- Preview before consuming credits
- Enroll entire list or selected records into outreach sequence
- Push to Lead Management with status "New"
- Export to CSV

### 8.5 Future State (Phase 2)

Direct API integration with data provider (e.g., DataDiscovery, AdvisorPro) replaces manual fulfillment:
- Real-time search results returned to UI
- No change to frontend criteria builder or list management UI
- Back-end upgrade only

---

## 9. Lead Management

### 9.1 Lead Sources

- Prospect Finder (primary new source)
- Facebook Lead Forms
- Website forms (future)
- Manual import (CSV)
- LinkedIn connections (sync)

### 9.2 Lead Properties

| Field | Type | Required |
|-------|------|----------|
| First Name | String | Yes |
| Last Name | String | Yes |
| Email | String | Yes |
| Phone | String | No |
| Source | Enum | Yes |
| Campaign | Reference | No |
| Status | Enum | Yes |
| Assigned Advisor | Reference | No |
| Created At | Timestamp | Yes |
| Custom Fields | JSON | No |

### 9.3 Lead Statuses

```
New -> Contacted -> Engaged -> Meeting Scheduled -> Client -> Lost
```

### 9.4 Lead Actions

- Assign to advisor
- Add to email sequence
- Add to LinkedIn outreach campaign
- Log activity/notes
- Update status
- Export to CRM (future)

---

## 10. Email Marketing

### 10.1 SendGrid Integration

**API:** SendGrid v3 API

**Features:**
- Transactional emails (notifications)
- Marketing emails (campaigns)
- Email templates
- Contact list management
- Analytics (opens, clicks, bounces)

### 10.2 Email Templates

**Template Editor:**
- WYSIWYG editing
- Variable insertion (name, firm, etc.)
- Preview before sending
- Mobile-responsive designs

**AI-Generated Templates:**
- Advisor provides prompt
- AI generates email content
- Subject line variations
- CTA suggestions

### 10.3 Email Sequences

**Sequence Configuration:**
- Multiple emails in sequence
- Configurable delays (days/hours)
- Trigger conditions (signup, form submission, prospect list import)
- Stop conditions (unsubscribe, reply)

### 10.4 Email Analytics

- Emails sent, delivered, bounced
- Open rate with trend
- Click rate with trend
- Unsubscribe tracking

---

## 11. Analytics Dashboard

### 11.1 Cross-Channel Overview

**Summary Cards:**
- Total content pieces created
- Total content published
- Total engagement (likes, comments, shares)
- Email performance summary
- Prospect lists generated / credits used

**Time Range Filters:**
- Last 7 days, Last 30 days
- This month, Last month
- Custom range

### 11.2 Channel-Specific Views

**LinkedIn Analytics:**
- Posts published
- Engagement (likes, comments, shares)
- Invitations sent/accepted rate
- Message response rates
- Campaign performance by stage
- Top performing posts

**Facebook Analytics:**
- Posts published
- Engagement metrics
- Reach and impressions
- Ad impressions, reach, frequency
- Click-through rate (CTR)
- Cost per click (CPC), Cost per lead (CPL)
- ROI tracking

**Email Analytics:**
- Send/delivery/bounce rates
- Open and click rates
- Best performing emails
- Unsubscribe rate

**Lead Analytics:**
- Leads by source (Prospect Finder, Facebook, manual)
- Conversion funnel
- Pipeline value

**Prospect Finder Analytics:**
- Lists requested / fulfilled
- Credits consumed
- Records imported
- Conversion rate: prospect → lead → engaged → client

---

## 12. Billing & Subscription

### 12.1 Stripe Integration

**Features:**
- Subscription management
- Multiple pricing tiers
- Data credit purchases (one-time charges)
- Payment method management
- Invoice generation
- Webhook handling for events

### 12.2 Subscription Tiers

| Tier | Price | Users | Includes |
|------|-------|-------|---------|
| Individual | $299/month | 1 | All platform features |
| Team | Custom | 2–10 | All features + team management |
| Enterprise | Custom | Unlimited | All features + enterprise admin |

### 12.3 Data Credit Purchases

- Credit bundles available for one-time purchase via Stripe
- Credits tied to organization account
- Balance tracked and displayed in billing dashboard
- Auto-purchase threshold option (coming Phase 2)

### 12.4 Billing Management UI

- Current plan display
- Credit balance and usage history
- Payment history
- Update payment method
- Upgrade/downgrade plan
- Cancel subscription

---

## 13. Administration

### 13.1 Vireos Back-Office Admin Panel

**For Vireos Staff:**
- View all organizations
- User management
- Subscription overrides
- Usage monitoring
- System health dashboard
- **Prospect List Request queue** — view and fulfill incoming requests
- **ICP Configuration** — add/configure industry verticals with custom compliance rules, content prompts, and terminology

### 13.2 Organization Settings

**For Organization Admins:**
- User management (invite, remove, roles)
- Compliance rules configuration
- Connected accounts (LinkedIn, Facebook, SendGrid)
- Billing management
- Data credit balance
- Firm profile and branding

---

## 14. Marketing Website

### 14.1 Pages

**Landing Page (vireos.ai):**
- Hero: headline, subheadline, primary CTA (Start Free Trial / Request Demo)
- Problem section: what advisors are dealing with today
- Solution section: how Vireos solves it
- Feature highlights: AI content, compliance workflow, Prospect Finder, multi-channel publishing
- Competitive differentiation table
- Pricing tiers
- Social proof / testimonials placeholder
- Footer CTA

**About Page:**
- Founder story (Shea Werner background, Archive Intel, why Vireos)
- Company mission
- Team section (Shea + Lauren)

### 14.2 Technical Requirements

- Responsive design (desktop-primary, mobile-functional)
- Fast load times (Lighthouse score > 90)
- Contact/demo request form with email notification
- Domain: vireos.ai (client to configure DNS)

---

## 15. UI/UX Requirements

### 15.1 Design Principles

- **Utilitarian over flashy** - Focus on workflow simplicity
- **Clear navigation** - Left sidebar for modules
- **Consistent patterns** - Tables, forms, actions follow same patterns
- **Mobile-aware** - Responsive but desktop-primary

### 15.2 Core Navigation

**Left Sidebar:**
- Dashboard
- AI Content Generator
- Posts & Calendar
- LinkedIn Campaigns
- Facebook Ads
- Prospect Finder
- Email Campaigns
- Leads
- Analytics
- Settings

**Top Navigation:**
- Context-specific tabs
- Global time filters
- User menu / credit balance indicator

### 15.3 Common Components

- Data tables with pagination, search, filters
- Form validation with inline errors
- Confirmation modals for destructive actions
- Toast notifications for success/error
- Loading states for async operations

---

## 16. API Integrations Summary

| Service | Purpose | API |
|---------|---------|-----|
| OpenAI | AI content generation | OpenAI API |
| LinkedIn | Social posting + messaging | LinkedIn Marketing API |
| Facebook | Social posting + ads | Facebook Graph API |
| SendGrid | Email delivery | SendGrid v3 API |
| Stripe | Billing + credit purchases | Stripe API |
| Data Provider | Prospect list fulfillment (manual import in MVP) | CSV / future API |

### 16.1 API Approval Considerations

**LinkedIn:**
- Marketing Developer Platform application required
- Review process for posting permissions

**Facebook:**
- App Review required for page management
- Business verification may be needed

**Note:** API approvals may take 2-6 weeks. Development can proceed with sandbox/test accounts.

---

## 17. Security Requirements

### 17.1 Authentication
- Email/password with strong password policy
- Session management with secure tokens
- Password reset flow

### 17.2 Data Protection
- Encryption at rest (database)
- Encryption in transit (TLS)
- PII handling compliance
- Regular security audits

### 17.3 API Security
- API keys stored securely (environment variables)
- OAuth tokens encrypted in database
- Rate limiting on all endpoints

---

## 18. MVP Deliverables Checklist

### Phase 1 MVP (30 days) - $37,291

**Core Platform:**
- [ ] User authentication and organization setup
- [ ] Role-based access control (Super Admin, Admin, Advisor, Compliance)
- [ ] Multi-tenant architecture
- [ ] Multi-ICP admin configuration backend

**AI Content Generation:**
- [ ] OpenAI integration
- [ ] FINRA/SEC compliance guardrails
- [ ] Multi-channel content generation (LinkedIn, Facebook, Email)
- [ ] Content versioning and history

**Compliance Workflow:**
- [ ] Approval workflow (Draft → Review → Approved/Rejected)
- [ ] Inline editing for compliance team
- [ ] Export to PDF/Word for recordkeeping
- [ ] Audit trail for all content

**Publishing:**
- [ ] LinkedIn posting integration
- [ ] Facebook posting integration
- [ ] Email delivery via SendGrid
- [ ] Post scheduling

**LinkedIn Automation:**
- [ ] LinkedIn messaging campaigns
- [ ] Campaign builder with AI-generated messages
- [ ] Automation engine with rate limits
- [ ] Campaign analytics

**Facebook Ads:**
- [ ] Facebook ads creation and management
- [ ] AI-generated ad copy variations
- [ ] Facebook lead form integration
- [ ] Lead capture and routing

**Prospect Finder:**
- [ ] Criteria builder UI (geography, net worth, employer, industry)
- [ ] Request submission workflow + Vireos staff notification
- [ ] List import and preview
- [ ] Data credit system (purchase, track, deduct)
- [ ] Prospect → Lead pipeline integration

**Lead Management:**
- [ ] Lead capture from multiple sources
- [ ] Lead status tracking and pipeline
- [ ] Lead assignment and routing
- [ ] Activity logging

**Analytics:**
- [ ] Cross-channel dashboard with KPIs
- [ ] LinkedIn campaign analytics
- [ ] Facebook ads performance
- [ ] Email performance metrics
- [ ] Lead funnel analytics
- [ ] Prospect Finder usage and conversion analytics

**Billing:**
- [ ] Stripe subscription integration
- [ ] Multiple pricing tiers
- [ ] Data credit purchase and tracking
- [ ] Admin panel (basic)

**Marketing Website:**
- [ ] Landing page (vireos.ai)
- [ ] About page
- [ ] Demo/contact request form

### NOT in MVP (Phase 2+)
- Meeting data ingestion and analysis
- CRM integrations (Salesforce, Redtail, Wealthbox)
- SMS marketing campaigns
- VoIP / second phone number for advisors
- Real-time data provider API for Prospect Finder
- Advanced analytics and reporting
- White-label options
- Insurance agent / real estate ICP configurations

---

## 19. Success Criteria

The MVP is complete when:

1. A new organization can sign up and subscribe via Stripe
2. An advisor can generate AI content with compliance guardrails
3. Compliance can review, edit, approve/reject, and export content
4. Approved content can be published to LinkedIn, Facebook, and Email
5. LinkedIn messaging campaigns can be created and executed
6. Facebook ads can be created with lead form capture
7. Advisor can submit a Prospect Finder request with criteria
8. Vireos staff can fulfill request and import list into platform
9. Imported prospects flow into lead management and outreach sequences
10. Data credits are tracked, deducted, and visible in billing
11. Analytics are visible for all channels (social, ads, email, leads, prospects)
12. Marketing website is live at vireos.ai
13. The platform is stable for pilot customers
14. All security requirements are met

---

## 20. Budget Breakdown

**Total: $37,291**

**Development:**
- Platform architecture & multi-ICP setup: $2,500
- User authentication & RBAC: $2,200
- AI content generation (core feature): $4,500
- Compliance workflow: $3,200
- Social publishing (LinkedIn, Facebook): $3,300
- LinkedIn messaging automation: $3,200
- Facebook ads management: $2,700
- Prospect Finder module: $2,800
- Lead management: $1,700
- Email integration (SendGrid): $2,200
- Analytics dashboard: $2,200
- Stripe billing (subscriptions + data credits): $1,700
- Marketing website (landing + about): $2,500
- Testing & QA: $2,591

**Infrastructure (not included in fixed price):**
- Hosting: ~$50-200/month
- API costs (OpenAI, SendGrid): ~$0.10-0.50 per user/month
- Stripe fees: 2.9% + $0.30 per transaction
- Data provider costs: passed through to advisors via credits

---

## 21. Post-MVP Roadmap (Phase 2)

**Months 2-3: AI Enhancement + Data**
- Meeting notes ingestion and analysis
- Automatic content topic suggestions based on meeting data
- Firm profile-based hyper-personalization
- Real-time Prospect Finder via direct data provider API
- Advanced AI content variations

**Months 4-6: SMS, VoIP & Integrations**
- SMS marketing campaigns (AI-generated, compliance-reviewed)
- Second phone number / VoIP app for advisors
  - Addresses SEC/FINRA "off-channel communication" crackdown
  - Inspired by CurrentClient — but integrated with AI automation and outreach workflows
  - Compliance archiving of all text and call records
- CRM integrations (Salesforce, Redtail, Wealthbox)
- Calendar integrations for meeting data
- Additional social channels (Twitter/X, Instagram)

**Months 6-12: Enterprise & Additional ICPs**
- Enterprise super-admin: distribution tree, firm-wide analytics, compliance oversight
- White-label capabilities
- Insurance agent ICP
- Loan officer ICP
- Real estate professional ICP
- Advanced analytics and reporting
- Custom workflows and automations

**Phase 3: Data Intelligence**
- Aggregated advisor behavioral data (prompt trends, content topics, publishing patterns)
- AI-enriched intelligence sold to asset managers
- Lead gen platform for asset managers (AI-enriched vs. raw data scrapers like DataDiscovery/AdvisorPro)

---

## Appendix A: Key Differences from Previous Spec

| Feature | Previous Spec | This Spec |
|---------|---------------|-----------|
| Company Name | AUMetric | **Vireos (vireos.ai)** |
| Budget | $31,991 | **$37,291** |
| Prospect Discovery | Not included | **Prospect Finder module** |
| Marketing Website | Not included | **Included** |
| ICP Architecture | Financial advisors only | **Multi-ICP admin backend** |
| Revenue Target | $180K ARR | **$360K ARR** |
| Pricing | $150/month avg | **$300/month per advisor** |
| Data Credits | Not applicable | **Full credit system in Stripe** |

---

## Appendix B: Regulatory Reference

### FINRA Rule 2210 (Communications with the Public)
- Fair and balanced content
- No promissory statements about returns
- Risk disclosures required
- Approval and recordkeeping requirements

### SEC Marketing Rule (2023 updates)
- No misleading statements
- Performance advertising restrictions
- Testimonial/endorsement rules
- Required disclosures

### SEC/FINRA Off-Channel Communication (Phase 2 context)
- Regulators have been fining firms for advisor texting on personal devices
- SMS/VoIP module in Phase 2 addresses this by providing a compliant, archived channel

---

*Document Version: 3.0*
*Last Updated: February 2026*
*Author: MVP.dev*
