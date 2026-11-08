import type { Settings, SlotId } from './types'

export const OUTER_RADIUS = 1000

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface SlotGeom {
  id: SlotId
  gen: number
  index: number
  isCenter: boolean
  /** Inner / outer radius of the drawn shape (gap already applied). */
  r1: number
  r2: number
  /** Angles in radians; SVG convention (0 = +x, clockwise positive). */
  a0: number
  a1: number
  mid: number
  path: string
  /** Frame centre in chart coordinates. */
  cx: number
  cy: number
  /** Rotation of the photo frame in degrees. */
  frameRot: number
  /** Axis-aligned bounds of the shape in frame-local coordinates (origin = cx,cy). */
  box: Box
  thickness: number
  /** Arc length along the middle radius. */
  arcLen: number
}

export interface ChartGeom {
  slots: SlotGeom[]
  byId: Map<SlotId, SlotGeom>
  viewBox: Box
  centerRadius: number
  title?: { y: number; subtitleY: number; size: number; subSize: number }
}

const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)]
const fmt = (n: number) => +n.toFixed(2)
const pt = ([x, y]: [number, number]) => `${fmt(x)} ${fmt(y)}`
const toward = (from: [number, number], to: [number, number], d: number): [number, number] => {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  return [from[0] + (dx / len) * d, from[1] + (dy / len) * d]
}

/**
 * Annular sector with straight, parallel-offset sides (so the gap between neighbours is
 * constant along its length) and softly rounded corners.
 */
export function sectorPath(r1: number, r2: number, a0: number, a1: number, halfGap: number, corner: number): string {
  const ai0 = a0 + Math.asin(Math.min(1, halfGap / r1))
  const ai1 = a1 - Math.asin(Math.min(1, halfGap / r1))
  const ao0 = a0 + Math.asin(Math.min(1, halfGap / r2))
  const ao1 = a1 - Math.asin(Math.min(1, halfGap / r2))
  if (ai1 <= ai0 || ao1 <= ao0 || r2 <= r1) return ''

  const innerArc = (ai1 - ai0) * r1
  const outerArc = (ao1 - ao0) * r2
  const cr = Math.max(0, Math.min(corner, (r2 - r1) / 2.2, innerArc / 2.2, outerArc / 2.2))

  const pi0 = polar(r1, ai0)
  const po0 = polar(r2, ao0)
  const po1 = polar(r2, ao1)
  const pi1 = polar(r1, ai1)

  if (cr < 0.01) {
    const largeO = ao1 - ao0 > Math.PI ? 1 : 0
    const largeI = ai1 - ai0 > Math.PI ? 1 : 0
    return [
      `M ${pt(pi0)}`,
      `L ${pt(po0)}`,
      `A ${fmt(r2)} ${fmt(r2)} 0 ${largeO} 1 ${pt(po1)}`,
      `L ${pt(pi1)}`,
      `A ${fmt(r1)} ${fmt(r1)} 0 ${largeI} 0 ${pt(pi0)}`,
      'Z',
    ].join(' ')
  }

  const dO = cr / r2
  const dI = cr / r1
  const largeO = ao1 - ao0 - 2 * dO > Math.PI ? 1 : 0
  const largeI = ai1 - ai0 - 2 * dI > Math.PI ? 1 : 0
  return [
    `M ${pt(toward(pi0, po0, cr))}`,
    `L ${pt(toward(po0, pi0, cr))}`,
    `Q ${pt(po0)} ${pt(polar(r2, ao0 + dO))}`,
    `A ${fmt(r2)} ${fmt(r2)} 0 ${largeO} 1 ${pt(polar(r2, ao1 - dO))}`,
    `Q ${pt(po1)} ${pt(toward(po1, pi1, cr))}`,
    `L ${pt(toward(pi1, po1, cr))}`,
    `Q ${pt(pi1)} ${pt(polar(r1, ai1 - dI))}`,
    `A ${fmt(r1)} ${fmt(r1)} 0 ${largeI} 0 ${pt(polar(r1, ai0 + dI))}`,
    `Q ${pt(pi0)} ${pt(toward(pi0, po0, cr))}`,
    'Z',
  ].join(' ')
}

export function circlePath(r: number): string {
  return `M ${fmt(-r)} 0 A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(r)} 0 A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(-r)} 0 Z`
}

/** Ring boundary radii: [centre, ring1 outer, ring2 outer, ...]. */
export function ringRadii(layout: Settings['layout']): number[] {
  const r0 = layout.centerRadius * OUTER_RADIUS
  const weights = Array.from({ length: layout.generations }, (_, k) => Math.pow(1 + layout.ringGrowth, k))
  const total = weights.reduce((a, b) => a + b, 0)
  const radii = [r0]
  let acc = r0
  for (const w of weights) {
    acc += ((OUTER_RADIUS - r0) * w) / total
    radii.push(acc)
  }
  return radii
}

export function slotCount(generations: number): number {
  return Math.pow(2, generations + 1) - 1
}

