// =============================================================================
// Vireos — Database Seed
// =============================================================================
// Seeds foundational data for local development and staging environments.
//
// Usage:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
//
// Or via package.json script:
//   npm run prisma:seed
// =============================================================================

import {
  PrismaClient,
  UserRole,
  UserStatus,
  SubscriptionStatus,
  CreditTransactionType,
  ContentStatus,
  ContentChannel,
  LeadSource,
  LeadStatus,
  CampaignStatus,
  ProspectRequestStatus,
  EmailSequenceStatus,
  EmailEnrollmentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'Password123!';
const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main(): Promise<void> {
  console.log('Starting database seed...');

  // ---------------------------------------------------------------------------
  // 1. ICP Configuration — Financial Advisors
  // ---------------------------------------------------------------------------
  console.log('Seeding ICP configuration...');

  const icpConfig = await prisma.icpConfiguration.upsert({
    where: { slug: 'financial-advisors' },
    update: {},
    create: {
      name: 'Financial Advisors',
      slug: 'financial-advisors',
      contentPromptPrefix: [
        'You are a compliance-aware content writer for registered investment advisors (RIAs)',
        'and broker-dealers regulated by FINRA and the SEC.',
        'All content must avoid performance guarantees, misleading statements, and prohibited terms.',
        'Include required disclosures where applicable.',
        'Use clear, professional language suitable for retail investors.',
      ].join(' '),
      complianceRules: {
        requireDisclosures: true,
        prohibitPerformanceGuarantees: true,
        requireRegulatoryLanguage: true,
        maxPromisoryLanguageScore: 0.3,
        regulatoryBodies: ['FINRA', 'SEC', 'CFP Board'],
      },
      prohibitedTerms: [
        'guaranteed returns',
        'risk-free',
        'guaranteed profit',
        'no risk',
        '100% safe',
        'beat the market',
        'sure thing',
        'get rich',
        'overnight success',
        'double your money',
      ],
      requiredDisclosures: {
        linkedin: 'Past performance is not indicative of future results. Investments involve risk.',
        facebook: 'Past performance is not indicative of future results. Investments involve risk.',
        email: 'This communication is for informational purposes only and does not constitute investment advice.',
        adCopy: 'Investing involves risk. Past performance does not guarantee future results.',
      },
      workflowTerminology: {
        clientsLabel: 'clients',
        prospectsLabel: 'prospects',
        advisorLabel: 'financial advisor',
        firmLabel: 'advisory firm',
        contentReviewLabel: 'compliance review',
      },
      isActive: true,
    },
  });

  console.log(`  ICP Configuration: ${icpConfig.name} (${icpConfig.id})`);

  // ---------------------------------------------------------------------------
  // 2. Organization — Vireos Demo Firm
  // ---------------------------------------------------------------------------
  console.log('Seeding demo organization...');

  const organization = await prisma.organization.upsert({
    where: { slug: 'vireos-demo' },
    update: {},
    create: {
      name: 'Vireos Demo Firm',
      slug: 'vireos-demo',
      icpType: 'financial_advisor',
      complianceRules: {
        requireDisclosures: true,
        prohibitPerformanceGuarantees: true,
        requireRegulatoryLanguage: true,
        autoFlagSuspiciousContent: true,
      },
      prohibitedTerms: [
        'guaranteed returns',
        'risk-free',
        'guaranteed profit',
        'no risk',
        '100% safe',
      ],
      requiredDisclosures: {
        linkedin: 'Past performance is not indicative of future results. Investments involve risk.',
        facebook: 'Past performance is not indicative of future results. Investments involve risk.',
        email: 'This communication is for informational purposes only and does not constitute investment advice.',
        adCopy: 'Investing involves risk. Past performance does not guarantee future results.',
      },
      subscriptionStatus: SubscriptionStatus.TRIALING,
      creditBalance: 1000,
      settings: {
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        defaultContentLanguage: 'en-US',
        emailNotificationsEnabled: true,
        slackWebhookEnabled: false,
      },
      isActive: true,
    },
  });

  console.log(`  Organization: ${organization.name} (${organization.id})`);

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
  });

  // ---------------------------------------------------------------------------
  // 3. Users — one per role
  // ---------------------------------------------------------------------------
  console.log('Seeding demo users...');

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const userDefinitions: Array<{
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }> = [
    {
      email: 'super_admin@vireos.ai',
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
    },
    {
      email: 'admin@vireos-demo.com',
      firstName: 'Firm',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    },
    {
      email: 'admin2@vireos-demo.com',
      firstName: 'Second',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    },
    {
      email: 'advisor@vireos-demo.com',
      firstName: 'Alex',
      lastName: 'Advisor',
      role: UserRole.ADVISOR,
    },
    {
      email: 'compliance@vireos-demo.com',
      firstName: 'Casey',
      lastName: 'Compliance',
      role: UserRole.COMPLIANCE,
    },
  ];

  const createdUsers: Record<string, string> = {};

  for (const userDef of userDefinitions) {
    const user = await prisma.user.upsert({
      where: { email: userDef.email },
      update: {},
      create: {
        organizationId: organization.id,
        email: userDef.email,
        passwordHash,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        role: userDef.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        settings: {
          emailNotifications: true,
          inAppNotifications: true,
          theme: 'light',
        },
      },
    });

    createdUsers[userDef.role] = user.id;
    console.log(`  User: ${user.email} [${user.role}] (${user.id})`);
  }

  // ---------------------------------------------------------------------------
  // 4. Live workflow seed data
  // ---------------------------------------------------------------------------
  console.log('Seeding workflow data...');

  const advisorId = createdUsers[UserRole.ADVISOR];
  const adminId = createdUsers[UserRole.ADMIN];
  const complianceId = createdUsers[UserRole.COMPLIANCE];

  const subscription = await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {
      status: SubscriptionStatus.ACTIVE,
      planName: 'Professional',
      currentPeriodStart: new Date('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-04-01T00:00:00.000Z'),
    },
    create: {
      organizationId: organization.id,
      stripeSubscriptionId: 'sub_demo_vireos_professional',
      stripePriceId: 'price_demo_professional_monthly',
      status: SubscriptionStatus.ACTIVE,
      planName: 'Professional',
      currentPeriodStart: new Date('2026-03-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-04-01T00:00:00.000Z'),
    },
  });

  console.log(`  Subscription: ${subscription.planName} (${subscription.status})`);

  const leadDefinitions = [
    {
      email: 'olivia.bennett@example.com',
      firstName: 'Olivia',
      lastName: 'Bennett',
      company: 'Northshore Dental Group',
      title: 'CFO',
      source: LeadSource.LINKEDIN,
      status: LeadStatus.ENGAGED,
    },
    {
      email: 'james.carter@example.com',
      firstName: 'James',
      lastName: 'Carter',
      company: 'Carter Family Office',
      title: 'Founder',
      source: LeadSource.FACEBOOK_ADS,
      status: LeadStatus.CONTACTED,
    },
    {
      email: 'mia.hernandez@example.com',
      firstName: 'Mia',
      lastName: 'Hernandez',
      company: 'Beacon Wellness',
      title: 'CEO',
      source: LeadSource.PROSPECT_FINDER,
      status: LeadStatus.MEETING_SCHEDULED,
    },
    {
      email: 'ethan.lee@example.com',
      firstName: 'Ethan',
      lastName: 'Lee',
      company: 'Lee Engineering',
      title: 'President',
      source: LeadSource.WEBSITE,
      status: LeadStatus.NEW,
    },
  ] as const;

  const leads = [];
  for (const leadDef of leadDefinitions) {
    const lead = await prisma.lead.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: leadDef.email,
        },
      },
      update: {
        assignedAdvisorId: advisorId,
        firstName: leadDef.firstName,
        lastName: leadDef.lastName,
        company: leadDef.company,
        title: leadDef.title,
        source: leadDef.source,
        status: leadDef.status,
      },
      create: {
        organizationId: organization.id,
        assignedAdvisorId: advisorId,
        firstName: leadDef.firstName,
        lastName: leadDef.lastName,
        email: leadDef.email,
        company: leadDef.company,
        title: leadDef.title,
        source: leadDef.source,
        status: leadDef.status,
        notes: 'Seeded for local live workflow testing.',
      },
    });

    leads.push(lead);
    console.log(`  Lead: ${lead.email} (${lead.status})`);
  }

  const draftDefinitions: Array<{
    title: string;
    status: ContentStatus;
    reviewerId: string | null;
    reviewNotes: string | null;
    linkedinContent: string | null;
    facebookContent: string | null;
    emailContent: string | null;
    adCopyContent: string | null;
    publishedChannels: ContentChannel[];
  }> = [
    {
      title: 'Q2 retirement planning market note',
      status: ContentStatus.PENDING_REVIEW,
      reviewerId: null,
      reviewNotes: null,
      linkedinContent: 'Retirement investors should stay disciplined even during short-term volatility. Our team focuses on tax-aware allocation and long-horizon planning.',
      facebookContent: 'Thinking about retirement planning this quarter? We help families build long-term plans that balance growth, taxes, and income needs.',
      emailContent: 'Quarterly market note: investors should stay disciplined and aligned to their retirement timeline. We can review allocation, taxes, and cash-flow needs together.',
      adCopyContent: 'Schedule a retirement planning review with a fiduciary advisor.',
      publishedChannels: [],
    },
    {
      title: 'Estate planning checklist',
      status: ContentStatus.NEEDS_CHANGES,
      reviewerId: complianceId,
      reviewNotes: 'Remove the phrase "guaranteed peace of mind" and add the required disclosure.',
      linkedinContent: 'Estate planning can help families prepare for generational wealth transfer. We work alongside attorneys and tax professionals to coordinate next steps.',
      facebookContent: null,
      emailContent: 'Estate planning checklist for business owners and retirees. We can help coordinate beneficiary reviews, trust conversations, and tax-aware planning.',
      adCopyContent: null,
      publishedChannels: [],
    },
    {
      title: 'Tax-efficient investing webinar invite',
      status: ContentStatus.APPROVED,
      reviewerId: complianceId,
      reviewNotes: 'Approved with disclosure requirement for all channels.',
      linkedinContent: 'Join our webinar on tax-efficient investing strategies for 2026. We will cover account location, withdrawal sequencing, and portfolio tax drag.',
      facebookContent: 'Reserve your seat for our tax-efficient investing webinar. Learn practical ways to reduce unnecessary tax drag in your portfolio.',
      emailContent: 'You are invited to our tax-efficient investing webinar. We will discuss withdrawal sequencing, charitable giving, and portfolio tax management.',
      adCopyContent: 'Attend a tax-efficient investing webinar for high-income households.',
      publishedChannels: [ContentChannel.LINKEDIN],
    },
    {
      title: 'Monthly market recap',
      status: ContentStatus.PUBLISHED,
      reviewerId: complianceId,
      reviewNotes: 'Published after approval.',
      linkedinContent: 'Our monthly market recap covers inflation, rates, and portfolio positioning for long-term investors.',
      facebookContent: 'See our monthly market recap covering rates, inflation, and diversification ideas.',
      emailContent: 'Monthly market recap: inflation, rates, and portfolio positioning for long-term investors.',
      adCopyContent: null,
      publishedChannels: [ContentChannel.LINKEDIN, ContentChannel.FACEBOOK, ContentChannel.EMAIL],
    },
    {
      title: 'Small business retirement plan explainer',
      status: ContentStatus.DRAFT,
      reviewerId: null,
      reviewNotes: null,
      linkedinContent: 'Small business retirement plan options include SEP IRAs, SIMPLE IRAs, and solo 401(k)s. The right fit depends on staffing and contribution goals.',
      facebookContent: null,
      emailContent: 'A practical explainer on retirement plan options for small business owners.',
      adCopyContent: 'Explore retirement plan options for your business.',
      publishedChannels: [],
    },
  ];

  const drafts = [];
  for (const draftDef of draftDefinitions) {
    const existing = await prisma.draft.findFirst({
      where: {
        organizationId: organization.id,
        creatorId: advisorId,
        title: draftDef.title,
      },
    });

    const draft = existing
      ? await prisma.draft.update({
          where: { id: existing.id },
          data: {
            reviewerId: draftDef.reviewerId,
            reviewNotes: draftDef.reviewNotes,
            status: draftDef.status,
            linkedinContent: draftDef.linkedinContent,
            facebookContent: draftDef.facebookContent,
            emailContent: draftDef.emailContent,
            adCopyContent: draftDef.adCopyContent,
            publishedChannels: draftDef.publishedChannels,
          },
        })
      : await prisma.draft.create({
          data: {
            organizationId: organization.id,
            creatorId: advisorId,
            reviewerId: draftDef.reviewerId,
            title: draftDef.title,
            originalPrompt: `Create compliant advisor marketing content for "${draftDef.title}".`,
            linkedinContent: draftDef.linkedinContent,
            facebookContent: draftDef.facebookContent,
            emailContent: draftDef.emailContent,
            adCopyContent: draftDef.adCopyContent,
            status: draftDef.status,
            reviewNotes: draftDef.reviewNotes,
            publishedChannels: draftDef.publishedChannels,
            aiModel: 'gpt-5.2-mini',
            tokensUsed: 742,
          },
        });

    drafts.push(draft);
    console.log(`  Draft: ${draft.title} (${draft.status})`);
  }

  const approvedDraft = drafts.find((draft) => draft.status === ContentStatus.APPROVED) ?? drafts[0];
  const publishedDraft = drafts.find((draft) => draft.status === ContentStatus.PUBLISHED) ?? drafts[0];

  const publishJob = await prisma.publishJob.upsert({
    where: {
      id: '2f80a3d8-6f07-4e76-8f10-7d3579df2c7d',
    },
    update: {
      draftId: publishedDraft.id,
      advisorId,
      organizationId: organization.id,
      channel: ContentChannel.LINKEDIN,
      platform: 'LINKEDIN',
      status: 'PUBLISHED',
      scheduledAt: new Date('2026-03-10T14:00:00.000Z'),
      publishedAt: new Date('2026-03-10T14:05:00.000Z'),
      platformUrl: 'https://www.linkedin.com/feed/update/demo-market-recap',
    },
    create: {
      id: '2f80a3d8-6f07-4e76-8f10-7d3579df2c7d',
      organizationId: organization.id,
      draftId: publishedDraft.id,
      advisorId,
      channel: ContentChannel.LINKEDIN,
      platform: 'LINKEDIN',
      status: 'PUBLISHED',
      scheduledAt: new Date('2026-03-10T14:00:00.000Z'),
      publishedAt: new Date('2026-03-10T14:05:00.000Z'),
      platformPostId: 'demo-linkedin-post-001',
      platformUrl: 'https://www.linkedin.com/feed/update/demo-market-recap',
    },
  });

  console.log(`  Publish job: ${publishJob.status} (${publishJob.id})`);

  const linkedInCampaignExisting = await prisma.linkedInCampaign.findFirst({
    where: { organizationId: organization.id, advisorId, name: 'Retirement outreach Q2' },
  });

  const linkedInCampaign = linkedInCampaignExisting
    ? await prisma.linkedInCampaign.update({
        where: { id: linkedInCampaignExisting.id },
        data: {
          status: CampaignStatus.ACTIVE,
          totalEnrolled: 2,
          totalCompleted: 0,
          totalReplied: 1,
          steps: [
            { stepNumber: 1, type: 'connection_request', delayDays: 0, messageTemplate: 'Open to connecting with owners planning for retirement and succession?' },
            { stepNumber: 2, type: 'follow_up', delayDays: 3, messageTemplate: 'Happy to share a retirement plan benchmarking checklist if helpful.' },
          ],
          targetCriteria: { geography: 'Texas', title: 'Founder', industry: 'Professional Services' },
        },
      })
    : await prisma.linkedInCampaign.create({
        data: {
          organizationId: organization.id,
          advisorId,
          name: 'Retirement outreach Q2',
          description: 'Outreach to business owners considering retirement plan upgrades.',
          status: CampaignStatus.ACTIVE,
          steps: [
            { stepNumber: 1, type: 'connection_request', delayDays: 0, messageTemplate: 'Open to connecting with owners planning for retirement and succession?' },
            { stepNumber: 2, type: 'follow_up', delayDays: 3, messageTemplate: 'Happy to share a retirement plan benchmarking checklist if helpful.' },
          ],
          targetCriteria: { geography: 'Texas', title: 'Founder', industry: 'Professional Services' },
          dailyLimit: 20,
          pauseOnReply: true,
          businessHoursOnly: true,
          totalEnrolled: 2,
          totalCompleted: 0,
          totalReplied: 1,
        },
      });

  console.log(`  LinkedIn campaign: ${linkedInCampaign.name} (${linkedInCampaign.status})`);

  for (const lead of leads.slice(0, 2)) {
    await prisma.linkedInCampaignEnrollment.upsert({
      where: {
        campaignId_leadId: {
          campaignId: linkedInCampaign.id,
          leadId: lead.id,
        },
      },
      update: {
        organizationId: organization.id,
        currentStep: lead.email === 'olivia.bennett@example.com' ? 2 : 1,
        status: EmailEnrollmentStatus.ACTIVE,
        nextSendAt: new Date('2026-03-12T15:00:00.000Z'),
        repliedAt: lead.email === 'olivia.bennett@example.com' ? new Date('2026-03-10T18:00:00.000Z') : null,
      },
      create: {
        campaignId: linkedInCampaign.id,
        leadId: lead.id,
        organizationId: organization.id,
        currentStep: lead.email === 'olivia.bennett@example.com' ? 2 : 1,
        status: EmailEnrollmentStatus.ACTIVE,
        nextSendAt: new Date('2026-03-12T15:00:00.000Z'),
        repliedAt: lead.email === 'olivia.bennett@example.com' ? new Date('2026-03-10T18:00:00.000Z') : null,
      },
    });
  }

  const facebookCampaignExisting = await prisma.facebookAdCampaign.findFirst({
    where: { organizationId: organization.id, advisorId, name: 'Spring tax planning lead campaign' },
  });

  const facebookCampaign = facebookCampaignExisting
    ? await prisma.facebookAdCampaign.update({
        where: { id: facebookCampaignExisting.id },
        data: {
          status: CampaignStatus.ACTIVE,
          objective: 'LEAD_GENERATION',
          budget: 1500,
          startDate: new Date('2026-03-05T00:00:00.000Z'),
          endDate: new Date('2026-03-31T00:00:00.000Z'),
          targetingJson: {
            geography: 'United States',
            ageRange: '35-60',
            interests: ['retirement planning', 'tax planning', 'business owner'],
          },
          impressions: 12400,
          clicks: 386,
          leads: 17,
          spend: 842.5,
        },
      })
    : await prisma.facebookAdCampaign.create({
        data: {
          organizationId: organization.id,
          advisorId,
          name: 'Spring tax planning lead campaign',
          status: CampaignStatus.ACTIVE,
          objective: 'LEAD_GENERATION',
          budget: 1500,
          startDate: new Date('2026-03-05T00:00:00.000Z'),
          endDate: new Date('2026-03-31T00:00:00.000Z'),
          targetingJson: {
            geography: 'United States',
            ageRange: '35-60',
            interests: ['retirement planning', 'tax planning', 'business owner'],
          },
          impressions: 12400,
          clicks: 386,
          leads: 17,
          spend: 842.5,
        },
      });

  console.log(`  Facebook campaign: ${facebookCampaign.name} (${facebookCampaign.status})`);

  const prospectRequestExisting = await prisma.prospectListRequest.findFirst({
    where: { organizationId: organization.id, requestedById: advisorId, notes: 'Q2 business owner list' },
  });

  const prospectRequest = prospectRequestExisting
    ? await prisma.prospectListRequest.update({
        where: { id: prospectRequestExisting.id },
        data: {
          fulfilledById: adminId,
          status: ProspectRequestStatus.FULFILLED,
          requestedCount: 100,
          fulfilledCount: 84,
          creditCost: 120,
          confirmedAt: new Date('2026-03-09T16:30:00.000Z'),
          fulfilledAt: new Date('2026-03-09T14:00:00.000Z'),
          criteria: {
            geography: 'Texas',
            occupation: 'Founder',
            industry: 'Professional Services',
            linkedinRequired: true,
            emailValidated: true,
          },
          notes: 'Q2 business owner list',
        },
      })
    : await prisma.prospectListRequest.create({
        data: {
          organizationId: organization.id,
          requestedById: advisorId,
          fulfilledById: adminId,
          criteria: {
            geography: 'Texas',
            occupation: 'Founder',
            industry: 'Professional Services',
            linkedinRequired: true,
            emailValidated: true,
          },
          status: ProspectRequestStatus.FULFILLED,
          requestedCount: 100,
          fulfilledCount: 84,
          creditCost: 120,
          confirmedAt: new Date('2026-03-09T16:30:00.000Z'),
          fulfilledAt: new Date('2026-03-09T14:00:00.000Z'),
          notes: 'Q2 business owner list',
        },
      });

  console.log(`  Prospect request: ${prospectRequest.status} (${prospectRequest.id})`);

  const emailTemplateExisting = await prisma.emailTemplate.findFirst({
    where: { organizationId: organization.id, createdById: advisorId, name: 'Retirement Follow-up 1' },
  });

  const emailTemplate = emailTemplateExisting
    ? await prisma.emailTemplate.update({
        where: { id: emailTemplateExisting.id },
        data: {
          subject: 'A retirement planning resource for {{firstName}}',
          htmlContent: '<p>Hi {{firstName}},</p><p>I wanted to share a retirement planning resource for business owners preparing for succession.</p>',
          textContent: 'Hi {{firstName}}, I wanted to share a retirement planning resource for business owners preparing for succession.',
          variables: ['firstName'],
        },
      })
    : await prisma.emailTemplate.create({
        data: {
          organizationId: organization.id,
          createdById: advisorId,
          name: 'Retirement Follow-up 1',
          subject: 'A retirement planning resource for {{firstName}}',
          htmlContent: '<p>Hi {{firstName}},</p><p>I wanted to share a retirement planning resource for business owners preparing for succession.</p>',
          textContent: 'Hi {{firstName}}, I wanted to share a retirement planning resource for business owners preparing for succession.',
          variables: ['firstName'],
        },
      });

  const emailSequenceExisting = await prisma.emailSequence.findFirst({
    where: { organizationId: organization.id, createdById: advisorId, name: 'Business owner nurture' },
  });

  const emailSequence = emailSequenceExisting
    ? await prisma.emailSequence.update({
        where: { id: emailSequenceExisting.id },
        data: {
          description: 'Nurture flow for owners reviewing retirement and exit planning.',
          status: EmailSequenceStatus.ACTIVE,
          triggerType: 'LEAD_CREATED',
          totalSteps: 2,
          totalEnrolled: 1,
        },
      })
    : await prisma.emailSequence.create({
        data: {
          organizationId: organization.id,
          createdById: advisorId,
          name: 'Business owner nurture',
          description: 'Nurture flow for owners reviewing retirement and exit planning.',
          status: EmailSequenceStatus.ACTIVE,
          triggerType: 'LEAD_CREATED',
          totalSteps: 2,
          totalEnrolled: 1,
        },
      });

  await prisma.emailSequenceStep.upsert({
    where: {
      sequenceId_stepNumber: {
        sequenceId: emailSequence.id,
        stepNumber: 1,
      },
    },
    update: {
      organizationId: organization.id,
      templateId: emailTemplate.id,
      delayDays: 0,
      delayHours: 1,
      subject: 'A retirement planning resource for {{firstName}}',
    },
    create: {
      sequenceId: emailSequence.id,
      organizationId: organization.id,
      stepNumber: 1,
      templateId: emailTemplate.id,
      delayDays: 0,
      delayHours: 1,
      subject: 'A retirement planning resource for {{firstName}}',
    },
  });

  await prisma.emailSequenceStep.upsert({
    where: {
      sequenceId_stepNumber: {
        sequenceId: emailSequence.id,
        stepNumber: 2,
      },
    },
    update: {
      organizationId: organization.id,
      templateId: emailTemplate.id,
      delayDays: 3,
      delayHours: 0,
      subject: 'Checking in on retirement plan benchmarking',
    },
    create: {
      sequenceId: emailSequence.id,
      organizationId: organization.id,
      stepNumber: 2,
      templateId: emailTemplate.id,
      delayDays: 3,
      delayHours: 0,
      subject: 'Checking in on retirement plan benchmarking',
    },
  });

  const firstSequenceStep = await prisma.emailSequenceStep.findFirstOrThrow({
    where: { sequenceId: emailSequence.id, stepNumber: 1 },
  });

  const emailEnrollment = await prisma.emailEnrollment.upsert({
    where: {
      sequenceId_leadId: {
        sequenceId: emailSequence.id,
        leadId: leads[0]!.id,
      },
    },
    update: {
      organizationId: organization.id,
      enrolledById: advisorId,
      currentStep: 1,
      status: EmailEnrollmentStatus.ACTIVE,
      nextSendAt: new Date('2026-03-12T17:00:00.000Z'),
    },
    create: {
      sequenceId: emailSequence.id,
      leadId: leads[0]!.id,
      organizationId: organization.id,
      enrolledById: advisorId,
      currentStep: 1,
      status: EmailEnrollmentStatus.ACTIVE,
      nextSendAt: new Date('2026-03-12T17:00:00.000Z'),
    },
  });

  await prisma.emailSend.upsert({
    where: { id: '42f2cc8e-9ed1-47aa-ae7e-f5f98ebfc4ce' },
    update: {
      enrollmentId: emailEnrollment.id,
      organizationId: organization.id,
      leadId: leads[0]!.id,
      stepId: firstSequenceStep.id,
      sgMessageId: 'sg-demo-message-001',
      status: 'DELIVERED',
      openedAt: new Date('2026-03-10T15:30:00.000Z'),
      clickedAt: new Date('2026-03-10T15:45:00.000Z'),
      sentAt: new Date('2026-03-10T15:00:00.000Z'),
    },
    create: {
      id: '42f2cc8e-9ed1-47aa-ae7e-f5f98ebfc4ce',
      enrollmentId: emailEnrollment.id,
      organizationId: organization.id,
      leadId: leads[0]!.id,
      stepId: firstSequenceStep.id,
      sgMessageId: 'sg-demo-message-001',
      status: 'DELIVERED',
      openedAt: new Date('2026-03-10T15:30:00.000Z'),
      clickedAt: new Date('2026-03-10T15:45:00.000Z'),
      sentAt: new Date('2026-03-10T15:00:00.000Z'),
    },
  });

  console.log(`  Email sequence: ${emailSequence.name} (${emailSequence.status})`);

  // ---------------------------------------------------------------------------
  // 5. Feature Flags — for the demo org
  // ---------------------------------------------------------------------------
  console.log('Seeding feature flags...');

  const featureFlagDefinitions: Array<{ flag: string; isEnabled: boolean }> = [
    { flag: 'ai_guardrails', isEnabled: true },
    { flag: 'easy_mode', isEnabled: true },
    { flag: 'facebook_enabled', isEnabled: false },
    { flag: 'linkedin_enabled', isEnabled: true },
    { flag: 'prospect_finder_enabled', isEnabled: true },
    { flag: 'email_sequences_enabled', isEnabled: true },
    { flag: 'advanced_analytics_enabled', isEnabled: false },
    { flag: 'beta_features_enabled', isEnabled: false },
  ];

  for (const flagDef of featureFlagDefinitions) {
    const featureFlag = await prisma.featureFlag.upsert({
      where: {
        organizationId_flag: {
          organizationId: organization.id,
          flag: flagDef.flag,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        flag: flagDef.flag,
        isEnabled: flagDef.isEnabled,
      },
    });

    console.log(`  Feature flag: ${featureFlag.flag} = ${featureFlag.isEnabled}`);
  }

  // ---------------------------------------------------------------------------
  // 6. Initial Credit Transaction — 1000 credits for the demo org
  // ---------------------------------------------------------------------------
  console.log('Seeding initial credit balance...');

  // Check if an initial purchase transaction already exists to avoid duplicates
  const existingInitialTransaction = await prisma.creditTransaction.findFirst({
    where: {
      organizationId: organization.id,
      type: CreditTransactionType.PURCHASE,
      description: 'Initial trial credit allocation',
    },
  });

  if (!existingInitialTransaction) {
    const creditTransaction = await prisma.creditTransaction.create({
      data: {
        organizationId: organization.id,
        userId: createdUsers[UserRole.SUPER_ADMIN],
        type: CreditTransactionType.PURCHASE,
        amount: 1000,
        balanceAfter: 1000,
        description: 'Initial trial credit allocation',
        metadata: {
          source: 'seed',
          note: 'Complimentary credits for trial period',
        },
      },
    });

    console.log(
      `  Credit transaction: +${creditTransaction.amount} credits (balance: ${creditTransaction.balanceAfter})`
    );
  } else {
    console.log('  Credit transaction: already exists, skipping.');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('');
  console.log('Seed complete.');
  console.log('');
  console.log('Demo credentials (password: Password123!):');
  console.log('  super_admin@vireos.ai     — SUPER_ADMIN');
  console.log('  admin@vireos-demo.com     — ADMIN');
  console.log('  advisor@vireos-demo.com   — ADVISOR');
  console.log('  compliance@vireos-demo.com — COMPLIANCE');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
