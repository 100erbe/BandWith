// Spring configurations - optimized for smooth 60fps animations
export const springs = {
  smooth: { type: "tween", duration: 0.3, ease: "easeOut" },
  snappy: { type: "tween", duration: 0.2, ease: "easeOut" },
  bouncy: { type: "tween", duration: 0.25, ease: [0.34, 1.56, 0.64, 1] },
  card: { type: "tween", duration: 0.3, ease: "easeOut" },
  menu: { type: "tween", duration: 0.25, ease: "easeOut" },
  dashboard: { type: "tween", duration: 0.25, ease: "easeOut" },
} as const;

export const durations = {
  fast: 0.15,
  medium: 0.25,
  slow: 0.4,
} as const;

// Card transition - optimized
export const cardTransition = { type: "tween", duration: 0.3, ease: "easeOut" };

// Card expand animation - soft elastic effect using CSS cubic-bezier
// This curve gives a gentle overshoot without aggressive bounce
export const cardExpandTransition = {
  type: "tween",
  duration: 0.5,
  ease: [0.32, 0.72, 0, 1], // Smooth with soft deceleration
};

export const cardExpandElasticTransition = {
  type: "tween", 
  duration: 0.6,
  ease: [0.34, 1.3, 0.64, 1], // Gentle elastic overshoot
};

export const cardCollapseTransition = {
  type: "tween",
  duration: 0.35,
  ease: [0.32, 0, 0.67, 0], // Quick ease-in for closing
};

// Menu stagger animation variants
export const menuContainerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  exit: { opacity: 0, transition: { staggerChildren: 0.02, staggerDirection: -1 } }
};

export const menuItemVariants = {
  hidden: { y: 15, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "tween", duration: 0.2, ease: "easeOut" } },
  exit: { y: 15, opacity: 0, transition: { type: "tween", duration: 0.15, ease: "easeIn" } }
};

// Dashboard switch stagger animation variants
export const dashboardContainerVariants = {
  hidden: {}, 
  show: {
    transition: { staggerChildren: 0.06 }
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 }
  }
};

export const dashboardItemVariants = {
  hidden: { opacity: 0, x: 30 },
  show: { 
    opacity: 1, 
    x: 0, 
    transition: { type: "tween", duration: 0.25, ease: "easeOut" } 
  },
  exit: { 
    opacity: 0, 
    x: -30, 
    transition: { type: "tween", duration: 0.15, ease: "easeIn" } 
  }
};
