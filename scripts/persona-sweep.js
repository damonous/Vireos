const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'https://172.31.129.204:13443';
const OUT_DIR = path.resolve(process.cwd(), 'mcp-artifacts/persona-sweep');
const SHOTS_DIR = path.join(OUT_DIR, 'screenshots');

const personas = [
  {
    key: 'advisor',
    email: 'advisor@vireos-demo.com',
    password: 'Password123!',
    home: '/home',
    routes: [
      '/home',
      '/ai-content',
      '/content/generate',
      '/content/drafts',
      '/easy',
      '/compliance',
      '/calendar',
      '/linkedin',
      '/linkedin-builder',
      '/facebook',
      '/facebook-wizard',
      '/facebook-submitted',
      '/facebook-campaign-detail',
      '/prospects',
      '/leads',
      '/email',
      '/email/create',
      '/analytics',
      '/billing',
      '/settings',
    ],
  },
  {
    key: 'admin',
    email: 'admin@vireos-demo.com',
    password: 'Password123!',
    home: '/admin/home',
    routes: [
      '/admin/home',
      '/ai-content',
      '/content/generate',
      '/content/drafts',
      '/compliance',
      '/calendar',
      '/linkedin',
      '/facebook',
      '/prospects',
      '/leads',
      '/email',
      '/analytics',
      '/admin/users',
      '/admin/reports',
      '/admin/org-settings',
      '/admin/billing',
      '/admin/settings',
    ],
  },
  {
    key: 'compliance',
    email: 'compliance@vireos-demo.com',
    password: 'Password123!',
    home: '/compliance-officer/home',
    routes: [
      '/compliance-officer/home',
      '/compliance-officer/review',
      '/compliance-officer/audit',
      '/compliance-officer/reports',
      '/compliance-officer/settings',
    ],
  },
  {
    key: 'super-admin',
    email: 'super_admin@vireos.ai',
    password: 'Password123!',
    home: '/super-admin/home',
    routes: [
      '/super-admin/home',
      '/super-admin/orgs',
      '/super-admin/users',
      '/super-admin/prospects',
      '/super-admin/tokens',
      '/super-admin/health',
      '/super-admin/billing',
      '/super-admin/flags',
      '/super-admin/settings',
    ],
  },
];

function ensureDirs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

function slugify(route) {
  return route.replace(/^\//, '').replace(/\//g, '__') || 'root';
}

async function login(page, persona, report) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByLabel('Email').fill(persona.email);
  await page.getByLabel('Password').fill(persona.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(`**${persona.home}`, { timeout: 30000 });
  report.loginUrl = page.url();
}

async function run() {
  ensureDirs();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const results = {
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    personas: [],
  };

  try {
    for (const persona of personas) {
      const report = {
        persona: persona.key,
        email: persona.email,
        loginUrl: '',
        title: '',
        routes: [],
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      };

      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');
      page.removeAllListeners('response');

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          report.consoleErrors.push({
            text: msg.text(),
            location: msg.location(),
          });
        }
      });
      page.on('pageerror', (err) => {
        report.pageErrors.push({ message: err.message, stack: err.stack });
      });
      page.on('requestfailed', (req) => {
        report.failedRequests.push({
          type: 'requestfailed',
          url: req.url(),
          method: req.method(),
          failure: req.failure(),
        });
      });
      page.on('response', async (res) => {
        const status = res.status();
        if (status >= 400 && res.url().includes('/api/')) {
          report.failedRequests.push({
            type: 'http_error',
            status,
            url: res.url(),
            method: res.request().method(),
          });
        }
      });

      await login(page, persona, report);
      report.title = await page.title();

      for (const route of persona.routes) {
        const routeReport = { route, url: '', screenshot: '', ok: true, navError: '' };
        try {
          await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
          routeReport.url = page.url();
          const fileName = `${persona.key}__${slugify(route)}.png`;
          const filePath = path.join(SHOTS_DIR, fileName);
          await page.screenshot({ path: filePath, fullPage: true });
          routeReport.screenshot = path.relative(process.cwd(), filePath);
        } catch (error) {
          routeReport.ok = false;
          routeReport.navError = error instanceof Error ? error.message : String(error);
        }
        report.routes.push(routeReport);
      }

      results.personas.push(report);
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
    }
  } finally {
    await browser.close();
  }

  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2));
  console.log(`Wrote ${path.join(OUT_DIR, 'report.json')}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
