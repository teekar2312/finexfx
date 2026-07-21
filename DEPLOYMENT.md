# Deployment Guide — Windows 11 + Visual Studio Code

Panduan lengkap untuk men-deploy FinexFX AI Trading System v2.1.0 di Windows 11
menggunakan Visual Studio Code sebagai IDE.

---

## Prerequisites

### Software yang Harus Diinstall

| Software | Version | Download | Notes |
|---|---|---|---|
| **Windows 11** | 22H2+ | — | 64-bit required |
| **Visual Studio Code** | Latest | [code.visualstudio.com](https://code.visualstudio.com) | IDE utama |
| **MetaTrader 5** | Latest | Dari broker FINEX Indonesia | Harus login ke akun live |
| **Python** | 3.10+ | [python.org](https://www.python.org/downloads/) | Centang "Add to PATH" saat install |
| **Bun** | 1.1+ | [bun.sh](https://bun.sh) | JavaScript runtime |
| **Git** | Latest | [git-scm.com](https://git-scm) | Version control |
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org) | Required oleh better-sqlite3 native build |
| **Ollama** (optional) | Latest | [ollama.com](https://ollama.com) | Untuk AI analysis (local, free) |

### VS Code Extensions (Recommended)

Install extension berikut di VS Code (`Ctrl+Shift+X`):

1. **ESLint** (Microsoft) — linting
2. **Prettier** (Prettier) — code formatting
3. **Tailwind CSS IntelliSense** (Tailwind Labs) — autocomplete Tailwind classes
4. **Python** (Microsoft) — untuk edit `mt5_bridge.py`
5. **SQLite Viewer** (Florian Klampfer) — inspect database
6. **Better Comments** (Aaron Bond) — highlight komentar
7. **GitLens** (GitKraken) — git integration

---

## Step-by-Step Deployment

### Step 1: Clone Repository

Buka **Command Prompt** atau **PowerShell** di Windows:

```cmd
cd C:\Users\<YourUser>\Documents
git clone https://github.com/teekar2312/realFRX.git finexfx
cd finexfx
```

Atau via VS Code:
1. Buka VS Code
2. `Ctrl+Shift+P` → **Git: Clone**
3. Paste: `https://github.com/teekar2312/realFRX.git`
4. Pilih folder tujuan (misal: `C:\Users\<YourUser>\Documents\finexfx`)
5. Klik **Open** saat ditanya

### Step 2: Install Dependencies

Buka terminal di VS Code (`Ctrl+`` `):

```cmd
bun install
```

Tunggu hingga selesai (± 2-5 menit). Jika ada error native build untuk `better-sqlite3`, pastikan Node.js terinstall dan restart terminal.

### Step 3: Setup MetaTrader 5

1. **Install MT5** dari broker FINEX Indonesia:
   - Download dari [finex.co.id](https://www.finex.co.id) atau hubungi support
   - Run installer, pilih folder install (default: `C:\Program Files\MetaTrader 5\`)

2. **Login ke akun live**:
   - Buka MT5 terminal
   - Klik **File → Login to Trade Account**
   - Masukkan:
     - **Login**: nomor akun trading Anda (misal: `90011223`)
     - **Password**: password akun trading
     - **Server**: `Finex-Live` (atau server yang diberikan broker)
   - Klik **OK**
   - Pastikan status "Connected" di pojok kanan bawah

3. **Catat path terminal64.exe**:
   - Default: `C:\Program Files\MetaTrader 5\terminal64.exe`

### Step 4: Setup Python Bridge

Python bridge berjalan di mesin Windows yang sama dengan MT5 (Windows-only package).

1. **Install Python packages**:

   ```cmd
   cd C:\Users\<YourUser>\Documents\finexfx\mini-services\mt5-bridge\python
   pip install -r requirements.txt
   ```

2. **Copy Python bridge ke folder permanen** (opsional, recommended):
   ```cmd
   mkdir C:\finexfx
   copy mini-services\mt5-bridge\python\mt5_bridge.py C:\finexfx\
   ```

3. **Test Python bridge**:
   ```cmd
   cd C:\finexfx
   python mt5_bridge.py --port 5050 --host 0.0.0.0
   ```

   Output yang diharapkan:
   ```
   * Serving Flask app 'mt5_bridge'
   * Running on all addresses (0.0.0.0)
   * Running on http://127.0.0.1:5050
   ```

   Biarkan terminal ini terbuka. Python bridge harus terus berjalan selama trading aktif.

### Step 5: Setup AI / LLM Provider (Recommended)

The system supports multiple LLM providers for AI market analysis. **Ollama is
recommended** because it's free, local, and doesn't need an internet API key.

#### Option A: Ollama (Free, Local — Recommended)

```cmd
:: 1. Download dan install Ollama dari https://ollama.com
:: 2. Buka terminal baru, pull model:
ollama pull llama3.1:8b
```

#### Option B: OpenAI API

```
:: Daftar di https://platform.openai.com/api-keys
:: Dapatkan API key Anda
```

#### Option C: Groq (Free Tier Available)

```
:: Daftar di https://console.groq.com
:: Dapatkan API key Anda
```

> **Tanpa LLM**: Jika tidak ada provider yang dikonfigurasi, semua fitur AI
> tetap berfungsi dengan fallback rule-based analysis.

### Step 6: Configure Environment

Di VS Code, buat file `.env` di root project:

```cmd
copy .env.example .env
```

Edit `.env` di VS Code:

```env
# Database
DATABASE_URL=file:./db/custom.db

# MT5 Bridge
MT5_PYTHON_BRIDGE_URL=http://localhost:5050
MT5_BRIDGE_URL=http://localhost:3050

# NextAuth — GENERATE secret baru:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET=<paste-output-di-sini>
NEXTAUTH_URL=http://localhost:3000

# Bridge Authentication — GENERATE key baru:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BRIDGE_API_KEY=<paste-output-di-sini>

# Service API Key (for background services)
SERVICE_API_KEY=<paste-output-di-sini>

# LLM Provider — pilih satu: ollama / openai / groq
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# (Optional) Paper Trading — test tanpa uang sungguhan
# PAPER_TRADING=true

# (Optional) Daily P&L Summary — kirim laporan harian ke Discord/Telegram
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
# DAILY_SUMMARY_CRON=0 22 * * *
```

### Step 7: Initialize Database

Di VS Code terminal:

```cmd
mkdir db
bun run db:migrate
bun run seed
bun run seed:auth
```

Output yang diharapkan:
```
✓ migrations applied successfully
🌱 Seeding database (real trading defaults)...
  ✓ 30 indicators
  ✓ risk settings
  ✓ system config
✅ Seed complete

🔐 Seeding default admin user...
✅ Default admin user created
Admin password: <COPY-THIS-IMMEDIATELY>
```

### Step 8: Start All Services

**Install mini-service dependencies**:

```cmd
cd mini-services\price-feed && bun install && cd ..\..
cd mini-services\mt5-bridge && bun install && cd ..\..
cd mini-services\sl-tp-monitor && bun install && cd ..\..
cd mini-services\heartbeat-monitor && bun install && cd ..\..
```

**Urutan startup (PENTING)**:

> Next.js app (port 3000) HARUS running sebelum SL/TP monitor dan heartbeat-monitor start.

1. **Python bridge** (di Command Prompt terpisah):
   ```cmd
   cd C:\finexfx
   python mt5_bridge.py --port 5050 --host 0.0.0.0
   ```

2. **Node.js services** (di VS Code — gunakan Tasks: Run Task → Start: All Services):

   | Service | Port | Notes |
   |---|---|---|
   | Next.js App | 3000 | Start pertama — tunggu "Ready" |
   | MT5 Bridge (Node.js) | 3050 | Proxy ke Python bridge |
   | Price-Feed WebSocket | 3003 | Live tick streaming |
   | SL/TP Monitor | — | Start setelah Next.js ready |
   | Heartbeat Monitor | 3060 | Optional — auto-close jika MT5 offline |

3. **Verify semua service running**:

   | URL | Expected Response |
   |---|---|
   | `http://localhost:5050/health` | `{"status":"ok","mt5_installed":true}` |
   | `http://localhost:3050/health` | `{"status":"ok","adapter":"real-python","isLive":true}` |
   | `http://localhost:3000/api/health` | `{"status":"ok","checks":{"database":{"status":"ok"},...}}` |

### Step 9: Login ke Dashboard

1. Buka browser: **http://localhost:3000**
2. Login dengan:
   - **Email**: `admin@finexfx.local`
   - **Password**: (password yang di-print saat `bun run seed:auth`)
3. **Ganti password** segera: Settings → User Management → Reset Password

### Step 10: Tambahkan Akun MT5 Live

1. Di dashboard, buka tab **Settings**
2. Klik **"Tambah Akun"**
3. Isi: Nama Akun, Broker, Server (`Finex-Live`), Login, Password, Currency, Leverage
4. Klik **Tambah** → **Connect** untuk test koneksi

---

## Paper Trading (Test Tanpa Risiko)

Untuk menguji strategi tanpa uang sungguhan:

1. Tambahkan `PAPER_TRADING=true` ke `.env`
2. Restart Next.js app
3. Semua trade akan disimulasikan dengan harga real tapi tanpa eksekusi ke MT5
4. Trade paper ditandai `source='paper'` di database
5. Gunakan untuk memvalidasi strategi sebelum live trading

---

## Konfigurasi Lanjutan

### Auto-start Python Bridge saat Windows Boot

1. Buka **Task Scheduler** (Win+R → `taskschd.msc`)
2. Klik **Create Task**
3. Tab **General**: Name: `FinexFX MT5 Bridge`, check "Run whether user is logged on or not"
4. Tab **Triggers** → **New**: Begin the task: **At log on**
5. Tab **Actions** → **New**:
   - Program/script: `python`
   - Arguments: `C:\finexfx\mt5_bridge.py --port 5050 --host 0.0.0.0`
   - Start in: `C:\finexfx`
6. Klik **OK**, masukkan password Windows

### Daily P&L Summary via Discord/Telegram

Kirim laporan trading harian otomatis:

```env
# Discord webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/.../...

# Atau Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=-1001234567890

# Schedule (default: setiap hari jam 22:00 UTC)
DAILY_SUMMARY_CRON=0 22 * * *
```

Manual trigger: `curl -X POST http://localhost:3000/api/system/daily-summary`

### Heartbeat Monitor

The heartbeat monitor (port 3060) secara otomatis:
- Ping MT5 bridge setiap 10 detik
- Jika offline > 30 detik: trigger auto-close semua posisi terbuka
- Kirim notifikasi webhook saat disconnect dan reconnect

```cmd
cd mini-services\heartbeat-monitor
bun run dev
```

---

## Troubleshooting

### Problem: `better-sqlite3` build error saat `bun install`

**Solusi**: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — pilih "Desktop development with C++". Lalu:
```cmd
npm config set msvs_version 2019
bun install
```

### Problem: Python `MetaTrader5` package gagal install

**Penyebab**: Package ini Windows-only. Pastikan Python 3.10+ 64-bit dan Windows 10/11 64-bit.

### Problem: MT5 bridge `terminal64.exe not found`

```cmd
setx MT5_PATH "C:\Program Files\MetaTrader 5\terminal64.exe"
```

### Problem: Dashboard menampilkan price = 0 (bridge offline)

**Debugging**:

1. **Cek Python bridge**: `curl http://localhost:5050/health`
2. **Cek Node.js bridge**: `curl http://localhost:3050/health`
3. **Cek MT5 terminal login**: pastikan status "Connected"
4. **Cek firewall**: pastikan port 5050 dan 3050 tidak di-block

### Problem: Login gagal ("Configuration" error)

Generate dan set `NEXTAUTH_SECRET` di `.env`:
```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Restart `bun run dev`.

### Problem: `bun run seed` error

Jika `better-sqlite3` tidak supported di Bun runtime:
```cmd
bun add -d tsx
bun run seed
bun run seed:auth
```

### Problem: LLM error "model has been decommissioned"

**Penyebab**: Model LLM yang dikonfigurasi sudah tidak tersedia di provider.

**Contoh**: `llama-3.1-70b-versatile` di Groq sudah di-decommission (Juni 2025).

**Solusi**: Update model di `.env`:

```env
# Groq — gunakan model yang masih aktif:
GROQ_MODEL=llama-3.3-70b-versatile

# OpenAI:
OPENAI_MODEL=gpt-4o-mini

# Ollama — cek model yang tersedia:
ollama list
```

> **Tip**: Cek model yang tersedia di Groq:
> `curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models`

### Problem: AI analysis returns heuristic fallback

**Penyebab**: LLM provider belum dikonfigurasi.

**Solusi**: Set `LLM_PROVIDER` dan provider-specific env vars di `.env`. Lihat [Step 5](#step-5-setup-ai--llm-provider-recommended) di atas.

Jika Ollama: pastikan Ollama berjalan dan model sudah di-pull:
```cmd
ollama list          # cek model yang tersedia
ollama pull llama3.1:8b   # pull jika belum ada
```

### Problem: SL/TP monitor "Unable to connect"

**Penyebab**: SL/TP monitor start sebelum Next.js app running.
**Solusi**: Ikuti urutan startup yang benar — Next.js harus ready terlebih dahulu.

### Problem: `port 3000 already in use`

```cmd
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## Monitoring & Maintenance

### Cek Status Semua Service

Buat script `check-services.bat`:

```bat
@echo off
echo === FinexFX Service Status ===
echo.
echo [1] Next.js (3000): & curl -s -o nul -w "HTTP %%{http_code}\n" http://localhost:3000/api/health
echo [2] MT5 Node Bridge (3050): & curl -s http://localhost:3050/health | findstr "status"
echo [3] Price-Feed (3003): & powershell -Command "Test-NetConnection -ComputerName localhost -Port 3003 -InformationLevel Quiet"
echo [4] Heartbeat (3060): & powershell -Command "Test-NetConnection -ComputerName localhost -Port 3060 -InformationLevel Quiet"
echo [5] Python Bridge (5050): & curl -s http://localhost:5050/health | findstr "status"
echo.
echo === LLM Provider Status ===
curl -s http://localhost:3000/api/health/llm-info
echo.
pause
```

### LLM Provider Monitoring

Dashboard AI Panel menampilkan card **"LLM Provider"** yang auto-refresh setiap 15 detik:

| Metrik | Deskripsi |
|---|---|
| **Provider** | Ollama / OpenAI / Groq / Z.AI |
| **Model** | Model yang aktif (misal: llama3.1:8b) |
| **Status** | Online (hijau) / Tidak Tersedia (merah) |
| **Total Panggilan** | Jumlah total LLM call + success rate % |
| **Latensi Terakhir** | Waktu response call terakhir |
| **Sukses / Gagal** | Breakdown success vs failed calls |
| **Error Terakhir** | Pesan error terakhir (hanya muncul jika ada error) |

Jika status "Tidak Tersedia", cek konfigurasi LLM di `.env` dan pastikan provider service berjalan.

Jika ingin cek via API:
```cmd
curl -s http://localhost:3000/api/health/llm-info | python -m json.tool
```

### Backup Database

```cmd
:: Manual backup
copy db\custom.db db\backups\custom-%date:~-4,4%%date:~-10,2%%date:~-7,2%.db

:: Atau via API
curl -X POST http://localhost:3000/api/system/backup
```

### Update Repository

```cmd
git pull origin main
bun install
bun run db:migrate
:: Restart semua service
```

---

## Security Checklist

- [ ] **Change admin password** setelah first login
- [ ] **Generate unique `NEXTAUTH_SECRET`** (jangan pakai placeholder)
- [ ] **Set `BRIDGE_API_KEY`** di production (sistem akan error jika kosong)
- [ ] **Windows Firewall** aktif, hanya expose port yang diperlukan
- [ ] **Python bridge** di-belakang VPN jika diakses dari luar network
- [ ] **MT5 credentials** tidak di-commit ke git (cek `.gitignore`)
- [ ] **Database backup** terjadwal (sl-tp-monitor handle ini tiap 1 jam)
- [ ] **Test dengan paper trading** sebelum live

---

## Disclaimer

**REAL TRADING MODE** — sistem ini mengeksekusi trade dengan uang sungguhan di akun MT5 live.

1. **Test dengan small lot (0.01)** selama beberapa hari
2. **Set risk management** konservatif di awal (0.5% per trade, 2% daily limit)
3. **Gunakan paper trading mode** untuk validasi strategi
4. **Monitor trade logs** secara berkala
5. **Jangan tinggalkan sistem tanpa pengawasan** dalam jangka panjang

Penulis tidak bertanggung jawab atas kerugian finansial akibat penggunaan sistem ini.