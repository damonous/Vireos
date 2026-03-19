import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file in non-production environments
if (process.env['NODE_ENV'] !== 'production') {
  dotenv.config();
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const configSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  ENABLE_HTTPS: z.coerce.boolean().default(false),
  HTTPS_PORT: z.coerce.number().int().positive().default(3443),
  EXTERNAL_HTTPS_PORT: z.coerce.number().int().positive().default(3443),
  SSL_CERT_PATH: z.string().default('/app/backend/certs/dev-cert.pem'),
  SSL_KEY_PATH: z.string().default('/app/backend/certs/dev-key.pem'),
  FRONTEND_DIST_DIR: z.string().default('/app/backend/public'),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform((val) => val.split(',').map((s) => s.trim())),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    ),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  OPENAI_AGENT_MODEL: z.string().default('gpt-5.2'),
  OPENAI_ORG_ID: z.string().optional(),
  AGENT_REASONING_EFFORT: z.enum(['none', 'low', 'medium', 'high', 'xhigh']).default('medium'),
  AGENT_MAX_ACTIONS_PER_TURN: z.coerce.number().int().positive().default(5),
  AGENT_MAX_CONVERSATION_TURNS: z.coerce.number().int().positive().default(50),

  // LinkedIn
  LINKEDIN_CLIENT_ID: z.string().min(1, 'LINKEDIN_CLIENT_ID is required'),
  LINKEDIN_CLIENT_SECRET: z
    .string()
    .min(1, 'LINKEDIN_CLIENT_SECRET is required'),
  LINKEDIN_REDIRECT_URI: z
    .string()
    .url('LINKEDIN_REDIRECT_URI must be a valid URL'),

  // Facebook
  FACEBOOK_APP_ID: z.string().min(1, 'FACEBOOK_APP_ID is required'),
  FACEBOOK_APP_SECRET: z.string().min(1, 'FACEBOOK_APP_SECRET is required'),
  FACEBOOK_REDIRECT_URI: z
    .string()
    .url('FACEBOOK_REDIRECT_URI must be a valid URL'),

  // Mailgun
  MAILGUN_API_KEY: z.string().min(1, 'MAILGUN_API_KEY is required'),
  MAILGUN_DOMAIN: z.string().min(1, 'MAILGUN_DOMAIN is required'),
  MAILGUN_FROM_EMAIL: z
    .string()
    .email()
    .default('noreply@vireos.com'),
  MAILGUN_FROM_NAME: z.string().default('Vireos Platform'),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // AWS
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z
    .string()
    .min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS_S3_BUCKET is required'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_ENDPOINT: z.string().url().optional(),

  // Rate limiting
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(5000),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),
  LOG_SERVICE_NAME: z.string().default('vireos-backend'),
});

// ---------------------------------------------------------------------------
// Parse and export
// ---------------------------------------------------------------------------

const normalizedEnv = {
  ...process.env,
  MAILGUN_API_KEY: process.env['MAILGUN_API_KEY'] ?? process.env['SENDGRID_API_KEY'],
  MAILGUN_DOMAIN:
    process.env['MAILGUN_DOMAIN'] ??
    process.env['SENDGRID_FROM_EMAIL']?.split('@')[1] ??
    process.env['MAILGUN_FROM_EMAIL']?.split('@')[1],
  MAILGUN_FROM_EMAIL:
    process.env['MAILGUN_FROM_EMAIL'] ?? process.env['SENDGRID_FROM_EMAIL'],
  MAILGUN_FROM_NAME:
    process.env['MAILGUN_FROM_NAME'] ?? process.env['SENDGRID_FROM_NAME'],
};

const parseResult = configSchema.safeParse(normalizedEnv);

if (!parseResult.success) {
  const formatted = parseResult.error.errors
    .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
    .join('\n');

  // Use console.error directly since logger depends on config
  console.error(
    `\n[CONFIG] Fatal: Invalid environment configuration:\n${formatted}\n`
  );
  process.exit(1);
}

export const config = parseResult.data;

// Convenience aliases
export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

export type Config = typeof config;