function localBounds(points: [number, number][], cx: number, cy: number, rotDeg: number): Box {
  const t = (-rotDeg * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [px, py] of points) {
    const dx = px - cx
    const dy = py - cy
    const x = dx * c - dy * s
    const y = dx * s + dy * c
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

const ASPECTS: Record<Settings['layout']['aspect'], number | null> = {
  auto: null,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  '1:1': 1,
  'A-landscape': Math.SQRT2,
  'A-portrait': 1 / Math.SQRT2,
}

export function computeGeometry(settings: Pick<Settings, 'layout' | 'title'>): ChartGeom {
  const { layout, title } = settings
  const radii = ringRadii(layout)
  const halfGap = layout.gap / 2
  const span = (layout.span * Math.PI) / 180
  const start = -Math.PI / 2 - span / 2
  const slots: SlotGeom[] = []

  const r0 = radii[0] - halfGap
  slots.push({
    id: 1,
    gen: 0,
    index: 0,
    isCenter: true,
    r1: 0,
    r2: r0,
    a0: -Math.PI,
    a1: Math.PI,
    mid: Math.PI / 2,
    path: circlePath(r0),
    cx: 0,
    cy: 0,
    frameRot: 0,
    box: { x: -r0, y: -r0, w: 2 * r0, h: 2 * r0 },
    thickness: r0 * 2,
    arcLen: Math.PI * r0,
  })

  for (let g = 1; g <= layout.generations; g++) {
    const n = Math.pow(2, g)
    const step = span / n
    const r1 = radii[g - 1] + halfGap
    const r2 = radii[g] - halfGap
    for (let i = 0; i < n; i++) {
      const a0 = start + i * step
      const a1 = a0 + step
      const mid = (a0 + a1) / 2
      const [cx, cy] = polar((r1 + r2) / 2, mid)
      const frameRot = layout.photoOrientation === 'radial' ? (mid * 180) / Math.PI + 90 : 0
      const samples: [number, number][] = []
      const steps = 16
      for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps
        samples.push(polar(r1, a), polar(r2, a))
      }
      slots.push({
        id: n + (layout.parentSide === 'mother' ? n - 1 - i : i),
        gen: g,
        index: i,
        isCenter: false,
        r1,
        r2,
        a0,
        a1,
        mid,
        path: sectorPath(r1, r2, a0, a1, halfGap, layout.cornerRadius),
        cx,
        cy,
        frameRot,
        box: localBounds(samples, cx, cy, frameRot),
        thickness: r2 - r1,
        arcLen: step * ((r1 + r2) / 2),
      })
    }
  }

  // Content bounds of the fan itself.
  let minX = -r0
  let maxX = r0
  let minY = -r0
  let maxY = r0
  const R = OUTER_RADIUS
  for (let k = 0; k <= 180; k++) {
    const a = start + (span * k) / 180
    const [x, y] = polar(R, a)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  // Inner corners at the ends of the fan can poke below the outer arc.
  for (const a of [start, start + span]) {
    const [x, y] = polar(radii[0], a)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  let titleGeom: ChartGeom['title']
  if (title.show && (title.text.trim() || title.subtitle.trim())) {
    const size = 64 * title.size
    const subSize = size * 0.42
    const hasTitle = !!title.text.trim()
    const hasSub = !!title.subtitle.trim()
    const blockH = (hasTitle ? size : 0) + (hasSub ? subSize * 1.6 : 0)
    const top = title.position === 'under-hub' ? radii[0] + size * 0.9 : maxY + size * 0.9
    const y = top + (hasTitle ? size * 0.8 : 0)
    const subtitleY = hasTitle ? y + subSize * 1.9 : top + subSize
    titleGeom = { y, subtitleY, size, subSize }
    const width = Math.max(
      hasTitle ? title.text.length * size * 0.55 : 0,
      hasSub ? title.subtitle.length * subSize * 0.62 : 0,
    )
    minX = Math.min(minX, -width / 2)
    maxX = Math.max(maxX, width / 2)
    maxY = Math.max(maxY, top + blockH + size * 0.2)
  }

  const pad = layout.padding * R
  let vb: Box = { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad }
  const target = ASPECTS[layout.aspect]
  if (target) {
    const current = vb.w / vb.h
    if (current < target) {
      const w = vb.h * target
      vb = { ...vb, x: vb.x - (w - vb.w) / 2, w }
    } else {
      const h = vb.w / target
      vb = { ...vb, y: vb.y - (h - vb.h) / 2, h }
    }
  }

  return {
    slots,
    byId: new Map(slots.map((s) => [s.id, s])),
    viewBox: vb,
    centerRadius: r0,
    title: titleGeom,
  }
}

/** The slot shape shrunk inward by `amount` on every side (used for soft-edge masks). */
export function insetPath(slot: SlotGeom, layout: Settings['layout'], amount: number): string {
  if (slot.isCenter) return circlePath(Math.max(1, slot.r2 - amount))
  const maxInset = Math.min(amount, slot.thickness * 0.3)
  return (
    sectorPath(slot.r1 + maxInset, slot.r2 - maxInset, slot.a0, slot.a1, layout.gap / 2 + maxInset, layout.cornerRadius + maxInset) ||
    slot.path
  )
}

/** Human readable relationship for an Ahnentafel number. */
export function relationship(id: SlotId): string {
  if (id === 1) return 'You (centre)'
  const gen = Math.floor(Math.log2(id))
  const female = id % 2 === 1
  const paternal = id >> (gen - 1) === 2
  const base = female ? 'mother' : 'father'
  let label: string
  if (gen === 1) label = female ? 'Mother' : 'Father'
  else if (gen === 2) label = `Grand${base}`
  else if (gen === 3) label = `Great-grand${base}`
  else label = `${gen - 2}× great-grand${base}`
  return gen === 1 ? label : `${label} · ${paternal ? 'paternal' : 'maternal'}`
}

export function generationOf(id: SlotId): number {
  return Math.floor(Math.log2(id))
}
