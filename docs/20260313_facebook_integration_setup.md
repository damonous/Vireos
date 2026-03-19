# Facebook / Meta Integration Setup for Vireos

This runbook is specific to the current Vireos codebase.

## What the app currently expects

The backend currently uses:

- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_REDIRECT_URI`
- `FACEBOOK_WEBHOOK_VERIFY_TOKEN` or `FB_WEBHOOK_VERIFY_TOKEN`

Relevant backend endpoints:

- OAuth start: `/api/v1/oauth/facebook`
- OAuth callback: `/api/v1/oauth/facebook/callback`
- Webhook verification: `GET /api/v1/facebook/webhook`
- Webhook receiver: `POST /api/v1/facebook/webhook`

Current Facebook OAuth scopes requested by the app:

- `pages_manage_posts`
- `pages_read_engagement`

Code references:

- `backend/src/services/social-connection.service.ts`
- `backend/src/routes/oauth.routes.ts`
- `backend/src/routes/facebook-ad.routes.ts`
- `backend/src/services/facebook-ad.service.ts`

## Important limitation in the current implementation

The current code stores the connected Facebook user ID from `me` and then reuses that value where the app really needs a Facebook Page ID or Ad Account ID.

That means:

- basic OAuth connection can be set up now
- webhook setup can be set up now
- true production-grade Facebook Page publishing and Ads launch still need additional implementation for:
  - selecting a Page
  - retrieving Page access tokens
  - storing the selected Page ID
  - selecting or storing an Ad Account ID

So if your immediate goal is to finish Meta dashboard setup and have Vireos ready for final code completion, the steps below are correct. If your goal is fully live Facebook publishing/ads today, the code still needs that extra Page/Ad Account layer.

## Prerequisites

Before starting in Meta:

1. Use a public HTTPS URL for Vireos.
2. Do not use `https://172.31.129.204:13443` for Meta configuration.
3. Use a public domain or a tunnel URL instead, for example:
   - `https://app.vireos.com`
   - `https://vireos-staging.example.com`
   - a temporary `ngrok` or `cloudflared` HTTPS URL

The callback and webhook URLs Meta sees must be publicly reachable.

## Step 1: Create the Meta app

