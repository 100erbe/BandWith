/**
 * Fee shown on a gig invite: only the member's own fee (decided 2026-11-13,
 * members never see the gig total). Null when there is none to show.
 */
export const inviteFeeToShow = (data: Record<string, unknown> | null | undefined): number | null => {
  const fee = Number(data?.member_fee);
  return Number.isFinite(fee) && fee > 0 ? fee : null;
};
