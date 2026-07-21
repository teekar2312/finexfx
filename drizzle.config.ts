import { defineConfig } from 'drizzle-kit'
import { resolve, dirname } from 'path'
import { existsSync, readFileSync } from 'fs'

// Drizzle Kit configuration — replaces prisma.config / prisma/db push.
// Database: SQLite via better-sqlite3 (matches the Drizzle runtime adapter in src/lib/db.ts).
//
// Commands (mirrors the old Prisma scripts in package.json):
//   bun run db:generate   → drizzle-kit generate   (create SQL migration files)
//   bun run db:push       → drizzle-kit push       (sync schema to SQLite, no migration)
//   bun run db:migrate    → drizzle-kit migrate    (apply generated migrations)
//   bun run db:studio     → drizzle-kit studio     (GUI inspector)

// Explicitly load .env from THIS project's root (drizzle-kit does not auto-load
// .env, and bun's auto-load may pick up a parent .env from a different project).
// Use process.cwd() because import.meta.url can resolve to a transpiled temp
// file location when run via bun, breaking dirname-based resolution.
const projectRoot = process.cwd()
const envPath = resolve(projectRoot, '.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // Only populate missing environment variables so explicit overrides
    // still take precedence over .env values.
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

// Resolve DB path to absolute — relative paths are resolved from the project
// root (this file's directory), NOT process.cwd(), so the same .env works
// regardless of where `bun run db:*` is invoked from.
function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL?.replace(/^file:/, '') || './db/custom.db'
  return raw.startsWith('/') ? raw : resolve(projectRoot, raw)
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolveDbPath(),
  },
  verbose: true,
  strict: true,
})
