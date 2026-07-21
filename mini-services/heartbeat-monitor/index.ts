// heartbeat-monitor — standalone Bun service
// Pings the MT5 bridge every 10 s; if offline for > 30 s, triggers
// auto-close of all open positions and sends a webhook notification.

const PORT = 3060;
const MT5_BRIDGE_URL = "http://localhost:3050/health";
const NEXTJS_BASE = "http://localhost:3000";
const CHECK_INTERVAL_MS = 10_000;
const FAILURE_THRESHOLD = 3; // 3 consecutive failures × 10 s = 30 s

const SERVICE_API_KEY = process.env.SERVICE_API_KEY ?? "";

// ── state ──────────────────────────────────────────────────────────
const SERVICE_START = new Date();

let consecutiveFailures = 0;
let checksPerformed = 0;
let lastDisconnectAt: string | null = null;
let mt5Online = true;
let disconnectAlertSent = false; // guard so we only alert once per outage

// ── helpers ────────────────────────────────────────────────────────
function isoNow() {
  return new Date().toISOString();
}

async function pingMt5(): Promise<boolean> {
  try {
    const res = await fetch(MT5_BRIDGE_URL, { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function triggerDisconnectActions() {
  // 1. Tell Next.js to auto-close all open positions
  try {
    const res = await fetch(`${NEXTJS_BASE}/api/health/mt5-disconnect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_API_KEY ? { Authorization: `Bearer ${SERVICE_API_KEY}` } : {}),
      },
    });
    if (res.ok) {
      console.log(`[${isoNow()}] ✅ mt5-disconnect endpoint called successfully`);
    } else {
      console.error(`[${isoNow()}] ⚠️ mt5-disconnect returned ${res.status}`);
    }
  } catch (err) {
    console.error(`[${isoNow()}] ❌ Failed to call mt5-disconnect:`, err);
  }

  // 2. Send webhook notification
  try {
    const res = await fetch(`${NEXTJS_BASE}/api/notifications/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_API_KEY ? { Authorization: `Bearer ${SERVICE_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        type: "system",
        title: "MT5 Bridge Disconnected",
        message:
          `MT5 bridge has been offline for >30 seconds (${consecutiveFailures} consecutive failures). ` +
          `Auto-close of all open positions has been triggered. ` +
          `Last successful check: ${lastDisconnectAt ?? "unknown"}.`,
      }),
    });
    if (res.ok) {
      console.log(`[${isoNow()}] ✅ Webhook notification sent`);
    } else {
      console.error(`[${isoNow()}] ⚠️ Webhook returned ${res.status}`);
    }
  } catch (err) {
    console.error(`[${isoNow()}] ❌ Failed to send webhook:`, err);
  }
}

// ── health-check loop ──────────────────────────────────────────────
async function checkLoop() {
  checksPerformed++;

  const online = await pingMt5();

  if (online) {
    if (!mt5Online) {
      // Bridge recovered
      console.log(`[${isoNow()}] ✅ MT5 bridge is back online`);
    }
    consecutiveFailures = 0;
    mt5Online = true;
    disconnectAlertSent = false;
  } else {
    consecutiveFailures++;
    console.log(
      `[${isoNow()}] ❌ MT5 bridge health check failed (${consecutiveFailures}/${FAILURE_THRESHOLD})`
    );

    if (consecutiveFailures === 1 && !lastDisconnectAt) {
      lastDisconnectAt = isoNow();
    }

    if (mt5Online) {
      mt5Online = false;
    }

    if (consecutiveFailures >= FAILURE_THRESHOLD && !disconnectAlertSent) {
      console.log(
        `[${isoNow()}] 🚨 MT5 bridge offline for >30s — triggering disconnect actions`
      );
      disconnectAlertSent = true;
      await triggerDisconnectActions();
    }
  }
}

// ── HTTP server ────────────────────────────────────────────────────
const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/status" && req.method === "GET") {
      return Response.json({
        mt5Bridge: {
          online: mt5Online,
          lastCheck: isoNow(),
          consecutiveFailures,
          lastDisconnectAt,
        },
        uptime: SERVICE_START.toISOString(),
        checksPerformed,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[${isoNow()}] Heartbeat monitor running on port ${PORT}`);
console.log(`[${isoNow()}] Checking MT5 bridge at ${MT5_BRIDGE_URL} every ${CHECK_INTERVAL_MS / 1000}s`);
console.log(`[${isoNow()}] Disconnect threshold: ${FAILURE_THRESHOLD} failures (${FAILURE_THRESHOLD * CHECK_INTERVAL_MS / 1000}s)`);

// Start the check loop (first check immediately)
checkLoop();
setInterval(checkLoop, CHECK_INTERVAL_MS);