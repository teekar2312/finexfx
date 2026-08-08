import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { NewsItem } from '@/lib/types';

/** Fallback static news used only when DB has no items */
const FALLBACK_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    source: 'Reuters',
    title: 'Federal Reserve Holds Rates Steady at 5.25-5.50%',
    summary: 'The Fed kept rates unchanged but indicated inflation is cooling faster than expected.',
    category: 'Monetary Policy',
    impact: 'high',
    currency: 'USD',
    publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

export async function GET() {
  try {
    // M4: Read from database first (seeded data), fallback to static
    const dbNews = await db.newsItem.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });

    if (dbNews.length > 0) {
      const formatted = dbNews.map((n) => ({
        id: n.id,
        source: n.source,
        title: n.title,
        summary: n.summary ?? undefined,
        url: n.url ?? undefined,
        category: n.category ?? undefined,
        impact: (n.impact as 'high' | 'medium' | 'low') ?? undefined,
        currency: n.currency ?? undefined,
        publishedAt: n.publishedAt?.toISOString() ?? undefined,
      }));
      return NextResponse.json({ news: formatted, total: formatted.length });
    }

    return NextResponse.json({
      news: FALLBACK_NEWS,
      total: FALLBACK_NEWS.length,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
