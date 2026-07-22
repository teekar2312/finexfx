// FinexFX AI Trading System — Drizzle-backed database client.
//
// This file REPLACES the previous PrismaClient singleton. To minimise churn
// across the 45+ API route files that call `db.<model>.findMany(...)`,
// `db.<model>.create(...)`, `db.<model>.update(...)`, `db.<model>.updateMany(...)`,
// `db.<model>.delete(...)`, `db.<model>.deleteMany(...)`, `db.<model>.count(...)`,
// `db.<model>.findUnique(...)`, `db.<model>.findFirst(...)`, and
// `db.$transaction(async (tx) => ...)`, we expose a Prisma-compatible facade
// on top of a real Drizzle instance.
//
// Why a facade?
//   1. Keeps the migration low-risk — every route handler keeps working as-is.
//   2. The underlying engine is 100% Drizzle (drizzle-orm/bun-sqlite). You can
//      import { drizzleDb, schema } from '@/lib/db' anywhere and use native
//      Drizzle queries (db.select(...).from(...), db.insert(...).values(...), etc).
//   3. `db.$transaction(async (tx) => ...)` is supported — `tx` has the same
//      facade API as `db`, but bound to a Drizzle transaction.
//
// Mappings (Prisma → Drizzle):
//   findMany({ where, orderBy, take, skip, include, select })
//     → select(*).from(table).where(...).orderBy(...).limit(...).offset(...)
//   findUnique({ where: { id } }) → select where id =
//   findFirst({ where, orderBy }) → select + limit 1
//   create({ data }) → insert().values(data).returning()
//   update({ where: { id }, data }) → update().set(data).where(id=).returning()
//   updateMany({ where, data }) → update().set(data).where(...)
//   delete({ where: { id } }) → delete().where(id=)
//   deleteMany({ where }) → delete().where(...)
//   count({ where }) → count(*) with where
//
// Supported operators in `where`: { field: value }, { field: { equals, in, not,
// gt, gte, lt, lte, contains, startsWith, endsWith, isSet } } plus AND/OR arrays.
//
// orderBy: { fieldName: 'asc' | 'desc' } or [{...}].
//
// `include`: only supports `{ account: true }` / `{ trades: true }` style for
// the relations used in this codebase (Trade↔Account, AiSignal↔AiSignalOutcome,
// User↔UserSession). For deeper joins, switch to native Drizzle queries.

// NOTE: 'server-only' guard removed — it blocks CLI scripts (seed, seed-auth)
// that import db.ts outside of Next.js context. Instead, we use a runtime
// check that only throws in browser environments (Client Components).
if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/db.ts cannot be imported in the browser (Client Component). ' +
    'Database access is server-side only.'
  )
}
import { resolve as resolvePath, dirname as getDirname } from 'path'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import type { Database as BunDatabase } from 'bun:sqlite'

// ─────────────────────────────────────────────────────────────────────────────
// Force-load .env from THIS project's root.
// Next.js auto-loads .env, but when this module is imported from a nested
// monorepo or when a parent project's .env is on the search path, the parent
// .env can win (especially with bun's auto-loader). We read the local .env
// explicitly and set only unset variables so explicit environment values
// provided by the host are not overwritten.
// ─────────────────────────────────────────────────────────────────────────────
function loadLocalEnv() {
  // Walk up from process.cwd() to find the project root (where package.json + .env live).
  // We use process.cwd() instead of __dirname because __dirname is not available in ESM
  // (Next.js 16 uses ESM by default). When run via `bun run dev` or `next dev`, cwd is
  // the project root.
  let dir = resolvePath(process.cwd())
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolvePath(dir, 'package.json')) && existsSync(resolvePath(dir, '.env'))) {
      const envPath = resolvePath(dir, '.env')
      const content = readFileSync(envPath, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (process.env[key] === undefined) {
          process.env[key] = value
        }
      }
      return
    }
    const parent = resolvePath(dir, '..')
    if (parent === dir) break
    dir = parent
  }
}
loadLocalEnv()
import { eq, ne, gt, gte, lt, lte, inArray, notInArray, like, isNotNull, isNull, and, or, desc, asc, sql, type SQL } from 'drizzle-orm'

import * as schema from './db/schema'
import {
  accounts, trades, orders, indicators, newsItems, alerts, logs, backtests,
  aiSignals, aiSignalOutcomes, riskSettings, notifications, systemConfigs,
  users, userSessions, economicEvents,
  auditLogs, metrics,
} from './db/schema'

