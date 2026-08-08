import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const events = await db.economicEvent.findMany({
      orderBy: { date: 'asc' },
    });

    const formatted = events.map((e) => ({
      id: e.id,
      event: e.event,
      currency: e.currency,
      impact: e.impact,
      actual: e.actual,
      forecast: e.forecast,
      previous: e.previous,
      date: e.date?.toISOString() ?? null,
      isAvoided: e.isAvoided,
    }));

    const grouped = {
      high: formatted.filter((e) => e.impact === 'high'),
      medium: formatted.filter((e) => e.impact === 'medium'),
      low: formatted.filter((e) => e.impact === 'low'),
    };

    return NextResponse.json({
      events: formatted,
      grouped,
      total: formatted.length,
    });
  } catch (error) {
    console.error('Error fetching economic events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch economic events' },
      { status: 500 }
    );
  }
}
