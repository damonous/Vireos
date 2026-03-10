# Figma Make Update Tasks — 2026-03-06

**Source:** Shea Werner's Loom video (20260305), written notes, and Fintello competitor screenshots.
**Project:** https://www.figma.com/make/mWeTzYK0qofacf8KmdgHkW/Vireos-SaaS-Web-App-Mockup
**Current Version:** 50

---

## Task 1: Prospect Finder — Add Life Events Filter

**Screen:** `/prospects` (Advisor view)
**Priority:** High
**Current State:** Search Filters panel has: Location, Job Title, Company Size, Industry, Age Range.
**Required Change:** Add a new "Life Events" multi-select filter section below Age Range with options:
- Newborn Child
- New Address / Recently Moved
- New Job Title / Job Change
- Recently Married
- Recently Divorced
- Recently Retired

**Reference:** Shea mentioned data providers and "Finney" have this capability for piping in life event data. This is a key differentiator for financial advisors targeting prospects during major life transitions.

---

## Task 2: Email Sequences — Expand Trigger Options & Add Template Builder

**Screen:** `/email` (Advisor view)
**Priority:** High
**Current State:** "Create New Email Sequence" dialog has only a Sequence Name field and a single Trigger dropdown with "Sign-up" selected. Very minimal.
**Required Changes:**
1. Expand trigger dropdown to include: Sign-up, Lead Added, Form Submission, Facebook Ad Lead, LinkedIn Reply, Manual Enrollment, Tag Added, Status Change
2. Add a multi-step sequence builder (visual timeline/workflow) showing email steps with:
   - Delay between steps (e.g., "Wait 2 days")
   - Email subject line and preview text per step
   - Ability to add/remove/reorder steps
3. Add email template editor for each step (rich text, merge fields like {{first_name}})
4. Reference Fintello's sequence builder for visual style — their product has a more robust template and staging system

**Fintello Reference:** Screenshots at frames 100-150s show their email/content creation flow.

---

## Task 3: Rebrand "AI Content" to "Create Content"

**Screen:** Sidebar navigation (all Advisor views)
**Priority:** Medium
**Current State:** Sidebar shows "AI Content" with a sparkle icon.
**Required Change:** Rename to "Create Content" — remove the "AI" prefix. Shea's reasoning: advisors are still wary of AI terminology; they want the workflows without the AI branding being in their face.

---

## Task 4: Add Multi-Platform Selection to Content Generator

**Screen:** `/content` or content creation flow (Advisor view)
**Priority:** High
**Current State:** Content generation appears to create content for a single platform at a time.
**Required Change:** Add a multi-select platform picker at the top of the content creation form:
- [ ] LinkedIn
- [ ] Facebook
- [ ] Email
- [ ] Ad Copy
- Select All checkbox

When multiple platforms are selected, the AI generates and formats content appropriately for each platform in a single operation, saving the advisor time.

---

## Task 5: Rebrand "AI Assistant" to "Marketing Assistant"

**Screen:** Sidebar navigation (all views)
**Priority:** Medium
**Current State:** Sidebar shows "AI Assistant" as the label for Easy Mode.
**Required Change:** Rename to "Marketing Assistant" (or "Your Marketing Assistant"). Same reasoning as Task 3 — de-emphasize AI terminology. The toggle labels "Easy" / "Boss" may also need revisiting per Shea's feedback, though he acknowledged that's nitpicking and can be changed easily.

---

## Task 6: Compliance Queue — Auto-Distribute on Approval

**Screen:** `/compliance` (Advisor view — approved tab)
**Priority:** High
**Current State:** Approved content just shows an "Approved" status badge. No next-step action is visible.
**Required Changes:**
1. When content is approved, show a status indicating it's queued for auto-distribution (e.g., "Approved — Scheduled for distribution")
2. Add visual confirmation that approved LinkedIn posts will auto-publish and approved emails will auto-send
3. The key principle: once compliance approves, the content goes out automatically — no manual advisor intervention needed

---

## Task 7: Compliance Queue — Rejection Feedback & Inline Editing