// ─────────────────────────────────────────────────────────────────────────────
// Resolve DB path (mirrors the old Prisma DATABASE_URL=file:... convention).
// Relative paths are resolved from process.cwd() so the same .env works
// whether the app is started via `bun run dev`, `next start`, or from a
// different working directory.
// ─────────────────────────────────────────────────────────────────────────────
function resolveDbPath(): string {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db'
  const stripped = url.replace(/^file:/, '')
  if (stripped.startsWith('/')) return stripped
  // Resolve relative path from cwd
  return resolvePath(process.cwd(), stripped)
}

function ensureDbDirectory(dbPath: string) {
  const dir = getDirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function isBunRuntime(): boolean {
  return typeof Bun !== 'undefined' || process?.release?.name === 'bun'
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Drizzle instance (HMR-safe via globalThis cache).
// ─────────────────────────────────────────────────────────────────────────────
const globalForDb = globalThis as unknown as {
  __drizzleInstance?: any
  __drizzleRawDb?: any
  __drizzleRawDbPath?: string
}

function createDrizzle() {
  const path = resolveDbPath()
  ensureDbDirectory(path)

  if (isBunRuntime()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database: BunDatabase } = require('bun:sqlite')
    const sqlite = new BunDatabase(path)
    sqlite.exec('PRAGMA journal_mode = WAL')
    sqlite.exec('PRAGMA foreign_keys = ON')
    sqlite.exec('PRAGMA busy_timeout = 5000')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/bun-sqlite')
    return { drizzle: drizzle(sqlite, { schema }), raw: sqlite, path }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const betterSqlite3 = require('better-sqlite3')
  const BetterSQLite3 = betterSqlite3.default ?? betterSqlite3
  const sqlite = new BetterSQLite3(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000') // wait 5s on DB lock instead of immediate error
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  return { drizzle: drizzle(sqlite, { schema }), raw: sqlite, path }
}

// Initialize (or reuse) the singleton.
let drizzleDb: any
let rawSqlite: any
const expectedPath = resolveDbPath()

if (globalForDb.__drizzleInstance && globalForDb.__drizzleRawDbPath === expectedPath) {
  drizzleDb = globalForDb.__drizzleInstance
  rawSqlite = globalForDb.__drizzleRawDb
} else {
  const created = createDrizzle()
  drizzleDb = created.drizzle
  rawSqlite = created.raw
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__drizzleInstance = drizzleDb
    globalForDb.__drizzleRawDb = rawSqlite
    globalForDb.__drizzleRawDbPath = expectedPath
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────────────────────
type AnyTable = typeof accounts | typeof trades | typeof orders | typeof indicators |
  typeof newsItems | typeof alerts | typeof logs | typeof backtests |
  typeof aiSignals | typeof aiSignalOutcomes | typeof riskSettings |
  typeof notifications | typeof systemConfigs | typeof users |
  typeof userSessions | typeof economicEvents |
  typeof auditLogs | typeof metrics

type Row<T extends AnyTable> = T['$inferSelect']
type InsertRow<T extends AnyTable> = T['$inferInsert']

// Prisma-like where clause
type PrismaOperator<T> = {
  equals?: T
  in?: T[]
  notIn?: T[]
  not?: T | { equals?: T }
  gt?: T
  gte?: T
  lt?: T
  lte?: T
  contains?: string
  startsWith?: string
  endsWith?: string
  isSet?: boolean // null check
}

type WhereValue<T> = T | PrismaOperator<T> | null
type WhereClause<T extends AnyTable> = {
  [K in keyof Row<T>]?: WhereValue<Row<T>[K]>
} & {
  AND?: Array<WhereClause<T>>
  OR?: Array<WhereClause<T>>
  NOT?: WhereClause<T>
}

type OrderByClause<T extends AnyTable> =
  | { [K in keyof Row<T>]?: 'asc' | 'desc' }
  | Array<{ [K in keyof Row<T>]?: 'asc' | 'desc' }>

// ─────────────────────────────────────────────────────────────────────────────
// Where clause → Drizzle SQL builder
// ─────────────────────────────────────────────────────────────────────────────
const tableConfigs: Record<string, { table: AnyTable; columns: Record<string, any> }> = {
  accounts: { table: accounts, columns: accounts as any },
  trades: { table: trades, columns: trades as any },
  orders: { table: orders, columns: orders as any },
  indicators: { table: indicators, columns: indicators as any },
  newsItems: { table: newsItems, columns: newsItems as any },
  alerts: { table: alerts, columns: alerts as any },
  logs: { table: logs, columns: logs as any },
  backtests: { table: backtests, columns: backtests as any },
  aiSignals: { table: aiSignals, columns: aiSignals as any },
  aiSignalOutcomes: { table: aiSignalOutcomes, columns: aiSignalOutcomes as any },
  riskSettings: { table: riskSettings, columns: riskSettings as any },
  notifications: { table: notifications, columns: notifications as any },
  systemConfigs: { table: systemConfigs, columns: systemConfigs as any },
  users: { table: users, columns: users as any },
  userSessions: { table: userSessions, columns: userSessions as any },
  economicEvents: { table: economicEvents, columns: economicEvents as any },
  auditLogs: { table: auditLogs, columns: auditLogs as any },
  metrics: { table: metrics, columns: metrics as any },
}

// Map camelCase field name (Prisma convention) → snake_case column key (Drizzle).
// Drizzle table columns are keyed by the JS property name (camelCase), not the
// DB column name. So `trades.accountId` is the correct accessor — no remap needed.
function buildWhere<T extends AnyTable>(
  table: T,
  where: WhereClause<T> | undefined,
  tableName?: string,
): SQL | undefined {
  if (!where) return undefined
  const conditions: SQL[] = []

  for (const [key, rawValue] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const arr = rawValue as any
      if (key === 'AND' && Array.isArray(arr)) {
        const subs = arr.map((w: any) => buildWhere(table, w, tableName)).filter(Boolean) as SQL[]
        if (subs.length) conditions.push(and(...subs)!)
      } else if (key === 'OR' && Array.isArray(arr)) {
        const subs = arr.map((w: any) => buildWhere(table, w, tableName)).filter(Boolean) as SQL[]
        if (subs.length) conditions.push(or(...subs)!)
      } else if (key === 'NOT' && arr) {
        const sub = buildWhere(table, arr, tableName)
        if (sub) conditions.push(sql`NOT (${sub})`)
      }
      continue
    }

    const col = (table as any)[key]
    if (!col) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[db] Unknown field "${key}" in where clause for table "${tableName ?? '?'}"`)
      }
      continue
    }

    if (rawValue === null || rawValue === undefined) {
      conditions.push(isNull(col))
      continue
    }

    if (typeof rawValue === 'object' && !Array.isArray(rawValue) && !(rawValue instanceof Date)) {
      const op = rawValue as PrismaOperator<any>
      if (op.equals !== undefined) {
        conditions.push(op.equals === null ? isNull(col) : eq(col, op.equals))
      }
      if (op.in !== undefined) conditions.push(inArray(col, op.in))
      if (op.notIn !== undefined) conditions.push(notInArray(col, op.notIn))
      if (op.not !== undefined) {
        if (op.not === null) {
          // Prisma semantics: `{ field: { not: null } }` means "field IS NOT NULL".
          // Do NOT emit `ne(col, null)` — in SQL that evaluates to NULL on every row.
          conditions.push(isNotNull(col))
        } else if (typeof op.not === 'object' && op.not !== null && 'equals' in op.not) {
          conditions.push(op.not.equals === null ? isNotNull(col) : ne(col, (op.not as any).equals))
        } else {
          conditions.push(ne(col, op.not as any))
        }
      }
      if (op.gt !== undefined) conditions.push(gt(col, op.gt))
      if (op.gte !== undefined) conditions.push(gte(col, op.gte))
      if (op.lt !== undefined) conditions.push(lt(col, op.lt))
      if (op.lte !== undefined) conditions.push(lte(col, op.lte))
      if (op.contains !== undefined) conditions.push(like(col, `%${op.contains}%`))
      if (op.startsWith !== undefined) conditions.push(like(col, `${op.startsWith}%`))
      if (op.endsWith !== undefined) conditions.push(like(col, `%${op.endsWith}`))
      if (op.isSet !== undefined) {
        conditions.push(op.isSet ? isNotNull(col) : isNull(col))
      }
    } else {
      // Plain equality
      conditions.push(eq(col, rawValue as any))
    }
  }

  if (conditions.length === 0) return undefined
  return conditions.length === 1 ? conditions[0] : and(...conditions)
}

function buildOrderBy<T extends AnyTable>(
  table: T,
  orderBy: OrderByClause<T> | undefined,
): SQL[] {
  if (!orderBy) return []
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy]
  const result: SQL[] = []
  for (const item of arr) {
    for (const [key, dir] of Object.entries(item)) {
      const col = (table as any)[key]
      if (!col) continue
      result.push(dir === 'asc' ? asc(col) : desc(col))
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma-compatible model wrapper
// ─────────────────────────────────────────────────────────────────────────────
interface FindManyArgs<T extends AnyTable> {
  where?: WhereClause<T>
  orderBy?: OrderByClause<T>
  take?: number
  skip?: number
  include?: any
  select?: { [K in keyof Row<T>]?: boolean }
}
interface FindUniqueArgs<T extends AnyTable> {
  where: { id: string } & WhereClause<T>
  include?: any
  select?: { [K in keyof Row<T>]?: boolean }
}
interface FindFirstArgs<T extends AnyTable> {
  where?: WhereClause<T>
  orderBy?: OrderByClause<T>
  include?: any
  select?: { [K in keyof Row<T>]?: boolean }
}
interface CreateArgs<T extends AnyTable> {
  data: InsertRow<T>
}
interface UpdateArgs<T extends AnyTable> {
  where: { id: string } & Partial<WhereClause<T>>
  data: Partial<InsertRow<T>> & Record<string, any>
}
interface UpdateManyArgs<T extends AnyTable> {
  where: WhereClause<T>
  data: Partial<InsertRow<T>> & Record<string, any>
}
interface DeleteArgs {
  where: { id: string } & Record<string, any>
}
interface DeleteManyArgs<T extends AnyTable> {
  where?: WhereClause<T>
}
interface CountArgs<T extends AnyTable> {
  where?: WhereClause<T>
}

// Operator helpers for `{ increment: n }` / `{ decrement: n }` Prisma shorthand.
function applyNumericOps(data: Record<string, any>, table: AnyTable): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [key, val] of Object.entries(data)) {
    const col = (table as any)[key]
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      if (val.increment !== undefined && col) {
        out[key] = sql`${col} + ${val.increment}`
      } else if (val.decrement !== undefined && col) {
        out[key] = sql`${col} - ${val.decrement}`
      } else if (val.multiply !== undefined && col) {
        out[key] = sql`${col} * ${val.multiply}`
      } else if (val.divide !== undefined && col) {
        out[key] = sql`${col} / ${val.divide}`
      } else {
        out[key] = val
      }
    } else {
      out[key] = val
    }
  }
  return out
}

// Relation loader — supports the relations actually used in this codebase.
async function loadRelations(row: any, include: any, tableName: string, db: BetterSQLite3Database<typeof schema>): Promise<any> {
  if (!include || !row) return row
  const result = { ...row }

  // Trade → account (and Trade → account → ...)
  if (tableName === 'trades' && include.account) {
    result.account = await db.query.accounts.findFirst({ where: eq(accounts.id, row.accountId) })
  }
  // Account → trades
  if (tableName === 'accounts' && include.trades) {
    result.trades = await db.query.trades.findMany({ where: eq(trades.accountId, row.id) })
  }
  // Account → orders
  if (tableName === 'accounts' && include.orders) {
    result.orders = await db.query.orders.findMany({ where: eq(orders.accountId, row.id) })
  }
  // AiSignal → outcome
  if (tableName === 'aiSignals' && include.outcome) {
    result.outcome = await db.query.aiSignalOutcomes.findFirst({ where: eq(aiSignalOutcomes.signalId, row.id) })
  }
  // User → sessions
  if (tableName === 'users' && include.sessions) {
    result.sessions = await db.query.userSessions.findMany({ where: eq(userSessions.userId, row.id) })
  }
  return result
}

// Build a Drizzle select clause from a Prisma-style `select` object.
// e.g. { name: true, balance: true } → { name: accounts.name, balance: accounts.balance }
function buildSelect<T extends AnyTable>(table: T, select: any): Record<string, any> | null {
  if (!select || typeof select !== 'object') return null
  const out: Record<string, any> = {}
  let hasAny = false
  for (const key of Object.keys(select)) {
    if (select[key] === true) {
      const col = (table as any)[key]
      if (col) {
        out[key] = col
        hasAny = true
      }
    }
  }
  return hasAny ? out : null
}

function makeModelWrapper<T extends AnyTable>(name: string, table: T, dbInstance: BetterSQLite3Database<typeof schema>) {
  return {
    async findMany(args: FindManyArgs<T> = {}): Promise<Row<T>[]> {
      const { where, orderBy, take, skip, include, select } = args
      const selectCols = buildSelect(table, select)
      let q = selectCols
        ? dbInstance.select(selectCols).from(table as any) as any
        : dbInstance.select().from(table as any) as any
      const w = buildWhere(table, where, name)
      if (w) q = q.where(w)
      const ords = buildOrderBy(table, orderBy)
      if (ords.length > 0) q = q.orderBy(...ords)
      if (skip !== undefined) q = q.offset(skip)
      if (take !== undefined) q = q.limit(take)
      const rows = await q
      if (include) {
        return Promise.all(rows.map((r: any) => loadRelations(r, include, name, dbInstance)))
      }
      return rows
    },

    async findUnique(args: FindUniqueArgs<T>): Promise<Row<T> | null> {
      const { where, include, select } = args
      const selectCols = buildSelect(table, select)
      const w = buildWhere(table, where as any, name)
      let q = selectCols
        ? dbInstance.select(selectCols).from(table as any) as any
        : dbInstance.select().from(table as any) as any
      q = q.where(w!).limit(1)
      const rows = await q
      if (rows.length === 0) return null
      if (include) return loadRelations(rows[0], include, name, dbInstance)
      return rows[0]
    },

    async findFirst(args: FindFirstArgs<T> = {}): Promise<Row<T> | null> {
      const { where, orderBy, include, select } = args
      const selectCols = buildSelect(table, select)
      let q = selectCols
        ? dbInstance.select(selectCols).from(table as any) as any
        : dbInstance.select().from(table as any) as any
      const w = buildWhere(table, where, name)
      if (w) q = q.where(w)
      const ords = buildOrderBy(table, orderBy)
      if (ords.length > 0) q = q.orderBy(...ords)
      q = q.limit(1)
      const rows = await q
      if (rows.length === 0) return null
      if (include) return loadRelations(rows[0], include, name, dbInstance)
      return rows[0]
    },

    async create(args: CreateArgs<T>): Promise<Row<T>> {
      const [row] = await (dbInstance.insert(table as any).values(args.data as any).returning() as any)
      return row
    },

    async update(args: UpdateArgs<T>): Promise<Row<T>> {
      const { where, data } = args
      const setData = applyNumericOps(data, table)
      // Build a where clause that includes id + any extra conditions
      const w = buildWhere(table, where as any, name)
      const rows = await (dbInstance.update(table as any).set(setData as any).where(w!).returning() as any)
      if (rows.length === 0) {
        throw new Error(`Record not found for update: ${JSON.stringify(where)}`)
      }
      return rows[0]
    },

    async updateMany(args: UpdateManyArgs<T>): Promise<{ count: number }> {
      const { where, data } = args
      const setData = applyNumericOps(data, table)
      const w = buildWhere(table, where, name)
      const result = await dbInstance.update(table as any).set(setData as any).where(w ?? sql`1=1`).run()
      return { count: result.changes }
    },

    async delete(args: DeleteArgs): Promise<Row<T>> {
      const { where } = args
      const w = buildWhere(table, where as any, name)
      const rows = await (dbInstance.delete(table as any).where(w!).returning() as any)
      if (rows.length === 0) {
        throw new Error(`Record not found for delete: ${JSON.stringify(where)}`)
      }
      return rows[0]
    },

    async deleteMany(args: DeleteManyArgs<T> = {}): Promise<{ count: number }> {
      const { where } = args
      const w = buildWhere(table, where, name)
      const result = await dbInstance.delete(table as any).where(w ?? sql`1=1`).run()
      return { count: result.changes }
    },

    async count(args: CountArgs<T> = {}): Promise<number> {
      const { where } = args
      const w = buildWhere(table, where, name)
      let q = dbInstance.select({ count: sql<number>`count(*)` }).from(table as any) as any
      if (w) q = q.where(w)
      const result = await q
      return Number(result[0]?.count ?? 0)
    },

    async createMany(args: { data: InsertRow<T> | InsertRow<T>[] }): Promise<{ count: number }> {
      const arr = Array.isArray(args.data) ? args.data : [args.data]
      if (arr.length === 0) return { count: 0 }
      const rows = await (dbInstance.insert(table as any).values(arr as any).returning() as any)
      return { count: rows.length }
    },

    async upsert(args: {
      where: { id?: string } & Partial<WhereClause<T>>
      create: InsertRow<T>
      update: Partial<InsertRow<T>>
    }): Promise<Row<T>> {
      const { where, create, update } = args

      // Tables with a unique `key` column — use native ON CONFLICT DO UPDATE (atomic)
      if (name === 'riskSettings' || name === 'systemConfigs') {
        const keyCol = (table as any).key
        const setData = applyNumericOps(update as any, table)
        const [row] = await (dbInstance.insert(table as any)
          .values(create as any)
          .onConflictDoUpdate({ target: keyCol, set: setData })
          .returning() as any)
        return row
      }

      // Other tables — wrap SELECT+INSERT/UPDATE in a transaction for atomicity
      const client = (dbInstance as any).$client ?? rawSqlite
      const alreadyInTx = client.inTransaction
      if (!alreadyInTx) client.exec('BEGIN IMMEDIATE TRANSACTION;')
      try {
        const w = buildWhere(table, where as any, name)
        let q = dbInstance.select().from(table as any) as any
        if (w) q = q.where(w)
        q = q.limit(1)
        const existing = await q
        let result: Row<T>
        if (existing.length > 0) {
          const setData = applyNumericOps(update as any, table)
          const rows = await (dbInstance.update(table as any).set(setData as any).where(w!).returning() as any)
          result = rows[0]
        } else {
          const [row] = await (dbInstance.insert(table as any).values(create as any).returning() as any)
          result = row
        }
        if (!alreadyInTx) client.exec('COMMIT;')
        return result
      } catch (err) {
        if (!alreadyInTx) { try { client.exec('ROLLBACK;') } catch {} }
        throw err
      }
    },

    async aggregate(args: {
      where?: WhereClause<T>
      _count?: { [K in keyof Row<T>]?: true } | true
      _sum?: { [K in keyof Row<T>]?: true }
      _avg?: { [K in keyof Row<T>]?: true }
      _min?: { [K in keyof Row<T>]?: true }
      _max?: { [K in keyof Row<T>]?: true }
    }): Promise<any> {
      const { where, _count, _sum, _avg, _min, _max } = args
      const w = buildWhere(table, where, name)
      const select: Record<string, any> = {}
      if (_count) {
        if (_count === true) {
          select._count = sql<number>`count(*)`
        } else {
          for (const k of Object.keys(_count)) {
            const col = (table as any)[k]
            if (col) select[`_count_${k}`] = sql<number>`count(${col})`
          }
        }
      }
      if (_sum) for (const k of Object.keys(_sum)) {
        const col = (table as any)[k]
        if (col) select[`_sum_${k}`] = sql<number>`coalesce(sum(${col}), 0)`
      }
      if (_avg) for (const k of Object.keys(_avg)) {
        const col = (table as any)[k]
        if (col) select[`_avg_${k}`] = sql<number>`coalesce(avg(${col}), 0)`
      }
      if (_min) for (const k of Object.keys(_min)) {
        const col = (table as any)[k]
        if (col) select[`_min_${k}`] = sql`min(${col})`
      }
      if (_max) for (const k of Object.keys(_max)) {
        const col = (table as any)[k]
        if (col) select[`_max_${k}`] = sql`max(${col})`
      }
      let q = dbInstance.select(select).from(table as any) as any
      if (w) q = q.where(w)
      const rows = await q
      return rows[0] || {}
    },

    async groupBy(args: {
      by: Array<keyof Row<T>>
      where?: WhereClause<T>
      _count?: { [K in keyof Row<T>]?: true } | true
      _sum?: { [K in keyof Row<T>]?: true }
      orderBy?: any
      take?: number
    }): Promise<any[]> {
      const { by, where, _count, _sum, orderBy, take } = args
      const w = buildWhere(table, where, name)
      const select: Record<string, any> = {}
      for (const k of by) {
        const col = (table as any)[k]
        if (col) select[k as string] = col
      }
      if (_count) {
        if (_count === true) select._count = sql<number>`count(*)`
        else for (const k of Object.keys(_count)) {
          const col = (table as any)[k]
          if (col) select[`_count_${k}`] = sql<number>`count(${col})`
        }
      }
      if (_sum) for (const k of Object.keys(_sum)) {
        const col = (table as any)[k]
        if (col) select[`_sum_${k}`] = sql<number>`coalesce(sum(${col}), 0)`
      }
      let q = dbInstance.select(select).from(table as any) as any
      if (w) q = q.where(w)
      for (const k of by) {
        const col = (table as any)[k]
        if (col) q = q.groupBy(col)
      }
      if (orderBy) {
        const arr = Array.isArray(orderBy) ? orderBy : [orderBy]
        for (const item of arr) {
          for (const [k, dir] of Object.entries(item)) {
            // _count desc pattern
            if (k === '_count' && dir === 'desc') q = q.orderBy(desc(sql`count(*)`))
            else if (k === '_count' && dir === 'asc') q = q.orderBy(asc(sql`count(*)`))
            else {
              const col = select[k] || (table as any)[k]
              if (col) q = q.orderBy(dir === 'asc' ? asc(col) : desc(col))
            }
          }
        }
      }
      if (take !== undefined) q = q.limit(take)
      return await q
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the Prisma-compatible facade bound to a specific Drizzle instance.
// Used both for the top-level `db` and for transaction `tx` objects.
// ─────────────────────────────────────────────────────────────────────────────
function buildFacade(instance: BetterSQLite3Database<typeof schema>) {
  return {
    account: makeModelWrapper('accounts', accounts, instance),
    accounts: makeModelWrapper('accounts', accounts, instance),
    trade: makeModelWrapper('trades', trades, instance),
    trades: makeModelWrapper('trades', trades, instance),
    order: makeModelWrapper('orders', orders, instance),
    orders: makeModelWrapper('orders', orders, instance),
    indicator: makeModelWrapper('indicators', indicators, instance),
    indicators: makeModelWrapper('indicators', indicators, instance),
    newsItem: makeModelWrapper('newsItems', newsItems, instance),
    newsItems: makeModelWrapper('newsItems', newsItems, instance),
    alert: makeModelWrapper('alerts', alerts, instance),
    alerts: makeModelWrapper('alerts', alerts, instance),
    log: makeModelWrapper('logs', logs, instance),
    logs: makeModelWrapper('logs', logs, instance),
    backtest: makeModelWrapper('backtests', backtests, instance),
    backtests: makeModelWrapper('backtests', backtests, instance),
    aiSignal: makeModelWrapper('aiSignals', aiSignals, instance),
    aiSignals: makeModelWrapper('aiSignals', aiSignals, instance),
    aiSignalOutcome: makeModelWrapper('aiSignalOutcomes', aiSignalOutcomes, instance),
    aiSignalOutcomes: makeModelWrapper('aiSignalOutcomes', aiSignalOutcomes, instance),
    riskSetting: makeModelWrapper('riskSettings', riskSettings, instance),
    riskSettings: makeModelWrapper('riskSettings', riskSettings, instance),
    notification: makeModelWrapper('notifications', notifications, instance),
    notifications: makeModelWrapper('notifications', notifications, instance),
    systemConfig: makeModelWrapper('systemConfigs', systemConfigs, instance),
    systemConfigs: makeModelWrapper('systemConfigs', systemConfigs, instance),
    user: makeModelWrapper('users', users, instance),
    users: makeModelWrapper('users', users, instance),
    userSession: makeModelWrapper('userSessions', userSessions, instance),
    userSessions: makeModelWrapper('userSessions', userSessions, instance),
    economicEvent: makeModelWrapper('economicEvents', economicEvents, instance),
    economicEvents: makeModelWrapper('economicEvents', economicEvents, instance),
    auditLog: makeModelWrapper('auditLogs', auditLogs, instance),
    auditLogs: makeModelWrapper('auditLogs', auditLogs, instance),
    metric: makeModelWrapper('metrics', metrics, instance),
    metrics: makeModelWrapper('metrics', metrics, instance),

    // Prisma's $transaction(async (tx) => { ... }) — interactive async transaction.
    //
    // better-sqlite3's native `.transaction()` is SYNCHRONOUS only — it cannot
    // accept an async callback. Drizzle's `db.transaction()` for better-sqlite3
    // inherits this limitation (throws "Transaction function cannot return a promise").
    //
    // To support Prisma's async interactive transaction API, we drive the
    // transaction manually with raw BEGIN / COMMIT / ROLLBACK statements on
    // the underlying better-sqlite3 connection. The facade `tx` passed to the
    // callback uses the SAME drizzle instance — but because better-sqlite3 is
    // single-threaded and we hold BEGIN on the shared connection, all queries
    // issued by `tx` are part of the transaction.
    //
    // IMPORTANT: This is NOT safe for concurrent transactions (better-sqlite3
    // is single-connection). Prisma's interactive transactions on SQLite have
    // the same limitation, so this matches Prisma's behavior.
    async $transaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
      const client = (instance as any).$client ?? rawSqlite
      // Use a savepoint if we're already inside a transaction (nested),
      // otherwise start a fresh transaction.
      const alreadyInTx = client.inTransaction
      const spName = alreadyInTx ? `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : null
      if (alreadyInTx && spName) {
        client.exec(`SAVEPOINT "${spName}";`)
      } else {
        client.exec('BEGIN IMMEDIATE TRANSACTION;')
      }
      try {
        const txFacade = buildFacade(instance)
        const result = await fn(txFacade)
        if (alreadyInTx && spName) {
          client.exec(`RELEASE SAVEPOINT "${spName}";`)
        } else {
          client.exec('COMMIT;')
        }
        return result
      } catch (err) {
        if (alreadyInTx && spName) {
          client.exec(`ROLLBACK TO SAVEPOINT "${spName}";`)
          client.exec(`RELEASE SAVEPOINT "${spName}";`)
        } else {
          try { client.exec('ROLLBACK;') } catch {}
        }
        throw err
      }
    },

    // Prisma's $queryRaw — supports BOTH tagged templates and function calls:
    //   await db.$queryRaw`SELECT ${1} as one`               // tagged template
    //   await db.$queryRaw('SELECT 1 as one')                  // function call
    //   await db.$queryRaw('SELECT * FROM t WHERE id = ?', 5) // parameterized
    $queryRaw(query: string | TemplateStringsArray, ...values: any[]): Promise<any[]> {
      if (Array.isArray(query) || query instanceof Object && query.raw) {
        // Tagged template: db.$queryRaw`SELECT ${1}` → query.raw = ['SELECT ', ' as one']
        const strings = (query as any).raw as string[]
        let sqlText = strings[0]
        for (let i = 1; i < strings.length; i++) {
          sqlText += '?' + strings[i]
        }
        const stmt = (instance as any).session?.client?.prepare?.(sqlText)
            ?? (instance as any).$client?.prepare?.(sqlText)
        if (stmt) {
          return Promise.resolve(stmt.all(...values) as any[])
        }
        // Fallback: use Drizzle's sql template
        return (instance as any).all(sql.raw(sqlText)) as Promise<any[]>
      }
      // Function call: db.$queryRaw('SELECT 1') or db.$queryRaw('SELECT ? AS one', 1)
      if (values.length > 0) {
        const stmt = (instance as any).session?.client?.prepare?.(query as string)
            ?? (instance as any).$client?.prepare?.(query as string)
        if (stmt) {
          return Promise.resolve(stmt.all(...values) as any[])
        }
      }
      return (instance as any).all(sql.raw(query as string)) as Promise<any[]>
    },

    // Prisma's $executeRaw — same dual-mode support.
    $executeRaw(query: string | TemplateStringsArray, ...values: any[]): Promise<number> {
      if (Array.isArray(query) || query instanceof Object && query.raw) {
        const strings = (query as any).raw as string[]
        let sqlText = strings[0]
        for (let i = 1; i < strings.length; i++) {
          sqlText += '?' + strings[i]
        }
        const stmt = (instance as any).session?.client?.prepare?.(sqlText)
            ?? (instance as any).$client?.prepare?.(sqlText)
        if (stmt) {
          stmt.run(...values)
          return Promise.resolve(stmt.changes ?? 0)
        }
        return (instance as any).run(sql.raw(sqlText)).then((r: any) => r.changes ?? 0)
      }
      const stmt = (instance as any).session?.client?.prepare?.(query as string)
          ?? (instance as any).$client?.prepare?.(query as string)
      if (stmt) {
        stmt.run(...values)
        return Promise.resolve(stmt.changes ?? 0)
      }
      return (instance as any).run(sql.raw(query as string)).then((r: any) => r.changes ?? 0)
    },

    // Prisma's $disconnect — close the underlying connection (no-op for bun:sqlite
    // since each query opens & closes its own connection, but we expose it for
    // scripts that call `await db.$disconnect()` in their finally block).
    async $disconnect(): Promise<void> {
      try {
        // bun:sqlite Database close — safe to call, no-op if already closed.
        const client = (instance as any).$client ?? (instance as any).session?.client
        if (client && typeof client.close === 'function') client.close()
      } catch {
        // ignore
      }
    },

    // Prisma's $connect — no-op (bun:sqlite is lazy).
    async $connect(): Promise<void> {},

    // Expose the underlying Drizzle instance for native queries.
    $drizzle: instance,
    $schema: schema,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The exported singleton — drop-in replacement for the old PrismaClient.
// ─────────────────────────────────────────────────────────────────────────────
export const db = buildFacade(drizzleDb) as any

export { schema }
