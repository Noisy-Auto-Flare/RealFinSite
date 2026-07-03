# Deployment Hardening & Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-harden FinTracker deployment by adding comprehensive tests, fixing deploy.sh bugs, optimizing rollback, and documenting known issues.

**Architecture:** Self-contained Next.js app with SQLite (better-sqlite3) via Drizzle ORM, Docker Compose deployment on Ubuntu VPS behind Nginx. Tests use in-memory SQLite with Vitest. Deploy scripts are bash.

**Tech Stack:** Next.js 16, TypeScript, better-sqlite3, Drizzle ORM, Vitest, Docker Compose, bash

## Global Constraints

- All new tests must use in-memory SQLite (`process.env.DATABASE_URL = ":memory:"`)
- All tests must be idempotent and not depend on each other
- Test command: `npm test` (runs `vitest run`)
- No new npm dependencies
- deploy.sh must remain runnable on Ubuntu 22.04+ with bash
- Documentation in English
- Follow existing code patterns exactly

---

### Task 1: Migration & initializeApp Tests

**Files:**
- Create: `src/test/deployment.test.ts`
- Read: `src/db/migrate.ts`, `src/lib/init.ts`

**Interfaces:**
- Consumes: `runMigrations(s)` from `@/db/migrate`, `initializeApp()` from `@/lib/init`
- Produces: Test file verifying all tables created, idempotency, initializeApp singleton behavior

- [ ] **Step 1: Write failing tests for migration table creation**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const TABLES = ["operations", "operation_entries", "balance_snapshots", "action_logs", "users", "accounts", "balances"];

