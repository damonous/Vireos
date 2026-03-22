export type ScenarioCategory =
  | 'content'
  | 'prospects'
  | 'analytics'
  | 'leads'
  | 'campaigns'
  | 'compliance'
  | 'linkedin'
  | 'facebook'
  | 'email'
  | 'conversation';

export interface EasyModeScenario {
  id: string;
  category: ScenarioCategory;
  ask: string;
  quickActionLabel?: string;
  mode?: 'new' | 'followup';
  title: string;
  response: string;
  expectedText: string[];
  cardTitle?: string;
  bulletItems?: string[];
  orderedItems?: string[];
  link?: { label: string; href: string };
  codeSnippet?: string;
  priorAssistantText?: string;
}

export const easyModeScenarios: EasyModeScenario[] = [
  {
    id: 'EZ-001',
    category: 'content',
    quickActionLabel: 'Create marketing content',
    ask: 'Create marketing content for my firm',
    title: 'Marketing Content Sprint',
    response: `## Marketing content plan

- Lead with a client pain point around retirement timing.
- Offer one practical next step they can act on this week.
- Close with a light invitation to book a review.

**Recommended CTA:** Invite readers to schedule a portfolio check-in.`,
    expectedText: ['Marketing content plan', 'Recommended CTA'],
    bulletItems: [
      'Lead with a client pain point around retirement timing.',
      'Offer one practical next step they can act on this week.',
      'Close with a light invitation to book a review.',
    ],
  },
  {
    id: 'EZ-002',
    category: 'prospects',
    quickActionLabel: 'Find new prospects',
    ask: 'Find new prospects for my advisory firm',
    title: 'Prospect Finder Playbook',
    response: `## Prospect recommendations

- Target business owners within 10 years of retirement.
- Filter for households that recently sold a property.
- Prioritize referrals from existing tax and legal partners.`,
    expectedText: ['Prospect recommendations'],
    bulletItems: [
      'Target business owners within 10 years of retirement.',
      'Filter for households that recently sold a property.',
      'Prioritize referrals from existing tax and legal partners.',
    ],
  },
  {
    id: 'EZ-003',
    category: 'analytics',
    quickActionLabel: 'View my analytics',
    ask: 'Show me my latest marketing analytics',
    title: 'Latest Analytics Snapshot',
    response: `## Analytics summary

1. LinkedIn is driving the strongest reply rate.
2. Facebook is generating the lowest-cost leads.
3. Email click-through improved after shorter subject lines.

Review the full breakdown in [Boss Mode](/home).`,
    expectedText: ['Analytics summary', 'LinkedIn is driving the strongest reply rate.'],
    orderedItems: [
      'LinkedIn is driving the strongest reply rate.',
      'Facebook is generating the lowest-cost leads.',
      'Email click-through improved after shorter subject lines.',
    ],
    link: { label: 'Boss Mode', href: '/home' },
    cardTitle: 'Analytics Insight Ready',
  },
  {
    id: 'EZ-004',
    category: 'leads',
    quickActionLabel: 'Manage my leads',
    ask: 'Help me manage and follow up with my leads',
    title: 'Lead Follow-Up Workflow',
    response: `## Lead follow-up workflow

- Call hot leads within 24 hours.
- Send a short recap email after each conversation.
- Move cold leads into a 30-day nurture sequence.`,
    expectedText: ['Lead follow-up workflow'],
    bulletItems: [
      'Call hot leads within 24 hours.',
      'Send a short recap email after each conversation.',
      'Move cold leads into a 30-day nurture sequence.',
    ],
  },
  {
    id: 'EZ-005',
    category: 'campaigns',
    quickActionLabel: 'Start a campaign',
    ask: 'Start a new marketing campaign for this month',
    title: 'Monthly Campaign Launch',
    response: `## Campaign launch plan

- Theme: retirement readiness for business owners.
- Channel mix: LinkedIn, email, and retargeting ads.
- KPI: booked meetings from educational content.`,
    expectedText: ['Campaign launch plan'],
    bulletItems: [
      'Theme: retirement readiness for business owners.',
      'Channel mix: LinkedIn, email, and retargeting ads.',
      'KPI: booked meetings from educational content.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-006',
    category: 'content',
    ask: 'Draft a LinkedIn post about retirement readiness for business owners',
    title: 'LinkedIn Retirement Readiness',
    response: `## LinkedIn draft

Business owners often spend years building enterprise value but delay building a retirement runway.

- Start with the gap between business wealth and personal liquidity.
- Share one practical planning checkpoint.
- End with a calm, non-promissory invitation to talk.`,
    expectedText: ['LinkedIn draft', 'Business owners often spend years building enterprise value'],
    bulletItems: [
      'Start with the gap between business wealth and personal liquidity.',
      'Share one practical planning checkpoint.',
      'End with a calm, non-promissory invitation to talk.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-007',
    category: 'content',
    ask: 'Write a Facebook post explaining market volatility calmly',
    title: 'Calm Market Volatility Post',
    response: `## Facebook post

Short-term volatility can feel uncomfortable, but long-term plans are built to absorb periods like this.

Staying anchored to your goals matters more than reacting to every headline.`,
    expectedText: ['Facebook post', 'Staying anchored to your goals matters more than reacting to every headline.'],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-008',
    category: 'content',
    ask: 'Create an email newsletter intro for high-income pre-retirees',
    title: 'Newsletter Intro for Pre-Retirees',
    response: `## Newsletter intro

1. Open with the cost of waiting on tax planning.
2. Position the note as educational, not predictive.
3. Invite the reader to review their retirement income assumptions.`,
    expectedText: ['Newsletter intro'],
    orderedItems: [
      'Open with the cost of waiting on tax planning.',
      'Position the note as educational, not predictive.',
      'Invite the reader to review their retirement income assumptions.',
    ],
  },
  {
    id: 'EZ-009',
    category: 'content',
    ask: 'Draft a webinar invitation about tax-smart retirement planning',
    title: 'Tax-Smart Webinar Invite',
    response: `## Webinar invitation

- Promise practical planning takeaways.
- Mention the audience: high-income professionals nearing retirement.
- Close with a simple registration CTA.`,
    expectedText: ['Webinar invitation'],
    bulletItems: [
      'Promise practical planning takeaways.',
      'Mention the audience: high-income professionals nearing retirement.',
      'Close with a simple registration CTA.',
    ],
  },
  {
    id: 'EZ-010',
    category: 'content',
    ask: 'Turn our quarterly outlook into a one-week content calendar',
    title: 'Quarterly Outlook Calendar',
    response: `## One-week content calendar

### Monday
Publish the macro outlook summary.

### Wednesday
Send an email with one tax planning insight.

### Friday
Post a client-friendly recap and CTA in [Boss Mode](/home).`,
    expectedText: ['One-week content calendar', 'Monday', 'Friday'],
    link: { label: 'Boss Mode', href: '/home' },
  },
  {
    id: 'EZ-011',
    category: 'content',
    ask: 'Rewrite our market recap into three short social captions',
    title: 'Market Recap Social Captions',
    response: `## Social captions

- Markets move quickly, but strong plans are built for long horizons.
- Volatility can create noise, not always a need for drastic action.
- A review of cash flow, tax, and risk still beats reacting to headlines.`,
    expectedText: ['Social captions'],
    bulletItems: [
      'Markets move quickly, but strong plans are built for long horizons.',
      'Volatility can create noise, not always a need for drastic action.',
      'A review of cash flow, tax, and risk still beats reacting to headlines.',
    ],
  },
  {
    id: 'EZ-012',
    category: 'content',
    ask: 'Give me compliant ad copy for a retirement income seminar',
    title: 'Retirement Income Seminar Copy',
    response: `## Ad copy

Join us for an educational session on retirement income planning strategies.

\`Educational only\` language keeps the tone balanced and compliant.`,
    expectedText: ['Ad copy', 'Educational only'],
  },
  {
    id: 'EZ-013',
    category: 'content',
    ask: 'Draft a referral request message I can send after a review meeting',
    title: 'Referral Request Follow-Up',
    response: `## Referral request

Thank you again for your time today. If you know someone who would value a second opinion on retirement planning, I would be happy to help.

Keep the ask warm, optional, and client-centered.`,
    expectedText: ['Referral request', 'Keep the ask warm, optional, and client-centered.'],
  },
  {
    id: 'EZ-014',
    category: 'content',
    ask: 'Create three CTA options for a lead magnet about estate planning',
    title: 'Estate Planning CTAs',
    response: `## CTA options

1. Download the estate planning checklist.
2. Book a 15-minute planning call.
3. Request the family wealth transfer guide.`,
    expectedText: ['CTA options'],
    orderedItems: [
      'Download the estate planning checklist.',
      'Book a 15-minute planning call.',
      'Request the family wealth transfer guide.',
    ],
  },
  {
    id: 'EZ-015',
    category: 'content',
    ask: 'Write a re-engagement note for leads who went cold after a consult',
    title: 'Cold Lead Re-Engagement Note',
    response: `## Re-engagement note

It has been a little while since we last spoke, so I wanted to check in and see whether your planning priorities have shifted.

Offer one small next step instead of a heavy ask.`,
    expectedText: ['Re-engagement note', 'Offer one small next step instead of a heavy ask.'],
  },
  {
    id: 'EZ-016',
    category: 'compliance',
    ask: 'Add a compliant disclaimer to our annuity post',
    title: 'Annuity Post Disclaimer',
    response: `## Compliance update

Add this disclaimer below the post:

> Guarantees are backed by the claims-paying ability of the issuing insurer and product suitability depends on individual circumstances.`,
    expectedText: ['Compliance update', 'Guarantees are backed by the claims-paying ability of the issuing insurer'],
    cardTitle: 'Compliance Workflow Updated',
  },
  {
    id: 'EZ-017',
    category: 'compliance',
    ask: 'Explain why this investment claim might fail compliance review',
    title: 'Investment Claim Review Notes',
    response: `## Review notes

1. The claim implies certainty of outcomes.
2. It lacks balancing risk language.
3. It should be reframed as educational commentary.`,
    expectedText: ['Review notes'],
    orderedItems: [
      'The claim implies certainty of outcomes.',
      'It lacks balancing risk language.',
      'It should be reframed as educational commentary.',
    ],
    cardTitle: 'Compliance Workflow Updated',
  },
  {
    id: 'EZ-018',
    category: 'compliance',
    ask: 'Summarize the compliance changes I should make before approval',
    title: 'Pre-Approval Compliance Changes',
    response: `## Before approval

- Remove promissory language.
- Add product and risk disclosures.
- Replace performance claims with process-oriented statements.`,
    expectedText: ['Before approval'],
    bulletItems: [
      'Remove promissory language.',
      'Add product and risk disclosures.',
      'Replace performance claims with process-oriented statements.',
    ],
    cardTitle: 'Compliance Workflow Updated',
  },
  {
    id: 'EZ-019',
    category: 'compliance',
    mode: 'followup',
    ask: 'Rewrite this promise-heavy copy to sound more conservative',
    title: 'Conservative Rewrite Follow-Up',
    priorAssistantText: 'Here is the original draft focused on retirement confidence.',
    response: `## Conservative rewrite

Instead of promising results, position the copy around planning discipline, risk awareness, and informed decision-making.`,
    expectedText: ['Conservative rewrite', 'Instead of promising results'],
    cardTitle: 'Compliance Workflow Updated',
  },
  {
    id: 'EZ-020',
    category: 'compliance',
    ask: 'Prepare reviewer notes for a Facebook campaign draft',
    title: 'Facebook Campaign Reviewer Notes',
    response: `## Reviewer notes

- Confirm the targeting description stays factual.
- Check that the CTA avoids urgency-based claims.
- Verify the disclaimer placement in the primary text.`,
    expectedText: ['Reviewer notes'],
    bulletItems: [
      'Confirm the targeting description stays factual.',
      'Check that the CTA avoids urgency-based claims.',
      'Verify the disclaimer placement in the primary text.',
    ],
    cardTitle: 'Compliance Workflow Updated',
  },
  {
    id: 'EZ-021',
    category: 'compliance',
    mode: 'followup',
    ask: 'Convert this rejected draft into a compliant version',
    title: 'Rejected Draft Recovery',
    priorAssistantText: 'The prior version was rejected for promissory language and missing disclosures.',
    response: `## Compliant version

Reframe the draft around education, options, and planning context rather than outcomes or guarantees.`,
    expectedText: ['Compliant version', 'Reframe the draft around education, options, and planning context'],
    cardTitle: 'Compliance Workflow Updated',
  },
  {
    id: 'EZ-022',
    category: 'leads',
    ask: 'Prioritize my newest leads by likelihood to book a meeting',
    title: 'Lead Booking Priority List',
    response: `## Priority order

1. Leads who engaged with webinar content in the last 7 days.
2. Leads referred by existing clients.
3. Leads who opened multiple nurture emails but have not booked.`,
    expectedText: ['Priority order'],
    orderedItems: [
      'Leads who engaged with webinar content in the last 7 days.',
      'Leads referred by existing clients.',
      'Leads who opened multiple nurture emails but have not booked.',
    ],
  },
  {
    id: 'EZ-023',
    category: 'leads',
    ask: 'Draft a first outreach message for new LinkedIn leads',
    title: 'First Outreach for LinkedIn Leads',
    response: `## First outreach

Thanks for connecting. I work with professionals who want clearer retirement planning decisions without unnecessary complexity.`,
    expectedText: ['First outreach', 'Thanks for connecting.'],
  },
  {
    id: 'EZ-024',
    category: 'leads',
    ask: 'Build a follow-up plan for leads who have not replied in 14 days',
    title: '14-Day Lead Follow-Up Plan',
    response: `## Follow-up plan

1. Send a short value-based reminder.
2. Wait three business days.
3. Offer a lighter CTA with flexible timing.

\`\`\`text
Day 14: Reminder email
Day 17: Quick voicemail
Day 21: Final check-in
\`\`\``,
    expectedText: ['Follow-up plan', 'Day 14: Reminder email'],
    orderedItems: [
      'Send a short value-based reminder.',
      'Wait three business days.',
      'Offer a lighter CTA with flexible timing.',
    ],
    codeSnippet: 'Day 14: Reminder email',
  },
  {
    id: 'EZ-025',
    category: 'leads',
    ask: 'Summarize which leads need attention this week',
    title: 'Weekly Lead Attention Summary',
    response: `## Leads needing attention

- New leads with no first-touch note.
- Discovery-call leads waiting on recap emails.
- Dormant prospects ready for re-engagement.`,
    expectedText: ['Leads needing attention'],
    bulletItems: [
      'New leads with no first-touch note.',
      'Discovery-call leads waiting on recap emails.',
      'Dormant prospects ready for re-engagement.',
    ],
  },
  {
    id: 'EZ-026',
    category: 'leads',
    ask: 'Write a voicemail and email combo for a warm lead',
    title: 'Warm Lead Voicemail and Email',
    response: `## Voicemail

I wanted to follow up on our recent conversation and make it easy to pick the discussion back up.

## Email

I am happy to send a short planning recap or set up a quick follow-up call if that would help.`,
    expectedText: ['Voicemail', 'Email', 'planning recap'],
  },
  {
    id: 'EZ-027',
    category: 'leads',
    ask: 'Create a re-engagement sequence for dormant prospects',
    title: 'Dormant Prospect Sequence',
    response: `## Re-engagement sequence

- Email 1: revisit the client goal.
- Email 2: offer a short planning update.
- Email 3: close the loop politely if timing is not right.`,
    expectedText: ['Re-engagement sequence'],
    bulletItems: [
      'Email 1: revisit the client goal.',
      'Email 2: offer a short planning update.',
      'Email 3: close the loop politely if timing is not right.',
    ],
  },
  {
    id: 'EZ-028',
    category: 'leads',
    ask: 'Turn my accepted prospects into a lead follow-up checklist',
    title: 'Accepted Prospect Checklist',
    response: `## Follow-up checklist

- Confirm contact details.
- Assign the next outreach owner.
- Set a meeting objective before the first call.`,
    expectedText: ['Follow-up checklist'],
    bulletItems: [
      'Confirm contact details.',
      'Assign the next outreach owner.',
      'Set a meeting objective before the first call.',
    ],
  },
  {
    id: 'EZ-029',
    category: 'linkedin',
    ask: 'Start a LinkedIn outreach campaign for business owners nearing retirement',
    title: 'LinkedIn Outreach for Business Owners',
    response: `## LinkedIn campaign

- Audience: business owners within 10 years of exit.
- Message angle: converting business value into retirement readiness.
- CTA: book a short planning session.`,
    expectedText: ['LinkedIn campaign'],
    bulletItems: [
      'Audience: business owners within 10 years of exit.',
      'Message angle: converting business value into retirement readiness.',
      'CTA: book a short planning session.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-030',
    category: 'linkedin',
    ask: 'Write a LinkedIn connection request and two follow-up messages',
    title: 'LinkedIn Sequence Messages',
    response: `## LinkedIn sequence

1. Connection request focused on shared context.
2. Follow-up message with one planning insight.
3. Final touch with a light CTA.`,
    expectedText: ['LinkedIn sequence'],
    orderedItems: [
      'Connection request focused on shared context.',
      'Follow-up message with one planning insight.',
      'Final touch with a light CTA.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-031',
    category: 'linkedin',
    mode: 'followup',
    ask: 'Rewrite that LinkedIn campaign with a warmer tone',
    title: 'Warmer LinkedIn Rewrite',
    priorAssistantText: 'The current LinkedIn sequence is direct and appointment-focused.',
    response: `## Warmer tone rewrite

Lead with empathy, shared experience, and curiosity before you introduce the planning offer.`,
    expectedText: ['Warmer tone rewrite', 'Lead with empathy, shared experience, and curiosity'],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-032',
    category: 'linkedin',
    ask: 'Create a LinkedIn CTA that gets more appointments',
    title: 'LinkedIn Appointment CTA',
    response: `## CTA options

- Open to a 15-minute planning conversation next week?
- Would a short second opinion on retirement timing be helpful?
- Happy to share a practical planning checklist if useful.`,
    expectedText: ['CTA options'],
    bulletItems: [
      'Open to a 15-minute planning conversation next week?',
      'Would a short second opinion on retirement timing be helpful?',
      'Happy to share a practical planning checklist if useful.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-033',
    category: 'linkedin',
    ask: 'Summarize my LinkedIn campaign performance and next steps',
    title: 'LinkedIn Performance Summary',
    response: `## Performance summary

1. Connection acceptance is healthy.
2. Reply rate drops after the second message.
3. Shorter CTAs should be tested next.`,
    expectedText: ['Performance summary'],
    orderedItems: [
      'Connection acceptance is healthy.',
      'Reply rate drops after the second message.',
      'Shorter CTAs should be tested next.',
    ],
    cardTitle: 'Analytics Insight Ready',
  },
  {
    id: 'EZ-034',
    category: 'linkedin',
    ask: 'Recommend how to improve a low-reply LinkedIn campaign',
    title: 'Low-Reply LinkedIn Recommendations',
    response: `## Recommendations

- Shorten the first follow-up.
- Replace generic authority statements with one practical observation.
- Test a CTA that offers value before asking for time.`,
    expectedText: ['Recommendations'],
    bulletItems: [
      'Shorten the first follow-up.',
      'Replace generic authority statements with one practical observation.',
      'Test a CTA that offers value before asking for time.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-035',
    category: 'facebook',
    ask: 'Start a Facebook campaign for retirement planning seminars',
    title: 'Facebook Seminar Campaign',
    response: `## Facebook campaign

- Objective: webinar registrations.
- Primary audience: pre-retirees within 25 miles.
- Offer: educational seminar on retirement planning.`,
    expectedText: ['Facebook campaign'],
    bulletItems: [
      'Objective: webinar registrations.',
      'Primary audience: pre-retirees within 25 miles.',
      'Offer: educational seminar on retirement planning.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-036',
    category: 'facebook',
    ask: 'Draft three Facebook ad copy variants for pre-retirees',
    title: 'Facebook Ad Copy Variants',
    response: `## Ad copy variants

- Variant 1: focus on retirement income confidence.
- Variant 2: focus on tax-smart planning.
- Variant 3: focus on reducing uncertainty before retirement.`,
    expectedText: ['Ad copy variants'],
    bulletItems: [
      'Variant 1: focus on retirement income confidence.',
      'Variant 2: focus on tax-smart planning.',
      'Variant 3: focus on reducing uncertainty before retirement.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-037',
    category: 'facebook',
    ask: 'Create the thank-you message for our Facebook lead form',
    title: 'Facebook Lead Form Thank-You',
    response: `## Thank-you message

Thanks for requesting the guide. We will send it shortly, and if you would like, you can also book a brief planning call.`,
    expectedText: ['Thank-you message', 'Thanks for requesting the guide.'],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-038',
    category: 'facebook',
    ask: 'Explain the setup steps for a Facebook lead campaign',
    title: 'Facebook Lead Campaign Setup',
    response: `## Setup steps

1. Choose the lead generation objective.
2. Align the ad message with the lead form offer.
3. Confirm consent language and follow-up routing.`,
    expectedText: ['Setup steps'],
    orderedItems: [
      'Choose the lead generation objective.',
      'Align the ad message with the lead form offer.',
      'Confirm consent language and follow-up routing.',
    ],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-039',
    category: 'facebook',
    ask: 'Summarize the quality of my recent Facebook leads',
    title: 'Facebook Lead Quality Summary',
    response: `## Lead quality summary

- Lead volume is steady.
- Conversion quality is strongest from educational offers.
- Follow-up speed remains the main improvement lever.`,
    expectedText: ['Lead quality summary'],
    bulletItems: [
      'Lead volume is steady.',
      'Conversion quality is strongest from educational offers.',
      'Follow-up speed remains the main improvement lever.',
    ],
    cardTitle: 'Analytics Insight Ready',
  },
  {
    id: 'EZ-040',
    category: 'facebook',
    ask: 'Suggest how to reposition my Facebook campaign budget messaging',
    title: 'Facebook Budget Messaging Refresh',
    response: `## Budget messaging refresh

Frame the campaign around efficient education and qualification rather than scale for its own sake.`,
    expectedText: ['Budget messaging refresh', 'Frame the campaign around efficient education and qualification'],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-041',
    category: 'email',
    ask: 'Build a webinar nurture email sequence',
    title: 'Webinar Nurture Sequence',
    response: `## Webinar nurture sequence

- Email 1: confirm registration and expectations.
- Email 2: share one practical takeaway before the event.
- Email 3: follow up with replay and booking CTA.`,
    expectedText: ['Webinar nurture sequence'],
    bulletItems: [
      'Email 1: confirm registration and expectations.',
      'Email 2: share one practical takeaway before the event.',
      'Email 3: follow up with replay and booking CTA.',
    ],
  },
  {
    id: 'EZ-042',
    category: 'email',
    ask: 'Write five subject lines for our quarterly newsletter',
    title: 'Quarterly Newsletter Subject Lines',
    response: `## Subject lines

1. Your quarterly retirement planning check-in
2. Three planning moves to review this quarter
3. What high-income retirees should revisit now`,
    expectedText: ['Subject lines'],
    orderedItems: [
      'Your quarterly retirement planning check-in',
      'Three planning moves to review this quarter',
      'What high-income retirees should revisit now',
    ],
  },
  {
    id: 'EZ-043',
    category: 'email',
    ask: 'Draft a follow-up email after a discovery call',
    title: 'Discovery Call Follow-Up Email',
    response: `## Follow-up email

Thank you for the conversation today. I have summarized the planning priorities we discussed and the next decisions worth reviewing together.`,
    expectedText: ['Follow-up email', 'Thank you for the conversation today.'],
  },
  {
    id: 'EZ-044',
    category: 'email',
    ask: 'Create a re-engagement email for inactive subscribers',
    title: 'Inactive Subscriber Re-Engagement',
    response: `## Re-engagement email

We have not connected in a while, so I wanted to share a simple planning prompt you may find useful this quarter.`,
    expectedText: ['Re-engagement email', 'We have not connected in a while'],
  },
  {
    id: 'EZ-045',
    category: 'email',
    ask: 'Summarize my email campaign performance this month',
    title: 'Email Performance Summary',
    response: `## Email performance

1. Open rate held steady.
2. Click-through improved on shorter copy.
3. Webinar follow-up emails drove the most replies.`,
    expectedText: ['Email performance'],
    orderedItems: [
      'Open rate held steady.',
      'Click-through improved on shorter copy.',
      'Webinar follow-up emails drove the most replies.',
    ],
    cardTitle: 'Analytics Insight Ready',
  },
  {
    id: 'EZ-046',
    category: 'email',
    ask: 'Suggest the next email tests I should run',
    title: 'Next Email Experiments',
    response: `## Next tests

- Compare short and long subject lines.
- Test one CTA versus two CTA options.
- Try a plain-text follow-up against a designed email.`,
    expectedText: ['Next tests'],
    bulletItems: [
      'Compare short and long subject lines.',
      'Test one CTA versus two CTA options.',
      'Try a plain-text follow-up against a designed email.',
    ],
  },
  {
    id: 'EZ-047',
    category: 'analytics',
    ask: 'Give me a monthly marketing performance summary',
    title: 'Monthly Marketing Summary',
    response: `## Monthly performance summary

- Content output increased week over week.
- Lead generation is strongest from webinars and Facebook.
- Follow-up speed remains the fastest path to more meetings.`,
    expectedText: ['Monthly performance summary'],
    bulletItems: [
      'Content output increased week over week.',
      'Lead generation is strongest from webinars and Facebook.',
      'Follow-up speed remains the fastest path to more meetings.',
    ],
    cardTitle: 'Analytics Insight Ready',
  },
  {
    id: 'EZ-048',
    category: 'analytics',
    ask: 'Compare my lead sources and tell me where to focus',
    title: 'Lead Source Focus Summary',
    response: `## Lead source focus

1. Facebook is strongest for volume.
2. LinkedIn is strongest for reply quality.
3. Email is strongest for reactivation and nurture.`,
    expectedText: ['Lead source focus'],
    orderedItems: [
      'Facebook is strongest for volume.',
      'LinkedIn is strongest for reply quality.',
      'Email is strongest for reactivation and nurture.',
    ],
    cardTitle: 'Analytics Insight Ready',
  },
  {
    id: 'EZ-049',
    category: 'conversation',
    mode: 'followup',
    ask: "Continue yesterday's campaign strategy and tighten the CTA",
    title: 'Campaign Strategy Follow-Up',
    priorAssistantText: 'Yesterday we mapped the campaign around educational webinars and LinkedIn outreach.',
    response: `## CTA refinement

Tighten the CTA to one low-friction ask: invite the reader to a short planning conversation or checklist download.`,
    expectedText: ['CTA refinement', 'Tighten the CTA to one low-friction ask'],
    cardTitle: 'Campaign Workflow Updated',
  },
  {
    id: 'EZ-050',
    category: 'conversation',
    mode: 'followup',
    ask: 'Summarize our last conversation and list the next three actions',
    title: 'Conversation Summary and Next Actions',
    priorAssistantText: 'We agreed to focus on webinar promotion, lead routing, and compliance-safe language.',
    response: `## Next actions

1. Finalize the webinar invitation copy.
2. Route hot leads into a 24-hour follow-up workflow.
3. Send the latest draft for compliance review.`,
    expectedText: ['Next actions'],
    orderedItems: [
      'Finalize the webinar invitation copy.',
      'Route hot leads into a 24-hour follow-up workflow.',
      'Send the latest draft for compliance review.',
    ],
  },
];
