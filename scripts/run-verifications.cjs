const fs = require('fs');
const path = require('path');
const https = require('https');
const { chromium } = require('../frontend/node_modules/playwright');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { PrismaClient, SubscriptionStatus, UserRole, UserStatus } = require('../backend/node_modules/@prisma/client');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.BASE_URL || 'https://127.0.0.1:13443';
const API_BASE = `${BASE_URL}/api/v1`;
const OUT_DIR = path.resolve(__dirname, '../mcp-artifacts/workflow-tests');
const SCREENSHOT_DIR = path.resolve(__dirname, '../mcp-artifacts/persona-sweep/screenshots');
const agent = new https.Agent({ rejectUnauthorized: false });
const prisma = new PrismaClient();

function ensureDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function request(method, urlPath, { token, body, headers } = {}) {
  const finalHeaders = {
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers ?? {}),
  };

  const response = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    agent,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

async function login(email, password) {
  const result = await request('POST', '/auth/login', { body: { email, password } });
  if (!result.ok) {
    throw new Error(`Login failed for ${email}: ${result.status}`);
  }
  return result.payload.data;
}

async function writeJson(name, data) {
  const outputPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
}

async function verifyAccountLock() {
  const unique = Date.now();
  const email = `autotest-lock-${unique}@example.com`;
  const password = 'Password123!';

  const registration = await request('POST', '/auth/register', {
    body: {
      firstName: 'Lock',
      lastName: 'Tester',
      email,
      password,
      organizationName: 'Vireos Demo Firm',
    },
  });

  const attempts = [];
  for (let index = 0; index < 5; index += 1) {
    const attempt = await request('POST', '/auth/login', {
      body: { email, password: 'WrongPassword123!' },
    });
    attempts.push({
      attempt: index + 1,
      status: attempt.status,
      code: attempt.payload?.error?.code ?? null,
      message: attempt.payload?.error?.message ?? null,
    });
  }

  await writeJson('account-lock.json', {
    generated_at: new Date().toISOString(),
    registration: {
      status: registration.status,
      success: registration.ok,
    },
    attempts,
    locked: attempts.at(-1)?.status === 429,
  });
}

async function verifyAdminUserLifecycle() {
  const unique = Date.now();
  const auth = await login('admin@vireos-demo.com', 'Password123!');
  const orgId = auth.user.orgId;
  const token = auth.accessToken;
  const inviteEmail = `autotest-member-${unique}@example.com`;

  const invited = await request('POST', `/organizations/${orgId}/members/invite`, {
    token,
    body: {
      email: inviteEmail,
      firstName: 'Invite',
      lastName: 'Lifecycle',
      role: 'ADVISOR',
    },
  });

  const memberId = invited.payload?.data?.id;
  if (!memberId) {
    throw new Error('Invite response did not include member id');
  }

  const roleChanged = await request('PUT', `/organizations/${orgId}/members/${memberId}/role`, {
    token,
    body: { role: 'COMPLIANCE' },
  });

  const deactivated = await request('DELETE', `/organizations/${orgId}/members/${memberId}`, {
    token,
  });

  await writeJson('admin-user-lifecycle.json', {
    generated_at: new Date().toISOString(),
    organizationId: orgId,
    invited: {
      status: invited.status,
      memberId,
      role: invited.payload?.data?.role ?? null,
      email: invited.payload?.data?.email ?? null,
    },
    roleChanged: {
      status: roleChanged.status,
      role: roleChanged.payload?.data?.role ?? null,
    },
    deactivated: {
      status: deactivated.status,
      message: deactivated.payload?.data?.message ?? null,
    },
  });
}