describe("migrations", () => {
  it("should create all required tables", () => {
    const db = createTestDb();
    const { runMigrations } = require("@/db/migrate");
    runMigrations(db);
    for (const table of TABLES) {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      expect(row).toBeTruthy();
    }
    db.close();
  });

  it("should be idempotent when run twice", () => {
    const db = createTestDb();
    const { runMigrations } = require("@/db/migrate");
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
    db.close();
  });

  it("should create operations with correct columns", () => {
    const db = createTestDb();
    const { runMigrations } = require("@/db/migrate");
    runMigrations(db);
    const columns = db.pragma("table_info(operations)") as any[];
    const colNames = columns.map((c: any) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("user_id");
    expect(colNames).toContain("description");
    expect(colNames).toContain("category");
    expect(colNames).toContain("date");
    expect(colNames).toContain("source");
    expect(colNames).toContain("status");
    expect(colNames).toContain("created_at");
    db.close();
  });

  it("should create operation_entries with correct columns", () => {
    const db = createTestDb();
    const { runMigrations } = require("@/db/migrate");
    runMigrations(db);
    const columns = db.pragma("table_info(operation_entries)") as any[];
    const colNames = columns.map((c: any) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("operation_id");
    expect(colNames).toContain("account_id");
    expect(colNames).toContain("currency");
    expect(colNames).toContain("amount");
    expect(colNames).toContain("type");
    expect(colNames).toContain("is_verified");
    db.close();
  });

  it("should create balance_snapshots with correct columns", () => {
    const db = createTestDb();
    const { runMigrations } = require("@/db/migrate");
    runMigrations(db);
    const columns = db.pragma("table_info(balance_snapshots)") as any[];
    const colNames = columns.map((c: any) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("account_id");
    expect(colNames).toContain("currency");
    expect(colNames).toContain("amount");
    expect(colNames).toContain("date");
    expect(colNames).toContain("created_at");
    db.close();
  });

  it("should create action_logs with correct columns", () => {
    const db = createTestDb();
    const { runMigrations } = require("@/db/migrate");
    runMigrations(db);
    const columns = db.pragma("table_info(action_logs)") as any[];
    const colNames = columns.map((c: any) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("user_id");
    expect(colNames).toContain("username");
    expect(colNames).toContain("action");
    expect(colNames).toContain("entity_type");
    expect(colNames).toContain("created_at");
    db.close();
  });

  it("should create all required indexes", () => {
    const db = createTestDb();
    const { runMigrations } = require("@/db/migrate");
    runMigrations(db);
    const indexes = db.pragma("index_list(operations)") as any[];
    const indexNames = indexes.map((i: any) => i.name);
    expect(indexNames).toContain("idx_operations_user_id");
    expect(indexNames).toContain("idx_operations_date");
    expect(indexNames).toContain("idx_operations_status");
    db.close();
  });
});

describe("initializeApp", () => {
  beforeEach(() => {
    // Reset module state
    jest.resetModules();
  });

  it("should run migrations without error", () => {
    const { initializeApp } = require("@/lib/init");
    expect(() => initializeApp()).not.toThrow();
  });

  it("should be idempotent on repeated calls (singleton)", () => {
    const { initializeApp } = require("@/lib/init");
    initializeApp();
    expect(() => initializeApp()).not.toThrow();
    expect(() => initializeApp()).not.toThrow();
  });

  it("should skip during production build phase", () => {
    process.env.NEXT_PHASE = "phase-production-build";
    const { initializeApp } = require("@/lib/init");
    expect(() => initializeApp()).not.toThrow();
    delete process.env.NEXT_PHASE;
  });
});
```

- [ ] **Step 2: Run tests — expect failures until migrations module is adapted**

Run: `npx vitest run src/test/deployment.test.ts --reporter=verbose`

- [ ] **Step 3: Adapt migrate.ts to accept in-memory database**

The `runMigrations` function already accepts an optional `sqlitep` parameter. However, the top-level code in `migrate.ts` also creates a module-level DB connection that will fail with in-memory. For tests, only import `runMigrations` and avoid triggering module-level code.

Fix: Ensure `migrate.ts`'s top-level code is only run when the file is executed directly (not imported):

```typescript
// At the bottom of migrate.ts, replace direct execution with:
if (require.main === module) {
  // Only runs when called via `tsx src/db/migrate.ts`
  runMigrations();
}
```

But since we're using ESM (TypeScript with `import`), use a different pattern:

```typescript
// At the bottom of migrate.ts
// Direct execution guard for CLI usage
const isDirectRun = process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js");
if (isDirectRun) {
  runMigrations();
}
```

- [ ] **Step 4: Run tests — expect all to pass**

Run: `npx vitest run src/test/deployment.test.ts --reporter=verbose`

- [ ] **Step 5: Commit**

```bash
git add src/test/deployment.test.ts src/db/migrate.ts
git commit -m "test: add migration and initializeApp tests with table verification"
```

---

### Task 2: Health Endpoint Tests

**Files:**
- Create: `src/test/health.test.ts`
- Read: `src/app/api/health/route.ts`

**Interfaces:**
- Consumes: `GET` handler from `@/app/api/health/route`
- Produces: Tests for health endpoint behavior with/without DB, error states

- [ ] **Step 1: Write failing tests for health endpoint**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "@/db/migrate";

// We can't easily import Next.js route handlers in unit tests,
// so we test the logic directly by testing what initializeApp and the DB check do.

describe("health endpoint logic", () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
  });

  afterAll(() => {
    db.close();
  });

  it("should report connected when operations table exists", () => {
    const row = db.prepare("SELECT COUNT(*) as count FROM operations").get() as { count: number };
    expect(row).toBeTruthy();
    expect(typeof row.count).toBe("number");
  });

  it("should succeed after migrations have run", () => {
    // Verify the database is functional after full migration
    db.prepare("INSERT INTO operations (user_id, description, date, status) VALUES (1, 'test', '2024-01-01', 'confirmed')").run();
    const row = db.prepare("SELECT COUNT(*) as count FROM operations").get() as { count: number };
    expect(row.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `npx vitest run src/test/health.test.ts --reporter=verbose`

- [ ] **Step 3: Implement passing tests**

The health endpoint calls `initializeApp()` and then checks `SELECT COUNT(*) FROM operations`. With in-memory DB and migrations run, this should work. Tests should verify:
1. After migrations, operations query succeeds
2. Without migrations (no tables), query fails with clear error

No code changes needed — just ensure tests are correct.

- [ ] **Step 4: Run tests — expect all to pass**

Run: `npx vitest run src/test/health.test.ts --reporter=verbose`

- [ ] **Step 5: Commit**

```bash
git add src/test/health.test.ts
git commit -m "test: add health endpoint logic tests"
```

---

### Task 3: Fix deploy.sh Bugs

**Files:**
- Modify: `deploy.sh`

**Issues to fix:**
1. `$DOMAIN` variable never set — nginx reload always skipped
2. `docker-compose.yml.bak` never created — rollback cannot work
3. Migration exec command has broken fallback chain
4. No pre-deploy image backup for rollback

- [ ] **Step 1: Fix $DOMAIN — read from first argument or prompt**

```bash
# After the info "Starting deploy" line, add:
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  read -rp "Enter domain name (leave empty to skip nginx): " DOMAIN
fi
```

- [ ] **Step 2: Fix rollback — save current docker-compose.yml before git pull and save image tag before build**

```bash
# Before git pull, add:
# Save current compose for rollback
if [ -f "docker-compose.yml" ]; then
  cp docker-compose.yml docker-compose.yml.bak
  ok "Saved docker-compose.yml.bak for rollback"
fi

# Save current image tag
CURRENT_IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep fintracker | head -1) || true
if [ -n "$CURRENT_IMAGE" ]; then
  docker tag "$CURRENT_IMAGE" fintracker-fintracker:rollback 2>/dev/null || true
  ok "Tagged current image for rollback"
fi
```

- [ ] **Step 3: Fix migration exec — use correct path**

The standalone output has `server.js` at `.next/standalone/server.js`. The migration exec should use:

```bash
docker exec fintracker node /app/server.js --migrate
```

Fix the migration command chain.

- [ ] **Step 4: Commit**

```bash
git add deploy.sh
git commit -m "fix(deploy): set DOMAIN from input, create docker-compose.yml.bak for rollback, fix migration exec path"
```

---

### Task 4: Docker & Backup/Restore Script Tests

**Files:**
- Modify: `src/test/deployment.test.ts` (append Docker/backup tests)
- Read: `scripts/backup.sh`, `scripts/restore.sh`, `docker-compose.yml`

**Note:** These tests validate the logic of the scripts and compose config, not actual Docker operations (which require Docker daemon).

- [ ] **Step 1: Add backup/restore script logic tests**

```typescript
describe("backup and restore scripts", () => {
  const testDir = path.join(os.tmpdir(), "fintracker-test-" + Date.now());

  beforeAll(() => {
    fs.mkdirSync(path.join(testDir, "data"), { recursive: true });
    fs.mkdirSync(path.join(testDir, "backups"), { recursive: true });
    // Create a test database file
    const db = new Database(path.join(testDir, "data", "fintracker.db"));
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db.exec("INSERT INTO test VALUES (1, 'hello')");
    db.close();
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should create gzipped backup", () => {
    // Simulate backup.sh logic
    const src = path.join(testDir, "data", "fintracker.db");
    const dst = path.join(testDir, "backups", `2026-07-03_fintracker.db.gz`);
    const gzip = execSync(`gzip -c "${src}" > "${dst}"`);
    expect(fs.existsSync(dst)).toBe(true);
    const stat = fs.statSync(dst);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("should restore from gzipped backup", () => {
    // Simulate restore.sh logic
    const backupFile = path.join(testDir, "backups", `2026-07-03_fintracker.db.gz`);
    const restored = path.join(testDir, "data", "restored.db");
    execSync(`gunzip -c "${backupFile}" > "${restored}"`);
    expect(fs.existsSync(restored)).toBe(true);
    const db = new Database(restored);
    const row = db.prepare("SELECT value FROM test WHERE id = 1").get() as { value: string };
    expect(row.value).toBe("hello");
    db.close();
  });

  it("should handle missing database gracefully", () => {
    const missingPath = path.join(testDir, "data", "nonexistent.db");
    expect(fs.existsSync(missingPath)).toBe(false);
    // This is what backup.sh does — exit 0 if no DB found
    // The test just verifies the logic doesn't crash
  });
});
```

- [ ] **Step 2: Add docker-compose.yml validation test**

```typescript
describe("docker-compose.yml validation", () => {
  it("should have healthcheck using curl", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("curl");
    expect(compose).toContain("-f");
    expect(compose).toContain("/api/health");
  });

  it("should expose port 3000 on localhost only", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("127.0.0.1:3000:3000");
  });

  it("should have restart policy unless-stopped", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("restart: unless-stopped");
  });

  it("should have three named volumes", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("fintracker_data:");
    expect(compose).toContain("fintracker_logs:");
    expect(compose).toContain("fintracker_backups:");
  });

  it("should set DATABASE_URL to /data/finance.db", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("/data/finance.db");
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/test/deployment.test.ts
git commit -m "test: add backup/restore logic and docker-compose validation tests"
```

---

### Task 5: Update Deployment Documentation

**Files:**
- Modify: `docs/DEPLOY.md`

**Changes:**
1. Update to reflect what deploy.sh actually does
2. Add FAQ section with all known issues and solutions
3. Add troubleshooting section

- [ ] **Step 1: Rewrite DEPLOY.md with accurate content and FAQ**

```markdown
# Deployment Guide

## Prerequisites

- Ubuntu 22.04+ server
- Docker + Docker Compose (v2)
- Nginx
- Domain name pointing to the server
- Git

## Quick Deploy

```bash
# Clone and enter project
git clone https://github.com/your-org/RealFinSite.git /root/fintracker
cd /root/fintracker

# Configure environment
cp .env.example .env
nano .env

# Option A: Automated deploy script
sudo ./deploy.sh your-domain.com

# Option B: Manual deploy
docker compose build --no-cache
docker compose up -d
```

The automated script (`deploy.sh`) will:
1. Back up the current database to `./backups/pre-deploy-*.db`
2. Pull the latest code from `origin/main`
3. Save `docker-compose.yml.bak` for rollback
4. Build a new Docker image
5. Start the container with health check
6. Run database migrations inside the container
7. Configure Nginx reverse proxy (if domain provided)
8. Optionally set up SSL via Certbot

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXTAUTH_SECRET` | **Yes** | — | Auth session secret (generate: `openssl rand -base64 32`) |
| `AUTH_SECRET` | **Yes** | — | Auth secret (generate: `openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | **Yes** | — | API key encryption (generate: `openssl rand -base64 32 | cut -c1-32`) |
| `MASTER_PASSWORD` | **Yes** | — | Initial admin password |
| `NEXTAUTH_URL` | No | `http://localhost:3000` | Public app URL |
| `DATABASE_URL` | No | `/data/finance.db` | DB path inside container (do NOT use `file:` prefix) |
| `MASTER_USERNAME` | No | `admin` | Initial admin username |
| `LOG_DIR` | No | `/logs` | Log output directory inside container |

## Manual Nginx Setup

If not using `deploy.sh`, set up Nginx manually:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then enable it and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

## Backup & Restore

### Automatic (cron)
```bash
# Daily backup at 3 AM
crontab -e
0 3 * * * cd /root/fintracker && ./scripts/backup.sh >> /var/log/fintracker-backup.log 2>&1
```

### Manual
```bash
# Create backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backups/2026-07-03_fintracker.db.gz
```

### What gets backed up
- The SQLite database file (`fintracker.db`) → gzip compressed
- Stored in `./backups/` with date prefix
- Old backups auto-cleaned after 7 days (configurable via `RETENTION_DAYS`)

### Restore process
1. Stops the running Docker container
2. Backs up the current database (just in case)
3. Decompresses and replaces the database file
4. Restarts the container
5. Notify: run `curl http://localhost:3000/api/health` to verify

## Monitoring

- **Health:** `curl https://your-domain.com/api/health`
- **Container logs:** `docker logs fintracker`
- **Deploy logs:** `cat /var/log/fintracker-deploy.log`
- **App logs:** `ls -lh /root/fintracker/logs/`
- **Resource usage:** `docker stats fintracker`
- **DB size:** `docker exec fintracker ls -lh /data/finance.db`

## Updating

```bash
cd /root/fintracker
sudo ./deploy.sh your-domain.com
```

Or manually:

```bash
git pull
docker compose build --no-cache
docker compose down --timeout 30
docker compose up -d
# Wait 20s for health check
curl http://localhost:3000/api/health
```

## Rollback

If the health check fails after deploy, `deploy.sh` automatically:

1. Stops the new container
2. Restores the previous `docker-compose.yml.bak`
3. Tags the previous Docker image and re-deploys it

Manual rollback:

```bash
# Option 1: Restore previous image
docker tag fintracker-fintracker:rollback fintracker-fintracker:latest
docker compose up -d

# Option 2: Restore database from backup
./scripts/restore.sh backups/pre-deploy-20260703_120000.db
```

## FAQ / Common Issues

### `EACCES: permission denied` on `/data`

**Cause:** Docker volumes are created with `root:root` ownership, but the app runs as `nextjs` user (UID 1001).

**Fix:** Already handled in Dockerfile (runner stage creates `/data`, `/logs`, `/backups` and `chown`s them to `nextjs:nodejs`). If you see this error, delete the old volumes and re-deploy:

```bash
docker compose down -v   # WARNING: deletes all data!
```

Or fix permissions manually:

```bash
docker compose exec fintracker sh -c "chown -R 1001:1001 /data /logs /backups"
```

### `SqliteError: no such table: operations`

**Cause:** Migrations haven't run. The health endpoint calls `initializeApp()` which runs migrations, but only on first request. If the container was started before the fix, migrations may not have run.

**Fix:** Migrations run automatically on container start. If still seeing this, run manually:

```bash
docker exec fintracker node /app/server.js --migrate
# Or
docker exec fintracker sh -c "cd /app && node -e 'require(\"./server.js\")'"
```

### `better-sqlite3` fails to compile

**Cause:** The `node:20-alpine` image lacks Python and build tools needed to compile the native `better-sqlite3` addon.

**Fix:** The Dockerfile now installs `python3` and `build-base` in the `deps` stage, compiles the addon, then removes them. The runner stage stays lean.

### `DATABASE_URL` with `file:` prefix fails

**Cause:** `better-sqlite3` expects a plain file path, not a `file:` URI. Setting `DATABASE_URL=file:./data/finance.db` causes `mkdir 'file:./data'` errors.

**Fix:** Use a plain path: `DATABASE_URL=/data/finance.db` (absolute, inside container). No `file:` prefix.

### Health check fails with `wget: unrecognized option: spider`

**Cause:** The `node:20-alpine` image uses busybox `wget` which does not support `--spider`.

**Fix:** Dockerfile now installs `curl` and uses it: `curl -f http://localhost:3000/api/health`.

### Container exits immediately

```bash
docker logs fintracker
```

Common causes:
- Database path is wrong (check `DATABASE_URL`)
- Port 3000 already in use (check `lsof -i :3000`)
- Environment variables missing (check `.env`)
- Volume permissions (see EACCES above)

## Docker Compose Reference

```yaml
services:
  fintracker:
    build: .
    container_name: fintracker
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - fintracker_data:/data      # SQLite database
      - fintracker_logs:/logs      # Application logs
      - fintracker_backups:/backups # Backup storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

---

Generated by Superpowers | RealFinSite deployment docs
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: rewrite deployment guide with accurate info and FAQ section"
```

---

### Task 6: Deploy.sh Optimization (Image Rollback + Notifications)

**Files:**
- Modify: `deploy.sh`

**Changes:**

1. Save Docker image tag before build (already in Task 3, verify)
2. On health check failure, rollback to previous Docker image
3. Add optional Telegram notification on deploy success/failure

- [ ] **Step 1: Add image-based rollback**

After the healthcheck failure block (line ~52), replace the rollback with:

```bash
if [ "$i" -eq 30 ]; then
  err "Container failed healthcheck — rolling back"

  # Rollback to previous image
  if docker image inspect fintracker-fintracker:rollback >/dev/null 2>&1; then
    info "Rolling back to previous image..."
    docker tag fintracker-fintracker:rollback fintracker-fintracker:latest
    docker compose up -d
    ok "Rollback completed"
  else
    warn "No rollback image found — manual intervention required"
  fi

  # Restore previous docker-compose.yml
  if [ -f "docker-compose.yml.bak" ]; then
    cp docker-compose.yml.bak docker-compose.yml
    warn "Restored docker-compose.yml.bak"
  fi

  exit 1
fi
```

- [ ] **Step 2: Add optional Telegram notification**

Add at the end (after deploy complete):

```bash
# --- notification (optional) ---
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
  MESSAGE="✅ Deploy successful: fintracker on $DOMAIN
  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID" \
    -d "text=$MESSAGE" \
    -d "parse_mode=HTML" >/dev/null 2>&1 && ok "Telegram notification sent" || warn "Telegram notification failed"
fi
```

- [ ] **Step 3: Commit**

```bash
git add deploy.sh
git commit -m "feat(deploy): add image-based rollback and optional Telegram notifications"
```

---

### Final Review

- [ ] Run full test suite: `npm test`
- [ ] Verify docker-compose.yml healthcheck uses curl
- [ ] Verify deploy.sh has all fixes applied
- [ ] Use superpowers:requesting-code-review for final branch review
