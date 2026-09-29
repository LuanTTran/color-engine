/**
 * Curve Interpolation Utilities
 *
 * Provides Catmull-Rom spline interpolation for tone curves
 * and preset curve definitions for common adjustments.
 */

import type { FixedCurvePoint } from '@/lib/color-engine/types/effects';

// Legacy CurvePoint type for backward compatibility
export interface CurvePoint {
  x: number; // 0-100 (input value)
  y: number; // 0-100 (output value)
}

/**
 * Interpolate sparse curve points into a dense 256-value lookup table
 * using Catmull-Rom spline interpolation for smooth curves.
 *
 * @param points - Sparse control points (x: 0-100, y: 0-100)
 * @param resolution - Output array size (default 256 for 8-bit color)
 * @returns Float32Array with values in 0-1 range
 */
export const interpolateCurve = (
  points: CurvePoint[],
  resolution: number = 256
): Float32Array => {
  const lut = new Float32Array(resolution);

  // Return identity curve if no points
  if (points.length === 0) {
    for (let i = 0; i < resolution; i++) {
      lut[i] = i / (resolution - 1);
    }
    return lut;
  }

  // Sort points by x (input value)
  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Fast path: Check for identity curve (linear diagonal)
  // This ensures perfect identity when curve is [{x:0, y:0}, {x:100, y:100}]
  if (sorted.length === 2) {
    const [start, end] = sorted;
    const isIdentity = 
      Math.abs(start.x) < 0.01 && 
      Math.abs(start.y) < 0.01 && 
      Math.abs(end.x - 100) < 0.01 && 
      Math.abs(end.y - 100) < 0.01;
    
    if (isIdentity) {
      // Perfect identity: output = input
      for (let i = 0; i < resolution; i++) {
        lut[i] = i / (resolution - 1);
      }
      return lut;
    }
    
    // Simple 2-point case: use linear interpolation for precision
    const slope = (end.y - start.y) / (end.x - start.x || 1);
    for (let i = 0; i < resolution; i++) {
      const x = (i / (resolution - 1)) * 100;
      const y = start.y + slope * (x - start.x);
      lut[i] = Math.max(0, Math.min(1, y / 100));
    }
    return lut;
  }

  // Ensure boundary points exist for Catmull-Rom
  if (sorted[0].x > 0) {
    sorted.unshift({ x: 0, y: sorted[0].y });
  }
  if (sorted[sorted.length - 1].x < 100) {
    sorted.push({ x: 100, y: sorted[sorted.length - 1].y });
  }

  for (let i = 0; i < resolution; i++) {
    const x = (i / (resolution - 1)) * 100; // Map to 0-100 range

    // Find surrounding control points
    let segmentIndex = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (x >= sorted[j].x && x <= sorted[j + 1].x) {
        segmentIndex = j;
        break;
      }
    }

    const p0 = sorted[Math.max(0, segmentIndex - 1)];
    const p1 = sorted[segmentIndex];
    const p2 = sorted[segmentIndex + 1];
    const p3 = sorted[Math.min(sorted.length - 1, segmentIndex + 2)];

    // Catmull-Rom interpolation
    const segmentWidth = p2.x - p1.x;
    const t = segmentWidth > 0 ? (x - p1.x) / segmentWidth : 0;
    const t2 = t * t;
    const t3 = t2 * t;

    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    // Convert to 0-1 range and clamp
    lut[i] = Math.max(0, Math.min(1, y / 100));
  }

  return lut;
};

/**
 * Check if a curve is effectively linear (identity)
 * Used for optimization - skip processing if curve has no effect
 */
export const isLinearCurve = (points: CurvePoint[]): boolean => {
  if (points.length !== 2) return false;

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const [start, end] = sorted;

  return (
    Math.abs(start.x - 0) < 0.01 &&
    Math.abs(start.y - 0) < 0.01 &&
    Math.abs(end.x - 100) < 0.01 &&
    Math.abs(end.y - 100) < 0.01
  );
};

// ============================================
// Curve Presets
// ============================================

export type CurvePresetId =
  | 'linear'
  | 'contrast'
  | 'film'
  | 'fade'
  | 'crush-blacks'
  | 'lift-shadows';