async function verifyProspectFulfillmentAndTokenUsage() {
  const unique = Date.now();
  const advisor = await login('advisor@vireos-demo.com', 'Password123!');
  const superAdmin = await login('super_admin@vireos.ai', 'Password123!');

  const requestCreate = await request('POST', '/prospects/requests', {
    token: advisor.accessToken,
    body: {
      requestedCount: 2,
      notes: `Autotest request ${unique}`,
      criteria: {
        geography: 'Perth',
        industry: 'Financial Advisors',
        seniority: ['Owner', 'Partner'],
      },
    },
  });

  const requestId = requestCreate.payload?.data?.id;
  if (!requestId) {
    throw new Error('Prospect request creation failed');
  }

  const csv = [
    'firstName,lastName,email,company,title,linkedinUrl',
    `Ava,Prospect,autotest-prospect-${unique}-1@example.com,North Star Wealth,Owner,https://linkedin.com/in/autotest-prospect-${unique}-1`,
    `Noah,Prospect,autotest-prospect-${unique}-2@example.com,Harbor Advisory,Partner,https://linkedin.com/in/autotest-prospect-${unique}-2`,
  ].join('\n');

  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), `autotest-${unique}.csv`);

  const upload = await request('POST', `/admin/prospect-requests/${requestId}/upload`, {
    token: superAdmin.accessToken,
    body: form,
  });

  const preview = await request('GET', `/admin/prospect-requests/${requestId}/preview`, {
    token: superAdmin.accessToken,
  });

  const confirm = await request('POST', `/admin/prospect-requests/${requestId}/confirm`, {
    token: superAdmin.accessToken,
  });

  const tokenUsage = await request('GET', '/admin/token-usage?page=1&limit=10', {
    token: superAdmin.accessToken,
  });

  await writeJson('prospect-fulfillment.json', {
    generated_at: new Date().toISOString(),
    requestId,
    requestCreated: {
      status: requestCreate.status,
      requestedCount: requestCreate.payload?.data?.requestedCount ?? null,
      workflowStatus: requestCreate.payload?.data?.status ?? null,
    },
    upload: {
      status: upload.status,
      workflowStatus: upload.payload?.data?.status ?? null,
      fulfilledCount: upload.payload?.data?.fulfilledCount ?? null,
      creditCost: upload.payload?.data?.creditCost ?? null,
    },
    preview: {
      status: preview.status,
      fulfilledCount: preview.payload?.data?.fulfilledCount ?? null,
      creditCost: preview.payload?.data?.creditCost ?? null,
      leadCount: preview.payload?.data?.leads?.length ?? 0,
    },
    confirm: {
      status: confirm.status,
      leadsImported: confirm.payload?.data?.leads ?? null,
      creditsDeducted: confirm.payload?.data?.creditsDeducted ?? null,
    },
    tokenUsage: {
      status: tokenUsage.status,
      totalTokensUsed: tokenUsage.payload?.data?.summary?.totalTokensUsed ?? null,
      itemCount: tokenUsage.payload?.data?.items?.length ?? 0,
      organizationCount: tokenUsage.payload?.data?.summary?.byOrganization?.length ?? 0,
      userCount: tokenUsage.payload?.data?.summary?.byUser?.length ?? 0,
    },
  });
}

async function verifySessionRefresh() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  let refreshCalls = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/auth/refresh')) {
      refreshCalls += 1;
    }
  });

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByLabel('Email').fill('admin@vireos-demo.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/admin/home');

  const before = await page.evaluate(() => ({
    accessToken: localStorage.getItem('vireos_access_token'),
    refreshToken: localStorage.getItem('vireos_refresh_token'),
  }));

  await page.evaluate(() => {
    localStorage.setItem('vireos_access_token', 'invalid-token');
  });

  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => ({
    accessToken: localStorage.getItem('vireos_access_token'),
    refreshToken: localStorage.getItem('vireos_refresh_token'),
    title: document.title,
  }));

  await browser.close();

  await writeJson('session-refresh.json', {
    generated_at: new Date().toISOString(),
    forcedRefresh: {
      refreshCalls,
      recoveredFromInvalidAccessToken: Boolean(after.accessToken && after.accessToken !== 'invalid-token'),
      refreshTokenPresent: Boolean(after.refreshToken),
      title: after.title,
    },
  });
}

async function verifyRegistrationRedirect() {
  const unique = Date.now();
  const email = `autotest-register-${unique}@example.com`;
  const weakPassword = await request('POST', '/auth/register', {
    body: {
      firstName: 'Weak',
      lastName: 'Password',
      email: `autotest-weak-${unique}@example.com`,
      password: 'weakpass',
      organizationName: 'Vireos Demo Firm',
    },
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('First name').fill('Reg');
  await page.getByLabel('Last name').fill('Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Organization name').fill('Vireos Demo Firm');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password').fill('Password123!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/billing?onboarding=required');

  const state = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    hasAccessToken: Boolean(localStorage.getItem('vireos_access_token')),
  }));

  await browser.close();

  await writeJson('registration-security.json', {
    generated_at: new Date().toISOString(),
    weakPassword: {
      status: weakPassword.status,
      code: weakPassword.payload?.error?.code ?? null,
      message: weakPassword.payload?.error?.message ?? null,
    },
    registrationRedirect: state,
  });
}

