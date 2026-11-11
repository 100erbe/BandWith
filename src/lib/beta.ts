/**
 * Public beta: every account, including the free Indie Act plan, gets every
 * feature its role allows. Paid plans stay visible but cannot be picked.
 * Set to false at launch to bring the plan limits back.
 */
export const IS_BETA = true;

/** Paid tiers (Indie Act / single_band is the free plan). */
export const isPaidTier = (tier?: string | null): boolean => tier === 'multi_band' || tier === 'unlimited';

/** Whether a plan-gated feature is available to someone on `tier`. */
export const hasPlanFeature = (tier?: string | null): boolean => IS_BETA || isPaidTier(tier);
