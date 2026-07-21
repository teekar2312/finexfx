# Prisma Folder (Legacy)

This folder is kept for **seed scripts** that are referenced by `package.json`:

- `seed.ts` — Seeds 30 indicators, risk settings, and system config (Drizzle-backed)
- `seed-calendar.ts` — Seeds economic calendar events (Drizzle-backed)

## ⚠️ Prisma Has Been Removed

This project now uses **Drizzle ORM**. The old `schema.prisma` file has been
deleted. The active schema lives at:

```
src/lib/db/schema.ts
```

## DB Commands

```bash
bun run db:push       # Sync schema → SQLite
bun run db:generate   # Generate SQL migration files
bun run db:migrate    # Apply pending migrations
bun run db:studio     # Open Drizzle Studio
bun run db:reset      # Drop DB + re-push + re-seed
bun run seed          # Run prisma/seed.ts
bun run seed:auth     # Create default admin user
```

See the [main README](../README.md) and [MIGRATION.md](../MIGRATION.md) for details.