async function verifyDeactivatedLogin() {
  const unique = Date.now();
  const admin = await login('admin@vireos-demo.com', 'Password123!');
  const inviteEmail = `autotest-inactive-${unique}@example.com`;

  const invited = await request('POST', `/organizations/${admin.user.orgId}/members/invite`, {
    token: admin.accessToken,
    body: {
      email: inviteEmail,
      firstName: 'Inactive',
      lastName: 'Login',
      role: 'ADVISOR',
    },
  });

  const memberId = invited.payload?.data?.id;
  if (!memberId) {
    throw new Error('Deactivate-login verification failed to create member');
  }

  await prisma.user.update({
    where: { id: memberId },
    data: {
      status: UserStatus.INACTIVE,
      passwordHash: await bcrypt.hash('Password123!', 12),
    },
  });

  const loginAttempt = await request('POST', '/auth/login', {
    body: {
      email: inviteEmail,
      password: 'Password123!',
    },
  });

  await writeJson('deactivated-user-login.json', {
    generated_at: new Date().toISOString(),
    memberId,
    invitedStatus: invited.status,
    loginAttempt: {
      status: loginAttempt.status,
      code: loginAttempt.payload?.error?.code ?? null,
      message: loginAttempt.payload?.error?.message ?? null,
    },
  });
}

async function verifySubscriptionGate() {
  const unique = Date.now();
  const password = 'Password123!';
  const email = `autotest-subscription-${unique}@example.com`;
  const passwordHash = await bcrypt.hash(password, 12);
  const org = await prisma.organization.create({
    data: {
      name: `Autotest Subscription ${unique}`,
      slug: `autotest-sub-${unique}`,
      icpType: 'financial_advisor',
      subscriptionStatus: SubscriptionStatus.CANCELLED,
    },
  });

  await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      passwordHash,
      firstName: 'Sub',
      lastName: 'Gate',
      role: UserRole.ADVISOR,
      status: UserStatus.ACTIVE,
    },
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/billing?required=subscription');

  const state = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    billingBanner: document.body.innerText.includes('active subscription is required'),
  }));

  await browser.close();

  await writeJson('subscription-gate.json', {
    generated_at: new Date().toISOString(),
    organizationId: org.id,
    userEmail: email,
    result: state,
  });
}

async function verifyIdleLogout() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (handler, timeout, ...args) =>
      originalSetTimeout(handler, Math.min(Number(timeout) || 0, 100), ...args);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill('advisor@vireos-demo.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/home');
  await page.waitForURL('**/login');

  await writeJson('idle-logout.json', {
    generated_at: new Date().toISOString(),
    acceleratedTimerTest: true,
    finalUrl: page.url(),
    redirectedToLogin: page.url().includes('/login'),
  });

  await browser.close();
}

async function verifyFlaggedDraftUi() {
  const advisor = await login('advisor@vireos-demo.com', 'Password123!');
  const flaggedDraft = await prisma.draft.create({
    data: {
      organizationId: advisor.user.orgId,
      creatorId: advisor.user.id,
      title: `Autotest flagged draft ${Date.now()}`,
      originalPrompt: 'Create content with prohibited phrasing for UI verification.',
      linkedinContent: 'Guaranteed returns are not allowed.',
      facebookContent: 'Risk-free language should be flagged.',
      emailContent: 'Guaranteed returns are not allowed.',
      adCopyContent: 'Risk-free language should be flagged.',
      status: 'DRAFT',
      flagsJson: {
        post_generation_flags: ['guaranteed returns', 'risk-free'],
      },
      aiModel: 'artifact-seed',
      tokensUsed: 0,
    },
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill('advisor@vireos-demo.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/home');
  await page.goto(`${BASE_URL}/content/drafts`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Search title, prompt, or channel').fill(flaggedDraft.title);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'advisor__content__drafts__flagged.png'), fullPage: true });

  await browser.close();

  await writeJson('post-generation-flags.json', {
    generated_at: new Date().toISOString(),
    draftId: flaggedDraft.id,
    title: flaggedDraft.title,
    flags: flaggedDraft.flagsJson?.post_generation_flags ?? [],
    screenshot: 'mcp-artifacts/persona-sweep/screenshots/advisor__content__drafts__flagged.png',
  });
}

async function verifyInteractiveScreens() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill('advisor@vireos-demo.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/home');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Integrations' }).click();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'advisor__settings__integrations.png'), fullPage: true });

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill('super_admin@vireos.ai');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/super-admin/home');
  await page.goto(`${BASE_URL}/super-admin/orgs`, { waitUntil: 'domcontentloaded' });
  await page.locator('tbody tr').first().click();
  await page.getByRole('button', { name: 'Save ICP Settings' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'super-admin__orgs__detail-editor.png'), fullPage: true });

  await browser.close();
}

async function main() {
  ensureDir();
  await verifyRegistrationRedirect();
  await verifyAccountLock();
  await verifyAdminUserLifecycle();
  await verifyDeactivatedLogin();
  await verifyProspectFulfillmentAndTokenUsage();
  await verifySubscriptionGate();
  await verifySessionRefresh();
  await verifyIdleLogout();
  await verifyFlaggedDraftUi();
  await verifyInteractiveScreens();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
