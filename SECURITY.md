# Security Considerations

> FINEX Indonesia Trading Dashboard — Security Documentation

---

## 1. Current Security Posture

This is a **demo/trading simulator** application. It is not connected to real brokers or real money. However, following security best practices ensures the application is production-ready when real integrations are added.

### Authentication

- **NextAuth.js v4** is installed as a dependency but **not yet configured**.
- All API routes are currently **unauthenticated** — any request is accepted.
- No JWT validation, session checking, or API key verification is in place.

### Authorization

- No role-based access control (RBAC) is implemented.
- All users share the same database and can see/modify all data.
- No per-user data isolation exists.

### Input Validation

- API routes validate required fields (symbol, direction, etc.) but use **manual string checks**, not schema validation (Zod is installed but not used in API routes).
- Numeric ranges are validated in some endpoints (e.g., `riskPerTrade: 0.1–10`, `stopLossPips: 1–100`).
- SQL injection is **mitigated** by Prisma ORM (parameterized queries).

---

## 2. Known Vulnerabilities & Risks

| Risk | Severity | Status | Description |
|------|----------|--------|-------------|
| No authentication | High | Open | All API routes publicly accessible |
| No rate limiting | High | Open | API can be flooded with requests |
| No CSRF protection | Medium | Open | No CSRF tokens on mutations |
| No input sanitization (XSS) | Medium | Partial | React escapes JSX, but `dangerouslySetInnerHTML` should be audited |
| SQL injection | Low | Mitigated | Prisma ORM prevents raw SQL injection |
| Seed endpoint exposure | High | Open | `POST /api/seed` can wipe and re-seed production data |
| Database file access | Medium | OS-level | SQLite file at `db/custom.db` — protect with file permissions |
| No Content-Security-Policy | Medium | Open | No CSP headers configured |
| No CORS configuration | Low | Open | Default Next.js CORS (same-origin) |
| Client-side only price data | Info | By design | Prices are simulated — no real market data exposure |
| `ignoreBuildErrors: true` | Low | Config | TypeScript errors suppressed in `next.config.ts` |

---

## 3. Recommendations

### Priority: Critical

1. **Disable seed endpoint in production**
   ```typescript
   // src/app/api/seed/route.ts
   if (process.env.NODE_ENV === 'production') {
     return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
   }
   ```

2. **Add authentication to all API routes**
   ```typescript
   import { getServerSession } from 'next-auth';
   export async function GET() {
     const session = await getServerSession();
     if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     // ...
   }
   ```

3. **Add rate limiting**
   - Use middleware-based rate limiting (e.g., `@upstash/ratelimit` or custom)
   - Suggested limits: 100 req/min for read, 20 req/min for write

### Priority: High

4. **Add Zod validation to all API routes**
   ```typescript
   import { z } from 'zod';
   const tradeSchema = z.object({
     symbol: z.enum(['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD']),
     direction: z.enum(['BUY', 'SELL']),
     lotSize: z.number().min(0.01).max(50).optional(),
     entryPrice: z.number().positive(),
   });
   ```

5. **Set Content-Security-Policy headers**
   - Add via `next.config.ts` or middleware
   - Restrict script sources, style sources, and connect sources

6. **Restrict database file permissions**
   ```bash
   chmod 600 db/custom.db
   chown www-data:www-data db/custom.db
   ```

### Priority: Medium

7. **Add CSRF protection** for mutation endpoints (POST/PUT/DELETE)

8. **Audit for `dangerouslySetInnerHTML`** usage across all 40 components

9. **Enable `reactStrictMode: true`** in `next.config.ts` (currently disabled)

10. **Remove `ignoreBuildErrors: true`** and fix all TypeScript errors

11. **Add request logging** for audit trail (especially trade mutations)

12. **Implement session-based data isolation** when multi-user support is added

---

## 4. Security Headers

Recommended headers to add via `next.config.ts` or middleware:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
      ],
    }];
  },
};
```

---

## 5. Sensitive Data

| Data | Storage | Encryption | Notes |
|------|---------|------------|-------|
| Trade history | SQLite | None | File-level encryption recommended |
| Account balance | SQLite | None | |
| Risk settings | SQLite | None | |
| News cache | In-memory / DB | None | Public data |
| API keys | None | N/A | No external API keys currently stored |
| User credentials | None | N/A | Auth not configured yet |

---

## 6. Dependency Security

Run regular dependency audits:

```bash
# Check for known vulnerabilities
bun audit

# Update dependencies
bun update

# Check outdated packages
bun outdated
```

---

## 7. Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by contacting the repository owner directly. Do not open public issues for security vulnerabilities.