export const KNIGHT_PORTRAIT_COUNT = 24;

/**
 * avatarId сервера — 0..KNIGHT_PORTRAIT_COUNT-1; статика `/knights/knight1.webp` … `knight{N}.webp`.
 */
export function knightPortraitPath(avatarId: number): string {
  const normalized = Number.isFinite(avatarId)
    ? Math.min(KNIGHT_PORTRAIT_COUNT - 1, Math.max(0, Math.floor(avatarId)))
    : 0;
  const assetNumber = normalized + 1;
  return `/knights/knight${assetNumber}.webp`;
}
