# Contributing Guide

> FINEX Indonesia Trading Dashboard

---

## 1. Getting Started

### Prerequisites

- **Bun** 1.x (package manager and runtime)
- **Git** for version control

### Setup

```bash
git clone https://github.com/teekar2312/finexfx.git
cd finexfx
bun install
bun run db:push
curl -X POST http://localhost:3000/api/seed
bun run dev
```

The app runs at `http://localhost:3000`.

---

## 2. Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main SPA entry (only user-visible route)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Theme & animations
│   └── api/                  # REST API routes
├── components/
│   ├── trading/              # 40 feature components
│   └── ui/                   # 48 shadcn/ui base components
├── hooks/                    # Custom React hooks
├── store/                    # Zustand state management
└── lib/                      # Types, utilities, DB client
```

### Key Rules

1. **Single route** — All UI is in `src/app/page.tsx`. Do not create new routes.
2. **Client components** — All trading components must have `'use client'` directive.
3. **Zustand selectors** — Use selector pattern to avoid full-store re-renders:
   ```typescript
   // Bad — re-renders on ANY state change
   const store = useTradingStore();
   const balance = store.balance;

   // Good — only re-renders when balance changes
   const balance = useTradingStore((s) => s.balance);
   ```
4. **shadcn/ui** — Use existing UI components from `src/components/ui/`. Do not build custom button/card/dialog/etc.
5. **Tailwind CSS 4** — Use utility classes. No separate CSS files except `globals.css`.
6. **No `console.log`** — Remove before committing.
7. **No `TODO`/`FIXME`** — Track in issues instead.

---

## 3. Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation changes |

### Before Committing

```bash
# Run lint
bun run lint

# Verify dev server starts
bun run dev
# Wait for "Ready in Xs" message, then Ctrl+C
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(trading): add trailing stop to QuickTradePanel
fix(api): validate symbol in trades endpoint
docs: update API.md with new endpoints
refactor(store): migrate WatchlistPanel to selector pattern
style(dashboard): improve heatmap cell hover animation
chore(deps): update framer-motion to 12.24
```

---

## 4. Component Development

### Adding a New Component

1. Create file in `src/components/trading/YourComponent.tsx`
2. Add `'use client'` directive at the top
3. Use shadcn/ui components from `@/components/ui/`
4. Use Zustand selectors for store access
5. Import in `page.tsx` if it's a new tab, or in the parent view component
6. Run `bun run lint` to check for errors

### Adding a New Tab View

1. Create `src/components/trading/YourView.tsx`
2. Add to the `TabId` type in `src/store/trading-store.ts`
3. Add dynamic import in `src/app/page.tsx`:
   ```typescript
   const YourView = dynamic(() => import('@/components/trading/YourView'), {
     loading: () => <ViewSkeleton />,
     ssr: false,
   });
   ```
4. Add case to `renderView()` switch in `page.tsx`
5. Add tab entry in `src/components/trading/Sidebar.tsx`

### Adding a New API Route

1. Create `src/app/api/your-route/route.ts`
2. Import `NextRequest` and `NextResponse` from `next/server`
3. Import `db` from `@/lib/db` for database access
4. Export named functions (`GET`, `POST`, etc.)
5. Return `NextResponse.json()` with proper status codes
6. Handle errors with try/catch and return `{ error: string }`
7. Update `API.md` documentation

---

## 5. Database Changes

### Schema Modifications

1. Edit `prisma/schema.prisma`
2. Push to database: `bun run db:push`
3. Update types in `src/lib/types.ts` if needed
4. Update `API.md` if API response shapes changed

### Adding a Seed Record

1. Add sample data to `src/app/api/seed/route.ts`
2. Update the response counts in `SeedResponse` interface
3. Re-seed: `curl -X POST http://localhost:3000/api/seed`

---

## 6. Code Style

| Rule | Standard |
|------|----------|
| TypeScript | Strict mode, ES2017+ target |
| Imports | `@/` path aliases (not relative `../`)
| Components | PascalCase files and exports |
| Hooks | camelCase with `use-` prefix for files |
| Enums | Prefer union types over TypeScript enums |
| Styling | Tailwind utility classes only |
| CSS classes | Use existing glass-card, metric-compact, etc. from globals.css |
| Animations | Prefer Framer Motion over raw CSS animations |
| Icons | Lucide React only |
| State | Zustand selectors, not full store access |

---

## 7. Testing & QA

### Manual Testing Checklist

- [ ] All 11 tabs render without errors
- [ ] Price simulation updates on Dashboard watchlist
- [ ] Trade execution (BUY/SELL) works from QuickTradePanel
- [ ] Trade appears in Trade History after opening
- [ ] Closing a trade updates account balance
- [ ] Notification toasts appear for trade events
- [ ] Keyboard shortcuts work (B, S, 1-0, ?)
- [ ] Mobile responsive: sidebar collapses to Sheet
- [ ] Footer sticks to bottom on short pages
- [ ] No console errors in browser DevTools

### Lint

```bash
bun run lint
```

Zero errors must pass before committing.

---

## 8. Known Technical Debt

| Item | Priority | Description |
|------|----------|-------------|
| Store selectors | High | 32/40 components use `useTradingStore()` without selectors |
| `transition: all` | Medium | 21 CSS rules use broad `transition: all` instead of specific properties |
| Error boundaries | High | No per-tab React Error Boundaries |
| Accessibility | Medium | No `aria-live` regions for real-time updates |
| Loading skeletons | Low | Only page-level skeleton; no inner-view skeletons |
| TypeScript strictness | Medium | `ignoreBuildErrors: true` and `noImplicitAny: false` in tsconfig |

---

## 9. Questions?

Open an issue on [GitHub](https://github.com/teekar2312/finexfx/issues) for questions, bug reports, or feature requests.
