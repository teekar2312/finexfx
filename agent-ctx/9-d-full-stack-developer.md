# Task 9-d: Create Onboarding Tour for First-Time Users

## Work Done
- Created `/src/components/trading/OnboardingTour.tsx` — standalone 'use client' component
- Implemented 7-step guided tour covering: Welcome, Dashboard, Trading, Analysis, Risk Management, Quick Trade Panel, and Complete steps
- Each step has a dedicated Lucide icon (PartyPopper, LayoutDashboard, CandlestickChart, LineChart, Shield, Zap, HelpCircle) rendered at 56x56 in emerald color
- Full-screen semi-transparent overlay (`bg-black/70 backdrop-blur-sm`) with glass-card-premium styled card
- Navigation: Next/Back/Skip buttons using shadcn/ui Button. Last step shows "Get Started" instead of "Next"
- Progress bar at top of card animates smoothly with framer-motion
- Step indicator dots and "Step X of 7" counter
- Card entrance/exit animations (scale + fade via spring physics)
- Step transition animations (direction-aware slide)
- localStorage persistence with key `finex-onboarding-complete`
- Floating "Tour" button (bottom-right) appears after tour completion for re-access
- Exported `useOnboardingTour` hook returning `{ showTour, setShowTour, isTourComplete, resetTour }`
- Default export: `OnboardingTour` component
- Zero lint errors verified

## Key Design Decisions
- Used module-level shared state pattern (listener set) so the hook and component stay in sync without prop drilling
- Initialized `visible` and `tourCompleted` via lazy useState initializers to avoid the lint rule about setState in effects
- `alreadyCompleted` computed once at render time from localStorage
- Effect only used to sync shared state on mount (no visible setState calls that trigger cascading renders)
