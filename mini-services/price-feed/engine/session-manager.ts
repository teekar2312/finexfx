// ═══════════════════════════════════════════════════════════════════
// Session Manager — Tracks forex trading sessions (London, NY, Asia)
// and adjusts volatility/spread multipliers accordingly.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TradingSession } from '../types';

interface SessionConfig {
  name: string;
  startHourUTC: number;
  endHourUTC: number;
 volatilityMultiplier: number;
  spreadMultiplier: number;
}

const SESSIONS: SessionConfig[] = [
  { name: 'Asian Session',       startHourUTC: 0,  endHourUTC: 8,  volatilityMultiplier: 0.5,  spreadMultiplier: 1.8  },
  { name: 'London Pre-Open',     startHourUTC: 7,  endHourUTC: 8,  volatilityMultiplier: 0.8,  spreadMultiplier: 1.3  },
  { name: 'London Session',      startHourUTC: 8,  endHourUTC: 12, volatilityMultiplier: 1.0,  spreadMultiplier: 1.0  },
  { name: 'London/NY Overlap',   startHourUTC: 13, endHourUTC: 17, volatilityMultiplier: 1.5,  spreadMultiplier: 0.7  },
  { name: 'New York Session',    startHourUTC: 17, endHourUTC: 21, volatilityMultiplier: 1.1,  spreadMultiplier: 0.9  },
  { name: 'NY Close',            startHourUTC: 21, endHourUTC: 22, volatilityMultiplier: 0.7,  spreadMultiplier: 1.4  },
  { name: 'Off-Hours (Pacific)', startHourUTC: 22, endHourUTC: 0,  volatilityMultiplier: 0.3,  spreadMultiplier: 2.5  },
];

export class SessionManager {
  /** Get the current active trading session */
  getCurrentSession(): TradingSession {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDecimal = utcHour + utcMinute / 60;

    for (const session of SESSIONS) {
      if (utcDecimal >= session.startHourUTC && utcDecimal < session.endHourUTC) {
        return {
          name: session.name,
          isActive: true,
          volatilityMultiplier: session.volatilityMultiplier,
          spreadMultiplier: session.spreadMultiplier,
        };
      }
    }

    // Fallback: off-hours
    return {
      name: 'Off-Hours',
      isActive: false,
      volatilityMultiplier: 0.4,
      spreadMultiplier: 2.0,
    };
  }

  /** Get just the volatility multiplier */
  getVolatilityMultiplier(): number {
    return this.getCurrentSession().volatilityMultiplier;
  }

  /** Get just the spread multiplier */
  getSpreadMultiplier(): number {
    return this.getCurrentSession().spreadMultiplier;
  }

  /** Get all upcoming sessions with countdown info */
  getUpcomingSessions(): Array<TradingSession & { opensAt: string }> {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const sessions: Array<TradingSession & { opensAt: string }> = [];

    for (const session of SESSIONS) {
      const isActive = utcHour >= session.startHourUTC && utcHour < session.endHourUTC;
      const opensAt = isActive ? undefined : `${String(session.startHourUTC).padStart(2, '0')}:00 UTC`;
      sessions.push({
        name: session.name,
        isActive,
        volatilityMultiplier: session.volatilityMultiplier,
        spreadMultiplier: session.spreadMultiplier,
        opensAt: opensAt!,
      });
    }

    return sessions;
  }
}