**Screen:** `/compliance` (Advisor view — rejected tab)
**Priority:** High
**Current State:** Rejected items show a "Rejected" badge but no explanation or actionable next steps.
**Required Changes:**
1. Add a "Rejection Notes" section showing the compliance officer's feedback explaining why content was rejected
2. Highlight the specific problematic text (similar to how the Compliance Officer view already highlights "guaranteed", "promise", "risk-free" with red badges)
3. Add an "Edit" button directly on the rejected item so the advisor can fix it right there in the compliance queue
4. After editing, an "Resubmit for Review" button puts it back into Pending status
5. Flow: Rejected → Advisor sees why → Edits inline → Resubmits → Compliance re-reviews → Approved → Auto-distributes

---

## Task 8: Publishing Calendar — Add Date/Time Scheduling

**Screen:** `/calendar` (Advisor view)
**Priority:** Medium
**Current State:** Calendar shows scheduled content but the creation/scheduling flow may not prominently feature date/time selection.
**Required Change:** When creating or scheduling content from the publishing calendar, add clear date and time picker controls so advisors can choose exactly when content goes out across each platform.

---

## Task 9: LinkedIn Outreach — Enhanced Campaign Builder

**Screen:** `/linkedin` (Advisor view)
**Priority:** High
**Current State:** Basic campaign list with create/activate functionality.
**Required Changes:**
1. Re-watch the Fintello demo section (frames 250-350s in the Loom video) for reference
2. Improve the campaign setup flow to be more intuitive with:
   - Visual step-by-step sequence builder (connection request → follow-up message → final message)
   - Delay configuration between steps
   - Message template previews
   - Scheduling controls for future outreach campaigns
   - Better staging and organization of campaigns
3. Reference Fintello's LinkedIn outreach UI which Shea specifically called out as "pretty intuitive"

**Fintello Reference:** Frame at ~250s shows their LinkedIn campaign interface with connection request templates and multi-step sequences.

---

## Task 10: Facebook Ads — Full Wizard Workflow (Fintello-Style)

**Screen:** `/facebook` (Advisor view)
**Priority:** Critical
**Current State:** Basic Facebook ads list with campaign creation. Shea explicitly said "this isn't gonna suffice" and "this is just kind of sparse."
**Required Changes — implement a multi-step wizard:**

**Step 1: Campaign Setup**
- Campaign name
- Objective selection

**Step 2: Ad Creative**
- AI-generated stock photo selection (carousel of options to choose from)
- Primary text (AI-generated, editable)
- Headline
- Description
- Call-to-action button (Learn More, Sign Up, Download, etc.)

**Step 3: Ad Preview**
- Desktop preview (Facebook feed card with profile pic, text, image, CTA button)
- Mobile preview
- Ability to toggle between preview formats

**Step 4: Lead Capture**
- Option A: Facebook Lead Form (build a basic form with customizable fields)
- Option B: Landing Page (link to external URL) — can be Phase 2
- Form completion message (headline, description, link, CTA)

**Step 5: Lead Follow-up**
- Auto-enroll captured leads into an email sequence (select from existing sequences)
- Future: SMS integration

**Step 6: Budget**
- Daily budget input (USD)
- Show calculated max daily spend and max weekly spend

**Step 7: Targeting**
- Audience type: Manual (control location, age, gender, interests) or Advantage Audience (Meta AI)
- Audience details: Gender, Age range (e.g., 45-65+)
- Location targeting

**Step 8: Placement**
- Platform selection: Facebook, Instagram (checkboxes)
- Placement: Feed, Stories, Reels, etc.

**Step 9: Review & Submit**
- Summary of all settings
- Submit for compliance review

**Fintello Reference:** Frames 400-620s show the complete Fintello Facebook Ads workflow including the form wizard (5-step: Form Intro, Questions, Privacy Policy, Completion, Finish), targeting, budget, placement, and ad preview with live Facebook card mockup.

---

## Task 11: Analytics Dashboard — Add AUM Metrics

**Screen:** `/analytics` (Advisor view)
**Priority:** Medium
**Current State:** KPI cards show Total Reach, Content Pieces Published, Avg Engagement Rate, Leads Generated. Lead Management shows pipeline value in dollars.
**Required Changes:**
1. Add "AUM" (Assets Under Management) as a tracked metric on the analytics dashboard
2. Replace or supplement "Closed Won" terminology in Lead Management with AUM-oriented language (this is the standard metric financial firms judge performance by)
3. Add an AUM card or section showing: Total New AUM, Average AUM per Client, AUM Growth Trend
4. Pipeline value ($2.3M) could be relabeled to something like "Pipeline AUM" or show both

