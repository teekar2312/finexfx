# Deployment Guide

> FINEX Indonesia Trading Dashboard

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Bun | 1.x | Runtime and package manager |
| Node.js | 18+ | Fallback runtime |
| SQLite3 | System lib | Usually pre-installed |
| Git | 2.x | For cloning |

---

## 1. Local Development

### Clone & Install

```bash
git clone https://github.com/teekar2312/finexfx.git
cd finexfx
bun install
```

### Environment Setup

Create `.env` in the project root:

```env
DATABASE_URL=file:./db/custom.db
```

### Database Setup

```bash
# Push schema to SQLite
bun run db:push

# (Optional) Generate Prisma client
bun run db:generate

# (Optional) Seed demo data after starting the server
curl -X POST http://localhost:3000/api/seed
```

### Start Development Server

```bash
bun run dev
```

The dev server starts on `http://localhost:3000` with hot-reload. Logs are written to both stdout and `dev.log`.

### Lint

```bash
bun run lint
```

---

## 2. Production Build

### Build

```bash
bun run build
```

This produces a standalone output in `.next/standalone/` with:
- Static assets copied into `.next/standalone/.next/static/`
- Public assets copied into `.next/standalone/public/`
- `server.js` entry point (Node.js compatible)

### Start Production Server

```bash
NODE_ENV=production bun .next/standalone/server.js
```

The server listens on port `3000` by default. Override with:

```bash
PORT=8080 bun .next/standalone/server.js
```

---

## 3. Docker Deployment

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM oven/bun:1 AS base

FROM base AS install
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS release
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/standalone/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/db ./db

ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/db/custom.db
ENV PORT=3000

EXPOSE 3000

CMD ["bun", ".next/standalone/server.js"]
```

### Build & Run

```bash
# Build image
docker build -t finex-indonesia .

# Run container
docker run -d \
  --name finex \
  -p 3000:3000 \
  -v finex-data:/app/db \
  finex-indonesia
```

### Docker Compose

```yaml
version: '3.8'
services:
  finex:
    build: .
    ports:
      - '3000:3000'
    volumes:
      - finex-data:/app/db
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/db/custom.db
    restart: unless-stopped

volumes:
  finex-data:
```

```bash
docker compose up -d
```

---

## 4. Reverse Proxy (Caddy)

The project includes a `Caddyfile` for Caddy reverse proxy. This handles:
- HTTPS/TLS certificate management (automatic with Let's Encrypt)
- Single-port gateway for Next.js + mini-services
- `XTransformPort` query parameter routing

### Caddyfile (example)

```
finex.example.com {
    reverse_proxy localhost:3000
}
```

### Behind Caddy (mini-services)

For additional micro-services (e.g., WebSocket on port 3003), use the `XTransformPort` query parameter:

```
# Client connects to:
ws://finex.example.com/?XTransformPort=3003

# Caddy forwards to:
ws://localhost:3003/
```

---

## 5. Process Management

### Systemd Service

Create `/etc/systemd/system/finex.service`:

```ini
[Unit]
Description=FINEX Indonesia Trading Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/finex
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:/var/www/finex/db/custom.db
ExecStart=/usr/local/bin/bun .next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable finex
sudo systemctl start finex
```

---

## 6. Database Migrations

### Development

```bash
# Push schema changes (destructive — accepts data loss)
bun run db:push

# Run migrations (non-destructive)
bun run db:migrate

# Reset database (drops and recreates)
bun run db:reset
```

### Production

For production, prefer `db:migrate` over `db:push`:

```bash
# Create a migration
bunx prisma migrate dev --name descriptive_name

# Apply migrations in production
bunx prisma migrate deploy
```

### Backup SQLite

```bash
# Copy the database file
cp db/custom.db db/custom.db.backup-$(date +%Y%m%d-%H%M%S)
```

---

## 7. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./db/custom.db` | SQLite connection string |
| `NODE_ENV` | `development` | `production` enables optimizations |
| `PORT` | `3000` | Server port |

---

## 8. Health Check

```bash
curl -s http://localhost:3000/api
# Response: { "message": "Hello, world!" }
```

---

## 9. Post-Deploy Checklist

- [ ] Database schema pushed: `bun run db:push`
- [ ] Demo data seeded: `curl -X POST http://localhost:3000/api/seed`
- [ ] Health check passes: `curl http://localhost:3000/api`
- [ ] All 11 tabs render without errors
- [ ] Price simulation ticks are updating (check Dashboard watchlist)
- [ ] SQLite database file is persisted (not in container ephemeral storage)
- [ ] Reverse proxy / TLS configured (if applicable)
- [ ] Process manager configured for auto-restart