export interface CurvePreset {
  id: CurvePresetId;
  name: string;
  points: CurvePoint[];
}

/**
 * Get curve points for a preset
 */
export const getCurvePreset = (presetId: CurvePresetId): CurvePoint[] => {
  switch (presetId) {
    case 'linear':
      return [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

    case 'contrast': // S-curve for increased contrast
      return [
        { x: 0, y: 0 },
        { x: 25, y: 18 },
        { x: 50, y: 50 },
        { x: 75, y: 82 },
        { x: 100, y: 100 },
      ];

    case 'film': // Lifted blacks, compressed highlights (classic film look)
      return [
        { x: 0, y: 12 },
        { x: 50, y: 50 },
        { x: 100, y: 92 },
      ];

    case 'fade': // Raised blacks, lowered whites (faded/matte look)
      return [
        { x: 0, y: 18 },
        { x: 50, y: 50 },
        { x: 100, y: 82 },
      ];

    case 'crush-blacks': // Deep shadows, normal highlights
      return [
        { x: 0, y: 0 },
        { x: 25, y: 10 },
        { x: 50, y: 45 },
        { x: 100, y: 100 },
      ];

    case 'lift-shadows': // Lifted shadows, normal highlights
      return [
        { x: 0, y: 8 },
        { x: 25, y: 35 },
        { x: 50, y: 55 },
        { x: 100, y: 100 },
      ];

    default:
      return [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];
  }
};

/**
 * All available curve presets with metadata
 */
export const CURVE_PRESETS: CurvePreset[] = [
  { id: 'linear', name: 'Linear', points: getCurvePreset('linear') },
  { id: 'contrast', name: 'S-Curve', points: getCurvePreset('contrast') },
  { id: 'film', name: 'Film', points: getCurvePreset('film') },
  { id: 'fade', name: 'Fade', points: getCurvePreset('fade') },
  { id: 'crush-blacks', name: 'Crush Blacks', points: getCurvePreset('crush-blacks') },
  { id: 'lift-shadows', name: 'Lift Shadows', points: getCurvePreset('lift-shadows') },
];

/**
 * Get default curve points - linear diagonal (identity, no effect)
 */
export const getDefaultCurvePoints = (): CurvePoint[] => [
  { x: 0, y: 0 },
  { x: 100, y: 100 },
];

/**
 * Alias for getDefaultCurvePoints - for explicit reset calls
 */
export const getLinearCurvePoints = (): CurvePoint[] => getDefaultCurvePoints();

/**
 * Get wave curve points - horizontal wave pattern (like density curve reference)
 * Use this as a preset, not as default
 */
export const getWaveCurvePoints = (): CurvePoint[] => [
  { x: 0, y: 50 },
  { x: 15, y: 42 },
  { x: 35, y: 55 },
  { x: 55, y: 65 },
  { x: 75, y: 55 },
  { x: 90, y: 50 },
  { x: 100, y: 50 },
];

// ============================================
// Fixed 6-Point Curve Utilities
// ============================================

/**
 * Interpolate fixed 6-point curve into a dense 256-value lookup table
 * Uses Catmull-Rom spline interpolation for smooth curves.
 *
 * @param points - Fixed 6 control points (x: fixed positions, y: 0-100)
 * @param resolution - Output array size (default 256 for 8-bit color)
 * @returns Float32Array with values in 0-1 range
 */
export const interpolateFixedCurve = (
  points: FixedCurvePoint[],
  resolution: number = 256
): Float32Array => {
  // Convert FixedCurvePoint to CurvePoint format and use existing interpolation
  const curvePoints: CurvePoint[] = points.map(p => ({ x: p.x, y: p.y }));
  return interpolateCurve(curvePoints, resolution);
};

/**
 * Check if a fixed curve is effectively linear (identity)
 * Used for optimization - skip processing if curve has no effect
 */
export const isLinearFixedCurve = (points: FixedCurvePoint[]): boolean => {
  if (points.length !== 6) return false;

  // Check if all points are on the diagonal (y = x)
  return points.every((point) => Math.abs(point.y - point.x) < 0.5);
};