---

## Task 12: Admin Team Reports — Add AUM Column

**Screen:** `/admin/reports` (Admin view)
**Priority:** Medium
**Current State:** Team Reports table columns: Advisor, Content Published, Leads Generated, Compliance Rate, Active Campaigns, Trend.
**Required Changes:**
1. Add "New AUM" column showing assets under management brought in by each advisor
2. This is a key performance metric for financial firms — Shea mentioned it multiple times
3. Consider replacing or supplementing the "Top Performer" card to factor in AUM

---

## Task 13: Credit System — Hide or Deprioritize

**Screen:** `/billing`, `/prospects`, sidebar
**Priority:** Medium
**Current State:** Credits are prominently displayed: "Credits Remaining: 847" banner on Prospect Finder, credit purchase tiers on Billing page ($10/100, $45/500, $80/1000).
**Required Changes:**
1. Hide or significantly de-emphasize the credit system for now
2. Shea is still evaluating data provider pricing and doesn't understand the backend economics yet
3. Options:
   - Remove the "Credits Remaining" banner from Prospect Finder
   - Remove credit purchase tiers from Billing page
   - Keep the concept but make it less prominent (maybe a small text link instead of the large banner)
4. Can be re-added later when pricing is finalized

---

## Task 14: Super Admin Dashboard — Add ARR Metric

**Screen:** `/super-admin/home` (Super Admin view)
**Priority:** Low
**Current State:** Platform Overview shows: Total Organizations (24), Total Users (187), MRR ($8,940), Active Subscriptions (22).
**Required Changes:**
1. Add ARR (Annual Recurring Revenue) metric card — can be calculated as MRR x 12 or tracked separately
2. Add ability to customize which metrics are displayed (Shea wants "customization on other metrics that we can add in")

---

## Task 15: Compliance Officer View — Polish Interaction States

**Screen:** `/compliance-officer/review` (Compliance Officer view)
**Priority:** Low
**Current State:** Content Review shows pending items with Approve/Reject/Request Edits buttons. Prohibited terms ("guaranteed", "promise", "risk-free") are highlighted. The "Request Edits" button works and changes status to "Edits Requested."
**Required Changes:**
1. Ensure all three actions (Approve, Reject, Request Edits) show clear state changes when clicked
2. Add a notes/comments field when rejecting or requesting edits so the compliance officer can explain what needs to change
3. Shea noted he couldn't do much after clicking buttons — improve the interactive feedback
4. This screen is actually in good shape per the video; Shea acknowledged it may just be Figma limitations

---

## Execution Priority

### Critical (do first)
- **Task 10** — Facebook Ads Wizard (Shea spent the most time on this, explicitly said current version won't work)

### High (do next)
- **Task 1** — Prospect Finder Life Events (first thing mentioned in the video)
- **Task 2** — Email Sequences Enhancement
- **Task 4** — Multi-Platform Content Selection
- **Task 6** — Auto-Distribute on Approval
- **Task 7** — Rejection Feedback & Inline Edit
- **Task 9** — LinkedIn Outreach Enhancement

### Medium (batch together)
- **Task 3** — Rebrand "AI Content" → "Create Content"
- **Task 5** — Rebrand "AI Assistant" → "Marketing Assistant"
- **Task 8** — Publishing Calendar Date/Time
- **Task 11** — Analytics AUM Metrics
- **Task 12** — Admin Team Reports AUM
- **Task 13** — Hide Credit System

### Low (when time permits)
- **Task 14** — Super Admin ARR Metric
- **Task 15** — Compliance Officer Polish

---

## Notes

- Shea was **generally positive** about the overall look and feel: "overall I like the look and feel of this" and "I think this is pretty good for the time being"
- Easy Mode / Boss Mode was well received: "I'm pretty happy with this" — just considering alternative verbiage
- The Easy Mode chat UI resonated because "advisors are already used to using ChatGPT which kind of looks like this"
- Future needs mentioned but not urgent: conversation folders, reporting in Easy Mode, SMS integration, landing page builder
- The Fintello product at `app.fintello.com` is the primary competitor reference — Shea has an account and demoed it extensively
