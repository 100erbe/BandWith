/**
 * BandWith Design System — Motion & Animation Tokens
 * Standardized uniform durations, easing curves, and physics-based spring presets.
 */

// ── Uniform Animation Durations (in seconds for Framer Motion / Motion) ──
export const durations = {
  instant: 0.1,   // 100ms: micro-interactions, tap/active press states
  fast: 0.15,     // 150ms: tooltips, icon swaps, badge updates
  normal: 0.2,    // 200ms: collapsing headers, tabs, dropdowns, menus
  moderate: 0.25, // 250ms: small card switches, staggered lists
  medium: 0.3,    // 300ms: modal sheets, expanded cards, dialogs
  slow: 0.4,      // 400ms: view transitions, wizard steps, welcome flips
} as const;

// ── Uniform Easing Curves ──
export const easings = {
  standard: [0.2, 0, 0, 1] as const,     // Standard deceleration (Material / iOS)
  smooth: [0.16, 1, 0.3, 1] as const,    // Silky deceleration without overshoot
  spring: [0.22, 1, 0.36, 1] as const,   // Snappy spring-like cubic bezier
  easeOut: [0, 0, 0.2, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
} as const;

// ── Uniform Physics-based Springs ──
// Critically-damped springs with high stiffness & low mass for immediate responsiveness and zero lag.
export const headerSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 32,
  mass: 0.7,
};

export const HEADER_SPRING = headerSpring;

export const springs = {
  // Collapsing header & sticky bar morphs (instant response, ~200ms settle)
  header: headerSpring,
  // Snappy: fast user actions, toggles, icon feedback
  snappy: { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.7 },
  // Smooth: gentle, fluid transitions for tabs & cards
  smooth: { type: "spring" as const, stiffness: 350, damping: 28, mass: 0.8 },
  // Bouncy: playful overshoot for badges & celebratory alerts
  bouncy: { type: "spring" as const, stiffness: 340, damping: 22, mass: 0.8 },
  // Nav: bottom navigation pill transitions
  nav: { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.75 },
  // Backward-compatible tween presets mapped to uniform design system durations
  card: { type: "tween" as const, duration: durations.medium, ease: easings.smooth },
  menu: { type: "tween" as const, duration: durations.normal, ease: easings.smooth },
  dashboard: { type: "tween" as const, duration: durations.moderate, ease: easings.smooth },
} as const;

// Card transition - optimized
export const cardTransition = {
  type: "tween" as const,
  duration: durations.medium,
  ease: easings.smooth,
};

// Card expand animation - soft elastic effect using CSS cubic-bezier
export const cardExpandTransition = {
  type: "tween" as const,
  duration: durations.slow,
  ease: [0.32, 0.72, 0, 1] as const,
};

export const cardExpandElasticTransition = {
  type: "tween" as const, 
  duration: durations.slow,
  ease: [0.34, 1.25, 0.64, 1] as const,
};

export const cardCollapseTransition = {
  type: "tween" as const,
  duration: durations.normal,
  ease: [0.32, 0, 0.67, 0] as const,
};

// Menu stagger animation variants
export const menuContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  exit: { opacity: 0, transition: { staggerChildren: 0.02, staggerDirection: -1 } }
};

export const menuItemVariants = {
  hidden: { y: 15, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "tween" as const, duration: durations.normal, ease: easings.smooth } },
  exit: { y: 15, opacity: 0, transition: { type: "tween" as const, duration: durations.fast, ease: [0.4, 0, 1, 1] } }
};

// Dashboard switch stagger animation variants
export const dashboardContainerVariants = {
  hidden: { opacity: 0, y: 15 } as const,
  show: {
    opacity: 1, 
    y: 0,
    transition: { duration: durations.moderate, ease: easings.smooth, staggerChildren: 0.05 }
  },
  exit: {
    opacity: 0, 
    y: -15,
    transition: { duration: durations.normal, ease: easings.smooth, staggerChildren: 0.03, staggerDirection: -1 }
  }
};

export const dashboardItemVariants: any = {
  hidden: { opacity: 0, x: 20 },
  show: { 
    opacity: 1, 
    x: 0, 
    transition: { type: "tween", duration: durations.moderate, ease: easings.smooth } 
  },
  exit: { 
    opacity: 0, 
    x: -20, 
    transition: { type: "tween", duration: durations.fast, ease: [0.4, 0, 1, 1] } 
  }
};
