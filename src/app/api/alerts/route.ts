import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const alerts = await db.priceAlert.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const formatted = alerts.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      condition: a.condition,
      price: a.price,
      isActive: a.isActive,
      message: a.message,
      triggeredAt: a.triggeredAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

    const activeAlerts = formatted.filter((a) => a.isActive);
    const triggeredAlerts = formatted.filter((a) => a.triggeredAt);

    return NextResponse.json({
      alerts: formatted,
      activeAlerts,
      triggeredAlerts,
      total: formatted.length,
      activeCount: activeAlerts.length,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, condition, price, message } = body;

    if (!symbol || !condition || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: symbol, condition, price' },
        { status: 400 }
      );
    }

    const validConditions = ['above', 'below', 'crosses_above', 'crosses_below'];
    if (!validConditions.includes(condition)) {
      return NextResponse.json(
        { error: `Invalid condition. Must be one of: ${validConditions.join(', ')}` },
        { status: 400 }
      );
    }

    const alert = await db.priceAlert.create({
      data: {
        symbol,
        condition,
        price,
        message: message ?? null,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: alert.id,
      symbol: alert.symbol,
      condition: alert.condition,
      price: alert.price,
      isActive: alert.isActive,
      message: alert.message,
      createdAt: alert.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const alert = await db.priceAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    await db.priceAlert.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Alert deleted successfully',
      deletedAlert: {
        id: alert.id,
        symbol: alert.symbol,
        condition: alert.condition,
        price: alert.price,
      },
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const alert = await db.priceAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    const updated = await db.priceAlert.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : !alert.isActive,
      },
    });

    return NextResponse.json({
      id: updated.id,
      symbol: updated.symbol,
      condition: updated.condition,
      price: updated.price,
      isActive: updated.isActive,
      message: updated.message,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
