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
 */
export function wedgeMidAngleRadians(seatIndex: number, seatCount: number): number {
  const stepDeg = seatAngleStepDegrees(seatCount);
  return RAD * (-90 + (seatIndex + 0.5) * stepDeg);
}

/**
 * Эллипс мест в координатах оверлея (процента от .round-table).
 * Совпадает с радиальной раскладкой секторов на столе (−90° + i * step).
 * Верх экрана: меньший scale/z; низ — больше («ближе»).
 */
export interface SeatOrbitStyle {
  left: string;
  top: string;
  transform: string;
  zIndex: number;
  boxShadow: string;
}

export function getSeatOrbitTransform(
  seatIndex: number,
  seatCount: number
): SeatOrbitStyle {
  const t = wedgeMidAngleRadians(seatIndex, seatCount);

  /** Радиус кольца немного поверх края столешницы в плане сцены. */
  const rx = 43.5;
  const ry = 38.2;

  const xPct = 50 + rx * Math.cos(t);
  const yPct = 50 + ry * Math.sin(t);

  const sinT = Math.sin(t);
  const depth01 = (sinT + 1) / 2;

  const scaleMin = 0.78;
  const scaleMax = 1.18;
  const scale = scaleMin + depth01 * (scaleMax - scaleMin);

  const zIndex = 52 + Math.round(depth01 * 88);

  const blur = 5 + depth01 * 18;
  const yOff = 3 + depth01 * 11;
  const alpha = 0.22 + depth01 * 0.4;
  const boxShadow = `0 ${yOff.toFixed(1)}px ${blur.toFixed(1)}px rgba(0,0,0,${alpha.toFixed(2)}), 0 0 0 1px rgba(188,155,74,0.15)`;

  /** Небольшое вертикальное смещение: верхнее кольцо чуть поднять, нижнее приземлить для читаемой глубины. */
  const dyPx = -4 + depth01 * 10;

  /** Без декоративного rotate — только screen-facing масштаб и смещение. */
  const transform = `translate(-50%, -50%) translate(0px, ${dyPx.toFixed(2)}px) scale(${scale.toFixed(4)})`;

  return {
    left: `${xPct.toFixed(3)}%`,
    top: `${yPct.toFixed(3)}%`,
    transform,
    zIndex,
    boxShadow,
  };
}
