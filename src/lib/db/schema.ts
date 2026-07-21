// FinexFX AI Trading System — Drizzle ORM schema (replaces prisma/schema.prisma).
// Stack: Next.js 16 dashboard + (simulated) Python 3.14 / MT5 engine.
//
// Notes on the Prisma → Drizzle conversion:
//   - All `@default(now())` → `$defaultFn(() => new Date())`.
//   - All `@updatedAt` → `$onUpdate(() => new Date())`.
//   - All `@id @default(cuid())` → `text('id').primaryKey().$defaultFn(cuid)`.
//   - `Float` → `real` (SQLite REAL).
//   - `Boolean @default(false)` → `integer('...', { mode: 'boolean' }).default(false)`.
//   - `Int?` → `integer('...')` (nullable).
//   - Prisma relations are NOT declared here — Drizzle relations live below for
//     `with`/relational queries, but cascade deletes are enforced via explicit
//     DELETE in db-transactions.ts (same behavior as before).
//   - Indexes use `index().on(...)` matching the original `@@index([...])`.

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ─────────────────────────────────────────────────────────────────────────────
// Inline cuid generator (kept local to schema so drizzle-kit can resolve it
// without traversing path aliases). Format matches Prisma's @default(cuid()):
// 24-char base36 id prefixed with 'c'.
// ─────────────────────────────────────────────────────────────────────────────
let __cuidCounter = 0
function cuid(): string {
  __cuidCounter = (__cuidCounter + 1) % 36
  const ts = Date.now().toString(36)
  const counterStr = __cuidCounter.toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return ('c' + ts + counterStr + random).slice(0, 24).padEnd(24, '0')
}

