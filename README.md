# FinTracker

Personal finance tracker with multi-leg operation model, exchange integration, network scanners, and balance reconciliation.

## Features

- **Multi-leg operations**: one event = N entries (deposits, withdrawals, fees, interest)
- **Exchange integration**: auto-sync from Bybit, OKX via API
- **Network scanning**: scan blockchain wallets for transactions
- **Balance reconciliation**: automatic fee detection, balance recalculation
- **Balance snapshots**: manual/auto snapshots with history
- **Multi-user**: role-based access (user / master / admin)
- **Export**: operations list with filters

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Auth**: NextAuth.js
- **Testing**: Vitest
- **Deploy**: Docker Compose + Nginx + Certbot

## Quick Start (Local Dev)

```bash
# 1. Clone and install
git clone <repo-url>
cd fintracker
npm install

# 2. Environment
cp .env.example .env.local
# Edit .env.local with your secrets

# 3. Initialize DB
npm run db:migrate

# 4. Run
npm run dev
```

Open http://localhost:3000 — register a user and start tracking.

## Production (Docker)

```bash
# 1. Build
docker compose build

# 2. Start
docker compose up -d

# 3. Check health
curl http://localhost:3000/api/health
```

See [docs/DEPLOY.md](docs/DEPLOY.md) for full deployment guide.

## Project Structure

```
src/
├── app/              # Next.js App Router pages & API
│   ├── api/          # REST API endpoints
│   └── (dashboard)/  # Dashboard pages
├── components/       # React components
├── db/               # Database schema, migrations
├── lib/              # Business logic, scanners, exchanges
└── test/             # Tests
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | SQLite path (default: ./data/fintracker.db) |
| `NEXTAUTH_SECRET` | Yes | NextAuth encryption secret |
| `NEXTAUTH_URL` | Yes | App URL for auth callbacks |
| `AUTH_SECRET` | Yes | Auth secret |
| `ENCRYPTION_KEY` | Yes | Key encryption key (32 chars) |
| `MASTER_USERNAME` | No | Admin username (default: admin) |
| `MASTER_PASSWORD` | Yes | Admin password |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run db:migrate` | Run database migrations |
| `scripts/backup.sh` | Backup database |
| `scripts/restore.sh` | Restore database from backup |

## License

MIT
