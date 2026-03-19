# AUMetric Platform
## MVP Phase 1 - Technical Specification

---

## Document Purpose

This document provides the precise technical specification for building the AUMetric MVP. It serves as the single source of truth for all development work.

**Target Timeline:** 30 days to launch-ready product
**Budget Range:** $30,000 - $50,000
**Reference Platform:** [Competing Canadian Product Demo](https://www.youtube.com/watch?v=ImBMT3aSHHE) (skip to 5:00 for UI walkthrough)

---

## 1. Platform Architecture

### 1.1 Technology Stack
- **Frontend:** React.js with TypeScript
- **Backend:** Node.js with Express or NestJS
- **Database:** PostgreSQL
- **Cache:** Redis
- **File Storage:** AWS S3 or equivalent
- **Hosting:** AWS/GCP/Azure (auto-scaling capable)
- **CI/CD:** GitHub Actions or equivalent

### 1.2 Multi-Tenant Architecture
- Single database with tenant isolation via organization_id
- Row-level security for data access
- Tenant-specific configurations (compliance rules, branding)

### 1.3 Initial Infrastructure
- Low-cost entry: $20-50/month servers
- Scalable to load balancers and multi-server when needed
- No vendor lock-in (real code, not no-code)

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | Organization owner/manager | Full access to all features, user management, billing |
| **Advisor** (Basic User) | Financial advisor/marketer | Create content, submit for approval, view own analytics |
| **Compliance** | Compliance officer | Review content, approve/reject, edit, export for records |

### 2.2 Permission Matrix

| Feature | Admin | Advisor | Compliance |
|---------|-------|---------|------------|
| Create Content | Yes | Yes | Yes |
| Edit Any Content | Yes | Own only | Yes |
| Publish Content | Yes | No* | Yes |
| Approve/Reject Content | Yes | No | Yes |
| View All Analytics | Yes | Own only | Yes |
| Manage Users | Yes | No | No |
| Manage Billing | Yes | No | No |
| Export Compliance Records | Yes | No | Yes |

*Advisors can only publish after compliance approval

---

## 3. AI Content Generation

### 3.1 Core Functionality

**User Flow:**
1. Advisor enters topic/prompt (e.g., "Write about Roth conversions for retirees")
2. System generates compliant content
3. Output includes variations for: LinkedIn post, Facebook post, Email, Ad copy
4. Advisor reviews and submits for compliance approval

### 3.2 OpenAI Integration

**API Configuration:**
- Model: GPT-4 Turbo (or latest recommended model)
- Temperature: 0.7 for creative, 0.3 for compliance-heavy
- Max tokens: Appropriate per output type

**Prompt Engineering:**
```
System Prompt Structure:
- Role: Financial marketing copywriter
- Constraints: FINRA Rule 2210, SEC Marketing Rule compliance
- Required elements: Appropriate disclaimers, no promissory language
- Output format: Specified per channel (LinkedIn, FB, Email, Ad)
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

1. **Review Queue** - View all pending content across advisors
2. **Inline Editing** - Make direct edits to content
3. **Return with Notes** - Send back to advisor with specific feedback
4. **Approve** - Mark content ready for publishing
5. **Reject** - Block content with reason
6. **Export** - Generate PDF or Word document of content for records

### 4.3 Notifications

| Event | Recipient | Channel |
|-------|-----------|---------|
| Content submitted | Compliance team | Email + In-app |
| Content approved | Advisor | Email + In-app |
| Content rejected | Advisor | Email + In-app |
| Content needs changes | Advisor | Email + In-app |

### 4.4 Audit Trail

Every content item must track:
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
- Track post performance metrics
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
- pages_read_user_content

### 5.3 Post Management UI

- Content calendar view
- Scheduled vs. Published status
- Edit/Delete scheduled posts
- Performance metrics per post

---

## 6. LinkedIn Messaging Automation

### 6.1 Campaign Library

**Pre-built Campaign Templates:**
- Retirement planning outreach
- Wealth transfer/estate planning
- Small business owner targeting
- Referral request sequences
- Insurance product introduction

**Campaign Structure:**
- Multi-step sequences (1st, 2nd, 3rd message)
- Configurable delays between steps
- Personalization variables

### 6.2 Campaign Builder

**User can configure:**
- Sequence steps and timing
- Message templates with variables
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

### 7.1 Ads Library

**Pre-built Ad Templates:**
- Retirement planning
- Portfolio review offers
- Educational content promotion
- Event registration
- Lead magnet downloads

**Template Properties:**
- Title, Primary Text, Headline, Description
- Sample images
- Recommended audiences
- Suggested budgets

### 7.2 Ad Builder

**Ad Creation Flow:**
1. Select template or start from scratch
2. Configure ad copy fields
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
- Trigger AI assistant outreach
- Configure response timing

---

## 8. Email Marketing

### 8.1 Mailgun Integration

**API:** Mailgun API

**Features:**
- Transactional emails (notifications)
- Marketing emails (campaigns)
- Email templates
- Contact list management
- Analytics (opens, clicks, bounces)

### 8.2 Email Templates

**Template Editor:**
- WYSIWYG editing
- Variable insertion (name, firm, etc.)
- Preview before sending
- Mobile-responsive designs

**Pre-built Templates:**
- Welcome sequence
- Newsletter format
- Event invitation
- Follow-up after meeting
- Nurture sequences

### 8.3 Sequence Builder

**Sequence Configuration:**
- Multiple emails in sequence
- Configurable delays (days/hours)
- Trigger conditions (signup, form submission)
- Stop conditions (unsubscribe, reply)

### 8.4 Nurture Calendar

- Visual calendar of scheduled emails
- Drag-and-drop rescheduling
- Campaign status overview

### 8.5 Analytics Dashboard

- Emails sent, delivered, bounced
- Open rate with trend
- Click rate with trend
- Unsubscribe tracking
- Per-campaign breakdown

---

## 9. Lead Management

### 9.1 Lead Sources

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
- Log activity/notes
- Update status
- Export to CRM (future)

---

## 10. Analytics Dashboard

### 10.1 Cross-Channel Overview

**KPI Cards:**
- Total leads generated
- Total content pieces published
- Total engagement (likes, comments, shares)
- Email performance summary

**Time Range Filters:**
- Today, Yesterday
- Last 7 days, Last 14 days, Last 30 days
- This month, Last month
- Custom range

### 10.2 Channel-Specific Views

**LinkedIn Analytics:**
- Invitations sent/accepted rate
- Message response rates
- Campaign performance by stage
- Top performing campaigns

**Facebook Analytics:**
- Ad impressions, reach, frequency
- Click-through rate (CTR)
- Cost per click (CPC), Cost per lead (CPL)
- ROI tracking (if revenue data available)

**Email Analytics:**
- Send/delivery/bounce rates
- Open and click rates
- Unsubscribe rate
- Best performing emails

**Posts Analytics:**
- Engagement by post type
- Best posting times
- Top performing content

---

## 11. Billing & Subscription

### 11.1 Stripe Integration

**Features:**
- Subscription management
- Multiple pricing tiers
- Payment method management
- Invoice generation
- Webhook handling for events

### 11.2 Subscription Flow

1. User signs up (free trial or paid)
2. Select subscription tier
3. Enter payment information
4. Activate subscription
5. Feature access based on tier

### 11.3 Billing Management UI

- Current plan display
- Usage metrics
- Payment history
- Update payment method
- Upgrade/downgrade plan
- Cancel subscription

---

## 12. Administration

### 12.1 Back-Office Admin Panel

**For AUMetric Staff:**
- View all organizations
- User management
- Subscription overrides
- Usage monitoring
- System health dashboard

### 12.2 Organization Settings

**For Organization Admins:**
- User management (invite, remove, roles)
- Compliance rules configuration
- Connected accounts (LinkedIn, Facebook, Mailgun)
- Billing management
- Firm profile and branding

---

## 13. UI/UX Requirements

### 13.1 Design Principles

- **Utilitarian over flashy** - Focus on workflow simplicity
- **Clear navigation** - Left sidebar for modules, top tabs for sub-sections
- **Consistent patterns** - Tables, forms, and actions follow same patterns
- **Mobile-aware** - Responsive but desktop-primary

### 13.2 Core Navigation

**Left Sidebar:**
- Dashboard
- AI Content
- Posts
- Leads
- LinkedIn
- Facebook
- Emails
- Media Library
- Settings

**Top Navigation:**
- Context-specific tabs per section
- Global time filters
- User menu

### 13.3 Common Components

- Data tables with pagination, search, filters
- Form validation with inline errors
- Confirmation modals for destructive actions
- Toast notifications for success/error
- Loading states for async operations

---

## 14. API Integrations Summary

| Service | Purpose | API |
|---------|---------|-----|
| OpenAI | AI content generation | OpenAI API (GPT-4) |
| LinkedIn | Posting, messaging | LinkedIn Marketing API |
| Facebook | Posting, ads, leads | Facebook Graph API, Marketing API |
| Mailgun | Email delivery | Mailgun API |
| Stripe | Billing | Stripe API |

### 14.1 API Approval Considerations

**LinkedIn:**
- Marketing Developer Platform application required
- Review process for messaging automation

**Facebook:**
- App Review required for ads management
- Business verification for Marketing API

**Note:** API approvals may take 2-6 weeks. Development can proceed with sandbox/test accounts.

---

## 15. Security Requirements

### 15.1 Authentication
- Email/password with strong password policy
- Optional: SSO integration (future)
- Session management with secure tokens
- Password reset flow

### 15.2 Data Protection
- Encryption at rest (database)
- Encryption in transit (TLS)
- PII handling compliance
- Regular security audits

### 15.3 API Security
- API keys stored securely (environment variables)
- OAuth tokens encrypted in database
- Rate limiting on all endpoints

---

## 16. Deliverables Checklist

### Phase 1 MVP (30 days)

- [ ] User authentication and organization setup
- [ ] Role-based access control (Admin, Advisor, Compliance)
- [ ] AI content generation with OpenAI
- [ ] FINRA/SEC compliance guardrails
- [ ] Compliance approval workflow
- [ ] LinkedIn posting integration
- [ ] Facebook posting integration
- [ ] LinkedIn messaging campaigns
- [ ] Facebook ads creation and management
- [ ] Facebook lead form integration
- [ ] Email templates and sequences (Mailgun)
- [ ] Basic analytics dashboard
- [ ] Stripe subscription billing
- [ ] Admin panel (basic)

### Phase 2 (Post-MVP)
- SMS messaging
- Advanced analytics
- CRM integrations
- White-label options
- Enterprise features

---

## 17. Success Criteria

The MVP is complete when:

1. A new organization can sign up and subscribe via Stripe
2. An advisor can generate AI content that incorporates compliance rules
3. Compliance can review, edit, approve/reject, and export content
4. Approved content can be published to LinkedIn and Facebook
5. LinkedIn messaging campaigns can be created and executed
6. Facebook ads can be created with lead form capture
7. Email sequences can be created and sent via Mailgun
8. Basic analytics are visible for all channels
9. The platform is stable enough for pilot customers

---

## Appendix A: Competitor Reference

**Platform:** [Canadian Competitor - Demo Video](https://www.youtube.com/watch?v=ImBMT3aSHHE)

**What to replicate:**
- Overall UI structure and navigation
- Campaign library concept
- Analytics dashboard layout
- Post scheduling workflow

**What to improve:**
- Add AI content generation
- Add compliance workflow
- Add FINRA/SEC guardrails
- Modern, cleaner design

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

---

*Document Version: 1.0*
*Last Updated: February 13, 2026*
*Author: MVP.dev*
