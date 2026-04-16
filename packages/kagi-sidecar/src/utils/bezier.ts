export interface Point {
  x: number
  y: number
}

const BASE_CURVE_RATIO = 0.2
const MIN_CURVE_OFFSET = 12
const MAX_CURVE_OFFSET = 30
const OVERSHOOT_MIN_OFFSET = 4
const OVERSHOOT_MAX_OFFSET = 14
const OVERSHOOT_RATIO = 0.08

function clampUnitT(t: number): number {
  if (t <= 0) {
    return 0
  }

  if (t >= 1) {
    return 1
  }

  return t
}

function distance(pointA: Point, pointB: Point): number {
  const dx = pointA.x - pointB.x
  const dy = pointA.y - pointB.y
  return Math.hypot(dx, dy)
}

function createControlPoint(start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const segmentLength = distance(start, end)
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2

  if (segmentLength === 0) {
    return { x: midX, y: midY }
  }

  const offset = Math.min(
    MAX_CURVE_OFFSET,
    Math.max(MIN_CURVE_OFFSET, segmentLength * BASE_CURVE_RATIO),
  )
  const perpX = -dy / segmentLength
  const perpY = dx / segmentLength

  return {
    x: midX + perpX * offset,
    y: midY + perpY * offset,
  }
}

export function calculateBezierPoint(t: number, p0: Point, p1: Point, p2: Point): Point {
  const safeT = clampUnitT(t)
  const inv = 1 - safeT
  const invSq = inv * inv
  const tSq = safeT * safeT
  const twoInvT = 2 * inv * safeT

  return {
    x: invSq * p0.x + twoInvT * p1.x + tSq * p2.x,
    y: invSq * p0.y + twoInvT * p1.y + tSq * p2.y,
  }
}

export function generateBezierPath(start: Point, end: Point, steps = 10): Point[] {
  const segmentCount = Math.max(1, Math.floor(steps))
  const control = createControlPoint(start, end)
  const points: Point[] = []

  for (let i = 0; i <= segmentCount; i += 1) {
    const t = i / segmentCount
    points.push(calculateBezierPoint(t, start, control, end))
  }

  return points
}

function createOvershootPoint(start: Point, end: Point): Point {
  const segmentLength = distance(start, end)
  if (segmentLength === 0) {
    return end
  }

  const dx = end.x - start.x
  const dy = end.y - start.y
  const offset = Math.min(
    OVERSHOOT_MAX_OFFSET,
    Math.max(OVERSHOOT_MIN_OFFSET, segmentLength * OVERSHOOT_RATIO),
  )

  return {
    x: end.x + (dx / segmentLength) * offset,
    y: end.y + (dy / segmentLength) * offset,
  }
}

export function generateNaturalBezierPath(
  start: Point,
  end: Point,
  addOvershoot?: boolean,
): Point[] {
  const path = generateBezierPath(start, end)
  if (!addOvershoot) {
    return path
  }

  const overshootPoint = createOvershootPoint(start, end)
  const overshootPath = generateBezierPath(start, overshootPoint, 14)
  const correctionPath = generateBezierPath(overshootPoint, end, 7)

  return [...overshootPath, ...correctionPath.slice(1)]
}