1. Go to [Meta for Developers](https://developers.facebook.com/apps/).
2. Click `Create App`.
3. Choose the closest app type for this use case.
   - For Facebook Login and Graph API access, Meta may present a flow such as `Business`, `Other`, or `Consumer`.
   - Choose the type that allows Facebook Login and Graph API products for Pages/business assets.
4. Enter:
   - App name: `Vireos`
   - App contact email
   - Business account if you already have one
5. Create the app.

## Step 2: Add the required Meta products

Inside the app dashboard, add:

1. `Facebook Login`
2. Any product Meta now requires for the Graph API / business asset flow you are using
3. If you will use Facebook lead webhooks, ensure the webhook capability is available from the app configuration

## Step 3: Configure Facebook Login

In the Meta app dashboard:

1. Open `Facebook Login` settings.
2. Turn on the client/web login flow if Meta presents that option.
3. Add the exact Valid OAuth Redirect URI:

```text
https://YOUR-PUBLIC-DOMAIN/api/v1/oauth/facebook/callback
```

Example:

```text
https://app.vireos.com/api/v1/oauth/facebook/callback
```

4. If Meta asks for App Domains, add your public domain only, for example:

```text
app.vireos.com
```

5. Save changes.

## Step 4: Put the app credentials into Vireos

In `backend/.env`, set:

```env
FACEBOOK_APP_ID=your_meta_app_id
FACEBOOK_APP_SECRET=your_meta_app_secret
FACEBOOK_REDIRECT_URI=https://YOUR-PUBLIC-DOMAIN/api/v1/oauth/facebook/callback
FACEBOOK_WEBHOOK_VERIFY_TOKEN=use-a-long-random-secret-string
```

Notes:

- `FACEBOOK_REDIRECT_URI` must exactly match the URI registered in Meta.
- `FACEBOOK_WEBHOOK_VERIFY_TOKEN` is checked by `GET /api/v1/facebook/webhook`.
- This verify token is your own shared secret string, not something Meta gives you.

## Step 5: Configure webhook callback in Meta

If you need Facebook lead ingestion or page-related webhook events:

1. In the Meta app dashboard, open the webhook configuration area.
2. Add the callback URL:

```text
https://YOUR-PUBLIC-DOMAIN/api/v1/facebook/webhook
```

3. Set the verify token to the exact value you put in:

```text
FACEBOOK_WEBHOOK_VERIFY_TOKEN
```

4. Complete Meta’s verification step.

If the verification fails, check:

- the URL is publicly reachable
- the app is returning `200`
- the verify token matches exactly
- TLS is valid and trusted

## Step 6: Set up business assets in Meta

For real Facebook Page publishing and Ads usage, you also need:

1. A Meta Business portfolio / business account
2. A Facebook Page you control
3. A user who is an admin or has sufficient access on that Page
4. If using ads:
   - an Ad Account
   - payment setup in Meta Ads Manager
   - the correct permissions for the connected user on that Ad Account

Without those business assets, the app may connect a user account but still fail to publish or launch ads.

## Step 7: Add test users while the app is still in development mode

Before the Meta app is live:

1. Add yourself as an app admin/developer/tester in the Meta app roles area.
2. Add any internal test accounts that need to connect Facebook during development.

In development mode, only app-role users can typically complete OAuth flows.

## Step 8: Request the permissions needed for production

The current app requests:

- `pages_manage_posts`
- `pages_read_engagement`

For production use, these usually need App Review approval when required by Meta’s current policy.

If you later implement Page enumeration or other business flows, you may also need additional permissions or features depending on the final implementation.

Prepare for App Review with:

1. A working screencast showing exactly how Vireos uses Facebook access
2. Test credentials for the reviewer if Meta requests them
3. A clear explanation of why each permission is needed
4. A privacy policy URL
5. A terms URL if Meta requires it
6. Business verification if Meta requires it for the requested permissions/features

## Step 9: Switch the app to live mode

After review/verification is complete:

1. Switch the Meta app from development mode to live mode.
2. Re-test the OAuth flow with a non-role user account.
3. Re-test the webhook verification.
4. Re-test page/business actions.

## Step 10: Test the Vireos connection flow

In Vireos:

1. Log in as an advisor or admin.
2. Go to `Settings`.
3. Open the `Integrations` tab.
4. Click `Connect` for Facebook.
5. Complete the Meta consent flow.
6. Confirm the OAuth callback returns successfully and the Facebook connection appears in the UI.

Current backend start endpoint:

```text
GET /api/v1/oauth/facebook
```

Current callback endpoint:

```text
GET /api/v1/oauth/facebook/callback
```

## Step 11: Test webhook verification and delivery

After configuring the webhook in Meta:

1. Confirm Meta marks the subscription as verified.
2. Send a test event if Meta offers one.
3. Confirm Vireos receives a `POST /api/v1/facebook/webhook`.
4. Confirm the relevant records appear in the database/app.

## Step 12: Production checklist

Before calling Facebook integration ready:

- Meta app created
- Facebook Login configured
- exact redirect URI configured
- public HTTPS callback URL working
- webhook URL configured
- webhook verify token configured
- app roles added for dev testing
- required permissions submitted/approved
- app switched to live mode
- business verification completed if required
- Page admin access confirmed
- Ad Account access confirmed
- Vireos `.env` updated with real values

## What still needs code work in Vireos

These are not Meta dashboard steps. They are implementation gaps in the current app:

1. Fetch available Facebook Pages after OAuth
2. Let the user choose which Page to use
3. Store the selected Page ID
4. Exchange/use the correct Page access token for Page posting
5. Let the user choose or store an Ad Account ID for ads launch
6. Stop reusing the Facebook user profile ID as the Page ID / Ad Account ID

Until those are implemented, Meta-side setup alone will not make Facebook publishing and ad launching fully production-ready.

## Official references

- Meta app dashboard: https://developers.facebook.com/apps/
- Facebook Login manual flow: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/
- Facebook Login security/settings: https://developers.facebook.com/docs/facebook-login/security/
- App review: https://developers.facebook.com/docs/apps/review/
- Graph API get started: https://developers.facebook.com/docs/graph-api/get-started/

