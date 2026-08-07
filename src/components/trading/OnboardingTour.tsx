'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CandlestickChart,
  LineChart,
  Shield,
  Zap,
  HelpCircle,
  PartyPopper,
  X,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type LucideIcon = typeof LayoutDashboard;

interface TourStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to FINEX Indonesia',
    description:
      'Your professional forex trading platform. This quick tour will show you around the key features to help you get started.',
    icon: PartyPopper,
  },
  {
    title: 'Your Trading Dashboard',
    description:
      'Your trading dashboard shows real-time prices, account overview, and recent activity — all at a glance.',
    icon: LayoutDashboard,
  },
  {
    title: 'Execute Trades',
    description:
      'Execute trades, view open positions, and manage your portfolio with real-time P&L tracking.',
    icon: CandlestickChart,
  },
  {
    title: 'Market Analysis',
    description:
      'Technical indicators, charting tools, market analysis, and AI-powered trading signals to inform your decisions.',
    icon: LineChart,
  },
  {
    title: 'Risk Management',
    description:
      'Set risk parameters, calculate position sizes, monitor exposure, and protect your capital with smart limits.',
    icon: Shield,
  },
  {
    title: 'Quick Trade Panel',
    description:
      'The floating panel lets you trade from any tab — never miss an opportunity while analyzing the markets.',
    icon: Zap,
  },
  {
    title: "You're All Set!",
    description:
      "Use the keyboard shortcut '?' for help anytime. Happy trading!",
    icon: HelpCircle,
  },
];

const STORAGE_KEY = 'finex-onboarding-complete';

const TOTAL_STEPS = TOUR_STEPS.length;

// ─── Shared state so multiple consumers stay in sync ──────────
let sharedShowTour = false;
const listeners = new Set<() => void>();

function setSharedShowTour(value: boolean) {
  sharedShowTour = value;
  listeners.forEach((fn) => fn());
}

function subscribeShared(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ─── Hook ────────────────────────────────────────────
export function useOnboardingTour() {
  const [showTour, setShowTourState] = useState(sharedShowTour);

  useEffect(() => {
    return subscribeShared(() => setShowTourState(sharedShowTour));
  }, []);

  const isTourComplete =
    typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY) === 'true'
      : false;

  const setShowTour = useCallback((value: boolean) => {
    setSharedShowTour(value);
    if (!value) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSharedShowTour(true);
  }, []);

  return { showTour, setShowTour, isTourComplete, resetTour };
}

// ─── Animation variants ──────────────────────────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 350, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 20,
    transition: { duration: 0.2 },
  },
};

const stepContentVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// ─── Component ─────────────────────────────────────────────
export default function OnboardingTour() {
  const alreadyCompleted =
    typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';

  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(() => !alreadyCompleted);
  const [tourCompleted, setTourCompleted] = useState(alreadyCompleted);
  const [direction, setDirection] = useState(1);

  // Sync shared state on mount
  useEffect(() => {
    if (!alreadyCompleted) {
      setSharedShowTour(true);
    }
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTourCompleted(true);
    localStorage.setItem(STORAGE_KEY, 'true');
    setSharedShowTour(false);
  }, []);

  const handleNext = useCallback(() => {
    setDirection(1);
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleClose();
    }
  }, [currentStep, handleClose]);

  const handleBack = useCallback(() => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTourCompleted(false);
    setCurrentStep(0);
    setVisible(true);
    setSharedShowTour(true);
  }, []);

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;
  const isLast = currentStep === TOTAL_STEPS - 1;
  const isFirst = currentStep === 0;

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="onboarding-overlay"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <motion.div
              key="onboarding-card"
              className="glass-card-premium relative w-full max-w-md rounded-xl p-6"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress bar */}
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-xl">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-3 right-3 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                aria-label="Close tour"
              >
                <X className="size-4" />
              </button>

              {/* Step content with direction-aware animation */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={stepContentVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="flex flex-col items-center text-center"
                >
                  {/* Icon */}
                  <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                    <StepIcon className="size-7 text-emerald-500" />
                  </div>

                  {/* Title */}
                  <h2 className="mb-2 text-lg font-semibold text-white">
                    {step.title}
                  </h2>

                  {/* Description */}
                  <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Step indicator dots */}
              <div className="mb-3 flex items-center justify-center gap-2">
                {TOUR_STEPS.map((_, idx) => (
                  <span
                    key={idx}
                    className={
                      idx === currentStep
                        ? 'size-2 rounded-full bg-emerald-500'
                        : 'size-2 rounded-full bg-slate-600'
                    }
                  />
                ))}
              </div>

              {/* Step counter */}
              <p className="mb-5 text-center text-xs text-slate-500">
                Step {currentStep + 1} of {TOTAL_STEPS}
              </p>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Skip
                </Button>

                <div className="flex gap-2">
                  {!isFirst && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBack}
                      className="border-slate-700 text-slate-300 hover:bg-white/5 hover:text-white"
                    >
                      Back
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    {isLast ? 'Get Started' : 'Next'}
                  </Button>
                </div>
              </div>

              {/* Show Tour Again note on last step */}
              {isLast && (
                <div className="mt-4 border-t border-slate-700/50 pt-3">
                  <p className="text-xs text-slate-500">
                    You can restart this tour from Settings anytime.
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating "Show Tour Again" button — visible only after tour completed */}
      {tourCompleted && !visible && (
        <motion.button
          type="button"
          onClick={handleReset}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600/90 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-emerald-900/30 backdrop-blur-sm transition-colors hover:bg-emerald-500"
          aria-label="Show tour again"
        >
          <RotateCcw className="size-3.5" />
          Tour
        </motion.button>
      )}
    </>
  );
}
