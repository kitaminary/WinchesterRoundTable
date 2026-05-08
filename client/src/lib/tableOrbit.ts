export const ROUND_TABLE_SEAT_COUNT = 13;

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
  const angle = -Math.PI / 2 + (seatIndex / totalSeats) * Math.PI * 2;

  const orbitRadiusX = 40;
  const orbitRadiusY = 34;

  const centerX = 46;
  /** Сдвиг вниз относительно визуального центра наклонённой столешницы */
  const centerY = 54;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const xPercent = centerX + cos * orbitRadiusX;
  const yPercent = centerY + sin * orbitRadiusY;

  const depth = (sin + 1) / 2;

  const scale = 0.74 + depth * 0.34;

  const zIndex = 0 + Math.round(depth * 60);

  const bubbleYOffset = 82 + depth * 18;

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
