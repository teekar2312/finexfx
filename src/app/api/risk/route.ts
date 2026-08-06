import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DEFAULT_RISK_SETTINGS = {
  riskPerTrade: 0.5,
  stopLossPips: 10,
  takeProfitPips: 15,
  riskRewardRatio: 1.5,
  maxSimultaneousPositions: 3,
  dailyRiskLimit: 3.0,
  avoidMajorNews: true,
  dailyTargetPercent: 2.0,
  maxDailyTrades: 10,
};

export async function GET() {
  try {
    let settings = await db.riskSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    // If no settings exist, return defaults (without creating)
    if (!settings) {
      return NextResponse.json({
        ...DEFAULT_RISK_SETTINGS,
        id: null,
        isDefault: true,
      });
    }

    return NextResponse.json({
      id: settings.id,
      riskPerTrade: settings.riskPerTrade,
      stopLossPips: settings.stopLossPips,
      takeProfitPips: settings.takeProfitPips,
      riskRewardRatio: settings.riskRewardRatio,
      maxSimultaneousPositions: settings.maxSimultaneousPositions,
      dailyRiskLimit: settings.dailyRiskLimit,
      avoidMajorNews: settings.avoidMajorNews,
      dailyTargetPercent: settings.dailyTargetPercent,
      maxDailyTrades: settings.maxDailyTrades,
      updatedAt: settings.updatedAt.toISOString(),
      isDefault: false,
    });
  } catch (error) {
    console.error('Error fetching risk settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch risk settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate values
    const {
      riskPerTrade,
      stopLossPips,
      takeProfitPips,
      riskRewardRatio,
      maxSimultaneousPositions,
      dailyRiskLimit,
      avoidMajorNews,
      dailyTargetPercent,
      maxDailyTrades,
    } = body;

    if (riskPerTrade !== undefined && (riskPerTrade < 0.1 || riskPerTrade > 10)) {
      return NextResponse.json(
        { error: 'riskPerTrade must be between 0.1 and 10' },
        { status: 400 }
      );
    }

    if (stopLossPips !== undefined && (stopLossPips < 1 || stopLossPips > 100)) {
      return NextResponse.json(
        { error: 'stopLossPips must be between 1 and 100' },
        { status: 400 }
      );
    }

    let existing = await db.riskSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    let settings;

    if (existing) {
      settings = await db.riskSettings.update({
        where: { id: existing.id },
        data: {
          ...(riskPerTrade !== undefined && { riskPerTrade }),
          ...(stopLossPips !== undefined && { stopLossPips }),
          ...(takeProfitPips !== undefined && { takeProfitPips }),
          ...(riskRewardRatio !== undefined && { riskRewardRatio }),
          ...(maxSimultaneousPositions !== undefined && { maxSimultaneousPositions }),
          ...(dailyRiskLimit !== undefined && { dailyRiskLimit }),
          ...(avoidMajorNews !== undefined && { avoidMajorNews }),
          ...(dailyTargetPercent !== undefined && { dailyTargetPercent }),
          ...(maxDailyTrades !== undefined && { maxDailyTrades }),
        },
      });
    } else {
      settings = await db.riskSettings.create({
        data: {
          riskPerTrade: riskPerTrade ?? DEFAULT_RISK_SETTINGS.riskPerTrade,
          stopLossPips: stopLossPips ?? DEFAULT_RISK_SETTINGS.stopLossPips,
          takeProfitPips: takeProfitPips ?? DEFAULT_RISK_SETTINGS.takeProfitPips,
          riskRewardRatio: riskRewardRatio ?? DEFAULT_RISK_SETTINGS.riskRewardRatio,
          maxSimultaneousPositions: maxSimultaneousPositions ?? DEFAULT_RISK_SETTINGS.maxSimultaneousPositions,
          dailyRiskLimit: dailyRiskLimit ?? DEFAULT_RISK_SETTINGS.dailyRiskLimit,
          avoidMajorNews: avoidMajorNews ?? DEFAULT_RISK_SETTINGS.avoidMajorNews,
          dailyTargetPercent: dailyTargetPercent ?? DEFAULT_RISK_SETTINGS.dailyTargetPercent,
          maxDailyTrades: maxDailyTrades ?? DEFAULT_RISK_SETTINGS.maxDailyTrades,
        },
      });
    }

    return NextResponse.json({
      id: settings.id,
      riskPerTrade: settings.riskPerTrade,
      stopLossPips: settings.stopLossPips,
      takeProfitPips: settings.takeProfitPips,
      riskRewardRatio: settings.riskRewardRatio,
      maxSimultaneousPositions: settings.maxSimultaneousPositions,
      dailyRiskLimit: settings.dailyRiskLimit,
      avoidMajorNews: settings.avoidMajorNews,
      dailyTargetPercent: settings.dailyTargetPercent,
      maxDailyTrades: settings.maxDailyTrades,
      updatedAt: settings.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating risk settings:', error);
    return NextResponse.json(
      { error: 'Failed to update risk settings' },
      { status: 500 }
    );
  }
}
