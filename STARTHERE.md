# Vireos — Project Access & Reference

## Trello

| Field | Value |
|-------|-------|
| URL | https://trello.com/b/nCEuPf5D/vireos |
| Email | robert.brooks@mvp.dev |
| Password | 9pd^sFvF=G4*p*c |
| Workspace | MVP.dev Projs 2026 |

**Board lists:** To Do → In Progress → Done Dev → Ready for Testing (Czar, Aprilyn) → User Acceptance Testing (Shea) → UAT Found Bugs → Completed

---

## Figma Make (Frontend Prototype)

| Field | Value |
|-------|-------|
| URL | https://www.figma.com/make/mWeTzYK0qofacf8KmdgHkW/Vireos-SaaS-Web-App-Mockup |
| Email | robert@goldenaccessventures.com |
| Password | C@ndyb@rs1 |

**Screens:** 24+ screens across 4 personas (Advisor, Admin, Compliance Officer, Super Admin). Includes Boss Mode (full dashboard) and Easy Mode (agentic AI chat).

---

## AWS MVP Deployment (LIVE)

| Item | Value |
|------|-------|
| **App URL** | https://vireos.mvp.dev |
| **Health Check** | https://vireos.mvp.dev/health |
| **SSH** | `ssh -i infra/aws-mvp/vireos-mvp-key.pem ec2-user@54.241.49.208` |
| **Region** | us-west-1 (N. California) |
| **Instance** | t3.medium, Amazon Linux 2023, 30GB gp3 |
| **Elastic IP** | 54.241.49.208 |
| **AWS Account** | 689546300257 |
| **Domain** | vireos.mvp.dev (Cloudflare DNS → A record) |
| **TLS** | Let's Encrypt (auto-renewed by Caddy) |
| **Est. Cost** | ~$34/month |

### Architecture
```
Internet → :443 (Caddy, Let's Encrypt TLS) → :13443 (Express + React)
                                          → PostgreSQL 16
                                          → Redis 7
                                          → BullMQ Worker
```

### Common Operations
```bash
# SSH into instance
ssh -i infra/aws-mvp/vireos-mvp-key.pem ec2-user@54.241.49.208

# Container status
cd infra/aws-mvp && ./deploy.sh status

# View logs
cd infra/aws-mvp && ./deploy.sh logs

# Redeploy after code changes
cd infra/aws-mvp && ./deploy.sh

# Restart containers (no rebuild)
cd infra/aws-mvp && ./deploy.sh restart

# Tear down everything
cd infra/aws-mvp && terraform destroy
```

### Infrastructure Files (`infra/aws-mvp/`)
| File | Purpose |
|------|---------|
| `main.tf` | Terraform root — EC2, security group, EIP, SSH key |
| `variables.tf` | Input variables (region, instance type, etc.) |
| `outputs.tf` | Terraform outputs (IP, SSH command, app URL) |
| `user-data.sh` | EC2 first-boot bootstrap (Docker, Compose, Caddy) |
| `Caddyfile` | Reverse proxy config (:443 → :13443) |
| `deploy.sh` | Deploy helper (sync, build, start, logs, status) |
| `.env` | Production environment variables (not in git) |

### Client Transfer
1. Client provides AWS credentials
2. `aws configure` with their creds
3. `cd infra/aws-mvp && terraform apply`
4. Update `.env` with new Elastic IP
5. `./deploy.sh`
6. Optionally migrate data: `pg_dump` from old → `pg_restore` on new

---

## Backend — Local Development

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)

### Quick Start
```bash
cd backend
cp .env.example .env        # Fill in required values
make dev                     # Starts Postgres + Redis + app with hot reload
make migrate                 # Run Prisma migrations
make seed                    # Seed demo data
make test                    # Run full test suite (510/510)
```

### Demo Seed Credentials
| Role | Email | Password |
|------|-------|----------|
| super_admin | super@vireos.com | Password123! |
| org_admin | admin@vireos-demo.com | Password123! |
| advisor | advisor@vireos-demo.com | Password123! |
| viewer (compliance) | compliance@vireos-demo.com | Password123! |

Demo org: **Vireos Demo Firm** (slug: `vireos-demo`, 1000 credits, TRIALING)

---

## Environment Variables (backend/.env)

Copy `backend/.env.example` to `backend/.env` and fill in:

### Required — Infrastructure
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | 64-char hex string — generate: `openssl rand -hex 64` |
| `ENCRYPTION_KEY` | 32-char hex string — generate: `openssl rand -hex 32` |

### Required — External APIs
| Variable | Obtain From |
|----------|-------------|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | https://www.linkedin.com/developers/apps |
| `LINKEDIN_REDIRECT_URI` | Must match LinkedIn app settings |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | https://developers.facebook.com/apps |
| `FACEBOOK_REDIRECT_URI` | Must match Facebook app settings |
| `SENDGRID_API_KEY` | https://app.sendgrid.com/settings/api_keys |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | https://dashboard.stripe.com/webhooks |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS IAM console |
| `AWS_S3_BUCKET` / `AWS_REGION` | S3 bucket for file storage |

### Facebook Webhook
| Variable | Value |
|----------|-------|
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Any secret string you define; register it in the Facebook App dashboard |

---

## Docker Services (dev)

| Service | URL | Credentials |
|---------|-----|-------------|
| API | http://localhost:3000 | — |
| pgAdmin | http://localhost:5050 | admin@vireos.com / admin |
| Redis Commander | http://localhost:8081 | — |
| PostgreSQL | localhost:5432 | vireos / vireos_dev |

---

## Backend Architecture

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | Express 5 |
| ORM | Prisma 5 + PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Auth | JWT HS256 (15m access / 7d refresh) + bcrypt-12 |
| Encryption | AES-256-GCM (OAuth tokens at rest) |
| Validation | Zod |
| Logging | Winston (JSON prod / pretty dev) |
| Tests | Jest + ts-jest + supertest — **510/510 passing** |

### Queue Workers
| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| `publish` | 5 | Social media post publishing |
| `email` | 2 | Email sequence delivery (SendGrid) |
| `linkedin-campaign` | 1 | LinkedIn outbound messaging |
| `notification` | 10 | In-app & email notifications |

Start workers separately: `npm run start:worker`

---

## API Base URLs

| Environment | URL |
|-------------|-----|
| Local | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| API v1 | http://localhost:3000/api/v1 |

---

## Key API Endpoints

```
POST   /api/v1/auth/login
GET    /api/v1/auth/me
GET    /health/ready          # Readiness probe (DB + Redis)
GET    /metrics               # Prometheus-style metrics (super_admin only)
GET    /api/v1/audit          # Audit trail
```

Full endpoint list: see `backend/src/routes/index.ts`

---

## Makefile Reference

```bash
make dev          # Start dev environment (hot reload)
make build        # Production build
make test         # Run test suite
make typecheck    # TypeScript check
make lint         # ESLint
make migrate      # Run pending migrations
make seed         # Seed demo data
make generate     # Regenerate Prisma client
make docker-up    # Start Docker services
make docker-down  # Stop Docker services
make shell        # Shell into app container
```
