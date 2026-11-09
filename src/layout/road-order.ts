/** The widths, in metres, where a road moves up a tier. */
const TIER_WIDTHS = [5, 8, 11, 20];

/**
 * Roads lie at one height, so where two meet something has to decide which is
 * on top. Wider roads win: 0 is a footpath and 4 is the highway.
 */
export function roadTier(width: number): number {
  return TIER_WIDTHS.filter((limit) => width >= limit).length;
}