// ─────────────────────────────────────────────────────────────────────────────
// Accounts (MT5 demo / live)
// ─────────────────────────────────────────────────────────────────────────────
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    name: text('name').notNull(),
    broker: text('broker').default('FINEX Indonesia').notNull(),
    server: text('server').notNull(),
    login: text('login').notNull(),
    // P3: Multi-user ownership — null = shared/system account
    userId: text('user_id'),
    // Real trading only — demo mode removed. All accounts are live MT5 accounts.
    currency: text('currency').default('USD').notNull(),
    leverage: text('leverage').default('1:100').notNull(),
    balance: real('balance').default(10000).notNull(),
    equity: real('equity').default(10000).notNull(),
    margin: real('margin').default(0).notNull(),
    freeMargin: real('free_margin').default(10000).notNull(),
    marginLevel: real('margin_level').default(0).notNull(),
    connected: integer('connected', { mode: 'boolean' }).default(false).notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
  (t) => ({
    userIdIdx: index('accounts_user_id_idx').on(t.userId),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Trades / Positions
// ─────────────────────────────────────────────────────────────────────────────
export const trades = sqliteTable(
  'trades',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    accountId: text('account_id').notNull(),
    symbol: text('symbol').notNull(), // EURUSD | USDJPY | GBPUSD | XAUUSD
    side: text('side').notNull(), // buy | sell
    lotSize: real('lot_size').notNull(),
    openPrice: real('open_price').notNull(),
    closePrice: real('close_price'),
    stopLoss: real('stop_loss'),
    takeProfit: real('take_profit'),
    trailingStop: integer('trailing_stop', { mode: 'boolean' }).default(false).notNull(),
    trailingPips: real('trailing_pips').default(0).notNull(),
    status: text('status').default('open').notNull(), // open | closed
    pnl: real('pnl').default(0).notNull(),
    pips: real('pips').default(0).notNull(),
    commission: real('commission').default(0).notNull(),
    swap: real('swap').default(0).notNull(),
    strategy: text('strategy').default('scalping-m5').notNull(),
    timeframe: text('timeframe').default('M5').notNull(),
    source: text('source').default('manual').notNull(), // manual | auto | ai
    comment: text('comment'),
    // MT5 bridge integration: ticket returned by the bridge (null = local-only trade).
    mt5Ticket: integer('mt5_ticket'),
    mt5Server: text('mt5_server'),
    // P4: Execution quality tracking
    slippagePips: real('slippage_pips'), // difference between requested and executed price
    executionLatencyMs: integer('execution_latency_ms'), // time from order to confirmation
    openTime: integer('open_time', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    closeTime: integer('close_time', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
  (t) => ({
    accountIdIdx: index('trades_account_id_idx').on(t.accountId),
    symbolIdx: index('trades_symbol_idx').on(t.symbol),
    statusIdx: index('trades_status_idx').on(t.status),
    mt5TicketIdx: index('trades_mt5_ticket_idx').on(t.mt5Ticket),
    // P4: Composite index for common query: WHERE accountId=? AND status='open' ORDER BY openTime
    accountStatusOpenTimeIdx: index('trades_account_status_opentime_idx').on(t.accountId, t.status, t.openTime),
    // P4: Composite index for dashboard: WHERE status='closed' AND closeTime BETWEEN ? AND ?
    statusCloseTimeIdx: index('trades_status_closetime_idx').on(t.status, t.closeTime),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Pending Orders
// ─────────────────────────────────────────────────────────────────────────────
export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    accountId: text('account_id').notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull(), // buy | sell
    orderType: text('order_type').notNull(), // limit | stop
    lotSize: real('lot_size').notNull(),
    price: real('price').notNull(),
    stopLoss: real('stop_loss'),
    takeProfit: real('take_profit'),
    status: text('status').default('pending').notNull(), // pending | triggered | cancelled
    openTime: integer('open_time', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
  (t) => ({
    accountIdIdx: index('orders_account_id_idx').on(t.accountId),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Indicator Pool (scalping preset)
// ─────────────────────────────────────────────────────────────────────────────
export const indicators = sqliteTable(
  'indicators',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    name: text('name').notNull().unique(),
    category: text('category').notNull(), // trend | oscillator | volume | volatility | channel | regression
    description: text('description').notNull(),
    defaultParams: text('default_params').notNull(), // JSON string
    scalpingPreset: text('scalping_preset'), // JSON string
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    autoManaged: integer('auto_managed', { mode: 'boolean' }).default(false).notNull(),
    weight: real('weight').default(1).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// News Items (Finnhub / MARKETAUX)
// ─────────────────────────────────────────────────────────────────────────────
export const newsItems = sqliteTable(
  'news_items',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    source: text('source').notNull(), // finnhub | marketaux | breaking
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    url: text('url'),
    category: text('category').notNull(),
    impact: text('impact').default('medium').notNull(), // low | medium | high
    sentiment: text('sentiment').default('neutral').notNull(), // bullish | bearish | neutral
    symbols: text('symbols').default('').notNull(), // comma separated
    publishedAt: integer('published_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    categoryIdx: index('news_items_category_idx').on(t.category),
    impactIdx: index('news_items_impact_idx').on(t.impact),
    publishedAtIdx: index('news_items_published_at_idx').on(t.publishedAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Price Alerts
// ─────────────────────────────────────────────────────────────────────────────
export const alerts = sqliteTable(
  'alerts',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    symbol: text('symbol').notNull(),
    condition: text('condition').notNull(), // above | below | cross_up | cross_down
    price: real('price').notNull(),
    active: integer('active', { mode: 'boolean' }).default(true).notNull(),
    triggered: integer('triggered', { mode: 'boolean' }).default(false).notNull(),
    triggeredAt: integer('triggered_at', { mode: 'timestamp' }),
    notifyEmail: integer('notify_email', { mode: 'boolean' }).default(true).notNull(),
    message: text('message'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
  (t) => ({
    symbolIdx: index('alerts_symbol_idx').on(t.symbol),
    activeIdx: index('alerts_active_idx').on(t.active),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// System Logs / Error Logs
// ─────────────────────────────────────────────────────────────────────────────
export const logs = sqliteTable(
  'logs',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    level: text('level').notNull(), // info | warn | error | debug
    source: text('source').default('system').notNull(), // mt5 | ai | risk | api | ws | backtest
    message: text('message').notNull(),
    stack: text('stack'),
    context: text('context'), // JSON
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    levelIdx: index('logs_level_idx').on(t.level),
    sourceIdx: index('logs_source_idx').on(t.source),
    createdAtIdx: index('logs_created_at_idx').on(t.createdAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Backtest Results
// ─────────────────────────────────────────────────────────────────────────────
export const backtests = sqliteTable(
  'backtests',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),
    timeframe: text('timeframe').default('M5').notNull(),
    strategy: text('strategy').notNull(),
    periodFrom: integer('period_from', { mode: 'timestamp' }).notNull(),
    periodTo: integer('period_to', { mode: 'timestamp' }).notNull(),
    initialCapital: real('initial_capital').notNull(),
    finalCapital: real('final_capital').notNull(),
    totalTrades: integer('total_trades').notNull(),
    winTrades: integer('win_trades').notNull(),
    lossTrades: integer('loss_trades').notNull(),
    winRate: real('win_rate').notNull(),
    profitFactor: real('profit_factor').notNull(),
    maxDrawdown: real('max_drawdown').notNull(),
    sharpeRatio: real('sharpe_ratio').notNull(),
    netProfit: real('net_profit').notNull(),
    equityCurve: text('equity_curve').notNull(), // JSON array
    tradesJson: text('trades_json').notNull(), // JSON array of trade points
    status: text('status').default('completed').notNull(), // running | completed | failed
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    symbolIdx: index('backtests_symbol_idx').on(t.symbol),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// AI Signals (ML self-learning log)
// ─────────────────────────────────────────────────────────────────────────────
export const aiSignals = sqliteTable(
  'ai_signals',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    symbol: text('symbol').notNull(),
    direction: text('direction').notNull(), // long | short | neutral
    confidence: real('confidence').notNull(), // 0..100
    timeframe: text('timeframe').default('M5').notNull(),
    reasoning: text('reasoning').notNull(),
    selectedIndicators: text('selected_indicators').notNull(), // JSON array
    factors: text('factors').notNull(), // JSON object
    action: text('action').default('wait').notNull(), // buy | sell | wait
    modelVersion: text('model_version').default('fx-scalper-v1').notNull(),
    accuracy: real('accuracy').default(0).notNull(),
    priceAtSignal: real('price_at_signal'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    symbolIdx: index('ai_signals_symbol_idx').on(t.symbol),
    createdAtIdx: index('ai_signals_created_at_idx').on(t.createdAt),
    actionIdx: index('ai_signals_action_idx').on(t.action),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// AI Signal Outcomes (real accuracy tracking)
// ─────────────────────────────────────────────────────────────────────────────
export const aiSignalOutcomes = sqliteTable(
  'ai_signal_outcomes',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    signalId: text('signal_id').notNull().unique(),
    symbol: text('symbol').notNull(),
    direction: text('direction').notNull(), // long | short | neutral
    action: text('action').notNull(), // buy | sell | wait
    confidence: real('confidence').notNull(),
    priceAtSignal: real('price_at_signal').notNull(),
    priceAtEval: real('price_at_eval').notNull(),
    priceChange: real('price_change').notNull(),
    priceChangePct: real('price_change_pct').notNull(),
    pipsMoved: real('pips_moved').notNull(),
    correct: integer('correct', { mode: 'boolean' }), // null = not yet evaluated
    evaluatedAt: integer('evaluated_at', { mode: 'timestamp' }),
  },
  (t) => ({
    signalIdIdx: uniqueIndex('ai_signal_outcomes_signal_id_idx').on(t.signalId),
    symbolIdx: index('ai_signal_outcomes_symbol_idx').on(t.symbol),
    correctIdx: index('ai_signal_outcomes_correct_idx').on(t.correct),
    evaluatedAtIdx: index('ai_signal_outcomes_evaluated_at_idx').on(t.evaluatedAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Risk Settings (key-value global)
// ─────────────────────────────────────────────────────────────────────────────
export const riskSettings = sqliteTable(
  'risk_settings',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Email Notifications
// ─────────────────────────────────────────────────────────────────────────────
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    type: text('type').notNull(), // trade_open | trade_close | alert | risk | system | news
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    recipient: text('recipient').notNull(),
    sent: integer('sent', { mode: 'boolean' }).default(false).notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    typeIdx: index('notifications_type_idx').on(t.type),
    createdAtIdx: index('notifications_created_at_idx').on(t.createdAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// System Config (broker, API keys, email)
// ─────────────────────────────────────────────────────────────────────────────
export const systemConfigs = sqliteTable(
  'system_configs',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    key: text('key').notNull().unique(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Users (authentication & authorization)
// r10-auth: NextAuth credentials provider. Passwords are bcrypt-hashed.
// Roles: admin (full access), trader (can open/close trades), viewer (read-only).
// ─────────────────────────────────────────────────────────────────────────────
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').default('trader').notNull(), // admin | trader | viewer
    active: integer('active', { mode: 'boolean' }).default(true).notNull(),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    roleIdx: index('users_role_idx').on(t.role),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// User Sessions (audit log; NextAuth uses JWT by default)
// ─────────────────────────────────────────────────────────────────────────────
export const userSessions = sqliteTable(
  'user_sessions',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    userId: text('user_id').notNull(),
    sessionToken: text('session_token').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    userIdIdx: index('user_sessions_user_id_idx').on(t.userId),
    expiresAtIdx: index('user_sessions_expires_at_idx').on(t.expiresAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Economic Calendar Events
// ─────────────────────────────────────────────────────────────────────────────
export const economicEvents = sqliteTable(
  'economic_events',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    title: text('title').notNull(),
    country: text('country').notNull(), // US | EU | GB | JP
    currency: text('currency').notNull(), // USD | EUR | GBP | JPY
    category: text('category').notNull(),
    impact: text('impact').notNull(), // low | medium | high
    eventTime: integer('event_time', { mode: 'timestamp' }).notNull(),
    actual: text('actual'),
    forecast: text('forecast'),
    previous: text('previous'),
    surprise: text('surprise'),
    symbols: text('symbols').default('').notNull(),
    status: text('status').default('upcoming').notNull(), // upcoming | released | cancelled
    source: text('source').default('marketaux').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).$onUpdate(() => new Date()).notNull(),
  },
  (t) => ({
    eventTimeIdx: index('economic_events_event_time_idx').on(t.eventTime),
    impactIdx: index('economic_events_impact_idx').on(t.impact),
    categoryIdx: index('economic_events_category_idx').on(t.category),
    countryIdx: index('economic_events_country_idx').on(t.country),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Audit Logs (P5: Monitoring — tracks who did what, when, from where)
// ─────────────────────────────────────────────────────────────────────────────
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    userId: text('user_id'), // null for service/background actions
    userEmail: text('user_email'),
    action: text('action').notNull(), // trade.open, trade.close, risk.update, account.create, etc.
    entityType: text('entity_type'), // trade, account, risk_setting, etc.
    entityId: text('entity_id'),
    metadata: text('metadata'), // JSON string with additional context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    userIdx: index('audit_logs_user_id_idx').on(t.userId),
    actionIdx: index('audit_logs_action_idx').on(t.action),
    entityIdx: index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Performance Metrics (P5: Monitoring — tracks bridge latency, error rates)
// ─────────────────────────────────────────────────────────────────────────────
export const metrics = sqliteTable(
  'metrics',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    name: text('name').notNull(), // bridge.latency, bridge.error, api.response_time
    value: real('value').notNull(),
    tags: text('tags'), // JSON string with key-value pairs
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  },
  (t) => ({
    nameIdx: index('metrics_name_idx').on(t.name),
    createdAtIdx: index('metrics_created_at_idx').on(t.createdAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────────────
// Export type aliases for convenience
// ─────────────────────────────────────────────────────────────────────────────
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Trade = typeof trades.$inferSelect
export type NewTrade = typeof trades.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Indicator = typeof indicators.$inferSelect
export type NewsItem = typeof newsItems.$inferSelect
export type Alert = typeof alerts.$inferSelect
export type Log = typeof logs.$inferSelect
export type Backtest = typeof backtests.$inferSelect
export type AiSignal = typeof aiSignals.$inferSelect
export type AiSignalOutcome = typeof aiSignalOutcomes.$inferSelect
export type RiskSetting = typeof riskSettings.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type SystemConfig = typeof systemConfigs.$inferSelect
export type User = typeof users.$inferSelect
export type UserSession = typeof userSessions.$inferSelect
export type EconomicEvent = typeof economicEvents.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type Metric = typeof metrics.$inferSelect
