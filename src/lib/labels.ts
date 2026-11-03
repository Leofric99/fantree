import type { SlotGeom } from './geometry'
import { FONTS } from './themes'
import type { Person, Settings } from './types'

export interface LabelLine {
  text: string
  size: number
  weight: number
  /** Arc mode: baseline radius. Straight modes: baseline y offset in the label frame. */
  pos: number
}

export type LabelLayout =
  | { mode: 'arc'; flipped: boolean; a0: number; a1: number; lines: LabelLine[]; band: { r: number; width: number } }
  | {
      mode: 'straight'
      /** Label frame origin and rotation (degrees). */
      x: number
      y: number
      rot: number
      lines: LabelLine[]
      band: { y: number; height: number; width: number }
    }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function arcPath(r: number, a0: number, a1: number, flipped: boolean): string {
  const p = (a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0
  return flipped ? `M ${p(a1)} A ${r} ${r} 0 ${large} 0 ${p(a0)}` : `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`
}

export function layoutLabel(slot: SlotGeom, person: Person | undefined, labels: Settings['labels']): LabelLayout | null {
  if (!labels.show || !person) return null
  const rawName = person.name.trim()
  const name = labels.uppercase ? rawName.toUpperCase() : rawName
  const dates = labels.showDates ? person.dates.trim() : ''
  if (!name && !dates) return null

  const wf = FONTS[labels.font].widthFactor * (labels.uppercase ? 1.18 : 1)
  const fit = (text: string, avail: number, max: number) => (text ? Math.min(max, avail / (text.length * wf)) : 0)

  if (slot.isCenter) {
    const r = slot.r2
    const base = clamp(r * 0.17, 12, 40) * labels.size
    const lineCount = (name ? 1 : 0) + (dates ? 1 : 0)
    const blockBottom = r * 0.82
    const nameSize = fit(name, r * 1.25, base)
    const dateSize = fit(dates, r * 1.1, base * 0.72)
    const lines: LabelLine[] = []
    let y = blockBottom - (dates ? dateSize * 0.3 : nameSize * 0.3)
    if (dates) {
      lines.push({ text: dates, size: dateSize, weight: 400, pos: y })
      y -= dateSize * 1.1
    }
    if (name) lines.push({ text: name, size: nameSize, weight: 600, pos: y })
    const top = (lines.at(-1)?.pos ?? y) - (lines.at(-1)?.size ?? 0) * 0.95
    const bottom = blockBottom + (lineCount ? (dates ? dateSize : nameSize) * 0.35 : 0)
    return {
      mode: 'straight',
      x: 0,
      y: 0,
      rot: 0,
      lines,
      band: { y: top, height: bottom - top + r, width: r * 2.2 },
    }
  }

  const t = slot.thickness
  const base = clamp(t * 0.15, 9, 34) * labels.size
  const midNorm = ((slot.mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const bottomHalf = midNorm > 0.02 && midNorm < Math.PI - 0.02
  const pad = t * 0.07

  // Arc text works when the segment is wider than it is deep; otherwise run text radially.
  const innerArc = (slot.a1 - slot.a0) * slot.r1
  if (innerArc >= t * 0.95) {
    const flipped = bottomHalf
    const edgeR = flipped ? slot.r2 : slot.r1
    const availArc = (r: number) => (slot.a1 - slot.a0) * r * 0.86
    const dir = flipped ? -1 : 1
    let dateSize = fit(dates, availArc(edgeR), base * 0.74)
    let nameSize = fit(name, availArc(edgeR + dir * (dateSize + pad)), base)
    const block = (name ? nameSize * 1.05 : 0) + (dates ? dateSize * 1.1 : 0) + pad
    const maxBlock = t * 0.42
    if (block > maxBlock) {
      const k = maxBlock / block
      nameSize *= k
      dateSize *= k
    }
    const lines: LabelLine[] = []
    // "Visual bottom" sits on the inner edge for upright arcs, the outer edge for flipped ones.
    let r = edgeR + dir * (pad * 1.4)
    if (dates) {
      r += dir * dateSize * (flipped ? 0.85 : 0.3)
      lines.push({ text: dates, size: dateSize, weight: 400, pos: r })
      r += dir * dateSize * (flipped ? 0.25 : 0.85)
    }
    if (name) {
      r += dir * nameSize * (flipped ? (dates ? 0.95 : 0.8) : dates ? 0.25 : 0.3)
      lines.push({ text: name, size: nameSize, weight: 600, pos: r })
      r += dir * nameSize * (flipped ? 0.2 : 0.8)
    }
    const farR = r + dir * pad * 1.2
    const bandEdge = edgeR - dir * 2
    return {
      mode: 'arc',
      flipped,
      a0: slot.a0,
      a1: slot.a1,
      lines,
      band: { r: (bandEdge + farR) / 2, width: Math.abs(farR - bandEdge) },
    }
  }

  const midDeg = (slot.mid * 180) / Math.PI
  const leftSide = Math.cos(slot.mid) < 0
  const rot = leftSide ? midDeg + 180 : midDeg
  const availLen = t * 0.86
  const cross = (slot.a1 - slot.a0) * slot.r1 * 0.82
  let nameSize = fit(name, availLen, base)
  let dateSize = fit(dates, availLen, base * 0.74)
  const blockH = nameSize * 1.1 + dateSize * 1.1
  if (blockH > cross) {
    const k = cross / blockH
    nameSize *= k
    dateSize *= k
  }
  const total = (name ? nameSize * 1.05 : 0) + (dates ? dateSize * 1.05 : 0)
  const lines: LabelLine[] = []
  let y = -total / 2
  if (name) {
    y += nameSize * 0.85
    lines.push({ text: name, size: nameSize, weight: 600, pos: y })
    y += nameSize * 0.2
  }
  if (dates) {
    y += dateSize * 0.85
    lines.push({ text: dates, size: dateSize, weight: 400, pos: y })
  }
  return {
    mode: 'straight',
    x: slot.cx,
    y: slot.cy,
    rot,
    lines,
    band: { y: -total / 2 - pad * 0.6, height: total + pad * 1.2, width: t * 1.4 },
  }
}
