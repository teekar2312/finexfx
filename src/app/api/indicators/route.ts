import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const configs = await db.indicatorConfig.findMany({
      orderBy: { name: 'asc' },
    });

    const formatted = configs.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      enabled: c.isEnabled,
      settings: JSON.parse(c.settings),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    const byCategory = {
      trend: formatted.filter((c) => c.category === 'trend'),
      momentum: formatted.filter((c) => c.category === 'momentum'),
      volatility: formatted.filter((c) => c.category === 'volatility'),
      volume: formatted.filter((c) => c.category === 'volume'),
    };

    return NextResponse.json({
      indicators: formatted,
      byCategory,
      total: formatted.length,
    });
  } catch (error) {
    console.error('Error fetching indicators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch indicator configurations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, enabled, settings } = body;

    if (id) {
      // Update existing indicator config
      const existing = await db.indicatorConfig.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Indicator configuration not found' },
          { status: 404 }
        );
      }

      const updated = await db.indicatorConfig.update({
        where: { id },
        data: {
          ...(enabled !== undefined && { isEnabled: enabled }),
          ...(settings !== undefined && { settings: JSON.stringify(settings) }),
        },
      });

      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        category: updated.category,
        enabled: updated.isEnabled,
        settings: JSON.parse(updated.settings),
        updatedAt: updated.updatedAt.toISOString(),
      });
    }

    if (!name || enabled === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields for creating indicator: name, enabled' },
        { status: 400 }
      );
    }

    // Create new indicator config
    const newConfig = await db.indicatorConfig.create({
      data: {
        name,
        category: body.category ?? 'trend',
        settings: JSON.stringify(settings ?? {}),
        isEnabled: enabled,
      },
    });

    return NextResponse.json({
      id: newConfig.id,
      name: newConfig.name,
      category: newConfig.category,
      enabled: newConfig.isEnabled,
      settings: JSON.parse(newConfig.settings),
      createdAt: newConfig.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating indicator config:', error);
    return NextResponse.json(
      { error: 'Failed to update indicator configuration' },
      { status: 500 }
    );
  }
}
