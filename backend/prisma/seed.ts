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

import { PrismaClient, UserRole, UserStatus, SubscriptionStatus, CreditTransactionType } from '@prisma/client';
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
  // 4. Feature Flags — for the demo org
  // ---------------------------------------------------------------------------
  console.log('Seeding feature flags...');

  const featureFlagDefinitions: Array<{ flag: string; isEnabled: boolean }> = [
    { flag: 'ai_guardrails', isEnabled: true },
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
  // 5. Initial Credit Transaction — 1000 credits for the demo org
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
