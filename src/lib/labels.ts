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
  | { mode: 'arc'; flipped: boolean; a0: number; a1: number; lines: LabelLine[]; band: { r: number; width: number; a0?: number; a1?: number; rounded?: boolean } }
  | {
      mode: 'straight'
      /** Label frame origin and rotation (degrees). */
      x: number
      y: number
      rot: number
      lines: LabelLine[]
      band: { y: number; height: number; width: number }
    }

// Shared limit for the overlay and text size control.
export const MAX_LABEL_SCALE = 1.8

export function arcPath(r: number, a0: number, a1: number, flipped: boolean): string {
  const p = (a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0
  return flipped ? `M ${p(a1)} A ${r} ${r} 0 ${large} 0 ${p(a0)}` : `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`
}

/** A band with square outer corners and rounded corners on its inner edge. */
export function centerBandPath(radius: number, width: number, a0: number, a1: number): string {
  const inner = Math.max(0.01, radius - width / 2)
  const outer = radius + width / 2
  const corner = Math.min(width * 0.3, inner * (a1 - a0) * 0.2)
  const angle = corner / inner
  const point = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  const innerLarge = a1 - a0 - 2 * angle > Math.PI ? 1 : 0
  return `M ${point(outer, a0)} A ${outer} ${outer} 0 ${large} 1 ${point(outer, a1)} L ${point(inner + corner, a1)} Q ${point(inner, a1)} ${point(inner, a1 - angle)} A ${inner} ${inner} 0 ${innerLarge} 0 ${point(inner, a0 + angle)} Q ${point(inner, a0)} ${point(inner + corner, a0)} Z`
}

export function layoutLabel(slot: SlotGeom, person: Person | undefined, labels: Settings['labels'], parentThickness?: number): LabelLayout | null {
  if (!labels.show || !person) return null
  const rawName = person.name.trim()
  const name = labels.uppercase ? rawName.toUpperCase() : rawName
  const dates = labels.showDates ? person.dates.trim() : ''
  if (!name && !dates) return null

  const wf = FONTS[labels.font].widthFactor * (labels.uppercase ? 1.18 : 1)
  const extent = slot.isCenter ? parentThickness ?? slot.r2 : slot.thickness
  const requestedHeight = extent * 0.3 * labels.size
  const height = slot.isCenter ? Math.min(requestedHeight, slot.r2 * 0.8) : requestedHeight
  const padding = height * 0.06
  const availableWidth = slot.isCenter
    ? slot.r2 * 1.6
    : (slot.a1 - slot.a0) * slot.r1 * 0.82

  // Greedy word wrapping, including long unbroken names. The estimate uses the
  // same font metrics as the rest of the chart and also works for SVG export.
  const wrap = (text: string, size: number): string[] => {
    if (!text) return []
    const capacity = Math.max(1, Math.floor(availableWidth / (wf * size)))
    const result: string[] = []
    let line = ''
    for (const word of text.split(/\s+/)) {
      let part = word
      while (part.length > capacity) {
        if (line) { result.push(line); line = '' }
        result.push(part.slice(0, capacity))
        part = part.slice(capacity)
      }
      if (!part) continue
      if (line && line.length + 1 + part.length > capacity) {
        result.push(line)
        line = part
      } else line = line ? `${line} ${part}` : part
    }
    if (line) result.push(line)
    return result
  }

  let fontSize = height * 0.81
  let rows: { text: string; size: number; weight: number }[] = []
  for (let attempt = 0; attempt < 200; attempt++) {
    rows = [
      ...wrap(name, fontSize).map((text) => ({ text, size: fontSize, weight: 600 })),
      ...wrap(dates, fontSize * 0.74).map((text) => ({ text, size: fontSize * 0.74, weight: 400 })),
    ]
    if (rows.reduce((sum, row) => sum + row.size * 1.08, 0) <= height - padding * 2) break
    fontSize *= 0.92
  }
  const lines: LabelLine[] = []
  if (slot.isCenter) {
    const radius = slot.r2
    const blockHeight = rows.reduce((sum, row) => sum + row.size * 1.08, 0)
    const inset = (height - blockHeight) / 2
    let cursor = radius - height + inset
    for (const row of rows) {
      lines.push({ ...row, pos: cursor + row.size * 0.85 })
      cursor += row.size * 1.08
    }
    const bandRadius = radius - height / 2
    const maxWidth = Math.max(...rows.map((row) => row.text.length * wf * row.size))
    const halfAngle = Math.min(Math.PI * 0.45, (maxWidth + height * 0.25) / (2 * bandRadius))
    return { mode: 'arc', flipped: true, a0: Math.PI * 0.05, a1: Math.PI * 0.95, lines,
      band: { r: bandRadius, width: height, a0: Math.PI / 2 - halfAngle, a1: Math.PI / 2 + halfAngle, rounded: true } }
  }

  const blockHeight = rows.reduce((sum, row) => sum + row.size * 1.08, 0)
  const inset = (height - blockHeight) / 2

  // The same path direction keeps every label oriented from the fan centre,
  // even where that makes it upside down relative to the screen.
  const flipped = false
  let cursor = slot.r1 + height - inset
  for (const row of rows) {
    lines.push({ ...row, pos: cursor - 0.85 * row.size })
    cursor -= row.size * 1.08
  }
  return { mode: 'arc', flipped, a0: slot.a0, a1: slot.a1, lines,
    band: { r: slot.r1 + height / 2, width: height } }
}
