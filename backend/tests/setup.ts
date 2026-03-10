/**
 * Jest global setup — runs once before all test suites.
 *
 * Responsibilities:
 *  - Set required environment variables for tests
 *  - Any global test infrastructure setup (e.g., test DB creation)
 *
 * NOTE: This is `globalSetup`, which runs in a separate context from tests.
 * It cannot share module state with test files. Use `setupFilesAfterFramework`
 * for per-test setup that needs to share state.
 */

export default async function globalSetup(): Promise<void> {
  // Set test-specific environment variables
  // These override .env values during tests so tests run in isolation
  process.env['NODE_ENV'] = 'test';
  process.env['PORT'] = '3001';
  process.env['LOG_LEVEL'] = 'error'; // Suppress noisy logs during tests

  // Database — use a separate test database to avoid polluting dev data
  process.env['DATABASE_URL'] =
    process.env['TEST_DATABASE_URL'] ??
    'postgresql://vireos:vireos_dev@localhost:5432/vireos_test?schema=public';

  // Redis — use a different DB index for tests
  process.env['REDIS_URL'] =
    process.env['TEST_REDIS_URL'] ?? 'redis://localhost:6379/1';

  // JWT config
  process.env['JWT_SECRET'] =
    'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';
  process.env['JWT_EXPIRES_IN'] = '15m';
  process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';

  // Encryption — a valid 64-char hex key for testing
  process.env['ENCRYPTION_KEY'] =
    'a'.repeat(64); // 32 bytes of 0xaa for deterministic tests

  // Third-party services — use fake values to prevent real API calls
  process.env['OPENAI_API_KEY'] = 'sk-test-fake-key-for-testing';
  process.env['OPENAI_MODEL'] = 'gpt-4o';

  process.env['LINKEDIN_CLIENT_ID'] = 'test_linkedin_client_id';
  process.env['LINKEDIN_CLIENT_SECRET'] = 'test_linkedin_client_secret';
  process.env['LINKEDIN_REDIRECT_URI'] = 'http://localhost:3001/api/v1/oauth/linkedin/callback';

  process.env['FACEBOOK_APP_ID'] = 'test_facebook_app_id';
  process.env['FACEBOOK_APP_SECRET'] = 'test_facebook_app_secret';
  process.env['FACEBOOK_REDIRECT_URI'] = 'http://localhost:3001/api/v1/oauth/facebook/callback';

  process.env['SENDGRID_API_KEY'] = 'SG.test_fake_key_for_testing';
  process.env['SENDGRID_FROM_EMAIL'] = 'test@vireos.com';

  process.env['STRIPE_SECRET_KEY'] = 'sk_test_fake_stripe_key';
  process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_fake_webhook_secret';

  process.env['AWS_ACCESS_KEY_ID'] = 'AKIAIOSFODNN7EXAMPLE';
  process.env['AWS_SECRET_ACCESS_KEY'] = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  process.env['AWS_S3_BUCKET'] = 'vireos-test-bucket';
  process.env['AWS_REGION'] = 'us-east-1';

  process.env['API_BASE_URL'] = 'http://localhost:3001';
  process.env['CORS_ORIGINS'] = 'http://localhost:3001';

  console.log('[TEST SETUP] Environment configured for test suite');
}
