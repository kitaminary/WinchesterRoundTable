export const ROUND_TABLE_SEAT_COUNT = 24;

const RAD = Math.PI / 180;

/**
 * Полный шаг между соседними местами по окружности: 360 / 13 °.
 */
export function seatAngleStepDegrees(seatCount: number): number {
  return 360 / seatCount;
}

/**
 * Полярный угол центра сектора wedge(seatIndex) в радианах.
 * Стандарт math: −π/2 = «вверх» по SVG (место 0 поднято к верхнему центру экрана).
 * Используется для отрисовки wedges на столешнице.
 */
export function wedgeMidAngleRadians(seatIndex: number, seatCount: number): number {
  const stepDeg = seatAngleStepDegrees(seatCount);
  return RAD * (-90 + (seatIndex + 0.5) * stepDeg);
}

/**
 * Perspective positioning data for seat avatar medallions.
 * Seats arranged in an elliptical orbit matching the tilted table perspective.
 */
export interface SeatPerspectivePosition {
  xPercent: number;
  yPercent: number;
  scale: number;
  depth: number;
  zIndex: number;
  bubbleYOffset: number;
}

/**
 * Calculate perspective position for a seat in the 3D table scene.
 * Uses ellipse orbit to match tilted table visual.
 * Top/back seats = smaller & dimmer, Bottom/front seats = larger & closer.
 */
export function seatPerspectivePosition(
  seatIndex: number,
  totalSeats: number
): SeatPerspectivePosition {
  const angle = -Math.PI / 0.981 + (seatIndex / totalSeats) * Math.PI * 2;

  // Derived from the perspective projection of the rotateX(54°) table disc.
  // The table art is tilted 54° on X with transform-origin at 50%/58%.
  // After perspective projection (1500px), the disc rim maps to an ellipse
  // centred at ~(40%, 59%) with semi-axes ~(33%, 22%) in round-table space (x −10pp vs disc).
  // Using slightly smaller radii (33/22 vs rim 35/24) so avatar centres sit
  // at the rim rather than straddling it from outside.
  const orbitRadiusX = 37;
  const orbitRadiusY = 22;

  const centerX = 48;
  // 59% — perspective projection of the tilted disc shifts the visual
  // orbit centre below the geometric centre of the round-table div.
  const centerY = 53;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const xPercent = centerX + cos * orbitRadiusX;
  const yPercent = centerY + sin * orbitRadiusY;

  const depth = (sin + 1) / 2;

  // Subtle depth cue: back (top) seats 0.82 scale, front (bottom) 0.94.
  // All seats are in the same flat CSS plane (no real 3D scaling), so this
  // is purely an artistic perspective hint.
  const scale = 0.62 + depth * 0.2;

  const zIndex = 10 + Math.round(depth * 50);

  const bubbleYOffset = 10 + depth * 14;

  return { xPercent, yPercent, scale, depth, zIndex, bubbleYOffset };
}

/**
 * Legacy interface for backward compatibility.
 * Эллипс мест в координатах оверлея (процента от .round-table).
 * Верх экрана: меньший scale/z; низ — больше («ближе»).
 */
export interface SeatOrbitStyle {
  left: string;
  top: string;
  transform: string;
  zIndex: number;
  boxShadow: string;
  depth: number;
}

/**
 * Get seat orbit transform using new perspective positioning.
 * Returns CSS-ready values for absolute positioning.
 */
export function getSeatOrbitTransform(
  seatIndex: number,
  seatCount: number
): SeatOrbitStyle {
  const pos = seatPerspectivePosition(seatIndex, seatCount);

  const blur = 10 + pos.depth * 18;
  const yOff = 3 + pos.depth * 9;
  const alpha = 0.28 + pos.depth * 0.2;
  const boxShadow = `0 ${yOff.toFixed(1)}px ${blur.toFixed(1)}px rgba(0,0,0,${alpha.toFixed(2)})`;

  const transform = `translate(-50%, -50%) scale(${pos.scale.toFixed(4)})`;

  return {
    left: `${pos.xPercent.toFixed(3)}%`,
    top: `${pos.yPercent.toFixed(3)}%`,
    transform,
    zIndex: pos.zIndex,
    boxShadow,
    depth: pos.depth,
  };
}
