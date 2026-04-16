import { describe, expect, it } from 'bun:test'
import type { Point } from './bezier'
import { calculateBezierPoint, generateBezierPath, generateNaturalBezierPath } from './bezier'

const BASE_CURVE_OFFSET = 12
const BASE_CURVE_RATIO = 0.2
const MAX_CURVE_OFFSET = 30

function distance(pointA: Point, pointB: Point): number {
  const dx = pointA.x - pointB.x
  const dy = pointA.y - pointB.y
  return Math.hypot(dx, dy)
}

function pathLength(points: Point[]): number {
  return points.slice(1).reduce((acc, point, index) => {
    const previous = points[index]
    return acc + distance(previous, point)
  }, 0)
}

function expectedControlPoint(start: Point, end: Point): Point {
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
    Math.max(BASE_CURVE_OFFSET, segmentLength * BASE_CURVE_RATIO),
  )
  const perpX = -dy / segmentLength
  const perpY = dx / segmentLength

  return {
    x: midX + perpX * offset,
    y: midY + perpY * offset,
  }
}

describe('calculateBezierPoint', () => {
  it('returns start/end points for t=0 and t=1', () => {
    const start = { x: 4, y: -5 }
    const control = { x: 15, y: 10 }
    const end = { x: 30, y: 20 }

    expect(calculateBezierPoint(0, start, control, end)).toEqual(start)
    expect(calculateBezierPoint(1, start, control, end)).toEqual(end)
  })
})

describe('generateBezierPath', () => {
  it('contains a midpoint matching generated control math and a realistic curve length', () => {
    const start = { x: 0, y: 0 }
    const end = { x: 100, y: 0 }
    const steps = 4

    const path = generateBezierPath(start, end, steps)
    const control = expectedControlPoint(start, end)
    const midpoint = calculateBezierPoint(0.5, start, control, end)

    expect(path).toHaveLength(steps + 1)
    expect(path[0]).toEqual(start)
    expect(path[path.length - 1]).toEqual(end)
    expect(path[Math.floor(steps / 2)]).toEqual(midpoint)
    expect(pathLength(path)).toBeGreaterThan(100)
    expect(pathLength(path)).toBeLessThan(130)
  })
})

describe('generateNaturalBezierPath', () => {
  it('adds extra overshoot correction points when enabled', () => {
    const start = { x: 0, y: 0 }
    const end = { x: 100, y: 0 }

    const normalPath = generateBezierPath(start, end)
    const correctedPath = generateNaturalBezierPath(start, end, true)

    expect(correctedPath.length).toBeGreaterThan(normalPath.length)
    expect(correctedPath[correctedPath.length - 1]).toEqual(end)
    expect(Math.max(...correctedPath.map((point) => point.x))).toBeGreaterThan(end.x)
  })
})
