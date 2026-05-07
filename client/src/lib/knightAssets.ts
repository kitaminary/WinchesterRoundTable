export const KNIGHT_PORTRAIT_COUNT = 13;

/**
 * avatarId сервера — 0..12; файлы статики `/knights/knight1.png` … `knight13.png`.
 */
export function knightPortraitPath(avatarId: number): string {
  const normalized = Number.isFinite(avatarId)
    ? Math.min(KNIGHT_PORTRAIT_COUNT - 1, Math.max(0, Math.floor(avatarId)))
    : 0;
  const assetNumber = normalized + 1;
  return `/knights/knight${assetNumber}.webp`;
}
