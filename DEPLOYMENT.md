# TenderOS — Production Deployment Guide

## Overview

TenderOS is deployed on **Vercel** (frontend + API) with a **PostgreSQL** database
(Neon or Supabase recommended for serverless), **AWS S3** for document storage,
**Clerk** for authentication, and **Anthropic / OpenAI** for AI generation.

---

## Pre-Deployment Checklist

### 1. Database Setup

```bash
# Option A: Neon (recommended — serverless PostgreSQL, free tier)
# 1. Sign up at neon.tech
# 2. Create project "tenderos-production"
# 3. Copy connection string (with pooling enabled):
#    postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neon?sslmode=require&pgbouncer=true

# Option B: Supabase
# 1. Sign up at supabase.com
# 2. Create project, go to Settings → Database
# 3. Use the "Connection Pooling" URI (port 6543, mode: transaction)

# Run migrations (do this BEFORE deploying the app)
DATABASE_URL="your-production-url" npx prisma migrate deploy
```

### 2. AWS S3 Setup

```bash
# 1. Create S3 bucket: tenderos-production
#    Region: me-central-1 (UAE) for MENA customers, or us-east-1 for global

# 2. Bucket settings:
#    - Block all public access: ON
#    - Versioning: ON (protects against accidental deletions)
#    - Server-side encryption: SSE-S3 or SSE-KMS

# 3. CORS configuration (paste in S3 → Permissions → CORS):
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["https://app.tenderos.ai"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]

# 4. IAM User (least privilege):
#    Create IAM user with this policy:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:HeadObject",
        "s3:HeadBucket"
      ],
      "Resource": [
        "arn:aws:s3:::tenderos-production",
        "arn:aws:s3:::tenderos-production/*"
      ]
    }
  ]
}
```

### 3. Clerk Production Setup

```
1. Go to dashboard.clerk.com → Create Production Application
2. Configure sign-in methods (Email, Google, Microsoft)
3. Enable Organizations in Settings → Organizations
4. Add webhook endpoint:
   URL: https://app.tenderos.ai/api/webhooks/clerk
   Events: organization.*, organizationMembership.*, user.*
5. Copy signing secret → CLERK_WEBHOOK_SECRET
6. Configure allowed redirect URLs:
   https://app.tenderos.ai/sign-in/sso-callback
   https://app.tenderos.ai/dashboard
```

### 4. Sentry Setup

```bash
# Run the Sentry wizard (interactive setup)
npx @sentry/wizard@latest -i nextjs

# Or manually:
# 1. Create project at sentry.io
# 2. Add NEXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN to Vercel env vars
# 3. The sentry.*.config.ts files handle the rest
```

---

## Vercel Deployment Steps

### Step 1: Install Vercel CLI and link project

```bash
npm install -g vercel
vercel login
vercel link  # Link to your Vercel project
```

### Step 2: Configure environment variables in Vercel

Go to Vercel Dashboard → Project → Settings → Environment Variables.
Add ALL variables from `.env.production.example`.

Critical variables:
| Variable | Where to get it |
|----------|-----------------|
| `DATABASE_URL` | Neon / Supabase connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard → Webhooks |
| `AWS_ACCESS_KEY_ID` | AWS IAM → Users → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM → Users → Security credentials |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `INTERNAL_API_KEY` | `openssl rand -hex 32` |
| `CRON_SECRET` | `openssl rand -hex 32` |

### Step 3: GitHub Actions secrets

Add these secrets in GitHub → Repository → Settings → Secrets → Actions:

```
VERCEL_TOKEN          # Vercel Dashboard → Account Settings → Tokens
VERCEL_ORG_ID         # From .vercel/project.json after `vercel link`
VERCEL_PROJECT_ID     # From .vercel/project.json after `vercel link`
DATABASE_URL          # Production DB connection string
```

### Step 4: Deploy

```bash
# Manual deploy (first time)
vercel --prod

# After that, every push to main auto-deploys via GitHub Actions
# Every PR gets a preview deployment automatically
```

### Step 5: Verify deployment

```bash
# Health check
curl https://app.tenderos.ai/api/health

# Expected response:
{
  "status": "ok",
  "checks": {
    "database": { "status": "ok", "latencyMs": 45 },
    "s3": { "status": "ok", "latencyMs": 120 },
    "environment": { "status": "ok" }
  }
}
```

---

## Post-Deployment Checklist

### Authentication
- [ ] Sign up with a new account
- [ ] Create an organization
- [ ] Invite a team member
- [ ] Verify Clerk webhook fires and org appears in DB

### Core Flow
- [ ] Create a tender
- [ ] Upload a PDF document
- [ ] Document processes successfully (status → READY)
- [ ] Extract requirements (AI job completes)
- [ ] Generate compliance matrix
- [ ] Create a proposal
- [ ] Draft a section with AI (streaming works)
- [ ] Export to DOCX (downloads correctly)
- [ ] Open print preview (PDF export)

### Infrastructure
- [ ] `/api/health` returns 200
- [ ] Sentry receives a test error
- [ ] S3 presigned uploads work
- [ ] Cron jobs are listed in Vercel Dashboard

---

## Monitoring & Observability

### Sentry (Error Tracking)
- URL: https://sentry.io → your project
- Alerts: Configure for P0 errors (new issues, regressions)
- Performance: Review slow transactions weekly

### Vercel Analytics
- Enable in Vercel Dashboard → Analytics
- Monitor: Core Web Vitals, function execution time, error rates

### Uptime Monitoring
- Recommended: BetterStack (free tier), UptimeRobot, or Pingdom
- Monitor: `https://app.tenderos.ai/api/health` every 1 minute
- Alert on: HTTP status ≠ 200

### Database
- Neon: Built-in query metrics in dashboard
- Set up connection alerts for >80% pool usage
- Weekly: Review slow queries (pg_stat_statements)

---

## Scaling Guide

### Phase 1 (0–100 users): Current setup
- Vercel Hobby/Pro, Neon Free, S3 Standard

### Phase 2 (100–1,000 users)
- Vercel Pro (required for 300s functions)
- Neon Pro (connection pooling + autoscaling)
- Add Upstash Redis for distributed rate limiting
- Enable CloudFront CDN for S3 documents
- Move to dedicated Vercel region (EU/MENA)

### Phase 3 (1,000+ users)
- Consider: Queue service (Inngest, Trigger.dev) for AI jobs
- Database read replicas
- CDN for static assets
- Dedicated document processing service
- Private Anthropic Enterprise (zero data retention)

---

## Security Hardening Completed

✅ Security headers (CSP, HSTS, X-Frame-Options, etc.)
✅ Rate limiting on all API routes
✅ Clerk authentication on all protected routes
✅ Row-level security in PostgreSQL (Prisma)
✅ S3 presigned URLs (15-min expiry, no public bucket)
✅ Input validation with Zod on all API routes
✅ Structured logging with PII redaction
✅ Audit trail for sensitive operations
✅ Sentry error monitoring with PII scrubbing
✅ INTERNAL_API_KEY for service-to-service calls
✅ Environment variable validation at startup

---

## Rollback Procedure

```bash
# 1. In Vercel Dashboard → Deployments → find last good deployment
# 2. Click "..." → "Promote to Production"
# 3. If DB migration needs rollback:
#    prisma migrate resolve --rolled-back <migration-name>
#    (Note: Prisma doesn't auto-rollback — write manual SQL if needed)
```

---

## Support & Contact

- Engineering: engineering@tenderos.ai
- Security issues: security@tenderos.ai  
- Status page: status.tenderos.ai (set up with BetterStack)
