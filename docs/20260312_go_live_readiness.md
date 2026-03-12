# Vireos Go-Live Readiness

Date: 2026-03-12

## Fixed In This Pass

- Lead pipeline cards now move stages using the real backend status API.
- Lead cards no longer overflow on long email/company text.
- Lead pipeline now reflects the real backend statuses, including `ENGAGED` and `LOST`.
- Lead creation is now a working modal and saves real leads through `/api/v1/leads`.
- Advisor-created leads are now auto-assigned to the creating advisor so they remain visible immediately after creation.
- Audit Trail no longer dumps raw JSON in the UI; metadata is rendered as readable labeled details.
- Facebook campaign detail no longer dumps raw targeting JSON; targeting is rendered as readable sections/chips.
- Login form accessibility was improved with `name` and `autocomplete` attributes.
- Local HTTPS certificates are now persisted across rebuilds instead of being regenerated every image build.
- Local HTTPS certificates now include the current testing IP SAN (`172.31.129.204`) in addition to `localhost` and `127.0.0.1`.
- Obsolete Docker Compose `version` warnings were removed.

## Verified Working

- `docker compose up -d --build app`
- Frontend build
- Backend build
- Persona sweep: 4 personas, 51 routes, 0 console errors, 0 page errors, 0 failed requests
- Live manual checks:
  - advisor lead move
  - advisor lead create
  - compliance audit trail rendering
  - Facebook campaign targeting detail rendering

## Remaining Blockers Before True Go-Live

These are the remaining items that still block a real public launch tomorrow.

### Provider Credentials And External Service Configuration

- OpenAI production API key and approved model access
- Stripe live secret key, publishable key, webhook secret, and live price IDs
- LinkedIn OAuth app credentials and approved redirect URIs
- Facebook/Meta app credentials, approved redirect URIs, and publish-capable ad/page access
- SendGrid production API key plus verified sender/domain
- AWS S3 production credentials, bucket, CORS, and policy

### Public Internet Configuration

- A real production domain or subdomain
- A trusted CA-issued TLS certificate for the production host
- Public webhook endpoints for Stripe and Meta callbacks
- Production redirect URLs configured in provider consoles to match the real host

### Final Pre-Launch Validation Still Needed After Credentials Arrive

- Successful AI content generation using live OpenAI credentials
- Successful Stripe checkout redirect and post-checkout subscription update
- Successful Stripe billing portal redirect and return flow
- Successful LinkedIn publish/campaign actions
- Successful Facebook publish/campaign actions
- Successful scheduled social publish execution through the worker queue
- Successful SendGrid email delivery against a real verified sender
- Successful S3 upload/read flow against the production bucket

## Evidence

- `mcp-artifacts/persona-sweep/report.json`
- `mcp-artifacts/persona-sweep/screenshots/advisor__leads.png`
- `mcp-artifacts/persona-sweep/screenshots/advisor__leads__movable.png`
- `mcp-artifacts/persona-sweep/screenshots/compliance__compliance-officer__audit.png`
- `mcp-artifacts/persona-sweep/screenshots/advisor__facebook-campaign-detail.png`
- `mcp-artifacts/workflow-tests/lead-pipeline-ui.json`
