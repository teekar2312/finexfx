import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logInfo } from '@/lib/logger'
import { requireAdmin } from '@/lib/auth-server'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const accounts = await db.account.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ accounts })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (user instanceof NextResponse) return user

  try {
    const body = await req.json()
    const {
      name,
      broker,
      server,
      login,
      currency,
      leverage,
      balance,
      isDefault,
    } = body || {}

    if (!name || !login) {
      return NextResponse.json({ error: 'name and login are required' }, { status: 400 })
    }

    // If default, unset others first
    if (isDefault) {
      await db.account.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    }

    const initialBalance = Number(balance ?? 10000)
    const account = await db.account.create({
      data: {
        name: String(name),
        broker: broker ? String(broker) : 'FINEX Indonesia',
        server: server ? String(server) : '',
        login: String(login),
        currency: currency ? String(currency) : 'USD',
        leverage: leverage ? String(leverage) : '1:100',
        balance: initialBalance,
        equity: initialBalance,
        margin: 0,
        freeMargin: initialBalance,
        marginLevel: 0,
        connected: false,
        isDefault: Boolean(isDefault ?? false),
      },
    })

    await logInfo('api', `Account created: ${account.name} (${account.login})`, {
      accountId: account.id,
    })

    await auditLog(user, { action: 'account.create', entityType: 'account', entityId: account.id, metadata: { name: account.name, login: account.login } })
    return NextResponse.json({ account })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
