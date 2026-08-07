'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  CheckCircle,
  ShieldAlert,
  Target,
  Bell,
  Zap,
  Newspaper,
  AlertTriangle,
  VolumeX,
  Headphones,
  Gamepad2,
  Moon,
  Clock,
  Play,
} from 'lucide-react';

// --- Data ---

interface SoundCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  defaultOn: boolean;
}

const SOUND_CATEGORIES: SoundCategory[] = [
  {
    id: 'trade_executed',
    name: 'Trade Executed',
    description: 'When a trade order is filled',
    icon: Volume2,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    defaultOn: true,
  },
  {
    id: 'trade_closed',
    name: 'Trade Closed',
    description: 'When a trade is fully closed',
    icon: CheckCircle,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
    defaultOn: true,
  },
  {
    id: 'stop_loss',
    name: 'Stop Loss Hit',
    description: 'When stop loss level is triggered',
    icon: ShieldAlert,
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    defaultOn: true,
  },
  {
    id: 'take_profit',
    name: 'Take Profit Hit',
    description: 'When take profit level is reached',
    icon: Target,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    defaultOn: true,
  },
  {
    id: 'price_alert',
    name: 'Price Alert Triggered',
    description: 'When a price alert fires',
    icon: Bell,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    defaultOn: true,
  },
  {
    id: 'signal_generated',
    name: 'Signal Generated',
    description: 'When a new trading signal appears',
    icon: Zap,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    defaultOn: false,
  },
  {
    id: 'news_alert',
    name: 'News Alert',
    description: 'Breaking forex news updates',
    icon: Newspaper,
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    defaultOn: false,
  },
  {
    id: 'error_warning',
    name: 'Error/Warning',
    description: 'System errors and warnings',
    icon: AlertTriangle,
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    defaultOn: true,
  },
];

interface VolumePreset {
  label: string;
  value: number;
}

const VOLUME_PRESETS: VolumePreset[] = [
  { label: 'Mute', value: 0 },
  { label: 'Low', value: 25 },
  { label: 'Medium', value: 60 },
  { label: 'Full', value: 100 },
];

interface SoundScheme {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
}

const SOUND_SCHEMES: SoundScheme[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Soft, minimal beeps',
    icon: VolumeX,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clear, distinct tones',
    icon: Headphones,
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Exciting, impactful sounds',
    icon: Gamepad2,
  },
];

type PreviewType = 'trade' | 'alert' | 'error' | null;

// --- Custom Toggle Switch ---

function ToggleSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
        checked
          ? 'bg-emerald-500'
          : 'bg-muted/50'
      }`}
    >
      <span
        className={`pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform ${
          checked ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// --- Main Component ---

export default function SoundNotificationPanel() {
  const [enabledSounds, setEnabledSounds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SOUND_CATEGORIES.forEach((c) => {
      initial[c.id] = c.defaultOn;
    });
    return initial;
  });

  const [volume, setVolume] = useState(75);
  const [activeScheme, setActiveScheme] = useState('professional');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [activePreview, setActivePreview] = useState<PreviewType>(null);

  const toggleSound = useCallback((id: string) => {
    setEnabledSounds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const triggerPreview = useCallback((type: PreviewType) => {
    setActivePreview(type);
    const duration = type === 'error' ? 800 : 1500;
    setTimeout(() => setActivePreview(null), duration);
  }, []);

  return (
    <div className="glass-card-premium rounded-xl overflow-hidden">
      <style>{EQ_CSS}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
          <Volume2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sound Notifications</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Configure audio alerts and sound settings</p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Section 1: Sound Categories */}
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Sound Categories
          </h3>
          <div className="space-y-0.5 rounded-lg border border-border/50 overflow-hidden">
            {SOUND_CATEGORIES.map((category, idx) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/30 ${
                    idx < SOUND_CATEGORIES.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                >
                  <div
                    className={`w-7 h-7 rounded-full ${category.iconBg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${category.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground leading-tight">
                      {category.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {category.description}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={enabledSounds[category.id]}
                    onCheckedChange={() => toggleSound(category.id)}
                  />
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Section 2: Global Volume Slider */}
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Global Volume
          </h3>
          <div className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${volume}%, rgba(255,255,255,0.1) ${volume}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                  aria-label="Volume slider"
                />
              </div>
              <span className="text-xs font-mono font-semibold text-foreground w-10 text-right tabular-nums">
                {volume}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              {VOLUME_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setVolume(preset.value)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                    volume === preset.value
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-muted/40 text-muted-foreground border border-border/50 hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Sound Preview */}
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Sound Preview
          </h3>
          <div className="flex flex-wrap gap-2">
            <PreviewButton
              icon={Volume2}
              label="Test Trade Sound"
              active={activePreview === 'trade'}
              onClick={() => triggerPreview('trade')}
              barClass="eq-trade"
              barCount={4}
            />
            <PreviewButton
              icon={Bell}
              label="Test Alert Sound"
              active={activePreview === 'alert'}
              onClick={() => triggerPreview('alert')}
              barClass="eq-alert"
              barCount={4}
            />
            <PreviewButton
              icon={AlertTriangle}
              label="Test Error Sound"
              active={activePreview === 'error'}
              onClick={() => triggerPreview('error')}
              barClass="eq-error"
              barCount={4}
            />
          </div>
        </section>

        {/* Section 4: Sound Scheme Selector */}
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Sound Scheme
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {SOUND_SCHEMES.map((scheme) => {
              const Icon = scheme.icon;
              const isActive = activeScheme === scheme.id;
              return (
                <motion.button
                  key={scheme.id}
                  onClick={() => setActiveScheme(scheme.id)}
                  className={`relative rounded-lg border p-3 text-left transition-all ${
                    isActive
                      ? 'border-emerald-500/50 bg-emerald-500/[0.08] shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'border-border/50 bg-muted/30 hover:bg-muted/40 hover:border-border'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isActive && (
                    <motion.div
                      className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400"
                      layoutId="scheme-indicator"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={`w-4 h-4 mb-1.5 ${
                      isActive ? 'text-emerald-400' : 'text-muted-foreground'
                    }`}
                  />
                  <p
                    className={`text-xs font-medium leading-tight ${
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {scheme.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">
                    {scheme.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Section 5: Quiet Hours */}
        <section>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quiet Hours
          </h3>
          <div className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Moon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Enable Quiet Hours</span>
              </div>
              <ToggleSwitch
                checked={quietHoursEnabled}
                onCheckedChange={setQuietHoursEnabled}
              />
            </div>
            <AnimatePresence>
              {quietHoursEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <label htmlFor="quiet-start" className="text-[10px] text-muted-foreground">
                        From
                      </label>
                      <input
                        id="quiet-start"
                        type="time"
                        value={quietStart}
                        onChange={(e) => setQuietStart(e.target.value)}
                        className="h-7 px-2 rounded-md border border-border/50 bg-muted/40 text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">to</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="quiet-end"
                        type="time"
                        value={quietEnd}
                        onChange={(e) => setQuietEnd(e.target.value)}
                        className="h-7 px-2 rounded-md border border-border/50 bg-muted/40 text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                      />
                      <span className="text-[10px] text-muted-foreground">UTC</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-1">
                    <VolumeX className="w-3 h-3" />
                    All sounds muted during quiet hours
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Sub-components ---

function PreviewButton({
  icon: Icon,
  label,
  active,
  onClick,
  barClass,
  barCount,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  barClass: string;
  barCount: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left transition-all ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
          : 'border-border/50 bg-muted/30 hover:bg-muted/40 hover:border-border'
      }`}
    >
      <Icon
        className={`w-3.5 h-3.5 shrink-0 ${
          active ? 'text-emerald-400' : 'text-muted-foreground'
        }`}
      />
      <span
        className={`text-[11px] font-medium whitespace-nowrap ${
          active ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
      <AnimatePresence>
        {active && (
          <motion.div
            className="flex items-end gap-[3px] h-4 ml-1"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            {Array.from({ length: barCount }).map((_, i) => (
              <div
                key={i}
                className={`w-[3px] rounded-full bg-emerald-400 ${barClass}-${i + 1}`}
                style={{ height: '20%' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {!active && <Play className="w-3 h-3 text-muted-foreground/40 ml-auto" />}
    </button>
  );
}

// --- CSS Keyframes for Equalizer ---

const EQ_CSS = `
@keyframes eq-bar-1 {
  0%, 100% { height: 20%; }
  50% { height: 90%; }
}
@keyframes eq-bar-2 {
  0%, 100% { height: 60%; }
  30% { height: 20%; }
  70% { height: 100%; }
}
@keyframes eq-bar-3 {
  0%, 100% { height: 40%; }
  25% { height: 80%; }
  50% { height: 30%; }
  75% { height: 95%; }
}
@keyframes eq-bar-4 {
  0%, 100% { height: 70%; }
  40% { height: 25%; }
  80% { height: 85%; }
}
@keyframes eq-rapid-1 {
  0% { height: 10%; }
  10% { height: 100%; }
  20% { height: 30%; }
  30% { height: 80%; }
  40% { height: 15%; }
  50% { height: 95%; }
  60% { height: 20%; }
  70% { height: 85%; }
  80% { height: 10%; }
  90% { height: 70%; }
  100% { height: 10%; }
}
@keyframes eq-rapid-2 {
  0% { height: 80%; }
  12% { height: 15%; }
  25% { height: 90%; }
  37% { height: 20%; }
  50% { height: 100%; }
  62% { height: 10%; }
  75% { height: 75%; }
  87% { height: 30%; }
  100% { height: 80%; }
}
@keyframes eq-rapid-3 {
  0% { height: 40%; }
  15% { height: 95%; }
  30% { height: 10%; }
  45% { height: 70%; }
  60% { height: 25%; }
  75% { height: 100%; }
  90% { height: 15%; }
  100% { height: 40%; }
}
@keyframes eq-rapid-4 {
  0% { height: 60%; }
  10% { height: 20%; }
  20% { height: 85%; }
  35% { height: 40%; }
  50% { height: 100%; }
  65% { height: 15%; }
  80% { height: 90%; }
  90% { height: 35%; }
  100% { height: 60%; }
}
.eq-trade-1 { animation: eq-bar-1 0.6s ease-in-out infinite; }
.eq-trade-2 { animation: eq-bar-2 0.8s ease-in-out infinite; }
.eq-trade-3 { animation: eq-bar-3 0.5s ease-in-out infinite; }
.eq-trade-4 { animation: eq-bar-4 0.7s ease-in-out infinite; }
.eq-alert-1 { animation: eq-bar-3 0.4s ease-in-out infinite; }
.eq-alert-2 { animation: eq-bar-1 0.5s ease-in-out infinite; }
.eq-alert-3 { animation: eq-bar-2 0.35s ease-in-out infinite; }
.eq-alert-4 { animation: eq-bar-4 0.45s ease-in-out infinite; }
.eq-error-1 { animation: eq-rapid-1 0.3s linear infinite; }
.eq-error-2 { animation: eq-rapid-2 0.25s linear infinite; }
.eq-error-3 { animation: eq-rapid-3 0.35s linear infinite; }
.eq-error-4 { animation: eq-rapid-4 0.28s linear infinite; }
`;
