# Vireos Provider Credentials Setup Runbook (March 10, 2026)

This runbook covers the provider credentials required by the Vireos backend and exactly where to place them in `backend/.env`.

## 1) Before You Start

1. Open the project file `backend/.env`.
2. Decide your callback base URL:
   - Local only: `http://localhost:13000`
   - Public testing (recommended for OAuth/webhooks): `https://<your-public-url>`
3. If using a public URL, update these in `backend/.env`:
   - `API_BASE_URL`
   - `LINKEDIN_REDIRECT_URI`
   - `FACEBOOK_REDIRECT_URI`

## 2) OpenAI

### Env vars
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional)
- `OPENAI_ORG_ID` (optional, if your OpenAI account uses org-scoped keys)

### Steps
1. Sign in to OpenAI Platform.
2. Go to API keys.
3. Create a new secret key.
4. Copy the key immediately (it is only shown once).
5. Set `OPENAI_API_KEY` in `backend/.env`.
6. Set model values:
   - `OPENAI_MODEL=gpt-5.2-mini`
   - `OPENAI_AGENT_MODEL=gpt-5.2`

### Verify
1. Restart backend containers.
2. Trigger one AI content generation request.
3. Confirm no `401`/`403` from OpenAI in app logs.

## 3) LinkedIn OAuth

### Env vars
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`

### Steps
1. Sign in to LinkedIn Developer portal.
2. Create an app (or open your existing app).
3. In Auth settings, configure OAuth 2.0 redirect URL:
   - `http://localhost:13000/api/v1/oauth/linkedin/callback`
   - or `https://<your-public-url>/api/v1/oauth/linkedin/callback`
4. Copy Client ID and Client Secret from the app credentials section.
5. Set in `backend/.env`:
   - `LINKEDIN_CLIENT_ID=...`
   - `LINKEDIN_CLIENT_SECRET=...`
   - `LINKEDIN_REDIRECT_URI=...` (must exactly match app config)

### Verify
1. Start OAuth connect flow from frontend.
2. Approve LinkedIn consent.
3. Confirm callback returns to app and token is stored without error.

## 4) Facebook / Meta OAuth

### Env vars
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_REDIRECT_URI`
- `FACEBOOK_WEBHOOK_VERIFY_TOKEN` (for webhook handshake)

### Steps
1. Sign in to Meta for Developers.
2. Create an app and add Facebook Login product.
3. Set Valid OAuth Redirect URI:
   - `http://localhost:13000/api/v1/oauth/facebook/callback`
   - or `https://<your-public-url>/api/v1/oauth/facebook/callback`
4. Copy App ID and App Secret.
5. Set in `backend/.env`:
   - `FACEBOOK_APP_ID=...`
   - `FACEBOOK_APP_SECRET=...`
   - `FACEBOOK_REDIRECT_URI=...`
   - `FACEBOOK_WEBHOOK_VERIFY_TOKEN=<random-long-string>`

### Verify
1. Run Facebook connect flow from frontend.
2. Confirm callback success and connected account in UI/API.

## 5) Stripe

### Env vars
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Steps
1. Sign in to Stripe Dashboard and select the correct mode (`Test` or `Live`).
2. Copy API keys:
   - Secret key (`sk_test_...` or `sk_live_...`)
   - Publishable key (`pk_test_...` or `pk_live_...`)
3. Create webhook endpoint pointing to:
   - `https://<your-public-url>/api/v1/webhooks/stripe`
   - For localhost, use Stripe CLI forwarding and use the generated webhook secret.
4. Subscribe webhook to required billing/subscription events.
5. Copy endpoint signing secret (`whsec_...`).
6. Set all three values in `backend/.env`.

### Verify
1. Trigger a Stripe test event or create a test checkout/subscription.
2. Confirm webhook request is accepted by backend (2xx).
3. Confirm billing status changes in app/database.

## 6) Mailgun

### Env vars
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM_EMAIL`
- `MAILGUN_FROM_NAME`

### Steps
1. Sign in to Mailgun.
2. Verify a sender identity (single sender or authenticated domain).
3. Create API key with mail send permission.
4. Set in `backend/.env`:
   - `MAILGUN_API_KEY=...`
   - `MAILGUN_DOMAIN=<verified sending domain>`
   - `MAILGUN_FROM_EMAIL=<verified address>`
   - `MAILGUN_FROM_NAME=<display name>`

### Verify
1. Trigger a transactional email flow in Vireos.
2. Confirm email accepted by Mailgun and delivered.
3. Confirm no sender identity errors in logs.

## 7) AWS S3

### Env vars
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- `AWS_REGION`
- `AWS_S3_ENDPOINT` (optional, only for LocalStack/MinIO)

### Steps
1. In AWS, create or choose an S3 bucket for Vireos uploads.
2. Configure bucket CORS to allow your frontend origin(s).
3. Create IAM policy with least-privilege S3 access to this bucket.
4. Create IAM user or access key for that policy.
5. Set credentials and bucket config in `backend/.env`.

### Verify
1. Trigger a file upload flow (image/PDF/media).
2. Confirm object appears in bucket.
3. Confirm retrieval URL works from app.

## 8) Apply and Test Credentials

1. Restart services:
   - `docker compose -f backend/docker-compose.yml down`
   - `docker compose -f backend/docker-compose.yml up -d --build`
2. Check health:
   - `curl -H 'X-Forwarded-Proto: https' http://localhost:13000/health/ready`
3. Run one real test for each provider feature:
   - OpenAI generation
   - LinkedIn connect
   - Facebook connect
   - Stripe webhook event
   - Mailgun outbound email
   - S3 upload

## 9) Security Handling Rules

1. Never commit `.env` with real secrets.
2. Rotate all keys after sharing screenshots/logs that might expose them.
3. Use separate `test` and `live` credentials.
4. Restrict provider permissions to least privilege.
