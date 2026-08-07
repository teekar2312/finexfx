# Deployment Guide

> FINEX Indonesia Trading Dashboard — v0.2.1

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Dependencies](#2-dependencies)
3. [VS Code on Windows 11 Setup](#3-vs-code-on-windows-11-setup)
4. [Local Development](#4-local-development)
5. [Production Build](#5-production-build)
6. [Docker Deployment](#6-docker-deployment)
7. [Reverse Proxy (Caddy)](#7-reverse-proxy-caddy)
8. [Process Management](#8-process-management)
9. [Database Migrations](#9-database-migrations)
10. [Environment Variables](#10-environment-variables)
11. [Health Check](#11-health-check)
12. [Post-Deploy Checklist](#12-post-deploy-checklist)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Bun | 1.x | Runtime, package manager, script runner |
| Node.js | 18+ (optional) | Fallback runtime if Bun is unavailable |
| Git | 2.x | Cloning the repository |
| VS Code | Latest | Recommended IDE (see Section 3) |

### Install Bun on Windows 11

Bun does not ship a native Windows installer. Use one of these methods:

**Option A — PowerShell (recommended):**

```powershell
irm bun.sh/install.ps1 | iex
```

**Option B — Via npm (if Node.js is installed):**

```powershell
npm install -g bun
```

**Option C — WSL2 (Windows Subsystem for Linux):**

```bash
# Inside WSL2 Ubuntu/Debian
curl -fsSL https://bun.sh/install | bash
```

> If you use WSL2, open the project folder from within WSL (`\\wsl$\Ubuntu\home\...`) so that the terminal, file watcher, and Git all use the Linux layer consistently.

---

## 2. Dependencies

### 2.1 Runtime & Framework

| Package | Version | Role |
|---------|---------|------|
| `next` | 16.1.1 | React framework (App Router, standalone output) |
| `react` | 19.0.0 | UI rendering library |
| `react-dom` | 19.0.0 | React DOM renderer |
| `typescript` | 5.x | Static type checking (dev) |

### 2.2 Styling

| Package | Version | Role |
|---------|---------|------|
| `tailwindcss` | 4.x | Utility-first CSS engine |
| `@tailwindcss/postcss` | 4.x | PostCSS integration for Tailwind v4 |
| `tw-animate-css` | 1.3.5 | Animation utilities for Tailwind |
| `tailwindcss-animate` | 1.0.7 | Animation variants (shadcn/ui dependency) |
| `class-variance-authority` | 0.7.1 | Component variant styling (shadcn/ui dependency) |
| `clsx` | 2.1.1 | Conditional className merging |
| `tailwind-merge` | 3.3.1 | Intelligent Tailwind class deduplication |

### 2.3 UI Components (shadcn/ui + Radix Primitives)

The project uses **48 shadcn/ui components** built on 26 Radix UI primitives. These provide accessible, unstyled headless components:

| Radix Package | Version | Used By |
|---------------|---------|---------|
| `@radix-ui/react-accordion` | 1.2.11 | Accordion component |
| `@radix-ui/react-alert-dialog` | 1.1.14 | Confirmation dialogs |
| `@radix-ui/react-aspect-ratio` | 1.1.7 | Aspect ratio containers |
| `@radix-ui/react-avatar` | 1.1.10 | User avatars |
| `@radix-ui/react-checkbox` | 1.3.2 | Checkboxes |
| `@radix-ui/react-collapsible` | 1.1.11 | Collapsible sections |
| `@radix-ui/react-context-menu` | 2.2.15 | Right-click menus |
| `@radix-ui/react-dialog` | 1.1.14 | Modal dialogs |
| `@radix-ui/react-dropdown-menu` | 2.1.15 | Dropdown menus |
| `@radix-ui/react-hover-card` | 1.1.14 | Hover information cards |
| `@radix-ui/react-label` | 1.1.7 | Form labels |
| `@radix-ui/react-menubar` | 1.1.15 | Menu bars |
| `@radix-ui/react-navigation-menu` | 1.2.13 | Navigation menus |
| `@radix-ui/react-popover` | 1.1.14 | Popover overlays |
| `@radix-ui/react-progress` | 1.1.7 | Progress bars |
| `@radix-ui/react-radio-group` | 1.3.7 | Radio button groups |
| `@radix-ui/react-scroll-area` | 1.2.9 | Custom scroll areas |
| `@radix-ui/react-select` | 2.2.5 | Select dropdowns |
| `@radix-ui/react-separator` | 1.1.7 | Visual separators |
| `@radix-ui/react-slider` | 1.3.5 | Range sliders |
| `@radix-ui/react-slot` | 1.2.3 | Component composition slot |
| `@radix-ui/react-switch` | 1.2.5 | Toggle switches |
| `@radix-ui/react-tabs` | 1.1.12 | Tab navigation |
| `@radix-ui/react-toast` | 1.2.14 | Toast notifications (base) |
| `@radix-ui/react-toggle` | 1.1.9 | Toggle buttons |
| `@radix-ui/react-toggle-group` | 1.1.10 | Toggle button groups |
| `@radix-ui/react-tooltip` | 1.2.7 | Tooltip overlays |

### 2.4 Data Visualization & Animation

| Package | Version | Role |
|---------|---------|------|
| `recharts` | 2.15.4 | Charts: candlestick, line, area, bar, heatmap, pie |
| `framer-motion` | 12.23.2 | Page transitions, hover effects, layout animations |
| `lucide-react` | 0.525.0 | Icon library (600+ icons) |

### 2.5 State & Data

| Package | Version | Role |
|---------|---------|------|
| `zustand` | 5.0.6 | Client-side state management (Zustand store) |
| `@tanstack/react-query` | 5.82.0 | Server state management, caching, refetching |
| `@tanstack/react-table` | 8.21.3 | Headless data tables (sorting, filtering, pagination) |
| `prisma` | 6.11.1 | ORM — schema definition, migrations, DB client generation |
| `@prisma/client` | 6.11.1 | Auto-generated Prisma database client |

### 2.6 Forms & Validation

| Package | Version | Role |
|---------|---------|------|
| `zod` | 4.0.2 | Schema validation (installed, not yet used in API routes) |
| `react-hook-form` | 7.60.0 | Form state management |
| `@hookform/resolvers` | 5.1.1 | Zod resolver bridge for react-hook-form |

### 2.7 Utilities

| Package | Version | Role |
|---------|---------|------|
| `date-fns` | 4.1.0 | Date formatting, parsing, and arithmetic |
| `uuid` | 11.1.0 | Unique ID generation (cuid used via Prisma) |
| `sonner` | 2.0.6 | Toast notification library (alternative to Radix toast) |
| `socket.io-client` | 4.8.3 | WebSocket client for real-time features |
| `sharp` | 0.34.3 | Image processing (Next.js Image optimization) |

### 2.8 Drag & Drop

| Package | Version | Role |
|---------|---------|------|
| `@dnd-kit/core` | 6.3.1 | DnD core engine |
| `@dnd-kit/sortable` | 10.0.0 | Sortable list/items |
| `@dnd-kit/utilities` | 3.2.2 | CSS utility helpers for DnD |

### 2.9 Content & Editing

| Package | Version | Role |
|---------|---------|------|
| `@mdxeditor/editor` | 3.39.1 | Rich text / MDX editor |
| `react-markdown` | 10.1.0 | Markdown rendering |
| `react-syntax-highlighter` | 15.6.1 | Code syntax highlighting |

### 2.10 Layout & Interaction

| Package | Version | Role |
|---------|---------|------|
| `react-resizable-panels` | 3.0.3 | Resizable panel layouts |
| `embla-carousel-react` | 8.6.0 | Carousel/slider component |
| `vaul` | 1.1.2 | Drawer component (mobile sheets) |
| `input-otp` | 1.4.2 | One-time password input |
| `cmdk` | 1.1.1 | Command palette (Cmd+K style) |
| `react-day-picker` | 9.8.0 | Calendar date picker |

### 2.11 Theming & Internationalization

| Package | Version | Role |
|---------|---------|------|
| `next-themes` | 0.4.6 | Dark/light theme toggle |
| `next-intl` | 4.3.4 | Internationalization framework (installed, not yet configured) |

### 2.12 Auth & AI

| Package | Version | Role |
|---------|---------|------|
| `next-auth` | 4.24.11 | Authentication (installed, not yet configured) |
| `z-ai-web-dev-sdk` | 0.0.18 | AI capabilities (VLM, TTS, LLM, image generation, web search) |
| `@reactuses/core` | 6.0.5 | Collection of React utility hooks |

### 2.13 Dev Dependencies

| Package | Version | Role |
|---------|---------|------|
| `@tailwindcss/postcss` | 4.x | Tailwind v4 PostCSS plugin |
| `@types/react` | 19.x | React TypeScript type definitions |
| `@types/react-dom` | 19.x | React DOM type definitions |
| `bun-types` | 1.3.4 | Bun runtime type definitions |
| `eslint` | 9.x | Linter |
| `eslint-config-next` | 16.1.1 | Next.js ESLint configuration |

---

## 3. VS Code on Windows 11 Setup

### 3.1 Install Visual Studio Code

1. Download VS Code from [https://code.visualstudio.com](https://code.visualstudio.com)
2. Run the installer — check **"Add to PATH"** during setup
3. Launch VS Code

### 3.2 Recommended Extensions

Open the Extensions panel (`Ctrl+Shift+X`) and install these:

| Extension | ID | Purpose |
|-----------|-----|---------|
| **TypeScript** | `ms-vscode.vscode-typescript-next` | Built-in TS support (enabled automatically for `.ts`/`.tsx` files) |
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Autocomplete for Tailwind classes, CSS variables |
| **Prisma** | `prisma.prisma` | Syntax highlighting, formatting, and IntelliSense for `schema.prisma` |
| **ESLint** | `dbaeumer.vscode-eslint` | Inline lint errors/warnings |
| **Prettier** | `esbenp.prettier-vscode` | Code formatting (optional, project uses ESLint) |
| **GitLens** | `eamodio.gitlens` | Git blame, history, and diff |
| **Error Lens** | `usernamehw.errorlens` | Shows error/warning messages inline on the code line |
| **Pretty TypeScript Errors** | `yoavbls.pretty-ts-errors` | Transforms complex TS errors into readable format |
| **Auto Rename Tag** | `formulahendry.auto-rename-tag` | Auto-renames paired HTML/JSX tags |
| **Path Intellisense** | `christian-kohler.path-intellisense` | Autocomplete for `@/` path aliases |
| **ES7+ React Snippets** | `dsznajder.es7-react-js-snippets` | React/Next.js code snippets (`rfc`, `useSt`, etc.) |
| **Material Icon Theme** | `pkief.material-icon-theme` | File icon theme (recommended for project navigation) |
| **Console Ninja** | `wallabyjs.console-ninja` | Shows `console.log` output inline (useful during debugging) |

> Quick install from terminal:
> ```powershell
> code --install-extension bradlc.vscode-tailwindcss
> code --install-extension prisma.prisma
> code --install-extension dbaeumer.vscode-eslint
> code --install-extension eamodio.gitlens
> code --install-extension usernamehw.errorlens
> code --install-extension yoavbls.pretty-ts-errors
> code --install-extension formulahendry.auto-rename-tag
> code --install-extension christian-kohler.path-intellisense
> code --install-extension dsznajder.es7-react-js-snippets
> code --install-extension pkief.material-icon-theme
> code --install-extension wallabyjs.console-ninja
> ```

### 3.3 Workspace Configuration

Create `.vscode/settings.json` in the project root:

```json
{
  "editor.formatOnSave": false,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "js/ts.tsdk.promptToUseWorkspaceVersion": true,
  "tailwindCSS.classAttributes": [
    "className",
    "class"
  ],
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "css.customData": ["./.vscode/tailwind.json"],
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/db": true,
    "**/*.db": true
  },
  "files.watcherExclude": {
    "**/.next/**": true,
    "**/node_modules/**": true
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true
}
```

### 3.4 Recommended Key Bindings

Open **Keyboard Shortcuts** (`Ctrl+K` then `Ctrl+S`) and add these for faster development:

| Action | Keybinding | Description |
|--------|-----------|-------------|
| Run lint | `Ctrl+Shift+L` | `eslint .` in terminal |
| Toggle terminal | `` Ctrl+` `` | Show/hide integrated terminal |
| Go to file | `Ctrl+P` | Quick file navigator |
| Find in files | `Ctrl+Shift+F` | Project-wide search |
| Format document | `Shift+Alt+F` | Prettier format |

### 3.5 Integrated Terminal Setup

1. Open the terminal panel: `` Ctrl+` ``
2. Click the dropdown arrow next to the `+` button and select **PowerShell** or **Git Bash**
3. Verify Bun is available:
   ```powershell
   bun --version
   ```
4. If using WSL2, select **WSL** as the default terminal profile:
   - Open Settings (`Ctrl+,`)
   - Search for "terminal.integrated.defaultProfile.windows"
   - Set to `WSL` or `Ubuntu`

### 3.6 Launch Configuration

Create `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "bun run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "bun run dev",
      "serverReadyAction": {
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

> **How to debug:**
> 1. Set breakpoints by clicking the gutter left of line numbers
> 2. Press `F5` or select a configuration from the Run & Debug panel (`Ctrl+Shift+D`)
> 3. The "debug server-side" config attaches to API routes and server code
> 4. The "debug client-side" config attaches to browser DevTools for React components
> 5. The "debug full stack" config launches both simultaneously

### 3.7 Useful VS Code Tasks

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Dev Server",
      "type": "shell",
      "command": "bun run dev",
      "problemMatcher": [],
      "isBackground": true,
      "presentation": {
        "reveal": "always",
        "panel": "dedicated"
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "Lint",
      "type": "shell",
      "command": "bun run lint",
      "problemMatcher": "$eslint-stylish"
    },
    {
      "label": "DB Push",
      "type": "shell",
      "command": "bun run db:push",
      "problemMatcher": []
    },
    {
      "label": "Seed Data",
      "type": "shell",
      "command": "curl -X POST http://localhost:3000/api/seed",
      "problemMatcher": []
    },
    {
      "label": "Build Production",
      "type": "shell",
      "command": "bun run build",
      "problemMatcher": []
    }
  ]
}
```

> Run tasks with `Ctrl+Shift+B` (default build task = Dev Server) or `Tasks: Run Task` from the command palette (`Ctrl+Shift+P`).

### 3.8 Windows-Specific Notes

| Topic | Details |
|-------|---------|
| **Long paths** | Windows has a 260-character path limit. If you encounter "ENAMETOOLONG" errors during `bun install`, enable long paths: `git config --system core.longpaths true` or via Group Policy (`Enable Win32 long paths`). |
| **Line endings** | Git on Windows may convert LF to CRLF. The project uses LF. Set `git config core.autocrlf input` or add `* text=auto eol=lf` to `.gitattributes`. |
| **File watcher limits** | VS Code may hit the Windows file watcher limit with large `node_modules`. The `files.watcherExclude` in `.vscode/settings.json` (Section 3.3) mitigates this. |
| **PowerShell execution policy** | If scripts are blocked, run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| **Antivirus** | Windows Defender may slow initial `bun install` or `bun run build`. Add the project folder to exclusions if needed. |
| **WSSL2 recommended** | For the best experience, develop inside WSL2. It provides a Linux environment with native Bun performance, proper file watching, and consistent behavior with the CI/production environment. |

---

## 4. Local Development

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

## 5. Production Build

### Build

```bash
bun run build
```

This produces a standalone output in `.next/standalone/` with:
- Static assets copied into `.next/standalone/.next/static/`
- Public assets copied into `.next/standalone/public/`
- `server.js` entry point (Node.js compatible)

### Build Config (next.config.ts)

```typescript
const nextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
};
```

### TypeScript Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "noImplicitAny": false,
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Start Production Server

```bash
NODE_ENV=production bun .next/standalone/server.js
```

The server listens on port `3000` by default. Override with:

```bash
PORT=8080 bun .next/standalone/server.js
```

---

## 6. Docker Deployment

### Dockerfile

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

## 7. Reverse Proxy (Caddy)

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

## 8. Process Management

### Systemd Service (Linux)

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

### Windows Service (NSSM)

On Windows, use [NSSM (Non-Sucking Service Manager)](https://nssm.cc/) to run the app as a Windows service:

```powershell
# Download NSSM from https://nssm.cc/download
nssm install FINEX "C:\Users\<you>\.bun\bin\bun.exe" "C:\path\to\finex\.next\standalone\server.js"
nssm set FINEX AppDirectory "C:\path\to\finex"
nssm set FINEX AppEnvironmentExtra DATABASE_URL=file:C:\path\to\finex\db\custom.db
nssm set FINEX AppEnvironmentExtra NODE_ENV=production
nssm set FINEX DisplayName "FINEX Indonesia Trading Dashboard"
nssm set FINEX Start SERVICE_AUTO_START
nssm start FINEX
```

---

## 9. Database Migrations

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
# Linux / macOS
cp db/custom.db db/custom.db.backup-$(date +%Y%m%d-%H%M%S)

# Windows PowerShell
Copy-Item db\custom.db "db\custom.db.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

---

## 10. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./db/custom.db` | SQLite connection string |
| `NODE_ENV` | `development` | `production` enables optimizations |
| `PORT` | `3000` | Server port |

---

## 11. Health Check

```bash
# Linux / macOS / WSL
curl -s http://localhost:3000/api

# Windows PowerShell
Invoke-RestMethod -Uri http://localhost:3000/api
# Response: { "message": "Hello, world!" }
```

---

## 12. Post-Deploy Checklist

- [ ] Database schema pushed: `bun run db:push`
- [ ] Demo data seeded: `curl -X POST http://localhost:3000/api/seed`
- [ ] Health check passes: `curl http://localhost:3000/api`
- [ ] All 11 tabs render without errors
- [ ] Price simulation ticks are updating (check Dashboard watchlist)
- [ ] SQLite database file is persisted (not in container ephemeral storage)
- [ ] Reverse proxy / TLS configured (if applicable)
- [ ] Process manager configured for auto-restart

---

## 13. Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| `bun: command not found` | Install Bun (Section 1) or verify PATH |
| `EACCES` on `bun install` | On Windows: run terminal as Administrator. On Linux/macOS: check folder permissions |
| Port 3000 already in use | Kill the process: `npx kill-port 3000` (cross-platform) or `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F` (Windows) |
| Prisma client not generated | Run `bun run db:generate` |
| SQLite database locked | Close all connections, delete `db/custom.db-journal`, retry |
| Hot reload not working | Ensure you are running `bun run dev` (not `bun run build && bun run start`) |
| VS Code IntelliSense not working for `@/` | Verify `compilerOptions.paths` in `tsconfig.json` (Section 5) and restart TS server: `Ctrl+Shift+P` → "TypeScript: Restart TS Server" |
| Tailwind classes not autocompleting | Install "Tailwind CSS IntelliSense" extension (Section 3.2) and verify the Tailwind config is detected |
| `ENAMETOOLONG` on Windows | Enable long paths: `git config --system core.longpaths true` |
| Slow initial compile (~12s) | Expected on first load; Next.js caches compiled pages. Subsequent navigations are instant |
